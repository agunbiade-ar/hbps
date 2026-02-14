import aiomysql
from typing import AsyncGenerator

from config import settings


# using this for my fastapi app
async def async_get_db_connection() -> AsyncGenerator[aiomysql.Connection, None]:
    conn = await aiomysql.connect(
        host=settings.BILLING_DB_HOST,
        port=settings.BILLING_DB_PORT,
        user=settings.BILLING_DB_USER,
        password=settings.BILLING_DB_PASSWORD,
        db=settings.BILLING_DB,
        cursorclass=aiomysql.DictCursor,
    )
    try:
        yield conn
    finally:
        conn.close()
