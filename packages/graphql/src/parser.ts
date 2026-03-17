// @nexus/graphql - GraphQL lexer, tokenizer and parser

import { GraphQLSyntaxError } from "./errors.js";
import {
  type ArgumentNode,
  type DirectiveNode,
  type DocumentNode,
  type EnumTypeDefinitionNode,
  type EnumValueDefinitionNode,
  type FieldDefinitionNode,
  type FieldNode,
  type FragmentDefinitionNode,
  type FragmentSpreadNode,
  type InlineFragmentNode,
  type InputObjectTypeDefinitionNode,
  type InputValueDefinitionNode,
  type InterfaceTypeDefinitionNode,
  type ListTypeNode,
  type NameNode,
  type NamedTypeNode,
  NodeKind,
  type ObjectFieldNode,
  type ObjectTypeDefinitionNode,
  type OperationDefinitionNode,
  type OperationTypeDefinitionNode,
  OperationType,
  type ScalarTypeDefinitionNode,
  type SchemaDefinitionNode,
  type SelectionNode,
  type SelectionSetNode,
  type TypeNode,
  type UnionTypeDefinitionNode,
  type ValueNode,
  type VariableDefinitionNode,
  type VariableNode,
} from "./types.js";

// ─── Token Types ──────────────────────────────────────────────────────────

export enum TokenKind {
  SOF = "<SOF>",
  EOF = "<EOF>",
  Bang = "!",
  Dollar = "$",
  Amp = "&",
  ParenL = "(",
  ParenR = ")",
  Spread = "...",
  Colon = ":",
  Equals = "=",
  At = "@",
  BracketL = "[",
  BracketR = "]",
  BraceL = "{",
  BraceR = "}",
  Pipe = "|",
  Name = "Name",
  Int = "Int",
  Float = "Float",
  String = "String",
  BlockString = "BlockString",
  Comment = "Comment",
}

export interface Token {
  kind: TokenKind;
  start: number;
  end: number;
  line: number;
  column: number;
  value: string;
}

// ─── Lexer ────────────────────────────────────────────────────────────────

export class Lexer {
  private source: string;
  private pos: number;
  private line: number;
  private lineStart: number;

  constructor(source: string) {
    this.source = source;
    this.pos = 0;
    this.line = 1;
    this.lineStart = 0;
  }

  nextToken(): Token {
    this.skipWhitespaceAndComments();

    if (this.pos >= this.source.length) {
      return this.makeToken(TokenKind.EOF, this.pos, this.pos, "");
    }

    const ch = this.source[this.pos];
    const start = this.pos;

    switch (ch) {
      case "!": this.pos++; return this.makeToken(TokenKind.Bang, start, this.pos, "!");
      case "$": this.pos++; return this.makeToken(TokenKind.Dollar, start, this.pos, "$");
      case "&": this.pos++; return this.makeToken(TokenKind.Amp, start, this.pos, "&");
      case "(": this.pos++; return this.makeToken(TokenKind.ParenL, start, this.pos, "(");
      case ")": this.pos++; return this.makeToken(TokenKind.ParenR, start, this.pos, ")");
      case ":": this.pos++; return this.makeToken(TokenKind.Colon, start, this.pos, ":");
      case "=": this.pos++; return this.makeToken(TokenKind.Equals, start, this.pos, "=");
      case "@": this.pos++; return this.makeToken(TokenKind.At, start, this.pos, "@");
      case "[": this.pos++; return this.makeToken(TokenKind.BracketL, start, this.pos, "[");
      case "]": this.pos++; return this.makeToken(TokenKind.BracketR, start, this.pos, "]");
      case "{": this.pos++; return this.makeToken(TokenKind.BraceL, start, this.pos, "{");
      case "}": this.pos++; return this.makeToken(TokenKind.BraceR, start, this.pos, "}");
      case "|": this.pos++; return this.makeToken(TokenKind.Pipe, start, this.pos, "|");
      case ".":
        if (this.source[this.pos + 1] === "." && this.source[this.pos + 2] === ".") {
          this.pos += 3;
          return this.makeToken(TokenKind.Spread, start, this.pos, "...");
        }
        throw this.syntaxError(`Unexpected character: "${ch}"`);
      case '"':
        if (this.source[this.pos + 1] === '"' && this.source[this.pos + 2] === '"') {
          return this.readBlockString(start);
        }
        return this.readString(start);
      default:
        if (ch === "-" || (ch >= "0" && ch <= "9")) {
          return this.readNumber(start);
        }
        if (ch === "_" || (ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z")) {
          return this.readName(start);
        }
        throw this.syntaxError(`Unexpected character: "${ch}"`);
    }
  }

  private skipWhitespaceAndComments(): void {
    while (this.pos < this.source.length) {
      const ch = this.source[this.pos];
      if (ch === " " || ch === "\t" || ch === ",") {
        this.pos++;
      } else if (ch === "\n") {
        this.pos++;
        this.line++;
        this.lineStart = this.pos;
      } else if (ch === "\r") {
        this.pos++;
        if (this.pos < this.source.length && this.source[this.pos] === "\n") {
          this.pos++;
        }
        this.line++;
        this.lineStart = this.pos;
      } else if (ch === "#") {
        // Comment: skip until end of line
        while (this.pos < this.source.length && this.source[this.pos] !== "\n" && this.source[this.pos] !== "\r") {
          this.pos++;
        }
      } else {
        break;
      }
    }
  }

  private readName(start: number): Token {
    while (this.pos < this.source.length) {
      const ch = this.source[this.pos];
      if (ch === "_" || (ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z") || (ch >= "0" && ch <= "9")) {
        this.pos++;
      } else {
        break;
      }
    }
    return this.makeToken(TokenKind.Name, start, this.pos, this.source.slice(start, this.pos));
  }

  private readNumber(start: number): Token {
    let isFloat = false;
    if (this.source[this.pos] === "-") {
      this.pos++;
    }
    if (this.source[this.pos] === "0") {
      this.pos++;
    } else {
      this.readDigits();
    }
    if (this.pos < this.source.length && this.source[this.pos] === ".") {
      isFloat = true;
      this.pos++;
      this.readDigits();
    }
    if (this.pos < this.source.length && (this.source[this.pos] === "e" || this.source[this.pos] === "E")) {
      isFloat = true;
      this.pos++;
      if (this.pos < this.source.length && (this.source[this.pos] === "+" || this.source[this.pos] === "-")) {
        this.pos++;
      }
      this.readDigits();
    }
    const value = this.source.slice(start, this.pos);
    return this.makeToken(isFloat ? TokenKind.Float : TokenKind.Int, start, this.pos, value);
  }

  private readDigits(): void {
    if (this.pos >= this.source.length || this.source[this.pos] < "0" || this.source[this.pos] > "9") {
      throw this.syntaxError("Expected digit");
    }
    while (this.pos < this.source.length && this.source[this.pos] >= "0" && this.source[this.pos] <= "9") {
      this.pos++;
    }
  }

  private readString(start: number): Token {
    this.pos++; // skip opening quote
    let value = "";
    while (this.pos < this.source.length) {
      const ch = this.source[this.pos];
      if (ch === '"') {
        this.pos++; // skip closing quote
        return this.makeToken(TokenKind.String, start, this.pos, value);
      }
      if (ch === "\\") {
        this.pos++;
        const escaped = this.source[this.pos];
        switch (escaped) {
          case '"': value += '"'; break;
          case "\\": value += "\\"; break;
          case "/": value += "/"; break;
          case "b": value += "\b"; break;
          case "f": value += "\f"; break;
          case "n": value += "\n"; break;
          case "r": value += "\r"; break;
          case "t": value += "\t"; break;
          case "u": {
            const hex = this.source.slice(this.pos + 1, this.pos + 5);
            if (!/^[0-9a-fA-F]{4}$/.test(hex)) {
              throw this.syntaxError("Invalid unicode escape sequence");
            }
            value += String.fromCharCode(parseInt(hex, 16));
            this.pos += 4;
            break;
          }
          default:
            throw this.syntaxError(`Invalid escape sequence: \\${escaped}`);
        }
        this.pos++;
      } else if (ch === "\n" || ch === "\r") {
        throw this.syntaxError("Unterminated string");
      } else {
        value += ch;
        this.pos++;
      }
    }
    throw this.syntaxError("Unterminated string");
  }

  private readBlockString(start: number): Token {
    this.pos += 3; // skip opening """
    let value = "";
    while (this.pos < this.source.length) {
      const ch = this.source[this.pos];
      if (ch === '"' && this.source[this.pos + 1] === '"' && this.source[this.pos + 2] === '"') {
        this.pos += 3;
        // Process block string indentation
        value = dedentBlockString(value);
        return this.makeToken(TokenKind.BlockString, start, this.pos, value);
      }
      if (ch === "\n") {
        this.line++;
        this.lineStart = this.pos + 1;
      } else if (ch === "\r") {
        this.line++;
        if (this.source[this.pos + 1] === "\n") {
          this.pos++;
        }
        this.lineStart = this.pos + 1;
      }
      value += ch;
      this.pos++;
    }
    throw this.syntaxError("Unterminated block string");
  }

  private makeToken(kind: TokenKind, start: number, end: number, value: string): Token {
    return {
      kind,
      start,
      end,
      line: this.line,
      column: start - this.lineStart + 1,
      value,
    };
  }

  private syntaxError(message: string): GraphQLSyntaxError {
    return new GraphQLSyntaxError(message, {
      line: this.line,
      column: this.pos - this.lineStart + 1,
    });
  }
}

function dedentBlockString(raw: string): string {
  const lines = raw.split(/\r\n|[\n\r]/);
  // Find common indentation
  let commonIndent: number | null = null;
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const indent = line.search(/\S/);
    if (indent >= 0 && (commonIndent === null || indent < commonIndent)) {
      commonIndent = indent;
    }
  }
  // Remove common indentation
  if (commonIndent !== null && commonIndent > 0) {
    for (let i = 1; i < lines.length; i++) {
      lines[i] = lines[i].slice(commonIndent);
    }
  }
  // Remove leading and trailing blank lines
  let start = 0;
  while (start < lines.length && lines[start].trim() === "") {
    start++;
  }
  let end = lines.length;
  while (end > start && lines[end - 1].trim() === "") {
    end--;
  }
  return lines.slice(start, end).join("\n");
}

// ─── Parser ───────────────────────────────────────────────────────────────

export class Parser {
  private lexer: Lexer;
  private token: Token;

  constructor(source: string) {
    this.lexer = new Lexer(source);
    this.token = this.lexer.nextToken();
  }

  parse(): DocumentNode {
    const definitions: DocumentNode["definitions"] = [];

    while (this.token.kind !== TokenKind.EOF) {
      definitions.push(this.parseDefinition());
    }

    return { kind: NodeKind.Document, definitions };
  }

  private parseDefinition(): DocumentNode["definitions"][number] {
    if (this.token.kind === TokenKind.BraceL) {
      // Short-hand query
      return this.parseOperationDefinition(OperationType.Query);
    }

    if (this.token.kind === TokenKind.Name) {
      switch (this.token.value) {
        case "query":
        case "mutation":
        case "subscription":
          return this.parseOperationDefinition();
        case "fragment":
          return this.parseFragmentDefinition();
        case "schema":
          return this.parseSchemaDefinition();
        case "scalar":
          return this.parseScalarTypeDefinition();
        case "type":
          return this.parseObjectTypeDefinition();
        case "interface":
          return this.parseInterfaceTypeDefinition();
        case "union":
          return this.parseUnionTypeDefinition();
        case "enum":
          return this.parseEnumTypeDefinition();
        case "input":
          return this.parseInputObjectTypeDefinition();
      }
    }

    // Handle descriptions before type definitions
    if (this.token.kind === TokenKind.String || this.token.kind === TokenKind.BlockString) {
      const desc = this.token.value;
      this.advance();
      return this.parseTypeDefinitionWithDescription(desc);
    }

    throw this.unexpected();
  }

  private parseTypeDefinitionWithDescription(description: string): DocumentNode["definitions"][number] {
    if (this.token.kind !== TokenKind.Name) {
      throw this.unexpected();
    }
    switch (this.token.value) {
      case "scalar": return this.parseScalarTypeDefinition(description);
      case "type": return this.parseObjectTypeDefinition(description);
      case "interface": return this.parseInterfaceTypeDefinition(description);
      case "union": return this.parseUnionTypeDefinition(description);
      case "enum": return this.parseEnumTypeDefinition(description);
      case "input": return this.parseInputObjectTypeDefinition(description);
      default: throw this.unexpected();
    }
  }

  // ─── Operations ───────────────────────────────────────────────────────

  private parseOperationDefinition(shorthand?: OperationType): OperationDefinitionNode {
    if (shorthand) {
      return {
        kind: NodeKind.OperationDefinition,
        operation: shorthand,
        variableDefinitions: [],
        directives: [],
        selectionSet: this.parseSelectionSet(),
      };
    }

    const operation = this.token.value as OperationType;
    this.advance();

    let name: NameNode | undefined;
    if (this.token.kind === TokenKind.Name) {
      name = this.parseName();
    }

    const variableDefinitions = this.parseVariableDefinitions();
    const directives = this.parseDirectives();
    const selectionSet = this.parseSelectionSet();

    return {
      kind: NodeKind.OperationDefinition,
      operation,
      name,
      variableDefinitions,
      directives,
      selectionSet,
    };
  }

  private parseVariableDefinitions(): VariableDefinitionNode[] {
    if (this.token.kind !== TokenKind.ParenL) {
      return [];
    }
    this.expect(TokenKind.ParenL);
    const defs: VariableDefinitionNode[] = [];
    while (this.peek() !== TokenKind.ParenR) {
      defs.push(this.parseVariableDefinition());
    }
    this.expect(TokenKind.ParenR);
    return defs;
  }

  private parseVariableDefinition(): VariableDefinitionNode {
    const variable = this.parseVariable();
    this.expect(TokenKind.Colon);
    const type = this.parseTypeReference();
    let defaultValue: ValueNode | undefined;
    if (this.peek() === TokenKind.Equals) {
      this.advance();
      defaultValue = this.parseValue(true);
    }
    return {
      kind: NodeKind.VariableDefinition,
      variable,
      type,
      defaultValue,
    };
  }

  private parseVariable(): VariableNode {
    this.expect(TokenKind.Dollar);
    return { kind: NodeKind.Variable, name: this.parseName() };
  }

  // ─── Selections ───────────────────────────────────────────────────────

  private parseSelectionSet(): SelectionSetNode {
    this.expect(TokenKind.BraceL);
    const selections: SelectionNode[] = [];
    while (this.peek() !== TokenKind.BraceR) {
      selections.push(this.parseSelection());
    }
    this.expect(TokenKind.BraceR);
    return { kind: NodeKind.SelectionSet, selections };
  }

  private parseSelection(): SelectionNode {
    if (this.token.kind === TokenKind.Spread) {
      return this.parseFragment();
    }
    return this.parseField();
  }

  private parseField(): FieldNode {
    const nameOrAlias = this.parseName();
    let alias: NameNode | undefined;
    let name: NameNode;

    if (this.token.kind === TokenKind.Colon) {
      this.advance();
      alias = nameOrAlias;
      name = this.parseName();
    } else {
      name = nameOrAlias;
    }

    const args = this.parseArguments();
    const directives = this.parseDirectives();
    let selectionSet: SelectionSetNode | undefined;
    if (this.token.kind === TokenKind.BraceL) {
      selectionSet = this.parseSelectionSet();
    }

    return {
      kind: NodeKind.Field,
      alias,
      name,
      arguments: args,
      directives,
      selectionSet,
    };
  }

  private parseArguments(): ArgumentNode[] {
    if (this.token.kind !== TokenKind.ParenL) {
      return [];
    }
    this.expect(TokenKind.ParenL);
    const args: ArgumentNode[] = [];
    while (this.peek() !== TokenKind.ParenR) {
      args.push(this.parseArgument());
    }
    this.expect(TokenKind.ParenR);
    return args;
  }

  private parseArgument(): ArgumentNode {
    const name = this.parseName();
    this.expect(TokenKind.Colon);
    const value = this.parseValue(false);
    return { kind: NodeKind.Argument, name, value };
  }

  // ─── Fragments ────────────────────────────────────────────────────────

  private parseFragment(): FragmentSpreadNode | InlineFragmentNode {
    this.expect(TokenKind.Spread);

    if (this.peek() === TokenKind.Name && this.token.value !== "on") {
      // Named fragment spread
      const name = this.parseName();
      const directives = this.parseDirectives();
      return { kind: NodeKind.FragmentSpread, name, directives };
    }

    // Inline fragment
    let typeCondition: NamedTypeNode | undefined;
    if (this.peek() === TokenKind.Name && this.token.value === "on") {
      this.advance();
      typeCondition = this.parseNamedType();
    }
    const directives = this.parseDirectives();
    const selectionSet = this.parseSelectionSet();
    return {
      kind: NodeKind.InlineFragment,
      typeCondition,
      directives,
      selectionSet,
    };
  }

  private parseFragmentDefinition(): FragmentDefinitionNode {
    this.expectKeyword("fragment");
    const name = this.parseName();
    this.expectKeyword("on");
    const typeCondition = this.parseNamedType();
    const directives = this.parseDirectives();
    const selectionSet = this.parseSelectionSet();
    return {
      kind: NodeKind.FragmentDefinition,
      name,
      typeCondition,
      directives,
      selectionSet,
    };
  }

  // ─── Values ───────────────────────────────────────────────────────────

  private parseValue(isConst: boolean): ValueNode {
    switch (this.token.kind) {
      case TokenKind.Dollar:
        if (!isConst) {
          return this.parseVariable();
        }
        throw this.unexpected();
      case TokenKind.Int: {
        const val = this.token.value;
        this.advance();
        return { kind: NodeKind.IntValue, value: val };
      }
      case TokenKind.Float: {
        const val = this.token.value;
        this.advance();
        return { kind: NodeKind.FloatValue, value: val };
      }
      case TokenKind.String:
      case TokenKind.BlockString: {
        const val = this.token.value;
        this.advance();
        return { kind: NodeKind.StringValue, value: val };
      }
      case TokenKind.Name:
        if (this.token.value === "true") {
          this.advance();
          return { kind: NodeKind.BooleanValue, value: true };
        }
        if (this.token.value === "false") {
          this.advance();
          return { kind: NodeKind.BooleanValue, value: false };
        }
        if (this.token.value === "null") {
          this.advance();
          return { kind: NodeKind.NullValue };
        }
        {
          const val = this.token.value;
          this.advance();
          return { kind: NodeKind.EnumValue, value: val };
        }
      case TokenKind.BracketL: {
        this.advance();
        const values: ValueNode[] = [];
        while (this.peek() !== TokenKind.BracketR) {
          values.push(this.parseValue(isConst));
        }
        this.expect(TokenKind.BracketR);
        return { kind: NodeKind.ListValue, values };
      }
      case TokenKind.BraceL: {
        this.advance();
        const fields: ObjectFieldNode[] = [];
        while (this.peek() !== TokenKind.BraceR) {
          const fieldName = this.parseName();
          this.expect(TokenKind.Colon);
          const fieldValue = this.parseValue(isConst);
          fields.push({ kind: NodeKind.ObjectField, name: fieldName, value: fieldValue });
        }
        this.expect(TokenKind.BraceR);
        return { kind: NodeKind.ObjectValue, fields };
      }
      default:
        throw this.unexpected();
    }
  }

  // ─── Directives ───────────────────────────────────────────────────────

  private parseDirectives(): DirectiveNode[] {
    const directives: DirectiveNode[] = [];
    while (this.token.kind === TokenKind.At) {
      this.advance();
      const name = this.parseName();
      const args = this.parseArguments();
      directives.push({ kind: NodeKind.Directive, name, arguments: args });
    }
    return directives;
  }

  // ─── Type References ──────────────────────────────────────────────────

  private parseTypeReference(): TypeNode {
    let type: TypeNode;
    if (this.token.kind === TokenKind.BracketL) {
      this.advance();
      const innerType = this.parseTypeReference();
      this.expect(TokenKind.BracketR);
      type = { kind: NodeKind.ListType, type: innerType } as ListTypeNode;
    } else {
      type = this.parseNamedType();
    }

    if (this.token.kind === TokenKind.Bang) {
      this.advance();
      return { kind: NodeKind.NonNullType, type: type as NamedTypeNode | ListTypeNode };
    }

    return type;
  }

  private parseNamedType(): NamedTypeNode {
    return { kind: NodeKind.NamedType, name: this.parseName() };
  }

  // ─── SDL Type Definitions ─────────────────────────────────────────────

  private parseSchemaDefinition(): SchemaDefinitionNode {
    this.expectKeyword("schema");
    this.expect(TokenKind.BraceL);
    const operationTypes: OperationTypeDefinitionNode[] = [];
    while (this.token.kind !== TokenKind.BraceR) {
      const operation = this.token.value as OperationType;
      this.advance();
      this.expect(TokenKind.Colon);
      const type = this.parseNamedType();
      operationTypes.push({
        kind: NodeKind.OperationTypeDefinition,
        operation,
        type,
      });
    }
    this.expect(TokenKind.BraceR);
    return { kind: NodeKind.SchemaDefinition, operationTypes };
  }

  private parseScalarTypeDefinition(description?: string): ScalarTypeDefinitionNode {
    this.expectKeyword("scalar");
    const name = this.parseName();
    return { kind: NodeKind.ScalarTypeDefinition, name, description };
  }

  private parseObjectTypeDefinition(description?: string): ObjectTypeDefinitionNode {
    this.expectKeyword("type");
    const name = this.parseName();
    const interfaces = this.parseImplementsInterfaces();
    const fields = this.parseFieldsDefinition();
    return {
      kind: NodeKind.ObjectTypeDefinition,
      name,
      interfaces,
      fields,
      description,
    };
  }

  private parseImplementsInterfaces(): NamedTypeNode[] {
    const interfaces: NamedTypeNode[] = [];
    if (this.peek() === TokenKind.Name && this.token.value === "implements") {
      this.advance();
      // Optional leading &
      if (this.peek() === TokenKind.Amp) {
        this.advance();
      }
      interfaces.push(this.parseNamedType());
      while (this.peek() === TokenKind.Amp) {
        this.advance();
        interfaces.push(this.parseNamedType());
      }
    }
    return interfaces;
  }

  private parseFieldsDefinition(): FieldDefinitionNode[] {
    if (this.peek() !== TokenKind.BraceL) {
      return [];
    }
    this.expect(TokenKind.BraceL);
    const fields: FieldDefinitionNode[] = [];
    while (this.peek() !== TokenKind.BraceR) {
      let fieldDesc: string | undefined;
      if (this.peek() === TokenKind.String || this.peek() === TokenKind.BlockString) {
        fieldDesc = this.token.value;
        this.advance();
      }
      const fieldName = this.parseName();
      const args = this.parseArgumentsDefinition();
      this.expect(TokenKind.Colon);
      const fieldType = this.parseTypeReference();
      fields.push({
        kind: NodeKind.FieldDefinition,
        name: fieldName,
        arguments: args,
        type: fieldType,
        description: fieldDesc,
      });
    }
    this.expect(TokenKind.BraceR);
    return fields;
  }

  private parseArgumentsDefinition(): InputValueDefinitionNode[] {
    if (this.peek() !== TokenKind.ParenL) {
      return [];
    }
    this.expect(TokenKind.ParenL);
    const args: InputValueDefinitionNode[] = [];
    while (this.peek() !== TokenKind.ParenR) {
      args.push(this.parseInputValueDefinition());
    }
    this.expect(TokenKind.ParenR);
    return args;
  }

  private parseInputValueDefinition(): InputValueDefinitionNode {
    let desc: string | undefined;
    if (this.peek() === TokenKind.String || this.peek() === TokenKind.BlockString) {
      desc = this.token.value;
      this.advance();
    }
    const name = this.parseName();
    this.expect(TokenKind.Colon);
    const type = this.parseTypeReference();
    let defaultValue: ValueNode | undefined;
    if (this.peek() === TokenKind.Equals) {
      this.advance();
      defaultValue = this.parseValue(true);
    }
    return {
      kind: NodeKind.InputValueDefinition,
      name,
      type,
      defaultValue,
      description: desc,
    };
  }

  private parseInterfaceTypeDefinition(description?: string): InterfaceTypeDefinitionNode {
    this.expectKeyword("interface");
    const name = this.parseName();
    const fields = this.parseFieldsDefinition();
    return {
      kind: NodeKind.InterfaceTypeDefinition,
      name,
      fields,
      description,
    };
  }

  private parseUnionTypeDefinition(description?: string): UnionTypeDefinitionNode {
    this.expectKeyword("union");
    const name = this.parseName();
    const types: NamedTypeNode[] = [];
    if (this.peek() === TokenKind.Equals) {
      this.advance();
      // Optional leading |
      if (this.peek() === TokenKind.Pipe) {
        this.advance();
      }
      types.push(this.parseNamedType());
      while (this.peek() === TokenKind.Pipe) {
        this.advance();
        types.push(this.parseNamedType());
      }
    }
    return {
      kind: NodeKind.UnionTypeDefinition,
      name,
      types,
      description,
    };
  }

  private parseEnumTypeDefinition(description?: string): EnumTypeDefinitionNode {
    this.expectKeyword("enum");
    const name = this.parseName();
    const values: EnumValueDefinitionNode[] = [];
    if (this.peek() === TokenKind.BraceL) {
      this.expect(TokenKind.BraceL);
      while (this.peek() !== TokenKind.BraceR) {
        let valDesc: string | undefined;
        if (this.peek() === TokenKind.String || this.peek() === TokenKind.BlockString) {
          valDesc = this.token.value;
          this.advance();
        }
        const valName = this.parseName();
        values.push({
          kind: NodeKind.EnumValueDefinition,
          name: valName,
          description: valDesc,
        });
      }
      this.expect(TokenKind.BraceR);
    }
    return {
      kind: NodeKind.EnumTypeDefinition,
      name,
      values,
      description,
    };
  }

  private parseInputObjectTypeDefinition(description?: string): InputObjectTypeDefinitionNode {
    this.expectKeyword("input");
    const name = this.parseName();
    const fields: InputValueDefinitionNode[] = [];
    if (this.peek() === TokenKind.BraceL) {
      this.expect(TokenKind.BraceL);
      while (this.peek() !== TokenKind.BraceR) {
        fields.push(this.parseInputValueDefinition());
      }
      this.expect(TokenKind.BraceR);
    }
    return {
      kind: NodeKind.InputObjectTypeDefinition,
      name,
      fields,
      description,
    };
  }

  // ─── Helpers ──────────────────────────────────────────────────────────

  private parseName(): NameNode {
    if (this.token.kind !== TokenKind.Name) {
      throw this.unexpected();
    }
    const name: NameNode = { value: this.token.value };
    this.advance();
    return name;
  }

  private peek(): TokenKind {
    return this.token.kind;
  }

  private advance(): void {
    this.token = this.lexer.nextToken();
  }

  private expect(kind: TokenKind): void {
    if (this.token.kind !== kind) {
      throw new GraphQLSyntaxError(
        `Expected ${kind}, found ${this.token.kind} ("${this.token.value}")`,
        { line: this.token.line, column: this.token.column },
      );
    }
    this.advance();
  }

  private expectKeyword(value: string): void {
    if (this.token.kind !== TokenKind.Name || this.token.value !== value) {
      throw new GraphQLSyntaxError(
        `Expected "${value}", found "${this.token.value}"`,
        { line: this.token.line, column: this.token.column },
      );
    }
    this.advance();
  }

  private unexpected(): GraphQLSyntaxError {
    return new GraphQLSyntaxError(
      `Unexpected ${this.token.kind} ("${this.token.value}")`,
      { line: this.token.line, column: this.token.column },
    );
  }
}

/**
 * Parse a GraphQL document (queries, mutations, fragments, SDL)
 */
export function parse(source: string): DocumentNode {
  return new Parser(source).parse();
}
