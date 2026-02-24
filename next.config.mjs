import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const buildIdPath = join(process.cwd(), '.build-id.json');
const buildId = existsSync(buildIdPath)
  ? JSON.parse(readFileSync(buildIdPath, 'utf8')).buildId
  : Date.now().toString();

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001',
    NEXT_PUBLIC_APP_BUILD_ID: buildId,
  },
  // Enable React Strict Mode
  reactStrictMode: true,

  // Skip ESLint during builds for deployment (warnings as errors in production)
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Skip TypeScript checking during builds for deployment
  typescript: {
    ignoreBuildErrors: true,
  },



  // Configure images
  images: {
    formats: ['image/webp', 'image/avif'],
  },

  // Enable compression
  compress: true,

  // Disable x-powered-by header
  poweredByHeader: false,


};

export default nextConfig;
