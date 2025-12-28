-- Create testdb database if it doesn't exist
IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = 'testdb')
BEGIN
    CREATE DATABASE testdb;
END
GO

USE testdb;
GO

-- Sample tables for testing dbfordevs (MSSQL/T-SQL)

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'users')
BEGIN
    CREATE TABLE users (
        id INT IDENTITY(1,1) PRIMARY KEY,
        email NVARCHAR(255) NOT NULL UNIQUE,
        name NVARCHAR(100) NOT NULL,
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME DEFAULT GETDATE()
    );
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'posts')
BEGIN
    CREATE TABLE posts (
        id INT IDENTITY(1,1) PRIMARY KEY,
        user_id INT NOT NULL,
        title NVARCHAR(255) NOT NULL,
        content NVARCHAR(MAX),
        published BIT DEFAULT 0,
        created_at DATETIME DEFAULT GETDATE(),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'comments')
BEGIN
    CREATE TABLE comments (
        id INT IDENTITY(1,1) PRIMARY KEY,
        post_id INT NOT NULL,
        user_id INT NOT NULL,
        content NVARCHAR(MAX) NOT NULL,
        created_at DATETIME DEFAULT GETDATE(),
        FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id)
    );
END
GO

-- Insert sample data (only if tables are empty)
IF NOT EXISTS (SELECT * FROM users)
BEGIN
    INSERT INTO users (email, name) VALUES
        ('alice@example.com', 'Alice Johnson'),
        ('bob@example.com', 'Bob Smith'),
        ('carol@example.com', 'Carol Williams');
END
GO

IF NOT EXISTS (SELECT * FROM posts)
BEGIN
    INSERT INTO posts (user_id, title, content, published) VALUES
        (1, 'Getting Started with SQL', 'SQL is a powerful language for managing databases...', 1),
        (1, 'Advanced Query Techniques', 'In this post we explore JOINs, subqueries, and more...', 1),
        (2, 'Database Design Best Practices', 'Good database design starts with normalization...', 0);
END
GO

IF NOT EXISTS (SELECT * FROM comments)
BEGIN
    INSERT INTO comments (post_id, user_id, content) VALUES
        (1, 2, 'Great introduction! Very helpful.'),
        (1, 3, 'Thanks for sharing this tutorial.'),
        (2, 3, 'Looking forward to more advanced topics!');
END
GO

PRINT 'Sample data initialized successfully!';
GO
