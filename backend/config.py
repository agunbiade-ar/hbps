from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    app_name: str = "Hayok Openmrs BPS"
    BASE_URL: str
    BILLING_DB: str
    DB_USER: str
    DB_HOST: str
    DB_PASSWORD: str
    OPENMRS_DB: str
    DB_PORT: int
    SECRET_KEY: str
    ACCESS_TOKEN_EXPIRY_LENGTH: int
    REFRESH_TOKEN_EXPIRY_LENGTH: int
    ALGORITHM: str
    OPENMRS_USER: str
    OPENMRS_PASSWORD: str

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


@lru_cache
def get_settings():
    return Settings()


settings = get_settings()
