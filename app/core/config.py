from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    app_name: str = "Speech Recognition API"
    host: str = "0.0.0.0"
    port: int = 8000
    openai_api_key: str = ""
    
    class Config:
        env_file = ".env"

settings = Settings()
