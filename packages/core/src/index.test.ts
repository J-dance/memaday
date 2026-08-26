import { describe, expect, it } from "vitest";
import { CORE_PACKAGE_NAME } from "./index.js";

describe("scaffolding", () => {
  it("proves the test toolchain is wired up", () => {
    expect(CORE_PACKAGE_NAME).toBe("@memaday/core");
  });
});
