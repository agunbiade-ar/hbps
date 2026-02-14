from fastapi import APIRouter, Depends, Query, HTTPException, status
from db_conn import async_get_db_connection
from utils.security_utils import get_current_user
from aiomysql import Error as aiomysqlError
from utils.utils import set_logger
from app.models.models import OrderPayload
import decimal

logger = set_logger(__name__)

router = APIRouter(prefix="/orders", tags=["orders"])


@router.get("/orders")
async def get_orders(
    limit: int = Query(default=100, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    current_user=Depends(get_current_user),
    connection=Depends(async_get_db_connection),
):
    try:
        async with connection.cursor() as cursor:
            query = """SELECT bv.status, p.patient_name, p.patient_id AS patient_id, o.*, i.concept_name, i.category FROM hayokbps.ORDERS o
            join hayokbps.items i ON o.concept_id = i.concept_id
            left join hayokbps.billing_patients p on p.patient_id = o.patient_id
            left join hayokbps.billing_visits bv on bv.id = o.billing_visit_id
            ORDER BY o.billing_visit_id DESC LIMIT %s OFFSET %s"""

            await cursor.execute(query, (limit, offset))
            orders = await cursor.fetchall()

            fetched_orders = {}
            for row in orders:
                billing_visit_id = row.get("billing_visit_id")

                if billing_visit_id not in fetched_orders:
                    fetched_orders[billing_visit_id] = {
                        "id": billing_visit_id,
                        "patient_id": row["patient_id"],
                        "status": row["status"],
                        "patient_name": row["patient_name"],
                        "items": [],
                    }

                if row.get("order_id"):
                    fetched_orders[billing_visit_id]["items"].append(
                        {
                            "order_id": row["order_id"],
                            "concept_name": row["concept_name"],
                            "concept_id": row["concept_id"],
                            "category": row["category"],
                            "quantity": row["quantity"],
                        }
                    )

            order_length = len(fetched_orders)
            fetched_orders = list(fetched_orders.values())
            return {"orders": fetched_orders, "total_items": order_length}
    except aiomysqlError as e:
        logger.error(f"Database error when fetching orders: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"failed to retrieve orders from database",
        )
    except Exception as e:
        logger.error(f"unexpected error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"unexpected error",
        )


@router.patch("/{billing_visit_id}")
async def update_order(
    billing_visit_id: int,
    payload: OrderPayload,
    connection=Depends(async_get_db_connection),
    current_user=Depends(get_current_user),
):
    bill_id = None
    total_amount = decimal.Decimal("0.00")
    bill_items_batch = []
    missing_prices = []
    try:
        async with connection.cursor() as cursor:
            check_query = (
                """SELECT id, status FROM hayokbps.billing_visits WHERE id = %s"""
            )
            await cursor.execute(check_query, (billing_visit_id,))

            existing_order = await cursor.fetchone()

            if not existing_order:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Order ID {billing_visit_id} not found",
                )

            if existing_order["status"] == "billed":
                check_bill_query = """SELECT id, status FROM hayokbps.bill WHERE billing_visit_id = %s
                ORDER BY created_at DESC LIMIT 1"""

                await cursor.execute(check_bill_query, billing_visit_id)
                existing_bill = await cursor.fetchone()

                if existing_bill and existing_bill["status"] in [
                    "paid",
                    "cancelled",
                    "partially_paid",
                ]:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Order ID {billing_visit_id} has already been billed already, generate another order for the patient",
                    )

            bill_payload = payload.model_dump()
            bill_items = bill_payload.get("items", [])

            if not bill_items:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cannot generate bill without items",
                )

            payer_id = bill_payload.get("payer_id")
            if not payer_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Payer type is required",
                )

            generate_bill_query = """INSERT INTO hayokbps.bill (payer_id, patient_id, billing_visit_id)
                    VALUES (%s, %s, %s)"""

            await cursor.execute(
                generate_bill_query,
                (payer_id, bill_payload.get("patient_id"), billing_visit_id),
            )

            bill_id = cursor.lastrowid

            if not bill_id:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to create bill record",
                )

            get_payer_price_query = """
                SELECT 
                    p.item_id, 
                    items.concept_name, 
                    p.payer_id, 
                    p.price 
                FROM hayokbps.payer_type pt
                JOIN hayokbps.item_prices p ON p.payer_id = pt.id
                LEFT JOIN hayokbps.items items ON items.id = p.item_id
                WHERE pt.id = %s AND p.item_id = %s
            """

            for item in bill_items:
                concept_id = item.get("concept_id")
                concept_name = item.get("concept_name")
                category = item.get("category")
                order_id = item.get("order_id")
                quantity = item.get("quantity", 1)

                await cursor.execute(
                    get_payer_price_query,
                    (payer_id, concept_id),
                )
                price_info = await cursor.fetchone()

                if not price_info:
                    missing_prices.append(
                        item.get("concept_name", f"Concept ID: {concept_id}")
                    )
                    continue

                price = price_info.get("price")
                if price is None or price <= 0:
                    missing_prices.append(f"{concept_name} (price is {price})")
                    continue

                price = decimal.Decimal(str(price_info["price"]))
                line_total = decimal.Decimal(str(quantity)) * price

                bill_items_batch.append(
                    (
                        bill_id,
                        order_id,
                        concept_name,
                        category,
                        quantity,
                        price,
                        line_total,
                    )
                )

                total_amount += line_total

            if missing_prices:
                await connection.rollback()
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Missing prices for items: {', '.join(missing_prices)}",
                )

            if not bill_items_batch:
                await connection.rollback()
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="No valid items with prices found",
                )

            bill_items_query = """
                INSERT INTO hayokbps.bill_items 
                (bill_id, order_id, description, item_type, quantity, unit_price, total_price)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
            """

            await cursor.executemany(bill_items_query, bill_items_batch)

            update_bill_query = """
                UPDATE hayokbps.bill SET total_amount = %s,
                updated_at = NOW()
                WHERE id = %s"""

            await cursor.execute(update_bill_query, (total_amount, bill_id))

            update_order_query = """
                UPDATE hayokbps.billing_visits 
                SET status = %s, updated_at = NOW() 
                WHERE id = %s
            """
            await cursor.execute(update_order_query, ("billed", billing_visit_id))

            # Step 10: Commit transaction
            await connection.commit()

            logger.info(
                f"Bill {bill_id} generated successfully for order {billing_visit_id} "
                f"with {len(bill_items_batch)} items, total: {total_amount}"
            )

        return {
            "message": "Bill generated successfully",
            "bill_id": bill_id,
            "total_amount": float(total_amount),
            "items_count": len(bill_items_batch),
        }
    except aiomysqlError as e:
        logger.error(
            f"Database error when generating bill for order {billing_visit_id}: {e}"
        )
        await connection.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate bill due to database error",
        )
    except Exception as e:
        logger.error(
            f"Unexpected error when generating bill for order {billing_visit_id}: {e}"
        )
        await connection.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while generating the bill",
        )


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
            return {"payer_types": payer_types, "total_items": len(payer_types)}
    except aiomysqlError as e:
        logger.error(f"Database error when fetching payer types: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"failed to retrieve payer types from database",
        )
    except Exception as e:
        logger.error(f"unexpected error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"unexpected error",
        )
