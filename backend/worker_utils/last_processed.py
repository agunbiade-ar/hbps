def get_last_processed_order_id(target_db):
    cursor = target_db.cursor(dictionary=True, buffered=True)
    cursor.execute(
        """SELECT last_processed_id FROM hayokbps.last_processed_order LIMIT 1"""
    )
    row = cursor.fetchone()
    cursor.close()
    return row.get("last_processed_id") if row else 0


def update_last_processed_order_id(target_db, current_id):
    cursor = target_db.cursor()
    cursor.execute(
        "UPDATE hayokbps.last_processed_order SET last_processed_id = %s", (current_id,)
    )

    # Save the bookmark
    target_db.commit()
    cursor.close()


def get_last_processed_patient_id(target_db):
    cursor = target_db.cursor(dictionary=True, buffered=True)
    cursor.execute(
        """SELECT last_processed_id FROM hayokbps.last_processed_patient LIMIT 1"""
    )
    row = cursor.fetchone()
    cursor.close()
    return row.get("last_processed_id") if row else 0


def update_last_processed_patient_id(target_db, current_id):
    cursor = target_db.cursor()
    cursor.execute(
        "UPDATE hayokbps.last_processed_patient SET last_processed_id = %s",
        (current_id,),
    )

    # Save the bookmark
    target_db.commit()
    cursor.close()


def get_last_processed_concept_id(target_db):
    cursor = target_db.cursor(dictionary=True, buffered=True)
    cursor.execute(
        """SELECT last_processed_id FROM hayokbps.last_processed_concept LIMIT 1"""
    )
    row = cursor.fetchone()
    cursor.close()
    return row.get("last_processed_id") if row else 0


def update_last_processed_concept_id(target_db, last_id):
    cursor = target_db.cursor()
    cursor.execute(
        "UPDATE hayokbps.last_processed_concept SET last_processed_id = %s",
        (last_id,),
    )

    # Save the bookmark
    target_db.commit()
    cursor.close()
