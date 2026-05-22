import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";
import security from "eslint-plugin-security";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    plugins: { security },
    rules: {
      "security/detect-object-injection": "off",
      "security/detect-non-literal-fs-filename": "warn",
      "security/detect-non-literal-regexp": "warn",
      "security/detect-eval-with-expression": "error",
      "security/detect-unsafe-regex": "warn",
      "security/detect-pseudoRandomBytes": "error",
      "security/detect-new-buffer": "error",
      "security/detect-child-process": "error",
      "security/detect-no-csrf-before-method-override": "error",
      "security/detect-possible-timing-attacks": "warn",
    },
    ignores: ["**/node_modules/**", ".next/**", "out/**", "dist/**"],
  },
];

export default eslintConfig;
