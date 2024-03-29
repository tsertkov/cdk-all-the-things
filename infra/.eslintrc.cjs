module.exports = {
  root: true,
  ignorePatterns: 'cdk.out/**',
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier',
  ],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'eslint-plugin-import'],
  env: {
    node: true,
  },
  rules: {
    'no-extra-semi': 2,
    'sort-imports': [
      'error',
      {
        ignoreCase: true,
        ignoreDeclarationSort: true,
      },
    ],
    'import/order': ['error'],
  },
}
