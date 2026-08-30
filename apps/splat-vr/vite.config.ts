import { defineConfig } from "vite";
import basicSsl from "@vitejs/plugin-basic-ssl";

export default defineConfig({
  // Relative base so the built bundle works from the /splat-vr/ CloudFront prefix
  // without knowing its own mount point (same reason portal/ uses "./").
  base: "./",

  // basic-ssl, NOT vite-plugin-mkcert: mkcert's `-install` shells out to
  // update-ca-certificates -> openssl, which dies on this machine (libssl
  // mismatch). See the repo CLAUDE.md v2 hard rule #3. WebXR needs https, and
  // an in-memory self-signed cert is enough for localhost.
  plugins: [basicSsl()],

  server: {
    host: "0.0.0.0",
    // 8081 belongs to portal/ (IWSDK); keep both runnable at once.
    port: 8082,
  },

  build: {
    outDir: "dist",
    target: "esnext",
  },
});
