import { iwsdkDev } from "@iwsdk/vite-plugin-dev";

import { compileUIKit } from "@iwsdk/vite-plugin-uikitml";
import { defineConfig } from "vite";
import basicSsl from "@vitejs/plugin-basic-ssl";

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
  server: { host: "0.0.0.0", port: 8081, open: true },
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
