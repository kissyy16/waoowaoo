import type { NextConfig } from "next";
import path from 'node:path';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n.ts');

const nextConfig: NextConfig = {
  // 已删除 ignoreBuildErrors / ignoreDuringBuilds，构建保持严格门禁
  // Next 15 的 allowedDevOrigins 是顶层配置，不属于 experimental
  allowedDevOrigins: [
    'http://192.168.31.218:3000',
    'http://192.168.31.*:3000',
  ],
  webpack(config, { nextRuntime }) {
    if (nextRuntime === 'edge') {
      config.resolve ??= {};
      config.resolve.alias = {
        ...(config.resolve.alias ?? {}),
        './instrumentation-node$': path.resolve(process.cwd(), 'src/instrumentation-edge.ts'),
      };
    }
    return config;
  },
};

export default withNextIntl(nextConfig);
