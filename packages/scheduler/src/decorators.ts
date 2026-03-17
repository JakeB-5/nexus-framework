// @Cron decorator for method-level scheduling

import type { ScheduledJobOptions } from "./types.js";

// Metadata storage for decorated methods
const CRON_METADATA = new Map<
  object,
  Array<{ method: string; expression: string; options?: ScheduledJobOptions }>
>();

export function Cron(
  expression: string,
  options?: ScheduledJobOptions,
): MethodDecorator {
  return function (
    target: object,
    propertyKey: string | symbol,
    _descriptor: PropertyDescriptor,
  ): void {
    const existing = CRON_METADATA.get(target) ?? [];
    existing.push({
      method: String(propertyKey),
      expression,
      options,
    });
    CRON_METADATA.set(target, existing);
  };
}

export function getCronMetadata(
  target: object,
): Array<{
  method: string;
  expression: string;
  options?: ScheduledJobOptions;
}> {
  return CRON_METADATA.get(target) ?? [];
}
