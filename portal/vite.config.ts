import { iwsdkDev } from "@iwsdk/vite-plugin-dev";

import { compileUIKit } from "@iwsdk/vite-plugin-uikitml";
import { defineConfig } from "vite";
import basicSsl from "@vitejs/plugin-basic-ssl";
import { Agent } from "node:https";

// HLS fans out a lot of small requests, and ABR pulls from several renditions at
// once while it settles. Without a pooled agent each segment opened a fresh
// TCP+TLS connection to CloudFront, which on this network produced connect
// timeouts (ETIMEDOUT -> 500 -> hls.js fatal NETWORK_ERROR -> video tears down)
// even though CloudFront itself answers in ~0.4 s. Reuse connections and pin to
// IPv4 so the happy-eyeballs path can't stall on a dead v6 route.
const cloudfrontAgent = new Agent({
  keepAlive: true,
  keepAliveMsecs: 30_000,
  maxSockets: 24,
  family: 4,
});

// Using basic-ssl instead of mkcert because mkcert's `-install` flag tries to
// register a CA in the system trust store via `update-ca-certificates`, which
// fails on this machine due to an openssl/libssl version mismatch. basic-ssl
// generates a self-signed cert in-memory — browser shows "Not Secure" but
// WebXR works fine on localhost regardless of cert trust.
export default defineConfig({
  plugins: [
    basicSsl(),
    iwsdkDev({
      emulator: {
        device: "metaQuest3",
      },
      ai: { mode: "agent" },
      verbose: true,
    }),

    compileUIKit({ sourceDir: "ui", outputDir: "public/ui", verbose: true }),
  ],
  server: {
    host: "0.0.0.0",
    port: 8081,
    open: true,
    // CloudFront returns the HLS with no Access-Control-Allow-Origin, and the
    // videosphere needs crossOrigin="anonymous" to texture a WebGL sphere. On
    // /v2/ that's same-origin so it works; from localhost or the LAN dev server
    // it's cross-origin and the video never loads. Proxying makes it same-origin
    // again, which is what lets the Quest reproduce the crash (video playing)
    // against the dev server with the MCP runtime tools attached.
    // Segment URIs in the master playlist are relative, so this one rule covers
    // the high/mid/low sub-playlists and every .ts segment underneath.
    proxy: {
      "/videos": {
        target: "https://d1ni7nkjr0eveg.cloudfront.net",
        changeOrigin: true,
        agent: cloudfrontAgent,
        timeout: 30_000,
        proxyTimeout: 30_000,
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: process.env.NODE_ENV !== "production",
    target: "esnext",
    rollupOptions: { input: "./index.html" },
  },
  esbuild: { target: "esnext" },
  optimizeDeps: {
    exclude: ["@babylonjs/havok"],
    esbuildOptions: { target: "esnext" },
  },
  publicDir: "public",
  base: "./",
});
