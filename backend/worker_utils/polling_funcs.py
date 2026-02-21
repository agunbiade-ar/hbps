from dotenv import load_dotenv

from .concepts import (
    # get_openmrs_drug_concepts,
    ensure_visit_exists,
    # insert_dose_specific_item,
    insert_new_orders,
    cancel_discontinued_orders,
    fetch_openmrs_drug_concepts,
    upsert_drug_concepts_catalog,
)
from .last_processed import (
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


def poll_for_patients(source_db, target_db):
    fetch_patients_query = """
        SELECT
            p.patient_id,
            per.uuid AS patient_uuid,
            pn.given_name,
            pn.middle_name,
            pn.family_name
        FROM patient p
        JOIN person per ON per.person_id = p.patient_id
        JOIN person_name pn ON pn.person_id = p.patient_id
        WHERE pn.voided = 0
        AND pn.preferred = 1
        AND p.patient_id > %s
        ORDER BY p.patient_id ASC
        """

    source_cursor = source_db.cursor(dictionary=True, buffered=True)
    last_processed_id = get_last_processed_patient_id(target_db=target_db)
    source_cursor.execute(fetch_patients_query, (last_processed_id,))  # type: ignore
    rows = source_cursor.fetchall()

    target_cursor = target_db.cursor(dictionary=True, buffered=True)

    try:
        if rows:
            batch = []
            for patient in rows:
                patient_uuid = patient.get("patient_uuid")  # type: ignore
                first_name = patient.get("given_name")  # type: ignore
                last_name = patient.get("family_name")  # type: ignore
                middle_name = patient.get("middle_name", None)  # type: ignore

                patient_name = f"{first_name} {middle_name or ''} {last_name}".strip()

                batch.append((patient_uuid, patient_name))
                last_processed_id = patient.get("patient_id")

            query = """INSERT INTO hayokbps.billing_patients (patient_uuid, patient_name) VALUES (%s, %s)
                    ON DUPLICATE KEY UPDATE patient_name = VALUES(patient_name)"""
            target_cursor.executemany(query, batch)

            target_db.commit()
            update_last_processed_patient_id(
                target_db=target_db, current_id=last_processed_id
            )
    except Exception as e:
        target_db.rollback()
        print("patients batch insertion failed: ", e)


def poll_orders(source_db, target_db, last_processed_id):
    source_cursor = source_db.cursor(dictionary=True, buffered=True)
    target_cursor = target_db.cursor(dictionary=True, buffered=True)

    try:
        query = """
            SELECT
                o.uuid AS order_uuid,
                o.order_id,
                o.encounter_id,
                o.patient_id,
                p.uuid AS patient_uuid,
                pn.given_name,
                pn.family_name,
                c.uuid AS concept_uuid,
                d.uuid AS drug_uuid,
                d.name AS drug_name,                        -- human-readable drug name
                do.dose,
                dose_units_cn.name AS dose_units,           -- e.g. "mg", "ml"
                freq_cn.name AS frequency,                  -- e.g. "Once daily"
                route_cn.name AS route,                     -- e.g. "Oral"
                do.duration,
                duration_units_cn.name AS duration_units,   -- e.g. "Days"
                do.quantity,
                o.order_action,
                v.visit_id
            FROM orders o
            LEFT JOIN concept c ON c.concept_id = o.concept_id
            LEFT JOIN drug_order do ON do.order_id = o.order_id
            LEFT JOIN drug d ON d.drug_id = do.drug_inventory_id

            -- Decode dose_units
            LEFT JOIN concept_name dose_units_cn 
                ON dose_units_cn.concept_id = do.dose_units
                AND dose_units_cn.locale = 'en'
                AND dose_units_cn.concept_name_type = 'FULLY_SPECIFIED'
                AND dose_units_cn.voided = 0

            -- Decode route
            LEFT JOIN concept_name route_cn 
                ON route_cn.concept_id = do.route
                AND route_cn.locale = 'en'
                AND route_cn.concept_name_type = 'FULLY_SPECIFIED'
                AND route_cn.voided = 0

            -- Decode duration_units
            LEFT JOIN concept_name duration_units_cn 
                ON duration_units_cn.concept_id = do.duration_units
                AND duration_units_cn.locale = 'en'
                AND duration_units_cn.concept_name_type = 'FULLY_SPECIFIED'
                AND duration_units_cn.voided = 0

            -- Decode frequency via order_frequency
            LEFT JOIN order_frequency of ON of.order_frequency_id = do.frequency
            LEFT JOIN concept_name freq_cn 
                ON freq_cn.concept_id = of.concept_id
                AND freq_cn.locale = 'en'
                AND freq_cn.concept_name_type = 'FULLY_SPECIFIED'
                AND freq_cn.voided = 0

            JOIN encounter e ON e.encounter_id = o.encounter_id
            JOIN visit v ON v.visit_id = e.visit_id
            JOIN person p ON p.person_id = o.patient_id
            LEFT JOIN person_name pn 
                ON pn.person_id = p.person_id
                AND pn.voided = 0
                AND pn.preferred = 1
            WHERE o.order_id > %s
            AND o.voided = 0
            AND o.order_action IN ('NEW', 'DISCONTINUE')
            ORDER BY o.order_id ASC
        """

        source_cursor.execute(query, (last_processed_id,))
        total_processed = 0

        while True:
            rows = source_cursor.fetchmany(100)
            if not rows:
                break

            # Prepare visit map
            visit_ids = list(
                set(row["visit_id"] for row in rows if row["visit_id"] is not None)
            )

            existing_visits = {}
            for visit_id in visit_ids:
                patient_uuid = next(
                    row["patient_uuid"] for row in rows if row["visit_id"] == visit_id
                )

                existing_visits[visit_id] = ensure_visit_exists(
                    target_cursor, visit_id, patient_uuid
                )

            insert_new_orders(target_db, rows, existing_visits)

            cancel_discontinued_orders(target_db, rows)

            last_processed_id = rows[-1]["order_id"]
            update_last_processed_order_id(target_db, last_processed_id)

            total_processed += len(rows)

        print(f"Processed {total_processed} orders")
        return last_processed_id

    except Exception as e:
        target_db.rollback()
        print("Error in poll_orders:", e)
        raise


async def poll_drugs(target_db):
    drug_list = await fetch_openmrs_drug_concepts()
    upsert_drug_concepts_catalog(drug_list, target_db)
