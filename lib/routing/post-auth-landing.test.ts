import { describe, expect, it } from "vitest";

import { resolvePostAuthLandingFromFlags } from "./post-auth-landing";

describe("resolvePostAuthLandingFromFlags", () => {
  it("returns dashboard when profile exists regardless of welcome", () => {
    expect(
      resolvePostAuthLandingFromFlags({ hasProfile: true, welcomeRecordPresent: false }),
    ).toBe("/dashboard");
    expect(
      resolvePostAuthLandingFromFlags({ hasProfile: true, welcomeRecordPresent: true }),
    ).toBe("/dashboard");
  });

  it("returns onboarding when no profile but welcome completed", () => {
    expect(
      resolvePostAuthLandingFromFlags({ hasProfile: false, welcomeRecordPresent: true }),
    ).toBe("/onboarding");
  });

  it("returns welcome when no profile and no welcome row", () => {
    expect(
      resolvePostAuthLandingFromFlags({ hasProfile: false, welcomeRecordPresent: false }),
    ).toBe("/welcome");
  });
});
