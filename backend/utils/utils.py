import logging
from datetime import datetime
import secrets


def set_logger(name):
    logger = logging.getLogger(name=name)
    return logger


def generate_receipt_number():
    date_part = datetime.now().strftime("%Y%m%d")
    random_part = secrets.token_hex(3).upper()
    return f"HYK-{date_part}-{random_part}"
