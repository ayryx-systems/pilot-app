# Multi-Airline Setup (ein.ayryx.com)

Subdomain-based multi-tenancy allows one email to be admin for multiple airlines. Each airline has its own whitelist and config.

## DNS

- Add A record: `ein` → same IP as `pilot` (52.52.150.29)
- See `core/deployment/nginx/README.md` for nginx config (add ein.ayryx.com to pilot-ec2)

## S3 Structure

Bucket: `ayryx-pilot` (or `WHITELIST_S3_BUCKET` / `S3_BUCKET_NAME`)

```
config/
  airlines.json      # Per-airline config
  ein/
    whitelist.json    # Whitelist for Aer Lingus
```

### config/airlines.json

```json
{
  "ein": {
    "adminEmails": ["you@ayryx.com"],
    "approverEmails": ["approver@airline.com"],
    "features": {},
    "logo": "/logos/ein.svg",
    "name": "Aer Lingus"
  }
}
```

- `adminEmails`: Can manage whitelist at `/admin`
- `approverEmails`: Receive and can approve access requests
- `features`: Per-airline feature flags (e.g. `weatherRadar: true`)
- `logo`, `name`: Branding for the client

### config/ein/whitelist.json

Migrate from the legacy `config/pilot-whitelist.json` if it existed:

```json
{
  "emails": ["pilot@airline.com"],
  "pending": []
}
```

## Env Fallbacks

When S3 is not configured or keys are missing, env vars are used:

- `ADMIN_EMAILS_EIN`, `APPROVER_EMAILS_EIN`, `EMAIL_WHITELIST_EIN`
- `DEFAULT_AIRLINE` (default: `ein`)

## Local Development

- `http://localhost:3006?airline=ein` — use ein config
- `http://localhost:3006` — uses `DEFAULT_AIRLINE`

## One Email, Multiple Airlines

Add your super-user email to `adminEmails` in multiple airline entries in `airlines.json`. You can then log in at `ein.ayryx.com` and `ual.ayryx.com` (etc.) with the same email and manage each airline’s whitelist independently.

Session cookies use domain `.ayryx.com`, so one sign-in works across all `*.ayryx.com` subdomains.

## Migrating from pilot-whitelist.json

If you had `config/pilot-whitelist.json`:

```bash
aws s3 cp s3://ayryx-pilot/config/pilot-whitelist.json /tmp/old.json
# Edit to ensure valid JSON, then:
aws s3 cp /tmp/old.json s3://ayryx-pilot/config/ein/whitelist.json
```

## Uploading Config (AWS CLI)

```bash
aws s3 cp config/airlines.json.example s3://ayryx-pilot/config/airlines.json
# Edit airlines.json with real emails, then upload
```
