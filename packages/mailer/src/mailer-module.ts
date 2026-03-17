// Mailer module integration

import { Mailer } from "./mailer.js";
import { MemoryTransport } from "./transports/memory-transport.js";
import type { Transport } from "./transports/transport.js";
import type { MailMessage } from "./types.js";

export interface MailerModuleOptions {
  transport?: Transport;
  defaults?: Partial<MailMessage>;
}

export class MailerModule {
  public readonly mailer: Mailer;

  constructor(options: MailerModuleOptions = {}) {
    const transport = options.transport ?? new MemoryTransport();
    this.mailer = Mailer.create(transport, options.defaults);
  }

  async close(): Promise<void> {
    await this.mailer.close();
  }
}
