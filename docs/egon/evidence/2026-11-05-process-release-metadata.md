# Read-only Process release metadata — Source85

Effective [Spec](../spec/2026-11-05-19-29-process-release-metadata.md) and [Plan](../plan/2026-11-05-19-35-process-release-metadata.md), Web baseline `e5d14225abacd4766aa21f9b59ce2364cd23bb3b`. Both strict validators passed.

The console adds one tenant-scoped read of a known Process release version. The user must submit the exact version. The page and menu require the existing `TIANJI_PROCESS_RELEASE_READ` code. The existing BFF client sends the Process GET and checks the closed public response, exact version, canonical UTC, model hashes and input declarations. A changed request identity or edited version cancels the prior request and drops any late result. The page shows published metadata and has no listing, comparison, activation, rollback or migration action.

| Gate | Actual result |
| --- | --- |
| W1 | Fresh Web baseline official Vite/PaC build, source clean. |
| R1 | One intended assertion: inert parser resolved a different release instead of rejecting. |
| R2 | One intended assertion: inert page had no lookup control. |
| R3 | One intended route assertion: authorized page heading absent; other App tests filtered. |
| W4 | 62 passed in 5 focused suites. |
| W5 | TypeScript, ESLint and full Vitest passed: 256 tests across 27 files. |
| W6 | Official Vite/PaC artifact and exact decoded permission delta passed. |
| W7 | Strict Spec/Plan, exact 13 paths and all excluded tracked bytes verified. |

The official static artifact `5eb646d5b839af103a8c790bba5794b894abadedc79536e57ba6de265b35b6d3` uses LOCAL_UNCOMMITTED. Its manifest digest is `adfec82ddad96c67b3924607d6b64a701e50e61b112ec5ad17fb3a944f6a9d3a`. The actual delta is two protected USER PAGE/MENU resources, two bilingual labels, one existing permission reference and one existing GET CALLS reference. No permission definition or grant changed. The actual baseline PS manifest (SHA-256 `a6e8dc9a9edece682dbcf04b0584aa09dd1337b78f953bb5bfaa86b38c0fb4e9`) confirmed the matching GET/HEAD, current USER/SERVICE access and scope. Both builds used independent copies of the prior validated archive and toolchain lock; the tracked lock was unchanged. Logs and proof files are under `/Users/mario/.codex/tmp/tianji-agent-upgrade-20261105/t4-04/release-slice/`.

| Manual check | Status | Actual evidence |
| --- | --- | --- |
| MC-ARCH-001 | PASS | Existing Web page, BFF client and permission producer only. |
| MC-REUSE-001 | PASS | Existing auth/request epoch and published Process contract. |
| MC-DEP-001 | PASS | No dependency or tracked tooling change. |
| MC-NAME-001 | PASS | Existing Web naming and a fixed route/resource set. |
| MC-VALID-001 | PASS | Exact version/shape, current epoch, bounded inputs and safe errors. |
| MC-MODEL-001 | PASS | Narrow immutable browser values; no private engine or owner fields. |
| MC-CONVERT-001 | PASS | Closed typed projection at the API boundary. |
| MC-LOG-001 | N/A | No new logging. |
| MC-BEAN-001 | N/A | No server or bean change. |
| MC-UTIL-001 | PASS | Existing requestJson, auth, UI and test helpers. |
| MC-JSON-001 | PASS | Exact public GET shape only, no server wire change. |
| MC-TIME-001 | PASS | Strict UTC text rendered without local-zone conversion. |
| MC-CONFIG-001 | N/A | No runtime configuration or gateway rule change. |
| MC-PATTERN-001 | PASS | Existing request adapter and narrow route guard. |
| MC-SCOPE-001 | PASS | Exact 13 Web paths, no backend files, schema or grant. |
| MC-TEST-001 | PASS | Three intended REDs, focused and full tests, typecheck, lint and official build. |
| MC-BLOCKER-001 | PASS | Deployed routing and actual authorization remain separate. |

The independent rules were checked against semantic names, exact version and owner checks, the existing typed API adapter, no new logging or dependency, closed JSON, unchanged runtime configuration, the existing component pattern, UTC output and the current Web/server ownership boundary.

No browser, server or gateway was started. Live acceptance still requires evidence that the deployed edge-tianji route forwards this GET to the correct Process resource with the existing issuer, tenant, audience and effective permission.
