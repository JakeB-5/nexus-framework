// @nexus/ws - Message protocol
import { randomUUID } from "node:crypto";
import { ProtocolError } from "./errors.js";
import type { WsMessage } from "./types.js";

export function encodeMessage(event: string, data: unknown, options?: { id?: string; ack?: boolean }): string {
  const message: WsMessage = {
    event,
    data,
    id: options?.id ?? randomUUID(),
    ack: options?.ack,
  };
  return JSON.stringify(message);
}

export function decodeMessage(raw: string | Buffer): WsMessage {
  const text = typeof raw === "string" ? raw : raw.toString("utf-8");

  if (text.length === 0) {
    throw new ProtocolError("Empty message received");
  }

  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;

    if (typeof parsed !== "object" || parsed === null) {
      throw new ProtocolError("Message must be a JSON object");
    }

    if (typeof parsed.event !== "string" || parsed.event.length === 0) {
      throw new ProtocolError("Message must have a non-empty 'event' field");
    }

    return {
      event: parsed.event,
      data: parsed.data,
      id: typeof parsed.id === "string" ? parsed.id : undefined,
      ack: typeof parsed.ack === "boolean" ? parsed.ack : undefined,
    };
  } catch (err) {
    if (err instanceof ProtocolError) {
      throw err;
    }
    throw new ProtocolError(`Invalid JSON message: ${(err as Error).message}`);
  }
}

export function createAck(messageId: string, data?: unknown): string {
  return encodeMessage("__ack__", data ?? null, { id: messageId, ack: true });
}

export function isAck(message: WsMessage): boolean {
  return message.event === "__ack__" && message.ack === true;
}

export function createPing(): string {
  return encodeMessage("__ping__", null);
}

export function createPong(): string {
  return encodeMessage("__pong__", null);
}

export function isPing(message: WsMessage): boolean {
  return message.event === "__ping__";
}

export function isPong(message: WsMessage): boolean {
  return message.event === "__pong__";
}
