import { defineConfig } from "@apps-in-toss/web-framework/config";

export default defineConfig({
  appName: "seoul-live",
  brand: {
    primaryColor: "#004ac6",
  },
  permissions: [{ name: "geolocation", access: "access" }],
  webBundleDir: "dist",
});
