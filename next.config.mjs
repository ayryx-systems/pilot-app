/** @type {import('next').NextConfig} */
const nextConfig = {
  // Environment variables for runtime configuration
  env: {
    // Default to localhost for development, but can be overridden
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001',
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
