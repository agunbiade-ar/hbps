import re
import sys

from .last_processed import (
    get_last_processed_concept_id,
    update_last_processed_concept_id,
)

from app.httpclient.httpclient import OpenMRSClient
import os
from dotenv import load_dotenv

load_dotenv()

OPENMRS_BASE_URL = os.getenv("OPENMRS_BASE_URL")
OPENMRS_USER = os.getenv("OPENMRS_USER")
OPENMRS_PASSWORD = os.getenv("OPENMRS_USER_PASSWORD")


# concepts that are not drugs
def get_concepts_from_openmrsDB(source_db, target_db):
    cursor = source_db.cursor(dictionary=True, buffered=True)
    last_processed_id = get_last_processed_concept_id(target_db)

    query = """
    SELECT c.concept_id, c.uuid AS concept_uuid, cn.name, cc.name AS class_name
    FROM concept c
    JOIN concept_name cn ON c.concept_id = cn.concept_id
    JOIN concept_class cc ON c.class_id = cc.concept_class_id
    WHERE cn.locale = 'en'
    AND cn.concept_name_type = 'FULLY_SPECIFIED'
    AND cc.name IN ('Test', 'Procedure')
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
    """this leaves out drugs, because the get_concepts_from_openmrsdb func, filters for procedures, labs but not drugs"""
    concepts = get_concepts_from_openmrsDB(source_db=source_db, target_db=target_db)

    cursor = target_db.cursor(dictionary=True, buffered=True)
    insert_query = """
    INSERT INTO hayokbps.items (concept_uuid, item_name, category) VALUES (%s, %s, %s) ON DUPLICATE KEY UPDATE
    item_name = VALUES(item_name),
    category = VALUES(category),
    base_price = VALUES(base_price);
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
        category = CLASS_MAP.get(first_word, concept["class_name"])
        data.append((concept["concept_uuid"], concept["name"], category))

    try:
        # Batch insert
        cursor.executemany(insert_query, data)

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


def ensure_visit_exists(target_cursor, visit_id, patient_uuid):
    """
    Checks if a billing visit exists; inserts if missing.
    Returns the billing_visit_id from hayokbps.billing_visits
    """
    target_cursor.execute(
        "SELECT id FROM hayokbps.billing_visits WHERE visit_id=%s", (visit_id,)
    )
    row = target_cursor.fetchone()
    if row:
        return row["id"]
    # Insert new visit
    target_cursor.execute(
        "INSERT INTO hayokbps.billing_visits (visit_id, patient_uuid) VALUES (%s, %s)",
        (visit_id, patient_uuid),
    )
    return target_cursor.lastrowid


def insert_new_orders(target_db, rows, existing_visits_map):
    """
    Inserts NEW orders into hayokbps.orders.
    """
    new_orders = []
    for row in rows:
        # print(row)
        # sys.exit(1)
        if row["order_action"] != "NEW":
            continue
        billing_visit_id = existing_visits_map[row["visit_id"]]
        duration = row.get("duration", None)
        if duration is not None:
            duration = str(duration)
            duration += " " + row.get("duration_units")

        new_orders.append(
            (
                billing_visit_id,
                row["order_uuid"],
                row["patient_uuid"],
                row["concept_uuid"],
                row.get("quantity") or 1,
                row.get("drug_uuid"),
                row.get("dose"),
                row.get("frequency"),
                row.get("route"),
                duration,
            )
        )

    if not new_orders:
        return

    insert_query = """
        INSERT IGNORE INTO hayokbps.orders
        (billing_visit_id, order_uuid, patient_uuid, concept_uuid, quantity, drug_uuid,
        dose, frequency, route, duration)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
    """
    cursor = target_db.cursor()
    try:
        cursor.executemany(insert_query, new_orders)
        target_db.commit()
        print(f"Inserted {len(new_orders)} new orders")
    except Exception as e:
        target_db.rollback()
        print("Error inserting new orders:", e)


def cancel_discontinued_orders(target_db, rows):
    """
    Updates orders that were discontinued in OpenMRS.
    """
    discontinued_orders = [
        row["order_uuid"] for row in rows if row["order_action"] == "DISCONTINUE"
    ]
    if not discontinued_orders:
        return

    cursor = target_db.cursor()
    try:
        update_query = (
            "UPDATE hayokbps.orders SET status='cancelled' WHERE order_uuid=%s"
        )
        for order_uuid in discontinued_orders:
            cursor.execute(update_query, (order_uuid,))
        target_db.commit()
        print(f"Cancelled {len(discontinued_orders)} discontinued orders")
    except Exception as e:
        target_db.rollback()
        print("Error cancelling orders:", e)


async def login(client):
    response = await client.get(
        f"{OPENMRS_BASE_URL}/session",
        auth=(OPENMRS_USER, OPENMRS_PASSWORD),
        headers={"Accept": "application/json"},
    )

    if response.status_code == 401:
        print("Authentication failed, invalid credentials provided")
        return False

    response_payload = response.json()

    authenticated = response_payload.get("authenticated")
    if authenticated is None or authenticated is False:
        print("Authentication failed, please login again")
        return False

    return True


async def fetch_openmrs_drug_concepts():
    client = OpenMRSClient.get_client()
    login_response = await login(client)

    drug_catalog = []

    if login_response:
        start_index = 0
        limit = 50

        while True:
            response = await client.get(
                f"{OPENMRS_BASE_URL}drug?v=full&startIndex={start_index}&limit={limit}"
            )

            data = response.json()
            results = data["results"]

            for item in results:
                entry = build_catalog_entry(item)
                entry["category"] = "drug"

                if not entry["retired"]:
                    drug_catalog.append(entry)

            if "next" not in [link["rel"] for link in data.get("links", [])]:
                break

            start_index += limit

    return drug_catalog


def upsert_drug_concepts_catalog(entries: list, target_db):
    drug_entries = []

    query = """
        INSERT INTO hayokbps.items (concept_uuid, drug_uuid, item_name, category, dosage_form, strength)
        VALUES (%s, %s, %s, %s, %s, %s)
        ON DUPLICATE KEY UPDATE
            item_name = VALUES(item_name),
            dosage_form = VALUES(dosage_form),
            strength = VALUES(strength),
            category = VALUES(category)
            -- notice: no price here, never overwrite price on sync
    """
    for entry in entries:
        # print(entry)
        # sys.exit(1)
        drug_entries.append(
            (
                entry.get("concept_uuid"),
                entry.get("drug_uuid"),
                entry.get("display_name"),
                "drug",
                entry.get("dosage_form"),
                entry.get("strength"),
            )
        )
    try:
        target_db.cursor().executemany(query, drug_entries)
        target_db.commit()
        print(f"Added drug items successfully with length {len(drug_entries)}")
    except Exception as e:
        print(e)
        target_db.rollback()
        return None


def extract_display_name(drug: dict) -> str:
    """
    Build a clean display name for the drug.
    Priority: strength field → parse from name → name + dosage form
    """
    name = drug.get("name", "").strip()
    strength = drug.get("strength")
    dosage_form = drug.get("dosageForm", {})
    form_display = dosage_form.get("display", "") if dosage_form else ""

    if strength:
        # strength field is populated, use it directly
        if strength not in name:
            display = f"{name} {strength}"
        else:
            display = f"{name}"
    else:
        # try to extract strength from the name itself e.g "Paracetamol 500mg"
        match = re.search(
            r"(\d+(\.\d+)?\s*(mg|mcg|g|ml|iu|%|units))", name, re.IGNORECASE
        )
        if match:
            # name already contains strength, use as-is
            display = name
        else:
            # no strength info anywhere, just append dosage form if available
            display = f"{name} {form_display}".strip()

    return display


def build_catalog_entry(drug: dict) -> dict:
    return {
        "drug_uuid": drug.get("uuid"),
        "concept_uuid": drug.get("concept", {}).get("uuid"),
        "display_name": extract_display_name(drug),
        "dosage_form": drug.get("dosageForm", {}).get("display")
        if drug.get("dosageForm")
        else None,
        "strength": drug.get("strength"),
        "retired": drug.get("retired", False),
    }
