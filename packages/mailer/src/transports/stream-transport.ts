// Stream transport - writes to writable stream

import { buildRawMessage } from "../message.js";
import { generateMessageId, normalizeAddresses } from "../mime.js";
import type { MailMessage, SendResult } from "../types.js";
import { Transport } from "./transport.js";

export class StreamTransport extends Transport {
  private readonly output: NodeJS.WritableStream;

  constructor(output?: NodeJS.WritableStream) {
    super();
    this.output = output ?? process.stdout;
  }

  async send(message: MailMessage): Promise<SendResult> {
    const messageId = message.messageId ?? generateMessageId();
    const raw = buildRawMessage({ ...message, messageId });
    const toAddresses = normalizeAddresses(message.to).map((a) => a.address);

    return new Promise((resolve, reject) => {
      const separator = "\n" + "=".repeat(72) + "\n";
      const data = separator + raw + separator;

      this.output.write(data, (err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve({
          messageId,
          accepted: toAddresses,
          rejected: [],
          response: "Written to stream",
        });
      });
    });
  }

  async close(): Promise<void> {
    // Don't close stdout/stderr
  }
}
