import { NextRequest, NextResponse } from 'next/server';
import { getWhitelist, S3WhitelistError } from '@/lib/whitelistService';
import { getAirlineConfig, S3ConfigError } from '@/lib/airlineConfig';
import { getAirline } from '@/lib/getAirline';

const EIN_PRIORITY_DOMAIN = 'aerlingus.com';
const DEFAULT_DOMAINS = ['aerlingus.com', 'ayryx.com'];

function extractDomainsFromEmails(emails: string[]): string[] {
  const domains = new Set<string>();
  for (const email of emails) {
    const at = email.indexOf('@');
    if (at > 0 && at < email.length - 1) {
      domains.add(email.slice(at + 1).toLowerCase());
    }
  }
  return Array.from(domains);
}

function sortDomains(domains: string[]): string[] {
  const priority = domains.filter((d) => d === EIN_PRIORITY_DOMAIN);
  const rest = domains.filter((d) => d !== EIN_PRIORITY_DOMAIN).sort();
  return [...priority, ...rest];
}

export async function GET(request: NextRequest) {
  const airline = getAirline(request);
  if (airline !== 'ein') {
    return NextResponse.json({ domains: [] });
  }

  try {
    const [whitelist, config] = await Promise.all([
      getWhitelist('ein'),
      getAirlineConfig('ein').catch(() => null),
    ]);
    const emails = [
      ...(whitelist.emails ?? []),
      ...(config?.adminEmails ?? []),
    ];
    const raw = extractDomainsFromEmails(emails);
    const domains = sortDomains(raw);
    if (domains.length === 0) {
      return NextResponse.json({ domains: DEFAULT_DOMAINS });
    }
    return NextResponse.json({ domains });
  } catch (err) {
    if (err instanceof S3WhitelistError || err instanceof S3ConfigError) {
      return NextResponse.json({ domains: DEFAULT_DOMAINS });
    }
    throw err;
  }
}
