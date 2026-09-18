import path from 'node:path'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  // Monorepo: trace files from the repo root so the standalone bundle includes workspace deps.
  outputFileTracingRoot: path.join(import.meta.dirname, '../..'),
  transpilePackages: ['@p400/shared'],
}

export default nextConfig
