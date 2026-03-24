import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Local development
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '5000',
        pathname: '/uploads/**',
      },
      // Railway internal networking
      {
        protocol: 'http',
        hostname: '*.railway.internal',
        port: '5000',
        pathname: '/uploads/**',
      },
      // Railway public domain (set NEXT_PUBLIC_BACKEND_URL to your backend domain)
      {
        protocol: 'https',
        hostname: '*.railway.app',
        pathname: '/uploads/**',
      },
    ],
  },
};

export default nextConfig;
