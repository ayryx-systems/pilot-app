import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

const BUCKET = process.env.WHITELIST_S3_BUCKET || process.env.S3_BUCKET_NAME || 'ayryx-pilot-config';
const AIRLINES_KEY = 'config/airlines.json';
const CACHE_TTL_MS = 60 * 1000;

export interface AirlineConfig {
  adminEmails: string[];
  approverEmails: string[];
  features?: Record<string, boolean>;
  logo?: string;
  name?: string;
}

let s3Client: S3Client | null = null;
let configCache: { data: Record<string, AirlineConfig>; at: number } | null = null;

function getClient(): S3Client | null {
  if (s3Client) return s3Client;
  const region = process.env.AWS_REGION || 'us-west-1';
  const config: { region: string; credentials?: object } = { region };
  if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
    config.credentials = {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      ...(process.env.AWS_SESSION_TOKEN && { sessionToken: process.env.AWS_SESSION_TOKEN }),
    };
  }
  s3Client = new S3Client(config);
  return s3Client;
}

export class S3ConfigError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'S3ConfigError';
  }
}

export async function getAirlineConfig(airline: string): Promise<AirlineConfig> {
  const now = Date.now();
  if (configCache && now - configCache.at < CACHE_TTL_MS && configCache.data[airline]) {
    return configCache.data[airline];
  }

  const client = getClient();
  if (!client) {
    throw new S3ConfigError('S3 not configured: missing AWS credentials');
  }

  try {
    const res = await client.send(new GetObjectCommand({ Bucket: BUCKET, Key: AIRLINES_KEY }));
    const body = await res.Body?.transformToString();
    if (body) {
      const data = JSON.parse(body) as Record<string, AirlineConfig>;
      configCache = { data, at: now };
      const cfg = data[airline];
      if (cfg) {
        return {
          adminEmails: Array.isArray(cfg.adminEmails) ? cfg.adminEmails : [],
          approverEmails: Array.isArray(cfg.approverEmails) ? cfg.approverEmails : [],
          features: cfg.features ?? {},
          logo: cfg.logo,
          name: cfg.name,
        };
      }
    }
    throw new S3ConfigError(`Airline "${airline}" not found in config`);
  } catch (err: unknown) {
    if (err instanceof S3ConfigError) throw err;
    console.error('[airlineConfig] S3 read error:', err);
    throw new S3ConfigError('Failed to load airline config from S3', err);
  }
}

export async function getValidAirlines(): Promise<string[]> {
  const client = getClient();
  if (!client) throw new S3ConfigError('S3 not configured: missing AWS credentials');

  try {
    const res = await client.send(new GetObjectCommand({ Bucket: BUCKET, Key: AIRLINES_KEY }));
    const body = await res.Body?.transformToString();
    if (body) {
      const data = JSON.parse(body) as Record<string, unknown>;
      return Object.keys(data);
    }
    return [];
  } catch (err: unknown) {
    if (err instanceof S3ConfigError) throw err;
    console.error('[airlineConfig] S3 read error:', err);
    throw new S3ConfigError('Failed to load airlines list from S3', err);
  }
}
