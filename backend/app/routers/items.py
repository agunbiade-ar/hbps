from aiomysql import Error as aiomysqlError
from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List
from app.models.models import PriceEdit
from db_conn import async_get_db_connection
from utils.security_utils import get_current_user
from utils.utils import set_logger

logger = set_logger(__name__)

router = APIRouter(prefix="/items", tags=["items"])


@router.get("/items")
async def get_items(
    item_id: int = Query(default=None),
    search: str = Query(default=""),
    limit: int = Query(default=200, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    current_user=Depends(get_current_user),
    connection=Depends(async_get_db_connection),
):
    try:
        async with connection.cursor() as cursor:
            if item_id is None:
                search_term = f"%{search}%"

                # Step 1: Get base items with pagination
                items_query = """
                    SELECT id, concept_uuid, drug_uuid, item_name, category, base_price
                    FROM hayokbps.items
                    WHERE item_name LIKE %s COLLATE utf8mb4_general_ci
                    ORDER BY id DESC
                    LIMIT %s OFFSET %s
                """
                await cursor.execute(items_query, (search_term, limit, offset))
                items = await cursor.fetchall()

                # Get ALL payer prices for these items
                if items:
                    item_ids = [item["id"] for item in items]
                    placeholders = ",".join(["%s"] * len(item_ids))

                    prices_query = f"""
                        SELECT ip.item_id, ip.payer_id, ip.price, pt.payer_code, pt.payer_name
                        FROM hayokbps.item_prices ip
                        JOIN hayokbps.payer_type pt ON pt.id = ip.payer_id
                        WHERE ip.item_id IN ({placeholders})
                    """
                    await cursor.execute(prices_query, item_ids)
                    prices = await cursor.fetchall()

                    # Group prices by item_id
                    prices_by_item = {}
                    for price in prices:
                        item_id = price["item_id"]
                        if item_id not in prices_by_item:
                            prices_by_item[item_id] = []
                        prices_by_item[item_id].append(
                            {
                                "payer_id": price["payer_id"],
                                "payer_code": price["payer_code"],
                                "payer_name": price["payer_name"],
                                "price": float(price["price"]),
                            }
                        )

                    # Attach payer_prices to each item
                    for item in items:
                        item["payer_prices"] = prices_by_item.get(item["id"], [])
                        item["base_price"] = float(item["base_price"])

                count_query = "SELECT COUNT(*) as total FROM hayokbps.items WHERE item_name LIKE %s"
                await cursor.execute(count_query, (search_term,))
                total_dict = await cursor.fetchone()
                total = total_dict["total"] if total_dict else 0

                return {"billable_items": items, "total_items": total}

            else:
                item_query = """
                    SELECT id, concept_uuid, drug_uuid, item_name, category, base_price
                    FROM hayokbps.items
                    WHERE id = %s
                """
                await cursor.execute(item_query, (item_id,))
                item = await cursor.fetchone()

                if not item:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail=f"Item with id {item_id} not found",
                    )

                # Get payer prices for this item
                prices_query = """
                    SELECT ip.payer_id, ip.price, pt.payer_code, pt.payer_name
                    FROM hayokbps.item_prices ip
                    JOIN hayokbps.payer_type pt ON pt.id = ip.payer_id
                    WHERE ip.item_id = %s
                """
                await cursor.execute(prices_query, (item_id,))
                prices = await cursor.fetchall()

                item["payer_prices"] = [
                    {
                        "payer_id": p["payer_id"],
                        "payer_code": p["payer_code"],
                        "payer_name": p["payer_name"],
                        "price": float(p["price"]),
                    }
                    for p in prices
                ]
                item["base_price"] = float(item["base_price"])

                return {"billable_item": item}

    except aiomysqlError as e:
        logger.error(f"Database error when fetching items: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve items from database",
        )
    except Exception as e:
        logger.error(f"Unexpected error when retrieving items: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unexpected error when retrieving items",
        )


@router.patch("/items-price")
async def set_item_price(
    items: List[PriceEdit],
    current_user=Depends(get_current_user),
    connection=Depends(async_get_db_connection),
):
    try:
        async with connection.cursor() as cursor:
            await cursor.execute(
                "SELECT id FROM payer_type WHERE LOWER(payer_code) = 'self'"
            )

            self_payer_type = await cursor.fetchone()

            if not self_payer_type:
                raise HTTPException(500, "Self payer not configured")

            self_payer_id = self_payer_type["id"]

            if items:
                insurance_override_prices = [
                    item for item in items if item.payer_id != self_payer_id
                ]

                base_price_items = [
                    item for item in items if item.payer_id == self_payer_id
                ]

                await connection.begin()

                if base_price_items:
                    for item in base_price_items:
                        update_base_price_query = """
                            UPDATE hayokbps.items
                            SET base_price = %s
                            WHERE id = %s"""
                        await cursor.execute(
                            update_base_price_query,
                            (
                                item.price,
                                item.item_id,
                            ),
                        )

                if insurance_override_prices:
                    # case_clauses = []
                    values = []

                    for item in insurance_override_prices:
                        # case_clauses.append(
                        #     "WHEN payer_id = %s AND item_id = %s THEN %s"
                        # )
                        # values.extend([item.payer_id, item.item_id, item.price])

                        query = f"""
                            INSERT INTO item_prices (item_id, payer_id, price)
                            VALUES {", ".join(["(%s, %s, %s)"] * len(insurance_override_prices))}
                            ON DUPLICATE KEY UPDATE price = VALUES(price)
                            """
                        await cursor.execute(
                            query, (item.item_id, item.payer_id, item.price)
                        )
                    # conditions = " OR ".join(
                    #     ["(payer_id = %s AND item_id = %s)"]
                    #     * len(insurance_override_prices)
                    # )

                    # query = f"""
                    # UPDATE item_prices
                    # SET price = CASE
                    #     {" ".join(case_clauses)}
                    #     ELSE price
                    # END
                    # WHERE {conditions}
                    # """

                    # for item in insurance_override_prices:
                    #     values.extend([item.payer_id, item.item_id])

                    print(query, values)

                await connection.commit()
                return {"message": f"Prices updated successfully for {len(items)}"}

            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="No prices were selected for update",
                )

    except aiomysqlError as e:
        logger.error(f"Database error when updating item prices: {e}")
        await connection.rollback()

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update item prices",
        )
    except Exception as e:
        logger.error(f"Unexpected error when updating item prices: {e}")
        await connection.rollback()

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unexpected error when updating item prices",
        )
