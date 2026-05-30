import path from 'node:path'
import type { NextConfig } from 'next'

function resolveApiOrigin(): string {
  const raw =
    process.env.API_INTERNAL_URL ??
    process.env.API_URL ??
    'http://localhost:4001'

  return raw.replace(/\/api\/?$/, '')
}

const nextConfig: NextConfig = {
  output: 'standalone',
  turbopack: {
    root: path.resolve(__dirname),
  },
  async rewrites() {
    if (process.env.NODE_ENV !== 'development') {
      return []
    }

    const apiOrigin = resolveApiOrigin()

    return [
      {
        source: '/api/:path*',
        destination: `${apiOrigin}/api/:path*`,
      },
    ]
  },
}

export default nextConfig
