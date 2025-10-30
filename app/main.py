from fastapi import FastAPI
from contextlib import asynccontextmanager
from app.api.routes import router, llm_service
from app.core.config import settings
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    await llm_service.initialize()
    yield
    if llm_service.mcp_client:
        await llm_service.mcp_client.shutdown()

app = FastAPI(title=settings.app_name, lifespan=lifespan)

app.include_router(router, prefix="/api")

@app.get("/health")
async def health_check():
    return {"status": "ok"}
