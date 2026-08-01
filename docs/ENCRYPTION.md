# Bank Account Encryption Implementation

## Overview

This document describes the implementation of field-level encryption for sensitive data in the payroll platform, specifically bank account numbers.

## Architecture

### Encryption Algorithm
- **Algorithm:** AES-256-GCM (Advanced Encryption Standard, 256-bit key, Galois/Counter Mode)
- **Mode:** GCM provides both confidentiality and authenticity (AEAD - Authenticated Encryption with Associated Data)
- **Key Length:** 256 bits (32 bytes)
- **IV Length:** 128 bits (16 bytes) - randomly generated for each encryption
- **Auth Tag Length:** 128 bits (16 bytes) - provides tampering detection

### Storage Format
Encrypted data is stored in the following format:
```
{iv}:{authTag}:{ciphertext}
```

All components are base64-encoded. Example:
```
abc123...==:def456...==:ghi789...==
```

### Key Management

#### Master Key
- Stored in environment variable: `ENCRYPTION_MASTER_KEY`
- **CRITICAL:** Must be at least 32 characters long
- Generate using: `openssl rand -base64 32`
- **NEVER** commit to version control
- Rotate periodically (recommended: every 90 days)

#### Key Derivation
The actual encryption key is derived from the master key using PBKDF2:
- **Algorithm:** PBKDF2-SHA256
- **Iterations:** 100,000
- **Salt:** Configurable via `ENCRYPTION_SALT` (default: 'payroll-platform-salt-v1')
- **Output:** 256-bit derived key

This approach provides:
- Protection against brute-force attacks
- Consistent key derivation from the master key
- Ability to change salt for additional security layers

## Implementation

### CryptoService

Location: `src/common/services/crypto.service.ts`

#### Methods:

**encrypt(plaintext: string): string**
- Encrypts a plaintext string
- Returns encrypted format: `{iv}:{authTag}:{ciphertext}`
- Throws error if encryption key not initialized

**decrypt(ciphertext: string): string**
- Decrypts an encrypted string
- Validates format and auth tag
- Throws error on tampering or invalid format

**isEncrypted(value: string): boolean**
- Checks if a string is in encrypted format
- Useful for migrating existing data

**getEncryptionStatus(): object**
- Returns encryption configuration status

### Integration Points

#### EffectiveDatedService

**createBankAccount()**
- Automatically encrypts account numbers on creation
- Stores masked version for display (e.g., "****1234")

**getDecryptedAccountNumber()**
- Decrypts account numbers when needed
- **CRITICAL:** Logs all decryption access for audit trail
- Only use for legitimate business needs (e.g., bank file generation)

Example usage:
```typescript
const accountNumber = await this.effectiveDatedService.getDecryptedAccountNumber(
  bankAccountId,
  userId,
  'Generating bank payment file for payrun PR-2024-001'
);
```

## Security Considerations

### What is Protected
✅ Bank account numbers (encrypted)
✅ Authentication tags prevent tampering
✅ Random IVs prevent pattern analysis
✅ Audit logging for all decryption access

### What is NOT Protected
⚠️ Masked account numbers (e.g., "****1234") - stored in plaintext
⚠️ Bank names
⚠️ Branch codes
⚠️ Account types

### Best Practices

1. **Never log decrypted values**
   ```typescript
   // ❌ WRONG
   logger.log(`Account: ${decryptedAccount}`);

   // ✅ CORRECT
   logger.log(`Processing account ${maskedAccount}`);
   ```

2. **Always provide audit reasons**
   ```typescript
   // ❌ WRONG
   getDecryptedAccountNumber(id, userId, 'needed it');

   // ✅ CORRECT
   getDecryptedAccountNumber(id, userId, 'Generating ABSA bank file for payrun PR-2024-001');
   ```

3. **Minimize decryption scope**
   - Only decrypt when absolutely necessary
   - Decrypt as late as possible
   - Clear decrypted values from memory ASAP

4. **Monitor audit logs**
   - Review `DECRYPT_BANK_ACCOUNT` audit events regularly
   - Investigate unexpected decryption patterns

## Deployment

### Environment Setup

1. Generate a strong master key:
   ```bash
   openssl rand -base64 32
   ```

2. Set environment variables:
   ```bash
   export ENCRYPTION_MASTER_KEY="<generated-key>"
   export ENCRYPTION_SALT="payroll-platform-salt-v1"
   ```

3. **IMPORTANT:** Store the master key securely:
   - Use AWS Secrets Manager, Azure Key Vault, or similar
   - Implement key rotation procedures
   - Maintain backup keys in secure offline storage

### Migrating Existing Data

If you have existing bank accounts with plaintext account numbers:

```bash
# Backup database first!
npm run db:encrypt-accounts
```

This script:
- Detects plaintext vs encrypted account numbers
- Encrypts only plaintext values
- Reports progress and errors
- Is idempotent (safe to run multiple times)

### Verification

After deployment, verify encryption is working:

1. Create a test bank account
2. Check database - `account_number_enc` should contain encrypted format
3. Check API response - should only show masked number
4. Verify audit log shows decryption access (if tested)

## Key Rotation

### When to Rotate
- Every 90 days (recommended)
- When key may have been compromised
- When team members with key access leave
- Regulatory compliance requirements

### Rotation Process

1. **Prepare new key:**
   ```bash
   NEW_KEY=$(openssl rand -base64 32)
   echo $NEW_KEY  # Save this securely!
   ```

2. **Create migration script:** (Example in `scripts/rotate-encryption-key.ts`)
   ```typescript
   // Decrypt with old key, encrypt with new key
   for each encrypted_value:
     plaintext = decrypt(value, oldKey)
     newEncrypted = encrypt(plaintext, newKey)
     update database
   ```

3. **Execute rotation:**
   ```bash
   OLD_KEY=$ENCRYPTION_MASTER_KEY \
   NEW_KEY=$NEW_MASTER_KEY \
   npm run db:rotate-keys
   ```

4. **Update environment:**
   ```bash
   export ENCRYPTION_MASTER_KEY="<new-key>"
   ```

5. **Restart application**

6. **Verify:**
   - Test decryption works
   - Check audit logs
   - Monitor for errors

7. **Securely destroy old key** (after verification period)

## Monitoring & Compliance

### Metrics to Track
- Decryption frequency by user
- Failed decryption attempts
- Encryption/decryption performance

### Audit Queries

**Find recent decryptions:**
```sql
SELECT * FROM audit_logs
WHERE action = 'DECRYPT_BANK_ACCOUNT'
ORDER BY created_at DESC
LIMIT 100;
```

**Decryptions by user:**
```sql
SELECT user_id, COUNT(*) as decryption_count
FROM audit_logs
WHERE action = 'DECRYPT_BANK_ACCOUNT'
  AND created_at > NOW() - INTERVAL '30 days'
GROUP BY user_id
ORDER BY decryption_count DESC;
```

### Compliance Notes
- ✅ PCI DSS: Encryption of cardholder data
- ✅ GDPR: Data protection by design
- ✅ POPIA (South Africa): Security safeguards
- ✅ Audit trail for data access

## Troubleshooting

### Error: "Encryption key not initialized"
**Cause:** `ENCRYPTION_MASTER_KEY` not set
**Solution:** Set the environment variable and restart

### Error: "Decryption failed: invalid format"
**Cause:** Data not in correct encrypted format
**Solution:** Run migration script to encrypt existing data

### Error: "Decryption failed: Unsupported state or unable to authenticate data"
**Cause:** Data has been tampered with or wrong decryption key
**Solution:** Verify `ENCRYPTION_MASTER_KEY` is correct, check for data corruption

### Performance Issues
**Symptoms:** Slow bank file generation
**Solutions:**
- Decrypt in batches, not one-by-one
- Use connection pooling
- Consider caching decrypted values temporarily (in memory only!)

## References

- [AES-GCM Specification (NIST)](https://nvlpubs.nist.gov/nistpubs/legacy/sp/nistspecialpublication800-38d.pdf)
- [PBKDF2 Specification (RFC 8018)](https://tools.ietf.org/html/rfc8018)
- [Node.js Crypto Documentation](https://nodejs.org/api/crypto.html)

## Support

For questions or issues:
1. Check this documentation
2. Review audit logs
3. Contact security team
4. Escalate to infrastructure team if key-related

---

**Last Updated:** 2025-12-28
**Version:** 1.0
**Owner:** Security Team
