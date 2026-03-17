// Mailer types

export interface MailAddress {
  name?: string;
  address: string;
}

export type AddressInput = string | MailAddress | Array<string | MailAddress>;

export interface Attachment {
  filename: string;
  content: string | Buffer;
  contentType?: string;
  encoding?: "base64" | "quoted-printable" | "7bit" | "8bit";
  cid?: string;
}

export interface MailMessage {
  from?: AddressInput;
  to: AddressInput;
  cc?: AddressInput;
  bcc?: AddressInput;
  replyTo?: AddressInput;
  subject: string;
  text?: string;
  html?: string;
  attachments?: Attachment[];
  headers?: Record<string, string>;
  priority?: "high" | "normal" | "low";
  messageId?: string;
}

export interface SendResult {
  messageId: string;
  accepted: string[];
  rejected: string[];
  response?: string;
}

export interface TransportConfig {
  type: "smtp" | "memory" | "stream";
}

export interface SmtpConfig extends TransportConfig {
  type: "smtp";
  host: string;
  port: number;
  secure?: boolean;
  auth?: {
    user: string;
    pass: string;
  };
  connectionTimeout?: number;
  socketTimeout?: number;
  maxConnections?: number;
}

export interface MemoryTransportConfig extends TransportConfig {
  type: "memory";
}

export interface StreamTransportConfig extends TransportConfig {
  type: "stream";
  destination?: "stdout" | "stderr";
}

export interface MailerOptions {
  transport?: TransportConfig;
  defaults?: Partial<MailMessage>;
}

export interface TemplateData {
  [key: string]: unknown;
}
