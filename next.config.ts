import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 本地开发允许的访问来源。不要写入固定内网 IP，避免把个人网络信息带进公开仓库；
  // 如需从局域网设备访问，用环境变量传入（本地 .env.local 已被忽略）。
  allowedDevOrigins: process.env.NEXT_DEV_ORIGINS
    ? process.env.NEXT_DEV_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean)
    : ["127.0.0.1", "localhost"],
};

export default nextConfig;
