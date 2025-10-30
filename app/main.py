from fastapi import FastAPI
from app.api.routes import router
from app.core.config import settings
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

app = FastAPI(title=settings.app_name)

app.include_router(router)

@app.get("/health")
async def health_check():
    return {"status": "ok"}
