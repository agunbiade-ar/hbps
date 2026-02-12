from fastapi import status, HTTPException, APIRouter, Depends, Query
from utils.utils import set_logger
from db_conn import async_get_db_connection
from aiomysql import Error as aiomysqlError
from utils.security_utils import get_current_user
from app.models.models import BillUpdateRequest
from datetime import date, datetime, time

logger = set_logger(__name__)

router = APIRouter(prefix="/payments", tags=["Payments"])


@router.get("/payments")
async def get_all_payments(
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    today: bool = Query(default=False),
    receipt_number: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    current_user=Depends(get_current_user),
    connection=Depends(async_get_db_connection),
):
    try:
        async with connection.cursor() as cursor:
            query = """SELECT p.id, p.bill_id, p.amount, p.receipt_number, p.created_at, bi.item_type, bi.payment_id AS bill_item_payment_id, bi.description, bi.unit_price, bi.quantity, bi.total_price, 
            b.patient_name, b.patient_id, CONCAT_WS(' ', u.first_name, u.last_name) AS cashier_name 
            FROM hayokbps.payments p 
            LEFT JOIN hayokbps.bill b ON b.id = p.bill_id 
            JOIN hayokbps.users u ON u.id = p.cashier_id
            JOIN hayokbps.bill_items bi ON bi.payment_id = p.id
            WHERE 1 = 1 """

            params = []
            if receipt_number:
                query += " AND receipt_number = %s"
                params.append(receipt_number)
            if today:
                start_date_ = datetime.combine(date.today(), time.min)
                end_date_ = datetime.combine(date.today(), time.max)
                query += " AND p.created_at >= %s AND p.created_at <= %s"
                params.extend([start_date_, end_date_])
            elif start_date or end_date:
                if start_date:
                    start_date_ = datetime.combine(start_date, time=time.min)
                    query += " AND p.created_at >= %s"
                    params.append(start_date_)

                if end_date:
                    end_date_ = datetime.combine(end_date, time=time.min)
                    query += " AND p.created_at <= %s"
                    params.append(end_date_)

            query += " ORDER BY p.created_at DESC LIMIT %s OFFSET %s"
            params.extend([limit, offset])
            await cursor.execute(query, tuple(params))
            payments = await cursor.fetchall()

            all_payments = {}
            for row in payments:
                payment_id = row.get("id")

                if payment_id not in all_payments:
                    all_payments[payment_id] = {
                        "id": row.get("id"),
                        "bill_id": row.get("bill_id"),
                        "amount": row.get("amount"),
                        "receipt_number": row.get("receipt_number"),
                        "patient_name": row.get("patient_name"),
                        "cashier_name": row.get("cashier_name"),
                        "bill_items": [],
                        "created_at": row.get("created_at"),
                    }

                if row.get("bill_item_payment_id"):
                    all_payments[payment_id]["bill_items"].append(
                        {
                            "description": row.get("description"),
                            "unit_price": row.get("unit_price"),
                            "quantity": row.get("quantity"),
                            "category": row.get("item_type"),
                        }
                    )
            all_payments = list(all_payments.values())

            total = sum([payment.get("amount", 0) for payment in all_payments])
            return {"payments": all_payments, "total": total}
    except aiomysqlError as e:
        logger.error(f"Database error when fetching payments: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"failed to retrieve payments from database",
        )
    except Exception as e:
        logger.error(f"unexpected error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"unexpected error",
        )


@router.get("/{payment_id}")
async def get_payment(
    payment_id: int,
    connection=Depends(async_get_db_connection),
    current_user=Depends(get_current_user),
):
    async with connection.cursor() as cursor:
        try:
            query = """SELECT p*, b.patient_name, b.id FROM hayokbps.payments p
            JOIN hayokbps.bill b ON b.id = p.bill_id
            WHERE id = %s"""
            await cursor.execute(query, (payment_id,))
            payment = await cursor.fetchone()

            if not payment:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"payment with id {payment_id} not found",
                )

            return payment
        except aiomysqlError as e:
            logger.error(f"Database error when fetching payments: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"failed to retrieve payment from database",
            )
        except Exception as e:
            logger.error(f"unexpected error: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"unexpected error",
            )
