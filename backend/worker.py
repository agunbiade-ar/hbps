from worker_utils.connection import source_db, target_db
from worker_utils.polling_funcs import (
    poll_orders,
    poll_for_patients,
)
from worker_utils.concepts import transport_concepts_from_openmrsDB
import time

# this is a one time thing, anytime the worker script runs
# if any new concepts are added into openmrs, it should pick it up


def main():
    while True:
        try:
            poll_orders(source_db, target_db)
            transport_concepts_from_openmrsDB(source_db, target_db)
            poll_for_patients(source_db, target_db)
        except Exception as e:
            print(f"Error in polling cycle: {e}")

        time.sleep(3 * 60)


if __name__ == "__main__":
    main()
