/** @type {import('next').NextConfig} */
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

const nextConfig = {
  async rewrites() {
    return [
      { source: '/api/:path*',     destination: `${API_URL}/api/:path*` },
      { source: '/uploads/:path*', destination: `${API_URL}/uploads/:path*` },
    ];
  },
};
module.exports = nextConfig;
