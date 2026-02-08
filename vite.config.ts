import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

function normalizeBasePath(basePath: string): string {
  if (!basePath.startsWith("/")) {
    return `/${basePath.endsWith("/") ? basePath : `${basePath}/`}`;
  }
  return basePath.endsWith("/") ? basePath : `${basePath}/`;
}

function resolveBasePath(): string {
  const explicitBasePath = process.env.VITE_BASE_PATH;
  if (explicitBasePath) {
    return normalizeBasePath(explicitBasePath);
  }

  return "/";
}

export default defineConfig({
  plugins: [react()],
  base: resolveBasePath()
});
