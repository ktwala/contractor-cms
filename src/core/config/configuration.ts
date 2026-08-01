export default () => ({
  port: parseInt(process.env.PORT || '3000', 10),
  database: {
    url: process.env.DATABASE_URL,
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'change-this-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  },
  cors: {
    origins: process.env.CORS_ORIGINS || '*',
  },
  encryption: {
    key: process.env.ENCRYPTION_KEY || 'change-this-32-char-encryption-key',
  },
  storage: {
    type: process.env.STORAGE_TYPE || 'local',
    localPath: process.env.STORAGE_LOCAL_PATH || './storage',
    s3: {
      bucket: process.env.S3_BUCKET,
      region: process.env.S3_REGION,
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    },
  },
  sentry: {
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
  },
  countryPacks: {
    lesotho: {
      version: '1.0.0',
    },
    southAfrica: {
      version: '1.0.0',
    },
  },
  /** Payslip logo URL (absolute or relative). Used by both schedule and legacy templates. */
  payslip: {
    logoUrl: process.env.PAYSLIP_LOGO_URL || '',
  },
});
