/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable React Strict Mode
  reactStrictMode: true,

  // PWA-specific headers
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, must-revalidate',
          },
          {
            key: 'Service-Worker-Allowed',
            value: '/',
          },
        ],
      },
      {
        source: '/manifest.json',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=3600', // Cache for 1 hour
          },
        ],
      },
      {
        source: '/offline.html',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000', // Cache for 1 year
          },
        ],
      },
      {
        source: '/icons/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000', // Cache icons for 1 year
          },
        ],
      },
    ];
  },

  // Optimize build output
  output: 'standalone',

  // Configure images for PWA
  images: {
    unoptimized: true, // For better PWA compatibility
    formats: ['image/webp', 'image/avif'],
  },

  // Enable compression
  compress: true,

  // Disable x-powered-by header
  poweredByHeader: false,

  // Configure for both webpack and Turbopack
  ...(process.env.NODE_ENV === 'development' ? {} : {
    // Webpack config for production builds
    webpack: (config, { isServer }) => {
      if (!isServer) {
        // Client-side webpack config for PWA
        config.resolve.fallback = {
          ...config.resolve.fallback,
          fs: false,
        };
      }

      return config;
    },
  }),
};

export default nextConfig;
