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
    // Default rules for normal JS files
    files: ["**/*.{js,mjs,cjs}"],
    plugins: { js },
    extends: ["js/recommended"],
    languageOptions: {
      globals: globals.node,
      sourceType: "module"
    }
  },
  {
    // Test files override (Mocha)
    files: ["tests/**/*.js"],
    languageOptions: {
      globals: {
        ...globals.mocha, // adds describe, it, before, after
      }
    }
  }
]);
