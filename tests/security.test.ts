import assert from "node:assert/strict";
import test from "node:test";
import { consumeRateLimit } from "../server/security/rate-limit.ts";
import { sanitizeRichText } from "../server/security/sanitize-rich-text.ts";
import { rejectCrossOrigin } from "../server/http/origin.ts";

test("rate limits reset after their window", () => {
  assert.deepEqual(consumeRateLimit("test-limit", 2, 1_000, 1_000), {
    allowed: true,
  });
  assert.deepEqual(consumeRateLimit("test-limit", 2, 1_000, 1_100), {
    allowed: true,
  });
  assert.deepEqual(consumeRateLimit("test-limit", 2, 1_000, 1_200), {
    allowed: false,
    retryAfterSeconds: 1,
  });
  assert.deepEqual(consumeRateLimit("test-limit", 2, 1_000, 2_001), {
    allowed: true,
  });
});

test("server-side rich text sanitization keeps formatting and removes executable markup", () => {
  const safe = sanitizeRichText(
    '<p onclick="alert(1)"><strong>Hello</strong><script>alert(1)</script><span style="color:#ff0000;position:fixed">world</span></p>',
  );
  assert.match(safe, /<strong>Hello<\/strong>/);
  assert.match(safe, /color:\s*#ff0000/);
  assert.doesNotMatch(safe, /script|onclick|position/i);
});

test("origin checks retain host validation behind a TLS-terminating proxy", () => {
  const valid = new Request("http://internal/api/campaigns", {
    headers: {
      origin: "https://dm.example.test",
      "x-forwarded-host": "dm.example.test",
      "x-forwarded-proto": "https",
    },
  });
  assert.equal(rejectCrossOrigin(valid), null);

  const translatedScheme = new Request("http://internal/api/campaigns", {
    headers: {
      origin: "https://dm.example.test",
      host: "dm.example.test",
      "x-forwarded-proto": "http",
    },
  });
  assert.equal(rejectCrossOrigin(translatedScheme), null);

  const wrongHost = new Request("http://internal/api/campaigns", {
    headers: {
      origin: "https://evil.example.test",
      "x-forwarded-host": "dm.example.test",
      "x-forwarded-proto": "https",
    },
  });
  assert.equal(rejectCrossOrigin(wrongHost)?.status, 403);

  const wrongPort = new Request("http://internal/api/campaigns", {
    headers: {
      origin: "https://dm.example.test:444",
      host: "dm.example.test",
    },
  });
  assert.equal(rejectCrossOrigin(wrongPort)?.status, 403);
});
