from fastapi import status, HTTPException, APIRouter, Depends, Query
from utils.utils import set_logger
from db_conn import async_get_db_connection
from aiomysql import Error as aiomysqlError
from utils.security_utils import get_current_user

logger = set_logger(__name__)

router = APIRouter(prefix="/bills", tags=["Billing"])


@router.get("/bills")
async def get_all_bills(
    current_user=Depends(get_current_user),
    limit: int = Query(default=100, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    connection=Depends(async_get_db_connection),
):
    try:
        async with connection.cursor() as cursor:
            query = (
                """SELECT * FROM hayokbps.bill ORDER BY id DESC LIMIT %s OFFSET %s"""
            )
            await cursor.execute(query, (limit, offset))
            bills = await cursor.fetchall()
        return bills
    except aiomysqlError as e:
        logger.error(f"Database error when fetching bills: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"failed to retrieve bills from database",
        )
    except Exception as e:
        logger.error(f"unexpected error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"unexpected error",
        )


@router.get("/{bill_id}")
async def get_bill(
    bill_id: int,
    connection=Depends(async_get_db_connection),
    current_user=Depends(get_current_user),
):
    try:
        async with connection.cursor() as cursor:
            query = """SELECT * FROM hayokbps.bill b
            JOIN hayokbps.bill_item bi ON bi.bill_id = b.id
            WHERE b.id = %s"""
            await cursor.execute(query, (bill_id,))
            rows = await cursor.fetchall()

            if not rows:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"bill {bill_id} not found",
                )
            bill_data = {
                "bill_id": rows[0]["id"],
                "patient_name": rows[0]["patient_name"],
                "total_amount": rows[0]["total_amount"],
                "bill_items": [],  # Initialize the array
            }

            for row in rows:
                item = {
                    "id": row["bill_id"],
                    "concept_name": row["concept_name"],
                    "quantity": row["quantity"],
                    "price": row["price"],
                    "status": row["status"],
                }
                bill_data["bill_items"].append(item)
        return bill_data
    except aiomysqlError as e:
        logger.error(f"Database error when fetching bill with id of {bill_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"failed to retrieve bills from database",
        )
    except Exception as e:
        logger.error(f"unexpected error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"unexpected error",
        )
