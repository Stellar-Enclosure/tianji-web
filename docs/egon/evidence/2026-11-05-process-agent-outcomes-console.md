# Process-local Agent outcomes console evidence

Web baseline 8d5cd44c1464589b72c584fb553915f22b473d00. PS producer 75d0c15a2ff9bef03be80e7cd7584b2bcbe8401e. [Spec](../spec/2026-11-05-22-47-process-agent-outcomes-console.md) and [Plan](../plan/2026-11-05-22-48-process-agent-outcomes-console.md) pass strict validation.

After an authorized instance detail, the user can explicitly read that Process instance's Agent dispatch and Inbox observations. The UI labels the Process-side evidence, separates dispatch and Inbox states from a verified terminal status, preserves producer order and maintains separate pagination. Selecting another instance, changing the query or losing the current identity discards stale requests. Ordinary failures keep the unrelated Process detail and independent Agent lookup visible. Shared authorization invalidation retains the existing global cleanup.

| Gate | Actual observation |
| --- | --- |
| R1 | One expected assertion failure. A typed pass-through accepted a foreign instance page. |
| R2 | One expected assertion failure. The baseline page did not offer the explicit action after current detail. |
| G1 | 81 tests across four selected files passed. TypeScript and ESLint passed. |
| P1 | Official offline static package passed. The Web manifest adds exactly one CALLS reference. The actual PS producer resolves it to the protected GET and implicit HEAD with current Process READ and scope. |
| S1 | Strict documents, exact eight paths and excluded tracked bytes checked. |

Web artifact digest de361ddba7432f7949fd8eef1dca6908580c3fb5638805d64e3c35f0a9d63d8f. Web manifest digest 7ad17b7ffdad8be0de5cc3daac3fa35468a85a7ab274338f4813a7ac56d533aa. Policy digest 4a609e6703d1c17c79f339a669c9be730b5260be197c61df4c03c8fed4b3163a reflects the new CALLS reference. Metadata digest 298603b4f24ddd10fac93a2ab43cf63e04f34c06b53f303405eed32ebbea7e40 matches baseline. PS raw PaC SHA-256 cc85967f2c627e7afbf5f06564751cf82f9218dc4b0dc093babc5f61ad361f70. Other resources, permissions, labels and references match.

Manual and applicable literal checks cover existing BFF/owner reuse, closed and bounded wire input/output, cancellation and request epoch, independent scoped paging, current protected reference and exact static artifact scope. No Agent run link is derived from PS evidence. The package retains the existing large-bundle advisory. Real BFF, IAM, browser and full S12 remain separately gated.
