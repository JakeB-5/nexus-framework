// @nexus/validator - Validation error types

/**
 * Validation issue codes
 */
export type ValidationIssueCode =
  | "invalid_type"
  | "invalid_literal"
  | "invalid_string"
  | "invalid_number"
  | "invalid_date"
  | "invalid_enum"
  | "invalid_union"
  | "invalid_arguments"
  | "invalid_return"
  | "too_small"
  | "too_big"
  | "not_multiple_of"
  | "not_finite"
  | "custom"
  | "invalid_intersection"
  | "unrecognized_keys";

/**
 * Single validation issue with path tracking
 */
export interface ValidationIssue {
  code: ValidationIssueCode;
  message: string;
  path: Array<string | number>;
  expected?: string;
  received?: string;
}

/**
 * Validation error containing all issues
 */
export class ValidationError extends Error {
  public readonly issues: ValidationIssue[];

  constructor(issues: ValidationIssue[]) {
    const message = ValidationError.formatIssues(issues);
    super(message);
    this.name = "ValidationError";
    this.issues = issues;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  /**
   * Get flattened field errors
   */
  flatten(): { formErrors: string[]; fieldErrors: Record<string, string[]> } {
    const formErrors: string[] = [];
    const fieldErrors: Record<string, string[]> = {};

    for (const issue of this.issues) {
      if (issue.path.length === 0) {
        formErrors.push(issue.message);
      } else {
        const key = issue.path.join(".");
        if (!fieldErrors[key]) {
          fieldErrors[key] = [];
        }
        fieldErrors[key].push(issue.message);
      }
    }

    return { formErrors, fieldErrors };
  }

  private static formatIssues(issues: ValidationIssue[]): string {
    if (issues.length === 0) {
      return "Validation failed";
    }
    if (issues.length === 1) {
      const issue = issues[0];
      const pathStr = issue.path.length > 0 ? ` at "${issue.path.join(".")}"` : "";
      return `${issue.message}${pathStr}`;
    }
    const lines = issues.map((issue) => {
      const pathStr = issue.path.length > 0 ? ` at "${issue.path.join(".")}"` : "";
      return `  - ${issue.message}${pathStr}`;
    });
    return `${issues.length} validation issues:\n${lines.join("\n")}`;
  }
}

/**
 * Format validation errors into human-readable strings
 */
export function formatErrors(error: ValidationError): string {
  return error.message;
}
