# T4-03 Process owner 精确 START 回执控制台

| Field | Value |
| --- | --- |
| Document | 2026-11-06-00-24-process-start-receipt-console.md |
| Template Version | 9 |
| Archetype Cleanup | Not applicable |
| Status | Review |
| Type | Feature |
| Complexity | Simple |
| Complexity Drivers | 既有 PAGE 的显式局部 GET、闭合解码和请求取消 |
| Created | 2026-11-06 00:24 Asia/Shanghai |
| Updated | 2026-11-06 00:24 Asia/Shanghai |
| Owner | Tianji Web |
| Repository | tianji-web |
| Scope | 当前 Process START owner 的单个已应用回执核对 |
| Change Surface | 现有 ExecutionTimelinePage、新 TS 查询 adapter 和一个 CALLS |
| Affected Chapters | §7, §8, §10, §12, §14, §15, §16 |
| Source Requirement | [Master §19 T4-03](../../../../docs/plans/agent-framework-upgrade-plan.md) 人工核对与副作用证据 |
| Baseline Revision | Web a6b2aa47fe329cac8e725e6621c9f13a8360bab1; PS 9a509342767d6b01dfa94e482b530cc69ccc5536 |
| Amends | None |
| Supersedes | None |
| Depends On | [Owned Process START receipt §9](../../../../tianji-service/docs/egon/spec/2026-11-05-23-50-owned-process-start-receipt.md#9-interface-definitions) |
| Related Specs | [Current Process correlation console](2026-11-05-21-19-process-correlation-console.md) |
| Related Plans | [Web START receipt plan](../plan/2026-11-06-00-25-process-start-receipt-console.md) |

## 1. Summary

在现有流程关联页提供显式 START 回执核对。当前登录身份输入原命令标识与独立保留的原请求摘要，消费 PS 的 exact owned read。成功只显示已应用回执的实例标识和记录时间；未观察到回执保留原请求执行结果未知。

## 2. Background and Current State

| Evidence ID | Source | Observed fact |
| --- | --- | --- |
| EVD-001 | [Current ExecutionTimelinePage](../../../src/pages/ExecutionTimelinePage.tsx) | 现有 Process PAGE、登录身份、租户、请求 epoch 和失效取消。流程详情需要已知实例。 |
| EVD-002 | [PS producer evidence](../../../../tianji-service/docs/egon/evidence/2026-11-05-owned-process-start-receipt.md) | Exact protected GET binds current full owner, original commandId, original request digest and APPLIED. No native side effects. |
| EVD-003 | [Web requestJson](../../../src/api/client.ts) | 当前授权上下文、tenant header、现有安全错误和会话失效处理。 |
| EVD-004 | [Fixed AS transport](../../../../tianji-service/stellar-enclosure-tianji-agent-server/src/main/java/top/egon/cola/platform/tianji/agent/server/integration/process/TianjiFixedBpmnStartToolTransport.java#L49) | AS Tool executor SERVICE uses different owner credentials with release READ and START only. Current Web identity cannot impersonate that actor. |

### 2.5 Archetype example cleanup

Cleanup disposition: Not applicable

Reason: Existing Web page, API and permission references, no archetype generation or example scope.

## 3. Goals and Non-goals

Allow the original authorized Process caller to check one exact receipt without a known instance ID. Existing Process views and page access stay. Actual AS Tool UNKNOWN reconciliation, receipt witness from another owner, restart, resume, write and authorization changes remain separate.

### 3.3 Change Surface and Design Depth

| Area/layer | Disposition | Exact repository evidence | Changed or preserved behavior/contract | Required Spec treatment | Chapter(s) |
| --- | --- | --- | --- | --- | --- |
| Existing Process PAGE/local decoder/PaC reference | Affected | EVD-001–003 | One explicit exact lookup and closed output | UI scope, abort, file and proof | §7, §8, §10, §12, §14, §15, §16 |
| PS producer and IAM | Context-only | EVD-002/004 | Existing exact actor and producer flags preserved | Source owner and permission | §9 |
| Storage and AS Tool operations | Not applicable | EVD-002/004 | Existing owners remain | Scope only | §11 |

## 4. Requirements and Acceptance Criteria

| ID | Requirement | Priority | Observable acceptance | Source |
| --- | --- | --- | --- | --- |
| REQ-001 | Explicit current owner lookup | Must | Existing PAGE only, no automatic request, exact original commandId and independently retained lowercase digest | EVD-001/002 |
| REQ-002 | Exact APPLIED-only evidence | Must | Existing no-store authenticated GET, closed instance/status/UTC and actual receipt provenance | EVD-002/003 |
| REQ-003 | Unknown and old identity isolated | Must | 404 unobserved, no execution conclusion or action, edit/epoch/permission abort drops old result | EVD-001/003/004 |
| REQ-004 | Exact package scope | Must | One existing producer CALLS reference and nothing else in permission manifest; retain old page and API behavior | EVD-001/002 |

### 4.2 Use-case analysis

#### 4.2.1 Actor inventory

| Actor ID | Actor | Goal | Permission/context |
| --- | --- | --- | --- |
| ACTOR-001 | Original Process START caller using current authorized Web identity | Confirm an independently identified applied receipt | Existing Process PAGE and separately authorized exact PS read owner |

#### 4.2.2 Use-case artifact

| ID | Use case/goal | Primary actor | Supporting actors/systems | Trigger | Preconditions | Main success outcome | Alternatives/failures | Postconditions | Requirements | Interfaces/pages | Tests |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| UC-001 | Inspect one owned START receipt | ACTOR-001 | Exact PS protected producer | Explicit form submit | Current PAGE, exact command and original digest | Applied receipt and timestamp | Unobserved, invalid, denied, dependency unavailable | No action or mutation | REQ-001–004 | Existing correlation page | TEST-001–004 |

## 5. Constraints, Assumptions, and Decisions

Use current tianji.page.processCorrelations only. The server independently requires current READ and tianji.api.process.startReceipt.get, full owner and same original digest. Web does not collect raw start arguments, recompute the digest, select an owner, fetch another AS/PS identity or act on a failed lookup. A SERVICE-owned action is outside a USER observation.

## 6. Project Technology Context

Existing React/AntD, TypeScript, Vitest, requestJson/BFF and Web PaC SDK. No dependency or transport changes.

### 6.2 User-mandated Java rule compliance

| Literal rule | Affected? | Repository evidence | Exact design decision | Files/types/interfaces | Validation/test evidence | Status/blocker |
| --- | --- | --- | --- | --- | --- | --- |
| Rule 1 | No | Web-only §8 | Existing Java/service unchanged | Existing boundary | §14 | N/A |
| Rule 2 | No | Web-only §8 | Existing Java/service unchanged | Existing boundary | §14 | N/A |
| Rule 3 | No | Web-only §8 | Existing Java/service unchanged | Existing boundary | §14 | N/A |
| Rule 4 | No | Web-only §8 | Existing Java/service unchanged | Existing boundary | §14 | N/A |
| Rule 5 | No | Web-only §8 | Existing Java/service unchanged | Existing boundary | §14 | N/A |
| Rule 6 | No | Web-only §8 | Existing Java/service unchanged | Existing boundary | §14 | N/A |
| Rule 7 | No | Web-only §8 | Existing Java/service unchanged | Existing boundary | §14 | N/A |
| Rule 9 | No | Web-only §8 | Existing Java/service unchanged | Existing boundary | §14 | N/A |
| Rule 10 | No | Web-only §8 | Existing Java/service unchanged | Existing boundary | §14 | N/A |
| Rule 11 | No | Web-only §8 | Existing Java/service unchanged | Existing boundary | §14 | N/A |

### 6.3 Time semantics and conversion contract

Time contract: Required

| Time ID | Fields/symbols | Semantics | Java/runtime type | Storage policy | Wire policy | Business zone source | Display zone source | Boundary / DST rules | Precision / Clock | Compatibility | Verification |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| TIME-001 | recordedAt | Occurred instant | TypeScript string | Not persisted | UTC Z | Explicit UTC Instant | Raw UTC with label | Valid 0001–9999 calendar and UTC, no local conversion | Existing producer microseconds | Existing time rendering unchanged | TEST-001/002 |

## 7. Architecture Design

### 7.0 Minimum-design baseline and element-necessity audit

| Proposed element | Change | Requirements | Existing/direct alternative | Concrete inadequacy of alternative | Added calls/state/coupling/failures/migration/operations | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| Exact receipt TS adapter | Add | REQ-001/002 | Existing correlation reader | Cannot prove original command digest | One explicit current owner GET | Add |
| Existing PAGE optional local card | Expand | REQ-001/003 | Existing detail | Cannot recover unknown instance ID from a missing acknowledgment | Local fields and request, no new route | Keep |
| Existing auth, UTC and PaC | Reuse | REQ-001/003/004 | New auth/store | Existing owner scope fits | One CALLS only | Keep |

| Path | Network calls | Client states | Server contracts/state | Failure and TOCTOU points | Additional user/business value |
| --- | --- | --- | --- | --- | --- |
| Current correlation and detail | Existing | Current pages | Existing | Cannot select by original digest | Current Process observation |
| Exact receipt panel | One explicit | Local status and receipt | Existing exact GET | Current actor/epoch and input changes cancel | Positive evidence after missing acknowledgement |

### 7.1 System Architecture Design

Existing ExecutionTimelinePage → local ProcessStartReceiptLookup → processStartReceiptsApi → shared requestJson → exact PS owner read.

### 7.2 High-Level Design

A separate receipt lookup does not require a selected instance or correlation result. User input stays local, starts blank, and only the explicit valid form triggers a GET. Reuse existing PAGE guard and owner/epoch remount.

### 7.3 Detailed Design

Exact command grammar starts alphanumeric, then up to 127 ASCII letters, digits, underscores, dots, colons or dashes. Digest is exact 64 lowercase hex. Reject padding, whitespace and invalid characters before network. GET has only encoded commandId and requestSha256, no body, no-store and existing trusted tenant credentials. Decode exactly instanceId, status and recordedAt with existing exact Process ID and UTC validators, status must APPLIED. 404 remains a transport failure at the adapter and displays unobserved with unknown original execution in UI. No raw diagnostics. One pending request, edit or unmount aborts and clears, accepted result also needs same live request and current PAGE. Existing authorization frame changes remount the page.

## 8. Package Structure and Code File Tree

| Operation | Exact path |
| --- | --- |
| Create | `src/api/processStartReceipts.test.ts` |
| Modify | `src/pages/ExecutionTimelinePage.test.tsx` |
| Create | `src/api/processStartReceipts.ts` |
| Modify | `src/pages/ExecutionTimelinePage.tsx` |
| Modify | `src/permissions/references.ts` |
| Create | `docs/egon/spec/2026-11-06-00-24-process-start-receipt-console.md` |
| Create | `docs/egon/plan/2026-11-06-00-25-process-start-receipt-console.md` |
| Create | `docs/egon/evidence/2026-11-06-process-start-receipt-console.md` |

## 9. Interface Definitions

Context-only actual PS GET /api/tianji/v1/process-start-receipts, operation getOwnedProcessStartReceipt and resource tianji.api.process.startReceipt.get. Producer uses existing Process READ and tianji:process:read, dedicated current policy, full owner, exact START/APPLIED and original digest. API and start-receipt flags remain default off. Web only consumes this exact GET with the existing trusted current tenant.

## 10. POJO and Data Model Design

Readonly ProcessStartReceiptQuery(commandId, requestSha256) and ProcessStartReceipt(instanceId, status APPLIED, recordedAt). No owner token, request body/arguments, raw error or Agent data. Local phase idle/loading/unobserved/receipt/error is bounded and never stored.

## 11. Database Design

N/A. Existing PS owner read owns the receipt.

## 12. Frontend Page Design

Existing /operations/process-correlations displays 核对 START 回执, blank START 命令标识 and 原请求 SHA-256, and 查询 START 回执. Show explicit local source, instance ID and UTC receipt time only on verified APPLIED evidence. 404 shows 未观察到匹配的已应用 START 回执 and 原请求的执行结果仍未知. Other failures use fixed safe message. No launch/retry action, AS navigation or automatic detail fetch. Keep other independent panels.

## 13. Design Patterns and Architecture Principles

Reuse the existing owner page and direct read-only local request pattern. One local child and a strict adapter keep the change scoped.

## 14. Test Design

| Test | Scope |
| --- | --- |
| TEST-001 | Exact encoded GET and tenant, strict query and APPLIED-only response, 404 preserved |
| TEST-002 | Explicit blank input/no fetch, exact output and unknown 404, abort after edit/epoch/permission |
| TEST-003 | Actual one CALLS and exact committed PS producer scope |
| TEST-004 | Existing page and preflight regression, typecheck/lint |

## 15. Non-functional and Cross-cutting Design

No URL state or new global storage. User action makes at most one GET. Preserve old live state and abort under existing authority changes. No diagnostic/body logging.

## 16. Compatibility, Migration, Rollout, and Rollback

One source commit, one CALLS reference with existing PAGE/MENU and permissions unchanged. No producer configuration, runtime enablement, migration, or new AS authority. Actual IAM and browser remain separately authorized.

## 17. Alternatives and Decisions

Generic correlation or AS owner lookups do not prove the original command. A narrowly scoped existing owner lookup uses the actual PS receipt producer without changing execution credentials.

## 18. Risks and Open Questions

Operator must already possess the independently recorded original request digest and use the original authorized owner identity. A disabled or missing source, wrong digest and absent applied receipt can all appear unobserved. No cross-owner Tool reconciliation or S11 claim.

## 19. Traceability Matrix

| Requirement | Use case | Design | Tests |
| --- | --- | --- | --- |
| REQ-001 | UC-001 | §5/7/12 | TEST-001/002 |
| REQ-002 | UC-001 | §7/9/10 | TEST-001/002 |
| REQ-003 | UC-001 | §7/12/15 | TEST-001/002/004 |
| REQ-004 | UC-001 | §8/14/16 | TEST-003 |

## 20. Review and Acceptance

### 20.5 Blocking Manual Check

| Check ID | Applicability | Status | Evidence | Finding | Required action/exception |
| --- | --- | --- | --- | --- | --- |
| MC-ARCH-001 | Applicable | PASS | §7/8/14 | Current Process page and exact owner consumer | None |
| MC-REUSE-001 | Applicable | PASS | §7/8/14 | Existing layout, requestJson, authority | None |
| MC-DEP-001 | Applicable | PASS | §7/8/14 | No dependency change | None |
| MC-NAME-001 | Applicable | PASS | §7/8/14 | Exact local API and page names | None |
| MC-VALID-001 | Applicable | PASS | §7/8/14 | Exact command, original digest, APPLIED-only state and UTC | None |
| MC-MODEL-001 | Applicable | PASS | §7/8/14 | Readonly TS mirror | None |
| MC-CONVERT-001 | Not applicable | N/A | §7/8/14 | No Java conversion | None |
| MC-LOG-001 | Not applicable | N/A | §7/8/14 | No log/secret | None |
| MC-BEAN-001 | Not applicable | N/A | §7/8/14 | No Java beans | None |
| MC-UTIL-001 | Applicable | PASS | §7/8/14 | Existing Process ID and UTC | None |
| MC-JSON-001 | Applicable | PASS | §7/8/14 | Closed parsed outcome | None |
| MC-TIME-001 | Applicable | PASS | §7/8/14 | Exact UTC micros | None |
| MC-CONFIG-001 | Not applicable | N/A | §7/8/14 | No config | None |
| MC-PATTERN-001 | Applicable | PASS | §7/8/14 | Existing scoped local query | None |
| MC-SCOPE-001 | Applicable | PASS | §7/8/14 | Five Web files and one CALLS only | None |
| MC-TEST-001 | Applicable | PASS | §7/8/14 | Exact finite and static gates | None |
| MC-BLOCKER-001 | Applicable | PASS | §7/8/14 | Design review and separate actual producer source lock | None |

### 20.6 Final verdict

PASS — Ready for user review
