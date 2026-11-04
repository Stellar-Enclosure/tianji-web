# Task, approval and Case frontend delivery evidence

The source scope is T3-11 of the original agent framework roadmap. The reviewed [Spec](../spec/2026-11-04-22-56-task-case-approval-web.md) and [Plan](../plan/2026-11-04-23-14-task-case-approval-web.md) remain `Review`; implementation proceeds under the user's original continuation instruction and Root's complete design review. This document records local source validation separately from live acceptance.

## Step 40 / Plan Step 1 — Verified for focused commit

- Baseline: clean `tianji-web main@14f89aaaedad21d650481f14e5496bbf5debfc68`, 59 tracked files frozen in `/tmp/tianji-web-step40-baseline.json`.
- Spec SHA-256: `14c997cb92e3ad035f14ba9fa237d373597e0c93bb5da5803266fc259e1df07c`.
- Plan SHA-256: `5752caa75a0be4d3ddd11455a7e70365efca2742431954ee8d0933faa5354d3d`.
- Root read both documents completely, including final source-signature, Java ID and 408/429 clarifications. Both formal repository documents passed their strict validators before source edits.
- Owned paths: the exact 12 paths in Plan Step 1, also frozen in `/tmp/tianji-web-step40-paths.json`. No Step 2 or Step 3 source may begin before this step is committed.
- Existing regression baseline: `npm test`, 2026-11-04 23:16:42 Asia/Shanghai, exit 0, 14 files / 62 tests passed in 30.66 s. Log: `/tmp/tianji-web-task-case-baseline-test.log`. Existing jsdom pseudo-element `getComputedStyle` diagnostics are retained as environment warnings.
- RED gate: compile-only API pass-through signatures and identity reducer first, then contract/transition assertions. Missing imports, compilation errors, fixture failures and environment errors do not count as RED. Root runs all test/build commands and commits.

### RED observations

| Command/log | Actual result | Classification |
| --- | --- | --- |
| Focused Plan Step 1 selector; `/tmp/tianji-web-task-case-consumers-red.log` | 2026-11-04 23:34:59, exit 1, 17 tests: 12 failed / 5 passed, 3.17 s | Ten expected behavior assertions; two relative-URL test fixture errors excluded from RED evidence. |
| Same selector after test matrices expanded; `/tmp/tianji-web-task-case-consumers-red2.log` | 23:38:37, exit 1, 18 tests: 12 failed / 6 passed, 3.24 s | Ten expected assertions; two test expectations omitted the existing gateway application prefix, excluded. |
| Same selector; `/tmp/tianji-web-task-case-consumers-red3.log` | 23:40:34, exit 1, 18 tests: 12 failed / 6 passed, 2.96 s | Ten expected assertions; two fixture path-join assertions still incorrect, excluded. Root corrected only the expected-prefix join. |
| Same selector; `/tmp/tianji-web-task-case-consumers-red4.log` | 23:41:26, exit 1, 18 tests: 10 failed / 8 passed, 2.61 s | All ten failures are expected missing-behavior assertions: foreign/invalid values accepted, input/source/receipt checks absent, compatible nulls not normalized, and identity reducer missing transitions. Both exact-route transport fixtures passed. No fixture, import, compile or environment error. |

The default APPROVAL fixture with a removed required approval field was corrected before the first run; only an ACTION task permits that field to be absent. This did not change the server contract. Root authorized decoder/State implementation only after the fourth, fixture-free RED run. The underlying transport and gateway configuration were not modified.

### Implementation and validation

The six HumanTask and two Case consumers rebuild exact closed request bodies, validate mandatory local source snapshots before sending, and bind decoded immutable receipts to the captured command/source. The pure State reducer preserves the original command through unknown-result retry; page effects and route permissions remain for Steps 2/3. Java ID/Unicode, offset/nanosecond strings, opaque versions, schema primitive bounds, explicit false, UTF-8 cursor order and sparse Case terminal facts retain the existing C/CL contracts.

Root and independent review found two implementation defects before commit. Both were reproduced before correction:

| Check/log | Actual result | Resolution |
| --- | --- | --- |
| `/tmp/tianji-web-task-case-consumers-green1.log` | 23:48:16, exit 1; 18 tests, 1 failed / 17 passed, 3.62 s | A CASE item inside a PROCESS page was incorrectly accepted. Added item-to-query scope equality after the assertion RED. |
| `/tmp/tianji-web-task-case-consumers-prototype-red.log` | 23:50:01, exit 1; 19 tests, 1 failed / 18 passed, 2.75 s | Valid `__proto__` schema key was lost by assignment into `{}`. Schema/form now use validated tuples and `Object.fromEntries`; own-key response and exact outgoing form round-trip pass. |
| `/tmp/tianji-web-task-case-consumers-green2.log` | 23:51:11, exit 0; 3 files / 19 tests passed, 3.84 s | Final focused contract and State verification. |
| `/tmp/tianji-web-task-case-consumers-typecheck2.log` | `npm run typecheck`, exit 0 | TypeScript compilation passed. The earlier typecheck1 also passed. |
| `/tmp/tianji-web-task-case-consumers-lint.log` | `npm run lint`, exit 0 | Existing ESLint gate passed. |
| `/tmp/tianji-web-task-case-consumers-regression.log` | `npm test`, 23:52:08, exit 0; 17 files / 81 tests passed, 31.83 s | Original 62 tests plus 19 new tests; existing jsdom pseudo-element warnings persist. |
| `/tmp/tianji-web-task-case-consumers-build.log` | Official Plan §8 `PAC_* npm run build`, exit 0 | Official preparation/manifest/TypeScript/Vite/artifact checks passed. Existing large-chunk warning retained; no chunk-limit or build-script adjustment. |

The test commands ran in `tianji-web`. All reported times above are 2026-11-04 Asia/Shanghai. No missing-import, fixture or environment failure is counted as a successful RED/GREEN gate. Independent read-only review covered all eight source/test files against current C/CL/PS authority and reported no remaining finding after the two fixes.

### Permission artifact and scope proof

Root used the SDK's existing `createToolchainLock` and `verifyToolchain` on a fresh exclusive candidate. Before applying it, Root rehashed the fixed Jianshen contract JAR (`2077ebbb0e5aa9d35bb1350c869fc7e38879f5d476b649a754094da230ac7b18`) and compared parsed old/new locks: **only `contract.sha256` changes**. Five canonical entry digests, SDK source/dependency digests, coordinates, directory, Node 24 and `LOCAL_UNCOMMITTED` mode are identical. No dependency, package lock or SDK source changed.

The actual generated manifest, report and `dist/permission-build.json` were opened; SDK `manifestDigests` independently recomputed matching values:

| Artifact field | Verified value |
| --- | --- |
| Build ID | `local-1720dd07-a1b2-49d0-a5c6-1b8e169930de` |
| Build artifact digest | `ff1cc3db86c8de2ccb7de5a00401ee08e57800a59bbe298c4668401ee764d779` |
| Manifest digest | `8f42338c623edae6e01eefc8634e20f10fbd3635658015609c9659f2e9bde521` |
| Policy digest | `6f0032cd491f9e9ab34bc72554f12d43dc7c5e0719cd1b0b32c36c6d61be6627` |
| Metadata digest | `6eb31018f53c6c98c26ae55aa233a442955bc4e2bb815bc6770914bbfac69cac` |
| Source digest | `c1adb0142ff5b4dd13a58c3686df097993269cbeb409292835bfad44ed2e2e6b` |
| Metadata boundary | Baseline commit `14f89aaaedad21d650481f14e5496bbf5debfc68`, `workingTreeChanged=true`, `LOCAL_UNCOMMITTED` |
| Resources / permission references / CALLS references | Existing 14 / 6 / 15; zero new Process resources or references before page Steps 2/3 |

These are precommit local validation artifacts, not an exact clean-release claim. `dist`, `.generated`, JARs, logs and node_modules are not committed. Root compared all 59 baseline tracked files: only the authorized local PAC lock differs; all **58 excluded tracked files match their original SHA-256**. Changed/untracked paths equal the exact 12-path Step 1 scope. `tianji-service` remains clean at `cfffb7649af7a1cb429ac935f2bc2c1f88ac3d8d`; `web-sdk` remains clean at `aff7e164b736d4a6fd37e2a2c59263f9e270623f`.

### Final Step 1 Manual Checks

| Check ID | Applicability | Status | Evidence | Finding | Required action/exception |
| --- | --- | --- | --- | --- | --- |
| MC-ARCH-001 | Applicable | PASS | Eight TS files remain in existing api/pages/test; exact scope comparison | Existing frontend structure and backend boundaries preserved | None |
| MC-REUSE-001 | Applicable | PASS | Both clients import existing requestJson; native TextEncoder/collections; sibling fixture/test style | Transport/CSRF/session and build reused; no provider/store | None |
| MC-DEP-001 | Applicable | PASS | 58 excluded SHA checks; official lock candidate and final diff | No dependency/script/package change; one approved artifact SHA | None |
| MC-NAME-001 | Not applicable | N/A | Exact TS/Markdown/local-lock inventory | No Java type changes; Plan TS exports match | None |
| MC-VALID-001 | Applicable | PASS | API negative matrices and 19 focused GREEN; scope/prototype RED then GREEN | Request/source/schema/receipt and cursor boundaries enforced | None |
| MC-MODEL-001 | Not applicable | N/A | Readonly TS mirrors and copied collections | No Java POJO/Lombok construction change | None |
| MC-CONVERT-001 | Not applicable | N/A | No Java file or mapper in authorized paths | No Java converter/MapStruct/BaseConverter change | None |
| MC-LOG-001 | Not applicable | N/A | No Java class or new logging; safe fixed API errors | No Java logging change; raw values not logged | None |
| MC-BEAN-001 | Not applicable | N/A | Only TS/Markdown/lock; backend clean | No Spring Bean/DI/qualifier change | None |
| MC-UTIL-001 | Not applicable | N/A | TS imports limited to existing client/test/native functions | No Java utility or new dependency | None |
| MC-JSON-001 | Applicable | PASS | C/CL mirror review; closed objects, nullable and exact body/receipt tests; proto round-trip | Existing wire preserved; no raw duplicate-key parsing claim | None |
| MC-TIME-001 | Applicable | PASS | TIME-501 offset/nanosecond/raw and invalid calendar/zone tests | Raw instants preserved; no DB/calendar/display implementation in Step 1 | None |
| MC-CONFIG-001 | Not applicable | N/A | Base/env/auth configs excluded by hash; only lock artifact SHA | No Spring profile/frontend environment-key change | None |
| MC-PATTERN-001 | Applicable | PASS | orchestrationAction State reducer and transition/identity tests | Approved exact-command lifecycle represented without global abstraction | None |
| MC-SCOPE-001 | Applicable | PASS | Exact 12 paths; 58 excluded SHA matches; no page Step 2/3 files | Current step scope preserved | None |
| MC-TEST-001 | Applicable | PASS | Assertion RED4, two defect REDs, 19 focused / 81 full GREEN, typecheck/lint/official build | Required finite gates completed; runtime kept separate | None |
| MC-BLOCKER-001 | Applicable | PASS | All preceding rows and independent review | No unresolved Step 1 source blocker; later pages/runtime remain pending | None |

### Final Step 1 Literal Rule Gate

| Literal rule | Applicability | Status | Diff/path evidence | Validation evidence | Finding | Required action/exception |
| --- | --- | --- | --- | --- | --- | --- |
| Rule 1 | Not applicable | N/A | No Java types; exact Plan TS names | Typecheck and path inventory | Java naming scope absent | None |
| Rule 2 | Not applicable | N/A | No Java handoff; TS validators in both API files | Input/source/schema negative matrices | Java annotation contract unchanged | None |
| Rule 3 | Not applicable | N/A | Readonly TS mirrors, copied schema/form/collections | Typecheck and proto/shape tests | No Java POJO/Lombok/mapper change | None |
| Rule 4 | Not applicable | N/A | No Spring Bean/DI or Java business log class | Excluded hashes/backend clean | Java wiring contract unchanged | None |
| Rule 5 | Not applicable | N/A | No Java utility/dependency change | Import/package-lock scope review | Java utility scope absent | None |
| Rule 6 | Not applicable | N/A | Server Jackson untouched; browser mirrors retain wire | C/CL review, JSON contract tests | Java serialization contract unchanged | None |
| Rule 7 | Not applicable | N/A | No Spring profile/env changes | 58 excluded SHA checks | Existing environment keys preserved | None |
| Rule 9 | Applicable | PASS | OrchestrationActionState/Event/actionReducer | Transition matrix, same command reference and illegal-event tests | Approved State pattern implemented | None |
| Rule 10 | Not applicable | N/A | No Java time changes; TS raw instant strings | TIME-501 API tests | Java time contract unchanged | None |
| Rule 11 | Applicable | PASS | Existing api/pages/test structure and requestJson/SDK reuse | Typecheck/lint/build, exact scope and clean backend/SDK | Existing architecture preserved; no new persistence/Event layer | None |

Step 1 is verified for its single focused commit. Step 2/3 routes, forms, page effects and permissions remain unimplemented at this point; no later step source was started. The final Spec conformance audit belongs to Step 3.

## Live acceptance boundary

No application, database, container, server, listener, browser or GUI is started for this frontend slice. Mock/finite component/static/build evidence does not establish deployed gateway/CSRF/IAM behavior, permission registration/activation/grants, actual task/approval advancement, Case-to-BPMN completion, PostgreSQL concurrency or S08/S09 acceptance. Those remain user-controlled and `RuntimeUnverified`.
