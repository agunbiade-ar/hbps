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
        last_processed_id = data[len(data) - 1][0]
        update_last_processed_concept_id(target_db=target_db, last_id=last_processed_id)
        target_db.commit()
    except Exception as e:
        target_db.rollback()
        print(e)
    finally:
        cursor.close()
