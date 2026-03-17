// SMTP transport - sends via SMTP protocol using node:net and node:tls

import { connect, type Socket } from "node:net";
import { connect as tlsConnect, type TLSSocket } from "node:tls";
import { SmtpError } from "../errors.js";
import { buildRawMessage } from "../message.js";
import { generateMessageId, normalizeAddresses } from "../mime.js";
import type { MailMessage, SendResult, SmtpConfig } from "../types.js";
import { Transport } from "./transport.js";

export class SmtpTransport extends Transport {
  private readonly config: SmtpConfig;
  private socket: Socket | TLSSocket | undefined;
  private connected = false;

  constructor(config: SmtpConfig) {
    super();
    this.config = {
      connectionTimeout: 30_000,
      socketTimeout: 60_000,
      ...config,
    };
  }

  async send(message: MailMessage): Promise<SendResult> {
    const messageId = message.messageId ?? generateMessageId();
    const toAddresses = normalizeAddresses(message.to).map((a) => a.address);
    const ccAddresses = message.cc
      ? normalizeAddresses(message.cc).map((a) => a.address)
      : [];
    const bccAddresses = message.bcc
      ? normalizeAddresses(message.bcc).map((a) => a.address)
      : [];

    const allRecipients = [...toAddresses, ...ccAddresses, ...bccAddresses];
    const fromAddress = message.from
      ? normalizeAddresses(message.from)[0].address
      : "noreply@localhost";

    try {
      await this.connect();
      await this.ehlo();

      if (!this.config.secure && this.config.port !== 465) {
        try {
          await this.sendCommand("STARTTLS");
          await this.upgradeToTls();
          await this.ehlo();
        } catch {
          // STARTTLS not supported, continue unencrypted
        }
      }

      if (this.config.auth) {
        await this.authenticate(this.config.auth.user, this.config.auth.pass);
      }

      await this.sendCommand(`MAIL FROM:<${fromAddress}>`);

      const accepted: string[] = [];
      const rejected: string[] = [];

      for (const recipient of allRecipients) {
        try {
          await this.sendCommand(`RCPT TO:<${recipient}>`);
          accepted.push(recipient);
        } catch {
          rejected.push(recipient);
        }
      }

      const raw = buildRawMessage({ ...message, messageId });
      await this.sendCommand("DATA");
      await this.sendData(raw);

      return {
        messageId,
        accepted,
        rejected,
        response: "Message sent via SMTP",
      };
    } finally {
      try {
        await this.sendCommand("QUIT");
      } catch {
        // Ignore QUIT errors
      }
      this.disconnect();
    }
  }

  private async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = this.config.connectionTimeout ?? 30_000;

      if (this.config.secure || this.config.port === 465) {
        this.socket = tlsConnect(
          {
            host: this.config.host,
            port: this.config.port,
            rejectUnauthorized: false,
          },
          () => {
            this.connected = true;
            resolve();
          },
        );
      } else {
        this.socket = connect(
          {
            host: this.config.host,
            port: this.config.port,
          },
          () => {
            this.connected = true;
            resolve();
          },
        );
      }

      this.socket.setTimeout(timeout);
      this.socket.on("error", (err) => {
        reject(new SmtpError(`Connection failed: ${err.message}`));
      });
      this.socket.on("timeout", () => {
        reject(new SmtpError("Connection timed out"));
        this.disconnect();
      });
    });
  }

  private disconnect(): void {
    if (this.socket) {
      this.socket.destroy();
      this.socket = undefined;
      this.connected = false;
    }
  }

  private async ehlo(): Promise<string> {
    return this.sendCommand("EHLO localhost");
  }

  private async authenticate(user: string, pass: string): Promise<void> {
    const credentials = Buffer.from(`\0${user}\0${pass}`).toString("base64");
    await this.sendCommand(`AUTH PLAIN ${credentials}`);
  }

  private async upgradeToTls(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new SmtpError("No socket to upgrade"));
        return;
      }

      const tlsSocket = tlsConnect({
        socket: this.socket,
        rejectUnauthorized: false,
      });

      tlsSocket.on("secureConnect", () => {
        this.socket = tlsSocket;
        resolve();
      });

      tlsSocket.on("error", (err) => {
        reject(new SmtpError(`TLS upgrade failed: ${err.message}`));
      });
    });
  }

  private sendCommand(command: string): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.connected) {
        reject(new SmtpError("Not connected"));
        return;
      }

      this.socket.write(command + "\r\n");

      const onData = (data: Buffer): void => {
        const response = data.toString();
        const code = parseInt(response.substring(0, 3), 10);

        this.socket?.removeListener("data", onData);

        if (code >= 200 && code < 400) {
          resolve(response);
        } else {
          reject(new SmtpError(response.trim(), code));
        }
      };

      this.socket.on("data", onData);
    });
  }

  private sendData(data: string): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.connected) {
        reject(new SmtpError("Not connected"));
        return;
      }

      // Dot-stuff and terminate
      const stuffed = data.replace(/^\./gm, "..");
      this.socket.write(stuffed + "\r\n.\r\n");

      const onData = (chunk: Buffer): void => {
        const response = chunk.toString();
        this.socket?.removeListener("data", onData);
        resolve(response);
      };

      this.socket.on("data", onData);
    });
  }

  async close(): Promise<void> {
    this.disconnect();
  }
}
