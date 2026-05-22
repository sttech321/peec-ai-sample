import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "react-icons",
      "recharts",
      "d3-geo",
      "react-simple-maps",
    ],
  },
};

export default nextConfig;
