# Oracle Wallet Setup Script for Windows
# This script creates an Oracle Wallet with real credential files for testing
#
# Prerequisites:
# - Docker must be running
#
# Usage: .\setup-wallet.ps1

$ErrorActionPreference = "Stop"

Write-Host "Oracle Wallet Test Environment Setup" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan

# Configuration
$WALLET_DIR = "$PSScriptRoot\wallet"
$INIT_DIR = "$PSScriptRoot\init"
$WALLET_PASSWORD = "WalletPass123"
$DB_USER = "walletuser"
$DB_PASSWORD = "walletpass"
$DB_HOST = "localhost"
$DB_PORT = "1522"
$DB_SERVICE = "FREEPDB1"
$TNS_ALIAS = "ORACLE_WALLET_TEST"

# Create directories
Write-Host "`nCreating directories..." -ForegroundColor Yellow
if (Test-Path $WALLET_DIR) {
    Remove-Item -Recurse -Force $WALLET_DIR
}
New-Item -ItemType Directory -Force -Path $WALLET_DIR | Out-Null
New-Item -ItemType Directory -Force -Path $INIT_DIR | Out-Null

# Create tnsnames.ora
Write-Host "Creating tnsnames.ora..." -ForegroundColor Yellow
$tnsnames = @"
# TNS Names for Oracle Wallet Test
# Connection aliases for the test database

$TNS_ALIAS =
  (DESCRIPTION =
    (ADDRESS = (PROTOCOL = TCP)(HOST = $DB_HOST)(PORT = $DB_PORT))
    (CONNECT_DATA =
      (SERVER = DEDICATED)
      (SERVICE_NAME = $DB_SERVICE)
    )
  )

ORACLE_WALLET_TEST_HIGH =
  (DESCRIPTION =
    (ADDRESS = (PROTOCOL = TCP)(HOST = $DB_HOST)(PORT = $DB_PORT))
    (CONNECT_DATA =
      (SERVER = DEDICATED)
      (SERVICE_NAME = $DB_SERVICE)
    )
  )
"@
$tnsnames | Out-File -FilePath "$WALLET_DIR\tnsnames.ora" -Encoding ASCII -NoNewline

# Create sqlnet.ora for local client use
Write-Host "Creating sqlnet.ora..." -ForegroundColor Yellow
$sqlnet = @"
# SQL*Net Configuration for Oracle Wallet

WALLET_LOCATION =
  (SOURCE =
    (METHOD = FILE)
    (METHOD_DATA =
      (DIRECTORY = $($WALLET_DIR -replace '\\', '/'))
    )
  )

SQLNET.WALLET_OVERRIDE = TRUE
SSL_CLIENT_AUTHENTICATION = FALSE
"@
$sqlnet | Out-File -FilePath "$WALLET_DIR\sqlnet.ora" -Encoding ASCII -NoNewline

# Create init script for database
Write-Host "Creating database init script..." -ForegroundColor Yellow
$initScript = @"
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
"@
$initScript | Out-File -FilePath "$INIT_DIR\01-sample-data.sql" -Encoding ASCII -NoNewline

# Generate actual wallet files using Oracle container
Write-Host "`nGenerating Oracle Wallet files using Docker..." -ForegroundColor Yellow
Write-Host "This uses the full Oracle image which includes mkstore utility." -ForegroundColor Gray

# Create wallet generation script
$walletScript = @"
#!/bin/bash
set -e

WALLET_DIR=/wallet
WALLET_PWD="$WALLET_PASSWORD"
DB_USER="$DB_USER"
DB_PWD="$DB_PASSWORD"
TNS_ALIAS="$TNS_ALIAS"

echo "=== Creating Oracle Wallet ==="
echo "Wallet directory: `$WALLET_DIR"
echo "TNS Alias: `$TNS_ALIAS"
echo "User: `$DB_USER"

cd `$WALLET_DIR

# Check if mkstore is available
if ! command -v mkstore &> /dev/null; then
    echo "ERROR: mkstore not found in this image"
    echo "Trying orapki..."

    if command -v orapki &> /dev/null; then
        echo "Using orapki to create wallet..."
        echo "`$WALLET_PWD" | orapki wallet create -wallet `$WALLET_DIR -pwd `$WALLET_PWD -auto_login
        echo "Wallet created. Note: orapki cannot store DB credentials."
        echo "You may need to use mkstore separately to add credentials."
    else
        echo "ERROR: Neither mkstore nor orapki found."
        echo "Creating placeholder files for documentation..."
        touch `$WALLET_DIR/WALLET_NOT_CREATED.txt
        echo "Wallet tools not available in this Oracle image." > `$WALLET_DIR/WALLET_NOT_CREATED.txt
        exit 1
    fi
else
    echo "Using mkstore to create wallet..."

    # Create the wallet
    echo "Creating wallet..."
    mkstore -wrl `$WALLET_DIR -create <<EOF
`$WALLET_PWD
`$WALLET_PWD
EOF

    # Store credentials for the TNS alias
    echo "Storing credentials for `$TNS_ALIAS..."
    mkstore -wrl `$WALLET_DIR -createCredential `$TNS_ALIAS `$DB_USER `$DB_PWD <<EOF
`$WALLET_PWD
EOF

    # Create auto-login (SSO) wallet
    echo "Creating auto-login wallet (cwallet.sso)..."
    mkstore -wrl `$WALLET_DIR -createSSO <<EOF
`$WALLET_PWD
EOF

    echo ""
    echo "=== Wallet created successfully ==="
fi

# List wallet contents
echo ""
echo "Wallet files:"
ls -la `$WALLET_DIR/

# Verify wallet
echo ""
echo "Wallet credentials:"
mkstore -wrl `$WALLET_DIR -listCredential <<EOF
`$WALLET_PWD
EOF

echo ""
echo "=== Done ==="
"@

$walletScript | Out-File -FilePath "$PSScriptRoot\create-wallet-temp.sh" -Encoding ASCII -NoNewline

# Run Oracle container to create wallet
# Using the regular image (not slim) which has mkstore
Write-Host "Running Oracle container to create wallet..." -ForegroundColor Gray

try {
    $output = docker run --rm `
        -v "${WALLET_DIR}:/wallet" `
        -v "${PSScriptRoot}/create-wallet-temp.sh:/create-wallet.sh" `
        gvenzl/oracle-free:23 `
        bash /create-wallet.sh 2>&1

    Write-Host $output
    Write-Host "`nWallet creation completed!" -ForegroundColor Green
}
catch {
    Write-Host "Error creating wallet: $_" -ForegroundColor Red
    Write-Host "You may need to create the wallet manually." -ForegroundColor Yellow
}

# Clean up temp script
Remove-Item -Path "$PSScriptRoot\create-wallet-temp.sh" -ErrorAction SilentlyContinue

# Verify wallet files exist
Write-Host "`nVerifying wallet files..." -ForegroundColor Yellow
$requiredFiles = @("cwallet.sso", "ewallet.p12")
$missingFiles = @()

foreach ($file in $requiredFiles) {
    if (Test-Path "$WALLET_DIR\$file") {
        Write-Host "  [OK] $file" -ForegroundColor Green
    } else {
        Write-Host "  [MISSING] $file" -ForegroundColor Red
        $missingFiles += $file
    }
}

if ($missingFiles.Count -gt 0) {
    Write-Host "`nWARNING: Some wallet files are missing!" -ForegroundColor Yellow
    Write-Host "The wallet may not work for auto-login authentication." -ForegroundColor Yellow
    Write-Host "See README.md for manual wallet creation instructions." -ForegroundColor Yellow
}

# Summary
Write-Host "`n=====================================" -ForegroundColor Cyan
Write-Host "Setup Complete!" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Wallet directory: $WALLET_DIR" -ForegroundColor White
Write-Host ""
Write-Host "Files created:" -ForegroundColor Yellow
Get-ChildItem -Path $WALLET_DIR -Name | ForEach-Object { Write-Host "  - $_" }
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Start Oracle container: docker-compose up -d oracle-wallet"
Write-Host "  2. Wait for Oracle to start (~90 seconds)"
Write-Host "  3. Test connection in dbfordevs"
Write-Host ""
Write-Host "Connection settings in dbfordevs:" -ForegroundColor Yellow
Write-Host "  Database Type: Oracle"
Write-Host "  Host: localhost"
Write-Host "  Port: 1522"
Write-Host "  Service Name: FREEPDB1"
Write-Host "  Wallet Tab:"
Write-Host "    - Enable 'Use Oracle Wallet for authentication'"
Write-Host "    - Wallet Path: $WALLET_DIR"
Write-Host "    - TNS Alias: $TNS_ALIAS (or leave empty)"
Write-Host "    - Enable 'Use auto-login wallet'"
Write-Host ""
Write-Host "Standard connection (without wallet) for comparison:" -ForegroundColor Yellow
Write-Host "  Port: 1523"
Write-Host "  User: testuser / testuser"
Write-Host ""
