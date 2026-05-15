import { describe, expect, it } from "vitest";

import { resolvePostAuthLandingFromFlags } from "./post-auth-landing";

describe("resolvePostAuthLandingFromFlags", () => {
  it("returns dashboard when profile exists and start concept completed", () => {
    expect(
      resolvePostAuthLandingFromFlags({
        hasProfile: true,
        welcomeRecordPresent: false,
        startConceptCompleted: true,
      }),
    ).toBe("/dashboard");
    expect(
      resolvePostAuthLandingFromFlags({
        hasProfile: true,
        welcomeRecordPresent: true,
        startConceptCompleted: true,
      }),
    ).toBe("/dashboard");
  });

  it("returns start when profile exists but start concept not completed", () => {
    expect(
      resolvePostAuthLandingFromFlags({
        hasProfile: true,
        welcomeRecordPresent: false,
        startConceptCompleted: false,
      }),
    ).toBe("/start");
    expect(
      resolvePostAuthLandingFromFlags({
        hasProfile: true,
        welcomeRecordPresent: true,
        startConceptCompleted: false,
      }),
    ).toBe("/start");
  });

  it("returns onboarding when no profile but welcome completed", () => {
    expect(
      resolvePostAuthLandingFromFlags({
        hasProfile: false,
        welcomeRecordPresent: true,
        startConceptCompleted: false,
      }),
    ).toBe("/onboarding");
  });

  it("returns welcome when no profile and no welcome row", () => {
    expect(
      resolvePostAuthLandingFromFlags({
        hasProfile: false,
        welcomeRecordPresent: false,
        startConceptCompleted: false,
      }),
    ).toBe("/welcome");
  });
});
