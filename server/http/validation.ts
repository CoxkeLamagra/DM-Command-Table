import { z } from "zod";
import { PublicApiError, RequestTooLargeError } from "./errors.ts";

// This lexical preflight is deliberately not a second JSON parser: JSON.parse
// remains authoritative for syntax. Strings/escapes are skipped as opaque data.
// Counting encoded entries before object allocation also bounds duplicate keys.
export function assertJsonTextStructure(text: string): void {
  const frames: { kind: string; entries: number; entry: boolean }[] = [];
  let nodes = 0;
  function token() {
    const frame = frames[frames.length - 1];
    if (frame?.entry) {
      if (++frame.entries > (frame.kind === "{" ? 256 : 20_000))
        throw new RequestTooLargeError();
      frame.entry = false;
      if (frame.kind === "{") return; // object key, not a value
    }
    if (++nodes > 2_000_000 || frames.length > 32)
      throw new RequestTooLargeError();
  }
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (/\s/.test(char)) continue;
    if (char === '"') {
      token();
      for (i++; i < text.length; i++) {
        if (text[i] === "\\") i++;
        else if (text[i] === '"') break;
      }
    } else if (char === "{" || char === "[") {
      token();
      frames.push({ kind: char, entries: 0, entry: true });
    } else if (char === "}" || char === "]") {
      frames.pop();
    } else if (char === ",") {
      if (frames.length) frames[frames.length - 1].entry = true;
    } else if (char === ":") {
      continue;
    } else {
      token();
      while (i + 1 < text.length && !/[\s,}\]]/.test(text[i + 1])) i++;
    }
  }
}

// Walk iteratively and reject containers before enumerating their children.
// These limits admit the supported 20,000-record import and 10,000-combatant formats.
export function assertJsonStructure(value: unknown): void {
  const stack = [{ values: [value][Symbol.iterator](), depth: 0 }];
  let nodes = 0;
  while (stack.length) {
    const frame = stack[stack.length - 1];
    const next = frame.values.next();
    if (next.done) {
      stack.pop();
      continue;
    }
    if (++nodes > 2_000_000 || frame.depth > 32)
      throw new RequestTooLargeError();
    const item = next.value;
    if (!item || typeof item !== "object") continue;
    if (Array.isArray(item)) {
      if (item.length > 20_000) throw new RequestTooLargeError();
      stack.push({ values: item.values(), depth: frame.depth + 1 });
    } else {
      // Object.keys is bounded by the already enforced request-byte limit.
      const keys = Object.keys(item);
      if (keys.length > 256) throw new RequestTooLargeError();
      stack.push({
        values: keys
          .map((key) => (item as Record<string, unknown>)[key])
          .values(),
        depth: frame.depth + 1,
      });
    }
  }
}

const validators = new WeakMap<z.ZodType, (value: unknown) => unknown>();

export function parseInput<S extends z.ZodType>(
  schema: S,
  value: unknown,
): z.output<S> {
  assertJsonStructure(value);
  // A compiled predicate returns INVALID at the first failing check. Runtime
  // validation can accumulate nonfatal refinement/format issues across arrays.
  let validate = validators.get(schema);
  if (!validate) {
    validate = z.core.compileFn(schema, { assertOnly: true });
    validators.set(schema, validate);
  }
  if (validate(value) === z.INVALID)
    throw new PublicApiError("The request is invalid.", 400);
  return schema.parse(value);
}
