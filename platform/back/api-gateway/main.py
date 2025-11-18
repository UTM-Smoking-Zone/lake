"""
API Gateway - Central entry point for all microservices
Handles routing, WebSocket connections, and service discovery
"""
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import httpx
import json
from typing import Dict, List
import asyncio
import os

app = FastAPI(title="Trading Platform API Gateway", version="1.0.0")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Service registry
SERVICES = {
    "portfolio": os.getenv("PORTFOLIO_SERVICE_URL", "http://portfolio-service:8001"),
    "order": os.getenv("ORDER_SERVICE_URL", "http://order-service:8002"),
    "transaction": os.getenv("TRANSACTION_SERVICE_URL", "http://transaction-service:8003"),
    "analytics": os.getenv("ANALYTICS_SERVICE_URL", "http://analytics-service:8004"),
    "ml": os.getenv("ML_SERVICE_URL", "http://ml-service:8005"),
    "user": os.getenv("USER_SERVICE_URL", "http://user-service:8006"),
}

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        """Broadcast message to all connected clients"""
        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except:
                disconnected.append(connection)
        
        # Clean up disconnected clients
        for conn in disconnected:
            self.active_connections.remove(conn)

manager = ConnectionManager()

# Health check
@app.get("/health")
async def health():
    return {"status": "healthy", "service": "api-gateway"}

# WebSocket endpoint for real-time data
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Keep connection alive
            data = await websocket.receive_text()
            # Echo or handle client messages
            await websocket.send_json({"type": "pong", "data": data})
    except WebSocketDisconnect:
        manager.disconnect(websocket)

# Proxy endpoints for microservices

# Portfolio Service routes
@app.get("/api/portfolios")
async def get_portfolios(user_id: int):
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{SERVICES['portfolio']}/portfolios", params={"user_id": user_id})
        return response.json()

@app.post("/api/portfolios")
async def create_portfolio(portfolio_data: dict):
    async with httpx.AsyncClient() as client:
        response = await client.post(f"{SERVICES['portfolio']}/portfolios", json=portfolio_data)
        return response.json()

# Order Service routes
@app.post("/api/orders")
async def create_order(order_data: dict):
    async with httpx.AsyncClient() as client:
        response = await client.post(f"{SERVICES['order']}/orders", json=order_data)
        return response.json()

@app.get("/api/orders")
async def get_orders(user_id: int, status: str = None):
    async with httpx.AsyncClient() as client:
        params = {"user_id": user_id}
        if status:
            params["status"] = status
        response = await client.get(f"{SERVICES['order']}/orders", params=params)
        return response.json()

@app.delete("/api/orders/{order_id}")
async def cancel_order(order_id: str):
    async with httpx.AsyncClient() as client:
        response = await client.delete(f"{SERVICES['order']}/orders/{order_id}")
        return response.json()

# Transaction Service routes
@app.get("/api/transactions")
async def get_transactions(user_id: int):
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{SERVICES['transaction']}/transactions", params={"user_id": user_id})
        return response.json()

# Analytics Service routes
@app.get("/api/analytics/ohlcv")
async def get_ohlcv(symbol: str, interval: str):
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{SERVICES['analytics']}/ohlcv",
            params={"symbol": symbol, "interval": interval}
        )
        return response.json()

@app.get("/api/analytics/indicators")
async def get_indicators(symbol: str, indicators: str):
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{SERVICES['analytics']}/indicators",
            params={"symbol": symbol, "indicators": indicators}
        )
        return response.json()

# ML Service routes
@app.get("/api/ml/predict")
async def get_prediction(symbol: str, horizon: int = 60):
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{SERVICES['ml']}/predict",
            params={"symbol": symbol, "horizon": horizon}
        )
        return response.json()

@app.post("/api/ml/backtest")
async def backtest_strategy(strategy_data: dict):
    async with httpx.AsyncClient() as client:
        response = await client.post(f"{SERVICES['ml']}/backtest", json=strategy_data)
        return response.json()

# User Service routes
@app.post("/api/users")
async def create_user(user_data: dict):
    async with httpx.AsyncClient() as client:
        response = await client.post(f"{SERVICES['user']}/users", json=user_data)
        return response.json()

@app.get("/api/users/{user_id}")
async def get_user(user_id: int):
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{SERVICES['user']}/users/{user_id}")
        return response.json()

@app.post("/api/users/{user_id}/demo-wallet")
async def create_demo_wallet(user_id: int, initial_balance: float = 10000.0):
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{SERVICES['user']}/users/{user_id}/demo-wallet",
            json={"initial_balance": initial_balance}
        )
        return response.json()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
