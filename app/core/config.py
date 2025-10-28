from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    app_name: str = "Wake Word Server"
    host: str = "0.0.0.0"
    port: int = 8000
    wake_word_model: str = "alexa"
    detection_threshold: float = 0.5
    sample_rate: int = 16000
    
    class Config:
        env_file = ".env"

settings = Settings()
