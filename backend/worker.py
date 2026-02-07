from dotenv import load_dotenv
import mysql.connector
from mysql.connector import Error
import os
import time
from typing import Any

load_dotenv()


def get_connection(db_name, user, password, host):
    try:
        connection = mysql.connector.connect(
            host=host,
            user=user,
            password=password,
            database=db_name,
            # This is important for background workers:
            autocommit=True,
        )
        return connection
    except Error as e:
        print(f"Error connecting to MariaDB/MySQL: {e}")
        return None


source_db = get_connection(
    db_name=os.getenv("OPENMRS_DB"),
    password=os.getenv("DB_PASSWORD"),
    host=os.getenv("DB_HOST"),
    user=os.getenv("DB_USER"),
)

target_db = get_connection(
    db_name=os.getenv("BILLING_DB"),
    password=os.getenv("DB_PASSWORD"),
    host=os.getenv("DB_HOST"),
    user=os.getenv("DB_USER"),
)


def get_concepts_from_openmrsDB(source_db):
    cursor = source_db.cursor(dictionary=True, buffered=True)
    query = """
    SELECT c.concept_id, cn.name, cc.name AS class_name
    FROM server.concept c
    JOIN server.concept_name cn ON c.concept_id = cn.concept_id
    JOIN server.concept_class cc ON c.class_id = cc.concept_class_id
    WHERE cn.locale = 'en' 
    AND cn.concept_name_type = 'FULLY_SPECIFIED'
    AND cc.name IN ('Test', 'Procedure', 'Drug')"""

    cursor.execute(query)
    rows = cursor.fetchall()
    cursor.close()
    return rows


def insert_concepts_price_to_db(source_db, target_db):
    rows = get_concepts_from_openmrsDB(source_db=source_db)

    cursor = target_db.cursor(dictionary=True, buffered=True)
    insert_query = """
   INSERT INTO hayokbps.price_list (concept_id, concept_name, category) VALUES (%s, %s, %s) ON DUPLICATE KEY UPDATE
    concept_name = VALUES(concept_name),
    category = VALUES(category);
    """
    # Prepare a list of tuples from your dictionary rows
    data = [(row["concept_id"], row["name"], row["class_name"]) for row in rows]

    # Batch insert
    cursor.executemany(insert_query, data)
    target_db.commit()
    cursor.close()


def update_bill_total_amount(target_db, bill_id):
    # Using a cursor to perform the math and the update is better and faster
    cursor = target_db.cursor(dictionary=True)

    try:
        # 1. Let MySQL do the math (much faster)
        sum_query = (
            "SELECT SUM(price) as total FROM hayokbps.bill_item WHERE bill_id = %s"
        )
        cursor.execute(sum_query, (bill_id,))
        result = cursor.fetchone()

        # Default to 0 if there are no items
        total_price = result["total"] if result["total"] else 0

        # 2. Update the parent bill table so the Cashier sees the total
        update_query = "UPDATE hayokbps.bill SET total_amount = %s WHERE id = %s"
        cursor.execute(update_query, (total_price, bill_id))

        # 3. Commit the change!
        target_db.commit()

        print(f"Bill ID {bill_id} updated to total: {total_price}")
        return total_price

    except Exception as e:
        print(f"Failed to update bill total: {e}")
        target_db.rollback()
        return 0
    finally:
        cursor.close()


def create_bill_in_targetDB(order, source_db, target_db):
    source_db_cursor = source_db.cursor(dictionary=True, buffered=True)
    target_db_cursor = target_db.cursor(dictionary=True, buffered=True)

    try:
        # 1. Get Encounter to find the Visit ID
        get_encounter_query = "SELECT * FROM encounter WHERE encounter_id = %s"
        source_db_cursor.execute(get_encounter_query, (order.get("encounter_id"),))
        encounter = source_db_cursor.fetchone()

        if not encounter:
            print(f"Error: Encounter {order.get('encounter_id')} not found.")
            return

        visit_id = encounter.get("visit_id")

        # 2. Look up the price from your price_list
        concept_price_query = (
            "SELECT price FROM hayokbps.price_list WHERE concept_id = %s"
        )
        target_db_cursor.execute(concept_price_query, (order.get("concept_id"),))
        row = target_db_cursor.fetchone()
        price = row.get("price", 0) if row else 0

        # 3. Check if a PENDING bill already exists for this visit
        # Added 'AND status = "pending"' so we don't add items to a bill the patient already paid!
        existing_bill_query = "SELECT * FROM hayokbps.bill WHERE visit_id = %s AND status = 'pending' LIMIT 1"
        target_db_cursor.execute(existing_bill_query, (visit_id,))
        existing_bill = target_db_cursor.fetchone()

        if existing_bill:
            bill_id = existing_bill.get("id")
            add_item_query = """INSERT INTO hayokbps.bill_item (bill_id, order_id, concept_name, concept_id, price, quantity) 
                                VALUES (%s, %s, %s, %s, %s, %s)"""
            target_db_cursor.execute(
                add_item_query,
                (
                    bill_id,
                    order.get("order_id"),
                    order.get("concept_name"),
                    order.get("concept_id"),
                    price,
                    order.get("quantity", 1),
                ),
            )
            print(f"Added item to existing bill {bill_id}")
        else:
            # 4. Create NEW bill
            create_bill_query = """INSERT INTO hayokbps.bill (patient_id, visit_id, total_amount, status, patient_name) 
                                   VALUES (%s, %s, %s, %s, %s)"""
            target_db_cursor.execute(
                create_bill_query,
                (
                    encounter.get("patient_id"),
                    visit_id,
                    0,
                    "pending",
                    f"{order.get('family_name') or ''} {order.get('given_name') or ''} {order.get('middle_name') or ''}",
                ),
            )
            bill_id = target_db_cursor.lastrowid

            # 5. Create NEW bill item
            create_item_query = """INSERT INTO hayokbps.bill_item 
                                   (bill_id, order_id, concept_name, concept_id, price, quantity) 
                                   VALUES (%s, %s, %s, %s, %s, %s)"""
            target_db_cursor.execute(
                create_item_query,
                (
                    bill_id,
                    order.get("order_id"),
                    order.get("concept_name"),
                    order.get("concept_id"),
                    price,
                    order.get("quantity", 1),
                ),
            )

            update_bill_total_amount(target_db=target_db, bill_id=bill_id)
            print(f"Created new bill {bill_id} and added bill item")

        target_db.commit()

    except Exception as e:
        print(f"Error in processing: {e}")
        target_db.rollback()
    finally:
        source_db_cursor.close()
        target_db_cursor.close()


def get_last_processed_bill(target_db):
    cursor = target_db.cursor(dictionary=True, buffered=True)
    cursor.execute(
        """SELECT last_processed_id FROM hayokbps.last_processed_bill LIMIT 1"""
    )
    row = cursor.fetchone()
    cursor.close()
    return row.get("last_processed_id") if row else 0


def update_last_processed_bill(target_db, current_id):
    cursor = target_db.cursor()
    cursor.execute(
        "UPDATE hayokbps.last_processed_bill SET last_processed_id = %s", (current_id,)
    )

    # Save the bookmark
    target_db.commit()
    cursor.close()


def poll_orders():
    global source_db
    global target_db

    last_processed_id = get_last_processed_bill(target_db=target_db)

    while True:
        try:
            # FIX THE DRAWBACK: Check if connection is still alive
            if source_db is None or not source_db.is_connected():
                print("Reconnecting to database...")
                source_db = get_connection(
                    db_name=os.getenv("OPENMRS_DB"),
                    password=os.getenv("DB_PASSWORD"),
                    host=os.getenv("DB_HOST"),
                    user=os.getenv("DB_USER"),
                )
            if source_db is None:
                print("Failed to reconnect.")
                time.sleep(10)
                continue

            cursor = source_db.cursor(dictionary=True, buffered=True)

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
            do.quantity
        FROM server.orders o
        JOIN server.person_name pn ON o.patient_id = pn.person_id AND pn.voided = 0
        JOIN server.concept_name cn ON o.concept_id = cn.concept_id
        -- Corrected Join: Join on order_id, not patient_id
        LEFT JOIN server.drug_order do ON o.order_id = do.order_id
        WHERE o.order_id > %s
            AND o.voided = 0
            AND cn.locale = 'en' 
            AND cn.concept_name_type = 'FULLY_SPECIFIED'
            AND cn.voided = 0
        ORDER BY o.order_id ASC"""

            cursor.execute(query, (last_processed_id,))  # type: ignore

            while True:
                rows = cursor.fetchmany(100)
                if not rows:
                    break

                for order in rows:
                    print(f"order {order}")
                    print(f"Processing new order: {order.get("order_id")}")  # type: ignore

                    quantity = order.get("quantity")  # type: ignore

                    if quantity is None:
                        order["quantity"] = 1  # type: ignore
                    # Create the bill
                    create_bill_in_targetDB(order, source_db, target_db)

                    # 3. Move the bookmark up to the current ID
                    last_processed_id = order.get("order_id")  # type: ignore
                    print(f"last processed order id => {last_processed_id}")

            update_last_processed_bill(
                target_db=target_db, current_id=last_processed_id
            )
            cursor.close()

        except Exception as e:
            print(f"Loop error: {e}")

        time.sleep(120)


# #initial insert of concept prices
# insert_concepts_price_to_db(source_db=source_db, target_db=target_db)

# we need to also poll if new concepts are added so we can add prices as well

# run this when all is set
poll_orders()
