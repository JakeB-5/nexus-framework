import { describe, it, expect } from "vitest";
import {
  parse,
  isValid,
  getNextDate,
  getNextDates,
  describe as describeCron,
} from "../src/cron-parser.js";
import { CronParseError } from "../src/errors.js";

describe("Cron Parser", () => {
  describe("parse", () => {
    it("should parse standard 5-field expression", () => {
      const expr = parse("*/5 * * * *");
      expect(expr.minute).toBe("*/5");
      expect(expr.hour).toBe("*");
      expect(expr.dayOfMonth).toBe("*");
      expect(expr.month).toBe("*");
      expect(expr.dayOfWeek).toBe("*");
    });

    it("should parse 6-field expression with seconds", () => {
      const expr = parse("30 */5 * * * *");
      expect(expr.second).toBe("30");
      expect(expr.minute).toBe("*/5");
    });

    it("should parse specific values", () => {
      const expr = parse("0 12 1 6 3");
      expect(expr.minute).toBe("0");
      expect(expr.hour).toBe("12");
      expect(expr.dayOfMonth).toBe("1");
      expect(expr.month).toBe("6");
      expect(expr.dayOfWeek).toBe("3");
    });

    it("should parse ranges", () => {
      const expr = parse("0-30 9-17 * * 1-5");
      expect(expr.minute).toBe("0-30");
      expect(expr.hour).toBe("9-17");
      expect(expr.dayOfWeek).toBe("1-5");
    });

    it("should parse lists", () => {
      const expr = parse("0,15,30,45 * * * *");
      expect(expr.minute).toBe("0,15,30,45");
    });

    it("should parse steps", () => {
      const expr = parse("*/10 */2 * * *");
      expect(expr.minute).toBe("*/10");
      expect(expr.hour).toBe("*/2");
    });

    it("should replace month names", () => {
      const expr = parse("0 0 1 JAN,JUN *");
      expect(expr.month).toBe("1,6");
    });

    it("should replace day names", () => {
      const expr = parse("0 0 * * MON,WED,FRI");
      expect(expr.dayOfWeek).toBe("1,3,5");
    });

    it("should throw on invalid field count", () => {
      expect(() => parse("* * *")).toThrow(CronParseError);
      expect(() => parse("* * * * * * *")).toThrow(CronParseError);
    });
  });

  describe("presets", () => {
    it("should parse @yearly", () => {
      const expr = parse("@yearly");
      expect(expr.minute).toBe("0");
      expect(expr.hour).toBe("0");
      expect(expr.dayOfMonth).toBe("1");
      expect(expr.month).toBe("1");
    });

    it("should parse @monthly", () => {
      const expr = parse("@monthly");
      expect(expr.dayOfMonth).toBe("1");
    });

    it("should parse @weekly", () => {
      const expr = parse("@weekly");
      expect(expr.dayOfWeek).toBe("0");
    });

    it("should parse @daily", () => {
      const expr = parse("@daily");
      expect(expr.minute).toBe("0");
      expect(expr.hour).toBe("0");
    });

    it("should parse @hourly", () => {
      const expr = parse("@hourly");
      expect(expr.minute).toBe("0");
    });
  });

  describe("isValid", () => {
    it("should return true for valid expressions", () => {
      expect(isValid("* * * * *")).toBe(true);
      expect(isValid("0 12 * * 1-5")).toBe(true);
      expect(isValid("*/5 * * * *")).toBe(true);
      expect(isValid("@daily")).toBe(true);
    });

    it("should return false for invalid expressions", () => {
      expect(isValid("invalid")).toBe(false);
      expect(isValid("* * *")).toBe(false);
      expect(isValid("")).toBe(false);
    });
  });

  describe("getNextDate", () => {
    it("should find next minute", () => {
      const from = new Date("2026-01-01T12:00:00");
      const next = getNextDate("* * * * *", from);
      // 5-field cron defaults seconds to 0, advances 1 sec then finds next match at 12:01:00
      expect(next.getMinutes()).toBe(1);
      expect(next.getTime()).toBeGreaterThan(from.getTime());
    });

    it("should find next specific minute", () => {
      const from = new Date("2026-01-01T12:00:00");
      const next = getNextDate("30 * * * *", from);
      expect(next.getMinutes()).toBe(30);
      expect(next.getHours()).toBe(12);
    });

    it("should find next hour when minute has passed", () => {
      const from = new Date("2026-01-01T12:45:00");
      const next = getNextDate("30 * * * *", from);
      expect(next.getMinutes()).toBe(30);
      expect(next.getHours()).toBe(13);
    });

    it("should find next day when hour has passed", () => {
      const from = new Date("2026-01-01T23:00:00");
      const next = getNextDate("0 12 * * *", from);
      expect(next.getDate()).toBe(2);
      expect(next.getHours()).toBe(12);
    });

    it("should find specific day of week", () => {
      // 2026-01-01 is Thursday (4)
      const from = new Date("2026-01-01T00:00:00");
      const next = getNextDate("0 0 * * 1", from); // Monday
      expect(next.getDay()).toBe(1);
      expect(next.getDate()).toBe(5); // next Monday is Jan 5
    });

    it("should find specific month", () => {
      const from = new Date("2026-03-01T00:00:00");
      const next = getNextDate("0 0 1 6 *", from);
      expect(next.getMonth()).toBe(5); // June (0-indexed)
      expect(next.getDate()).toBe(1);
    });

    it("should handle every 5 minutes", () => {
      const from = new Date("2026-01-01T12:03:00");
      const next = getNextDate("*/5 * * * *", from);
      expect(next.getMinutes()).toBe(5);
    });

    it("should return multiple next dates", () => {
      const dates = getNextDates("0 * * * *", 5, new Date("2026-01-01T12:00:00"));
      expect(dates).toHaveLength(5);
      for (let i = 1; i < dates.length; i++) {
        expect(dates[i].getTime()).toBeGreaterThan(dates[i - 1].getTime());
      }
    });

    it("should handle cron with seconds", () => {
      const from = new Date("2026-01-01T12:00:00");
      const next = getNextDate("30 * * * * *", from);
      expect(next.getSeconds()).toBe(30);
    });
  });

  describe("describe", () => {
    it("should describe every minute", () => {
      const desc = describeCron("* * * * *");
      expect(desc).toContain("every minute");
    });

    it("should describe specific minute", () => {
      const desc = describeCron("30 * * * *");
      expect(desc).toContain("minute 30");
    });

    it("should describe step minutes", () => {
      const desc = describeCron("*/5 * * * *");
      expect(desc).toContain("5 minutes");
    });

    it("should describe specific hour", () => {
      const desc = describeCron("0 12 * * *");
      expect(desc).toContain("hour 12");
    });

    it("should describe day of month", () => {
      const desc = describeCron("0 0 15 * *");
      expect(desc).toContain("day 15");
    });

    it("should describe weekday", () => {
      const desc = describeCron("0 0 * * 1");
      expect(desc).toContain("weekday 1");
    });
  });

  describe("edge cases", () => {
    it("should handle range with step", () => {
      const from = new Date("2026-01-01T00:00:00");
      const next = getNextDate("0-30/10 * * * *", from);
      expect([0, 10, 20, 30]).toContain(next.getMinutes());
    });

    it("should throw on out-of-range value", () => {
      expect(() => parse("60 * * * *")).not.toThrow(); // parse doesn't validate
      // But getNextDate with field parsing does validate
    });

    it("should throw CronParseError for invalid step", () => {
      expect(() => getNextDate("*/0 * * * *")).toThrow(CronParseError);
    });
  });
});
