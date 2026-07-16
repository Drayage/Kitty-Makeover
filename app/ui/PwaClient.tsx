"use client";

import { useEffect, useState } from "react";
import { PUBLIC_BASE_PATH, publicPath } from "../lib/publicPath";

export default function PwaClient() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setOnline(navigator.onLine);

    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register(publicPath("/sw.js"), {
        scope: `${PUBLIC_BASE_PATH}/`,
      });
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return !online ? (
    <div className="pwa-controls" aria-live="polite">
      <span className="offline-chip">오프라인 플레이 중</span>
    </div>
  ) : null;
}
