"""
Order Service - Handles order placement, matching, and execution
Manages: market/limit orders, order book, demo trading
"""
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional, List
import psycopg2
from psycopg2.extras import RealDictCursor
import os
from datetime import datetime
import httpx
import redis
import json

app = FastAPI(title="Order Service", version="1.0.0")

# Redis for real-time price cache
redis_client = redis.Redis(
    host=os.getenv("REDIS_HOST", "redis"),
    port=int(os.getenv("REDIS_PORT", 6379)),
    decode_responses=True
)

def get_db_connection():
    return psycopg2.connect(
        host=os.getenv("POSTGRES_HOST", "postgres"),
        port=os.getenv("POSTGRES_PORT", "5432"),
        database=os.getenv("POSTGRES_DB", "lakehouse"),
        user=os.getenv("POSTGRES_USER", "admin"),
        password=os.getenv("POSTGRES_PASSWORD", "admin123"),
        cursor_factory=RealDictCursor
    )

# Models
class Order(BaseModel):
    portfolio_id: int
    symbol: str
    side: str  # buy or sell
    type: str  # market or limit
    quantity: float
    price: Optional[float] = None  # for limit orders

# Routes
@app.get("/health")
async def health():
    return {"status": "healthy", "service": "order-service"}

@app.post("/orders")
async def create_order(order: Order):
    """Create and execute order"""
    conn = get_db_connection()
    cur = conn.cursor()
    
    try:
        # Get current price from Redis
        current_price = redis_client.get(f"price:{order.symbol}")
        if not current_price:
            raise HTTPException(status_code=400, detail="Price not available")
        
        current_price = float(current_price)
        execution_price = order.price if order.type == "limit" else current_price
        
        # For market orders, execute immediately
        if order.type == "market":
            # Calculate total cost
            total_cost = execution_price * order.quantity
            
            # Get portfolio balance
            cur.execute("SELECT balance FROM portfolios WHERE portfolio_id = %s", (order.portfolio_id,))
            portfolio = cur.fetchone()
            
            if not portfolio:
                raise HTTPException(status_code=404, detail="Portfolio not found")
            
            # Check balance for buy orders
            if order.side == "buy" and portfolio['balance'] < total_cost:
                raise HTTPException(status_code=400, detail="Insufficient balance")
            
            # Create order record
            cur.execute("""
                INSERT INTO orders (portfolio_id, symbol, side, type, quantity, price, status, created_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING order_id
            """, (
                order.portfolio_id, order.symbol, order.side, order.type,
                order.quantity, execution_price, "filled", datetime.utcnow()
            ))
            
            order_id = cur.fetchone()['order_id']
            
            # Update portfolio via portfolio-service
            async with httpx.AsyncClient() as client:
                # Update balance
                balance_change = -total_cost if order.side == "buy" else total_cost
                await client.put(
                    f"http://portfolio-service:8001/portfolios/{order.portfolio_id}/balance",
                    params={"amount": balance_change}
                )
                
                # Update holdings
                quantity_change = order.quantity if order.side == "buy" else -order.quantity
                await client.post(
                    f"http://portfolio-service:8001/portfolios/{order.portfolio_id}/holdings",
                    json={
                        "portfolio_id": order.portfolio_id,
                        "symbol": order.symbol,
                        "quantity": quantity_change,
                        "avg_price": execution_price
                    }
                )
            
            # Create transaction record via transaction-service
            async with httpx.AsyncClient() as client:
                await client.post(
                    "http://transaction-service:8003/transactions",
                    json={
                        "portfolio_id": order.portfolio_id,
                        "order_id": order_id,
                        "symbol": order.symbol,
                        "side": order.side,
                        "quantity": order.quantity,
                        "price": execution_price,
                        "total": total_cost,
                        "fee": 0.0  # Demo trading has no fees
                    }
                )
            
            conn.commit()
            
            return {
                "order_id": order_id,
                "status": "filled",
                "execution_price": execution_price,
                "total": total_cost
            }
        
        else:  # limit order
            # Store order, wait for price to match
            cur.execute("""
                INSERT INTO orders (portfolio_id, symbol, side, type, quantity, price, status, created_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING order_id
            """, (
                order.portfolio_id, order.symbol, order.side, order.type,
                order.quantity, order.price, "pending", datetime.utcnow()
            ))
            
            order_id = cur.fetchone()['order_id']
            conn.commit()
            
            return {
                "order_id": order_id,
                "status": "pending",
                "message": "Limit order placed, waiting for execution"
            }
            
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        conn.close()

@app.get("/orders")
async def get_orders(user_id: int = None, portfolio_id: int = None, status: str = None):
    """Get orders with filters"""
    conn = get_db_connection()
    cur = conn.cursor()
    
    try:
        query = """
            SELECT o.order_id, o.portfolio_id, o.symbol, o.side, o.type,
                   o.quantity, o.price, o.status, o.created_at, o.filled_at
            FROM orders o
            JOIN portfolios p ON o.portfolio_id = p.portfolio_id
            WHERE 1=1
        """
        params = []
        
        if user_id:
            query += " AND p.user_id = %s"
            params.append(user_id)
        
        if portfolio_id:
            query += " AND o.portfolio_id = %s"
            params.append(portfolio_id)
        
        if status:
            query += " AND o.status = %s"
            params.append(status)
        
        query += " ORDER BY o.created_at DESC LIMIT 100"
        
        cur.execute(query, params)
        orders = cur.fetchall()
        
        return {"orders": orders}
        
    finally:
        cur.close()
        conn.close()

@app.delete("/orders/{order_id}")
async def cancel_order(order_id: int):
    """Cancel pending order"""
    conn = get_db_connection()
    cur = conn.cursor()
    
    try:
        cur.execute("""
            UPDATE orders
            SET status = 'cancelled', updated_at = %s
            WHERE order_id = %s AND status = 'pending'
            RETURNING order_id
        """, (datetime.utcnow(), order_id))
        
        result = cur.fetchone()
        
        if not result:
            raise HTTPException(status_code=404, detail="Order not found or already filled")
        
        conn.commit()
        return {"status": "cancelled", "order_id": order_id}
        
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)
