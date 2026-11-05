# Owned Tool event timeline evidence

Web baseline 12ca685a606a6c55c28c1ae48d4258290aed482b. Agent event authority Service 7072e5b9153d1cda4ee38be60eeb9651b102a885. [Spec](../spec/2026-11-05-22-29-owned-tool-event-timeline.md) and [Plan](../plan/2026-11-05-22-30-owned-tool-event-timeline.md) both pass strict validation.

The Agent run detail keeps its existing owner event stream and renders the recorded Tool start or finish with sequence, UTC time, safe declared Tool key/version, state and accounting status. A malformed or unknown Tool event renders a fixed unverified state. Tool rows do not render raw payload or governance metadata. Other event types and the run result keep their existing representation. Observed Tool state grants no action.

| Gate | Actual observation |
| --- | --- |
| R1 | One expected assertion failure. The previous generic event view lacked the fixed Tool outcome label. |
| G1 | 23 tests across the owning page and existing SSE client passed. TypeScript and ESLint passed. |
| P1 | Official static package passed with unchanged permission declarations, references, policy and metadata compared with the exact prior Web artifact. The existing protected Agent events resource was independently checked in the actual AS producer. |
| S1 | Strict documents, exactly five paths and byte preservation of all excluded tracked paths. |

Web artifact digest 9df947536f9365713ad9bf405c5f4d6a3cf3ee377a7e6e28eaf809ddd9bb58fd. Manifest digest b40dfc05092809f1c2a9f999178fa93972054314cae84445760ec1f3521b9832. Policy digest 0daa23e74f62a38224966c21943e48c986f509deb64af47c3c3e23a75f8502cb. Metadata digest 298603b4f24ddd10fac93a2ab43cf63e04f34c06b53f303405eed32ebbea7e40. The protected Agent events resource has the existing GET/HEAD route, SSE media type, Agent READ and OAuth scope. The static build retains the existing large-bundle advisory.

Manual and applicable literal rules cover existing event and permission reuse, explicit payload validation and privacy boundaries, stored event order and UTC display, exact file scope and actual verification. Live gateway, browser, external Tool reconciliation, resume and S11 remain separate.
