import { describe, test, expect } from "vitest";
import {
  formatCurrency,
  formatCompact,
  formatAmountCompact,
  pctChange,
} from "@/lib/calculations";

describe("formatCurrency", () => {
  test("formats positive USD values", () => {
    expect(formatCurrency(1234.56)).toBe("$1,234.56");
  });
  test("formats zero", () => {
    expect(formatCurrency(0)).toBe("$0.00");
  });
  test("formats negative values", () => {
    expect(formatCurrency(-99.9)).toBe("-$99.90");
  });
});

describe("formatCompact", () => {
  test("formats large values with 2 decimals", () => {
    expect(formatCompact(1234.56)).toBe("1,234.56");
  });
  test("formats small crypto values with more decimals", () => {
    const result = formatCompact(0.00001234);
    expect(result).toContain("0.0000");
  });
});

describe("formatAmountCompact", () => {
  test("formats millions", () => {
    expect(formatAmountCompact(1_500_000)).toBe("1.50M");
  });
  test("formats thousands", () => {
    expect(formatAmountCompact(12_500)).toBe("12.5k");
  });
  test("formats small values", () => {
    expect(formatAmountCompact(0.001)).toContain("0.001");
  });
});

describe("pctChange", () => {
  test("returns positive ratio for gains", () => {
    expect(pctChange(200, 100)).toBeCloseTo(1.0);
  });
  test("returns negative ratio for losses", () => {
    expect(pctChange(50, 100)).toBeCloseTo(-0.5);
  });
  test("returns 0 when basis is 0", () => {
    expect(pctChange(100, 0)).toBe(0);
  });
  test("returns 0 when both are 0", () => {
    expect(pctChange(0, 0)).toBe(0);
  });
});
