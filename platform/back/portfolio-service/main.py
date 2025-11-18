"""
Portfolio Service - Manages user portfolios and demo wallets
Responsible for: portfolio CRUD, balance tracking, holdings
"""
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import psycopg2
from psycopg2.extras import RealDictCursor
import os
from datetime import datetime

app = FastAPI(title="Portfolio Service", version="1.0.0")

# Database connection
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
class Portfolio(BaseModel):
    user_id: int
    name: str
    type: str = "demo"  # demo or live
    initial_balance: float = 10000.0

class Holding(BaseModel):
    portfolio_id: int
    symbol: str
    quantity: float
    avg_price: float

# Routes
@app.get("/health")
async def health():
    return {"status": "healthy", "service": "portfolio-service"}

@app.post("/portfolios")
async def create_portfolio(portfolio: Portfolio):
    """Create new portfolio for user"""
    conn = get_db_connection()
    cur = conn.cursor()
    
    try:
        cur.execute("""
            INSERT INTO portfolios (user_id, name, type, balance, initial_balance, created_at)
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING portfolio_id, user_id, name, type, balance, created_at
        """, (
            portfolio.user_id,
            portfolio.name,
            portfolio.type,
            portfolio.initial_balance,
            portfolio.initial_balance,
            datetime.utcnow()
        ))
        
        result = cur.fetchone()
        conn.commit()
        return result
        
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        conn.close()

@app.get("/portfolios")
async def get_portfolios(user_id: int):
    """Get all portfolios for user"""
    conn = get_db_connection()
    cur = conn.cursor()
    
    try:
        cur.execute("""
            SELECT portfolio_id, user_id, name, type, balance, initial_balance, created_at, updated_at
            FROM portfolios
            WHERE user_id = %s
            ORDER BY created_at DESC
        """, (user_id,))
        
        portfolios = cur.fetchall()
        return {"portfolios": portfolios}
        
    finally:
        cur.close()
        conn.close()

@app.get("/portfolios/{portfolio_id}")
async def get_portfolio(portfolio_id: int):
    """Get specific portfolio with holdings"""
    conn = get_db_connection()
    cur = conn.cursor()
    
    try:
        # Get portfolio info
        cur.execute("""
            SELECT portfolio_id, user_id, name, type, balance, initial_balance, created_at, updated_at
            FROM portfolios
            WHERE portfolio_id = %s
        """, (portfolio_id,))
        
        portfolio = cur.fetchone()
        if not portfolio:
            raise HTTPException(status_code=404, detail="Portfolio not found")
        
        # Get holdings
        cur.execute("""
            SELECT symbol, quantity, avg_price, current_value, pnl, pnl_percent
            FROM holdings
            WHERE portfolio_id = %s AND quantity > 0
        """, (portfolio_id,))
        
        holdings = cur.fetchall()
        
        return {
            "portfolio": portfolio,
            "holdings": holdings
        }
        
    finally:
        cur.close()
        conn.close()

@app.post("/portfolios/{portfolio_id}/holdings")
async def update_holding(portfolio_id: int, holding: Holding):
    """Update holding in portfolio (after order execution)"""
    conn = get_db_connection()
    cur = conn.cursor()
    
    try:
        # Check if holding exists
        cur.execute("""
            SELECT holding_id, quantity, avg_price
            FROM holdings
            WHERE portfolio_id = %s AND symbol = %s
        """, (portfolio_id, holding.symbol))
        
        existing = cur.fetchone()
        
        if existing:
            # Update existing holding
            new_quantity = existing['quantity'] + holding.quantity
            new_avg_price = (
                (existing['quantity'] * existing['avg_price']) + 
                (holding.quantity * holding.avg_price)
            ) / new_quantity if new_quantity != 0 else 0
            
            cur.execute("""
                UPDATE holdings
                SET quantity = %s, avg_price = %s, updated_at = %s
                WHERE holding_id = %s
            """, (new_quantity, new_avg_price, datetime.utcnow(), existing['holding_id']))
        else:
            # Create new holding
            cur.execute("""
                INSERT INTO holdings (portfolio_id, symbol, quantity, avg_price, created_at)
                VALUES (%s, %s, %s, %s, %s)
            """, (portfolio_id, holding.symbol, holding.quantity, holding.avg_price, datetime.utcnow()))
        
        conn.commit()
        return {"status": "success", "message": "Holding updated"}
        
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        conn.close()

@app.put("/portfolios/{portfolio_id}/balance")
async def update_balance(portfolio_id: int, amount: float):
    """Update portfolio balance (after order execution)"""
    conn = get_db_connection()
    cur = conn.cursor()
    
    try:
        cur.execute("""
            UPDATE portfolios
            SET balance = balance + %s, updated_at = %s
            WHERE portfolio_id = %s
            RETURNING balance
        """, (amount, datetime.utcnow(), portfolio_id))
        
        result = cur.fetchone()
        conn.commit()
        
        return {"balance": result['balance']}
        
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
