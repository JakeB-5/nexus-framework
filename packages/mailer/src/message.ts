// Mail message builder

import {
  base64Encode,
  formatAddressList,
  generateBoundary,
  generateMessageId,
  getMimeType,
} from "./mime.js";
import type { AddressInput, Attachment, MailMessage } from "./types.js";

export class MessageBuilder {
  private msg: Partial<MailMessage> = {};
  private readonly _attachments: Attachment[] = [];

  from(address: AddressInput): this {
    this.msg.from = address;
    return this;
  }

  to(addresses: AddressInput): this {
    this.msg.to = addresses;
    return this;
  }

  cc(addresses: AddressInput): this {
    this.msg.cc = addresses;
    return this;
  }

  bcc(addresses: AddressInput): this {
    this.msg.bcc = addresses;
    return this;
  }

  replyTo(address: AddressInput): this {
    this.msg.replyTo = address;
    return this;
  }

  subject(text: string): this {
    this.msg.subject = text;
    return this;
  }

  text(body: string): this {
    this.msg.text = body;
    return this;
  }

  html(body: string): this {
    this.msg.html = body;
    return this;
  }

  priority(level: "high" | "normal" | "low"): this {
    this.msg.priority = level;
    return this;
  }

  header(name: string, value: string): this {
    if (!this.msg.headers) {
      this.msg.headers = {};
    }
    this.msg.headers[name] = value;
    return this;
  }

  attach(
    filename: string,
    content: string | Buffer,
    contentType?: string,
  ): this {
    this._attachments.push({
      filename,
      content,
      contentType: contentType ?? getMimeType(filename),
    });
    return this;
  }

  embedImage(
    cid: string,
    content: string | Buffer,
    contentType?: string,
  ): this {
    this._attachments.push({
      filename: cid,
      content,
      contentType: contentType ?? "image/png",
      cid,
    });
    return this;
  }

  build(): MailMessage {
    if (!this.msg.to) {
      throw new Error("Recipient (to) is required");
    }
    if (!this.msg.subject) {
      throw new Error("Subject is required");
    }

    return {
      ...this.msg,
      to: this.msg.to,
      subject: this.msg.subject,
      attachments:
        this._attachments.length > 0 ? this._attachments : undefined,
    };
  }
}

export function buildRawMessage(message: MailMessage): string {
  const lines: string[] = [];
  const messageId = message.messageId ?? generateMessageId();

  // Headers
  lines.push(`Message-ID: ${messageId}`);
  lines.push(`Date: ${new Date().toUTCString()}`);
  lines.push(`MIME-Version: 1.0`);

  if (message.from) {
    lines.push(`From: ${formatAddressList(message.from)}`);
  }
  lines.push(`To: ${formatAddressList(message.to)}`);

  if (message.cc) {
    lines.push(`Cc: ${formatAddressList(message.cc)}`);
  }
  lines.push(`Subject: ${message.subject}`);

  if (message.replyTo) {
    lines.push(`Reply-To: ${formatAddressList(message.replyTo)}`);
  }

  if (message.priority) {
    const priorityMap = { high: "1", normal: "3", low: "5" };
    lines.push(`X-Priority: ${priorityMap[message.priority]}`);
  }

  if (message.headers) {
    for (const [name, value] of Object.entries(message.headers)) {
      lines.push(`${name}: ${value}`);
    }
  }

  const hasAttachments =
    message.attachments && message.attachments.length > 0;
  const hasHtml = !!message.html;
  const hasText = !!message.text;

  if (hasAttachments) {
    const boundary = generateBoundary();
    lines.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
    lines.push("");

    if (hasHtml && hasText) {
      const altBoundary = generateBoundary();
      lines.push(`--${boundary}`);
      lines.push(
        `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
      );
      lines.push("");
      lines.push(`--${altBoundary}`);
      lines.push("Content-Type: text/plain; charset=utf-8");
      lines.push("Content-Transfer-Encoding: quoted-printable");
      lines.push("");
      lines.push(message.text!);
      lines.push(`--${altBoundary}`);
      lines.push("Content-Type: text/html; charset=utf-8");
      lines.push("Content-Transfer-Encoding: quoted-printable");
      lines.push("");
      lines.push(message.html!);
      lines.push(`--${altBoundary}--`);
    } else if (hasHtml) {
      lines.push(`--${boundary}`);
      lines.push("Content-Type: text/html; charset=utf-8");
      lines.push("Content-Transfer-Encoding: quoted-printable");
      lines.push("");
      lines.push(message.html!);
    } else if (hasText) {
      lines.push(`--${boundary}`);
      lines.push("Content-Type: text/plain; charset=utf-8");
      lines.push("Content-Transfer-Encoding: quoted-printable");
      lines.push("");
      lines.push(message.text!);
    }

    for (const att of message.attachments!) {
      lines.push(`--${boundary}`);
      const ct = att.contentType ?? getMimeType(att.filename);

      if (att.cid) {
        lines.push(`Content-Type: ${ct}; name="${att.filename}"`);
        lines.push("Content-Transfer-Encoding: base64");
        lines.push(`Content-Disposition: inline; filename="${att.filename}"`);
        lines.push(`Content-ID: <${att.cid}>`);
      } else {
        lines.push(`Content-Type: ${ct}; name="${att.filename}"`);
        lines.push("Content-Transfer-Encoding: base64");
        lines.push(
          `Content-Disposition: attachment; filename="${att.filename}"`,
        );
      }

      lines.push("");
      const content =
        typeof att.content === "string"
          ? att.content
          : base64Encode(att.content);
      lines.push(content);
    }

    lines.push(`--${boundary}--`);
  } else if (hasHtml && hasText) {
    const boundary = generateBoundary();
    lines.push(
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
    );
    lines.push("");
    lines.push(`--${boundary}`);
    lines.push("Content-Type: text/plain; charset=utf-8");
    lines.push("Content-Transfer-Encoding: quoted-printable");
    lines.push("");
    lines.push(message.text!);
    lines.push(`--${boundary}`);
    lines.push("Content-Type: text/html; charset=utf-8");
    lines.push("Content-Transfer-Encoding: quoted-printable");
    lines.push("");
    lines.push(message.html!);
    lines.push(`--${boundary}--`);
  } else if (hasHtml) {
    lines.push("Content-Type: text/html; charset=utf-8");
    lines.push("Content-Transfer-Encoding: quoted-printable");
    lines.push("");
    lines.push(message.html!);
  } else {
    lines.push("Content-Type: text/plain; charset=utf-8");
    lines.push("Content-Transfer-Encoding: quoted-printable");
    lines.push("");
    lines.push(message.text ?? "");
  }

  return lines.join("\r\n");
}
