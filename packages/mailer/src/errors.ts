// Mailer error classes

import { NexusError } from "@nexus/core";

export class MailError extends NexusError {
  constructor(message: string) {
    super(message, { code: "MAIL_ERROR" });
    this.name = "MailError";
  }
}

export class SmtpError extends MailError {
  public readonly code = "SMTP_ERROR";
  public readonly responseCode?: number;

  constructor(message: string, responseCode?: number) {
    super(message);
    this.name = "SmtpError";
    this.responseCode = responseCode;
  }
}

export class TemplateError extends MailError {
  public readonly code = "TEMPLATE_ERROR";

  constructor(message: string) {
    super(message);
    this.name = "TemplateError";
  }
}
