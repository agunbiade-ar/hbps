from fastapi import status, HTTPException, APIRouter, Depends, Query
from utils.utils import set_logger
from db_conn import async_get_db_connection
from aiomysql import Error as aiomysqlError
from utils.security_utils import get_current_user
from app.models.models import BillUpdateRequest
from utils.utils import generate_receipt_number
import json

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
            query = """SELECT  b.id AS bill_id, b.status AS bill_status,
            bi.id AS bill_item_id, bi.payment_status AS bill_item_status,
            b.*,
            bi.* FROM hayokbps.bill b
            JOIN hayokbps.bill_items bi ON bi.bill_id = b.id
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
                "bill_status": rows[0]["bill_status"],
                "bill_items": [],  # Initialize the array
            }

            for row in rows:
                item = {
                    "bill_item_id": row["bill_item_id"],
                    "concept_name": row["description"],
                    "quantity": row["quantity"],
                    "price": row["unit_price"],
                    "status": row["bill_item_status"],
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


@router.patch("/{bill_id}")
async def update_bill(
    bill_id: int,
    bill_update: BillUpdateRequest,
    connection=Depends(async_get_db_connection),
    current_user=Depends(get_current_user),
):
    try:
        if not bill_update.item_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="you need to pass in at least one bill item id",
            )

        placeholders = ", ".join(["%s"] * len(bill_update.item_ids))
        async with connection.cursor() as cursor:
            query = f"""
            UPDATE hayokbps.bill_items
            SET payment_status = %s,
            updated_at = NOW() 
            WHERE id IN ({placeholders}) AND bill_id = %s"""

            params = [bill_update.status] + bill_update.item_ids + [bill_id]
            await cursor.execute(query, params)
            updated_row_count = cursor.rowcount

            query = """SELECT * FROM hayokbps.bill_items WHERE bill_id = %s"""
            await cursor.execute(query, (bill_id,))
            rows = await cursor.fetchall()

            if not rows:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"No items found for bill {bill_id}",
                )

            # Count statuses
            counts = {}
            paid_bill_items = {"paid_total_amount": 0, "ids": []}
            for row in rows:
                item_status = row.get("payment_status")
                if item_status == "paid":
                    paid_bill_items["paid_total_amount"] += row.get("total_price")
                    paid_bill_items["ids"].append(row.get("id"))

                counts[item_status] = counts.get(item_status, 0) + 1

            total_items = len(rows)
            paid_count = counts.get("paid", 0)
            pending_count = counts.get("pending", 0)
            cancelled_count = counts.get("cancelled", 0)

            # print(counts)
            if paid_count == total_items:
                bill_status = "paid"
            elif paid_count > 0 and pending_count > 0:
                bill_status = "partially_paid"
            elif cancelled_count == total_items:
                bill_status = "cancelled"
            elif pending_count == total_items:
                bill_status = "pending"
            elif paid_count > 0:  # Some paid, others might be cancelled/other statuses
                bill_status = "partially_paid"
            else:
                bill_status = "pending"  # Default

            query = """
            UPDATE hayokbps.bill 
            SET status = %s, 
                updated_at = NOW() 
            WHERE id = %s
            """

            # update bill status
            await cursor.execute(query, (bill_status, bill_id))

            # create a payment
            create_payment_query = """
            INSERT INTO hayokbps.payments (bill_id, amount, receipt_number, paid_items_ids, cashier_id) VALUES (%s, %s, %s, %s, %s)"""

            receipt_number = generate_receipt_number()
            payment_params = [
                bill_id,
                paid_bill_items["paid_total_amount"],
                receipt_number,
                json.dumps(paid_bill_items["ids"]),
                current_user.get("id"),
            ]

            await cursor.execute(create_payment_query, tuple(payment_params))

            # Fetch the updated bill
            query = """
            SELECT b.*, 
                    COUNT(bi.id) as item_count,
                    SUM(CASE WHEN bi.payment_status = 'paid' THEN 1 ELSE 0 END) as paid_count
            FROM hayokbps.bill b
            LEFT JOIN hayokbps.bill_items bi ON b.id = bi.bill_id
            WHERE b.id = %s
            GROUP BY b.id
            """

            await cursor.execute(query, (bill_id,))
            bill = await cursor.fetchone()
            await connection.commit()

            return {
                "message": f"Successfully made payments for {updated_row_count} item(s)",
                "bill": bill,
                "items_updated": updated_row_count,
            }
    except aiomysqlError as e:
        logger.error(f"Database error: {e}")
        await connection.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update bill items: {str(e)}",
        )
    except HTTPException:
        raise
    except Exception as e:
        await connection.rollback()
        logger.error(f"Unexpected error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred",
        )
