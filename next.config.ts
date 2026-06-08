import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Tree-shake heavy icon/chart packages — only imports actually used get bundled
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "react-icons",
      "recharts",
      "d3-geo",
      "react-simple-maps",
      "@radix-ui/react-icons",
    ],
  },

  // Compress responses with gzip (reduces payload size ~70%)
  compress: true,

  // Allow Google favicon CDN for DomainFavicon component
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "www.google.com", pathname: "/s2/favicons**" },
      { protocol: "https", hostname: "*.googleusercontent.com" },
    ],
    // Serve optimized images — cache at CDN edge
    minimumCacheTTL: 3600,
  },

  async headers() {
    return [
      // No-index header for all pages (private app)
      {
        source: "/(.*)",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      // Cache static assets aggressively
      {
        source: "/_next/static/(.*)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      // Favicon API responses — cache at browser
      {
        source: "/api/(.*)",
        headers: [
          { key: "Cache-Control", value: "no-store" },
        ],
      },
    ];
  },
};

export default nextConfig;
