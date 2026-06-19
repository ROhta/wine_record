import js from "@eslint/js"
import tseslint from "typescript-eslint"
import prettierConfig from "eslint-config-prettier/flat"
import globals from "globals"

export default tseslint.config(
	{
		ignores: ["dist/**", "node_modules/**", "spikes/**", ".specify/**", ".remember/**", "coverage/**"],
	},
	js.configs.recommended,
	...tseslint.configs.recommended,
	prettierConfig,
	{
		// wine_record は Node ESM サーバー（bingo の browser globals → node globals に適合）。
		files: ["src/**/*.ts", "tests/**/*.ts"],
		languageOptions: {
			ecmaVersion: 2023,
			sourceType: "module",
			globals: {
				...globals.node,
			},
			parserOptions: {
				project: "./tsconfig.json",
				tsconfigRootDir: import.meta.dirname,
			},
		},
	},
)
