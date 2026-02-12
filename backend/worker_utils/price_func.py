import decimal


def get_price(concept_id, target_db_cursor):
    """Look up price for an OpenMRS concept"""

    print(concept_id)

    target_db_cursor.execute(
        "SELECT price FROM hayokbps.price_list WHERE concept_id = %s", (concept_id,)
    )

    price_record = target_db_cursor.fetchone()

    if price_record:
        return decimal.Decimal(price_record["price"])
    else:
        # Price not found
        print(f"No price found for concept_id: {concept_id}")
        return decimal.Decimal("0.00")
