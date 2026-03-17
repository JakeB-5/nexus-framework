// Mailer class - main entry point

import { MailError } from "./errors.js";
import { MessageBuilder } from "./message.js";
import { renderTemplate } from "./template.js";
import { MemoryTransport } from "./transports/memory-transport.js";
import type { Transport } from "./transports/transport.js";
import type {
  AddressInput,
  MailMessage,
  SendResult,
  TemplateData,
} from "./types.js";

export class Mailer {
  private readonly transport: Transport;
  private readonly defaults: Partial<MailMessage>;

  constructor(transport?: Transport, defaults?: Partial<MailMessage>) {
    this.transport = transport ?? new MemoryTransport();
    this.defaults = defaults ?? {};
  }

  static create(transport: Transport, defaults?: Partial<MailMessage>): Mailer {
    return new Mailer(transport, defaults);
  }

  async send(message: MailMessage): Promise<SendResult> {
    const merged: MailMessage = {
      ...this.defaults,
      ...message,
    };

    if (!merged.to) {
      throw new MailError("Recipient (to) is required");
    }
    if (!merged.subject) {
      throw new MailError("Subject is required");
    }

    return this.transport.send(merged);
  }

  async sendMany(messages: MailMessage[]): Promise<SendResult[]> {
    const results: SendResult[] = [];
    for (const message of messages) {
      const result = await this.send(message);
      results.push(result);
    }
    return results;
  }

  async sendTemplate(
    to: AddressInput,
    subject: string,
    template: string,
    data: TemplateData,
    options?: Partial<MailMessage>,
  ): Promise<SendResult> {
    const html = renderTemplate(template, data);
    return this.send({
      ...options,
      to,
      subject,
      html,
    });
  }

  message(): MailerMessageBuilder {
    return new MailerMessageBuilder(this);
  }

  getTransport(): Transport {
    return this.transport;
  }

  async close(): Promise<void> {
    await this.transport.close();
  }
}

class MailerMessageBuilder {
  private readonly mailer: Mailer;
  private readonly builder: MessageBuilder;

  constructor(mailer: Mailer) {
    this.mailer = mailer;
    this.builder = new MessageBuilder();
  }

  from(address: AddressInput): this {
    this.builder.from(address);
    return this;
  }

  to(addresses: AddressInput): this {
    this.builder.to(addresses);
    return this;
  }

  cc(addresses: AddressInput): this {
    this.builder.cc(addresses);
    return this;
  }

  bcc(addresses: AddressInput): this {
    this.builder.bcc(addresses);
    return this;
  }

  subject(text: string): this {
    this.builder.subject(text);
    return this;
  }

  text(body: string): this {
    this.builder.text(body);
    return this;
  }

  html(body: string): this {
    this.builder.html(body);
    return this;
  }

  replyTo(address: AddressInput): this {
    this.builder.replyTo(address);
    return this;
  }

  priority(level: "high" | "normal" | "low"): this {
    this.builder.priority(level);
    return this;
  }

  attach(
    filename: string,
    content: string | Buffer,
    contentType?: string,
  ): this {
    this.builder.attach(filename, content, contentType);
    return this;
  }

  async send(): Promise<SendResult> {
    const message = this.builder.build();
    return this.mailer.send(message);
  }
}
