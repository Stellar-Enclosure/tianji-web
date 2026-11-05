# Owned Agent correlation console evidence

Web baseline 45184f1b464d2c6d7c1a4838db8f2dbc4392282a. AS source 7072e5b9153d1cda4ee38be60eeb9651b102a885. [Spec](../spec/2026-11-05-22-15-agent-correlation-console.md) and [Plan](../plan/2026-11-05-22-16-agent-correlation-console.md) both pass strict validation.

After a Process result, the existing page offers a separate explicit Agent lookup to the current identity with the existing Agent read permission. Both queries use the exact correlation and UTC window. Agent paging is independent of Process paging. The Agent run link uses the existing separately guarded run detail page. Ordinary Agent failures preserve Process results while the request epoch is current. A shared authentication invalidation follows the existing console cleanup. Equal correlation is a search condition.

| Gate | Actual observation |
| --- | --- |
| R1 | One expected failure. The typed pass-through accepted a run outside the exclusive window. |
| R2 | One expected failure. The previous page lacked the explicit Agent action after a Process result. |
| G1 | 45 tests in four files passed. TypeScript and ESLint passed. |
| P1 | Official offline static build passed. Web declarations, references, policy digest and metadata digest match the prior Web artifact. The existing Agent LIST reference resolves in the actual AS producer. |
| S1 | Strict docs, exact seven paths and all 104 excluded tracked files byte-checked. |

Web artifact digest 94814a60db72487ee19465d1d30b74119af193d5d1a3fc86eac973461aabf58e. Current Web manifest digest 742d6f87d9018b2b0aa56e6b2133dbd4058d4cae238ed5847bbffa0127629535. Policy digest 0daa23e74f62a38224966c21943e48c986f509deb64af47c3c3e23a75f8502cb. Metadata digest 298603b4f24ddd10fac93a2ab43cf63e04f34c06b53f303405eed32ebbea7e40. AS raw PaC SHA-256 1042f3e1b48fe202b3bb17a8c551b1b6eaafa22352e9c96fd12806582dd0e971. The exact existing GET and implicit HEAD path, Agent READ and OAuth scope match the Web reference.

Manual and applicable literal checks cover existing SDK and UI reuse, exact bounded response validation, identity and cursor isolation, ordinary failure and shared auth paths, TypeScript checks and actual built permission identity. The static build retains the existing large-bundle advisory. Actual BFF/IAM, browser, service-owner traversal and S12 remain separate.
