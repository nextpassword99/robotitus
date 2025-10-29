from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    app_name: str = "Wake Word Server"
    host: str = "0.0.0.0"
    port: int = 8000
    wake_word_model: str = "alexa"
    detection_threshold: float = 0.5
    sample_rate: int = 16000
    openai_api_key: str = ""
    silence_threshold: int = 500
    silence_duration: float = 1.5
    
    @property
    def wake_word_model_path(self) -> str:
        return f"app/models/{self.wake_word_model}.onnx"
    
    class Config:
        env_file = ".env"

settings = Settings()
