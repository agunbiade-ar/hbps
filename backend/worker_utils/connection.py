import os
import time

import mysql.connector
from mysql.connector import Error
from dotenv import load_dotenv

load_dotenv()

source_db_config = {
    "database": os.getenv("OPENMRS_DB"),
    "password": os.getenv("OPENMRS_DB_PASSWORD"),
    "host": os.getenv("OPENMRS_DB_HOST"),
    "user": os.getenv("OPENMRS_DB_USER"),
    "port": os.getenv("OPENMRS_DB_PORT"),
}

target_db_config = {
    "database": os.getenv("BILLING_DB"),
    "password": os.getenv("BILLING_DB_PASSWORD"),
    "host": os.getenv("BILLING_DB_HOST_EXPOSED"),
    "user": os.getenv("BILLING_DB_USER"),
    "port": os.getenv("BILLING_DB_PORT_EXPOSED"),
}

# print(source_db_config)
# print()
# print(target_db_config)


def get_connection(config_dict):  
    try:
        connection = mysql.connector.connect(**config_dict, autocommit=True, use_pure=True)
        return connection
    except Error as e:
        print(f"Error connecting to MariaDB/MySQL: {e}")
        return None


def ensure_connection(config_dict):
    """
    Checks if connection is alive. Reconnects if not.
    Returns a live connection.
    """
    db_connection = get_connection(config_dict)
    try:
        if db_connection is None or not db_connection.is_connected():
            print("Reconnecting to database...")
            db_connection = mysql.connector.connect(**config_dict, autocommit=True, use_pure=True)
            print("Reconnected successfully.")
        return db_connection
    except Error as e:
        print(f"Database connection failed: {e}")
        time.sleep(10)  # wait before retrying
        return None


def create_source_and_target_connections():
    while True:
        source_db = get_connection(source_db_config)
        target_db = get_connection(target_db_config)

        if source_db and target_db:
            return source_db, target_db

        print("Database connection failed :( ")
        print("waiting for 2 seconds, and will connect again :) ")
        time.sleep(2)
        continue


source_db, target_db = create_source_and_target_connections()
