from fastapi import status, HTTPException, APIRouter, Depends, Query
from utils.utils import set_logger
from db_conn import async_get_db_connection
from aiomysql import Error as aiomysqlError
from utils.security_utils import get_current_user
from app.models.models import BillUpdateRequest
from utils.utils import generate_receipt_number

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
            query = """SELECT bp.patient_name, bill.* FROM hayokbps.bill 
                JOIN hayokbps.billing_patients bp 
                ON bp.patient_id = bill.patient_id
                ORDER BY id DESC LIMIT %s OFFSET %s"""
            await cursor.execute(query, (limit, offset))
            bills = await cursor.fetchall()
        return bills
    except aiomysqlError as e:
        logger.error(f"Database error when fetching bills: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="failed to retrieve bills from database",
        )
    except Exception as e:
        logger.error(f"unexpected error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="unexpected error",
        )


@router.get("/{bill_id}")
async def get_bill(
    bill_id: int,
    connection=Depends(async_get_db_connection),
    current_user=Depends(get_current_user),
):
    try:
        async with connection.cursor() as cursor:
            query = """SELECT b.id AS bill_id, b.status AS bill_status, bp.patient_name,
            bi.id AS bill_item_id, bi.payment_status AS bill_item_status,
            b.*,
            bi.* FROM hayokbps.bill b
            JOIN hayokbps.billing_patients bp ON bp.patient_id = b.patient_id
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
                "bill_items": [],
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
            detail="failed to retrieve bills from database",
        )
    except Exception as e:
        logger.error(f"unexpected error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="unexpected error",
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

            get_bill_query = """SELECT * FROM hayokbps.bill WHERE id = %s"""
            await cursor.execute(get_bill_query, (bill_id,))
            bill = await cursor.fetchone()

            if bill is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Bill {bill_id} not found",
                )

            bill_total = bill.get("total_amount")
            paid_total_amount = paid_bill_items["paid_total_amount"]
            balance = bill_total - paid_total_amount

            query = """
            UPDATE hayokbps.bill 
            SET status = %s,
                paid_amount = %s,
                balance = %s, 
                updated_at = NOW() 
            WHERE id = %s
            """

            # update bill status
            await cursor.execute(
                query, (bill_status, paid_total_amount, balance, bill_id)
            )

            update_billing_visit_query = """
            UPDATE hayokbps.billing_visits 
            SET status = %s,
                updated_at = NOW() 
            WHERE id = %s
            """

            await cursor.execute(
                update_billing_visit_query, (bill_status, bill.get("billing_visit_id"))
            )

            select_orders_query = """
                SELECT * FROM hayokbps.orders
                WHERE billing_visit_id = %s"""

            await cursor.execute(select_orders_query, (bill.get("billing_visit_id")))
            orders = await cursor.fetchall()

            if orders is None:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"no orders for billing visit {bill.get('billing_visit_id')}",
                )

            retrieved_order_ids = [
                order.get("id") for order in orders if order.get("id")
            ]

            placeholders = ", ".join(["%s"] * len(retrieved_order_ids))

            update_order_status_query = f"""
            UPDATE hayokbps.orders 
            SET status = %s,
                updated_at = NOW() 
            WHERE id IN ({placeholders})
            AND billing_visit_id = %s            
            """

            await cursor.execute(
                update_order_status_query,
                (bill_status, *retrieved_order_ids, bill.get("billing_visit_id")),
            )

            # create a payment
            create_payment_query = """
            INSERT INTO hayokbps.payments (bill_id, amount, receipt_number, cashier_id, patient_id) VALUES (%s, %s, %s, %s, %s)"""

            receipt_number = generate_receipt_number()
            payment_params = (
                bill_id,
                paid_bill_items["paid_total_amount"],
                receipt_number,
                current_user.get("id"),
                bill.get("patient_id"),
            )

            await cursor.execute(create_payment_query, payment_params)
            payment_id = cursor.lastrowid

            format_strings = ", ".join(["%s"] * len(paid_bill_items["ids"]))

            update_bill_items_query = f"""UPDATE hayokbps.bill_items SET payment_id = %s,
                updated_at = NOW()
             WHERE id IN ({format_strings})"""

            await cursor.execute(
                update_bill_items_query,
                tuple([payment_id] + paid_bill_items["ids"]),
            )
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
    except HTTPException:
        raise
    except aiomysqlError as e:
        logger.error(f"Database error: {e}")
        await connection.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update bill items: {str(e)}",
        )
    except Exception as e:
        await connection.rollback()
        logger.error(f"Unexpected error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred",
        )
