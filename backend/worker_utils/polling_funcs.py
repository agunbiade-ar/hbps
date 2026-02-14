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


def poll_orders(source_db, target_db, sleep_interval=3):
    """
    Polls OpenMRS orders and inserts them into our billing system.
    Groups orders by visit using billing_visits table.
    """
    source_cursor = source_db.cursor(dictionary=True, buffered=True)
    target_cursor = target_db.cursor(dictionary=True, buffered=True)

    try:
        last_processed_id = get_last_processed_order_id(target_db)
        # Fetch new orders
        query = """
        SELECT
            pn.given_name,
            pn.middle_name,
            pn.family_name,
            o.order_id,
            o.encounter_id,
            o.patient_id,
            o.concept_id,
            cn.name AS concept_name,
            do.quantity,
            ot.name AS order_type,
            v.visit_id
        FROM orders o
        JOIN order_type ot ON ot.order_type_id = o.order_type_id AND ot.retired = 0
        JOIN person_name pn ON o.patient_id = pn.person_id AND pn.voided = 0
        JOIN concept_name cn ON o.concept_id = cn.concept_id AND cn.voided = 0
        JOIN encounter e ON o.encounter_id = e.encounter_id
        JOIN visit v ON e.visit_id = v.visit_id
        LEFT JOIN drug_order do ON o.order_id = do.order_id
        WHERE o.order_id > %s
            AND o.voided = 0
            AND cn.locale = 'en'
            AND cn.concept_name_type = 'FULLY_SPECIFIED'
        ORDER BY o.order_id ASC
        """
        source_cursor.execute(query, (last_processed_id,))

        while True:
            rows = source_cursor.fetchmany(100)
            if not rows:
                break

            # Map visit_id → patient_id
            visit_to_patient = {row["visit_id"]: row["patient_id"] for row in rows}

            # Fetch existing billing_visits
            existing_visits = fetch_existing_billing_visits(
                list(visit_to_patient.keys()), target_cursor
            )
            existing_visits_map = {v["visit_id"]: v["id"] for v in existing_visits}

            # Create missing billing_visits
            for visit_id, patient_id in visit_to_patient.items():
                if visit_id not in existing_visits_map:
                    insert_visit = """
                        INSERT INTO hayokbps.billing_visits (visit_id, patient_id)
                        VALUES (%s, %s, %s)
                    """
                    target_cursor.execute(
                        insert_visit, (visit_id, patient_id)
                    )  # , row.get("encounter_id"))

                    existing_visits_map[visit_id] = target_cursor.lastrowid

            # Prepare orders batch
            batch = []
            for row in rows:
                batch.append(
                    (
                        existing_visits_map[row["visit_id"]],
                        row["order_id"],
                        row["patient_id"],
                        row["concept_id"],
                        row.get("quantity") or 1,
                    )
                )

            # Insert orders
            insert_order_query = """
                INSERT INTO hayokbps.orders (billing_visit_id, order_id, patient_id, concept_id, quantity)
                VALUES (%s, %s, %s, %s, %s)
            """
            target_cursor.executemany(insert_order_query, batch)
            last_processed_id = rows[-1]["order_id"]
            update_last_processed_order_id(target_db, last_processed_id)
            target_db.commit()
            print(f"Last processed order id: {last_processed_id}")
    except Exception as e:
        target_db.rollback()
        print(f"Error in poll_orders loop: {e}")
    finally:
        time.sleep(sleep_interval * 60)


def poll_for_patients(source_db, target_db, sleep_interval=5):
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
    finally:
        time.sleep(sleep_interval * 60)


def poll_old_patients_for_voided(polling_interval=60):
    """check if patient was deleted in openmrs and then if so, remove from our billing patient db"""
    pass


def poll_old_patients_for_updates(polling_interval=60):
    """check patient payer type, if insurance or normal, and update our billing patient accordingly"""
    pass


def poll_old_orders_for_voided(polling_interval=15):
    """check old orders, if they have been cancelled, then delete from our orders table"""
    pass
