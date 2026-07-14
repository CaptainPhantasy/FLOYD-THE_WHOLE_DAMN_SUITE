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
| Private remote attach | Not shipped | Requires private HTTPS/Tailscale route and revoked-device test |
| Connector/OAuth authority | Not shipped | Requires encrypted token lifecycle and mock/real connector proof |
| Unified single-surface experience | In progress | Cockpit envelope wiring underway; five-surface restore proof pending |

“Shipped” means direct implementation and named verification exist. “In
progress” and “Not shipped” are deliberately visible so partial architecture is
not presented as the completed ecosystem.
