# Owned Agent recovery console evidence

Web baseline a5e7c15407f53d36378248e2cdf47bc7bfb26a4b. AS producer d9bec9c34bdbaa337cb5bd8eb776e2383bac97c6. [Spec](../spec/2026-11-05-23-18-owned-agent-recovery-console.md) and [Plan](../plan/2026-11-05-23-19-owned-agent-recovery-console.md) pass strict validation.

The current Agent run detail offers one explicit evidence read after the owned run loads. It displays the source, observation time, lifecycle and reason, recorded effect, and local Tool coverage with distinct negative and unknown states. The current identity and run control the lifetime of the read. A failed evidence query preserves the existing run detail. The page has no recovery action.

| Gate | Actual observation |
| --- | --- |
| R1 | One expected assertion failure. The pass-through accepted a different run. |
| R2 | One expected assertion failure. The baseline run detail lacked the explicit read control. |
| G1 | 31 tests passed across the API, page and existing SSE client. TypeScript and ESLint passed. |
| P1 | Official offline static build passed. Web manifest adds exactly one CALLS reference, matched to the actual protected AS GET/HEAD with the existing Agent READ and scope. |
| S1 | Strict docs, eight exact paths and excluded tracked bytes checked. |

Web artifact digest 59b2d884a0bbd712d29f583ac6d2e622c4779d732e0869de68dc76f31978831a. Web manifest digest bd875c7b130292dfc5af8de92c855f2a205cd376a8077773d036bc5973f05dce. Policy digest 704f8c32dced0e47489b3636c2ae0ea0bc4af77a1cd45a10b80d5d1b5e10a872 reflects the new reference. Metadata digest 298603b4f24ddd10fac93a2ab43cf63e04f34c06b53f303405eed32ebbea7e40 matches baseline. AS raw PaC SHA-256 a762fbe7316bdb46c01a98438056b3277228b7eb7b45b04bb4dca23720723a26. Other Web declarations are unchanged.

Manual and applicable literal checks cover existing owner entry and shared transport, exact wire shape, request abort and identity boundaries, current producer authority and exact package scope. Existing large-bundle advisory remains. Actual BFF and browser validation, external Tool reconciliation, checkpoint and takeover, and S11 remain separate.
