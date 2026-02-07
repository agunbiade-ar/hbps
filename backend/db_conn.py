import aiomysql
from typing import AsyncGenerator
from contextlib import asynccontextmanager
from config import settings


# using this for my fastapi app
async def async_get_db_connection() -> AsyncGenerator[aiomysql.Connection, None]:
    conn = await aiomysql.connect(
        host=settings.DB_HOST,
        port=settings.DB_PORT,
        user=settings.DB_USER,
        password=settings.DB_PASSWORD,
        db=settings.BILLING_DB,
        cursorclass=aiomysql.DictCursor,
    )
    try:
        yield conn
    finally:
        conn.close()
