-- Oracle Wallet Test - Sample Data

CREATE TABLE users (
    id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email VARCHAR2(255) NOT NULL UNIQUE,
    name VARCHAR2(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE products (
    id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR2(200) NOT NULL,
    price NUMBER(10,2) NOT NULL,
    stock NUMBER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO users (email, name) VALUES ('wallet@example.com', 'Wallet Test User');
INSERT INTO users (email, name) VALUES ('admin@example.com', 'Admin User');

INSERT INTO products (name, price, stock) VALUES ('Test Product 1', 29.99, 100);
INSERT INTO products (name, price, stock) VALUES ('Test Product 2', 49.99, 50);

COMMIT;
EXIT;