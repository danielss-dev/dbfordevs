# Oracle Wallet Test Environment for dbfordevs

This directory contains Docker configurations to test Oracle Wallet-based authentication.

## What is Oracle Wallet?

Oracle Wallet is a secure container for storing authentication credentials and certificates. It's commonly used for:

- **Autonomous Database (ATP/ADW)** - Oracle Cloud databases require wallet for connections
- **Secure credential storage** - No passwords in connection strings
- **SSL/TLS connections** - Encrypted database communications
- **Enterprise authentication** - Centralized credential management

## Quick Start

### Windows (PowerShell)

```powershell
cd docker/oracle-wallet-test
.\setup-wallet.ps1
docker-compose up -d
```

### Linux/macOS

```bash
cd docker/oracle-wallet-test
chmod +x setup-wallet.sh
./setup-wallet.sh
docker-compose up -d
```

**Note:** Oracle takes longer to start (~90 seconds). Check status with:
```bash
docker-compose logs -f oracle-wallet
```

## Available Containers

| Container | Port | Description | Credentials |
|-----------|------|-------------|-------------|
| dbfordevs-oracle-wallet | 1522 | Oracle with wallet support | walletuser / walletpass |
| dbfordevs-oracle-standard | 1523 | Standard Oracle (no wallet) | testuser / testuser |

## Testing with dbfordevs

### Test 1: Standard Connection (Baseline)

1. Open dbfordevs
2. Click "Add Connection"
3. Select **Oracle**
4. Enter:
   - **Host:** localhost
   - **Port:** 1523
   - **Service Name:** FREEPDB1
   - **Username:** testuser
   - **Password:** testuser
5. Click "Test Connection"

### Test 2: Wallet Connection with Auto-Login

1. Open dbfordevs
2. Click "Add Connection"
3. Select **Oracle**
4. Enter:
   - **Host:** localhost
   - **Port:** 1522
   - **Service Name:** FREEPDB1
5. Go to **Wallet** tab
6. Enable "Use Oracle Wallet for authentication"
7. Set **Wallet Path** to: `<project>/docker/oracle-wallet-test/wallet`
8. Enable "Use auto-login wallet (cwallet.sso)"
9. Click "Test Connection"

### Test 3: Wallet with TNS Alias

1. Open dbfordevs
2. Click "Add Connection"
3. Select **Oracle**
4. Go to **Wallet** tab
5. Enable "Use Oracle Wallet for authentication"
6. Set **Wallet Path** to: `<project>/docker/oracle-wallet-test/wallet`
7. Set **TNS Alias** to: `ORACLE_WALLET_TEST`
8. Enable "Use auto-login wallet"
9. Click "Test Connection"

## Wallet Directory Structure

After running the setup script:

```
wallet/
├── cwallet.sso           # Auto-login wallet (SSO)
├── ewallet.p12           # PKCS#12 wallet file
├── tnsnames.ora          # TNS connection aliases
├── sqlnet.ora            # SQL*Net configuration
└── sqlnet_local.ora      # Local client configuration
```

## Manual Wallet Creation

If the setup script can't create wallet files automatically (Oracle tools not found), you can create them manually:

### Option 1: Using Oracle Instant Client

If you have Oracle Instant Client installed with `mkstore`:

```bash
# Create wallet
mkstore -wrl ./wallet -create

# Add credentials (when prompted for password)
mkstore -wrl ./wallet -createCredential ORACLE_WALLET_TEST walletuser walletpass

# Create auto-login wallet
mkstore -wrl ./wallet -createSSO
```

### Option 2: Using Oracle Cloud (ATP/ADW)

For testing with Oracle Autonomous Database:

1. Log into Oracle Cloud Console
2. Navigate to your ATP/ADW instance
3. Click "DB Connection"
4. Download the Instance Wallet
5. Extract to `./wallet` directory
6. Update `tnsnames.ora` with your service names

### Option 3: Using Full Oracle Installation

If you have Oracle Database installed:

```bash
# Using orapki
orapki wallet create -wallet ./wallet -pwd WalletPass123 -auto_login

# Using SQL*Plus to add credentials
# (credentials are stored in sqlnet.ora)
```

## Configuration Files

### tnsnames.ora

Defines connection aliases:

```
ORACLE_WALLET_TEST =
  (DESCRIPTION =
    (ADDRESS = (PROTOCOL = TCP)(HOST = localhost)(PORT = 1522))
    (CONNECT_DATA =
      (SERVER = DEDICATED)
      (SERVICE_NAME = FREEPDB1)
    )
  )
```

### sqlnet.ora

Configures wallet location:

```
WALLET_LOCATION =
  (SOURCE =
    (METHOD = FILE)
    (METHOD_DATA =
      (DIRECTORY = /path/to/wallet)
    )
  )

SQLNET.WALLET_OVERRIDE = TRUE
```

## Environment Variables

When using wallet, set these environment variables:

```bash
# Point to wallet directory
export TNS_ADMIN=/path/to/wallet

# Optional: Oracle Instant Client location
export ORACLE_HOME=/path/to/instantclient
export LD_LIBRARY_PATH=$ORACLE_HOME:$LD_LIBRARY_PATH
```

On Windows (PowerShell):
```powershell
$env:TNS_ADMIN = "C:\path\to\wallet"
```

## Troubleshooting

### Container not starting

Oracle containers require significant memory. Ensure Docker has at least 4GB RAM allocated.

```bash
# Check container logs
docker-compose logs oracle-wallet

# Check container status
docker-compose ps
```

### "ORA-28759: failure to open file"

Wallet files not found or wrong permissions:

```bash
# Check wallet files exist
ls -la wallet/

# Fix permissions (Linux/macOS)
chmod 600 wallet/*
```

### "ORA-28368: cannot auto-create wallet"

Auto-login wallet (cwallet.sso) not present:

1. Ensure `cwallet.sso` exists in wallet directory
2. Check `sqlnet.ora` has correct `WALLET_LOCATION`
3. Verify TNS_ADMIN environment variable is set

### "ORA-12154: TNS:could not resolve the connect identifier"

TNS alias not found:

1. Check `tnsnames.ora` exists in wallet directory
2. Verify TNS_ADMIN points to wallet directory
3. Ensure alias name matches exactly (case-sensitive)

### DPI-1047: Cannot locate Oracle Client library

Oracle Instant Client not installed or not in PATH:

1. Download Oracle Instant Client from Oracle website
2. Extract to a directory
3. Add to system PATH
4. Restart dbfordevs

## Sample Data

The test database includes:

**users** table:
| id | email | name |
|----|-------|------|
| 1 | wallet@example.com | Wallet Test User |
| 2 | admin@example.com | Admin User |

**products** table:
| id | name | price | stock |
|----|------|-------|-------|
| 1 | Test Product 1 | 29.99 | 100 |
| 2 | Test Product 2 | 49.99 | 50 |
| 3 | Test Product 3 | 99.99 | 25 |

## Stopping Containers

```bash
docker-compose down
```

To remove volumes and start fresh:

```bash
docker-compose down -v
```

## Additional Resources

- [Oracle Wallet Documentation](https://docs.oracle.com/en/database/oracle/oracle-database/23/dbseg/configuring-authentication.html)
- [Oracle Instant Client Downloads](https://www.oracle.com/database/technologies/instant-client.html)
- [Oracle Cloud Wallet Documentation](https://docs.oracle.com/en-us/iaas/Content/Database/Tasks/adbconnecting.htm)
