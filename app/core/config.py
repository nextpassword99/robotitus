from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    # API
    app_name: str = "SENATI Assistant API"
    host: str = "0.0.0.0"
    port: int = 8000

    # OpenAI
    openai_api_key: str = ""
    whisper_model: str = "whisper-1"
    llm_model: str = "gpt-4o-mini"
    embedding_model: str = "text-embedding-3-small"

    # RAG
    use_rag: bool = True
    chroma_persist_dir: str = "./data/chroma"
    collection_name: str = "senati_knowledge"
    chunk_size: int = 500
    chunk_overlap: int = 50
    top_k_results: int = 3

    # MCP
    use_mcp: bool = False
    mcp_enabled_servers: List[str] = ["serper"]

    # Data
    data_dir: str = "./data/senati"

    class Config:
        env_file = ".env"


settings = Settings()
