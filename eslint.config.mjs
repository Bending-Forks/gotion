// ESLint on the TypeScript of Editing, of the CRDT package and of the web client: `npm run lint`.
import js from '@eslint/js'
import { defineConfig, globalIgnores } from 'eslint/config'
import reactHooks from 'eslint-plugin-react-hooks'
import tseslint from 'typescript-eslint'

export default defineConfig(
  // The output of Vite, and the types generated from api/, never edited by hand
  globalIgnores(['**/dist/', 'client/web/src/api/generated/', 'services/editing/src/adapters/events/']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    // A name that starts with _ is unused on purpose, such as the parameters of a typed mock
    rules: { '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }] },
  },
  { files: ['client/web/**/*.{ts,tsx}'], extends: [reactHooks.configs.flat.recommended] },
)
