// In-memory transport for testing

import { generateMessageId, normalizeAddresses } from "../mime.js";
import type { MailMessage, SendResult } from "../types.js";
import { Transport } from "./transport.js";

export interface SentMessage {
  message: MailMessage;
  result: SendResult;
  timestamp: number;
}

export class MemoryTransport extends Transport {
  private readonly sent: SentMessage[] = [];

  async send(message: MailMessage): Promise<SendResult> {
    const messageId = message.messageId ?? generateMessageId();
    const toAddresses = normalizeAddresses(message.to).map((a) => a.address);
    const ccAddresses = message.cc
      ? normalizeAddresses(message.cc).map((a) => a.address)
      : [];
    const bccAddresses = message.bcc
      ? normalizeAddresses(message.bcc).map((a) => a.address)
      : [];

    const accepted = [...toAddresses, ...ccAddresses, ...bccAddresses];

    const result: SendResult = {
      messageId,
      accepted,
      rejected: [],
      response: "Message stored in memory",
    };

    this.sent.push({
      message,
      result,
      timestamp: Date.now(),
    });

    return result;
  }

  getSentMessages(): SentMessage[] {
    return [...this.sent];
  }

  getLastMessage(): SentMessage | undefined {
    return this.sent[this.sent.length - 1];
  }

  clear(): void {
    this.sent.length = 0;
  }

  count(): number {
    return this.sent.length;
  }

  async close(): Promise<void> {
    // Nothing to close
  }
}
