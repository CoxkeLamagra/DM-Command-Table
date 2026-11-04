# Public HTTPS hosting

Use v12.2.0 or later for the public-origin profile. Application hardening reduces exposure; a public deployment also needs a maintained operating system, a valid TLS certificate, a correctly configured edge proxy and tested backups. These instructions preserve local SQLite/media storage and password-based accounts. No external identity, database or security service is required.

## Refresh existing LXC updater helpers once

For an existing v11/v12 LXC, refresh the root-owned helpers **before** the first v12.2 update. Run as root while no update is running:

```bash
set -euo pipefail
umask 077
DMCT_APPROVED=$(mktemp -d /root/dmct-security.XXXXXXXX)
git clone --depth 1 --branch v12.2.0 https://github.com/CoxkeLamagra/DM-Command-Table.git "$DMCT_APPROVED/source"
git -C "$DMCT_APPROVED/source" rev-parse HEAD
bash "$DMCT_APPROVED/source/deploy/debian-13/install-gui-updater"
```

Keep the printed revision. Use a private root-owned approved checkout, never a build-account checkout that has executed dependency scripts. This installs the descriptor-based runtime promoter and the versioned broker. Then use Administration → Update Application normally; new application code blocks starts against older helpers and displays this maintenance requirement. The helper refresh does not initialize storage or issue a new registration token. Fresh v12.2 installations include it automatically. Docker does not use this root service.

## Configure the public boundary

1. Install/update the application using the existing [Debian LXC](debian-13-lxc.md) or [Docker](docker.md) procedure and take a verified backup. Keep the Node listener private: loopback on Debian, or a private container network/loopback host port in Docker. Expose only the edge's HTTP/HTTPS ports through the firewall.
2. Configure a trusted reverse proxy with a certificate for your actual hostname. [nginx-public.conf.example](../deploy/debian-13/nginx-public.conf.example) supplies an HTTPS edge example with a fixed HTTP redirect, unknown-host rejection, TLS 1.2/1.3, HSTS, bounded body/header timeouts, connection limits and authentication throttling. Replace `dm.example.com` and the certificate paths. It belongs in Nginx's `http` context and replaces the default site; avoid duplicate default servers/zone names. Obtain and renew certificates using your host's existing certificate process. Run `nginx -t` before reloading. The template is not installed by GUI updates.
3. Overwrite `Host`, `X-Real-IP`, `X-Forwarded-For`, `X-Forwarded-Host` and `X-Forwarded-Proto` at that trusted edge. The example assumes Nginx is the Internet-facing TLS terminator. If another proxy sits ahead of Nginx, restrict ingress to that proxy and configure its authenticated/trusted address ranges before interpreting original client IPs. Do not trust arbitrary Internet forwarding headers.
4. In Administration → Server Settings, choose **Always secure** cookies, disable public registration unless it is intentionally needed, and choose an appropriate session lifetime. Use unique high-entropy passwords, especially for administrators. The public-origin profile enforces Secure cookies even if the stored setting is changed; choosing Always secure also protects your pre-update backups/older runtime configuration.
5. Set these root-managed runtime variables, replacing the example origin:

   ```dotenv
   DM_COMMAND_TABLE_PUBLIC_ORIGIN=https://dm.example.com
   DM_COMMAND_TABLE_TRUST_PROXY=true
   DM_COMMAND_TABLE_SECURE_COOKIES=true
   ```

   Debian: add them to `/etc/dm-command-table.env` and restart `dm-command-table.service`. Docker: add them to the runtime environment and recreate the container while retaining its data volume. The origin must contain only `https://host[:port]`, with no credentials, non-root path, query or fragment. Invalid settings fail closed. A nondefault public port requires the edge to preserve that port in Host. Leave the variable unset for existing HTTP LAN operation.

6. Apply host-appropriate process limits. [public-service.conf.example](../deploy/debian-13/public-service.conf.example) is an optional systemd drop-in example; install it as `/etc/systemd/system/dm-command-table.service.d/public.conf`, then run `systemctl daemon-reload` and restart the application. Docker supports equivalent memory/CPU/task limits. Size the host for both runtime and update builds; the existing build recommendation remains at least 4 GiB RAM. Proxy temporary-body storage, backups and logs also need space monitoring/retention. GUI releases retain root-owned proxy/service/environment settings.

## What the application enforces

The public-origin profile pins the incoming Host and supplied Origin on application routes. A shared API wrapper enforces this independently of the HTML nonce proxy. APIs bypass proxy body cloning so streaming admission/deadlines run before buffering; unsupported HTML writes reject and their framework clone budget is capped at 8 KiB. Client forwarding headers cannot substitute for the configured Host. It forces Secure, HttpOnly, SameSite=Lax session cookies and adds HSTS to accepted application responses. Anonymous loopback `/api/health` remains available for the existing update/rollback helper; the loopback exception does not extend to authentication or campaign APIs. Static asset paths retain framework handling; the edge must enforce the hostname and TLS on every path.

All deployments receive shared request controls: eight simultaneous body readers, at most two per authenticated account, a 64 MiB aggregate body reservation and a 30-second total body-read deadline. Authentication bodies share this reader pool with a two-reader cap per canonical network source; password-work admission remains separate, so slow bodies do not reserve password-derivation slots. The reader uses a bounded growing buffer rather than retaining arbitrary numbers of tiny chunks, cancels failed reads and releases its locks/counters on success, size rejection, abort and timeout. Large concurrent requests return 503 for retry; timed-out reads terminate with 408 where the connection remains writable. Ordinary/package byte ceilings and heap-aware JSON limits remain enforced. This may reject a slow or unusually large transfer; retry a smaller batch or use the host backup procedure.

Multipart images are limited to the existing one-file/optional-token-flag contract before generic form parsing, with bounded boundary/header metadata. Existing raster-only conversion, SVG blocking, pixel/decode caps, quotas and media authorization remain active. Public origin does not grant access to private screenshots or shared monster definitions.

Authenticated write and read limits follow account IDs, so changing IPs cannot reset them. Ordinary catch-all reads allow 1,200 per five minutes; raw/package exports allow ten per minute; media metadata allows 120 reads per minute and image reads 1,200 per five minutes. Existing narrower write/import/admin/password limits remain in place. Invalid trusted-proxy address strings share an unknown-source bucket. Reverse-proxy limits provide separate unauthenticated connection/rate protection.

Session issuance retains at most 20 active sessions per account, always preserving the newly issued token and deleting expired/old sessions transactionally. Password resets still invalidate all sessions; session tokens remain hashed in SQLite. This release does not add MFA or change existing users' passwords.

Heap-aware SQL preflights cover Players/NPCs, sessions, stories and their links, prepared encounters/children, combatants/conditions, templates, accessible campaigns and screenshot metadata. They run before materializing full collections and return 413 for oversized results. Existing Bestiary/export budgets remain. Each Bestiary search page examines at most 100 bindings, with a 4 MiB definition-byte target (at least one binding for progress), advances the cursor even through empty matching pages and supports cancellation when the user changes their search. Notes are converted to plain text once per matching check, and duplicated search terms do not repeat work. No collection is silently truncated.

Debian promotion reads through pinned Linux descriptors, checks the source owner before reading file bytes, refuses source-root symlinks/special entries and writes fresh caller-owned private output. Root verifies the completed immutable tree before exposing readable/executable release modes. Fresh installation obtains privileged helpers and templates from a separate root-private checkout of the approved revision. Build scripts can still produce application code by design; manifests are corruption checks, not publisher signatures.

## Verify before allowing Internet traffic

From the public hostname, confirm the certificate/chain and HTTP→HTTPS redirect; inspect HSTS, CSP and the session cookie's Secure/HttpOnly/SameSite attributes. A different Host or an HTTP/foreign Origin must fail. `/api/campaigns` without a session must return 401 on the correct hostname, and ordinary users must receive 403 for Administration/update actions. Check permitted viewer/editor/owner behavior using isolated campaigns, plus token/stat-block rendering, imports and the GUI update status.

On the host, confirm port 3000 is private and direct loopback health is ready. Verify backups and a restore to separate storage. Check proxy/application logs for controlled 408/413/429/503 responses and available disk/memory. Tune edge limits for legitimate shared-NAT users rather than disabling application guards. These local runtime checks do not certify your public certificate, firewall, OS patch level or actual proxy chain; validate those on the deployment.

Changing the public hostname requires updating the certificate, edge configuration and root-managed origin together. To return deliberately to LAN HTTP, stop public ingress and remove the origin setting, then change cookie/proxy settings as appropriate. Versions before v12.2.0 do not enforce this profile; verify the edge and Always-secure cookie setting before any downgrade to an older matching runtime/backup.
