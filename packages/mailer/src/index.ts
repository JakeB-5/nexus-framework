// @nexus/mailer - Email sending with template support

export { Mailer } from "./mailer.js";
export { MessageBuilder, buildRawMessage } from "./message.js";
export {
  compile,
  renderTemplate,
  clearTemplateCache,
} from "./template.js";
export {
  getMimeType,
  base64Encode,
  base64Decode,
  quotedPrintableEncode,
  parseEmailAddress,
  formatEmailAddress,
  normalizeAddresses,
  formatAddressList,
  isValidEmail,
  generateBoundary,
  generateMessageId,
} from "./mime.js";
export { Transport } from "./transports/transport.js";
export { MemoryTransport } from "./transports/memory-transport.js";
export type { SentMessage } from "./transports/memory-transport.js";
export { StreamTransport } from "./transports/stream-transport.js";
export { SmtpTransport } from "./transports/smtp-transport.js";
export { MailerModule } from "./mailer-module.js";
export type { MailerModuleOptions } from "./mailer-module.js";
export { MailError, SmtpError, TemplateError } from "./errors.js";
export type {
  MailAddress,
  AddressInput,
  Attachment,
  MailMessage,
  SendResult,
  TransportConfig,
  SmtpConfig,
  MemoryTransportConfig,
  StreamTransportConfig,
  MailerOptions,
  TemplateData,
} from "./types.js";
