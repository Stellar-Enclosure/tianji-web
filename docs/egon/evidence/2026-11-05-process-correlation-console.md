# Process correlation console evidence

Web baseline 0957379aade655d2d14d6064504d3426d3e6576f. Provider source commit 1b5700ae9ba409c948c4d1a261d7b002de2b4381. [Spec](../spec/2026-11-05-21-19-process-correlation-console.md) and [Plan](../plan/2026-11-05-21-20-process-correlation-console.md) pass strict validation.

The existing Console offers a Process READ page and menu at /operations/process-correlations. An explicit query uses the exact correlation and a bounded UTC window. Each page shows applied START receipt references and its observation time. A detail action separately calls the current instance GET. The client checks instance, release, correlation and submitted time against the selected receipt before displaying its snapshot. The page replaces results on explicit pagination and discards pending and late responses when the form or authenticated context changes.

| Gate | Actual observation |
| --- | --- |
| R1 | One expected assertion failure when the typed A API accepted a response with a different correlation. |
| R2 | One expected assertion failure when the typed A page made no list call after explicit valid submit. |
| R3 | One expected assertion failure when the old App lacked the authorized route. Other App tests were filtered out by the selector. |
| G1 | 58 tests passed in 4 focused files. TypeScript and ESLint passed. |
| G2 | 295 tests passed in all 29 Web test files. |
| P1 | Official static production build passed using the prior verified local toolchain artifacts. Exact PaC delta contains two protected USER resources, two bilingual labels and two GET references. |
| S1 | Strict documents, exact 12 paths and byte preservation of 96 excluded tracked paths, including the repository toolchain lock. |

The Web artifact digest is 1ddfbc391479a14343511bc49fff68f69cd0e534c2b2492ce89b8a99d5fc530c. The manifest digest is f8a60ef90c88bde2746fc3748f6f969d155e12dec75d0072c1af0896dcedbc00. The actual PS producer manifest SHA-256 is 7dff4a536948c260304fb92552391acf6cc1b74d658bea3e88f137f1ec62ce90. Both resource references resolve to protected GET and implicit HEAD with the existing Process READ permission and scope. Existing application admission, landing and grants were preserved. The build reported the existing large-bundle advisory, and jsdom emitted the AntD pseudo-element advisory.

Manual and applicable literal checks were reviewed for existing route and client reuse, exact bounded input/output validation, request epoch isolation, localization, policy scope, UTC handling and test evidence. The patch adds no backend field, role, mutating action, runtime configuration or trace inference. The actual gateway mapping, runtime IAM and live browser remain unverified. Cross-owner Agent/Tool history and full S12 still require separate work.
