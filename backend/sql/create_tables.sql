CREATE TABLE hayokbps.bill (
    id INT AUTO_INCREMENT PRIMARY KEY,
    visit_id VARCHAR(100) NOT NULL UNIQUE,  -- One bill per visit
        
    total_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,  -- Sum of all items
    paid_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,   -- Sum of all payments
    balance DECIMAL(10, 2) NOT NULL DEFAULT 0,       -- total - paid
    
    status ENUM('pending', 'paid', 'cancelled', 'partially_paid') NOT NULL DEFAULT 'pending',
    
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_openmrs_visit_id (visit_id),
    INDEX idx_patient_id (patient_id),
    INDEX idx_status (status)
);

CREATE TABLE hayokbps.bill_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    bill_id INT NOT NULL,
    order_id VARCHAR(100) NOT NULL,  -- Links back to OpenMRS
    
    encounter_id VARCHAR(100),  -- Optional but useful
    
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
    updated_at DATETIME ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (bill_id) REFERENCES hayokbps.bill(id) ON DELETE CASCADE,
    FOREIGN KEY (payment_id) REFERENCES hayokbps.payments(id) ON DELETE SET NULL,
    
    INDEX idx_bill_id (bill_id),
    INDEX idx_openmrs_order_id (order_id),
    INDEX idx_payment_status (payment_status),
    INDEX idx_can_dispense (can_dispense),  -- For pharmacy queue
    
    UNIQUE KEY unique_order (order_id)  -- Prevent duplicate billing of same order
);

CREATE INDEX idx_bill_item_bill_id ON hayokbps.bill_items(bill_id);


CREATE TABLE hayokbps.last_processed_bill (
    id INT AUTO_INCREMENT PRIMARY KEY,
    last_processed_id INT NOT NULL DEFAULT 0,
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE hayokbps.last_processed_patient (
    id INT AUTO_INCREMENT PRIMARY KEY,
    last_processed_id INT NOT NULL DEFAULT 0,
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE hayokbps.last_processed_concept (
    id INT AUTO_INCREMENT PRIMARY KEY,
    last_processed_id INT NOT NULL DEFAULT 0,
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
-- to start with
-- INSERT INTO hayokbps.last_processed_bill (last_processed_id) VALUES(0);


CREATE TABLE hayokbps.users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    openmrs_uuid VARCHAR(255) NOT NULL UNIQUE,
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL,
    middle_name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE hayokbps.roles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    role_name VARCHAR(100) NOT NULL
);

CREATE TABLE hayokbps.user_roles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    role_id INT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES hayokbps.users(id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES hayokbps.roles(id) ON DELETE CASCADE,
    UNIQUE (user_id, role_id)
);

CREATE TABLE hayokbps.user_refresh_tokens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,
    refresh_token VARCHAR(512) NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES hayokbps.users(id) ON DELETE CASCADE
);

CREATE TABLE hayokbps.payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    bill_id INT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    receipt_number VARCHAR(50) NOT NULL UNIQUE,
    paid_items_ids JSON,
    cashier_id INT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, 
    
     FOREIGN KEY (bill_id) REFERENCES hayokbps.bill(id) ON DELETE CASCADE,
     FOREIGN KEY (cashier_id) REFERENCES hayokbps.users(id),
     
	INDEX idx_bill_id (bill_id),
    INDEX idx_created_at (created_at),
    INDEX idx_receipt_number (receipt_number)
);

CREATE TABLE hayokbps.facility(
	id INT auto_increment PRIMARY KEY,
    facility_name VARCHAR (255) NOT NULL,
    facility_uuid CHAR(36) DEFAULT (UUID())
);

CREATE TABLE hayokbps.items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    concept_id INT NOT NULL UNIQUE,  -- The ID from OpenMRS
    concept_name VARCHAR(255),       -- Human readable name (e.g., 'Malaria Test')
    category VARCHAR(50),            -- 'Lab', 'Pharmacy', 'Ward', 'Surgery'
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);


CREATE TABLE hayokbps.billing_patients (
    id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id INT NOT NULL UNIQUE,
    patient_name VARCHAR (255) NOT NULL,
    facility_id INT NOT NULL DEFAULT 1,
    current_payer_type VARCHAR(50) NOT NULL DEFAULT 'cash',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (facility_id) REFERENCES hayokbps.facility(id) 
);

CREATE TABLE payer_type (
    id INT AUTO_INCREMENT PRIMARY KEY,
    payer_code VARCHAR(100) UNIQUE,
    payer_name VARCHAR(255)
);

CREATE TABLE hayokbps.item_prices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    item_id INT NOT NULL,
    facility_id INT NOT NULL DEFAULT 1,
    payer_id INT NOT NULL DEFAULT 1,
    price DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE (facility_id, item_id, payer_type),
    FOREIGN KEY (item_id) REFERENCES hayokbps.items(id),
    FOREIGN KEY (facility_id) REFERENCES hayokbps.facility(id)
);

CREATE TABLE hayokbps.orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    patient_id INT NOT NULL,
    concept_id INT NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    status ENUM('pending', 'dispensed', 'cancelled', 'billed') 
);

-- INSERT INTO hayokbps.facility (facility_name) 
-- VALUES ('Home Hospital');