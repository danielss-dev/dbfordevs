# SSL/TLS Test Environment for dbfordevs

This directory contains Docker configurations to test SSL/TLS database connections.

## Quick Start

### Windows (PowerShell)

```powershell
cd docker/ssl-test
.\setup-certs.ps1
docker-compose up -d
```

### Linux/macOS

```bash
cd docker/ssl-test
chmod +x setup-certs.sh
./setup-certs.sh
docker-compose up -d
```

## Available Containers

| Container | Database | Port | SSL | Credentials |
|-----------|----------|------|-----|-------------|
| dbfordevs-postgres-ssl | PostgreSQL 16 | 5433 | Yes | postgres / postgres |
| dbfordevs-postgres-nossl | PostgreSQL 16 | 5432 | No | postgres / postgres |
| dbfordevs-mysql-ssl | MySQL 8 | 3307 | Yes | root / mysql |
| dbfordevs-mysql-nossl | MySQL 8 | 3306 | No | root / mysql |
| dbfordevs-mariadb-ssl | MariaDB 11 | 3308 | Yes | root / mariadb |
| dbfordevs-mssql | SQL Server 2022 | 1433 | Yes* | sa / YourStrong@Passw0rd123 |

*MSSQL uses encryption by default

## Test Scenarios

### 1. SSL Disabled (Baseline)
Connect to the non-SSL containers to verify connections work without encryption.

- PostgreSQL: `localhost:5432`, SSL Mode: `disable`
- MySQL: `localhost:3306`, SSL Mode: `disable`

### 2. SSL Required
Connect to SSL containers with `require` mode - connection will be encrypted but won't verify the server certificate.

- PostgreSQL: `localhost:5433`, SSL Mode: `require`
- MySQL: `localhost:3307`, SSL Mode: `require`

### 3. SSL Verify CA
Connect with certificate verification using the generated CA certificates.

- PostgreSQL: `localhost:5433`, SSL Mode: `verify-ca`, CA Cert: `certs/pg-server.crt`
- MySQL: `localhost:3307`, SSL Mode: `verify-ca`, CA Cert: `certs/mysql-ca.pem`

### 4. MSSQL Encryption
MSSQL uses `Encrypt=true` by default. Test with:

- MSSQL: `localhost:1433`, SSL Mode: `require`

## Certificate Files

After running the setup script, the `certs/` directory contains:

```
certs/
├── pg-server.crt        # PostgreSQL server certificate
├── pg-server.key        # PostgreSQL server private key
├── mysql-ca.pem         # MySQL CA certificate (use this for verify-ca)
├── mysql-ca-key.pem     # MySQL CA private key
├── mysql-server-cert.pem # MySQL server certificate
└── mysql-server-key.pem  # MySQL server private key
```

## Testing with dbfordevs

1. Open dbfordevs
2. Click "Add Connection"
3. Select database type (PostgreSQL, MySQL, etc.)
4. Enter connection details from the table above
5. Go to the **SSL** tab
6. Configure SSL mode and certificates
7. Click **"Test SSL/TLS Connection"** to verify

## Stopping Containers

```bash
docker-compose down
```

To remove volumes and start fresh:

```bash
docker-compose down -v
```

## Troubleshooting

### Containers not starting
Check if ports are already in use:
```bash
netstat -an | findstr "5432 5433 3306 3307 3308 1433"
```

### Permission denied on key files
PostgreSQL requires key files to have restricted permissions. The setup script handles this, but if you regenerate manually:
```bash
chmod 600 certs/pg-server.key
```

### MSSQL password policy
MSSQL requires strong passwords. The default password `YourStrong@Passw0rd123` meets the requirements.
