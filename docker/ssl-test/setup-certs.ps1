# SSL Certificate Generator for dbfordevs testing
# Run this script before starting the Docker containers
#
# Prerequisites: OpenSSL must be installed
#   - Install via: winget install ShiningLight.OpenSSL
#   - Or download from: https://slproweb.com/products/Win32OpenSSL.html

$ErrorActionPreference = "Stop"

Write-Host "SSL Certificate Generator for dbfordevs" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if OpenSSL is available
try {
    $opensslVersion = openssl version 2>&1
    Write-Host "Found: $opensslVersion" -ForegroundColor Green
} catch {
    Write-Host "ERROR: OpenSSL is not installed or not in PATH" -ForegroundColor Red
    Write-Host "Install via: winget install ShiningLight.OpenSSL" -ForegroundColor Yellow
    Write-Host "Or download from: https://slproweb.com/products/Win32OpenSSL.html" -ForegroundColor Yellow
    exit 1
}

# Create certs directory
$certsDir = Join-Path $PSScriptRoot "certs"
if (-not (Test-Path $certsDir)) {
    New-Item -ItemType Directory -Path $certsDir | Out-Null
}

Write-Host ""
Write-Host "Generating certificates in: $certsDir" -ForegroundColor Yellow
Write-Host ""

# ============================================
# PostgreSQL Certificates
# ============================================
Write-Host "[1/2] Generating PostgreSQL certificates..." -ForegroundColor Cyan

$env:OPENSSL_CONF = ""  # Prevent config warnings
& openssl req -new -x509 -days 365 -nodes -text `
    -out "$certsDir\pg-server.crt" `
    -keyout "$certsDir\pg-server.key" `
    -subj "/CN=localhost/O=dbfordevs/C=US" 2>$null

if (Test-Path "$certsDir\pg-server.crt") {
    Write-Host "      pg-server.crt - Server certificate" -ForegroundColor Green
    Write-Host "      pg-server.key - Server private key" -ForegroundColor Green
} else {
    Write-Host "      Failed to generate PostgreSQL certificates" -ForegroundColor Red
    exit 1
}

# ============================================
# MySQL/MariaDB Certificates
# ============================================
Write-Host "[2/2] Generating MySQL/MariaDB certificates..." -ForegroundColor Cyan

# Generate CA
& openssl genrsa -out "$certsDir\mysql-ca-key.pem" 2048 2>$null
& openssl req -new -x509 -nodes -days 365 `
    -key "$certsDir\mysql-ca-key.pem" `
    -out "$certsDir\mysql-ca.pem" `
    -subj "/CN=MySQL-CA/O=dbfordevs/C=US" 2>$null

# Generate Server certificate
& openssl req -newkey rsa:2048 -nodes `
    -keyout "$certsDir\mysql-server-key.pem" `
    -out "$certsDir\mysql-server-req.pem" `
    -subj "/CN=localhost/O=dbfordevs/C=US" 2>$null

& openssl x509 -req -in "$certsDir\mysql-server-req.pem" -days 365 `
    -CA "$certsDir\mysql-ca.pem" `
    -CAkey "$certsDir\mysql-ca-key.pem" `
    -CAcreateserial `
    -out "$certsDir\mysql-server-cert.pem" 2>$null

if (Test-Path "$certsDir\mysql-server-cert.pem") {
    Write-Host "      mysql-ca.pem          - CA certificate" -ForegroundColor Green
    Write-Host "      mysql-server-cert.pem - Server certificate" -ForegroundColor Green
    Write-Host "      mysql-server-key.pem  - Server private key" -ForegroundColor Green
} else {
    Write-Host "      Failed to generate MySQL certificates" -ForegroundColor Red
    exit 1
}

# Clean up intermediate files
Remove-Item "$certsDir\mysql-server-req.pem" -ErrorAction SilentlyContinue
Remove-Item "$certsDir\mysql-ca.srl" -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Certificate generation complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Start containers: docker-compose up -d" -ForegroundColor White
Write-Host "  2. Wait for containers to be healthy" -ForegroundColor White
Write-Host "  3. Test connections in dbfordevs" -ForegroundColor White
Write-Host ""
Write-Host "Test Connection Settings:" -ForegroundColor Cyan
Write-Host "-------------------------" -ForegroundColor Cyan
Write-Host ""
Write-Host "PostgreSQL (SSL):" -ForegroundColor Yellow
Write-Host "  Host: localhost, Port: 5433" -ForegroundColor White
Write-Host "  User: postgres, Password: postgres" -ForegroundColor White
Write-Host "  Database: testdb" -ForegroundColor White
Write-Host "  SSL Mode: require (or verify-ca with CA cert)" -ForegroundColor White
Write-Host "  CA Cert: $certsDir\pg-server.crt" -ForegroundColor Gray
Write-Host ""
Write-Host "PostgreSQL (No SSL):" -ForegroundColor Yellow
Write-Host "  Host: localhost, Port: 5432" -ForegroundColor White
Write-Host "  User: postgres, Password: postgres" -ForegroundColor White
Write-Host "  Database: testdb" -ForegroundColor White
Write-Host "  SSL Mode: disable" -ForegroundColor White
Write-Host ""
Write-Host "MySQL (SSL):" -ForegroundColor Yellow
Write-Host "  Host: localhost, Port: 3307" -ForegroundColor White
Write-Host "  User: root, Password: mysql" -ForegroundColor White
Write-Host "  Database: testdb" -ForegroundColor White
Write-Host "  SSL Mode: require (or verify-ca with CA cert)" -ForegroundColor White
Write-Host "  CA Cert: $certsDir\mysql-ca.pem" -ForegroundColor Gray
Write-Host ""
Write-Host "MySQL (No SSL):" -ForegroundColor Yellow
Write-Host "  Host: localhost, Port: 3306" -ForegroundColor White
Write-Host "  User: root, Password: mysql" -ForegroundColor White
Write-Host "  Database: testdb" -ForegroundColor White
Write-Host "  SSL Mode: disable" -ForegroundColor White
Write-Host ""
Write-Host "MariaDB (SSL):" -ForegroundColor Yellow
Write-Host "  Host: localhost, Port: 3308" -ForegroundColor White
Write-Host "  User: root, Password: mariadb" -ForegroundColor White
Write-Host "  Database: testdb" -ForegroundColor White
Write-Host "  SSL Mode: require" -ForegroundColor White
Write-Host ""
Write-Host "MSSQL:" -ForegroundColor Yellow
Write-Host "  Host: localhost, Port: 1433" -ForegroundColor White
Write-Host "  User: sa, Password: YourStrong@Passw0rd123" -ForegroundColor White
Write-Host "  Database: master" -ForegroundColor White
Write-Host "  SSL Mode: require (uses TLS by default)" -ForegroundColor White
Write-Host ""
