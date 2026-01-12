-- Sample tables for testing dbfordevs (Oracle PL/SQL)

-- Create users table
CREATE TABLE users (
    id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email VARCHAR2(255) NOT NULL UNIQUE,
    name VARCHAR2(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create posts table
CREATE TABLE posts (
    id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id NUMBER NOT NULL,
    title VARCHAR2(255) NOT NULL,
    content CLOB,
    published NUMBER(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_posts_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create comments table
CREATE TABLE comments (
    id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    post_id NUMBER NOT NULL,
    user_id NUMBER NOT NULL,
    content CLOB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_comments_post FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    CONSTRAINT fk_comments_user FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Insert sample data
INSERT INTO users (email, name) VALUES ('alice@example.com', 'Alice Johnson');
INSERT INTO users (email, name) VALUES ('bob@example.com', 'Bob Smith');
INSERT INTO users (email, name) VALUES ('carol@example.com', 'Carol Williams');

INSERT INTO posts (user_id, title, content, published) VALUES (1, 'Getting Started with SQL', 'SQL is a powerful language for managing databases...', 1);
INSERT INTO posts (user_id, title, content, published) VALUES (1, 'Advanced Query Techniques', 'In this post we explore JOINs, subqueries, and more...', 1);
INSERT INTO posts (user_id, title, content, published) VALUES (2, 'Database Design Best Practices', 'Good database design starts with normalization...', 0);

INSERT INTO comments (post_id, user_id, content) VALUES (1, 2, 'Great introduction! Very helpful.');
INSERT INTO comments (post_id, user_id, content) VALUES (1, 3, 'Thanks for sharing this tutorial.');
INSERT INTO comments (post_id, user_id, content) VALUES (2, 3, 'Looking forward to more advanced topics!');

COMMIT;

EXIT;
