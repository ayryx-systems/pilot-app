# Multi-Airline Setup (ein.ayryx.com)

Subdomain-based multi-tenancy allows one email to be admin for multiple airlines. Each airline has its own whitelist and config.

## DNS

- Add A record: `ein` → same IP as `pilot` (52.52.150.29)
- See `pilot-app/deployment/nginx/README.md` for nginx config on Pilot App EC2

## S3 Structure

Bucket: `ayryx-pilot` (or `WHITELIST_S3_BUCKET` / `S3_BUCKET_NAME`)

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
aws s3 cp config/airlines.json.example s3://ayryx-pilot/config/airlines.json
aws s3 cp config/ein/whitelist.json.example s3://ayryx-pilot/config/ein/whitelist.json
```

### Migrating from config/pilot-whitelist.json

```bash
aws s3 cp s3://ayryx-pilot/config/pilot-whitelist.json s3://ayryx-pilot/config/ein/whitelist.json
# Optional: aws s3 rm s3://ayryx-pilot/config/pilot-whitelist.json
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

