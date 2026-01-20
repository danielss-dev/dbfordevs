# SSL/TLS Connection Testing

dbfordevs includes built-in SSL/TLS connection testing to help you verify secure database connections. This feature allows you to test encryption settings, view protocol details, and troubleshoot SSL configuration issues.

## Overview

The SSL/TLS testing feature provides:

- Connection security verification
- Protocol version detection (TLS 1.2, TLS 1.3, etc.)
- Cipher suite information
- Certificate details (when available)
- Database-specific SSL support information

## Supported Databases

| Database | SSL Support | CA Certificate | Client Certificate | Notes |
|----------|-------------|----------------|-------------------|-------|
| PostgreSQL | Full | Yes | Yes | Complete SSL/TLS with certificate verification |
| MySQL | Full | Yes | Yes | Complete SSL/TLS with certificate verification |
| MariaDB | Full | Yes | Yes | Uses MySQL protocol |
| CockroachDB | Full | Yes | Yes | Uses PostgreSQL protocol |
| MSSQL | Partial | No | No | Encryption toggle only (`Encrypt=true/false`) |
| SQLite | N/A | N/A | N/A | Local file-based, SSL not applicable |
| Oracle | Not implemented | - | - | Use Oracle Wallet for secure connections |
| Redis | Not implemented | - | - | Consider using stunnel |
| MongoDB | Partial | - | - | Configure via connection string (`?tls=true`) |
| Cassandra | Not implemented | - | - | - |

## Using the SSL Test Feature

### Step 1: Configure SSL Settings

1. Open the **Connection Modal** (Add or Edit a connection)
2. Navigate to the **SSL** tab
3. Select an SSL mode:
   - **Disable**: No encryption
   - **Prefer**: Use SSL if available, fall back to unencrypted
   - **Require**: Require SSL, but don't verify certificate
   - **Verify CA**: Require SSL and verify server certificate against CA
   - **Verify Full**: Verify certificate and hostname match

### Step 2: Configure Certificates (Optional)

For `verify-ca` and `verify-full` modes, you may need to provide certificates:

- **CA Certificate**: Path to the Certificate Authority certificate file (`.pem`, `.crt`, `.cer`)
- **Client Certificate**: Path to client certificate for mutual TLS (optional)
- **Client Key**: Path to client private key for mutual TLS (optional)

### Step 3: Run SSL Test

1. Click the **"Test SSL/TLS Connection"** button in the SSL tab
2. The test dialog will appear and automatically run the test
3. Review the results:
   - Connection status (success/failure)
   - SSL enabled state
   - Protocol version (e.g., TLSv1.3)
   - Cipher suite (e.g., ECDHE-RSA-AES256-GCM-SHA384)
   - Server version
   - Database-specific SSL support notes

### Step 4: Interpret Results

**Successful SSL Connection:**
- Shows "Secure Connection" with green shield icon
- Displays protocol version and cipher suite
- Shows "SSL Enabled" badge

**Successful Connection (No SSL):**
- Shows "Unencrypted Connection" with yellow icon
- Shows "SSL Disabled" badge
- Connection works but data is not encrypted

**Failed Connection:**
- Shows error message with details
- Common SSL errors include certificate verification failures, protocol mismatches, or missing certificates

## SSL Modes Explained

### Disable
No SSL/TLS encryption. Data is transmitted in plain text. Use only for local development or trusted networks.

### Prefer
Attempts SSL first, falls back to unencrypted if SSL is not available. Provides opportunistic encryption.

### Require
Requires SSL connection but does not verify the server's certificate. Protects against passive eavesdropping but not active man-in-the-middle attacks.

### Verify CA
Requires SSL and verifies that the server's certificate is signed by a trusted Certificate Authority. You must provide the CA certificate file. Protects against both passive and active attacks.

### Verify Full
Most secure option. Requires SSL, verifies the CA, and also verifies that the server hostname matches the certificate. Recommended for production environments.

## Database-Specific Notes

### PostgreSQL / CockroachDB

PostgreSQL provides detailed SSL information through the `pg_stat_ssl` system view:

```sql
SELECT ssl, version, cipher, bits
FROM pg_stat_ssl
WHERE pid = pg_backend_pid();
```

The test retrieves:
- SSL enabled status
- TLS protocol version
- Cipher name and bit strength

### MySQL / MariaDB

MySQL provides SSL status through server status variables:

```sql
SHOW STATUS LIKE 'Ssl_%';
```

The test retrieves:
- `Ssl_version`: TLS protocol version
- `Ssl_cipher`: Active cipher suite

### MSSQL

SQL Server uses connection string parameters for encryption:

- `Encrypt=true/false`: Enable/disable encryption
- `TrustServerCertificate=true/false`: Trust self-signed certificates

The actual TLS details are determined by the connection configuration rather than queried from the server.

## Testing with Docker

A Docker test environment is provided for testing SSL connections locally.

### Setup

```bash
cd docker/ssl-test

# Generate certificates (Windows)
.\setup-certs.ps1

# Generate certificates (Linux/Mac)
./setup-certs.sh

# Start containers
docker-compose up -d
```

### Available Test Containers

| Container | Port | SSL | Credentials |
|-----------|------|-----|-------------|
| PostgreSQL (SSL) | 5433 | Yes | postgres / postgres |
| PostgreSQL (No SSL) | 5432 | No | postgres / postgres |
| MySQL (SSL) | 3307 | Yes | root / mysql |
| MySQL (No SSL) | 3306 | No | root / mysql |
| MariaDB (SSL) | 3308 | Yes | root / mariadb |
| MSSQL | 1433 | Yes | sa / YourStrong@Passw0rd123 |

### Test Scenarios

1. **Baseline (No SSL)**: Connect to non-SSL containers with SSL mode `disable`
2. **SSL Required**: Connect to SSL containers with SSL mode `require`
3. **Certificate Verification**: Use `verify-ca` with the generated CA certificates:
   - PostgreSQL: `docker/ssl-test/certs/pg-server.crt`
   - MySQL: `docker/ssl-test/certs/mysql-ca.pem`

## Troubleshooting

### "Certificate verify failed"

**Cause**: The CA certificate doesn't match the server certificate, or the certificate has expired.

**Solutions**:
- Ensure you're using the correct CA certificate file
- Check certificate expiration dates
- For self-signed certificates, use `require` mode instead of `verify-ca`

### "SSL connection required but server does not support it"

**Cause**: The database server is not configured for SSL.

**Solutions**:
- Verify SSL is enabled on the server
- Check server configuration files
- Use `prefer` or `disable` mode for non-SSL servers

### "Handshake failed"

**Cause**: Protocol or cipher mismatch between client and server.

**Solutions**:
- Ensure the server supports modern TLS versions (TLS 1.2+)
- Check for firewall or proxy interference
- Review server SSL configuration

### "Permission denied" on certificate files

**Cause**: Certificate files have incorrect permissions.

**Solutions**:
- PostgreSQL requires key files to be readable only by owner: `chmod 600 server.key`
- Ensure the application has read access to certificate files

### MSSQL "Login failed"

**Cause**: MSSQL has strict password requirements and may reject connections.

**Solutions**:
- Ensure password meets complexity requirements (uppercase, lowercase, numbers, special characters)
- Check that `TrustServerCertificate=true` is set for self-signed certificates

## Security Recommendations

1. **Production environments**: Always use `verify-ca` or `verify-full` mode
2. **Certificate management**: Rotate certificates before expiration
3. **Protocol versions**: Ensure TLS 1.2 or higher is used
4. **Cipher suites**: Prefer strong ciphers (AES-256-GCM, ChaCha20-Poly1305)
5. **Client certificates**: Use mutual TLS for high-security environments
6. **Key protection**: Store private keys securely with restricted permissions

## API Reference

### Backend Commands (Rust)

```rust
// Test SSL connection
#[tauri::command]
pub async fn test_ssl_connection(config: ConnectionConfig) -> Result<SslTestResult, AppError>

// Get SSL support information
#[tauri::command]
pub fn get_ssl_support_info() -> Vec<SslSupportInfo>
```

### Frontend Hooks (TypeScript)

```typescript
const { testSslConnection, getSslSupportInfo } = useDatabase();

// Test SSL connection
const result: SslTestResult = await testSslConnection(config);

// Get SSL support info for all databases
const supportInfo: SslSupportInfo[] = await getSslSupportInfo();
```

### Types

```typescript
interface SslTestResult {
  success: boolean;
  message: string;
  sslEnabled: boolean;
  sslMode?: string;
  protocolVersion?: string;
  cipherSuite?: string;
  certificateInfo?: CertificateInfo;
  serverVersion?: string;
  supportsSsl: boolean;
  databaseType: string;
}

interface SslSupportInfo {
  databaseType: string;
  supportsSsl: boolean;
  supportsCaCert: boolean;
  supportsClientCert: boolean;
  notes: string;
}

interface CertificateInfo {
  subject?: string;
  issuer?: string;
  validFrom?: string;
  validUntil?: string;
  serialNumber?: string;
}
```

## Related Files

- `src/components/connections/SslTestDialog.tsx` - SSL test UI component
- `src/components/connections/ConnectionModal.tsx` - Connection form with SSL tab
- `src-tauri/src/commands/connections.rs` - Backend SSL test commands
- `src-tauri/src/models/connection.rs` - SSL-related type definitions
- `docker/ssl-test/` - Docker test environment
