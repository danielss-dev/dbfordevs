-- Sample tables for testing dbfordevs

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS posts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT,
    published BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS comments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    post_id INT NOT NULL,
    user_id INT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Insert sample data
INSERT INTO users (email, name) VALUES
    ('alice@example.com', 'Alice Johnson'),
    ('bob@example.com', 'Bob Smith'),
    ('carol@example.com', 'Carol Williams');

INSERT INTO posts (user_id, title, content, published) VALUES
    (1, 'Getting Started with SQL', 'SQL is a powerful language for managing databases...', TRUE),
    (1, 'Advanced Query Techniques', 'In this post we explore JOINs, subqueries, and more...', TRUE),
    (2, 'Database Design Best Practices', 'Good database design starts with normalization...', FALSE);

INSERT INTO comments (post_id, user_id, content) VALUES
    (1, 2, 'Great introduction! Very helpful.'),
    (1, 3, 'Thanks for sharing this tutorial.'),
    (2, 3, 'Looking forward to more advanced topics!');
