import { describe, it, expect } from "vitest";
import {
  calculateBackoff,
  createFixedBackoff,
  createExponentialBackoff,
  createCustomBackoff,
} from "../src/strategies/retry.js";

describe("Retry strategies", () => {
  describe("calculateBackoff", () => {
    it("should return 0 with no backoff config", () => {
      expect(calculateBackoff(undefined, 1)).toBe(0);
    });

    it("should return fixed delay", () => {
      const backoff = createFixedBackoff(1000);
      expect(calculateBackoff(backoff, 1)).toBe(1000);
      expect(calculateBackoff(backoff, 2)).toBe(1000);
      expect(calculateBackoff(backoff, 5)).toBe(1000);
    });

    it("should return exponential delay", () => {
      const backoff = createExponentialBackoff(1000);
      expect(calculateBackoff(backoff, 1)).toBe(1000);
      expect(calculateBackoff(backoff, 2)).toBe(2000);
      expect(calculateBackoff(backoff, 3)).toBe(4000);
      expect(calculateBackoff(backoff, 4)).toBe(8000);
    });

    it("should use custom backoff function", () => {
      const backoff = createCustomBackoff((attempts) => attempts * 500);
      expect(calculateBackoff(backoff, 1)).toBe(500);
      expect(calculateBackoff(backoff, 2)).toBe(1000);
      expect(calculateBackoff(backoff, 3)).toBe(1500);
    });

    it("should use default delay when custom fn is missing", () => {
      const backoff = { type: "custom" as const, delay: 2000 };
      expect(calculateBackoff(backoff, 1)).toBe(2000);
    });

    it("should use default delay of 1000 when not specified", () => {
      const backoff = { type: "fixed" as const };
      expect(calculateBackoff(backoff, 1)).toBe(1000);
    });
  });

  describe("factory functions", () => {
    it("should create fixed backoff", () => {
      const backoff = createFixedBackoff(500);
      expect(backoff.type).toBe("fixed");
      expect(backoff.delay).toBe(500);
    });

    it("should create exponential backoff", () => {
      const backoff = createExponentialBackoff(1000);
      expect(backoff.type).toBe("exponential");
      expect(backoff.delay).toBe(1000);
    });

    it("should create custom backoff", () => {
      const fn = (n: number) => n * 100;
      const backoff = createCustomBackoff(fn);
      expect(backoff.type).toBe("custom");
      expect(backoff.customFn).toBe(fn);
    });
  });
});
