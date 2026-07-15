import type { Metadata, Viewport } from "next";
import PwaClient from "./ui/PwaClient";
import { publicPath } from "./lib/publicPath";
import "./globals.css";

export const metadata: Metadata = {
  title: "오늘도 냥꾸",
  description: "고양이의 기분에 맞춰 장식하는 로컬 고양이 꾸미기 보드게임",
  applicationName: "오늘도 냥꾸",
  manifest: publicPath("/manifest.webmanifest"),
  formatDetection: {
    telephone: false,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "오늘도 냥꾸",
  },
  icons: {
    icon: [
      { url: publicPath("/icons/icon-192.png"), sizes: "192x192", type: "image/png" },
      { url: publicPath("/icons/icon-512.png"), sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: publicPath("/icons/apple-touch-icon.png"), sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#14564f",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body
        style={{
          "--decorations-sprite": `url("${publicPath("/assets/decorations-sprite.webp")}")`,
          "--dressed-cats-sprite": `url("${publicPath("/assets/dressed-cats-sprite.webp")}")`,
          "--cat-base-image": `url("${publicPath("/assets/cat-base.webp")}")`,
          "--accessory-layers": `url("${publicPath("/assets/accessory-layers.webp")}")`,
        } as React.CSSProperties}
      >
        {children}
        <PwaClient />
      </body>
    </html>
  );
}
