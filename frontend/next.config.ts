import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cloud Run 用: standalone モードでビルド
  output: "standalone",
};

export default nextConfig;
