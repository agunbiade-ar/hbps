from aiomysql import Error as aiomysqlError
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.models.models import PayerType
from db_conn import async_get_db_connection
from utils.security_utils import get_current_user
from utils.utils import set_logger
import aiomysql

logger = set_logger(__name__)

router = APIRouter(prefix="/payers", tags=["payers"])


@router.get("/payers")
async def get_payer_types(
    payer_id: int = Query(default=None),
    current_user=Depends(get_current_user),
    connection=Depends(async_get_db_connection),
):
    try:
        async with connection.cursor() as cursor:
            if payer_id is None:
                query = """SELECT * FROM hayokbps.payer_type"""
                await cursor.execute(query)
            else:
                query = """SELECT * FROM hayokbps.payer_type WHERE id = %s"""
                await cursor.execute(query, (payer_id,))

            payer_types = await cursor.fetchall()
            return {"payer_types": payer_types, "total_payers": len(payer_types)}
    except aiomysqlError as e:
        logger.error(f"Database error when fetching payer types: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="failed to retrieve payer types from database",
        )
    except Exception as e:
        logger.error(f"unexpected error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="unexpected error",
        )


@router.post("/payers")
async def create_payer_type(
    payer_info: PayerType,
    current_user=Depends(get_current_user),
    connection=Depends(async_get_db_connection),
):
    try:
        async with connection.cursor() as cursor:
            payload = payer_info.model_dump()

            payer_code = payload.get("payer_code").upper()  # type: ignore
            print(payload)
            await cursor.execute(
                "INSERT IGNORE INTO hayokbps.payer_type (payer_code, payer_name) VALUES (%s, %s)",
                (payer_code, payload.get("payer_name")),
            )

            if cursor.rowcount == 0:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"A payer with code {payload.get('payer_code')} already exists",
                )

            payer_id = cursor.lastrowid

            if payer_id is None:
                raise HTTPException(
                    status_code=status.HTTP_501_NOT_IMPLEMENTED,
                    detail="unable to create payer type",
                )

            get_payer_query = """
                SELECT * FROM hayokbps.payer_type WHERE id = %s"""

            await cursor.execute(
                get_payer_query,
                (payer_id),
            )

            payer = await cursor.fetchone()

            if not payer:
                raise HTTPException(
                    status_code=status.HTTP_501_NOT_IMPLEMENTED,
                    detail="Unable to retrieve payer information",
                )

            await connection.commit()
            return payer
    except aiomysqlError as e:
        logger.error(f"Database error when creating payer type: {e}")
        await connection.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create payer type due to database error",
        )
    except Exception as e:
        logger.error(f"Unexpected error when creating payer type: {e}")
        await connection.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unexpected error when creating payer type",
        )


@router.put("/{payer_id}")
async def edit_payer(
    payer_id: int,
    payer: PayerType,
    current_user=Depends(get_current_user),
    connection=Depends(async_get_db_connection),
):
    try:
        async with connection.cursor() as cursor:
            await cursor.execute(
                "SELECT * FROM hayokbps.payer_type WHERE id = %s", (payer_id,)
            )
            payer_ = await cursor.fetchone()
            if payer_ is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"payer {payer_id} does not exist",
                )

            await cursor.execute(
                """UPDATE hayokbps.payer_type
                            SET payer_code = %s,
                                payer_name = %s
                            WHERE id = %s""",
                (payer.payer_code, payer.payer_name, payer_id),
            )

            if cursor.rowcount == 0:
                return {"message": "No changes made"}

            await connection.commit()
            return {"message": "updated payer successfully"}
    except aiomysqlError as e:
        logger.error(f"Database error when updating payer type: {e}")
        await connection.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to edit payer type due to database error",
        )
    except Exception as e:
        logger.error(f"Unexpected error when updating payer type: {e}")
        await connection.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected error when updating payer type: {e}",
        )


@router.delete("/{payer_id}")
async def delete_payer(
    payer_id: int,
    current_user=Depends(get_current_user),
    connection=Depends(async_get_db_connection),
):
    try:
        async with connection.cursor() as cursor:
            await cursor.execute(
                """
                DELETE FROM hayokbps.payer_type
                WHERE id = %s
                """,
                (payer_id,),
            )

            await connection.commit()

            if cursor.rowcount == 0:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Payer {payer_id} does not exist",
                )

            return {"message": "Payer deleted successfully"}

    except aiomysql.IntegrityError as e:
        await connection.rollback()
        logger.error(
            f"Cannot delete payer because it is linked to existing records: {e}"
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete payer because it is linked to existing records",
        )

    except aiomysql.Error as e:
        await connection.rollback()
        logger.error(f"Database error while deleting payer: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error while deleting payer",
        )

    except Exception as e:
        await connection.rollback()
        logger.error(f"Unexpected error while deleting payer: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unexpected error while deleting payer",
        )
