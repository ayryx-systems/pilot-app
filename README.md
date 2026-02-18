# AYRYX Pilot App

Aviation situational awareness dashboard for pilots, providing real-time airport information, aircraft tracking, and weather data.

## Overview

The Pilot App is a Next.js application that connects to the AYRYX core backend to provide pilots with:
- Real-time airport operations and traffic
- Aircraft tracking with ground traces
- Weather information and trends
- Airport infrastructure visualization (runways, taxiways, terminals)

## Quick Start

### Local Development

1. Install dependencies:
```bash
npm install
```

2. Configure environment (create `.env.local`):
```
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001
NEXT_PUBLIC_PILOT_APP_URL=http://localhost:3006
EMAIL_WHITELIST=you@example.com
RESEND_API_KEY=re_xxx
SESSION_SECRET=<32+ chars>
ADMIN_EMAILS=admin@example.com
APPROVER_EMAILS=admin@example.com
WHITELIST_S3_BUCKET=ayryx-pilot
```

3. Start the development server:
```bash
npm run dev
```

4. Access the app:
```
http://localhost:3006
```

## Access Control

Magic link with S3-backed whitelist:
- Pilots enter email → whitelisted users get sign-in link; others can request access
- Requests trigger approval emails; one-click approve adds to whitelist
- Admin at `/admin` for whitelist management (add/remove, approve/deny pending)
- Session cookie lasts 30 days

## Environment Variables

### Required
- `NEXT_PUBLIC_API_BASE_URL` - Backend API URL
- `NEXT_PUBLIC_PILOT_APP_URL` - App URL for magic links
- `EMAIL_WHITELIST` - Initial whitelist (used if S3 empty; seeded to S3 on first run)
- `RESEND_API_KEY` - Resend API key
- `SESSION_SECRET` - Session signing secret (min 32 chars)
- `ADMIN_EMAILS` - Comma-separated emails that can access `/admin`
- `APPROVER_EMAILS` - Emails notified when someone requests access
- `WHITELIST_S3_BUCKET` - S3 bucket for whitelist JSON

### AWS (for S3)
- `AWS_REGION` - Default us-east-1
- `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` - Or use IAM role on EC2

**IAM policy** for whitelist S3 access (EC2 role or credentials):
```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["s3:GetObject", "s3:PutObject"],
    "Resource": ["arn:aws:s3:::ayryx-pilot/*"]
  }]
}
```

### Optional
- `RESEND_FROM_DOMAIN` - From address domain (default: mail.ayryx.com)
- `WHITELIST_S3_KEY` - S3 key (default: config/pilot-whitelist.json)

## Production Deployment

The app is deployed on AWS EC2 and served via nginx:
- URL: `https://pilot.ayryx.com` (and `https://ein.ayryx.com` for multi-airline)
- Nginx config: `deployment/nginx/ayryx-pilot.conf` — copy to `/etc/nginx/conf.d/` on the Pilot App EC2
- CloudFlare for DNS and SSL
- Process managed by PM2: `pm2 start npm --name pilot-app -- start`

## Building

```bash
npm run build
npm start
```

## Tech Stack

- Next.js 15
- React 18
- TypeScript
- Tailwind CSS
- Leaflet for maps
- Socket.IO for real-time updates
