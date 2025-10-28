from fastapi import FastAPI
from app.api.websocket import router as ws_router
from app.core.config import settings
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

app = FastAPI(title=settings.app_name)

app.include_router(ws_router)

@app.get("/health")
async def health_check():
    return {"status": "ok"}
