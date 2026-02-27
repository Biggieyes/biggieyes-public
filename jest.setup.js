import "@testing-library/jest-dom";
import { jest as jestGlobals } from "@jest/globals";

// Keep tests written for Vitest-compatible `vi` helpers working under Jest.
if (typeof globalThis.vi === "undefined") {
  globalThis.vi = jestGlobals;
}
