// Aggressive by intent: typescript-eslint's strict + stylistic type-checked
// presets, Next's core-web-vitals rules, and the react-hooks rules, with no
// preset downgrades. A rule that is genuinely impossible in one spot gets a
// per-line disable with a reason, never a config-wide off.
import tseslint from "typescript-eslint";
import nextPlugin from "@next/eslint-plugin-next";
import reactHooks from "eslint-plugin-react-hooks";

export default tseslint.config(
  {
    // tools/ is dev-only plain JS driven by its own runtime. pipeline/ is a
    // vendored mirror of the build scripts from light-workspace, kept here so a
    // reader can check the committed data against the code that made it; it
    // answers to that repo's conventions, and linting it here would only mean
    // re-fixing the same lines every time it is re-vendored.
    ignores: [".next/**", "node_modules/**", "next-env.d.ts", "tools/**", "public/**", "pipeline/**"],
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
