// Aggressive by intent: typescript-eslint's strict + stylistic type-checked
// presets, Next's core-web-vitals rules, and the react-hooks rules, with no
// preset downgrades. A rule that is genuinely impossible in one spot gets a
// per-line disable with a reason, never a config-wide off.
import tseslint from "typescript-eslint";
import nextPlugin from "@next/eslint-plugin-next";
import reactHooks from "eslint-plugin-react-hooks";

export default tseslint.config(
  {
    // app.js and vendor.js are the legacy static entry, deleted at the end of
    // the migration; tools/ is dev-only plain JS driven by its own runtime.
    ignores: [".next/**", "node_modules/**", "next-env.d.ts", "tools/**", "public/**", "app.js", "vendor.js"],
  },
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: { allowDefaultProject: ["eslint.config.mjs"] },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  nextPlugin.configs["core-web-vitals"],
  reactHooks.configs.flat["recommended-latest"],
  {
    files: ["**/*.mjs"],
    extends: [tseslint.configs.disableTypeChecked],
  },
);
