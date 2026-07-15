import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the finished Korean game shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html lang="ko"/i);
  assert.match(html, /<title>오늘도 냥꾸<\/title>/i);
  assert.match(html, /manifest\.webmanifest/i);
  assert.match(html, /icon-192\.png/i);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
});

test("ships an installable PWA manifest and offline worker", async () => {
  const [manifestText, worker] = await Promise.all([
    readFile(new URL("../public/manifest.webmanifest", import.meta.url), "utf8"),
    readFile(new URL("../public/sw.js", import.meta.url), "utf8"),
  ]);
  const manifest = JSON.parse(manifestText);

  assert.equal(manifest.name, "오늘도 냥꾸");
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.start_url, "/");
  assert.ok(manifest.icons.some((icon) => icon.sizes === "192x192"));
  assert.ok(manifest.icons.some((icon) => icon.sizes === "512x512"));
  assert.match(worker, /caches\.open/);
  assert.match(worker, /request\.mode === "navigate"/);
});

test("Firebase writes are isolated to the Kitty Makeover namespace", async () => {
  const source = await readFile(new URL("../app/data/firebase.ts", import.meta.url), "utf8");
  assert.match(source, /FIREBASE_GAME_ROOT = "games\/kitty-makeover"/);
  assert.match(source, /\$\{FIREBASE_GAME_ROOT\}\/saves\/\$\{deviceId\(\)\}/);
  assert.doesNotMatch(source, /ref\([^,]+,\s*["'`]games["'`]\s*\)/);
});
