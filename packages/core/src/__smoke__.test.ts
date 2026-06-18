import { describe, expect, it } from "vitest";
import type { SkillProject } from "@skill-studio/schemas";

import { PACKAGE_NAME } from "./index.js";

describe("core smoke", () => {
  it("exposes package name", () => {
    expect(PACKAGE_NAME).toContain("core");
  });

  it("can reference schemas types across packages", () => {
    const project: SkillProject = {
      schema_version: 1,
      id: "smoke",
      name: "Smoke",
      description: "",
      status: "draft",
    };
    expect(project.id).toBe("smoke");
  });
});
