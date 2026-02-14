from fastapi import status, HTTPException, APIRouter, Depends, Query
from utils.utils import set_logger
from db_conn import async_get_db_connection
from aiomysql import Error as aiomysqlError
from utils.security_utils import get_current_user
from app.models.models import Facility

logger = set_logger(__name__)

router = APIRouter(prefix="/facilities", tags=["Facility"])


@router.get("/{facility_id}", response_model=Facility)
async def get_facilities(
    connection=Depends(async_get_db_connection),
    current_user=Depends(get_current_user),
):
    async with connection.cursor() as cursor:
        try:
            query = """SELECT * FROM hayokbps.facility WHERE id = 1"""
            await cursor.execute(query)
            facilities = await cursor.fetchone()
            return facilities
        except HTTPException as e:
            raise e
        except aiomysqlError as e:
            logger.error(f"Database error when getting facility details: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Database error when getting facility details: {e}",
            )
        except Exception as e:
            logger.error(f"unexpected error: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"unexpected error, when retrieving facility details {e}",
            )
