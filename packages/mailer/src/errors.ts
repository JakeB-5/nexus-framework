// Mailer error classes

export class MailError extends Error {
  public readonly code: string = "MAIL_ERROR";

  constructor(message: string) {
    super(message);
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
