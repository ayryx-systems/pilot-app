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
ACCESS_CODES=your-access-code-here
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001
```

3. Start the development server:
```bash
npm run dev
```

4. Access the app:
```
http://localhost:3006/your-access-code-here
```

## Access Control

The app uses a simple URL-based access control mechanism:
- Access via: `https://pilot.ayryx.com/<ACCESS_CODE>`
- Valid codes are set in the `ACCESS_CODES` environment variable (comma-separated)
- On first access, a secure cookie is set for 30 days
- Subsequent visits don't require the code in the URL

## Environment Variables

### Required
- `ACCESS_CODES` - Comma-separated list of valid access codes
- `NEXT_PUBLIC_API_BASE_URL` - Backend API URL (e.g., `https://api.ayryx.com`)

## Production Deployment

The app is deployed on AWS EC2 and served via nginx:
- URL: `https://pilot.ayryx.com`
- Uses CloudFlare for DNS and SSL
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
