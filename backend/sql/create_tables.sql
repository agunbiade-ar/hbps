-- set foreign_key_checks=0;

DROP DATABASE IF EXISTS hayokbps;
CREATE DATABASE IF NOT EXISTS hayokbps;

USE hayokbps;

CREATE TABLE IF NOT EXISTS hayokbps.users  (
    id INT AUTO_INCREMENT PRIMARY KEY,
    openmrs_uuid VARCHAR(255) NOT NULL UNIQUE,
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL,
    middle_name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO hayokbps.users (openmrs_uuid, first_name, last_name)
VALUES ("82f18b44-6814-11e8-923f-e9a88dcb533f", "Abdulrasheed", "Agunbiade");


CREATE TABLE IF NOT EXISTS hayokbps.facility (
    id INT auto_increment PRIMARY KEY,
    facility_name VARCHAR (255) NOT NULL,
    facility_uuid CHAR(36) DEFAULT (UUID()),
    street VARCHAR (255),
    state VARCHAR (255) NOT NULL,
    phone_no VARCHAR (100) NOT NULL,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT INTO hayokbps.facility(facility_name, state, street, phone_no)
VALUES ("Home Care", "Kano", "18 Umar Galadima", "081361 56510");

CREATE TABLE IF NOT EXISTS payer_type  (
    id INT AUTO_INCREMENT PRIMARY KEY,
    payer_code VARCHAR(100) UNIQUE,
    payer_name VARCHAR(255),
    pricing_type ENUM('manual','percentage') DEFAULT 'manual',
    percentage_value DECIMAL(5,2) DEFAULT NULL,
    is_active BOOLEAN DEFAULT TRUE,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT INTO hayokbps.payer_type(payer_code, payer_name)
VALUES ("SELF", "Self-Payment"),
("NHIA", "National Health Insurance"),
("OSHIA", "Osun Health Insurance");

CREATE TABLE IF NOT EXISTS hayokbps.billing_patients  (
    id INT AUTO_INCREMENT PRIMARY KEY,
    patient_uuid VARCHAR (100) NOT NULL UNIQUE,
    patient_name VARCHAR (255) NOT NULL,
    -- facility_id INT NOT NULL DEFAULT 1,
    current_payer_type INT NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);


CREATE TABLE IF NOT EXISTS hayokbps.billing_visits  (
    id INT AUTO_INCREMENT PRIMARY KEY,
    visit_id INT NOT NULL,          -- from OpenMRS
    patient_uuid VARCHAR (100) NOT NULL,
    -- encounter_id INT NOT NULL,
    status ENUM ('open', 'billed', 'partially_paid', 'paid', 'cancelled') DEFAULT 'open',

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY unique_visit (visit_id),
    FOREIGN KEY (patient_uuid) REFERENCES hayokbps.billing_patients(patient_uuid)
);

CREATE TABLE IF NOT EXISTS hayokbps.bill  (
    id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id INT NOT NULL,
    payer_id INT NOT NULL,

    billing_visit_id INT NOT NULL,
    total_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,  -- Sum of all items
    paid_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,   -- Sum of all payments
    balance DECIMAL(10, 2) NOT NULL DEFAULT 0,       -- total - paid

    status ENUM('pending', 'paid', 'cancelled', 'partially_paid') NOT NULL DEFAULT 'pending',

    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (payer_id) REFERENCES hayokbps.payer_type(id) ON DELETE RESTRICT,

    FOREIGN KEY (billing_visit_id) REFERENCES hayokbps.billing_visits(id) ON DELETE RESTRICT,

    FOREIGN KEY (patient_id) REFERENCES hayokbps.billing_patients(id) ON DELETE RESTRICT,

    INDEX idx_status (status)
);


CREATE TABLE IF NOT EXISTS hayokbps.payments  (
    id INT AUTO_INCREMENT PRIMARY KEY,
    bill_id INT NOT NULL,
    patient_id INT NOT NULL,
    facility_id INT NOT NULL DEFAULT 1,
    amount DECIMAL(10,2) NOT NULL,
    receipt_number VARCHAR(50) NOT NULL UNIQUE,
    cashier_id INT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (facility_id) REFERENCES hayokbps.facility(id) ON DELETE RESTRICT,

    FOREIGN KEY (patient_id) REFERENCES hayokbps.billing_patients(id) ON DELETE RESTRICT,
    FOREIGN KEY (bill_id) REFERENCES hayokbps.bill(id) ON DELETE CASCADE,
    FOREIGN KEY (cashier_id) REFERENCES hayokbps.users(id),

    INDEX idx_bill_id (bill_id),
    INDEX idx_created_at (created_at),
    INDEX idx_receipt_number (receipt_number)
);


CREATE TABLE IF NOT EXISTS hayokbps.bill_items  (
    id INT AUTO_INCREMENT PRIMARY KEY,
    bill_id INT NOT NULL,
    order_uuid VARCHAR(100) NOT NULL,  -- Links back to OpenMRS

    -- encounter_id VARCHAR(100),  -- Optional but useful
    -- Item details
    description VARCHAR(255) NOT NULL,  -- Drug name, test name, etc.
    item_type ENUM('drug', 'lab', 'procedure', 'consultation', 'admission') NOT NULL,
    quantity INT NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL,
    total_price DECIMAL(10, 2) NOT NULL,

    -- Payment tracking
    payment_status ENUM('pending', 'paid', 'refunded') NOT NULL DEFAULT 'pending',
    payment_id INT,  -- ← Links to the payment that covered this item
    paid_at DATETIME,

    -- Dispensing tracking
    can_dispense BOOLEAN NOT NULL DEFAULT FALSE,  -- True when paid
    dispensed BOOLEAN NOT NULL DEFAULT FALSE,
    dispensed_quantity INT,
    dispensed_at DATETIME,

    -- Metadata
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (bill_id) REFERENCES hayokbps.bill(id) ON DELETE CASCADE,
    FOREIGN KEY (payment_id) REFERENCES hayokbps.payments(id) ON DELETE SET NULL,

    INDEX idx_bill_id (bill_id),
    INDEX idx_payment_status (payment_status),
    INDEX idx_can_dispense (can_dispense),  -- For pharmacy queue

    UNIQUE KEY unique_order (order_uuid)  -- Prevent duplicate billing of same order
);


CREATE TABLE IF NOT EXISTS hayokbps.roles  (
    id INT AUTO_INCREMENT PRIMARY KEY,
    role_name VARCHAR(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS hayokbps.user_roles  (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    role_id INT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES hayokbps.users(id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES hayokbps.roles(id) ON DELETE CASCADE,
    UNIQUE (user_id, role_id)
);

CREATE TABLE IF NOT EXISTS hayokbps.user_refresh_tokens  (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,
    refresh_token VARCHAR(512) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES hayokbps.users(id) ON DELETE CASCADE
);


CREATE TABLE IF NOT EXISTS hayokbps.items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    concept_uuid VARCHAR(100) NOT NULL,
    drug_uuid VARCHAR(100) NULL,
    item_name VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL,
    dosage_form VARCHAR(100) NULL,
    strength VARCHAR(50) NULL,
    base_price DECIMAL(10,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_concept_no_drug (concept_uuid, drug_uuid)
);

CREATE TABLE IF NOT EXISTS hayokbps.item_prices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    item_id INT NOT NULL,              -- FK to items.id, keep it simple
    payer_id INT NOT NULL DEFAULT 1,
    price DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE (item_id, payer_id),
    FOREIGN KEY (item_id) REFERENCES hayokbps.items(id)
);

CREATE TABLE IF NOT EXISTS hayokbps.orders (
    id INT AUTO_INCREMENT PRIMARY KEY,

    billing_visit_id INT NOT NULL,
    order_uuid VARCHAR (100) NOT NULL UNIQUE,

    drug_uuid VARCHAR (100) NULL,
    concept_uuid VARCHAR (100) NOT NULL,

    dose VARCHAR(50) NULL,

    frequency VARCHAR(100) NULL,
    route VARCHAR(100) NULL,
    duration VARCHAR(50) NULL,                -- combine duration + units e.g "7 days",
    quantity INT NOT NULL DEFAULT 1,
    status ENUM('open', 'billed', 'paid', 'dispensed', 'cancelled') DEFAULT 'open',
    patient_uuid VARCHAR (100) NOT NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (billing_visit_id) REFERENCES hayokbps.billing_visits(id)
);


CREATE TABLE IF NOT EXISTS hayokbps.last_processed_bill  (
    id INT AUTO_INCREMENT PRIMARY KEY,
    last_processed_id INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS hayokbps.last_processed_patient  (
    id INT AUTO_INCREMENT PRIMARY KEY,
    last_processed_id INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS hayokbps.last_processed_concept  (
    id INT AUTO_INCREMENT PRIMARY KEY,
    last_processed_id INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS hayokbps.last_processed_order  (
    id INT AUTO_INCREMENT PRIMARY KEY,
    last_processed_id INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
