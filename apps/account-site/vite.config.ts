import adapter from "@sveltejs/adapter-node";
import { defineConfig } from "vite";
import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [sveltekit({ adapter: adapter() }), tailwindcss()],
  server: { host: "localhost" }
});
