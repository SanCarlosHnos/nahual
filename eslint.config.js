import js from '@eslint/js';
import babelParser from '@babel/eslint-parser';
import prettier from 'eslint-plugin-prettier/recommended';

export default [
  js.configs.recommended,
  prettier,
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: babelParser,
      ecmaVersion: 2024,
      sourceType: 'module',
      parserOptions: {
        requireConfigFile: false,
        babelOptions: {
          presets: ['@babel/preset-typescript'],
        },
      },
    },
    rules: {
      'prettier/prettier': 'error',
      'prefer-const': 'error',
      'no-var': 'error',
      'no-unused-vars': 'off',
      'no-undef': 'off',
      'no-irregular-whitespace': 'error',
      'no-useless-assignment': 'off',
    },
  },
  {
    ignores: [
      'node_modules/',
      'coverage/',
      'dist/',
      'build/',
      'electron/',
      'nucleo/',
      '*.js',
      '*.mjs',
      '*.d.ts',
    ],
  },
];
