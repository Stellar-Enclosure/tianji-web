# Worker failure observation console — Source78

Effective [Spec](../spec/2026-11-05-18-03-worker-failure-console.md) and [Plan](../plan/2026-11-05-18-15-worker-failure-console.md); baseline `f558e02c8d07da2da758c5273a5eb531ca251018`.

The console lets the current authenticated owner inspect a known Process instance through the existing failure GET. Menu and route require both existing Process permissions; the PS service continues exact START-owner validation. Each explicit submit issues one GET. The client requires a closed, same-instance snapshot with bounded canonical rows, keeps UNKNOWN and unavailable distinct from observed empty, and clears or aborts stale requests across identity and route changes. It provides no POST, restore, cancellation, deployment or permission grant. The existing transport exposes decoded successful bodies; it cannot independently distinguish a shape-valid non-200 success, and it continues to reject unsafe path segments without a bypass.

| Gate | Actual result |
| --- | --- |
| W1 baseline static artifact | Official local build succeeded with verified canonical entries and validation-only external lock. Original manifest and embedded/artifact records retained. |
| R1/R2/R3 | One expected assertion failure each: foreign snapshot accepted by stub, query control absent, protected route absent. No unrelated execution failure; App test filter left other tests unselected. |
| W4 focused | 62 passed in 4 test files, zero failures/skips. |
| W5 full | 241 passed in 25 test files; typecheck and lint passed. |
| W6 official static build | Actual Vite/PAC build and independent exact manifest/embedded artifact delta checks passed. |

Final local uncommitted manifest SHA-256 `4f49fba8636453632a4e66a3080080e21eb2f5e10bb11d401c3ca4b2ea1adad6`; artifact SHA-256 `4376654a1321bb532ea7ca80aab63493a981f207516e7556d89e0019eea9867f`. Adds exactly two protected USER resources (menu and page), two labels, references to the two existing Process permissions, and one CALLS reference to the existing Worker failure GET. No new permission definition or change to prior resources. Comparison includes the actual PS packaged manifest and its existing protected GET plus implicit HEAD. W1 and W6 both emitted the existing Vite large-chunk advisory.

The local validation archive used only an off-repository `LOCAL_UNCOMMITTED` override (archive SHA-256 `c018a124bce8ee97c8403367f83802dc56fd1cea7bfe04fd68b24b051abeb9c6`). Its five canonical contract entry hashes matched the tracked lock exactly. SDK, dependencies, Node pin and checked-in lock were unchanged. All proofs and logs under `/Users/mario/.codex/tmp/tianji-agent-upgrade-20261105/t4-04/`. No live IAM/gateway/owner operation, browser, server or database ran.

| Manual check | Status | Actual evidence |
| --- | --- | --- |
| MC-ARCH-001 | PASS | Existing Web API, page, App guard and registry boundaries. |
| MC-REUSE-001 | PASS | Current requestJson, auth frame, route guard, AntD and PAC tooling. |
| MC-DEP-001 | PASS | No dependency or tracked lock edits; actual existing build. |
| MC-NAME-001 | PASS | Semantic Worker failure route, labels, types and tests. |
| MC-VALID-001 | PASS | Exact closed snapshot, UTF-16/UTF-8, UTC, cap, owner affinity and abort negatives. |
| MC-MODEL-001 | PASS | Existing neutral fields mirrored in readonly TS types. |
| MC-CONVERT-001 | N/A | No persistence or Java converter. |
| MC-LOG-001 | N/A | No new logger, tokens, raw errors or payload diagnostics in UI. |
| MC-BEAN-001 | N/A | No Java or application-managed Bean. |
| MC-UTIL-001 | PASS | Current browser/React/AntD/shared transport only. |
| MC-JSON-001 | PASS | Closed decoded shape and current GET contract verified; transport limit noted. |
| MC-TIME-001 | PASS | Original canonical UTC timestamp and semantic time rendering. |
| MC-CONFIG-001 | N/A | No runtime feature/gateway/property change. |
| MC-PATTERN-001 | PASS | Existing protected route and current-frame request fence. |
| MC-SCOPE-001 | PASS | Exact thirteen Web paths; all other tracked source and service unchanged. |
| MC-TEST-001 | PASS | Actual assertion RED, focused/full finite, typecheck/lint and exact static PAC delta. |
| MC-BLOCKER-001 | PASS | Current source verified; real IAM/gateway/PS/Flowable/browser remains pending. |

| Rule | Status | Independent evidence |
| --- | --- | --- |
| 1 | N/A | No Java POJO; current TS conventions kept. |
| 2 | PASS | Existing auth boundary plus exact request/response validation. |
| 3 | N/A | No Java/ORM mapper or entity. |
| 4 | N/A | No managed Java/business logger. |
| 5 | PASS | Existing Web tooling and native JS APIs only. |
| 6 | PASS | Exact closed browser view of current source fields. |
| 7 | N/A | No environment profile changes. |
| 9 | PASS | Existing route/authority and scoped request patterns. |
| 10 | PASS | Canonical existing UTC value retained; no time reinterpretation. |
| 11 | PASS | Existing Web layers and contract, no new state owner, schema or runtime service. |

This completes the read-only Worker observation source slice. Broader release/Agent diagnostics and production recovery actions are not exposed by this Step.
