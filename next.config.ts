import type { NextConfig } from "next";

const isGitHubPages = process.env.GITHUB_PAGES === "true";
const pagesBasePath = "/Kitty-Makeover";

const nextConfig: NextConfig = isGitHubPages
  ? {
      output: "export",
      basePath: pagesBasePath,
      assetPrefix: pagesBasePath,
      trailingSlash: true,
      images: { unoptimized: true },
      typescript: { tsconfigPath: "./tsconfig.pages.json" },
    }
  : {};

export default nextConfig;
