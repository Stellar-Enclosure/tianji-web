# T4-04H 流程侧 Agent 结果观察

| Field | Value |
| --- | --- |
| Document | 2026-11-05-22-47-process-agent-outcomes-console.md |
| Template Version | 9 |
| Archetype Cleanup | Not applicable |
| Status | Review |
| Type | Feature |
| Complexity | Simple |
| Complexity Drivers | 既有只读详情中的一个可选本地证据块和现有权限 |
| Created | 2026-11-05 22:47 Asia/Shanghai |
| Updated | 2026-11-05 22:47 Asia/Shanghai |
| Owner | Tianji Web |
| Repository | tianji-web |
| Scope | 当前身份已读取的一个 Process 实例详情和 Process 本地调度/收件证据 |
| Change Surface | 新 TS GET/decoder、现有 ExecutionTimelinePage 和一条 CALLS |
| Affected Chapters | §7, §8, §10, §12, §14, §15, §16 |
| Source Requirement | Master §19 T4-04 流程侧 Agent 可观察性 |
| Baseline Revision | Web 8d5cd44c1464589b72c584fb553915f22b473d00；PS producer 75d0c15a2ff9bef03be80e7cd7584b2bcbe8401e |
| Amends | None |
| Supersedes | None |
| Depends On | [Process local Agent outcomes §9](../../../../tianji-service/docs/egon/spec/2026-11-05-22-41-process-owned-agent-outcomes.md#9-interface-definitions) |
| Related Specs | [Process correlation console](2026-11-05-21-19-process-correlation-console.md) |
| Related Plans | [Master](../../../../docs/plans/agent-framework-upgrade-plan.md) |

## 1. Summary

当前身份成功读取一个 Process 实例详情后，可手动查询该实例的 Process 本地 Agent 调度和结果收件记录。最多 20 条，独立 opaque cursor。调度状态、收件处理和已记录 Agent 终态并列，和已有同关联标识的 AS 列表分别呈现。

## 2. Background and Current State

| ID | Authority | Boundary |
| --- | --- | --- |
| EVD-001 | PS ProcessAgentOutcomesController and C ProcessAgentOutcomePageDTO; actual producer commit 75d0c15a2ff9bef03be80e7cd7584b2bcbe8401e, Boot SHA da0fb659b90334dc9a1eb087ac8fe2c5c0444fd6092f21920d7428aa5b8392d4, raw PaC SHA cc85967f2c627e7afbf5f06564751cf82f9218dc4b0dc093babc5f61ad361f70, OAS SHA f1fa0bee4a842fb6210e4f6baac99697d9f309506b07e9ee07251ce4de70d58b | exact owned Process-only GET and current READ scope, flags independently default off |
| EVD-002 | Web ExecutionTimelinePage current verified selected detail and separate Agent list | one existing READ page with current issuer/tenant/subject/epoch and abort |
| EVD-003 | Existing Process resource and Web shared requestJson/AuthContext | same current USER cookie and tenant assertion. Real 401/403/tenant409 global authority |
| EVD-004 | PS local outcome producer and separate AS Agent owner | no AS run ID or implied cross-owner authorization or association |

### 2.5 Archetype example cleanup

Cleanup disposition: Not applicable
Reason: 现有 Web 技术应用增量，无生成业务工程或示例替换。

## 3. Goals and Non-goals

Add one optional local outcome read within current Process detail. No new route, menu, permission definition, grant, write, Agent ID link, cross-owner aggregate, new deployment or S12 claim.

### 3.3 Change Surface and Design Depth

| Area/layer | Disposition | Exact repository evidence | Exact delta or preserved invariant | Required Spec treatment | Chapters |
| --- | --- | --- | --- | --- |
| Web decoder, page and references | Affected | EVD-001/002/003 | one independent GET and one CALLS | complete Web design | §7, §8, §10, §12, §14, §15, §16 |
| C/PS REST and runtime | Context-only | EVD-001/004 | current provider unchanged | exact authority | §9 |
| Persistence | Unchanged | PS producer and existing sources | no DB or write | preserve | §11 |

## 4. Requirements and Acceptance Criteria

| ID | Requirement | Acceptance |
| --- | --- | --- |
| REQ-001 | Existing permission and exact chosen detail | Existing Process page/READ/verified instance; no new route, only one CALLS |
| REQ-002 | Closed Process-local outcome query | exact ID/cursor, ≤20, exact enum/nullability and chronology, producer order unchanged |
| REQ-003 | Independent local facts and other panels | separate dispatch/Inbox/recorded terminal, no new AS ID or inference, ordinary errors preserve PS/AS other state |
| REQ-004 | Current frame, artifact and tests | manual query/paging, abort on selection/identity/edit/unmount, actual static and producer authority, runtime independent |

### 4.2 Use-case analysis

| ID | Actor | Evidence |
| --- | --- | --- |
| ACTOR-001 | Current Process READ user with visible selected instance | EVD-001/002 |

| ID | Use case/goal | Actor | Trigger | Outcome | Alternative | Postcondition |
| --- | --- | --- | --- | --- | --- |
| UC-001 | Observe local Agent outcomes for one verified Process instance | ACTOR-001 | explicit button after detail | local receipt state and recorded terminal | empty/unavailable/current auth | only current selected instance |
| UC-002 | Page local outcome results | ACTOR-001 | current opaque next cursor | replaces local page | stale/foreign cursor or selection change | no reuse from another query |

## 5. Constraints, Assumptions, and Decisions

DEC-001 exact successful selected Process detail, no mount read. DEC-002 Process outcome panel independent from PS receipt/detail and AS result. Ordinary errors affect only this panel. Shared auth invalidation stays on real 401/403/tenant409. DEC-003 opaque continuation and no client sorting/pairing of hidden occurrence IDs. DEC-004 actual packaged producer proof required before Source GO.

## 6. Project Technology Context

Existing React/TypeScript, AntD, requestJson and PaC. Reuse exact Process ID and Gregorian UTC validation. No new dependency.

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
| TIME-001 | observedAt, dispatchRecordedAt, receivedAt, decidedAt | Occurred instant | TS string and canonical UTC key | Not persisted | UTC Z | Current PS UTC observation | UTC time element | per-row nondecreasing and at/before observation, nullable by C state | microseconds, no local clock | preserve raw UTC string and producer order | TEST-001 and TEST-002 |

## 7. Architecture Design

### 7.0 Minimum-design baseline and element-necessity audit

| Proposed element | Change | Requirements | Direct alternative | Verdict |
| --- | --- | --- | --- | --- |
| Local outcome TS adapter | Create | REQ-002 | existing Process detail has no outcome facts | consume new exact producer |
| Existing timeline details | Modify | REQ-001/003/004 | independent AS by correlation cannot imply link | separate panel |
| New resource/route | None | REQ-001/004 | current page and READ suffice | preserve |

| Path | Network calls | Client states | Authority | Effect |
| --- | --- | --- | --- | --- |
| Current Process detail | same | existing | exact instance READ | preserved |
| New explicit local panel | 1 GET per request | independent page | existing PS outcome resource | local facts only |

### 7.1 System Architecture Design

Existing ExecutionTimelinePage success → separately scoped ProcessAgentOutcomeLookup → processAgentOutcomesApi → shared requestJson → existing PS exact read. AS current list remains independently rendered.

### 7.2 High-Level Design

Use current selected detail key. Single pending outcome read and request affinity. Selection/edit/next detail changes, owner/epoch, permission or unmount invalidate outcome state. No auto-fetch or persistent cursor.

### 7.3 Detailed Design

Strict GET exact instance, optional v1. with 64 lowercase hex only. Page exact four keys, captured instance, observedAt, max20, nextCursor nullable and only on full page, reject immediate nonprogressing cursor. Row exact seven keys, declared activity grammar, dispatch PENDING/SUBMITTED/ACKNOWLEDGED/CLOSING/CLOSED, Inbox RUN_NOT_CONFIRMED/NOT_OBSERVED/RECEIVED/APPLIED/IGNORED_LATE/DEAD. Terminal only COMPLETED/FAILED/CANCELLED/TIMED_OUT or null. First two Inbox states have no receipt/decision/terminal; RECEIVED requires received/terminal and no decision; APPLIED/IGNORED_LATE require all; DEAD requires received/decided and permits null terminal. UTC micros chronological per row and at or before page observation. Do not infer inter-row date order or activity uniqueness. Preserve producer order and use a page-local row key.

## 8. Package Structure and Code File Tree

| Operation | Exact path |
| --- | --- |
| Create | `src/api/processAgentOutcomes.test.ts` |
| Modify | `src/pages/ExecutionTimelinePage.test.tsx` |
| Create | `src/api/processAgentOutcomes.ts` |
| Modify | `src/pages/ExecutionTimelinePage.tsx` |
| Modify | `src/permissions/references.ts` |
| Create | `docs/egon/spec/2026-11-05-22-47-process-agent-outcomes-console.md` |
| Create | `docs/egon/plan/2026-11-05-22-48-process-agent-outcomes-console.md` |
| Create | `docs/egon/evidence/2026-11-05-process-agent-outcomes-console.md` |

## 9. Interface Definitions

Context-only actual PS GET /api/tianji/v1/process-instances/{instanceId}/agent-outcomes, operation getOwnedProcessAgentOutcomes, resource tianji.api.process.agent.outcomes, existing PROCESS_READ and tianji:process:read, exact START owner. Provider has API/agent-results/owner-outcomes flags and implicit HEAD. Web uses GET only and existing expected tenant and credentials. Disabled route may appear unavailable as 404, with current gateway auth precedence. No producer API or permission change.

## 10. POJO and Data Model Design

Readonly ProcessAgentOutcomePage(instanceId, observedAt, items, nextCursor). Item is activityId, dispatchState, inboxState, terminalStatus, dispatchRecordedAt, receivedAt and decidedAt. No agent run ID, source IDs, hashes, credentials or native mutation field.

## 11. Database Design

No DB activity from Web slice. Existing provider owns exact Process start, dispatch and Inbox evidence.

## 12. Frontend Page Design

After current selected detail renders, show independent 流程侧 Agent 结果 card. Source label 来源：Process 本地调度与结果收件记录. Button 查询流程侧 Agent 结果 and optional 下一页流程侧 Agent 结果. Display actual Process states and optionally recorded Agent terminal separately, missing values 未记录, exact UTC source times. Empty says 此流程暂无本地 Agent 结果记录. Ordinary errors leave other panels. 404 fixed unavailable, continuation 400 asks restart, existing shared auth invalidation remains. No link to AS, no inferred Agent states or Worker actions.

## 13. Design Patterns and Architecture Principles

Reuse existing read and local request scope. A local child panel and adapter suffice. No new global state/store.

## 14. Test Design

| Test | Scope |
| --- | --- |
| TEST-001 | exact encoded GET, tenant/cursor/abort, strict shape, nullability/chronology, repeated activity order, cap, global auth |
| TEST-002 | only current successful detail triggers explicit query, page/selection/context/late cancellation, ordinary errors independent, current source labels |
| TEST-003 | actual static +1 CALLS only, existing page/permissions and exact actual producer proof |

## 15. Non-functional and Cross-cutting Design

Up to 20 rows and one outcome request; no auto retries/storage, source UTC text and fixed messages. No private result/raw response logs.

## 16. Compatibility, Migration, Rollout, and Rollback

One Web commit. Add exactly one existing producer CALLS reference with no permission definition, PAGE/MENU, endpoint or schema change. Runtime disabled gate and real IAM/BFF/browser remain independently authorized.

## 17. Alternatives and Decisions

An AS read by correlation cannot prove linked outcomes. Use existing Process-local authoritative facts and keep the AS list independent. No separate route or cross-owner grant.

## 18. Risks and Open Questions

Requires actual reviewed PS producer artifact before Web source GO. A null or absent terminal field means local evidence absent/unconfirmed, and cannot establish Agent runtime absence or failure. Full S12 remains separate.

## 19. Traceability Matrix

| Requirement | Use case | Test |
| --- | --- | --- |
| REQ-001 | UC-001 | TEST-002, TEST-003 |
| REQ-002 | UC-001, UC-002 | TEST-001, TEST-002 |
| REQ-003 | UC-001 | TEST-002 |
| REQ-004 | UC-001, UC-002 | TEST-002, TEST-003 |

## 20. Review and Acceptance

### 20.5 Blocking Manual Check

| Check ID | Applicability | Status | Evidence | Finding | Required action/exception |
| --- | --- | --- | --- | --- | --- |
| MC-ARCH-001 | Applicable | PASS | §7/8/14 | Current Process page and exact owner consumer | None |
| MC-REUSE-001 | Applicable | PASS | §7/8/14 | Existing layout, requestJson, authority | None |
| MC-DEP-001 | Applicable | PASS | §7/8/14 | No dependency change | None |
| MC-NAME-001 | Applicable | PASS | §7/8/14 | Exact local API and page names | None |
| MC-VALID-001 | Applicable | PASS | §7/8/14 | Closed instance, cursor, state and chronology | None |
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

**PASS — Ready for user review**
