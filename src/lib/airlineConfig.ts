import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

const BUCKET = process.env.WHITELIST_S3_BUCKET || process.env.S3_BUCKET_NAME || 'ayryx-pilot';
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
  const region = process.env.AWS_REGION || 'us-east-1';
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

function envFallback(airline: string): AirlineConfig {
  const adminKey = `ADMIN_EMAILS_${airline.toUpperCase()}`;
  const approverKey = `APPROVER_EMAILS_${airline.toUpperCase()}`;
  const admins = process.env[adminKey]?.toLowerCase().split(',').map((e) => e.trim()).filter(Boolean) ?? process.env.ADMIN_EMAILS?.toLowerCase().split(',').map((e) => e.trim()).filter(Boolean) ?? [];
  const approvers = process.env[approverKey]?.toLowerCase().split(',').map((e) => e.trim()).filter(Boolean) ?? process.env.APPROVER_EMAILS?.toLowerCase().split(',').map((e) => e.trim()).filter(Boolean) ?? [];
  return { adminEmails: admins, approverEmails: approvers };
}

export async function getAirlineConfig(airline: string): Promise<AirlineConfig> {
  const now = Date.now();
  if (configCache && now - configCache.at < CACHE_TTL_MS && configCache.data[airline]) {
    return configCache.data[airline];
  }

  const client = getClient();
  if (!client) return envFallback(airline);

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
  } catch (err: unknown) {
    if ((err as { name?: string })?.name !== 'NoSuchKey') {
      console.error('[airlineConfig] S3 read error:', err);
    }
  }

  return envFallback(airline);
}

export async function getValidAirlines(): Promise<string[]> {
  const client = getClient();
  if (!client) return [process.env.DEFAULT_AIRLINE ?? 'ein'].filter(Boolean);

  try {
    const res = await client.send(new GetObjectCommand({ Bucket: BUCKET, Key: AIRLINES_KEY }));
    const body = await res.Body?.transformToString();
    if (body) {
      const data = JSON.parse(body) as Record<string, unknown>;
      return Object.keys(data);
    }
  } catch {
    // ignore
  }

  return [process.env.DEFAULT_AIRLINE ?? 'ein'].filter(Boolean);
}
