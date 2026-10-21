import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeRichText } from "../server/security/sanitize-rich-text.ts";

test("sanitizer rejects SVG animation, meta refresh and noscript parser differential advisory payloads", () => {
  for (const html of [
    '<svg><a href="#safe"><svg:animate attributeName="href" values="#safe;javascript:alert(1)" dur=".01s" fill="freeze"/><text>Click</text></a></svg>',
    '<meta http-equiv="refresh" content="0;url=javascript:alert(1)">',
    '<meta http-equiv="refresh" content="0;url=data:text/html,test">',
    '<div><noscript></div><img src="https://assessment.invalid/beacon.gif"></noscript>',
    '<p>Hi</p><![CDATA[ x > <noscript>]]><a href="javascript:alert(1)">Assessment</a><img src="https://assessment.invalid/beacon.gif"></noscript>',
  ])
    assert.doesNotMatch(
      sanitizeRichText(html),
      /<svg|<meta|javascript:|data:text|src="https:|onerror/i,
    );
  assert.equal(
    sanitizeRichText(
      '<p><strong>Attack</strong> <span style="color:#ffcc00">text</span></p>',
    ),
    '<p><strong>Attack</strong> <span style="color:#ffcc00">text</span></p>',
  );
});

test("discarded nested iframe fallback cannot exhaust the sanitizer stack", () => {
  for (const count of [2000, 20000]) {
    let output = "";
    assert.doesNotThrow(() => {
      output = sanitizeRichText("<iframe>".repeat(count));
    });
    assert.doesNotMatch(output, /<iframe|<script|javascript:/i);
  }
  assert.equal(
    sanitizeRichText("<p><strong>Normal rules</strong></p>"),
    "<p><strong>Normal rules</strong></p>",
  );
});
