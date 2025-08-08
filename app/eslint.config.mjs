import js from "@eslint/js";
import globals from "globals";
import { defineConfig } from "eslint/config";

export default defineConfig([
  {
    ignores: [
      "node_modules/",
      "package-lock.json",
      ".env",
    ],
  },
  {
  "overrides": [
    {
      "files": ["tests/**/*.js"],
      "env": {
        "mocha": true
      }
    }
  ]
},
  { files: ["**/*.{js,mjs,cjs}"], plugins: { js }, extends: ["js/recommended"], languageOptions: { globals: globals.node } },
  { files: ["**/*.js"], languageOptions: { sourceType: "module" } },
]);
