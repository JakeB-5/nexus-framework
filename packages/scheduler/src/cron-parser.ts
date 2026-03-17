// Cron expression parser

import { CronParseError } from "./errors.js";
import type { CronExpression } from "./types.js";

const MONTH_NAMES: Record<string, number> = {
  JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6,
  JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12,
};

const DAY_NAMES: Record<string, number> = {
  SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6,
};

const PRESETS: Record<string, string> = {
  "@yearly": "0 0 1 1 *",
  "@annually": "0 0 1 1 *",
  "@monthly": "0 0 1 * *",
  "@weekly": "0 0 * * 0",
  "@daily": "0 0 * * *",
  "@midnight": "0 0 * * *",
  "@hourly": "0 * * * *",
};


function replaceNames(field: string, names: Record<string, number>): string {
  let result = field.toUpperCase();
  for (const [name, value] of Object.entries(names)) {
    result = result.replace(new RegExp(name, "g"), String(value));
  }
  return result;
}

function parseField(
  field: string,
  min: number,
  max: number,
  fieldName: string,
  expression: string,
): number[] {
  const values = new Set<number>();

  const parts = field.split(",");
  for (const part of parts) {
    if (part === "*") {
      for (let i = min; i <= max; i++) {
        values.add(i);
      }
    } else if (part.includes("/")) {
      const [range, stepStr] = part.split("/");
      const step = parseInt(stepStr, 10);
      if (isNaN(step) || step <= 0) {
        throw new CronParseError(
          `Invalid step value in ${fieldName}: ${part}`,
          expression,
        );
      }

      let start = min;
      let end = max;

      if (range !== "*") {
        if (range.includes("-")) {
          const [s, e] = range.split("-").map(Number);
          start = s;
          end = e;
        } else {
          start = parseInt(range, 10);
        }
      }

      for (let i = start; i <= end; i += step) {
        values.add(i);
      }
    } else if (part.includes("-")) {
      const [startStr, endStr] = part.split("-");
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);

      if (isNaN(start) || isNaN(end)) {
        throw new CronParseError(
          `Invalid range in ${fieldName}: ${part}`,
          expression,
        );
      }

      if (start > end) {
        // Wrap around (e.g., 22-3 for hours)
        for (let i = start; i <= max; i++) values.add(i);
        for (let i = min; i <= end; i++) values.add(i);
      } else {
        for (let i = start; i <= end; i++) values.add(i);
      }
    } else {
      const num = parseInt(part, 10);
      if (isNaN(num)) {
        throw new CronParseError(
          `Invalid value in ${fieldName}: ${part}`,
          expression,
        );
      }
      if (num < min || num > max) {
        throw new CronParseError(
          `Value ${num} out of range [${min}-${max}] in ${fieldName}`,
          expression,
        );
      }
      values.add(num);
    }
  }

  return Array.from(values).sort((a, b) => a - b);
}

export function parse(expression: string): CronExpression {
  const raw = expression.trim();

  // Check presets
  const preset = PRESETS[raw.toLowerCase()];
  if (preset) {
    return parse(preset);
  }

  const parts = raw.split(/\s+/);
  let hasSeconds = false;

  if (parts.length === 6) {
    hasSeconds = true;
  } else if (parts.length === 5) {
    hasSeconds = false;
  } else {
    throw new CronParseError(
      `Expected 5 or 6 fields, got ${parts.length}`,
      raw,
    );
  }

  const fields = hasSeconds
    ? parts
    : ["0", ...parts]; // Default seconds to 0

  // Replace month and day names
  fields[4] = replaceNames(fields[4], MONTH_NAMES);
  fields[5] = replaceNames(fields[5], DAY_NAMES);

  return {
    second: fields[0],
    minute: fields[1],
    hour: fields[2],
    dayOfMonth: fields[3],
    month: fields[4],
    dayOfWeek: fields[5],
    raw,
  };
}

export function isValid(expression: string): boolean {
  try {
    parse(expression);
    return true;
  } catch {
    return false;
  }
}

interface ParsedFields {
  seconds: number[];
  minutes: number[];
  hours: number[];
  daysOfMonth: number[];
  months: number[];
  daysOfWeek: number[];
}

function parseAllFields(expr: CronExpression): ParsedFields {
  const raw = expr.raw;
  return {
    seconds: parseField(expr.second ?? "0", 0, 59, "second", raw),
    minutes: parseField(expr.minute, 0, 59, "minute", raw),
    hours: parseField(expr.hour, 0, 23, "hour", raw),
    daysOfMonth: parseField(expr.dayOfMonth, 1, 31, "dayOfMonth", raw),
    months: parseField(expr.month, 1, 12, "month", raw),
    daysOfWeek: parseField(expr.dayOfWeek, 0, 6, "dayOfWeek", raw),
  };
}

function findNext(values: number[], current: number): number | undefined {
  for (const v of values) {
    if (v > current) return v;
  }
  return undefined;
}

export function getNextDate(expression: string, from?: Date): Date {
  const expr = parse(expression);
  const fields = parseAllFields(expr);
  const start = from ? new Date(from.getTime()) : new Date();

  // Move 1 second forward to avoid matching current time
  start.setMilliseconds(0);
  start.setSeconds(start.getSeconds() + 1);

  // Search up to 4 years ahead
  const limit = new Date(start.getTime());
  limit.setFullYear(limit.getFullYear() + 4);

  const current = new Date(start.getTime());

  while (current < limit) {
    // Check month
    if (!fields.months.includes(current.getMonth() + 1)) {
      // Advance to next valid month
      const nextMonth = findNext(fields.months, current.getMonth() + 1);
      if (nextMonth !== undefined) {
        current.setMonth(nextMonth - 1, 1);
        current.setHours(fields.hours[0], fields.minutes[0], fields.seconds[0]);
      } else {
        current.setFullYear(current.getFullYear() + 1);
        current.setMonth(fields.months[0] - 1, 1);
        current.setHours(fields.hours[0], fields.minutes[0], fields.seconds[0]);
      }
      continue;
    }

    // Check day of month and day of week
    const dayOfMonth = current.getDate();
    const dayOfWeek = current.getDay();
    const isDayOfMonthWild = expr.dayOfMonth === "*";
    const isDayOfWeekWild = expr.dayOfWeek === "*";

    let dayMatch = false;
    if (isDayOfMonthWild && isDayOfWeekWild) {
      dayMatch = true;
    } else if (isDayOfMonthWild) {
      dayMatch = fields.daysOfWeek.includes(dayOfWeek);
    } else if (isDayOfWeekWild) {
      dayMatch = fields.daysOfMonth.includes(dayOfMonth);
    } else {
      // Both specified: match either (standard cron behavior)
      dayMatch =
        fields.daysOfMonth.includes(dayOfMonth) ||
        fields.daysOfWeek.includes(dayOfWeek);
    }

    if (!dayMatch) {
      current.setDate(current.getDate() + 1);
      current.setHours(fields.hours[0], fields.minutes[0], fields.seconds[0]);
      continue;
    }

    // Check hour
    if (!fields.hours.includes(current.getHours())) {
      const nextHour = findNext(fields.hours, current.getHours());
      if (nextHour !== undefined) {
        current.setHours(nextHour, fields.minutes[0], fields.seconds[0]);
      } else {
        current.setDate(current.getDate() + 1);
        current.setHours(fields.hours[0], fields.minutes[0], fields.seconds[0]);
      }
      continue;
    }

    // Check minute
    if (!fields.minutes.includes(current.getMinutes())) {
      const nextMinute = findNext(fields.minutes, current.getMinutes());
      if (nextMinute !== undefined) {
        current.setMinutes(nextMinute, fields.seconds[0]);
      } else {
        current.setHours(current.getHours() + 1, fields.minutes[0], fields.seconds[0]);
      }
      continue;
    }

    // Check second
    if (!fields.seconds.includes(current.getSeconds())) {
      const nextSecond = findNext(fields.seconds, current.getSeconds());
      if (nextSecond !== undefined) {
        current.setSeconds(nextSecond);
      } else {
        current.setMinutes(current.getMinutes() + 1, fields.seconds[0]);
      }
      continue;
    }

    // All fields match
    return current;
  }

  throw new CronParseError("Could not find next execution date within 4 years", expression);
}

export function getNextDates(
  expression: string,
  count: number,
  from?: Date,
): Date[] {
  const dates: Date[] = [];
  let current = from;

  for (let i = 0; i < count; i++) {
    const next = getNextDate(expression, current);
    dates.push(next);
    current = next;
  }

  return dates;
}

export function describe(expression: string): string {
  const expr = parse(expression);
  const parts: string[] = [];

  if (expr.second && expr.second !== "0") {
    parts.push(`second ${expr.second}`);
  }

  if (expr.minute === "*") {
    parts.push("every minute");
  } else if (expr.minute.includes("/")) {
    const step = expr.minute.split("/")[1];
    parts.push(`every ${step} minutes`);
  } else {
    parts.push(`at minute ${expr.minute}`);
  }

  if (expr.hour === "*") {
    parts.push("of every hour");
  } else if (expr.hour.includes("/")) {
    const step = expr.hour.split("/")[1];
    parts.push(`every ${step} hours`);
  } else {
    parts.push(`at hour ${expr.hour}`);
  }

  if (expr.dayOfMonth !== "*") {
    parts.push(`on day ${expr.dayOfMonth}`);
  }

  if (expr.month !== "*") {
    parts.push(`in month ${expr.month}`);
  }

  if (expr.dayOfWeek !== "*") {
    parts.push(`on weekday ${expr.dayOfWeek}`);
  }

  return parts.join(" ");
}
