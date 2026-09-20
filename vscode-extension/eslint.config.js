// @ts-check
const tseslint = require("typescript-eslint");

module.exports = tseslint.config(
    // Fichiers ignorés (équivalent de .eslintignore)
    {
        ignores: [
            "dist/**",
            "out/**",
            "node_modules/**",
            "*.js",       // fichiers JS à la racine (esbuild.js, eslint.config.js lui-même, etc.)
            "**/*.d.ts",
        ],
    },

    // Config de base recommandée typescript-eslint
    ...tseslint.configs.recommended,

    // Surcharges spécifiques au projet
    {
        files: ["src/**/*.ts"],
        languageOptions: {
            parserOptions: {
                project: "./tsconfig.json",
                tsconfigRootDir: __dirname,
            },
        },
        // Politique (ADR 0005) : une règle est `error`, ou `off` avec une raison datée. Jamais `warn`.
        // Une nouvelle règle arrive en `error` ; si du code existant la viole, la dette est figée dans
        // `eslint-suppressions.json` (voir CONTRIBUTING.md), pas dans un niveau `warn`.
        rules: {
            "prefer-const": "error",

            "@typescript-eslint/naming-convention": [
                "error",
                {
                    selector: "import",
                    format: ["camelCase", "PascalCase"],
                },
            ],

            // Variables/args inutilisés : les supprimer ; `_` seulement pour un paramètre à conserver
            // (liste de paramètres d'une interface implémentée)
            "@typescript-eslint/no-unused-vars": [
                "error",
                { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
            ],

            "@typescript-eslint/no-explicit-any": "error",
            "@typescript-eslint/no-unused-expressions": "error",

            curly: "error",
            eqeqeq: "error",
            "no-throw-literal": "error",

            // off depuis 2026-09-20 : Prettier gère les points-virgules
            semi: "off",
        },
    }
);
