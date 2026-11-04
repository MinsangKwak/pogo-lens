module.exports = {
  preset: '@react-native/jest-preset',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^@pogo-lens/core$': '<rootDir>/../../packages/core/src/index.ts',
    '^@pogo-lens/workflow$': '<rootDir>/../../packages/workflow/src/index.ts',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transformIgnorePatterns: [
    'node_modules/(?!((@)?react-native|@react-native(-community)?|react-native-safe-area-context)/)',
  ],
};
