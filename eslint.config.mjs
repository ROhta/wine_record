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
		// 注: bingo は parserOptions.project を設定するが、型チェック系ルール
		// （recommendedTypeChecked）を併用していないため型情報が消費されず無駄なコストになる。
		// よって project は設定しない（Copilot 指摘）。型情報リントが必要になれば
		// recommendedTypeChecked + projectService を導入する。
		files: ["src/**/*.ts", "tests/**/*.ts", "api/**/*.ts"],
		languageOptions: {
			ecmaVersion: 2023,
			sourceType: "module",
			globals: {
				...globals.node,
			},
		},
	},
)
