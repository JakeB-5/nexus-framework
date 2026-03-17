import { describe, it, expect, beforeEach } from "vitest";
import {
  compile,
  renderTemplate,
  clearTemplateCache,
} from "../src/template.js";
import { TemplateError } from "../src/errors.js";

describe("Template engine", () => {
  beforeEach(() => {
    clearTemplateCache();
  });

  describe("variable interpolation", () => {
    it("should replace simple variables", () => {
      const result = renderTemplate("Hello {{name}}!", { name: "World" });
      expect(result).toBe("Hello World!");
    });

    it("should handle multiple variables", () => {
      const result = renderTemplate("{{greeting}} {{name}}!", {
        greeting: "Hi",
        name: "Alice",
      });
      expect(result).toBe("Hi Alice!");
    });

    it("should return empty string for missing variables", () => {
      const result = renderTemplate("Hello {{name}}!", {});
      expect(result).toBe("Hello !");
    });

    it("should handle nested properties", () => {
      const result = renderTemplate("{{user.name}}", {
        user: { name: "Bob" },
      });
      expect(result).toBe("Bob");
    });

    it("should escape HTML by default", () => {
      const result = renderTemplate("{{content}}", {
        content: '<script>alert("xss")</script>',
      });
      expect(result).not.toContain("<script>");
      expect(result).toContain("&lt;script&gt;");
    });

    it("should not escape with triple mustache", () => {
      const result = renderTemplate("{{{content}}}", {
        content: "<b>bold</b>",
      });
      expect(result).toBe("<b>bold</b>");
    });
  });

  describe("conditionals", () => {
    it("should render if block when truthy", () => {
      const result = renderTemplate(
        "{{#if show}}visible{{/if}}",
        { show: true },
      );
      expect(result).toBe("visible");
    });

    it("should not render if block when falsy", () => {
      const result = renderTemplate(
        "{{#if show}}visible{{/if}}",
        { show: false },
      );
      expect(result).toBe("");
    });

    it("should handle if/else", () => {
      const tmpl = "{{#if loggedIn}}Welcome{{else}}Please login{{/if}}";
      expect(renderTemplate(tmpl, { loggedIn: true })).toBe("Welcome");
      expect(renderTemplate(tmpl, { loggedIn: false })).toBe("Please login");
    });

    it("should treat empty arrays as falsy", () => {
      const result = renderTemplate(
        "{{#if items}}has items{{else}}empty{{/if}}",
        { items: [] },
      );
      expect(result).toBe("empty");
    });

    it("should treat non-empty arrays as truthy", () => {
      const result = renderTemplate(
        "{{#if items}}has items{{/if}}",
        { items: [1] },
      );
      expect(result).toBe("has items");
    });

    it("should treat null/undefined as falsy", () => {
      const result = renderTemplate(
        "{{#if val}}yes{{else}}no{{/if}}",
        { val: null },
      );
      expect(result).toBe("no");
    });
  });

  describe("loops", () => {
    it("should iterate over arrays of objects", () => {
      const result = renderTemplate(
        "{{#each users}}{{name}} {{/each}}",
        { users: [{ name: "Alice" }, { name: "Bob" }] },
      );
      expect(result).toBe("Alice Bob ");
    });

    it("should handle empty arrays", () => {
      const result = renderTemplate(
        "{{#each items}}{{name}}{{/each}}",
        { items: [] },
      );
      expect(result).toBe("");
    });

    it("should provide @index", () => {
      const result = renderTemplate(
        "{{#each items}}{{@index}}{{/each}}",
        { items: ["a", "b", "c"] },
      );
      expect(result).toBe("012");
    });

    it("should provide @first and @last", () => {
      const result = renderTemplate(
        "{{#each items}}{{#if @first}}F{{/if}}{{#if @last}}L{{/if}}{{/each}}",
        { items: ["a", "b", "c"] },
      );
      expect(result).toBe("FL");
    });

    it("should handle undefined array gracefully", () => {
      const result = renderTemplate(
        "{{#each missing}}x{{/each}}",
        {},
      );
      expect(result).toBe("");
    });
  });

  describe("compilation and caching", () => {
    it("should compile template to function", () => {
      const fn = compile("Hello {{name}}!");
      expect(fn({ name: "World" })).toBe("Hello World!");
      expect(fn({ name: "Test" })).toBe("Hello Test!");
    });

    it("should cache compiled templates", () => {
      const fn1 = compile("{{x}}");
      const fn2 = compile("{{x}}");
      // Both should work (cache hit)
      expect(fn1({ x: "a" })).toBe("a");
      expect(fn2({ x: "b" })).toBe("b");
    });
  });

  describe("error handling", () => {
    it("should throw on unclosed mustache tag", () => {
      expect(() => renderTemplate("{{unclosed", {})).toThrow(TemplateError);
    });

    it("should throw on unclosed if block", () => {
      expect(() =>
        renderTemplate("{{#if x}}no close", { x: true }),
      ).toThrow(TemplateError);
    });

    it("should throw on unclosed each block", () => {
      expect(() =>
        renderTemplate("{{#each x}}no close", { x: [] }),
      ).toThrow(TemplateError);
    });

    it("should throw on unclosed triple mustache", () => {
      expect(() => renderTemplate("{{{unclosed", {})).toThrow(TemplateError);
    });
  });
});
