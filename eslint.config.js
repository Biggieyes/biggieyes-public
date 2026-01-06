import js from '@eslint/js';
import globals from 'globals';
import { FlatCompat } from '@eslint/eslintrc';
import path from 'node:path';
import tsParser from '@typescript-eslint/parser';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({
  baseDirectory: __dirname,
  resolvePluginsRelativeTo: __dirname,
  recommendedConfig: js.configs.recommended,
});

const baseConfig = {
  ignores: [
    'dist',
    'node_modules',
    'coverage',
    'out',
    '.next',
    '.turbo',
    '*.config.js',
    '*.d.ts',
  ],

  languageOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    globals: {
      ...globals.browser,
      ...globals.node,
    },
    parserOptions: {
      ecmaFeatures: { jsx: true },
    },
  },

  rules: {
    'no-unused-vars': [
      'error',
      {
        varsIgnorePattern: '^[A-Z_]',
        argsIgnorePattern: '^_',
      },
    ],
    'react/react-in-jsx-scope': 'off',
    'react/prop-types': 'off',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    'react-refresh/only-export-components': 'warn',
  },

  settings: {
    react: {
      version: 'detect',
    },
  },
};

const tsConfig = {
  files: ['**/*.ts', '**/*.tsx'],
  languageOptions: {
    parser: tsParser,
  },
  rules: {
    // Místo pro případná TS-specifická pravidla
  },
};

const testConfig = {
  files: ['**/*.test.*', '**/*.spec.*'],
  languageOptions: {
    globals: {
      ...globals.jest,
      ...globals.node,
    },
  },
  rules: {
    'no-unused-expressions': 'off',
  },
};

const cjsShimsConfig = {
  files: ['src/shims/**/*.cjs'],
  languageOptions: {
    sourceType: 'commonjs',
    globals: {
      ...globals.node,
      require: 'readonly',
      module: 'readonly',
      exports: 'readonly',
    },
  },
  rules: {
    '@typescript-eslint/no-require-imports': 'off',
    'no-undef': 'off',
  },
};

export default [
  ...compat.plugins('react', 'react-hooks', 'react-refresh', '@typescript-eslint'),
  ...compat.extends(
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'plugin:@typescript-eslint/recommended',
  ),
  js.configs.recommended,
  baseConfig,
  tsConfig,
  testConfig,
  cjsShimsConfig,
];
