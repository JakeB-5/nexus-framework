import { describe, it, expect } from "vitest";
import { Mailer } from "../src/mailer.js";
import { MessageBuilder, buildRawMessage } from "../src/message.js";
import { MemoryTransport } from "../src/transports/memory-transport.js";

describe("Mailer", () => {
  it("should send a simple email", async () => {
    const transport = new MemoryTransport();
    const mailer = new Mailer(transport);

    const result = await mailer.send({
      from: "sender@test.com",
      to: "recipient@test.com",
      subject: "Test",
      text: "Hello",
    });

    expect(result.messageId).toBeTruthy();
    expect(result.accepted).toContain("recipient@test.com");
    expect(transport.count()).toBe(1);
  });

  it("should send with defaults", async () => {
    const transport = new MemoryTransport();
    const mailer = Mailer.create(transport, { from: "default@test.com" });

    await mailer.send({
      to: "user@test.com",
      subject: "Test",
      text: "Hello",
    });

    const sent = transport.getLastMessage();
    expect(sent!.message.from).toBe("default@test.com");
  });

  it("should send many emails", async () => {
    const transport = new MemoryTransport();
    const mailer = new Mailer(transport);

    const results = await mailer.sendMany([
      { to: "a@test.com", subject: "A", text: "a" },
      { to: "b@test.com", subject: "B", text: "b" },
      { to: "c@test.com", subject: "C", text: "c" },
    ]);

    expect(results).toHaveLength(3);
    expect(transport.count()).toBe(3);
  });

  it("should throw on missing recipient", async () => {
    const mailer = new Mailer();
    await expect(
      mailer.send({ subject: "Test", text: "no recipient" } as never),
    ).rejects.toThrow("Recipient");
  });

  it("should throw on missing subject", async () => {
    const mailer = new Mailer();
    await expect(
      mailer.send({ to: "user@test.com" } as never),
    ).rejects.toThrow("Subject");
  });

  it("should send template email", async () => {
    const transport = new MemoryTransport();
    const mailer = new Mailer(transport);

    await mailer.sendTemplate(
      "user@test.com",
      "Welcome",
      "<h1>Hello {{name}}</h1>",
      { name: "Alice" },
    );

    const sent = transport.getLastMessage();
    expect(sent!.message.html).toBe("<h1>Hello Alice</h1>");
  });

  it("should support chainable message builder", async () => {
    const transport = new MemoryTransport();
    const mailer = new Mailer(transport);

    const result = await mailer
      .message()
      .from("sender@test.com")
      .to("recipient@test.com")
      .subject("Chain test")
      .text("Hello from chain")
      .priority("high")
      .send();

    expect(result.accepted).toContain("recipient@test.com");
    const sent = transport.getLastMessage();
    expect(sent!.message.priority).toBe("high");
  });

  it("should handle cc and bcc", async () => {
    const transport = new MemoryTransport();
    const mailer = new Mailer(transport);

    const result = await mailer.send({
      to: "to@test.com",
      cc: "cc@test.com",
      bcc: "bcc@test.com",
      subject: "Test",
      text: "Hello",
    });

    expect(result.accepted).toContain("to@test.com");
    expect(result.accepted).toContain("cc@test.com");
    expect(result.accepted).toContain("bcc@test.com");
  });

  it("should close transport", async () => {
    const transport = new MemoryTransport();
    const mailer = new Mailer(transport);
    await mailer.close();
    // No error means success
  });
});

describe("MessageBuilder", () => {
  it("should build a complete message", () => {
    const message = new MessageBuilder()
      .from("sender@test.com")
      .to("recipient@test.com")
      .cc("cc@test.com")
      .bcc("bcc@test.com")
      .replyTo("reply@test.com")
      .subject("Test Subject")
      .text("Hello text")
      .html("<p>Hello html</p>")
      .priority("high")
      .header("X-Custom", "value")
      .build();

    expect(message.from).toBe("sender@test.com");
    expect(message.to).toBe("recipient@test.com");
    expect(message.cc).toBe("cc@test.com");
    expect(message.subject).toBe("Test Subject");
    expect(message.text).toBe("Hello text");
    expect(message.html).toBe("<p>Hello html</p>");
    expect(message.priority).toBe("high");
    expect(message.headers!["X-Custom"]).toBe("value");
  });

  it("should throw without recipient", () => {
    expect(() =>
      new MessageBuilder().subject("Test").build(),
    ).toThrow("Recipient");
  });

  it("should throw without subject", () => {
    expect(() =>
      new MessageBuilder().to("user@test.com").build(),
    ).toThrow("Subject");
  });

  it("should support attachments", () => {
    const message = new MessageBuilder()
      .to("user@test.com")
      .subject("With attachment")
      .text("See attached")
      .attach("file.txt", "content", "text/plain")
      .build();

    expect(message.attachments).toHaveLength(1);
    expect(message.attachments![0].filename).toBe("file.txt");
  });

  it("should support embedded images", () => {
    const message = new MessageBuilder()
      .to("user@test.com")
      .subject("With image")
      .html('<img src="cid:logo">')
      .embedImage("logo", Buffer.from("fake-image"), "image/png")
      .build();

    expect(message.attachments).toHaveLength(1);
    expect(message.attachments![0].cid).toBe("logo");
  });
});

describe("buildRawMessage", () => {
  it("should build a raw text message", () => {
    const raw = buildRawMessage({
      from: "sender@test.com",
      to: "recipient@test.com",
      subject: "Test",
      text: "Hello",
    });

    expect(raw).toContain("From: sender@test.com");
    expect(raw).toContain("To: recipient@test.com");
    expect(raw).toContain("Subject: Test");
    expect(raw).toContain("Hello");
    expect(raw).toContain("MIME-Version: 1.0");
  });

  it("should build a multipart alternative for text+html", () => {
    const raw = buildRawMessage({
      to: "user@test.com",
      subject: "Test",
      text: "Plain",
      html: "<p>HTML</p>",
    });

    expect(raw).toContain("multipart/alternative");
    expect(raw).toContain("text/plain");
    expect(raw).toContain("text/html");
  });

  it("should include priority header", () => {
    const raw = buildRawMessage({
      to: "user@test.com",
      subject: "Urgent",
      text: "Important",
      priority: "high",
    });

    expect(raw).toContain("X-Priority: 1");
  });

  it("should include custom headers", () => {
    const raw = buildRawMessage({
      to: "user@test.com",
      subject: "Test",
      text: "Hello",
      headers: { "X-Custom": "value" },
    });

    expect(raw).toContain("X-Custom: value");
  });

  it("should include reply-to", () => {
    const raw = buildRawMessage({
      to: "user@test.com",
      subject: "Test",
      text: "Hello",
      replyTo: "reply@test.com",
    });

    expect(raw).toContain("Reply-To: reply@test.com");
  });
});

describe("MemoryTransport", () => {
  it("should store sent messages", async () => {
    const transport = new MemoryTransport();

    await transport.send({
      to: "user@test.com",
      subject: "Test",
      text: "Hello",
    });

    expect(transport.count()).toBe(1);
    const messages = transport.getSentMessages();
    expect(messages[0].message.subject).toBe("Test");
  });

  it("should get last message", async () => {
    const transport = new MemoryTransport();

    await transport.send({ to: "a@test.com", subject: "First", text: "a" });
    await transport.send({ to: "b@test.com", subject: "Second", text: "b" });

    const last = transport.getLastMessage();
    expect(last!.message.subject).toBe("Second");
  });

  it("should clear sent messages", async () => {
    const transport = new MemoryTransport();

    await transport.send({ to: "user@test.com", subject: "Test", text: "x" });
    transport.clear();

    expect(transport.count()).toBe(0);
    expect(transport.getLastMessage()).toBeUndefined();
  });
});
