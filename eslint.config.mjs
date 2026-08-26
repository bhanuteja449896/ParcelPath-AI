import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

const eslintConfig = [
  ...coreWebVitals,
  ...typescript,
  {
    rules: {
      // Enforce no-any to prevent password_hash leaks via any-typed objects
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
];

export default eslintConfig;
