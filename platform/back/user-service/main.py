"""
User Service - User management and demo wallet creation
Handles: user registration, authentication, demo wallet setup
"""
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional
import psycopg2
from psycopg2.extras import RealDictCursor
import os
from datetime import datetime
import httpx

app = FastAPI(title="User Service", version="1.0.0")

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
class User(BaseModel):
    username: str
    email: str
    full_name: Optional[str] = None

class DemoWallet(BaseModel):
    initial_balance: float = 10000.0

# Routes
@app.get("/health")
async def health():
    return {"status": "healthy", "service": "user-service"}

@app.post("/users")
async def create_user(user: User):
    """Create new user"""
    conn = get_db_connection()
    cur = conn.cursor()
    
    try:
        cur.execute("""
            INSERT INTO users (username, email, full_name, created_at)
            VALUES (%s, %s, %s, %s)
            RETURNING user_id, username, email, full_name, created_at
        """, (user.username, user.email, user.full_name, datetime.utcnow()))
        
        result = cur.fetchone()
        conn.commit()
        
        return result
        
    except psycopg2.IntegrityError:
        conn.rollback()
        raise HTTPException(status_code=400, detail="Username or email already exists")
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        conn.close()

@app.get("/users/{user_id}")
async def get_user(user_id: int):
    """Get user by ID"""
    conn = get_db_connection()
    cur = conn.cursor()
    
    try:
        cur.execute("""
            SELECT user_id, username, email, full_name, created_at
            FROM users
            WHERE user_id = %s
        """, (user_id,))
        
        user = cur.fetchone()
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        return user
        
    finally:
        cur.close()
        conn.close()

@app.post("/users/{user_id}/demo-wallet")
async def create_demo_wallet(user_id: int, wallet: DemoWallet):
    """Create demo wallet (portfolio) for user"""
    
    try:
        # Check if user exists
        user = await get_user(user_id)
        
        # Create demo portfolio via portfolio-service
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "http://portfolio-service:8001/portfolios",
                json={
                    "user_id": user_id,
                    "name": f"{user['username']}'s Demo Wallet",
                    "type": "demo",
                    "initial_balance": wallet.initial_balance
                }
            )
            
            if response.status_code != 200:
                raise HTTPException(status_code=500, detail="Failed to create portfolio")
            
            return response.json()
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/users/{user_id}/wallets")
async def get_user_wallets(user_id: int):
    """Get all wallets for user"""
    try:
        # Get portfolios via portfolio-service
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "http://portfolio-service:8001/portfolios",
                params={"user_id": user_id}
            )
            
            return response.json()
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8006)
