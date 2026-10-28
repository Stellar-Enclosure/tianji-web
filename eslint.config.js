import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'

export default tseslint.config(
  {ignores: ['dist', 'node_modules', '.generated']},
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {files: ['**/*.mjs'], languageOptions: {globals: {process: 'readonly'}}},
  {files: ['**/*.{ts,tsx}'], plugins: {'react-hooks': reactHooks}, rules: reactHooks.configs.recommended.rules},
)
