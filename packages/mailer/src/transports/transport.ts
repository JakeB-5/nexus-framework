// Transport interface

import type { MailMessage, SendResult } from "../types.js";

export abstract class Transport {
  abstract send(message: MailMessage): Promise<SendResult>;
  abstract close(): Promise<void>;
}
