import { describe, expect, it } from "vitest";
import { type DeviceSignals, initialTier, isSoftwareRenderer, QUALITY_TIERS } from "./quality";

const tierName = (signals: Partial<DeviceSignals>) =>
  QUALITY_TIERS[
    initialTier({
      cores: 8,
      memoryGb: 8,
      touchFirst: false,
      saveData: false,
      renderer: "ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)",
      ...signals,
    })
  ]?.name;

describe("QUALITY_TIERS", () => {
  it("gets lighter at every step: fewer grains, lower pixel ratio", () => {
    QUALITY_TIERS.forEach((tier, index) => {
      const next = QUALITY_TIERS[index + 1];
      if (!next) return;
      expect(next.lines * next.pointsPerLine).toBeLessThan(tier.lines * tier.pointsPerLine);
      expect(next.maxPixelRatio).toBeLessThan(tier.maxPixelRatio);
    });
  });
});

describe("initialTier", () => {
  it("starts capable desktops and laptops at high", () => {
    expect(tierName({})).toBe("high");
    expect(tierName({ cores: 4, memoryGb: undefined })).toBe("high");
  });

  it("starts phones by their memory and cores", () => {
    expect(tierName({ touchFirst: true, memoryGb: 8, cores: 8 })).toBe("high");
    expect(tierName({ touchFirst: true, memoryGb: 4, cores: 8 })).toBe("medium");
    expect(tierName({ touchFirst: true, memoryGb: 3, cores: 8 })).toBe("low");
  });

  it("treats a phone that does not report memory (Safari) as a typical one", () => {
    expect(tierName({ touchFirst: true, memoryGb: undefined, cores: 6 })).toBe("medium");
  });

  it("starts weak or data-saving devices low", () => {
    expect(tierName({ cores: 2 })).toBe("low");
    expect(tierName({ memoryGb: 2 })).toBe("low");
    expect(tierName({ saveData: true })).toBe("low");
  });

  it("starts at minimal when the browser draws WebGL on the CPU", () => {
    expect(
      tierName({
        renderer:
          "ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)",
      }),
    ).toBe("minimal");
    expect(tierName({ renderer: "llvmpipe (LLVM 15.0.7, 256 bits)" })).toBe("minimal");
  });
});

describe("isSoftwareRenderer", () => {
  it("recognises software renderers and leaves real GPUs alone", () => {
    expect(isSoftwareRenderer("Microsoft Basic Render Driver")).toBe(true);
    expect(isSoftwareRenderer("Adreno (TM) 722")).toBe(false);
    expect(isSoftwareRenderer("Apple GPU")).toBe(false);
    expect(isSoftwareRenderer("")).toBe(false);
  });
});
