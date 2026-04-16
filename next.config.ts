import type { NextConfig } from "next";
// @ts-ignore - next-pwa doesn't have types
import withPWA from 'next-pwa';

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: [
      'lucide-react', 
      'date-fns', 
      'lodash', 
      '@radix-ui/react-dialog', 
      'recharts',
      'react-select',
      'zod',
      'axios',
      '@supabase/supabase-js',
      '@tanstack/react-query',
      'react-hook-form',
      'class-variance-authority',
      'clsx',
      'tailwind-merge',
      'sonner',
      'xlsx',
      'papaparse',
      'fast-levenshtein',
      'nepali-date-converter',
      'crypto-js',
      'react-barcode',
      '@zxing/library',
      '@zxing/browser'
    ],
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
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
      {
        protocol: 'https',
        hostname: 'm.media-amazon.com',
      },
      {
        protocol: 'https',
        hostname: 'cdn.sybazzar.com',
      },
    ],
  },
  // Add empty turbopack config to silence Turbopack warning
  // This allows next-pwa's webpack config to work properly
  turbopack: {},
};

const pwaConfig = withPWA({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
  sw: 'sw.js',
  scope: '/',
});

export default pwaConfig(nextConfig);

