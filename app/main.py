from fastapi import FastAPI
from app.api.routes import router
from app.core.config import settings
from contextlib import asynccontextmanager
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    from app.api.routes import llm_service
    if llm_service.mcp_client:
        await llm_service.initialize()
    yield
    # Shutdown
    if llm_service.mcp_client:
        await llm_service.mcp_client.shutdown()

app = FastAPI(title=settings.app_name, lifespan=lifespan)

app.include_router(router, prefix="/api")

@app.get("/health")
async def health_check():
    return {"status": "ok"}
