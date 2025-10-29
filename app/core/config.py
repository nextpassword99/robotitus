from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    app_name: str = "Speech Recognition Server"
    host: str = "0.0.0.0"
    port: int = 8000
    sample_rate: int = 16000
    openai_api_key: str = ""
    silence_threshold: int = 500
    silence_duration: float = 1.5
    
    class Config:
        env_file = ".env"

settings = Settings()
