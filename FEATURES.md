# Floyd feature matrix

| Feature | State | Evidence boundary |
|---|---|---|
| Durable projects/sessions/runs/jobs | Shipped | Core SQLite and run acceptance |
| Five local presentation surfaces | Shipped | Pinned clean intake commits |
| Shared live session attach/steer | Shipped | Cross-surface parity PASS 6/6 |
| Multi-provider completion relay | Shipped | Gateway tests and live loopback probe |
| Portable experience envelope | In progress | Core/SDK/Cockpit and HTTP integration tests pass; five-surface runtime proof remains |
| SDK capability/version negotiation | Shipped | Typed/browser SDK plus accepted and HTTP 426 integration tests |
| Encrypted device identity | In progress | AES-GCM/scrypt/revocation and HTTP lifecycle tests pass; platform-secure client storage remains |
| Deep-link and QR handoff | In progress | Expiring revision-bound deep link plus enrolled-device proof pass; QR renderer and rendered scan proof remain |
| Private remote attach | In progress | Separate 41416 allowlisted listener and Tailscale HTTPS 8443 are live; scoped attach, out-of-bound denial, logout, and stream revocation pass, but a second physical tailnet-device proof remains |
| Connector/OAuth authority | In progress | AES-GCM API-key/OAuth storage, PKCE, refresh/revoke, endpoint-bound relay references, SDK parity, and mock lifecycle tests pass; real-provider OAuth proof remains |
| Unified single-surface experience | In progress | Cockpit envelope wiring underway; five-surface restore proof pending |

“Shipped” means direct implementation and named verification exist. “In
progress” and “Not shipped” are deliberately visible so partial architecture is
not presented as the completed ecosystem.

Connector authority operational boundaries:

- OAuth callback lookup and expired-attempt retention are not yet compacted;
  high-churn installations need scheduled cleanup before long-term operation.
- Token issuance cannot be made transactional with an external provider. A
  crash after provider issuance but before receipt can leave an unknown grant.
- The evidence outbox is at-least-once and may replay a duplicate after a crash.
- Provider response-header and stream-idle deadlines are fixed at 30 and 60
  seconds. Exceptionally cold or silent models can be terminated by policy.
- The 0600 encryption key protects a copied database, not a fully compromised
  runtime directory or user account. Real-provider OAuth acceptance is pending.
