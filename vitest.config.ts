import {defineConfig, type ViteUserConfig} from "vitest/config"

// isolatedDeclarations 下では default export の型推論が不可（TS9037）。明示型の const を経由する。
const config: ViteUserConfig = defineConfig({
	test: {
		globals: true,
		environment: "node",
		include: ["tests/**/*.test.ts"],
	},
})

export default config
