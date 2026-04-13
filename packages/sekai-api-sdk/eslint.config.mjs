import rootConfig from "../../eslint.config.mjs";

export default [
  ...rootConfig,
  {
    ignores: ["src/**/*.gen.ts"]
  },
  {
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      sourceType: "module",
      globals: {
        process: "readonly"
      }
    }
  }
];
