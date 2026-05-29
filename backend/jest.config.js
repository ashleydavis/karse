export default {
  testEnvironment: "node",
  testMatch: ["<rootDir>/src/tests/**/*.test.ts"],
  transform: {
    "^.+\\.ts$": "@swc/jest",
  },
  moduleNameMapper: {
    "^karse-types$": "<rootDir>/../packages/karse-types/src/index.ts",
  },
};
