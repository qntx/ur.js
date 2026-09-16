import react from "@vitejs/plugin-react";
import { defineConfig, type PluginOption } from "vite-plus";

export default defineConfig({
  plugins: [...react()] as PluginOption[],
});
