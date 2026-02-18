import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';

const BUCKET = process.env.WHITELIST_S3_BUCKET || process.env.S3_BUCKET_NAME || 'ayryx-pilot';
const CACHE_TTL_MS = 30 * 1000;

interface WhitelistData {
  emails: string[];
  pending: { email: string; requestedAt: string }[];
}

const cache = new Map<string, { data: WhitelistData; at: number }>();
let s3Client: S3Client | null = null;

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

function getKey(airline: string): string {
  return `config/${airline}/whitelist.json`;
}

function normalize(email: string): string {
  return email.toLowerCase().trim();
}

function defaultData(airline: string): WhitelistData {
  const envKey = `EMAIL_WHITELIST_${airline.toUpperCase()}`;
  const envList = process.env[envKey]?.toLowerCase().split(',').map((e) => e.trim()).filter(Boolean)
    ?? process.env.EMAIL_WHITELIST?.toLowerCase().split(',').map((e) => e.trim()).filter(Boolean)
    ?? [];
  return { emails: [...new Set(envList)], pending: [] };
}

export async function getWhitelist(airline: string): Promise<WhitelistData> {
  const now = Date.now();
  const cached = cache.get(airline);
  if (cached && now - cached.at < CACHE_TTL_MS) return cached.data;

  const client = getClient();
  if (!client) return defaultData(airline);

  try {
    const res = await client.send(new GetObjectCommand({ Bucket: BUCKET, Key: getKey(airline) }));
    const body = await res.Body?.transformToString();
    if (body) {
      const data = JSON.parse(body) as WhitelistData;
      const emails = (data.emails ?? []).map(normalize).filter(Boolean);
      const pending = (data.pending ?? []).map((p) => ({
        email: normalize(p.email),
        requestedAt: p.requestedAt || new Date().toISOString(),
      }));
      const parsed: WhitelistData = { emails: [...new Set(emails)], pending };
      cache.set(airline, { data: parsed, at: now });
      return parsed;
    }
  } catch (err: unknown) {
    if ((err as { name?: string })?.name !== 'NoSuchKey') {
      console.error('[whitelist] S3 read error:', err);
    }
  }

  const data = defaultData(airline);
  cache.set(airline, { data, at: now });
  if (data.emails.length > 0) {
    saveWhitelist(airline, data).catch(() => {});
  }
  return data;
}

export async function saveWhitelist(airline: string, data: WhitelistData): Promise<void> {
  const client = getClient();
  if (!client) throw new Error('S3 not configured');

  const body = JSON.stringify(data, null, 2);
  await client.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: getKey(airline),
    Body: body,
    ContentType: 'application/json',
  }));
  cache.set(airline, { data, at: Date.now() });
}

export async function isEmailWhitelisted(airline: string, email: string): Promise<boolean> {
  const { emails } = await getWhitelist(airline);
  return emails.includes(normalize(email));
}

export async function addToWhitelist(airline: string, email: string): Promise<void> {
  const data = await getWhitelist(airline);
  const n = normalize(email);
  if (data.emails.includes(n)) return;
  data.emails.push(n);
  data.emails.sort();
  await saveWhitelist(airline, data);
}

export async function removeFromWhitelist(airline: string, email: string): Promise<void> {
  const data = await getWhitelist(airline);
  const n = normalize(email);
  data.emails = data.emails.filter((e) => e !== n);
  data.pending = data.pending.filter((p) => p.email !== n);
  await saveWhitelist(airline, data);
}

export async function addPendingRequest(airline: string, email: string): Promise<{ added: boolean; alreadyPending: boolean }> {
  const data = await getWhitelist(airline);
  const n = normalize(email);
  if (data.emails.includes(n)) return { added: false, alreadyPending: false };
  const existing = data.pending.find((p) => p.email === n);
  if (existing) return { added: false, alreadyPending: true };
  data.pending.push({ email: n, requestedAt: new Date().toISOString() });
  await saveWhitelist(airline, data);
  return { added: true, alreadyPending: false };
}

export async function approvePending(airline: string, email: string): Promise<boolean> {
  const data = await getWhitelist(airline);
  const n = normalize(email);
  if (data.emails.includes(n)) return true;
  data.emails.push(n);
  data.emails.sort();
  data.pending = data.pending.filter((p) => p.email !== n);
  await saveWhitelist(airline, data);
  return true;
}

export async function denyPending(airline: string, email: string): Promise<void> {
  const data = await getWhitelist(airline);
  const n = normalize(email);
  data.pending = data.pending.filter((p) => p.email !== n);
  await saveWhitelist(airline, data);
}
