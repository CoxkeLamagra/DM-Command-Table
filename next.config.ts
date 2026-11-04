import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Standard Node.js server deployment with persistent local storage. */
  output: "standalone",
  poweredByHeader: false,
  // Only HTML requests traverse the nonce proxy; HTML writes are unsupported.
  experimental: { proxyClientMaxBodySize: 8 * 1024 },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value:
              "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
          },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
