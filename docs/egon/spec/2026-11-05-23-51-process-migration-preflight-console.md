# T4-01B1/T4-04 Process 单实例迁移预检控制台

| Field | Value |
| --- | --- |
| Document | 2026-11-05-23-51-process-migration-preflight-console.md |
| Template Version | 9 |
| Archetype Cleanup | Not applicable |
| Status | Review |
| Type | Feature |
| Complexity | Simple |
| Complexity Drivers | 既有已授权实例详情中的两次显式只读操作、局部请求代次与严格报告投影 |
| Created | 2026-11-05 23:51 Asia/Shanghai |
| Updated | 2026-11-05 23:51 Asia/Shanghai |
| Owner | Tianji Web |
| Repository | tianji-web |
| Scope | 当前 Process 实例和用户精确选择的目标发布的结构预检 |
| Change Surface | 新 TS GET/decoder、现有 ExecutionTimelinePage 和一条 CALLS |
| Affected Chapters | §7, §8, §10, §12, §14, §15, §16 |
| Source Requirement | [Master §19 T4-01/T4-04](../../../../docs/plans/agent-framework-upgrade-plan.md) 结构预检与版本运维观察 |
| Baseline Revision | Web bc926e477ddcd2fca20c00d33ba8346c0601d108；PS producer 410874c58d88b766e27706d80e639ebf2d734f4d |
| Amends | None |
| Supersedes | None |
| Depends On | [Process B1 producer §9](../../../../tianji-service/docs/egon/spec/2026-11-05-23-44-process-migration-preflight-api.md#9-interface-definitions) |
| Related Specs | [Process correlation console](2026-11-05-21-19-process-correlation-console.md), [Release metadata comparison](2026-11-05-20-02-process-release-comparison.md) |
| Related Plans | [Web preflight plan](../plan/2026-11-05-23-52-process-migration-preflight-console.md) |

## 1. Summary

在已有流程关联查询的当前已授权实例详情下增加“单实例迁移预检”。当前身份同时可访问既有发布元数据页时，用户先主动读取目标发布的精确摘要，再主动运行单实例预检。页面展示结构状态和观察时点，不提供执行迁移、激活或回滚动作。

## 2. Background and Current State

| Evidence ID | Exact source | Observed fact |
| --- | --- | --- |
| EVD-001 | [ExecutionTimelinePage](/Users/mario/SelfProject/Stellar-Enclosure/tianji-web/src/pages/ExecutionTimelinePage.tsx) | 现有关联页用 current PAGE、owner/epoch 和已验证详情区分当前实例，本地 outcome 和 Agent 视图独立。 |
| EVD-002 | [processReleasesApi](/Users/mario/SelfProject/Stellar-Enclosure/tianji-web/src/api/processReleases.ts) | Existing read validates exact version, immutable manifest SHA and bounded response under current tenant. |
| EVD-003 | [Client](/Users/mario/SelfProject/Stellar-Enclosure/tianji-web/src/api/client.ts) | Existing credentialed requestJson, tenant assertion, auth invalidation and no-store conventions. |
| EVD-004 | [Producer Spec §9](../../../../tianji-service/docs/egon/spec/2026-11-05-23-44-process-migration-preflight-api.md#9-interface-definitions) | PS dedicated protected exact GET, existing dual read codes/scopes, full same actor and default-off. |

### 2.5 Archetype example cleanup

Cleanup disposition: Not applicable

Reason: Existing React page, source adapter and permission references, with no archetype generation or example modules.

## 3. Goals and Non-goals

Provide a read-only structural report for one current authorized instance and one exact target. Existing detail/list/release API behavior, navigation and independent observations remain. Runtime migration actions, A3, bulk and new permissions remain separate.

### 3.3 Change Surface and Design Depth

| Area/layer | Disposition | Exact repository evidence | Changed or preserved behavior/contract | Required Spec treatment | Chapter(s) |
| --- | --- | --- | --- | --- | --- |
| Existing page, local TS decoder and PaC reference | Affected | EVD-001–004 | Explicit two reads, closed result and one CALLS | UI and request ownership, exact source files | §7, §8, §10, §12, §14, §15, §16 |
| Process and release API | Context-only | EVD-002/004 | Existing exact PS GETs and authority | Consumer scope only | §9 |
| Server, persistence and runtime | Not applicable | EVD-004 | Separate owner | No changes | §11 |

## 4. Requirements and Acceptance Criteria

| ID | Requirement | Priority | Observable acceptance | Source |
| --- | --- | --- | --- | --- |
| REQ-001 | 当前实例和两个现有页面授权 | Must | 仅当前成功详情且允许两 PAGE 时显示预检入口，旧列表/detail 保持 | EVD-001/002 |
| REQ-002 | 两次显式精确读取 | Must | 用户输入目标并单独读取摘要，展示 pin，随后第二按钮才请求 exact preflight | EVD-002/004 |
| REQ-003 | 闭合报告、局部代次与安全边界 | Must | 验证 instance/source/target、状态和 UTC，旧选择/授权/输入的迟到结果丢弃；仅结构结果 | EVD-001/003/004 |
| REQ-004 | 单条 CALLS 与实际制品证据 | Must | Existing references/permissions/nav preserved; one exact preflight CALLS and actual producer pin | EVD-004 |

### 4.2 Use-case analysis

#### 4.2.1 Actor inventory

| Actor ID | Actor | Goal | Permission/context |
| --- | --- | --- | --- |
| ACTOR-001 | 当前登录流程操作人员 | 对已读取实例做结构观察 | Existing Process correlation and release PAGE, separate actual PS checks |

#### 4.2.2 Use-case artifact

| ID | Use case/goal | Primary actor | Supporting actors/systems | Trigger | Preconditions | Main success outcome | Alternatives/failures | Postconditions | Requirements | Interfaces/pages | Tests |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| UC-001 | 查看一个实例和目标版本结构证据 | ACTOR-001 | Process B1 and release GET | 两次显式用户读取 | exact selected detail and both current PAGE | Current structural report and pinned digest | Gate denied, mismatch, invalid response, stale/cancel | Read-only and separate existing views | REQ-001–004 | Existing Process correlation page | TEST-001–004 |

## 5. Constraints, Assumptions, and Decisions

Use existing tianji.page.processCorrelations and tianji.page.processReleases. PS makes live resource, both permissions/scopes and exact owner decisions independently. Existing authorized Process detail and target release reads cannot be inferred from correlation strings. Web never selects actor or enables producer; no new menu/page/resource definition.

## 6. Project Technology Context

Existing React/AntD, Vitest, TypeScript, requestJson/BFF and permission-manifest producer. No dependencies, client transport, server or configuration change.

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
| TIME-001 | observedAt | Occurred instant | TypeScript string | Not persisted | UTC Z | Explicit UTC instant | UTC label and original string | Calendar validation, no local time conversion | Producer microseconds and raw UTC display | Existing timestamps and source clocks independent | TEST-001/002 |

## 7. Architecture Design

### 7.0 Minimum-design baseline and element-necessity audit

| Proposed element | Change | Requirements | Existing/direct alternative | Concrete inadequacy of alternative | Added calls/state/coupling/failures/migration/operations | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| PS preflight adapter | Add | REQ-002/003 | Existing release reader | Cannot evaluate exact current structure | One explicit GET, no stored state | Add |
| Existing selected details | Expand | REQ-001/003 | New route/global store | Existing exact selection and current epoch already fit | Local child and abort control only | Keep |
| Existing release adapter and PaC | Reuse | REQ-002/004 | Accept caller typed digest | Exact existing authorized metadata required | One explicit read, one CALLS | Keep |

| Path | Network calls | Client states | Server contracts/state | Failure and TOCTOU points | Additional user/business value |
| --- | --- | --- | --- | --- | --- |
| Current details | Existing | Existing | Process detail and release GET | No structure proof | Current metadata |
| Selected optional panel | One GET per user action | Local pin and report only | Existing release + B1 | Scoped target and epoch reset | Structural observation |

### 7.1 System Architecture Design

Existing ExecutionTimelinePage authorized snapshot → ProcessMigrationPreflightLookup → existing processReleasesApi and new processMigrationPreflightApi → shared requestJson → existing PS reads.

### 7.2 High-Level Design

An explicit target metadata read captures instanceId, current sourceReleaseVersion, returned exact targetReleaseVersion and manifest SHA. The second action uses that immutable value. Changing target or selection removes the pin and report. Pending request is aborted on cleanup or edit and its result cannot update stale scope.

### 7.3 Detailed Design

processMigrationPreflightApi.get validates captured current instance, source/target release names and lowercase hash. Sends no-store GET and only encoded instance path plus targetReleaseVersion and expectedTargetManifestSha256. Existing authenticated tenant handling remains. Return exactly six keys and require exact instance/source/target affinity. Eight existing statuses, authored activity ID only in the two native result branches and otherwise null, validate existing strict UTC text and preserve original value. For status/auth error use existing safe transport and fixed local feedback, no raw response data.

The child uses current selected detail generation and current PAGE checks. Parent remounts on owner/issuer/tenant/requestEpoch and child unmount/reselection. Edit, explicit refresh or stale completion clears/ignores old evidence. A 401/403 or tenant mismatch uses the existing shared invalidation flow.

## 8. Package Structure and Code File Tree

| Operation | Exact path |
| --- | --- |
| Create | `src/api/processMigrationPreflight.test.ts` |
| Modify | `src/pages/ExecutionTimelinePage.test.tsx` |
| Create | `src/api/processMigrationPreflight.ts` |
| Modify | `src/pages/ExecutionTimelinePage.tsx` |
| Modify | `src/permissions/references.ts` |
| Create | `docs/egon/spec/2026-11-05-23-51-process-migration-preflight-console.md` |
| Create | `docs/egon/plan/2026-11-05-23-52-process-migration-preflight-console.md` |
| Create | `docs/egon/evidence/2026-11-05-process-migration-preflight-console.md` |

## 9. Interface Definitions

Context-only. Actual producer `getOwnedProcessMigrationPreflight` exact GET `/api/tianji/v1/process-instances/{instanceId}/migration-preflight`. PS requires dedicated `tianji.api.process.migration.preflight`, existing both Process READ and release READ codes and scopes, verified same actor and exact START, plus flags. Client consumes GET only. Existing release GET remains separately authorized. Backend source and flags are unchanged in this Web Step.

## 10. POJO and Data Model Design

Immutable ProcessMigrationTarget captures instanceId, sourceReleaseVersion, targetReleaseVersion and expectedTargetManifestSha256. ProcessMigrationPreflight captures exact instanceId, sourceReleaseVersion, targetReleaseVersion, status, activityId nullable and observedAt UTC string. Distinguish NATIVE_STRUCTURE_VALIDATED_ONLY, INSTANCE_NOT_LIVE, TARGET_UNAVAILABLE, TARGET_PIN_MISMATCH, RELEASE_PAIR_UNSUPPORTED, SHAPE_UNSUPPORTED, ACTIVE_EVIDENCE_UNSAFE and NATIVE_REJECTED. No internal IDs, request/engine data or execution state.

## 11. Database Design

N/A. Existing PS current structural read owns persisted data.

## 12. Frontend Page Design

Existing /operations/process-correlations, only after selected detail and both PAGE checks. Card title 单实例迁移预检, label 预检目标发布版本, first action 读取目标发布摘要, second 运行迁移预检 after pin. Show target SHA-256, structure status wording, source and target versions, optional authored activity and raw UTC observation. No automatic fetch. One pending request at a time. Invalid target, release read failure and report failure have fixed safe messages. Existing list, Process detail, Agent outcomes and independent Agent read remain. There is no migration/activate/rollback control.

## 13. Design Patterns and Architecture Principles

Use existing local request scope and optional child. No new global store, route or shared authorization implementation.

## 14. Test Design

| Test | Scope |
| --- | --- |
| TEST-001 | exact encoded GET and tenant/abort, both query parameters, strict shape/affinity/status/UTC |
| TEST-002 | both existing page gates, exact selected detail, independent explicit reads and visible digest/report, abort and no stale target |
| TEST-003 | actual static +1 CALLS only and exact producer proof |
| TEST-004 | existing release and correlation detail regressions, typecheck/lint |

## 15. Non-functional and Cross-cutting Design

Only one request per action and one pending per current detail. No persisted state, raw diagnostic logs, dynamic role, retry scheduler or extra client configuration.

## 16. Compatibility, Migration, Rollout, and Rollback

Existing PAGE, menu, permissions, request auth and release/detail methods preserved. Source adds one reference and local consumer only. Actual backend default-off, IAM, BFF and browser acceptance remain separately authorized. Revert a single Web commit.

## 17. Alternatives and Decisions

A separate page or arbitrary caller digest would duplicate selection and authority. Reuse current exact detail and target metadata, and explicitly require second user confirmation for the GET.

## 18. Risks and Open Questions

Backend producer lock is required before owning Web source. Structural status is scoped to its observed instant, with no guarantee of later native state or migration execution. No live request or Browser evidence from jsdom.

## 19. Traceability Matrix

| Requirement | Use case | Design | Tests |
| --- | --- | --- | --- |
| REQ-001 | UC-001 | §7/12 | TEST-002/004 |
| REQ-002 | UC-001 | §7/10/12 | TEST-001/002 |
| REQ-003 | UC-001 | §7/10/12 | TEST-001/002/004 |
| REQ-004 | UC-001 | §8/14/16 | TEST-003 |

## 20. Review and Acceptance

### 20.5 Blocking Manual Check

| Check ID | Applicability | Status | Evidence | Finding | Required action/exception |
| --- | --- | --- | --- | --- | --- |
| MC-ARCH-001 | Applicable | PASS | §7/8/14 | Current Process page and exact owner consumer | None |
| MC-REUSE-001 | Applicable | PASS | §7/8/14 | Existing layout, requestJson, authority | None |
| MC-DEP-001 | Applicable | PASS | §7/8/14 | No dependency change | None |
| MC-NAME-001 | Applicable | PASS | §7/8/14 | Exact local API and page names | None |
| MC-VALID-001 | Applicable | PASS | §7/8/14 | Exact instance/source/target, pin, closed status and UTC | None |
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
