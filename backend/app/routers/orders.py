import decimal

from aiomysql import Error as aiomysqlError
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.models.models import OrderPayload
from db_conn import async_get_db_connection
from utils.security_utils import get_current_user
from utils.utils import set_logger

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
            query = """
                SELECT
                    bv.status AS billing_visit_status,
                    p.patient_name,
                    p.patient_uuid AS patient_id,
                    o.*,
                    i.item_name,
                    i.category
                FROM hayokbps.orders o
                JOIN hayokbps.items i ON o.concept_uuid = i.concept_uuid
                LEFT JOIN hayokbps.billing_patients p ON p.patient_uuid = o.patient_uuid
                LEFT JOIN hayokbps.billing_visits bv ON bv.id = o.billing_visit_id
                ORDER BY o.billing_visit_id DESC
                LIMIT %s OFFSET %s
            """

            await cursor.execute(query, (limit, offset))
            orders = await cursor.fetchall()
            # print(orders)
            if orders is None:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="error when fetching orders from db",
                )

            # Group orders by billing_visit_id
            fetched_orders = {}
            for row in orders:
                billing_visit_id = row.get("billing_visit_id")

                if billing_visit_id not in fetched_orders:
                    fetched_orders[billing_visit_id] = {
                        "id": billing_visit_id,
                        "patient_id": row["patient_uuid"],
                        "status": row["billing_visit_status"],
                        "patient_name": row["patient_name"],
                        "items": [],
                    }

                if row.get("order_uuid"):
                    fetched_orders[billing_visit_id]["items"].append(
                        {
                            "order_id": row["order_uuid"],
                            "item_name": row["item_name"],
                            "concept_id": row["concept_uuid"],
                            "category": row["category"],
                            "quantity": row["quantity"],
                            "status": row["status"],
                            "drug_id": row.get("drug_uuid"),
                            "dose": float(row["dose"])
                            if row["dose"] is not None
                            else None,
                            "dose_units": row.get("dose_units"),
                            "frequency": row.get("frequency"),
                            "route": row.get("route"),
                            "duration": row.get("duration"),
                            "duration_units": row.get("duration_units"),
                        }
                    )

            # Convert dict to list for response
            fetched_orders_list = list(fetched_orders.values())
            return {
                "orders": fetched_orders_list,
                "total_items": len(fetched_orders_list),
            }

    except aiomysqlError as e:
        logger.error(f"Database error when fetching orders: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="failed to retrieve orders from database",
        )
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="unexpected error",
        )


@router.get("/{billing_visit_id}")
async def get_order(
    billing_visit_id: int,
    current_user=Depends(get_current_user),
    connection=Depends(async_get_db_connection),
):
    try:
        async with connection.cursor() as cursor:
            query = """SELECT bv.status AS billing_visit_status, p.patient_name, 
                    p.patient_uuid, o.*, i.id AS item_id, i.item_name, i.category
                    FROM hayokbps.orders o
                    JOIN hayokbps.items i ON o.concept_uuid = i.concept_uuid
                    LEFT JOIN hayokbps.billing_patients p on p.patient_uuid = o.patient_uuid
                    LEFT JOIN hayokbps.billing_visits bv on bv.id = o.billing_visit_id
                    WHERE billing_visit_id = %s
                    """

            await cursor.execute(query, (billing_visit_id,))
            fetched_order = await cursor.fetchall()

            if fetched_order is None:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"error when fetching order with billing_visit {billing_visit_id} from db",
                )

            order = {}
            for row in fetched_order:
                order[billing_visit_id] = {
                    "id": billing_visit_id,
                    "patient_uuid": row["patient_uuid"],
                    "status": row["billing_visit_status"],
                    "patient_name": row["patient_name"],
                    "items": [],
                }

                # if row.get("order_id"):
                order[billing_visit_id]["items"].append(
                    {
                        "order_id": row["order_uuid"],
                        "item_name": row["item_name"],
                        "concept_uuid": row["concept_uuid"],
                        "category": row["category"],
                        "quantity": row["quantity"],
                        "status": row["status"],
                        "drug_uuid": row["drug_uuid"],
                        "item_id": row["item_id"],
                        "frequency": row["frequency"],
                        "route": row["route"],
                        "duration": row["duration"],
                        "dose": row["dose"],
                    }
                )
            order = list(order.values())[0]
            return order

    except aiomysqlError as e:
        logger.error(f"Database error when fetching orders: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="failed to retrieve orders from database",
        )
    except Exception as e:
        logger.error(f"unexpected error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="unexpected error",
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

            # select patient_id first
            await cursor.execute(
                "SELECT * FROM hayokbps.billing_patients WHERE patient_uuid = %s",
                (bill_payload.get("patient_uuid"),),
            )

            patient = await cursor.fetchone()

            if patient is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND, detail="patient not found!"
                )

            patient_id = patient["id"]
            generate_bill_query = """INSERT INTO hayokbps.bill (payer_id, patient_id, billing_visit_id)
                    VALUES (%s, %s, %s)"""

            await cursor.execute(
                generate_bill_query,
                (payer_id, patient_id, billing_visit_id),
            )

            bill_id = cursor.lastrowid

            if not bill_id:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to create bill record",
                )

            get_payer_price_query = """
                SELECT COALESCE(ip.price, i.base_price) as price
                FROM hayokbps.items i
                LEFT JOIN hayokbps.item_prices ip
                    ON ip.item_id = i.id
                    AND ip.payer_id = %s
                WHERE i.id = %s"""

            for item in bill_items:
                item_name = item.get("item_name")
                category = item.get("category")
                order_uuid = item.get("order_id")
                item_uuid = item.get("drug_uuid") or item.get("concept_uuid")
                item_id = item.get("item_id")
                quantity = item.get("quantity", 1)

                await cursor.execute(
                    get_payer_price_query,
                    (payer_id, item_id),
                )
                price_info = await cursor.fetchone()

                if not price_info:
                    missing_prices.append(
                        item.get("item_name", f"Concept ID: {item_uuid}")
                    )
                    continue

                price = price_info.get("price")
                if price is None or price <= 0:
                    missing_prices.append(f"{item_name} (price is {price})")
                    continue

                price = decimal.Decimal(str(price_info["price"]))
                line_total = decimal.Decimal(str(quantity)) * price

                bill_items_batch.append(
                    (
                        bill_id,
                        order_uuid,
                        item_name,
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
                (bill_id, order_uuid, description, item_type, quantity, unit_price, total_price)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
            """

            await cursor.executemany(bill_items_query, bill_items_batch)

            update_bill_query = """
                UPDATE hayokbps.bill SET total_amount = %s,
                updated_at = NOW()
                WHERE id = %s"""

            await cursor.execute(update_bill_query, (total_amount, bill_id))

            update_billing_visit_query = """
                UPDATE hayokbps.billing_visits
                SET status = %s, updated_at = NOW()
                WHERE id = %s
            """
            await cursor.execute(
                update_billing_visit_query, ("billed", billing_visit_id)
            )

            parsed_order_ids = [item["order_id"] for item in bill_items]
            order_status = "billed"

            if parsed_order_ids:
                placeholders = ", ".join(["%s"] * len(parsed_order_ids))

                # print(parsed_order_ids)
                update_order_status_query = f"""
                    UPDATE hayokbps.orders
                    SET status = %s,
                        updated_at = NOW()
                    WHERE order_uuid IN ({placeholders})"""

                await cursor.execute(
                    update_order_status_query, tuple([order_status] + parsed_order_ids)
                )
                # Step 10: Commit transaction
                await connection.commit()

                return {
                    "message": "Bill generated successfully",
                    "bill_id": bill_id,
                    "total_amount": float(total_amount),
                    "items_count": len(bill_items_batch),
                }
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No order ids were parsed/selected",
            )

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
