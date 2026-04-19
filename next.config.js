/** @type {import('next').NextConfig} */

// Strip any trailing /api or / from the URL to prevent double-path issues
const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';
const API_URL   = rawApiUrl.replace(/\/api\/?$/, '').replace(/\/$/, '');

const nextConfig = {
  async rewrites() {
    return [
      // /api/auth/login  →  https://backend.com/api/auth/login
      // /uploads/file    →  https://backend.com/uploads/file
      { source: '/api/:path*',     destination: `${API_URL}/api/:path*` },
      { source: '/uploads/:path*', destination: `${API_URL}/uploads/:path*` },
    ];
  },
};
module.exports = nextConfig;
