import { defineConfig } from "vite";

export default defineConfig({
    build: {
        lib: {
            entry: ["src/snapshot-viewer.ts"],
            formats: ["es"],
            fileName: "umbraco-media-snapshot", 
        },
        outDir: "../wwwroot/App_Plugins/UmbracoMediaSnapshot",
        emptyOutDir: true,
        sourcemap: true,
        rollupOptions: {
            external: [/^@umbraco/],
        },
    },
});