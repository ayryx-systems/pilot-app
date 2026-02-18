import { NextResponse } from 'next/server';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

const BUCKET = process.env.WHITELIST_S3_BUCKET || process.env.S3_BUCKET_NAME || 'ayryx-pilot';
const AIRLINES_KEY = 'config/airlines.json';

export async function GET() {
  const hasCreds = !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);
  const region = process.env.AWS_REGION || 'us-east-1';
  const config: { region: string; credentials?: object } = { region };
  if (hasCreds) {
    config.credentials = {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      ...(process.env.AWS_SESSION_TOKEN && { sessionToken: process.env.AWS_SESSION_TOKEN }),
    };
  }
  const client = new S3Client(config);
  try {
    const res = await client.send(new GetObjectCommand({ Bucket: BUCKET, Key: AIRLINES_KEY }));
    const body = await res.Body?.transformToString();
    const data = body ? JSON.parse(body) : null;
    const ein = data?.ein;
    return NextResponse.json({
      ok: true,
      bucket: BUCKET,
      key: AIRLINES_KEY,
      hasCreds,
      region,
      einConfig: ein
        ? {
            hasLogo: !!ein.logo,
            logo: ein.logo,
            name: ein.name,
            adminCount: Array.isArray(ein.adminEmails) ? ein.adminEmails.length : 0,
          }
        : null,
    });
  } catch (err: unknown) {
    const e = err as { name?: string; message?: string };
    return NextResponse.json(
      {
        ok: false,
        bucket: BUCKET,
        key: AIRLINES_KEY,
        hasCreds,
        region,
        error: e.name || 'Unknown',
        message: e.message,
      },
      { status: 500 }
    );
  }
}
