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

const sourceFiles = ['src/**/*.{js,jsx,ts,tsx}'];
const typeScriptFiles = ['src/**/*.ts', 'src/**/*.tsx'];
const scopeConfigs = (configs, files = sourceFiles) =>
  configs.map((config) => ({ ...config, files }));

const baseConfig = {
  files: sourceFiles,
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
  settings: {
    react: {
      version: 'detect',
    },
  },
  rules: {
    'no-unused-vars': [
      'warn',
      {
        varsIgnorePattern: '^[A-Z_]',
        argsIgnorePattern: '^_',
      },
    ],
    'no-empty': ['warn', { allowEmptyCatch: true }],
    'prefer-const': 'warn',
    'no-irregular-whitespace': 'warn',
    'react/react-in-jsx-scope': 'off',
    'react/prop-types': 'off',
    'react/no-unescaped-entities': 'warn',
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',
    'react-refresh/only-export-components': 'warn',
  },
};

const tsConfig = {
  files: typeScriptFiles,
  languageOptions: {
    parser: tsParser,
  },
  rules: {
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': [
      'warn',
      {
        varsIgnorePattern: '^[A-Z_]',
        argsIgnorePattern: '^_',
      },
    ],
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
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'coverage/**',
      'out/**',
      '.next/**',
      '.turbo/**',
    ],
  },
  ...scopeConfigs(
    compat.plugins(
      'react',
      'react-hooks',
      'react-refresh',
      '@typescript-eslint',
    ),
  ),
  ...scopeConfigs(compat.extends('plugin:react/recommended')),
  ...scopeConfigs(
    compat.extends('plugin:@typescript-eslint/recommended'),
    typeScriptFiles,
  ),
  { ...js.configs.recommended, files: sourceFiles },
  baseConfig,
  tsConfig,
  cjsShimsConfig,
];
