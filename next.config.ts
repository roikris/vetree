import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // Enable Turbopack support (Next.js 16)
  turbopack: {},
  
  // Bundle optimization
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      '@vercel/analytics',
      'react-markdown',
      'recharts',
    ],
  },
  
  // Compression and optimization
  compress: true,
  poweredByHeader: false,
  
  // Tree shaking for smaller bundles
  swcMinify: true,
  
  webpack: (config, { isServer }) => {
    // Enable tree shaking
    config.optimization.providedExports = true;
    config.optimization.usedExports = true;
    config.optimization.sideEffects = false;
    
    // Split chunks for better caching
    if (!isServer) {
      config.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all',
          },
          common: {
            name: 'common',
            minChunks: 2,
            chunks: 'all',
            enforce: true,
          },
        },
      };
    }
    
    return config;
  },
};

// @ts-ignore - Sentry v7 types don't fully support Next.js 16 yet
export default withSentryConfig(nextConfig, {
  silent: true,
  hideSourceMaps: true,
  disableLogger: true,
  telemetry: false,
});
