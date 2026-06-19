import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "*": ["./node_modules/@swc/helpers/esm/**"],
  },
};

export default nextConfig;
