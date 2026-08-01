/**
 * Jest Configuration for Unit Tests
 */

module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', { isolatedModules: true }],
  },
  collectCoverageFrom: [
    'src/**/*.(t|j)s',
    '!src/**/*.spec.ts',
    '!src/**/*.e2e-spec.ts',
    '!src/**/index.ts',
    '!src/main.ts',
  ],
  coverageDirectory: './coverage/unit',
  coverageReporters: ['text', 'lcov', 'html'],
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@core/(.*)$': '<rootDir>/src/core/$1',
    '^@modules/(.*)$': '<rootDir>/src/modules/$1',
    '^@country-packs/(.*)$': '<rootDir>/src/country-packs/$1',
    '^@common/(.*)$': '<rootDir>/src/common/$1',
  },
  setupFilesAfterEnv: [],
  testTimeout: 10000,
  verbose: true,
};
