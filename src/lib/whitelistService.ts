import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';

const BUCKET = process.env.WHITELIST_S3_BUCKET || process.env.S3_BUCKET_NAME || 'ayryx-pilot';
const KEY = process.env.WHITELIST_S3_KEY || 'config/pilot-whitelist.json';
const CACHE_TTL_MS = 30 * 1000;

interface WhitelistData {
  emails: string[];
  pending: { email: string; requestedAt: string }[];
}

let s3Client: S3Client | null = null;
let cache: { data: WhitelistData; at: number } | null = null;

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

function normalize(email: string): string {
  return email.toLowerCase().trim();
}

function defaultData(): WhitelistData {
  const envList = process.env.EMAIL_WHITELIST?.toLowerCase().split(',').map((e) => e.trim()).filter(Boolean) ?? [];
  return { emails: [...new Set(envList)], pending: [] };
}

export async function getWhitelist(): Promise<WhitelistData> {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_TTL_MS) return cache.data;

  const client = getClient();
  if (!client) return defaultData();

  try {
    const res = await client.send(new GetObjectCommand({ Bucket: BUCKET, Key: KEY }));
    const body = await res.Body?.transformToString();
    if (body) {
      const data = JSON.parse(body) as WhitelistData;
      const emails = (data.emails ?? []).map(normalize).filter(Boolean);
      const pending = (data.pending ?? []).map((p) => ({
        email: normalize(p.email),
        requestedAt: p.requestedAt || new Date().toISOString(),
      }));
      const parsed: WhitelistData = { emails: [...new Set(emails)], pending };
      cache = { data: parsed, at: now };
      return parsed;
    }
  } catch (err: unknown) {
    if ((err as { name?: string })?.name !== 'NoSuchKey') {
      console.error('[whitelist] S3 read error:', err);
    }
  }

  const data = defaultData();
  cache = { data, at: now };
  if (data.emails.length > 0) {
    saveWhitelist(data).catch(() => {});
  }
  return data;
}

export async function saveWhitelist(data: WhitelistData): Promise<void> {
  const client = getClient();
  if (!client) throw new Error('S3 not configured');

  const body = JSON.stringify(data, null, 2);
  await client.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: KEY,
    Body: body,
    ContentType: 'application/json',
  }));
  cache = { data, at: Date.now() };
}

export async function isEmailWhitelisted(email: string): Promise<boolean> {
  const { emails } = await getWhitelist();
  return emails.includes(normalize(email));
}

export async function addToWhitelist(email: string): Promise<void> {
  const data = await getWhitelist();
  const n = normalize(email);
  if (data.emails.includes(n)) return;
  data.emails.push(n);
  data.emails.sort();
  await saveWhitelist(data);
}

export async function removeFromWhitelist(email: string): Promise<void> {
  const data = await getWhitelist();
  const n = normalize(email);
  data.emails = data.emails.filter((e) => e !== n);
  data.pending = data.pending.filter((p) => p.email !== n);
  await saveWhitelist(data);
}

export async function addPendingRequest(email: string): Promise<{ added: boolean; alreadyPending: boolean }> {
  const data = await getWhitelist();
  const n = normalize(email);
  if (data.emails.includes(n)) return { added: false, alreadyPending: false };
  const existing = data.pending.find((p) => p.email === n);
  if (existing) return { added: false, alreadyPending: true };
  data.pending.push({ email: n, requestedAt: new Date().toISOString() });
  await saveWhitelist(data);
  return { added: true, alreadyPending: false };
}

export async function approvePending(email: string): Promise<boolean> {
  const data = await getWhitelist();
  const n = normalize(email);
  if (data.emails.includes(n)) return true;
  data.emails.push(n);
  data.emails.sort();
  data.pending = data.pending.filter((p) => p.email !== n);
  await saveWhitelist(data);
  return true;
}

export async function denyPending(email: string): Promise<void> {
  const data = await getWhitelist();
  const n = normalize(email);
  data.pending = data.pending.filter((p) => p.email !== n);
  await saveWhitelist(data);
}
