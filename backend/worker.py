# import time
import asyncio

from worker_utils.concepts import transport_concepts_from_openmrsDB
from worker_utils.connection import source_db, target_db
from worker_utils.polling_funcs import (
    poll_drugs,
    poll_for_patients,
    poll_orders,
)
from worker_utils.last_processed import get_last_processed_order_id

# this is a one time thing, anytime the worker script runs
# if any new concepts are added into openmrs, it should pick it up


async def main(polling_interval=3):
    sync_cycle = 0

    while True:
        try:
            last_processed_order_id = get_last_processed_order_id(target_db)

            # only sync concepts/drugs once every 20 cycles (~1 hour)
            if sync_cycle % 20 == 0:
                transport_concepts_from_openmrsDB(source_db, target_db)
                await poll_drugs(target_db)

            poll_for_patients(source_db, target_db)
            poll_orders(source_db, target_db, last_processed_id=last_processed_order_id)

        except Exception as e:
            print(f"Error in polling cycle: {e}")

        sync_cycle += 1
        await asyncio.sleep(polling_interval * 60)  # non blocking sleep :D


if __name__ == "__main__":
    asyncio.run(main())
