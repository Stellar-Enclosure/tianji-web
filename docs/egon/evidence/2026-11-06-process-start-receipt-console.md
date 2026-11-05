# Owned Process START receipt console evidence

Web baseline a6b2aa47fe329cac8e725e6621c9f13a8360bab1. PS producer 9a509342767d6b01dfa94e482b530cc69ccc5536. [Spec](../spec/2026-11-06-00-24-process-start-receipt-console.md) and [Plan](../plan/2026-11-06-00-25-process-start-receipt-console.md) pass strict validation.

An original Process owner can enter the original START command ID and an independently retained request SHA-256 to check one receipt from the existing timeline page. The panel runs one explicit GET and displays the instance and recorded UTC time only for a valid APPLIED receipt. It clears stale responses on edit or identity change. A 404 leaves the original result unknown.

| Gate | Actual observation |
| --- | --- |
| R1 | One expected assertion failure when the A adapter accepted non-APPLIED evidence. |
| R2 | One expected assertion failure when the old page lacked the explicit receipt action. |
| G1 | 51 tests in three selected files passed. TypeScript and ESLint passed. |
| P1 | Official static package passed, with exactly one additional CALLS reference matching the actual protected PS resource. |
| S1 | Strict docs, eight exact paths and excluded tracked bytes checked. |

Web artifact digest 6d48fca152378f6070fd9867670928fa53796c19fb623ffc2bd3d94f645494f4. Manifest digest 13ca2e720ebc9a8eef1bce67a826bb40087b15e24fc013b0adbb2ed8686c10d3. Policy digest 6e2038c5b7f538c151f00238db5e41ff5a60a7ae9d51179d1147cc1b21a2dc14 reflects the new reference. Metadata digest 298603b4f24ddd10fac93a2ab43cf63e04f34c06b53f303405eed32ebbea7e40 matches baseline. The actual PS raw PaC SHA-256 is 4118e1efce240e8f8628bb6261d461207ba23e76fc3daff59c94992cc12f33bd. Existing declarations match baseline.

Manual and applicable literal checks cover current Process owner route reuse, explicit exact request, closed APPLIED response, stale-response isolation and source/package scope. The existing large-bundle advisory remains. Actual BFF, IAM and browser acceptance and AS service-owner reconciliation remain separate.
