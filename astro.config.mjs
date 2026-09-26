// @ts-check
import cloudflare from "@astrojs/cloudflare";
import preact from "@astrojs/preact";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

// https://astro.build/config
export default defineConfig({
  site: "https://augury.danharris.dev",

  vite: {
    plugins: [tailwindcss()],
    server: {
      watch: {
        usePolling: true,
      },
    },
  },

  server: {
    port: 4322, // Or any dedicated port
  },

  adapter: cloudflare({
    imageService: "passthrough",
  }),

  integrations: [preact()],
});
