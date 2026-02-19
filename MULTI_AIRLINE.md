# Multi-Airline Setup (ein.ayryx.com)

Subdomain-based multi-tenancy allows one email to be admin for multiple airlines. Each airline has its own whitelist and config.

## DNS

- Add A record: `ein` → same IP as `pilot` (52.52.150.29)
- See `pilot-app/deployment/nginx/README.md` for nginx config on Pilot App EC2

## S3 Structure

Bucket: `ayryx-pilot-config` (or `WHITELIST_S3_BUCKET` / `S3_BUCKET_NAME`) in **us-west-1** (matches EC2 and other buckets)

```
config/
  airlines.json      # Per-airline config
  ein/
    whitelist.json    # Whitelist for Aer Lingus
```

### Quick setup

```bash
cd pilot-app
./scripts/setup-s3-whitelist.sh
```

This script uploads `config/airlines.json` from the example if missing, migrates `config/pilot-whitelist.json` → `config/ein/whitelist.json` if the old file exists, or creates empty `config/ein/whitelist.json` otherwise.

### config/airlines.json

| Field | Purpose |
|-------|---------|
| `adminEmails` | Can manage whitelist at `/admin` |
| `approverEmails` | Receive and can approve access requests |
| `features` | Per-airline feature flags |
| `logo`, `name` | Branding for the client |

Templates: `config/airlines.json.example`, `config/ein/whitelist.json.example`

### Manual upload (AWS CLI)

```bash
aws s3 cp config/airlines.json.example s3://ayryx-pilot-config/config/airlines.json --region us-west-1
aws s3 cp config/ein/whitelist.json.example s3://ayryx-pilot-config/config/ein/whitelist.json --region us-west-1
```

### Migrating from config/pilot-whitelist.json

```bash
aws s3 cp s3://ayryx-pilot-config/config/pilot-whitelist.json s3://ayryx-pilot-config/config/ein/whitelist.json
# Optional: aws s3 rm s3://ayryx-pilot-config/config/pilot-whitelist.json
```

## S3 Required

S3 must be available with valid credentials. When S3 is unreachable (missing creds, AccessDenied, etc.), requests fail with 503 instead of falling back to env — this avoids serving wrong airline config across tenants.

## Local Development

On localhost, airline is determined by (in order):
1. `?airline=` query param (e.g. `?airline=ein` or `?airline=pilot`)
2. `DEFAULT_AIRLINE` or `NEXT_PUBLIC_DEFAULT_AIRLINE` env var
3. Fallback: `ein`

**Why you see Aer Lingus by default:** The hardcoded fallback is `ein` so that `localhost` and `pilot.ayryx.com` behave consistently (both default to Aer Lingus today).

**Accessing the vanilla app locally:**
- Add `NEXT_PUBLIC_DEFAULT_AIRLINE=pilot` to `.env.local` — then `http://localhost:3006` uses the generic AYRYX config (no Aer Lingus branding)
- Or use `?airline=pilot` in the URL — e.g. `http://localhost:3006?airline=pilot`
- Ensure `pilot` exists in `config/airlines.json` in S3. Add a `pilot` entry (see `config/airlines.json.example`) with generic AYRYX branding — no logo, name: "AYRYX".

## One Email, Multiple Airlines

Add your super-user email to `adminEmails` in multiple airline entries in `airlines.json`. You can then log in at `ein.ayryx.com` and `ual.ayryx.com` (etc.) with the same email and manage each airline’s whitelist independently.

Session cookies use domain `.ayryx.com`, so one sign-in works across all `*.ayryx.com` subdomains.

