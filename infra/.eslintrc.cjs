module.exports = {
  root: true,
  ignorePatterns: 'cdk.out/**',
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier',
  ],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  rules: {
    'no-extra-semi': 2,
  },
}
