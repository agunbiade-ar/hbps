from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    app_name: str = "Hayok Openmrs BPS"
    BILLING_DB: str = ""
    BILLING_DB_USER: str = ""
    BILLING_DB_HOST: str = ""
    BILLING_DB_PASSWORD: str = ""
    BILLING_DB_PORT: int = 0
    BILLING_DB_HOST_EXPOSED: str = ""
    BILLING_DB_PORT_EXPOSED: int = 0
    SECRET_KEY: str = ""
    ACCESS_TOKEN_EXPIRY_LENGTH: int = 0
    REFRESH_TOKEN_EXPIRY_LENGTH: int = 0
    ALGORITHM: str = ""
    OPENMRS_DB: str = ""
    OPENMRS_DB_USER: str = ""
    OPENMRS_DB_PASSWORD: str = ""
    OPENMRS_BASE_URL: str = ""
    OPENMRS_BASE_URL_GATEWAY: str = ""
    OPENMRS_USER: str = ""
    OPENMRS_USER_PASSWORD: str = ""
    OPENMRS_DB_HOST: str = ""
    OPENMRS_DB_PORT: int = 0

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


@lru_cache
def get_settings():
    return Settings()


settings = get_settings()
