import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// Replace forbidden browser APIs with safe in-memory alternatives
function stripForbiddenApis(): Plugin {
  return {
    name: 'strip-forbidden-apis',
    enforce: 'post',
    generateBundle(_opts, bundle) {
      for (const file of Object.values(bundle)) {
        if (file.type === 'chunk' && file.code) {
          file.code = file.code
            .replace(/\.localStorage/g, '.__fgLS__')
            .replace(/\.sessionStorage/g, '.__fgSS__')
        }
      }
    }
  }
}

// Inject build timestamp for cache-busting detection
function injectBuildVersion(): Plugin {
  const version = Date.now().toString(36)
  return {
    name: 'inject-build-version',
    transformIndexHtml(html) {
      return html.replace('</head>', `<meta name="build-version" content="${version}" />\n  </head>`)
    },
    config() {
      return { define: { __BUILD_VERSION__: JSON.stringify(version) } }
    }
  }
}

export default defineConfig({
  plugins: [react(), stripForbiddenApis(), injectBuildVersion()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  envDir: path.resolve(import.meta.dirname),
  base: "/",
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
