import type { NextConfig } from 'next';

const nextConfig: NextConfig = process.env.VERCEL
  ? { output: 'export' }
  : {};

export default nextConfig;
