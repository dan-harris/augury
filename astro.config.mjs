// @ts-check
import { defineConfig } from "astro/config";

import tailwindcss from "@tailwindcss/vite";

import cloudflare from "@astrojs/cloudflare";

import preact from "@astrojs/preact";

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

  adapter: cloudflare({
    imageService: "passthrough",
  }),

  integrations: [preact()],
});
