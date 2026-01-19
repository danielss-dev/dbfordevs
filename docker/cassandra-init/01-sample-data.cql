// Create sample keyspace for testing
CREATE KEYSPACE IF NOT EXISTS sample_store
WITH replication = {'class': 'SimpleStrategy', 'replication_factor': 1}
AND durable_writes = true;

// Create a test keyspace
CREATE KEYSPACE IF NOT EXISTS test_keyspace
WITH replication = {'class': 'SimpleStrategy', 'replication_factor': 1}
AND durable_writes = true;

// Use sample_store keyspace
USE sample_store;

// Users table with partition key on user_id
CREATE TABLE IF NOT EXISTS users (
    user_id uuid PRIMARY KEY,
    email text,
    username text,
    created_at timestamp,
    last_login timestamp,
    is_active boolean,
    tags set<text>,
    profile map<text, text>
);

// Create secondary index on email for lookups
CREATE INDEX IF NOT EXISTS users_email_idx ON users (email);

// Orders table with composite partition key (user_id + order_date)
CREATE TABLE IF NOT EXISTS orders (
    user_id uuid,
    order_date date,
    order_id uuid,
    total_amount decimal,
    status text,
    items list<frozen<map<text, text>>>,
    shipping_address map<text, text>,
    PRIMARY KEY ((user_id, order_date), order_id)
) WITH CLUSTERING ORDER BY (order_id DESC);

// Products table with category as partition key, clustered by product_id
CREATE TABLE IF NOT EXISTS products (
    category text,
    product_id uuid,
    name text,
    description text,
    price decimal,
    stock_count int,
    attributes map<text, text>,
    created_at timestamp,
    PRIMARY KEY (category, product_id)
) WITH CLUSTERING ORDER BY (product_id ASC);

// Time series table for sensor readings
CREATE TABLE IF NOT EXISTS sensor_readings (
    sensor_id text,
    day date,
    reading_time timestamp,
    temperature double,
    humidity double,
    pressure double,
    metadata map<text, text>,
    PRIMARY KEY ((sensor_id, day), reading_time)
) WITH CLUSTERING ORDER BY (reading_time DESC);

// Insert sample users
INSERT INTO users (user_id, email, username, created_at, last_login, is_active, tags, profile)
VALUES (uuid(), 'alice@example.com', 'alice', toTimestamp(now()), toTimestamp(now()), true,
        {'premium', 'verified'}, {'bio': 'Software developer', 'location': 'New York'});

INSERT INTO users (user_id, email, username, created_at, last_login, is_active, tags, profile)
VALUES (uuid(), 'bob@example.com', 'bob', toTimestamp(now()), toTimestamp(now()), true,
        {'standard'}, {'bio': 'Designer', 'location': 'San Francisco'});

INSERT INTO users (user_id, email, username, created_at, last_login, is_active, tags, profile)
VALUES (uuid(), 'charlie@example.com', 'charlie', toTimestamp(now()), null, false,
        {'inactive'}, {'bio': 'Data analyst', 'location': 'Chicago'});

// Insert sample products
INSERT INTO products (category, product_id, name, description, price, stock_count, attributes, created_at)
VALUES ('electronics', uuid(), 'Wireless Mouse', 'Ergonomic wireless mouse', 29.99, 150,
        {'color': 'black', 'connectivity': 'bluetooth'}, toTimestamp(now()));

INSERT INTO products (category, product_id, name, description, price, stock_count, attributes, created_at)
VALUES ('electronics', uuid(), 'Mechanical Keyboard', 'RGB mechanical keyboard', 89.99, 75,
        {'switches': 'cherry mx', 'backlight': 'rgb'}, toTimestamp(now()));

INSERT INTO products (category, product_id, name, description, price, stock_count, attributes, created_at)
VALUES ('electronics', uuid(), 'USB-C Hub', '7-in-1 USB-C hub', 49.99, 200,
        {'ports': '7', 'power_delivery': '100W'}, toTimestamp(now()));

INSERT INTO products (category, product_id, name, description, price, stock_count, attributes, created_at)
VALUES ('books', uuid(), 'Cassandra: The Definitive Guide', 'Complete guide to Apache Cassandra', 45.00, 50,
        {'pages': '400', 'format': 'paperback'}, toTimestamp(now()));

INSERT INTO products (category, product_id, name, description, price, stock_count, attributes, created_at)
VALUES ('books', uuid(), 'Designing Data-Intensive Applications', 'Guide to distributed systems', 55.00, 30,
        {'pages': '600', 'format': 'hardcover'}, toTimestamp(now()));

// Insert sample sensor readings (last 3 days of data)
INSERT INTO sensor_readings (sensor_id, day, reading_time, temperature, humidity, pressure, metadata)
VALUES ('sensor-001', '2024-01-15', '2024-01-15 10:00:00', 22.5, 45.0, 1013.25, {'location': 'Building A'});

INSERT INTO sensor_readings (sensor_id, day, reading_time, temperature, humidity, pressure, metadata)
VALUES ('sensor-001', '2024-01-15', '2024-01-15 11:00:00', 23.1, 44.5, 1013.30, {'location': 'Building A'});

INSERT INTO sensor_readings (sensor_id, day, reading_time, temperature, humidity, pressure, metadata)
VALUES ('sensor-001', '2024-01-15', '2024-01-15 12:00:00', 24.0, 43.0, 1013.28, {'location': 'Building A'});

INSERT INTO sensor_readings (sensor_id, day, reading_time, temperature, humidity, pressure, metadata)
VALUES ('sensor-002', '2024-01-15', '2024-01-15 10:00:00', 20.5, 50.0, 1012.50, {'location': 'Building B'});

INSERT INTO sensor_readings (sensor_id, day, reading_time, temperature, humidity, pressure, metadata)
VALUES ('sensor-002', '2024-01-15', '2024-01-15 11:00:00', 21.0, 49.5, 1012.55, {'location': 'Building B'});

// Create a User Defined Type example in test_keyspace
USE test_keyspace;

CREATE TYPE IF NOT EXISTS address (
    street text,
    city text,
    state text,
    zip_code text,
    country text
);

CREATE TABLE IF NOT EXISTS contacts (
    contact_id uuid PRIMARY KEY,
    name text,
    email text,
    phone text,
    home_address frozen<address>,
    work_address frozen<address>,
    created_at timestamp
);

// Insert sample contact with UDT
INSERT INTO contacts (contact_id, name, email, phone, home_address, work_address, created_at)
VALUES (uuid(), 'John Doe', 'john.doe@example.com', '+1-555-0100',
        {street: '123 Main St', city: 'Springfield', state: 'IL', zip_code: '62701', country: 'USA'},
        {street: '456 Business Ave', city: 'Chicago', state: 'IL', zip_code: '60601', country: 'USA'},
        toTimestamp(now()));

INSERT INTO contacts (contact_id, name, email, phone, home_address, work_address, created_at)
VALUES (uuid(), 'Jane Smith', 'jane.smith@example.com', '+1-555-0101',
        {street: '789 Oak Lane', city: 'Austin', state: 'TX', zip_code: '73301', country: 'USA'},
        {street: '321 Tech Blvd', city: 'Austin', state: 'TX', zip_code: '73301', country: 'USA'},
        toTimestamp(now()));
