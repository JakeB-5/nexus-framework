// @nexus/cli - Template engine for code generation

import * as fs from "node:fs";
import * as path from "node:path";
import type { TemplateDefinition, TemplateFile } from "./types.js";
import { TemplateError } from "./errors.js";

/**
 * Simple template engine for code scaffolding.
 * Supports {{variable}} interpolation.
 */
export class TemplateEngine {
  private templates = new Map<string, TemplateDefinition>();

  /**
   * Register a template definition.
   */
  register(template: TemplateDefinition): this {
    this.templates.set(template.name, template);
    return this;
  }

  /**
   * Get a registered template.
   */
  get(name: string): TemplateDefinition | undefined {
    return this.templates.get(name);
  }

  /**
   * Get all registered template names.
   */
  getNames(): string[] {
    return [...this.templates.keys()];
  }

  /**
   * Generate files from a template with the given variables.
   */
  generate(
    templateName: string,
    variables: Record<string, string>,
    outputDir: string,
  ): string[] {
    const template = this.templates.get(templateName);
    if (!template) {
      throw new TemplateError(`Template not found: ${templateName}`);
    }

    const generatedFiles: string[] = [];

    for (const file of template.files) {
      const filePath = this.interpolate(file.path, variables);
      const content = this.interpolate(file.content, variables);
      const fullPath = path.resolve(outputDir, filePath);

      this.writeFile(fullPath, content);
      generatedFiles.push(fullPath);
    }

    return generatedFiles;
  }

  /**
   * Preview what files would be generated (without writing).
   */
  preview(
    templateName: string,
    variables: Record<string, string>,
  ): Array<{ path: string; content: string }> {
    const template = this.templates.get(templateName);
    if (!template) {
      throw new TemplateError(`Template not found: ${templateName}`);
    }

    return template.files.map((file) => ({
      path: this.interpolate(file.path, variables),
      content: this.interpolate(file.content, variables),
    }));
  }

  /**
   * Replace {{variable}} placeholders in a string.
   */
  interpolate(template: string, variables: Record<string, string>): string {
    return template.replace(
      /\{\{(\w+)\}\}/g,
      (_match, key: string) => {
        if (key in variables) {
          return variables[key];
        }
        return `{{${key}}}`;
      },
    );
  }

  private writeFile(filePath: string, content: string): void {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (fs.existsSync(filePath)) {
      throw new TemplateError(
        `File already exists: ${filePath}. Use --force to overwrite.`,
      );
    }

    fs.writeFileSync(filePath, content, "utf-8");
  }
}

/**
 * Helper to create a template file definition.
 */
export function templateFile(
  filePath: string,
  content: string,
): TemplateFile {
  return { path: filePath, content };
}

/**
 * Built-in templates for common scaffolding tasks.
 */
export function getBuiltinTemplates(): TemplateDefinition[] {
  return [
    {
      name: "module",
      files: [
        templateFile(
          "src/{{name}}/{{name}}.module.ts",
          `import { Module } from "@nexus/core";

@Module({
  providers: [],
  exports: [],
})
export class {{Name}}Module {}
`,
        ),
        templateFile(
          "src/{{name}}/{{name}}.service.ts",
          `import { Injectable } from "@nexus/core";

@Injectable()
export class {{Name}}Service {
  // TODO: implement service methods
}
`,
        ),
        templateFile(
          "src/{{name}}/index.ts",
          `export { {{Name}}Module } from "./{{name}}.module.js";
export { {{Name}}Service } from "./{{name}}.service.js";
`,
        ),
      ],
    },
    {
      name: "service",
      files: [
        templateFile(
          "src/{{name}}.service.ts",
          `import { Injectable } from "@nexus/core";

@Injectable()
export class {{Name}}Service {
  // TODO: implement service methods
}
`,
        ),
      ],
    },
  ];
}
