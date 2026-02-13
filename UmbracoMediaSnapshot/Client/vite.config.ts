import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
    build: {
        lib: {
            entry: {
                "umbraco-media-snapshot": resolve(__dirname, "src/snapshot-viewer.ts"),
                "umbraco-media-snapshot2": resolve(__dirname, "src/snapshot-dashboard.ts"),
                "lang/en": resolve(__dirname, "src/lang/en.ts"),
                "lang/nl": resolve(__dirname, "src/lang/nl.ts"),
                "lang/da": resolve(__dirname, "src/lang/da.ts"),
                "lang/de": resolve(__dirname, "src/lang/de.ts"),
                "lang/fr": resolve(__dirname, "src/lang/fr.ts"),
            },
            formats: ["es"],
        },
        outDir: "../wwwroot/App_Plugins/UmbracoMediaSnapshot",
        emptyOutDir: true,
        sourcemap: true,
        rollupOptions: {
            external: [/^@umbraco/],
        },
    },
});