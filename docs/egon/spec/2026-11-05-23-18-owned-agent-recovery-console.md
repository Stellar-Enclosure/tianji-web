# T4-03 当前 Agent 运行恢复证据面板

| Field | Value |
| --- | --- |
| Document | 2026-11-05-23-18-owned-agent-recovery-console.md |
| Template Version | 9 |
| Archetype Cleanup | Not applicable |
| Status | Review |
| Type | Feature |
| Complexity | Simple |
| Complexity Drivers | Existing run detail with one optional exact read |
| Created | 2026-11-05 23:18 Asia/Shanghai |
| Updated | 2026-11-05 23:18 Asia/Shanghai |
| Owner | Tianji Web |
| Repository | tianji-web |
| Scope | 当前已授权一个 Agent run 的显式只读恢复证据 |
| Change Surface | New TS adapter and decoder, current detail and one CALLS |
| Affected Chapters | §7, §8, §10, §12, §14, §15, §16 |
| Source Requirement | 主计划 §19 T4-03 恢复处置及 T4-04 运营呈现 |
| Baseline Revision | Web a5e7c15407f53d36378248e2cdf47bc7bfb26a4b；AS producer d9bec9c34bdbaa337cb5bd8eb776e2383bac97c6 |
| Amends | None |
| Supersedes | None |
| Depends On | [AS owned recovery disposition](../../../../tianji-service/docs/egon/spec/2026-11-05-23-14-agent-owner-recovery-disposition.md#9-interface-definitions) |
| Related Specs | [Owned Tool event timeline](2026-11-05-22-29-owned-tool-event-timeline.md) |
| Related Plans | [Master](../../../../docs/plans/agent-framework-upgrade-plan.md) |

## 1. Summary

当前身份成功读取一条 Agent 运行后，可显式读取其恢复处置证据。显示运行账本和本地 Tool 证据的观察时刻、状态、原因、效果、覆盖范围和三值事实。记录冲突提示人工核对。既有输出、Tool 历史与其他运行能力保留原入口。

## 2. Background and Current State

| Evidence ID | Classification | Exact source | Observed fact |
| --- | --- | --- | --- |
| EVD-001 | Producer | AS AgentRecoveryDispositionController, C AgentRecoveryDispositionDTO, AS static agent-recovery-disposition-v1.json | Exact own-run GET, no query/body, existing Agent READ/scope and a separate resource, disabled by default. Accepted producer source d9bec9c34bdbaa337cb5bd8eb776e2383bac97c6. AS Boot SHA-256 76016c1d5140cccc707e9e020b457cc5946e854fa2c0c32e5580d76567bae333, raw PaC SHA-256 a762fbe7316bdb46c01a98438056b3277228b7eb7b45b04bb4dca23720723a26, and OAS SHA-256 c03760cd3bb0b4bee3dba9c11b707e7a3d8de4406cedce6f89c76969e0e9eb0c. |
| EVD-002 | Current Web | AgentRunDetailPage/AgentRunDetailContent, existing tianji.page.runDetail | Existing current owner GET, event and result reads. Inner mount is keyed by issuer, tenant, subject, request epoch and run. |
| EVD-003 | Shared Web transport | api/client.ts requestJson, AuthContext, gatewayAuth | Cookie BFF, tenant assertion, no-store, request epoch and shared auth invalidation. No alternate transport. |
| EVD-004 | Existing Tool timeline | 2026-11-05-22-29-owned-tool-event-timeline.md | Reported historical event states, independent of current bounded AR recovery read. |
| EVD-005 | Root scratch evidence | recovery-console/root/isolated-r1.log, isolated-r2.log, isolated-g1.log | Both assertion gates and 31 selected Vitest cases observed outside repo, plus typecheck/lint. No actual BFF/browser. |

### 2.5 Archetype example cleanup

Cleanup disposition: Not applicable

Reason: Existing Web repository detail extension, no generated module or example.

## 3. Goals and Non-goals

呈现当前 owner 的现有恢复读证据。页面不添加恢复、重放、接管、补偿动作或权限，也不依据缺席记录判断无外部影响。真实 BFF、IAM、浏览器和 S11 独立。

### 3.3 Change Surface and Design Depth

| Area/layer | Disposition | Exact repository evidence | Changed or preserved behavior/contract | Required Spec treatment | Chapter(s) |
| --- | --- | --- | --- | --- | --- |
| Web current detail and read-only panel | Affected | EVD-002/004/005 | One explicit card, local output and error | Exact mount, lifecycle, rendering and safety | §7/§12/§14 |
| Web TypeScript BFF adapter and PaC reference | Affected | EVD-001/003 | One no-store GET and strict closed decoder | Request, equality, UTC/enums, exact CALLS and rollout | §7/§8/§10/§14/§15/§16 |
| Producer/runtime and existing Agent routes | Context-only | EVD-001–004 | Producer is authoritative and default off; existing grants and behavior remain | Lock and compatibility | §9/§11/§16 |

## 4. Requirements and Acceptance Criteria

| ID | Atomic requirement | Priority | Observable acceptance criteria | Source |
| --- | --- | --- | --- | --- |
| REQ-001 | Explicit current-owner evidence read | Must | Existing run detail loaded and tianji.page.runDetail permitted; button sends one exact run GET through existing BFF; no auto request, controls or external inference | EVD-001–003 |
| REQ-002 | Decode only exact evidence | Must | Same requested ID, exact objects and enum/UTC/flag relationships, no raw fallback | EVD-001/005 |
| REQ-003 | Preserve meaning and isolate async state | Must | Source label, existing lifecycle/reason/effect, distinct true/false/null and coverage; conflict means inspect. Abort on existing route/identity/refresh unmount, ordinary failure leaves detail | EVD-002–005 |
| REQ-004 | Preserve authorization and evidence boundary | Must | Exactly one producer CALLS declaration, no grant, page/menu or config changes; local vs actual source/runtime evidence distinct | EVD-001/003/005 |

### 4.2 Use-case analysis

#### 4.2.1 Actor inventory

| Actor ID | Actor/role | Goal and responsibility | Entry/channel | Permission/tenant context | Evidence |
| --- | --- | --- | --- | --- | --- |
| ACTOR-001 | Current authenticated run owner | Explicitly inspect evidence on known run | Existing Agent detail | Current Agent READ page plus producer authorization | EVD-001/002 |
| ACTOR-002 | Agent Server | Verify current owner, return bounded local evidence | Existing BFF transport | Existing current resource and exact AR owner | EVD-001/003 |

#### 4.2.2 Use-case artifact

| ID | Use case/goal | Primary actor | Supporting actors/systems | Trigger | Preconditions | Main success outcome | Alternatives/failures | Postconditions | Requirements | Interfaces/pages | Tests |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| UC-001 | Read recovery evidence for loaded run | ACTOR-001 | ACTOR-002, shared BFF | Explicit button click | Owned detail and existing auth current, producer available | Fixed evidence labels and UTC observation | 404, unavailable, invalid, abort or auth invalidation | No run mutation or recovery decision | REQ-001–004 | UI-001 | TEST-001–004 |

## 5. Constraints, Assumptions, and Decisions

| ID | Decision or constraint |
| --- | --- |
| DEC-001 | Reuse current run detail and agent recovery producer contract, no independent frontend page, menu, permission code or feature flag. |
| DEC-002 | A single CALLS reference describes dependency, grants nothing. Actual producer resource policy and BFF route remain authoritative. |
| DEC-003 | Use existing requestJson and global failure logic. Plain lookup failure preserves independent details while still current. A real identity invalidation clears the page through existing policy. |
| DEC-004 | Coverage and three-value flags describe local observations only. No state supports automatic resume or proof of external effect absence. |
| ASM-001 | Hosted endpoint default off and externally provisioned BFF route mean runtime availability requires separate owner evidence. |

## 6. Project Technology Context

Existing TypeScript, React, Ant Design, Vitest, requestJson, Web PaC reference registry. No Java or new dependencies.

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
| TIME-001 | RecoveryDisposition.observedAt | Occurred instant | TypeScript string | Not persisted | UTC Z | Not applicable: observed instant | Explicit UTC | Producer clock and exact parser, no browser zone conversion | Existing calendar/microsecond validator, preserve all bytes on display | Current time helpers and routes unaffected | TEST-001/002 |

## 7. Architecture Design

### 7.0 Minimum-design baseline and element-necessity audit

| Proposed element | Change | Requirements | Existing/direct alternative | Concrete inadequacy of alternative | Added calls/state/coupling/failures/migration/operations | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| Existing owned run detail evidence card | Add | REQ-001/003 | Existing historical Tool events only | Historical events do not supply current bounded recovery facts | One explicit read with local abort/state | Add |
| Strict TS read adapter | Add | REQ-001/002 | Generic fetch or existing result | Recovery has closed distinct evidence contract | Reuse requestJson, no new transport | Add |
| Exact PaC CALLS | Add | REQ-004 | Existing Agent reads | Missing producer resource dependency | One reference, zero grant | Add |
| New control or page | Keep | REQ-004 | New sidebar/action | Existing read view sufficient and no restore authority | None | Keep |

| Path | Network calls | Client states | Server contracts/state | Failure and TOCTOU points | Additional user/business value |
| --- | --- | --- | --- | --- | --- |
| Direct baseline | 0 new | Current run detail | Current APIs | Existing owner guard | Current summary |
| Selected design | 1 per explicit click | Independent idle/loading/result/error | Existing read-only producer | Current binding and abort | Current recovery evidence and limits |

### 7.1 System Architecture Design

Owned AgentRunDetailPage → agentRecoveryApi.get → current requestJson BFF → accepted AS owned read → validated local evidence card.

### 7.2 High-Level Design

Show a separate read-only card below the existing run snapshot. It reuses existing view permission and does not request evidence until explicit interaction. API failures are rendered as fixed safe copy while the view remains authorized.

### 7.3 Detailed Design

1. Use known current tenant and runId already visible from current run detail. Require exact ASCII [A-Za-z0-9_-]{1,64}, encode path, GET with no body/parameters and no-store through requestJson. Same-run echo is mandatory.
2. Validate exact root fields runId, observedAt, lifecycle, reason, agentEffect, toolEvidence, evidenceConflict. Strict UTC calendar and up to microsecond input. Known lifecycle/reason mapping as AS. Nonterminal effect only UNVERIFIED. toolEvidence exact coverage plus hasDispatching/hasUnknownResult/hasUnresolvedWrite/hasLocalReceipt. COMPLETE requires booleans, TRUNCATED true/null, UNAVAILABLE all null. An observed unresolved write must have dispatching or unknown evidence. evidenceConflict exactly RECORDED_NONE and unresolved write true.
3. Mount RecoveryEvidenceCard only for loaded/current Agent detail with tianji.page.runDetail, and key it by existing reload within the identity/run mount. One AbortController, suppress duplicate, clear local result at retry, drop late aborted response. Unmount aborts on changed route/identity/request epoch, explicit reload or page access removal. Existing view state independent.
4. Source label 来源：Agent 运行账本与本地工具证据. Render known locale labels, exact UTC text, and per-flag 已观察到 / 未观察到 / 未能确认. Conflict shown as 运行账本与工具证据不一致，需要人工核对。 Normal 404 uses safe distinct copy; other exceptions use fixed unavailable. Never expose raw errors or evidence detail. No new controls.

## 8. Package Structure and Code File Tree

| Action | Exact path | Responsibility |
| --- | --- | --- |
| Create | src/api/agentRecovery.ts | Typed GET and closed decoder |
| Create | src/api/agentRecovery.test.ts | Fixture transport and rejection |
| Modify | src/pages/AgentRunDetailPage.tsx | Existing detail's local evidence card |
| Modify | src/pages/AgentRunDetailPage.test.tsx | Explicit click, evidence, failure and abort |
| Modify | src/permissions/references.ts | One tianji.api.agent.recovery.disposition CALLS |

## 9. Interface Definitions

No new Web API or producer modification. Existing AS UI consumer contract is [API-001](../../../../tianji-service/docs/egon/spec/2026-11-05-23-14-agent-owner-recovery-disposition.md#9-interface-definitions). Exact GET /api/tianji/v1/agent-runs/{runId}/recovery-disposition. Use standard tenant assertion, cookies, current provider and abort. Runtime forwards require current owner provisioning.

## 10. POJO and Data Model Design

No Java. Internal TS RecoveryDisposition and existing producer data only. Nullable flags mean unknown, not false. Observation is explicitly separate from result/Tool event states. No new persisted client state, identifiers or raw evidence.

## 11. Database Design

No direct DB or source schema change. AS owner runtime keeps its existing read authority.

## 12. Frontend Page Design

| Page ID | Existing route | Entry/trigger | Key states | Authority | Acceptance |
| --- | --- | --- | --- | --- | --- |
| UI-001 | /runs/:runId | Existing detail successfully loaded, explicit 读取恢复证据 | idle/loading/success/404/unavailable/conflict | Existing page guard and producer READ resource | Current snapshot rendered, no stale or privileged action |

Panel title 恢复证据, fixed source, observation time, lifecycle, reason, effect, coverage, and four flags. No polling or automatic recovery. Existing timeline/results not merged into evidence.

## 13. Design Patterns and Architecture Principles

Direct existing view extension, one decoder and one local child for independent abort/error lifecycle. No global state, routing abstraction or new dependency.

## 14. Test Design

| Test ID | Exact finite or package proof | Expected observation |
| --- | --- | --- |
| TEST-001 | src/api/agentRecovery.test.ts | Foreign run, malformed combinations and exact HTTP rejected/accepted as appropriate |
| TEST-002 | src/pages/AgentRunDetailPage.test.tsx | No read before click, display known/unknown, ordinary error preserves detail, identity abort |
| TEST-003 | src/api/agentEvents.test.ts and existing typecheck/lint | Existing SSE and page behavior preserved |
| TEST-004 | Official Web static package and actual AS PaC/OAS comparison | Exactly one CALLS to existing actual producer, no new permission code or deployment |

## 15. Non-functional and Cross-cutting Design

One explicit bounded no-store operation. Fixed safe copy. BFF auth invalidation unchanged. Hidden fields and raw diagnostics rejected, no clipboard/prompt/payload surfaces.

## 16. Compatibility, Migration, Rollout, and Rollback

No migration, dependency, new frontend route or flag. Same existing READ and current runtime policy. Static build does not enable AS endpoint or alter BFF registration. Can revert the isolated Web change.

## 17. Alternatives and Decisions

| Alternative | Decision | Reason |
| --- | --- | --- |
| Infer current state from existing run/tool events | Rejected | Local authoritative snapshot and evidence limits differ |
| Add automatic restore/control | Rejected | Producer is a read-only contract |
| New standalone console page | Rejected | Existing detail provides exact known run and permission |
| One explicit detail panel | Selected | Independent optional read and low interaction cost |

## 18. Risks and Open Questions

| ID | Status | Disposition |
| --- | --- | --- |
| OPEN-001 | Actual producer source and static package locked | Verify retained exact bytes again before Web source write |
| OPEN-002 | BFF forwarding, IAM, feature enablement and browser not verified | Separate owner runtime acceptance |
| OPEN-003 | S11 and automatic resume not authorized by this evidence | Continue independent durable/runtime gates |

## 19. Traceability Matrix

| Requirement | Use case/page | Design | Tests |
| --- | --- | --- | --- |
| REQ-001 | UC-001/UI-001 | §7/§9/§12 | TEST-001/002 |
| REQ-002 | UC-001/UI-001 | §7/§10 | TEST-001 |
| REQ-003 | UC-001/UI-001 | §7/§12 | TEST-002/003 |
| REQ-004 | UC-001/UI-001 | §8/§15/§16 | TEST-003/004 |

## 20. Review and Acceptance

### 20.5 Blocking Manual Check

| Check ID | Applicability | Status | Evidence | Finding | Required action/exception |
| --- | --- | --- | --- | --- | --- |
| MC-ARCH-001 | Applicable | PASS | §7/8/14 | Current Agent run detail and exact owner consumer | None |
| MC-REUSE-001 | Applicable | PASS | §7/8/14 | Existing layout, requestJson, authority | None |
| MC-DEP-001 | Applicable | PASS | §7/8/14 | No dependency change | None |
| MC-NAME-001 | Applicable | PASS | §7/8/14 | Exact local API and page names | None |
| MC-VALID-001 | Applicable | PASS | §7/8/14 | Closed run, lifecycle and evidence flag relationships | None |
| MC-MODEL-001 | Applicable | PASS | §7/8/14 | Readonly TS mirror | None |
| MC-CONVERT-001 | Not applicable | N/A | §7/8/14 | No Java conversion | None |
| MC-LOG-001 | Not applicable | N/A | §7/8/14 | No log/secret | None |
| MC-BEAN-001 | Not applicable | N/A | §7/8/14 | No Java beans | None |
| MC-UTIL-001 | Applicable | PASS | §7/8/14 | Exact Agent run ID and existing UTC helper | None |
| MC-JSON-001 | Applicable | PASS | §7/8/14 | Closed parsed recovery evidence | None |
| MC-TIME-001 | Applicable | PASS | §7/8/14 | Exact UTC micros | None |
| MC-CONFIG-001 | Not applicable | N/A | §7/8/14 | No config | None |
| MC-PATTERN-001 | Applicable | PASS | §7/8/14 | Existing scoped local query | None |
| MC-SCOPE-001 | Applicable | PASS | §7/8/14 | Five Web files and one CALLS only | None |
| MC-TEST-001 | Applicable | PASS | §7/8/14 | Exact finite and static gates | None |
| MC-BLOCKER-001 | Applicable | PASS | §7/8/14 | Design review and separate actual producer source lock | None |


### 20.6 Final verdict

PASS — Ready for user review

当前为 Web 源码审阅候选，实际 AS 生产者和制品已锁定。真实服务和恢复验收独立。
