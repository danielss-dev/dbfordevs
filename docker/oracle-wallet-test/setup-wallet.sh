#!/bin/bash
# Oracle Wallet Setup Script for Linux/macOS
# This script creates an Oracle Wallet for testing wallet-based authentication
#
# Prerequisites:
# - Docker must be running
# - Oracle Instant Client installed (optional, for manual wallet creation)
#
# Usage: ./setup-wallet.sh

set -e

echo "Oracle Wallet Test Environment Setup"
echo "====================================="

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Configuration
WALLET_DIR="$SCRIPT_DIR/wallet"
INIT_DIR="$SCRIPT_DIR/init"
WALLET_PASSWORD="WalletPass123"
DB_USER="walletuser"
DB_PASSWORD="walletpass"
DB_HOST="oracle-wallet"
DB_PORT="1521"
DB_SERVICE="FREEPDB1"

# Create directories
echo ""
echo "Creating directories..."
mkdir -p "$WALLET_DIR"
mkdir -p "$INIT_DIR"

# Create tnsnames.ora
echo "Creating tnsnames.ora..."
cat > "$WALLET_DIR/tnsnames.ora" << EOF
# TNS Names for Oracle Wallet Test
# This file defines connection aliases for the test database

ORACLE_WALLET_TEST =
  (DESCRIPTION =
    (ADDRESS = (PROTOCOL = TCP)(HOST = localhost)(PORT = 1522))
    (CONNECT_DATA =
      (SERVER = DEDICATED)
      (SERVICE_NAME = $DB_SERVICE)
    )
  )

ORACLE_WALLET_TEST_HIGH =
  (DESCRIPTION =
    (ADDRESS = (PROTOCOL = TCP)(HOST = localhost)(PORT = 1522))
    (CONNECT_DATA =
      (SERVER = DEDICATED)
      (SERVICE_NAME = $DB_SERVICE)
    )
  )

# For use inside Docker network
ORACLE_WALLET_INTERNAL =
  (DESCRIPTION =
    (ADDRESS = (PROTOCOL = TCP)(HOST = $DB_HOST)(PORT = $DB_PORT))
    (CONNECT_DATA =
      (SERVER = DEDICATED)
      (SERVICE_NAME = $DB_SERVICE)
    )
  )
EOF

# Create sqlnet.ora
echo "Creating sqlnet.ora..."
cat > "$WALLET_DIR/sqlnet.ora" << EOF
# SQL*Net Configuration for Oracle Wallet
# This file configures the wallet location and authentication method

WALLET_LOCATION =
  (SOURCE =
    (METHOD = FILE)
    (METHOD_DATA =
      (DIRECTORY = /opt/oracle/wallet)
    )
  )

SQLNET.WALLET_OVERRIDE = TRUE
SSL_CLIENT_AUTHENTICATION = FALSE
EOF

# Create a local sqlnet.ora for client use
cat > "$WALLET_DIR/sqlnet_local.ora" << EOF
# SQL*Net Configuration for Oracle Wallet (Local Client)
# Copy this to your wallet directory or set TNS_ADMIN to point here

WALLET_LOCATION =
  (SOURCE =
    (METHOD = FILE)
    (METHOD_DATA =
      (DIRECTORY = $WALLET_DIR)
    )
  )

SQLNET.WALLET_OVERRIDE = TRUE
SSL_CLIENT_AUTHENTICATION = FALSE
EOF

# Create init script for database
echo "Creating database init script..."
cat > "$INIT_DIR/01-sample-data.sql" << 'EOF'
-- Oracle Wallet Test - Sample Data
-- This script runs when the container starts

-- Create sample tables
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

-- Insert sample data
INSERT INTO users (email, name) VALUES ('wallet@example.com', 'Wallet Test User');
INSERT INTO users (email, name) VALUES ('admin@example.com', 'Admin User');

INSERT INTO products (name, price, stock) VALUES ('Test Product 1', 29.99, 100);
INSERT INTO products (name, price, stock) VALUES ('Test Product 2', 49.99, 50);
INSERT INTO products (name, price, stock) VALUES ('Test Product 3', 99.99, 25);

COMMIT;
EXIT;
EOF

# Generate wallet using Docker container with Oracle tools
echo ""
echo "Generating Oracle Wallet files..."
echo "Using Docker container to create wallet..."

# Create a script to generate wallet inside container
cat > "$SCRIPT_DIR/create-wallet-temp.sh" << 'WALLETSCRIPT'
#!/bin/bash
set -e

WALLET_DIR=/wallet
WALLET_PWD='WalletPass123'
DB_USER='walletuser'
DB_PWD='walletpass'
TNS_ALIAS='ORACLE_WALLET_TEST'

echo "Creating Oracle Wallet..."

# Create wallet directory
mkdir -p $WALLET_DIR

# Check for Oracle wallet tools
if command -v mkstore &> /dev/null; then
    echo "Using mkstore to create wallet..."

    # Create wallet
    echo -e "$WALLET_PWD\n$WALLET_PWD" | mkstore -wrl $WALLET_DIR -create

    # Add credentials
    echo "$WALLET_PWD" | mkstore -wrl $WALLET_DIR -createCredential $TNS_ALIAS $DB_USER $DB_PWD

    # Create auto-login wallet
    echo "$WALLET_PWD" | mkstore -wrl $WALLET_DIR -createSSO

    echo "Wallet created successfully with mkstore!"

elif command -v orapki &> /dev/null; then
    echo "Using orapki to create wallet..."

    # Create wallet
    orapki wallet create -wallet $WALLET_DIR -pwd $WALLET_PWD -auto_login

    echo "Wallet created with orapki. Add credentials manually."
else
    echo "Oracle wallet tools not found. Creating placeholder structure..."
    echo "You'll need to create the actual wallet files manually."

    # Create placeholder files
    touch $WALLET_DIR/cwallet.sso.placeholder
    touch $WALLET_DIR/ewallet.p12.placeholder

    echo "Placeholder files created. See README for manual setup instructions."
fi

# Set permissions
chmod 600 $WALLET_DIR/* 2>/dev/null || true

echo "Wallet setup complete!"
ls -la $WALLET_DIR/
WALLETSCRIPT

chmod +x "$SCRIPT_DIR/create-wallet-temp.sh"

# Try to create wallet using Oracle container
echo "Attempting to create wallet using Oracle container..."
if docker run --rm \
    -v "$WALLET_DIR:/wallet" \
    -v "$SCRIPT_DIR/create-wallet-temp.sh:/create-wallet.sh" \
    gvenzl/oracle-free:23-slim \
    bash /create-wallet.sh 2>&1; then
    echo "Wallet creation completed!"
else
    echo ""
    echo "Could not create wallet automatically."
    echo "This is normal - Oracle wallet tools may not be in the slim image."
    echo "See README.md for manual wallet creation instructions."
fi

# Clean up temp script
rm -f "$SCRIPT_DIR/create-wallet-temp.sh"

# Set permissions on wallet files
chmod 600 "$WALLET_DIR"/* 2>/dev/null || true

# Summary
echo ""
echo "====================================="
echo "Setup Complete!"
echo "====================================="
echo ""
echo "Wallet directory: $WALLET_DIR"
echo ""
echo "Files created:"
ls -1 "$WALLET_DIR" | sed 's/^/  - /'
echo ""
echo "Next steps:"
echo "  1. Start containers: docker-compose up -d"
echo "  2. Wait for Oracle to start (~90 seconds)"
echo "  3. Test connection in dbfordevs using wallet"
echo ""
echo "Connection details:"
echo "  Host: localhost"
echo "  Port: 1522"
echo "  Service: FREEPDB1"
echo "  Wallet Path: $WALLET_DIR"
echo "  TNS Alias: ORACLE_WALLET_TEST"
echo ""
echo "Standard connection (without wallet):"
echo "  Host: localhost"
echo "  Port: 1523"
echo "  User: testuser / testuser"
echo ""
