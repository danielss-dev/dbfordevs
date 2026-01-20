#!/bin/bash
# SSL Certificate Generator for dbfordevs testing
# Run this script before starting the Docker containers
#
# Usage: ./setup-certs.sh

set -e

echo ""
echo "SSL Certificate Generator for dbfordevs"
echo "========================================"
echo ""

# Check if OpenSSL is available
if ! command -v openssl &> /dev/null; then
    echo "ERROR: OpenSSL is not installed"
    echo "Install via your package manager:"
    echo "  Ubuntu/Debian: sudo apt install openssl"
    echo "  macOS: brew install openssl"
    exit 1
fi

echo "Found: $(openssl version)"
echo ""

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CERTS_DIR="$SCRIPT_DIR/certs"

# Create certs directory
mkdir -p "$CERTS_DIR"

echo "Generating certificates in: $CERTS_DIR"
echo ""

# ============================================
# PostgreSQL Certificates
# ============================================
echo "[1/2] Generating PostgreSQL certificates..."

openssl req -new -x509 -days 365 -nodes -text \
    -out "$CERTS_DIR/pg-server.crt" \
    -keyout "$CERTS_DIR/pg-server.key" \
    -subj "/CN=localhost/O=dbfordevs/C=US" 2>/dev/null

# PostgreSQL requires specific permissions on key file
chmod 600 "$CERTS_DIR/pg-server.key"

echo "      pg-server.crt - Server certificate"
echo "      pg-server.key - Server private key"

# ============================================
# MySQL/MariaDB Certificates
# ============================================
echo "[2/2] Generating MySQL/MariaDB certificates..."

# Generate CA
openssl genrsa -out "$CERTS_DIR/mysql-ca-key.pem" 2048 2>/dev/null
openssl req -new -x509 -nodes -days 365 \
    -key "$CERTS_DIR/mysql-ca-key.pem" \
    -out "$CERTS_DIR/mysql-ca.pem" \
    -subj "/CN=MySQL-CA/O=dbfordevs/C=US" 2>/dev/null

# Generate Server certificate
openssl req -newkey rsa:2048 -nodes \
    -keyout "$CERTS_DIR/mysql-server-key.pem" \
    -out "$CERTS_DIR/mysql-server-req.pem" \
    -subj "/CN=localhost/O=dbfordevs/C=US" 2>/dev/null

openssl x509 -req -in "$CERTS_DIR/mysql-server-req.pem" -days 365 \
    -CA "$CERTS_DIR/mysql-ca.pem" \
    -CAkey "$CERTS_DIR/mysql-ca-key.pem" \
    -CAcreateserial \
    -out "$CERTS_DIR/mysql-server-cert.pem" 2>/dev/null

echo "      mysql-ca.pem          - CA certificate"
echo "      mysql-server-cert.pem - Server certificate"
echo "      mysql-server-key.pem  - Server private key"

# Clean up intermediate files
rm -f "$CERTS_DIR/mysql-server-req.pem"
rm -f "$CERTS_DIR/mysql-ca.srl"

echo ""
echo "========================================"
echo "Certificate generation complete!"
echo ""
echo "Next steps:"
echo "  1. Start containers: docker-compose up -d"
echo "  2. Wait for containers to be healthy"
echo "  3. Test connections in dbfordevs"
echo ""
echo "Test Connection Settings:"
echo "-------------------------"
echo ""
echo "PostgreSQL (SSL):"
echo "  Host: localhost, Port: 5433"
echo "  User: postgres, Password: postgres"
echo "  Database: testdb"
echo "  SSL Mode: require (or verify-ca with CA cert)"
echo "  CA Cert: $CERTS_DIR/pg-server.crt"
echo ""
echo "PostgreSQL (No SSL):"
echo "  Host: localhost, Port: 5432"
echo "  User: postgres, Password: postgres"
echo "  Database: testdb"
echo "  SSL Mode: disable"
echo ""
echo "MySQL (SSL):"
echo "  Host: localhost, Port: 3307"
echo "  User: root, Password: mysql"
echo "  Database: testdb"
echo "  SSL Mode: require (or verify-ca with CA cert)"
echo "  CA Cert: $CERTS_DIR/mysql-ca.pem"
echo ""
echo "MySQL (No SSL):"
echo "  Host: localhost, Port: 3306"
echo "  User: root, Password: mysql"
echo "  Database: testdb"
echo "  SSL Mode: disable"
echo ""
echo "MariaDB (SSL):"
echo "  Host: localhost, Port: 3308"
echo "  User: root, Password: mariadb"
echo "  Database: testdb"
echo "  SSL Mode: require"
echo ""
echo "MSSQL:"
echo "  Host: localhost, Port: 1433"
echo "  User: sa, Password: YourStrong@Passw0rd123"
echo "  Database: master"
echo "  SSL Mode: require (uses TLS by default)"
echo ""
