/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Phase 2 — type gate flipped ON. tsc --noEmit is clean; a type error now
    // fails the build. Revert to true only as a temporary escape hatch.
    ignoreBuildErrors: false,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
