/** @type {import('ts-jest').JestConfigWithTsJest} */

// Shared transform/resolution settings. Both projects compile TS through
// ts-jest and resolve the `@/*` path alias the same way the app does.
const common = {
  preset: 'ts-jest',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    // Static assets are irrelevant to behaviour under test.
    '\\.(css|less|scss|sass)$': '<rootDir>/tests/styleMock.js',
  },
  // `.mjs` is here for the build scripts under `scripts/`. They are plain ESM
  // because they run before any TypeScript is compiled, but a test still has to
  // import one to pin it against the engine — ts-jest compiles it to CommonJS
  // like everything else.
  moduleFileExtensions: ['ts', 'tsx', 'js', 'mjs', 'json', 'node'],
  transform: {
    '^.+\\.(tsx?|mjs)$': ['ts-jest', {
      tsconfig: {
        // The app's tsconfig uses `jsx: "preserve"` because Next.js does its own
        // JSX transform. ts-jest emits the final JS, so it has to transform JSX
        // itself or component tests fail on the first `<`.
        jsx: 'react-jsx',
        esModuleInterop: true,
        allowJs: true,
        target: 'es2019',
        module: 'commonjs',
        moduleResolution: 'node',
        resolveJsonModule: true,
        skipLibCheck: true,
        strict: true,
        paths: { '@/*': ['./*'] },
        baseUrl: '.',
      },
      diagnostics: false,
    }],
  },
  transformIgnorePatterns: ['/node_modules/'],
};

module.exports = {
  projects: [
    {
      // Engine, persistence, MIDI and pure-logic tests. No DOM.
      ...common,
      displayName: 'node',
      testEnvironment: 'node',
      testMatch: [
        '<rootDir>/engine/**/__tests__/**/*.test.ts',
        '<rootDir>/lib/**/__tests__/**/*.test.ts',
        '<rootDir>/templates/**/__tests__/**/*.test.ts',
        '<rootDir>/tests/integration/**/*.test.ts',
        '<rootDir>/tests/smoke/**/*.test.ts',
      ],
    },
    {
      // React component and store tests. Needs a DOM.
      ...common,
      displayName: 'ui',
      testEnvironment: 'jsdom',
      setupFilesAfterEnv: ['<rootDir>/tests/setupUi.ts'],
      testMatch: [
        '<rootDir>/components/**/*.test.tsx',
        '<rootDir>/components/**/__tests__/**/*.test.tsx',
        '<rootDir>/hooks/**/__tests__/**/*.test.{ts,tsx}',
        '<rootDir>/app/**/*.test.tsx',
        '<rootDir>/store/**/__tests__/**/*.test.ts',
      ],
    },
  ],
};
