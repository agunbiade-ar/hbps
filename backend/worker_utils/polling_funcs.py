import time
from dotenv import load_dotenv

from .connection import source_db, target_db
from .last_processed import (
    get_last_processed_order_id,
    get_last_processed_patient_id,
    update_last_processed_order_id,
    update_last_processed_patient_id,
)

load_dotenv()


def poll_orders(polling_interval=3):
    while True:
        try:
            last_processed_id = get_last_processed_order_id(target_db=target_db)

            source_cursor = source_db.cursor(dictionary=True, buffered=True)

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
            ot.name AS order_type
            FROM orders o
            JOIN order_type ot ON ot.order_type_id = o.order_type_id AND ot.retired = 0
            JOIN person_name pn ON o.patient_id = pn.person_id AND pn.voided = 0
            JOIN concept_name cn ON o.concept_id = cn.concept_id
            -- Corrected Join: Join on order_id, not patient_id
            LEFT JOIN drug_order do ON o.order_id = do.order_id
            WHERE o.order_id > %s
            AND o.voided = 0
            AND cn.locale = 'en'
            AND cn.concept_name_type = 'FULLY_SPECIFIED'
            AND cn.voided = 0
            ORDER BY o.order_id ASC"""

            source_cursor.execute(query, (last_processed_id,))  # type: ignore

            while True:
                rows = source_cursor.fetchmany(100)
                if not rows:
                    break

                batch = []
                for order in rows:
                    print(f"Processing new order: {order.get('order_id')}")  # type: ignore

                    quantity = order.get("quantity")  # type: ignore

                    if quantity is None:
                        order["quantity"] = 1  # type: ignore

                    batch.append(
                        (
                            order.get("order_id"),  # type: ignore
                            order.get("patient_id"),  # type: ignore
                            order.get("concept_id"),  # type: ignore
                            order.get("quantity"),  # type: ignore
                            order.get("status"),  # type: ignore
                        )
                    )

                # insert order
                insert_order_query = """
                INSERT INTO hayokbps.orders (order_id, patient_id, concept_id, quantity, status)
                VALUES (%s, %s, %s, %s, %s)
                """

                target_cursor = target_db.cursor(dictionary=True, buffered=True)

                target_cursor.executemany(insert_order_query, tuple(batch))

                target_db.commit()

                # 3. Move the bookmark up to the current ID
                last_processed_id = order.get("order_id")  # type: ignore
                print(f"last processed order id => {last_processed_id}")

            update_last_processed_order_id(
                target_db=target_db, current_id=last_processed_id
            )

        except Exception as e:
            target_db.rollback()
            print(f"Loop error: {e}")
        finally:
            source_cursor.close()
            target_cursor.close()

        time.sleep(polling_interval * 60)


def poll_patients(polling_interval=5):
    while True:
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

                    patient_name = (
                        f"{first_name} {middle_name or ''} {last_name}".strip()
                    )

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
            target_cursor.close()
            source_cursor.close()

        time.sleep(polling_interval * 60)
