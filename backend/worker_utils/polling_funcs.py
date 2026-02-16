import time
from dotenv import load_dotenv

from .last_processed import (
    get_last_processed_order_id,
    get_last_processed_patient_id,
    update_last_processed_order_id,
    update_last_processed_patient_id,
)

load_dotenv()


def fetch_existing_billing_visits(visit_ids, cursor):
    """
    Returns list of existing billing_visits matching given visit_ids.
    """
    if not visit_ids:
        return []

    # Build query with correct placeholders
    placeholders = ",".join(["%s"] * len(visit_ids))
    query = f"""
        SELECT * FROM hayokbps.billing_visits
        WHERE visit_id IN ({placeholders})
    """
    cursor.execute(query, tuple(visit_ids))

    results = []
    while True:
        rows = cursor.fetchmany(100)
        if not rows:
            break
        results.extend(rows)
    return results


def poll_orders(source_db, target_db):
    """
    Polls OpenMRS orders and inserts them into our billing system.
    Groups orders by visit using billing_visits table.
    This version prevents assigning orders to the wrong patient.
    """
    source_cursor = source_db.cursor(dictionary=True, buffered=True)
    target_cursor = target_db.cursor(dictionary=True, buffered=True)

    last_processed_id = get_last_processed_order_id(target_db)

    try:
        query = """
            SELECT
                o.order_id,
                o.encounter_id,
                o.patient_id,
                o.concept_id,
                (SELECT cn.name FROM concept_name cn 
                    WHERE cn.concept_id = o.concept_id 
                    AND cn.locale = 'en'
                    AND cn.concept_name_type = 'FULLY_SPECIFIED'
                    AND cn.voided = 0
                    LIMIT 1) AS concept_name,
                ot.name AS order_type,
                e.visit_id,
                o.order_action,  -- Add this to see the action
                COALESCE(
                    (SELECT MIN(quantity) FROM drug_order WHERE order_id = o.order_id LIMIT 1),
                    1
                ) AS quantity
            FROM orders o
            JOIN order_type ot ON ot.order_type_id = o.order_type_id AND ot.retired = 0
            JOIN encounter e ON e.encounter_id = o.encounter_id
            WHERE o.order_id > %s
                AND o.voided = 0
                AND o.order_action = 'NEW'  -- Only NEW orders, not DISCONTINUE orders
            ORDER BY o.order_id ASC
        """
        source_cursor.execute(query, (last_processed_id,))

        total_processed = 0
        while True:
            rows = source_cursor.fetchmany(100)
            if not rows:
                break

            order_ids = [row["order_id"] for row in rows]
            if len(order_ids) != len(set(order_ids)):
                print("WARNING: Duplicate order_ids detected in batch!")
                for oid in set(order_ids):
                    count = order_ids.count(oid)
                    if count > 1:
                        print(f"  order_id {oid} appears {count} times")
                        break

            # Get all visit_ids from current batch
            visit_ids = list(
                set(row["visit_id"] for row in rows if row["visit_id"] is not None)
            )

            # Fetch existing billing_visits
            existing_visits = fetch_existing_billing_visits(visit_ids, target_cursor)
            existing_visits_map = {v["visit_id"]: v["id"] for v in existing_visits}

            # Insert missing visits
            for visit_id in visit_ids:
                if visit_id not in existing_visits_map:
                    # Pick the patient_id from any row that has this visit_id
                    patient_id = next(
                        row["patient_id"] for row in rows if row["visit_id"] == visit_id
                    )
                    insert_visit_query = """
                        INSERT INTO hayokbps.billing_visits (visit_id, patient_id)
                        VALUES (%s, %s)
                    """
                    target_cursor.execute(insert_visit_query, (visit_id, patient_id))
                    existing_visits_map[visit_id] = target_cursor.lastrowid

            # Prepare orders batch: each row keeps its patient_id
            batch = [
                (
                    existing_visits_map.get(row["visit_id"]),  # billing_visit_id
                    row["order_id"],
                    row["patient_id"],
                    row["concept_id"],
                    row.get("quantity") or 1,
                )
                for row in rows
            ]

            # Insert orders with duplicate protection
            insert_order_query = """
                INSERT IGNORE INTO hayokbps.orders 
                (billing_visit_id, order_id, patient_id, concept_id, quantity)
                VALUES (%s, %s, %s, %s, %s)
            """
            target_cursor.executemany(insert_order_query, batch)

            last_processed_id = rows[-1]["order_id"]
            total_processed += len(batch)

        # Commit once after all batches
        if total_processed > 0:
            update_last_processed_order_id(target_db, last_processed_id)
            target_db.commit()
            print(f"Processed {total_processed} orders. Last ID: {last_processed_id}")
        else:
            print("No new orders to process")

    except Exception as e:
        target_db.rollback()
        print(f"Error in poll_orders: {e}")
        raise


def poll_for_patients(source_db, target_db):
    fetch_patients_query = """
                            SELECT
                            p.patient_id,
                            pn.given_name,
                            pn.middle_name,
                            pn.family_name
                        FROM patient p
                        JOIN person_name pn ON p.patient_id = pn.person_id
                        WHERE pn.voided = 0
                        AND p.patient_id > %s
                        ORDER BY p.patient_id ASC"""

    source_cursor = source_db.cursor(dictionary=True, buffered=True)
    last_processed_id = get_last_processed_patient_id(target_db=target_db)
    source_cursor.execute(fetch_patients_query, (last_processed_id,))  # type: ignore
    rows = source_cursor.fetchall()

    target_cursor = target_db.cursor(dictionary=True, buffered=True)

    try:
        if rows:
            batch = []
            for patient in rows:
                patient_id = patient.get("patient_id")  # type: ignore
                first_name = patient.get("given_name")  # type: ignore
                last_name = patient.get("family_name")  # type: ignore
                middle_name = patient.get("middle_name", None)  # type: ignore

                patient_name = f"{first_name} {middle_name or ''} {last_name}".strip()

                batch.append((patient_id, patient_name))
                last_processed_id = patient_id

            query = """INSERT INTO hayokbps.billing_patients (patient_id, patient_name) VALUES (%s, %s)
                    ON DUPLICATE KEY UPDATE patient_name = VALUES(patient_name)"""
            target_cursor.executemany(query, batch)

            target_db.commit()
            update_last_processed_patient_id(
                target_db=target_db, current_id=last_processed_id
            )
    except Exception as e:
        target_db.rollback()
        print("patients batch insertion failed: ", e)
