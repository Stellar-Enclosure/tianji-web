# T4-04G Agent owner 的已记录 Tool 事件时间线

| Field | Value |
| --- | --- |
| Document | 2026-11-05-22-29-owned-tool-event-timeline.md |
| Template Version | 9 |
| Archetype Cleanup | Not applicable |
| Status | Review |
| Type | Feature |
| Complexity | Simple |
| Complexity Drivers | 当前运行详情的一个现有 SSE 事件类型投影 |
| Created | 2026-11-05 22:29 Asia/Shanghai |
| Updated | 2026-11-05 22:29 Asia/Shanghai |
| Owner | Tianji Web |
| Repository | tianji-web |
| Scope | 当前 owner 的已记录 TOOL_STARTED 和 TOOL_FINISHED |
| Change Surface | 现有 Agent 运行详情的 Tool 行严格投影、有限测试和文档 |
| Affected Chapters | §7, §8, §10, §12, §14, §15, §16 |
| Source Requirement | Master §19 T4-04 当前可观察 Agent/Tool 事实 |
| Baseline Revision | Web 12ca685a606a6c55c28c1ae48d4258290aed482b；Service authority 7072e5b9153d1cda4ee38be60eeb9651b102a885 |
| Amends | None |
| Supersedes | None |
| Depends On | [Master §19 T4-04](../../../../docs/plans/agent-framework-upgrade-plan.md#t4-04--定义发布与失败恢复运维控制台) |
| Related Specs | None |
| Related Plans | None |

## 1. Summary

Agent 运行详情使用当前已授权并持久记录的 Tool SSE 事件，显示固定状态与记账信息和原始 UTC 时间。识别到未知、畸形或未来 TOOL_ 类型时显示固定未验证提示。工具内部治理字段与原始 payload 不进入 Tool 行。现有运行结果、非 Tool 事件和授柄鉴权维持当前行为。

## 2. Background and Current State

| ID | Evidence | Consequence |
| --- | --- | --- |
| EVD-001 | AS AgentRunSseController#events、AgentRunEventStream#pump、AR AgentLedgerService#events | 已有 tianji.api.agent.events 和 TIANJI_AGENT_READ/tianji:agent:read，流逐页 current actor，AR 先核完整 owner |
| EVD-002 | AR AdkAgentRunExecutor.RunEventSink#tool、AdkGovernedToolBridge.ToolEventVO、ToolPolicy.key | 实际持久 TOOL_STARTED/FINISHED，payload safe declared toolRef、host UUID、state、optional epoch/accounting/error |
| EVD-003 | Web AgentRunDetailPage#visible、agentEvents.ts | 已按 frame 读取和限制 200 行，当前通用 JSON renderer 直接显示 Tool 元数据 |
| EVD-004 | AR AgentLedgerService#inspectRecovery、Source74 EVD | 内部聚合无 HTTP/PaC，不是 invocation 事件；授权与真实 S11 均另行 |
| EVD-005 | AR AdkReadOnlyDecisionLoopTest、AdkGovernedProcessLoopTest | 实际 producer 有完整 STARTED、FINISHED 和缺失 FINISHED 的 finite 故障窗口 |

### 2.5 Archetype example cleanup

Cleanup disposition: Not applicable
Reason: 当前 Web 页面和对应测试，无生成工程或示例替换。

## 3. Goals and Non-goals

显示已经记录的 Tool request/outcome/记账。Tool 行只显示安全声明 key/version、固定状态和时间。无新增请求、API、权限、provider、数据表、恢复动作、自动重放或跨 owner 推断。

### 3.3 Change Surface and Design Depth

| Area/layer | Disposition | Exact repository evidence | Exact delta or preserved invariant | Required Spec treatment | Chapters |
| --- | --- | --- | --- | --- |
| Existing Agent Run Detail | Affected | EVD-002/003 | strict Tool-only display branch | exact view and tests | §7, §8, §10, §12, §14, §15, §16 |
| Agent owner SSE | Context-only | EVD-001/002 | existing route/security and persisted format | verify known contract | §9 |
| V13/internal recovery | Unchanged | EVD-004 | no exposure or SQL | preserve | §11 |

## 4. Requirements and Acceptance Criteria

| ID | Requirement | Acceptance |
| --- | --- | --- |
| REQ-001 | 复用当前 owner 的 SSE | 同 endpoint/current READ/state/reconnect，不加 fetch 或权限 |
| REQ-002 | 闭合实际 Tool 投影 | exact field/branch validation，保留安全 key/version、state、accounting 和 UTC |
| REQ-003 | 隐私及独立状态 | 不显示 raw governance 标识、未知字段或 raw Tool payload。保留非 Tool 和执行结果 |
| REQ-004 | 有限与制品证明 | 实际 RED/finite、typecheck/lint、static zero PaC，独立 browser/runtime |

### 4.2 Use-case analysis

| ID | Actor | Evidence |
| --- | --- | --- |
| ACTOR-001 | 已获当前 Run Detail/SSE READ 的 owner | EVD-001/003 |

| ID | Use case/goal | Actor | Trigger | Outcome | Alternative | Postcondition |
| --- | --- | --- | --- | --- | --- |
| UC-001 | 查看当前 Run 的真实工具事件 | ACTOR-001 | current stream event | fixed tool row with UTC/sequence | malformed/unknown shows unverified | no recovery authority |
| UC-002 | 保留真实运行输出 | ACTOR-001 | Tool corrupt but normal run result | current output remains | auth/reconnect existing behavior | independent state |

## 5. Constraints, Assumptions, and Decisions

DEC-001 original SSE already supplies current-owner facts. DEC-002 Tool events are evidence from existing visible suffix, not all Tool executions or final side effects. DEC-003 no raw fallback for TOOL_ prefix. Tool payload output errors/refs/IDs/epochs never render. DEC-004 keep generic events and terminal logic untouched.

## 6. Project Technology Context

Existing React/TypeScript, AntD, current owner SSE parser and Vitest. Reuse current Gregorian UTC validator and existing row presentation. No dependency.

### 6.2 User-mandated Java rule compliance

| Literal rule | Affected? | Repository evidence | Exact design decision | Files/types/interfaces | Validation/test evidence | Status/blocker |
| --- | --- | --- | --- | --- | --- | --- |
| Rule 1 | No | Web-only §8 | No Java or service contract change | Existing boundary | §14 | N/A |
| Rule 2 | No | Web-only §8 | No Java or service contract change | Existing boundary | §14 | N/A |
| Rule 3 | No | Web-only §8 | No Java or service contract change | Existing boundary | §14 | N/A |
| Rule 4 | No | Web-only §8 | No Java or service contract change | Existing boundary | §14 | N/A |
| Rule 5 | No | Web-only §8 | No Java or service contract change | Existing boundary | §14 | N/A |
| Rule 6 | No | Web-only §8 | No Java or service contract change | Existing boundary | §14 | N/A |
| Rule 7 | No | Web-only §8 | No Java or service contract change | Existing boundary | §14 | N/A |
| Rule 9 | No | Web-only §8 | No Java or service contract change | Existing boundary | §14 | N/A |
| Rule 10 | No | Web-only §8 | No Java or service contract change | Existing boundary | §14 | N/A |
| Rule 11 | No | Web-only §8 | No Java or service contract change | Existing boundary | §14 | N/A |

### 6.3 Time semantics and conversion contract

Time contract: Required

| Time ID | Fields/symbols | Semantics | Java/runtime type | Storage policy | Wire policy | Business zone source | Display zone source | Boundary / DST rules | Precision / Clock | Compatibility | Verification |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| TIME-001 | Tool event occurredAt | Occurred instant | TS string | Not persisted | UTC Z | Existing owner AgentDB UTC | UTC time element | strict Gregorian, no offsets/zone conversion | microseconds, source clock | invalid timestamp fixed unverified, generic rows unchanged | TEST-001 and TEST-002 |

## 7. Architecture Design

### 7.0 Minimum-design baseline and element-necessity audit

| Proposed element | Change | Requirements | Existing alternative | Verdict |
| --- | --- | --- | --- | --- |
| Current Tool rendering | Modify | REQ-002/003 | raw JSON has private internals and weak labels | exact local typed projection |
| Existing owner stream | Keep | REQ-001 | already delivers facts | no added request |
| Public recovery API | None | REQ-001/004 | Source74 private, authority independent | defer |

| Path | Network calls | Client states | Data change | Consequence |
| --- | --- | --- | --- | --- |
| Current Run Detail | existing SSE/result | existing suffix | no writes | source untouched |
| Tool view | none added | narrow presentation only | no new state | safe facts |

### 7.1 System Architecture Design

Current AgentRunDetailPage uses observeAgentRun and the same owner stream. Tool namespace flows through closed local validation into a structured view. Generic rows remain the existing path.

### 7.2 High-Level Design

Preserve sequence, last-200 bound, frame key and generic event handling. Render one Tool row per observed sequence, no pairing, elapsed time, missing-finish inference or retry UI.

### 7.3 Detailed Design

Tool payload accepts only toolRef, hostInvocationId, state, optional dispatchEpoch/accountingState/errorCode. Require exact nested toolRef key, version and contentSha256. Key matches ToolPolicy, version positive JS safe integer, digest lowercase hex64 and UUID canonical lowercase. Epoch is nonnegative safe integer if present. Accounting is SETTLED/PENDING and error is existing uppercase syntax if present.

STARTED must be REQUESTED, epoch zero, no accounting/error. FINISHED UNAVAILABLE requires error, no epoch/accounting in actual emitted payload. FINISHED AWAITING_APPROVAL requires zero epoch, PENDING, no error. Other FINISHED allowed PREPARED, DISPATCHING, SUCCEEDED, REJECTED, FAILED_KNOWN, UNKNOWN require accounting, and epoch can be absent only for SUCCEEDED/REJECTED/FAILED_KNOWN. Unknown or malformed TOOL_ event becomes unverified. Tool timestamp displays original valid UTC micros, otherwise fixed time-unverified. Do not display raw Tool type extension, author, host UUID, digest, epoch, error or extra payload.

## 8. Package Structure and Code File Tree

| Operation | Exact path |
| --- | --- |
| Modify | `src/pages/AgentRunDetailPage.test.tsx` |
| Modify | `src/pages/AgentRunDetailPage.tsx` |
| Create | `docs/egon/spec/2026-11-05-22-29-owned-tool-event-timeline.md` |
| Create | `docs/egon/plan/2026-11-05-22-30-owned-tool-event-timeline.md` |
| Create | `docs/egon/evidence/2026-11-05-owned-tool-event-timeline.md` |

## 9. Interface Definitions

Context-only existing GET /api/tianji/v1/agent-runs/{runId}/events, AgentRunSseController#events and tianji.api.agent.events. Existing USER/SERVICE READ, OAuth scope and exact owner stay; Web only consumes current authorized Cookie stream. No changed SSE event, wire, SDK or authorization.

## 10. POJO and Data Model Design

Web VisibleToolEvent retains safe toolKey, version, closed state and nullable known accounting. VisibleEvent marks Tool namespace separately to disable raw fallback. No backend or wire DTO.

## 11. Database Design

Existing AR persisted events and private recovery journal remain separate. No DB or migration work.

## 12. Frontend Page Design

Use existing event row and sequence, fixed 工具事件 heading, original valid time as time element with UTC. Known states are fixed recorded/requested/approval/report/unknown/unavailable labels. Record accounting independently. Tool events of unknown shape show 工具事件详情未验证. An invalid timestamp shows 工具事件时间未验证. Existing output, cancellation, preference and run status unaffected.

## 13. Design Patterns and Architecture Principles

Direct local projection within existing view. No new abstraction, state owner or service.

## 14. Test Design

| Test | Scope |
| --- | --- |
| TEST-001 | Real emitted Tool payload shapes, started/unknown/approval/success/unavailable and accounting, no hidden raw values |
| TEST-002 | extra/contradictory/malformed or unknown TOOL_ and time edge, no raw fallback |
| TEST-003 | Independent generic RUN_STATUS_CHANGED and existing result with optional malformed Tool |
| TEST-004 | actual finite type/lint and static zero PaC, no browser |

## 15. Non-functional and Cross-cutting Design

Plain text for bounded declared key and fixed labels. No raw governance values, extra logs, response cache, calls or historical reconstruction. Preserve current SSE bound and authority.

## 16. Compatibility, Migration, Rollout, and Rollback

Two Web files and three docs in one commit. No dependency, schema, public API, grants, configuration or PaC delta. Real browser/BFF/S11 independently gated.

## 17. Alternatives and Decisions

A new public recovery API would need separate authorization and disclosure review. Existing persisted SSE already supports a narrow reliable Tool timeline. Use it directly.

## 18. Risks and Open Questions

A missing FINISHED row does not prove running, failed or safe to retry. Actual runtime and external effects remain independently observed.

## 19. Traceability Matrix

| Requirement | Use case | Test |
| --- | --- | --- |
| REQ-001 | UC-001 | TEST-001, TEST-004 |
| REQ-002 | UC-001 | TEST-001, TEST-002 |
| REQ-003 | UC-001, UC-002 | TEST-002, TEST-003 |
| REQ-004 | UC-001, UC-002 | TEST-004 |

## 20. Review and Acceptance

### 20.5 Blocking Manual Check

| Check ID | Applicability | Status | Evidence | Finding | Required action/exception |
| --- | --- | --- | --- | --- | --- |
| MC-ARCH-001 | Applicable | PASS | §7/8/14 | Current Web page and owner stream | None |
| MC-REUSE-001 | Applicable | PASS | §7/8/14 | Existing SSE and safe UI | None |
| MC-DEP-001 | Applicable | PASS | §7/8/14 | No dependency | None |
| MC-NAME-001 | Applicable | PASS | §7/8/14 | Local Tool projection | None |
| MC-VALID-001 | Applicable | PASS | §7/8/14 | Closed current ToolEventVO shape | None |
| MC-MODEL-001 | Applicable | PASS | §7/8/14 | Readonly safe Tool view | None |
| MC-CONVERT-001 | Not applicable | N/A | §7/8/14 | No Java conversion | None |
| MC-LOG-001 | Not applicable | N/A | §7/8/14 | No logging | None |
| MC-BEAN-001 | Not applicable | N/A | §7/8/14 | No backend bean | None |
| MC-UTIL-001 | Applicable | PASS | §7/8/14 | Existing UTC validator and safe TypeScript | None |
| MC-JSON-001 | Applicable | PASS | §7/8/14 | Closed decoded Tool and fixed fallback | None |
| MC-TIME-001 | Applicable | PASS | §7/8/14 | Exact UTC micros | None |
| MC-CONFIG-001 | Not applicable | N/A | §7/8/14 | No config | None |
| MC-PATTERN-001 | Applicable | PASS | §7/8/14 | Direct existing view composition | None |
| MC-SCOPE-001 | Applicable | PASS | §7/8/14 | Exact two Web files plus docs | None |
| MC-TEST-001 | Applicable | PASS | §7/8/14 | Exact finite and static gates | None |
| MC-BLOCKER-001 | Applicable | PASS | §7/8/14 | Existing authority and separate runtime | None |

**PASS — Ready for user review**
