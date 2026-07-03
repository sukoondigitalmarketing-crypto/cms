-- Database Initialization for Inventory Module
-- Create table and add sample data

-- Create Database if not exists
CREATE DATABASE IF NOT EXISTS cms_db;
USE cms_db;

-- Create Inventory Table
CREATE TABLE IF NOT EXISTS inventory (
    id INT AUTO_INCREMENT PRIMARY KEY,
    item_name VARCHAR(255) NOT NULL,
    category VARCHAR(150),
    sub_category VARCHAR(150),
    unit VARCHAR(50),
    quantity DECIMAL(10,2) DEFAULT 0.00,
    price_per_unit DECIMAL(10,2) DEFAULT 0.00,
    total_value DECIMAL(15,2) DEFAULT 0.00,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    is_deleted BOOLEAN DEFAULT FALSE,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert Sample Data
INSERT INTO inventory (item_name, category, sub_category, unit, quantity, price_per_unit, total_value) VALUES 
('UltraTech Cement', 'Construction Materials', '53 Grade', 'Bags', 500, 450, 225000),
('Copper Wire (2.5mm)', 'Electrical Items', 'Polycab', 'Meters', 200, 85, 17000),
('PVC Pipe (4 inch)', 'Plumbing Items', 'Astral', 'Nos', 100, 650, 65000);

-- Vendor Payments Tables
CREATE TABLE IF NOT EXISTS vendor_payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    vendor_id INT NOT NULL,
    project_id INT NOT NULL,
    payment_date DATE NOT NULL,
    payment_amount DECIMAL(15,2) NOT NULL,
    payment_mode VARCHAR(50) NOT NULL,
    reference_no VARCHAR(100) NULL,
    remarks TEXT NULL,
    is_deleted BOOLEAN DEFAULT FALSE,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (vendor_id) REFERENCES vendors(id),
    FOREIGN KEY (project_id) REFERENCES projects(id)
);

CREATE TABLE IF NOT EXISTS vendor_payment_allocations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    vendor_payment_id INT NOT NULL,
    vendor_invoice_id INT NOT NULL,
    allocated_amount DECIMAL(15,2) NOT NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (vendor_payment_id) REFERENCES vendor_payments(id) ON DELETE CASCADE,
    FOREIGN KEY (vendor_invoice_id) REFERENCES vendor_invoices(id)
);
