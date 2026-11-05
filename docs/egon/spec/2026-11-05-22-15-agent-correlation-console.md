# T4-04F 流程关联页的独立 Agent 查询

| Field | Value |
| --- | --- |
| Document | 2026-11-05-22-15-agent-correlation-console.md |
| Template Version | 9 |
| Archetype Cleanup | Not applicable |
| Status | Review |
| Type | Feature |
| Complexity | Simple |
| Complexity Drivers | 同一既有 Web 页面上的一个可选独立 Agent LIST 读取 |
| Created | 2026-11-05 22:15 Asia/Shanghai |
| Updated | 2026-11-05 22:15 Asia/Shanghai |
| Owner | Tianji Web |
| Repository | tianji-web |
| Scope | 已经有 Process 回执页面和现有 Agent READ 的当前身份 |
| Change Surface | 既有 Agent TS API 和现有关联页的独立只读区域 |
| Affected Chapters | §7, §8, §10, §12, §14, §15, §16 |
| Source Requirement | Master §19 T4-04/T4-02 exact current owner correlation discovery |
| Baseline Revision | Web 45184f1b464d2c6d7c1a4838db8f2dbc4392282a；AS actual producer 7072e5b9153d1cda4ee38be60eeb9651b102a885 |
| Amends | None |
| Supersedes | None |
| Depends On | [AS owned filter §9](../../../../tianji-service/docs/egon/spec/2026-11-05-21-52-owned-agent-correlation-filter.md#9-interface-definitions) |
| Related Specs | [Process correlation console](2026-11-05-21-19-process-correlation-console.md) |
| Related Plans | [Master](../../../../docs/plans/agent-framework-upgrade-plan.md) |

## 1. Summary

流程关联页只在当前用户已有 Agent READ 页面权限且成功得到 Process 回执页后提供显式 Agent 查询。两侧使用同一已提交的 correlation 和 UTC 窗口，分别授权、显示和分页。Agent 列表明确表示当前身份的同关联标识结果，无执行链推断。

## 2. Background and Current State

| ID | Evidence | Boundary |
| --- | --- | --- |
| EVD-001 | AS producer archive SHA f4cf3380bb22929bad18ff198d0e85b7cc67b7b5d061d5ac6a17f29187e4b1b4；raw PaC SHA 1042f3e1b48fe202b3bb17a8c551b1b6eaafa22352e9c96fd12806582dd0e971；packaged OAS SHA 718db475744eab746ad41f9307a8263381a0582ec6682bbb953f70ec6e4b3b6a | Existing Agent LIST optional exact filter, same resource and existing summary DTO |
| EVD-002 | Web ExecutionTimelinePage and processCorrelationsApi | Existing Process-only receipt and selected detail workflow, exact UTC and current frame |
| EVD-003 | Existing App/permissions/resources.ts/references.ts | Agent LIST CALLS already declared, tianji.page.runs and tianji.page.runDetail independently checked |
| EVD-004 | Web requestJson and AuthContext | 401/403/tenant 409 retain existing shared session invalidation |
| EVD-005 | PS V5/V6 and AR V7 owner relation | Same correlation text does not prove cross-owner link |

### 2.5 Archetype example cleanup

Cleanup disposition: Not applicable
Reason: 现有 Web 技术增量，无新工程或 archetype 示例链。

## 3. Goals and Non-goals

Expose a separate optional Agent result block for the current identity. No new route, permission declaration, CALLS reference, query key identity, backend, startup or new business association.

### 3.3 Change Surface and Design Depth

| Area/layer | Disposition | Exact repository evidence | Exact delta or preserved invariant | Required Spec treatment | Chapters |
| --- | --- | --- | --- | --- | --- |
| Web LIST consumer and existing timeline page | Affected | EVD-002/003 | opt-in Agent query and independent result/continuation | complete UI/API | §7, §8, §10, §12, §14, §15, §16 |
| Backend/PaC/authority | Context-only | EVD-001/003/004 | same route and current auth | existing contract | §9 |
| Persistence/Agent↔Process relation | Unchanged | EVD-005 | no cross-owner inference | scope boundary | §11 |

## 4. Requirements and Acceptance Criteria

| ID | Requirement | Acceptance |
| --- | --- | --- |
| REQ-001 | Use existing authorization | Existing Process page, tianji.page.runs gate and existing Agent LIST, no PaC delta |
| REQ-002 | Strict independent Agent request | manual same submitted filter, no Process cursor reuse, existing GET, ≤20 and strict Agent cursor/order/window |
| REQ-003 | Keep evidence independent | fixed source label, no inferred link, existing detail route only if current permission |
| REQ-004 | Handle concurrent state and auth | owner/edit/unmount/permission abort; ordinary Agent error preserves PS, real shared 401/403/tenant409 disposes global frame |
| REQ-005 | Actual scoped proof | real finite/type/lint and actual static zero PaC, runtime independent |

### 4.2 Use-case analysis

| ID | Actor | Evidence |
| --- | --- | --- |
| ACTOR-001 | Existing Process page user who also has current Agent READ | EVD-002/003 |

| ID | Use case/goal | Actor | Trigger | Outcome | Failure/alternative | Postcondition |
| --- | --- | --- | --- | --- | --- | --- |
| UC-001 | Look up owned Agent runs with same correlation independently | ACTOR-001 | explicit click after current Process receipt page | bounded Agent list and optional detail link | missing Agent READ, ordinary failure, current auth invalid | no cross-owner inference; no inherited cursor |
| UC-002 | Page Agent independently | ACTOR-001 | current Agent next cursor | same query and new Agent page only | stale/current owner changes | PS evidence kept on ordinary errors |

## 5. Constraints, Assumptions, and Decisions

DEC-001 optional UI after a successful Process page only and current Agent READ page guard. DEC-002 keep existing global invalidation on real 401/403/tenant 409. Ordinary Agent read failures keep existing PS evidence. DEC-003 never reuse or decode PS cursor for Agent. DEC-004 no claim of association from same text.

## 6. Project Technology Context

Existing React/TypeScript, AntD, Vitest and shared requestJson. Reuse Process form validators in this consumer deliberately limited to Process-compatible ASCII correlation. AS broad safe key support is not changed.

### 6.2 User-mandated Java rule compliance

| Literal rule | Affected? | Repository evidence | Exact design decision | Files/types/interfaces | Validation/test evidence | Status/blocker |
| --- | --- | --- | --- | --- | --- | --- |
| Rule 1 | No | Web-only §8 | No Java or existing service contract change | Existing boundary | §14 | N/A |
| Rule 2 | No | Web-only §8 | No Java or existing service contract change | Existing boundary | §14 | N/A |
| Rule 3 | No | Web-only §8 | No Java or existing service contract change | Existing boundary | §14 | N/A |
| Rule 4 | No | Web-only §8 | No Java or existing service contract change | Existing boundary | §14 | N/A |
| Rule 5 | No | Web-only §8 | No Java or existing service contract change | Existing boundary | §14 | N/A |
| Rule 6 | No | Web-only §8 | No Java or existing service contract change | Existing boundary | §14 | N/A |
| Rule 7 | No | Web-only §8 | No Java or existing service contract change | Existing boundary | §14 | N/A |
| Rule 9 | No | Web-only §8 | No Java or existing service contract change | Existing boundary | §14 | N/A |
| Rule 10 | No | Web-only §8 | No Java or existing service contract change | Existing boundary | §14 | N/A |
| Rule 11 | No | Web-only §8 | No Java or existing service contract change | Existing boundary | §14 | N/A |

### 6.3 Time semantics and conversion contract

Time contract: Required

| Time ID | Fields/symbols | Semantics | Java/runtime type | Storage policy | Wire policy | Business zone source | Display zone source | Boundary / DST rules | Precision / Clock | Compatibility | Verification |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| TIME-001 | fromInclusive/toExclusive, createdAt | Occurred instant | TS string, exact UTC key | Not persisted | UTC Z | Explicit UTC | UTC time text | Same half-open current PS window, no local calendar | six fraction digits, current server clock authority | Existing public Agent time values | TEST-001 and TEST-002 |

## 7. Architecture Design

### 7.0 Minimum-design baseline and element-necessity audit

| Proposed element | Change | Requirements | Direct alternative | Verdict |
| --- | --- | --- | --- | --- |
| Existing agentApi | Modify | REQ-002/004 | old LIST no filter | exact local overload |
| Existing timeline | Modify | REQ-001/003/004 | separate page would add route/PaC | one optional independent block |
| Backend and grant | None | REQ-001/005 | actual same resource | preserve |

| Path | Network calls | Client states | Authority | Consequence |
| --- | --- | --- | --- | --- |
| Existing PS query | one current PS GET | existing page | PROCESS_READ | preserved |
| Optional AS | one explicit LIST GET per page | separate block/cursor | current Agent READ | current owned same-key view |

### 7.1 System Architecture Design

Existing ExecutionTimelinePage retains PS state. Optional AgentCorrelationRuns owns separate abort and page state. Existing agentApi → requestJson → same protected AS LIST with optional filter. Existing AuthContext owns global authority changes.

### 7.2 High-Level Design

Only a current visible Process receipt page and allows(tianji.page.runs) can present Agent controls. Child keyed by current exact query, captures tenant/frame and drops state on replacement. Current Agent detail link uses allows(tianji.page.runDetail).

### 7.3 Detailed Design

Process correlation grammar and UTC ≤31d reused. Initial Agent request includes only exact correlationId/fromInclusive/toExclusive. Agent continuation adds only its v1. token ≤256 and does not repeat the submitted cursor. Exact browser response is AgentRunPageDTO, at most 20 existing summary rows, no extra keys or duplicate IDs. Existing run summary validates C enum and bounds; filter adds UTC-microsecond window and descending exact ASCII run ID ties, max64 ID, next only on 20. Body has no echoed correlation or association, so transport/query state binds context and browser validates shape/time rather than asserting server-side association.

Current global authorization invalidation stays. Ordinary 400/404/503, malformed data and local failures affect only Agent region. New Process query/edit/next, logout, tenant/issuer/subject/epoch, grant loss or unmount aborts/drops Agent results. No retry or polling.

## 8. Package Structure and Code File Tree

| Operation | Exact path |
| --- | --- |
| Modify | `src/api/agent.test.ts` |
| Modify | `src/pages/ExecutionTimelinePage.test.tsx` |
| Modify | `src/api/agent.ts` |
| Modify | `src/pages/ExecutionTimelinePage.tsx` |
| Create | `docs/egon/spec/2026-11-05-22-15-agent-correlation-console.md` |
| Create | `docs/egon/plan/2026-11-05-22-16-agent-correlation-console.md` |
| Create | `docs/egon/evidence/2026-11-05-agent-correlation-console.md` |

## 9. Interface Definitions

Context-only existing GET /api/tianji/v1/agent-runs, tianji.api.agent.list, current TIANJI_AGENT_READ and tianji:agent:read. New consumer uses existing optional filter contract, same Cookie/tenant transport, no owner/query limit or credential in URL. Current /runs/:runId GET remains independently protected. No new service contract.

## 10. POJO and Data Model Design

Reuse ProcessCorrelationQuery for the narrower Web handoff, AgentRunPage and AgentRun for unchanged AS response. Opaque Agent continuation state has the smaller 256 cap. TS displays only current fields. No extra storage.

## 11. Database Design

No database or cross-owner projection. Existing PS and AS owners each control their own data independently.

## 12. Frontend Page Design

Agent block title 同关联标识的当前身份 Agent 运行 and 来源：Agent 运行记录. Button 查询同关联标识的 Agent 运行, optional 下一页 Agent 运行, and existing run route links only under detail authority. Display same-owner run ID, creation UTC and existing summary fields. Preserve Process result and inline detail during ordinary Agent failures. No claim that Process caused/linked the Agent run, no service credentials or Agent/Worker/cost synthesis.

## 13. Design Patterns and Architecture Principles

Reuse existing local bounded query and frame lifetime. Keep independently authorized PS and AS separate. No frontend global store or broker.

## 14. Test Design

| Test | Scope |
| --- | --- |
| TEST-001 | exact original LIST, optional filtered wire, UTC/cursor/count/order, malformed and real 403 invalidation |
| TEST-002 | explicit optional action, no PS cursor leak, next, owner/read grant/epoch abort, ordinary error stays separate |
| TEST-003 | actual Web package and zero PaC compared to same baseline and existing AS LIST authority |

## 15. Non-functional and Cross-cutting Design

Finite up to 20 rows, only one Agent read at a time and no persisted cursor. Strict Gregorian UTC and micros. No new metric, external identity, owner echo or secret log.

## 16. Compatibility, Migration, Rollout, and Rollback

Exact four Web files and three docs in one commit. Existing Page/APP/permission/route declarations stay identical. Backend is already packaged. No deployment/browser/BFF/IAM approval or S12 conclusion.

## 17. Alternatives and Decisions

An independent route would introduce redundant app/PaC surface. Joining by correlation string would manufacture provenance. The optional independently authorized panel preserves owner boundaries and existing entry.

## 18. Risks and Open Questions

Actual network/browser, V15, full Process↔Agent relation and S12 remain separate. Global shared 403 invalidation intentionally removes the current session frame.

## 19. Traceability Matrix

| Requirement | Use case | Test |
| --- | --- | --- |
| REQ-001 | UC-001 | TEST-002/003 |
| REQ-002 | UC-001, UC-002 | TEST-001/002 |
| REQ-003 | UC-001 | TEST-002 |
| REQ-004 | UC-001, UC-002 | TEST-001/002 |
| REQ-005 | UC-001, UC-002 | TEST-003 |

## 20. Review and Acceptance

### 20.5 Blocking Manual Check

| Check ID | Applicability | Status | Evidence | Finding | Required action/exception |
| --- | --- | --- | --- | --- | --- |
| MC-ARCH-001 | Applicable | PASS | §7/8/14 | Existing Web/API owners | None |
| MC-REUSE-001 | Applicable | PASS | §7/8/14 | Existing shared transport and routes | None |
| MC-DEP-001 | Applicable | PASS | §7/8/14 | No dependency changes | None |
| MC-NAME-001 | Applicable | PASS | §7/8/14 | Existing exact local API/page names | None |
| MC-VALID-001 | Applicable | PASS | §7/8/14 | Closed filtered shape/current owner | None |
| MC-MODEL-001 | Applicable | PASS | §7/8/14 | Readonly existing C mirror | None |
| MC-CONVERT-001 | Not applicable | N/A | §7/8/14 | No Java conversion | None |
| MC-LOG-001 | Not applicable | N/A | §7/8/14 | No new log | None |
| MC-BEAN-001 | Not applicable | N/A | §7/8/14 | No backend bean | None |
| MC-UTIL-001 | Applicable | PASS | §7/8/14 | Existing UTC and local Web primitives | None |
| MC-JSON-001 | Applicable | PASS | §7/8/14 | Closed parsed summary | None |
| MC-TIME-001 | Applicable | PASS | §7/8/14 | UTC micros | None |
| MC-CONFIG-001 | Not applicable | N/A | §7/8/14 | No config | None |
| MC-PATTERN-001 | Applicable | PASS | §7/8/14 | Existing scoped request | None |
| MC-SCOPE-001 | Applicable | PASS | §7/8/14 | Four Web files, no PaC delta | None |
| MC-TEST-001 | Applicable | PASS | §7/8/14 | Exact finite/static proof | None |
| MC-BLOCKER-001 | Applicable | PASS | §7/8/14 | Actual producer fixed, runtime separate | None |

**PASS — Ready for user review**
