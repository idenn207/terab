const { defineConfig } = require('jest');
const { pathsToModuleNameMapper } = require('ts-jest');
const ts = require('typescript');

const { config } = ts.readConfigFile('./tsconfig.json', ts.sys.readFile);
const { compilerOptions } = config;

module.exports = defineConfig({
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transformIgnorePatterns: ['/node_modules/(?!(@scure|otplib|@otplib|@noble)/)'],
  transform: {
    '^.+\\.(t|j)s$': [
      'ts-jest',
      {
        tsconfig: {
          module: 'commonjs',
          moduleResolution: 'node',
          resolvePackageJsonExports: false,
        },
      },
    ],
  },
  moduleNameMapper: {
    ...pathsToModuleNameMapper(compilerOptions.paths, { prefix: '<rootDir>/../' }),
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
});
