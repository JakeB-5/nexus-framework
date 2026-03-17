import { describe, it, expect } from "vitest";
import {
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
} from "../src/mime.js";

describe("MIME utilities", () => {
  describe("getMimeType", () => {
    it("should return correct MIME type for known extensions", () => {
      expect(getMimeType("file.txt")).toBe("text/plain");
      expect(getMimeType("page.html")).toBe("text/html");
      expect(getMimeType("image.png")).toBe("image/png");
      expect(getMimeType("data.json")).toBe("application/json");
      expect(getMimeType("archive.zip")).toBe("application/zip");
      expect(getMimeType("photo.jpg")).toBe("image/jpeg");
      expect(getMimeType("doc.pdf")).toBe("application/pdf");
    });

    it("should return octet-stream for unknown extensions", () => {
      expect(getMimeType("file.xyz")).toBe("application/octet-stream");
      expect(getMimeType("noext")).toBe("application/octet-stream");
    });
  });

  describe("base64", () => {
    it("should encode and decode strings", () => {
      const original = "Hello, World!";
      const encoded = base64Encode(original);
      const decoded = base64Decode(encoded);
      expect(decoded.toString("utf-8")).toBe(original);
    });

    it("should encode buffers", () => {
      const buf = Buffer.from([0x00, 0xff, 0x42]);
      const encoded = base64Encode(buf);
      expect(base64Decode(encoded)).toEqual(buf);
    });
  });

  describe("quotedPrintableEncode", () => {
    it("should pass through ASCII text", () => {
      const result = quotedPrintableEncode("Hello World");
      expect(result).toBe("Hello World");
    });

    it("should encode special characters", () => {
      const result = quotedPrintableEncode("price = €50");
      expect(result).toContain("=");
    });

    it("should encode equals sign", () => {
      const result = quotedPrintableEncode("a=b");
      expect(result).toContain("=3D");
    });
  });

  describe("parseEmailAddress", () => {
    it("should parse plain email", () => {
      const addr = parseEmailAddress("user@example.com");
      expect(addr.address).toBe("user@example.com");
    });

    it("should parse email with name", () => {
      const addr = parseEmailAddress("John Doe <john@example.com>");
      expect(addr.name).toBe("John Doe");
      expect(addr.address).toBe("john@example.com");
    });

    it("should parse quoted name", () => {
      const addr = parseEmailAddress('"Jane Doe" <jane@example.com>');
      expect(addr.name).toBe("Jane Doe");
      expect(addr.address).toBe("jane@example.com");
    });
  });

  describe("formatEmailAddress", () => {
    it("should format string address", () => {
      expect(formatEmailAddress("user@test.com")).toBe("user@test.com");
    });

    it("should format address with name", () => {
      const result = formatEmailAddress({
        name: "John",
        address: "john@test.com",
      });
      expect(result).toBe('"John" <john@test.com>');
    });

    it("should format address without name", () => {
      const result = formatEmailAddress({ address: "john@test.com" });
      expect(result).toBe("john@test.com");
    });
  });

  describe("normalizeAddresses", () => {
    it("should normalize string to array", () => {
      const result = normalizeAddresses("user@test.com");
      expect(result).toHaveLength(1);
      expect(result[0].address).toBe("user@test.com");
    });

    it("should normalize array of strings", () => {
      const result = normalizeAddresses(["a@test.com", "b@test.com"]);
      expect(result).toHaveLength(2);
    });

    it("should normalize MailAddress object", () => {
      const result = normalizeAddresses({
        name: "Test",
        address: "test@test.com",
      });
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Test");
    });

    it("should normalize mixed array", () => {
      const result = normalizeAddresses([
        "plain@test.com",
        { name: "Named", address: "named@test.com" },
      ]);
      expect(result).toHaveLength(2);
    });
  });

  describe("formatAddressList", () => {
    it("should format single address", () => {
      expect(formatAddressList("user@test.com")).toBe("user@test.com");
    });

    it("should format multiple addresses", () => {
      const result = formatAddressList(["a@test.com", "b@test.com"]);
      expect(result).toBe("a@test.com, b@test.com");
    });
  });

  describe("isValidEmail", () => {
    it("should accept valid emails", () => {
      expect(isValidEmail("user@example.com")).toBe(true);
      expect(isValidEmail("user+tag@domain.co.uk")).toBe(true);
      expect(isValidEmail("name.surname@test.org")).toBe(true);
    });

    it("should reject invalid emails", () => {
      expect(isValidEmail("notanemail")).toBe(false);
      expect(isValidEmail("@nodomain")).toBe(false);
      expect(isValidEmail("no@")).toBe(false);
      expect(isValidEmail("")).toBe(false);
    });
  });

  describe("generators", () => {
    it("should generate unique boundaries", () => {
      const b1 = generateBoundary();
      const b2 = generateBoundary();
      expect(b1).not.toBe(b2);
      expect(b1).toContain("nexus_");
    });

    it("should generate unique message IDs", () => {
      const id1 = generateMessageId();
      const id2 = generateMessageId();
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^<.+@.+>$/);
    });

    it("should use custom domain in message ID", () => {
      const id = generateMessageId("example.com");
      expect(id).toContain("@example.com>");
    });
  });
});
