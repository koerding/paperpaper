/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Server Actions are now enabled by default in Next.js 14
  // Remove the experimental.serverActions config
  experimental: {},
  // Move bodyParser config to correct location
  async headers() {
    return [
      {
        source: '/api/(.*)',
        headers: [
          {
            key: 'x-content-type-options',
            value: 'nosniff',
          },
        ],
      },
    ];
  },
}

module.exports = nextConfig
