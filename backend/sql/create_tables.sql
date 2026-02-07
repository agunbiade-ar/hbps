CREATE TABLE hayokbps.bill (
	id INT AUTO_INCREMENT NOT NULL PRIMARY KEY,
	patient_id INT NOT NULL,
	visit_id INT NOT NULL,
	total_amount DECIMAL(10,2) NOT NULL,
	status ENUM('pending', 'paid', 'cancelled', 'partially_paid'),
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE hayokbps.bill_item (
    id INT AUTO_INCREMENT PRIMARY KEY,
    bill_id INT NOT NULL,
    order_id INT NOT NULL,
    concept_name VARCHAR(255) NOT NULL,
    concept_id INT NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    quantity INT NOT NULL,
	status ENUM('pending', 'paid', 'cancelled') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP 
        ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_bill_item_bill
        FOREIGN KEY (bill_id)
        REFERENCES hayokbps.bill(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);

CREATE INDEX idx_bill_item_bill_id ON hayokbps.bill_item(bill_id);


CREATE TABLE hayokbps.last_processed_bill (
    id INT AUTO_INCREMENT PRIMARY KEY,
    last_processed_id INT NOT NULL DEFAULT 0,
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
-- to start with
-- INSERT INTO hayokbps.last_processed_bill (last_processed_id) VALUES(0);

CREATE TABLE hayokbps.price_list (
    id INT AUTO_INCREMENT PRIMARY KEY,
    concept_id INT NOT NULL UNIQUE,  -- The ID from OpenMRS
    concept_name VARCHAR(255),       -- Human readable name (e.g., 'Malaria Test')
    category VARCHAR(50),            -- 'Lab', 'Pharmacy', 'Ward', 'Surgery'
    price DECIMAL(10, 2) NOT NULL DEFAULT 0,  -- The actual cost
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE hayokbps.users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    openmrs_uuid VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
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