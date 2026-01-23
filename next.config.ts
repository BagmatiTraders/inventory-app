import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: ['lucide-react', 'date-fns', 'lodash', '@radix-ui/react-dialog', 'recharts'],
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'static-01.daraz.com.np',
      },
      {
        protocol: 'https',
        hostname: '*.daraz.com.np',
      },
      {
        protocol: 'https',
        hostname: 'u-d-s.r.worldssl.net', // Common generic placeholder sometimes used
      },
      {
        protocol: 'https',
        hostname: 'img.alicdn.com',
      },
      {
        protocol: 'https',
        hostname: 'img.drz.lazcdn.com',
      },
      {
        protocol: 'https',
        hostname: 'lzd-img-global.slatic.net',
      },
      {
        protocol: 'https',
        hostname: 'np-live-21.slatic.net',
      },
      {
        protocol: 'https',
        hostname: '*.slatic.net',
      },
      {
        protocol: 'https',
        hostname: 'shblzjrzulnrsarfxptv.supabase.co',
      },
    ],
  },
};

export default nextConfig;
