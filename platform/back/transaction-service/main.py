"""
Transaction Service - Records and tracks all transactions
Maintains audit trail for compliance and analytics
"""
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional
import psycopg2
from psycopg2.extras import RealDictCursor
import os
from datetime import datetime

app = FastAPI(title="Transaction Service", version="1.0.0")

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
class Transaction(BaseModel):
    portfolio_id: int
    order_id: int
    symbol: str
    side: str
    quantity: float
    price: float
    total: float
    fee: float = 0.0

# Routes
@app.get("/health")
async def health():
    return {"status": "healthy", "service": "transaction-service"}

@app.post("/transactions")
async def create_transaction(transaction: Transaction):
    """Record new transaction"""
    conn = get_db_connection()
    cur = conn.cursor()
    
    try:
        cur.execute("""
            INSERT INTO transactions 
            (portfolio_id, order_id, symbol, side, quantity, price, total, fee, timestamp)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING transaction_id, timestamp
        """, (
            transaction.portfolio_id,
            transaction.order_id,
            transaction.symbol,
            transaction.side,
            transaction.quantity,
            transaction.price,
            transaction.total,
            transaction.fee,
            datetime.utcnow()
        ))
        
        result = cur.fetchone()
        conn.commit()
        
        return {
            "transaction_id": result['transaction_id'],
            "timestamp": result['timestamp']
        }
        
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        conn.close()

@app.get("/transactions")
async def get_transactions(
    user_id: Optional[int] = None,
    portfolio_id: Optional[int] = None,
    symbol: Optional[str] = None,
    limit: int = 100
):
    """Get transaction history with filters"""
    conn = get_db_connection()
    cur = conn.cursor()
    
    try:
        query = """
            SELECT t.transaction_id, t.portfolio_id, t.order_id, t.symbol,
                   t.side, t.quantity, t.price, t.total, t.fee, t.timestamp
            FROM transactions t
            JOIN portfolios p ON t.portfolio_id = p.portfolio_id
            WHERE 1=1
        """
        params = []
        
        if user_id:
            query += " AND p.user_id = %s"
            params.append(user_id)
        
        if portfolio_id:
            query += " AND t.portfolio_id = %s"
            params.append(portfolio_id)
        
        if symbol:
            query += " AND t.symbol = %s"
            params.append(symbol)
        
        query += " ORDER BY t.timestamp DESC LIMIT %s"
        params.append(limit)
        
        cur.execute(query, params)
        transactions = cur.fetchall()
        
        return {"transactions": transactions}
        
    finally:
        cur.close()
        conn.close()

@app.get("/transactions/stats")
async def get_transaction_stats(portfolio_id: int):
    """Get transaction statistics for portfolio"""
    conn = get_db_connection()
    cur = conn.cursor()
    
    try:
        cur.execute("""
            SELECT 
                COUNT(*) as total_transactions,
                SUM(CASE WHEN side = 'buy' THEN 1 ELSE 0 END) as buys,
                SUM(CASE WHEN side = 'sell' THEN 1 ELSE 0 END) as sells,
                SUM(total) as total_volume,
                SUM(fee) as total_fees
            FROM transactions
            WHERE portfolio_id = %s
        """, (portfolio_id,))
        
        stats = cur.fetchone()
        return stats
        
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8003)
