from .last_processed import (
    get_last_processed_concept_id,
    update_last_processed_concept_id,
)


def get_concepts_from_openmrsDB(source_db, target_db):
    cursor = source_db.cursor(dictionary=True, buffered=True)
    last_processed_id = get_last_processed_concept_id(target_db)

    query = """
    SELECT c.concept_id, cn.name, cc.name AS class_name
    FROM concept c
    JOIN concept_name cn ON c.concept_id = cn.concept_id
    JOIN concept_class cc ON c.class_id = cc.concept_class_id
    WHERE cn.locale = 'en'
    AND cn.concept_name_type = 'FULLY_SPECIFIED'
    AND cc.name IN ('Test', 'Procedure', 'Drug')
    AND cn.voided = 0
    AND c.retired = 0
    AND c.concept_id > %s
    ORDER BY c.concept_id ASC"""

    cursor.execute(query, (last_processed_id,))
    concepts = []
    while True:
        rows = cursor.fetchmany(100)
        if not rows:
            break
        concepts.extend(rows)

    cursor.close()
    return concepts


def generate_default_item_prices(item_concept_ids, target_cursor):
    """
    Creates default price = 0 for each item.
    Assumes facility_id=1 and payer_id=1 as default.
    """

    if not item_concept_ids:
        return

    # Step 1: Fetch item IDs from items table
    format_strings = ",".join(["%s"] * len(item_concept_ids))
    select_query = f"""
        SELECT id FROM hayokbps.items
        WHERE concept_id IN ({format_strings})
    """

    target_cursor.execute(select_query, tuple(item_concept_ids))
    items = target_cursor.fetchall()

    if not items:
        return

    # Step 2: Prepare default price rows
    price_data = [
        (item["id"], 1, 1, 0.00)  # item_id, facility_id, payer_id, price
        for item in items
    ]

    insert_price_query = """
        INSERT INTO hayokbps.item_prices
        (item_id, facility_id, payer_id, price)
        VALUES (%s, %s, %s, %s)
        ON DUPLICATE KEY UPDATE price = price
    """

    target_cursor.executemany(insert_price_query, price_data)


def transport_concepts_from_openmrsDB(source_db, target_db):
    concepts = get_concepts_from_openmrsDB(source_db=source_db, target_db=target_db)

    cursor = target_db.cursor(dictionary=True, buffered=True)
    insert_query = """
    INSERT INTO hayokbps.items (concept_id, concept_name, category) VALUES (%s, %s, %s) ON DUPLICATE KEY UPDATE
    concept_name = VALUES(concept_name),
    category = VALUES(category);
    """
    # Prepare a list of tuples from your dictionary rows

    CLASS_MAP = {
        "drug": "drug",
        "drug order": "drug",
        "test": "lab",
        "test order": "lab",
        "lab test": "lab",
    }

    data = []
    for concept in concepts:
        parts = concept["class_name"].split()
        first_word = parts[0].lower() if parts else ""
        normalized_class = CLASS_MAP.get(first_word, concept["class_name"])
        data.append((concept["concept_id"], concept["name"], normalized_class))

    try:
        # Batch insert
        cursor.executemany(insert_query, data)

        default_price_query = """
            INSERT INTO hayokbps.item_prices (item_id, facility_id, payer_id, price)
            SELECT 
                i.id,
                1,
                1,
                0.00
            FROM hayokbps.items i
            LEFT JOIN hayokbps.item_prices ip
                ON ip.item_id = i.id
                AND ip.facility_id = 1
                AND ip.payer_id = 1
            WHERE ip.id IS NULL;
            """

        cursor.execute(default_price_query)

        if data:
            last_processed_id = data[-1][0]
            update_last_processed_concept_id(
                target_db=target_db, last_id=last_processed_id
            )

        target_db.commit()
    except Exception as e:
        target_db.rollback()
        print(e)
    finally:
        cursor.close()
