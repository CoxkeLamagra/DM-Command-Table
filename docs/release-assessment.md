# v11.8.3 release validation

The sidebar version text now opens the GitHub repository in a separate tab. The application always uses compact list spacing; the old density preference and toggle are removed. Username and Sign out share one line, the duplicate @username is removed, and the icon-only collapse/expand control sits in the existing header. Collapse preference, accessible control names, mobile navigation, campaign controls and draft-aware sign out are preserved.

## Executed checks

The full dependency audit gate, formatting, ESLint, TypeScript, all 136 unit/integration tests and production build passed. All 19 browser tests passed using system Chromium. Browser regressions cover permanent compact spacing despite an old comfortable preference, version links in expanded/collapsed menus, account footer placement, icon-only header controls, remembered collapse state and mobile navigation. Existing Administration, campaign, Bestiary and Combat workflows remain covered by the browser suite. Expanded, collapsed and mobile sidebar screenshots were visually inspected; the username and sign-out control were confirmed to share a horizontal centerline.

No runtime dependency, API or schema change is introduced. The application remains local-first, with optional catalogue imports and administrator-triggered source updates as before. The version link makes an external request only when a user opens the repository.

## Validation limits

Browser verification uses system Chromium. These checks do not establish a fresh bare Debian LXC installation, a live-host deployment or production TLS/proxy acceptance. The broad offline container smoke test passed for v11.8.1; it was not repeated for this sidebar-only patch. Existing v11.8 security controls and root-helper deployment requirements remain documented in [operations](operations.md) and [security notes](security-efficiency-review.md).
