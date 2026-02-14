from worker_utils.connection import source_db, target_db
from worker_utils.polling_funcs import (
    poll_orders,
    poll_for_patients,
)
from worker_utils.concepts import transport_concepts_from_openmrsDB

# this is a one time thing, anytime the worker script runs
# if any new concepts are added into openmrs, it should pick it up

# these are timed
while True:
    transport_concepts_from_openmrsDB(source_db=source_db, target_db=target_db)

    poll_for_patients(source_db=source_db, target_db=target_db)
    poll_orders(source_db=source_db, target_db=target_db)
