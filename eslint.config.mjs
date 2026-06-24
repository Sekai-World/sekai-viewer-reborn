import js from "@eslint/js";
import betterTailwindcss from "eslint-plugin-better-tailwindcss";
import svelte from "eslint-plugin-svelte";
import globals from "globals";
import tseslint from "typescript-eslint";

const betterTailwindcssRules = {
  "better-tailwindcss/enforce-canonical-classes": "error",
  "better-tailwindcss/enforce-consistent-important-position": "error",
  "better-tailwindcss/no-unnecessary-whitespace": "error"
};

const betterTailwindcssPlugin = {
  "better-tailwindcss": betterTailwindcss
};

const betterTailwindcssSettings = (appPath) => ({
  cwd: `./${appPath}`,
  entryPoint: `./${appPath}/src/app.css`
});

export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/.svelte-kit/**",
      "**/.turbo/**",
      "**/dist/**",
      "**/build/**"
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...svelte.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node
      }
    }
  },
  {
    files: ["apps/content-site/src/**/*.{svelte,ts,js}"],
    plugins: {
      ...betterTailwindcssPlugin
    },
    settings: {
      "better-tailwindcss": betterTailwindcssSettings("apps/content-site")
    },
    rules: betterTailwindcssRules
  },
  {
    files: ["apps/tools-site/src/**/*.{svelte,ts,js}"],
    plugins: {
      ...betterTailwindcssPlugin
    },
    settings: {
      "better-tailwindcss": betterTailwindcssSettings("apps/tools-site")
    },
    rules: betterTailwindcssRules
  },
  {
    files: ["apps/media-lab-site/src/**/*.{svelte,ts,js}"],
    plugins: {
      ...betterTailwindcssPlugin
    },
    settings: {
      "better-tailwindcss": betterTailwindcssSettings("apps/media-lab-site")
    },
    rules: betterTailwindcssRules
  },
  {
    files: ["apps/account-site/src/**/*.{svelte,ts,js}"],
    plugins: {
      ...betterTailwindcssPlugin
    },
    settings: {
      "better-tailwindcss": betterTailwindcssSettings("apps/account-site")
    },
    rules: betterTailwindcssRules
  },
  {
    files: ["packages/ui-shell/src/**/*.{svelte,ts,js}"],
    plugins: {
      ...betterTailwindcssPlugin
    },
    settings: {
      "better-tailwindcss": betterTailwindcssSettings("apps/content-site")
    },
    rules: {
      ...betterTailwindcssRules
    }
  },
  {
    files: ["**/*.svelte", "**/*.svelte.ts", "**/*.svelte.js"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        extraFileExtensions: [".svelte"],
        parser: tseslint.parser
      }
    },
    rules: {
      "svelte/no-navigation-without-resolve": "off"
    }
  },
  {
    files: ["**/*.d.ts"],
    rules: {
      "@typescript-eslint/no-empty-object-type": "off"
    }
  }
];
