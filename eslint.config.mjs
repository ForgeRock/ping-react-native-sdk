/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import pluginReact from "eslint-plugin-react";
import { defineConfig } from "eslint/config";

export default defineConfig([
  {
    ignores: [
      "**/node_modules/**",
      "**/lib/**",
      "**/libs/**",
      "**/dist/**",
      "**/build/**",
      "**/tmp/**",
      "**/coverage/**",
      "**/.gradle/**",
      "**/.cxx/**",
      "**/Pods/**",
      "**/DerivedData/**",
      "**/vendor/**",
    ],
  },
  { 
    files: ["**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"], 
    plugins: { 
    js
  }, 
  extends: ["js/recommended"], 
  languageOptions: { 
    globals: globals.node 
  } 
},
  tseslint.configs.recommended,
  pluginReact.configs.flat.recommended,
]);
