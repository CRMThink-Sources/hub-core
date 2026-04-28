import path from 'node:path'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@base-ui/react', '@base-ui/utils'],
  turbopack: {
    root: path.resolve(__dirname),
  },
}

export default nextConfig
