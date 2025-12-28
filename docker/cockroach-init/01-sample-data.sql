-- Sample tables for testing dbfordevs (CockroachDB)

CREATE TABLE IF NOT EXISTS users (
    id INT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS posts (
    id INT PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    content TEXT,
    published BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS comments (
    id INT PRIMARY KEY,
    post_id INT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert sample data with explicit IDs
INSERT INTO users (id, email, name) VALUES
    (1, 'alice@example.com', 'Alice Johnson'),
    (2, 'bob@example.com', 'Bob Smith'),
    (3, 'carol@example.com', 'Carol Williams');

INSERT INTO posts (id, user_id, title, content, published) VALUES
    (1, 1, 'Getting Started with SQL', 'SQL is a powerful language for managing databases...', TRUE),
    (2, 1, 'Advanced Query Techniques', 'In this post we explore JOINs, subqueries, and more...', TRUE),
    (3, 2, 'Database Design Best Practices', 'Good database design starts with normalization...', FALSE);

INSERT INTO comments (id, post_id, user_id, content) VALUES
    (1, 1, 2, 'Great introduction! Very helpful.'),
    (2, 1, 3, 'Thanks for sharing this tutorial.'),
    (3, 2, 3, 'Looking forward to more advanced topics!');
