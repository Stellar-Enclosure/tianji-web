# T4-04E 流程关联查询台

| Field | Value |
| --- | --- |
| Document | 2026-11-05-21-19-process-correlation-console.md |
| Template Version | 9 |
| Archetype Cleanup | Not applicable |
| Status | Review |
| Type | Feature |
| Complexity | Simple |
| Complexity Drivers | 一个当前身份只读页面，两个已提交 GET，沿用现有授权 |
| Created | 2026-11-05 21:19 Asia/Shanghai |
| Updated | 2026-11-05 21:19 Asia/Shanghai |
| Owner | Tianji Web |
| Repository | tianji-web |
| Scope | 现有控制台用户的 Process owner 关联回执和明确选择的实例详情 |
| Change Surface | Web 路由、PAGE/MENU、两条现有 API 引用、严格浏览器 decoder、有限测试 |
| Affected Chapters | §7, §8, §10, §12, §14, §15, §16 |
| Source Requirement | Master §19 T4-04 流程关联可观察性与 §19 T4-02 持久关联查询 |
| Baseline Revision | Web 0957379aade655d2d14d6064504d3426d3e6576f；PS producer 1b5700ae9ba409c948c4d1a261d7b002de2b4381；Service audit HEAD 8de3e76184d4812ed2b1bac982b7c6889e4c49c0 |
| Amends | None |
| Supersedes | None |
| Depends On | [PS owner correlation §9](../../../../tianji-service/docs/egon/spec/2026-11-05-20-36-owned-process-correlation-lookup.md#9-interface-definitions) |
| Related Specs | None |
| Related Plans | [Master §19 T4-04](../../../../docs/plans/agent-framework-upgrade-plan.md) |

## 1. Summary

当前控制台身份以精确关联标识和显式 UTC 半开窗口查询自己的已应用 START 回执。每页最多 20 条，手动翻页或选择当前页的一条回执读既有详情。回执与详情分别标明来源，不推断失败、跨 owner 关联或完整历史。

## 2. Background and Current State

| Evidence | Exact authority | Consequence |
| --- | --- | --- |
| EVD-001 | PS producer 1b5700a Boot SHA 962bfd793883597f09736aa4d773829c014d2430acab7731acc6d3ff8fe1891f；raw PaC SHA 7dff4a536948c260304fb92552391acf6cc1b74d658bea3e88f137f1ec62ce90；OAS SHA 80bd174998a1dd6b3188bbd3931447c4e7eb79e055bb5046cd3a35e87f090b0a | 已有确切关联及详情 GET，两者 PaC 都是 USER/SERVICE、PROCESS_READ 和 tianji:process:read |
| EVD-002 | App.tsx/permissions/resources.ts/AuthContext.tsx | 既有 APP ANY、landing、RequireResource 和 issuer/tenant/subject/requestEpoch |
| EVD-003 | WorkerFailuresPage、DefinitionReleasePage | 现有手动有界查询和 abort 模式。Worker 额外需要 RECOVER，不能承载单 READ 的新流程 |
| EVD-004 | C ProcessInstanceDTO/StatusEnum、PS ProcessController#instance | 已有实例详情，无 Web 通用详情路由，当前页仅按选择 inline |
| EVD-005 | src/api/client.ts 和现有无服务器 Vitest/PaC pipeline | 共享 Cookie GET、tenant 断言和 auth invalidation，实际静态产物可检验 |

### 2.5 Archetype example cleanup

Cleanup disposition: Not applicable
Reason: 现有 Web 应用增加一个小只读页，无新 archetype 或示例替换。

## 3. Goals and Non-goals

交付同 owner 的关联定位和按需实例快照。保留旧 Worker、发布、APP/landing 和 API。无新增权限定义、role grant、请求头、backend、业务动作、排队、查询聚合、真实浏览器或 S12 验收。

### 3.3 Change Surface and Design Depth

| Area/layer | Disposition | Exact repository evidence | Exact delta or preserved invariant | Required Spec treatment | Chapters |
| --- | --- | --- | --- | --- | --- |
| Web API, screen, route and PaC | Affected | EVD-002/003/005 | one route, two GET consumers and exact new PAGE/MENU/references | full Web design | §7, §8, §10, §12, §14, §15, §16 |
| Service REST/C/OAS/PaC producer | Context-only | EVD-001/004 | same existing route and resource policy | current authority | §9 |
| Persistence and runtime | Unchanged | PS Spec and existing package | no schema/runtime changes | preserve | §11 |

## 4. Requirements and Acceptance Criteria

| ID | Requirement | Acceptance |
| --- | --- | --- |
| REQ-001 | 同现有控制台和精确 READ | PAGE/MENU 只需已有 PROCESS_READ；APP、landing、Worker 保持；两个 existing CALLS 引用 |
| REQ-002 | 闭合精确关联查询 | 手动 correlation+UTC 窗口、≤31d、两端微秒比较，闭合 ≤20 rows、opaque cursor、exact result |
| REQ-003 | 收据来源和独立详情 | 仅当前页显式选中项读既有 GET，验证 ID/关联/发布/提交时刻。显示真实快照和状态 |
| REQ-004 | 当前上下文和错误 | abort on edit/unmount/issuer/tenant/subject/epoch/resource，旧结果丢弃；空、分页失败、详情错误和 auth 区分 |
| REQ-005 | 有限与实际制品 | Vitest、typecheck、lint、实际静态 PaC 严格增量，真实 browser/BFF/IAM 独立 |

### 4.2 Use-case analysis

| ID | Actor | Evidence |
| --- | --- | --- |
| ACTOR-001 | 已获 APP 和现有 PROCESS_READ 的控制台身份 | EVD-001/002 |

| ID | Use case/goal | Actor | Trigger | Outcome | Alternative | Postcondition |
| --- | --- | --- | --- | --- | --- | --- |
| UC-001 | 发现当前身份自己的流程启动回执 | ACTOR-001 | explicit exact form | one bounded page, optional next | empty/unavailable/denied | cursor confined to current frame |
| UC-002 | 查看一个匹配实例快照 | ACTOR-001 | explicit selected visible row | current allowed snapshot | exact affinity invalid or not visible | receipt stays distinct |

## 5. Constraints, Assumptions, and Decisions

DEC-001 新页面保留当前 APP ANY 和默认落地页，不使仅 PROCESS_READ 的用户获得额外 APP 入口。DEC-002 固定文本 UTC 表单，无浏览器时区或本地未来时间推断。DEC-003 分页替换当前页，只传原 cursor，不解析、拼接、持久化。DEC-004 页面权限与 GET 服务权威分开，详情按独立原资源检查。没有 cross-owner inference。

## 6. Project Technology Context

现有 React、TypeScript、AntD、Web SDK requestJson、Vitest 和 PaC。复用 release/instance ID 校验和固定 browser cookie transport，无新增依赖。

### 6.2 User-mandated Java rule compliance

| Literal rule | Affected? | Repository evidence | Exact design decision | Files/types/interfaces | Validation/test evidence | Status/blocker |
| --- | --- | --- | --- | --- | --- | --- |
| Rule 1 | No | Web-only §8 | No Java or existing service contract change | Existing boundary | §14 gates | N/A |
| Rule 2 | No | Web-only §8 | No Java or existing service contract change | Existing boundary | §14 gates | N/A |
| Rule 3 | No | Web-only §8 | No Java or existing service contract change | Existing boundary | §14 gates | N/A |
| Rule 4 | No | Web-only §8 | No Java or existing service contract change | Existing boundary | §14 gates | N/A |
| Rule 5 | No | Web-only §8 | No Java or existing service contract change | Existing boundary | §14 gates | N/A |
| Rule 6 | No | Web-only §8 | No Java or existing service contract change | Existing boundary | §14 gates | N/A |
| Rule 7 | No | Web-only §8 | No Java or existing service contract change | Existing boundary | §14 gates | N/A |
| Rule 9 | No | Web-only §8 | No Java or existing service contract change | Existing boundary | §14 gates | N/A |
| Rule 10 | No | Web-only §8 | No Java or existing service contract change | Existing boundary | §14 gates | N/A |
| Rule 11 | No | Web-only §8 | No Java or existing service contract change | Existing boundary | §14 gates | N/A |

### 6.3 Time semantics and conversion contract

Time contract: Required

| Time ID | Fields/symbols | Semantics | Java/runtime type | Storage policy | Wire policy | Business zone source | Display zone source | Boundary / DST rules | Precision / Clock | Compatibility | Verification |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| TIME-001 | fromInclusive and toExclusive | Occurred instant | TS string and bigint micros | Not persisted | UTC Z | Explicit UTC | UTC form labels | half-open and positive ≤31d, Gregorian no leap second or 24:00 | Up to 6 decimal digits, DB future check only | Equivalent fractional spellings allowed | TEST-001 and TEST-002 |
| TIME-002 | observedAt, submittedAt and finishedAt | Occurred instant | TS string and bigint micros | Not persisted | UTC Z | Existing PS UTC source | UTC time element | source text retained, no local calendar or status inference | microsecond order and detail affinity | nullable finishedAt by C status | TEST-001 and TEST-002 |

## 7. Architecture Design

### 7.0 Minimum-design baseline and element-necessity audit

| Proposed element | Change | Requirements | Direct alternative | Verdict |
| --- | --- | --- | --- | --- |
| ExecutionTimelinePage | Create | REQ-001/003/004 | Worker route also requires RECOVER | independent READ page |
| TS API pair | Create | REQ-002/003 | existing GET has no Web consumer | exact decoder and transport |
| Backend/APP changes | None | REQ-001/005 | existing producer and app boundary suffice | keep |

| Path | Network calls | Client states | Authority | Consequence |
| --- | --- | --- | --- | --- |
| Open page | zero | empty form | current APP/PAGE | no automatic read |
| Search or next | one GET each | one page | existing correlation API | finite receipt view |
| Chosen detail | one GET | inline independent snapshot | existing detail API | exact current facts |

### 7.1 System Architecture Design

SessionRoutes RequireResource → ExecutionTimelinePage → processCorrelationsApi → requestJson → existing PS GET. Current actor derives from AuthContext and verified request; page never supplies actor identity as a filter.

### 7.2 High-Level Design

Use existing layout, AntD Form/Table/Card and manual submission. Page body keyed by issuer/tenant/subject/requestEpoch, additionally guard current PAGE. One pending read owns current generation. List/detail supersession, edit, route change, permission and unmount cancel or discard stale replies.

### 7.3 Detailed Design

Use strict Gregorian yyyy-MM-ddTHH:mm:ss[.1..6]Z, year 0001–9999, no offsets, leap seconds or 24:00. Compare exact microseconds using parsed whole seconds plus padded fractional BigInt. Require positive ≤31d and preserve raw input. DB remains authoritative for future upper bound. List decoder validates closed 4 keys, exact case-sensitive correlation, observation >= upper, rows 0–20, unique exact IDs, release syntax, submittedAt within half-open window and descending UTC/unsigned UTF-8 C tie. nextCursor is nullable, v1. Base64URL alphabet ≤1200, only if 20 rows, never repeats submitted cursor. Do not decode or infer membership from token.

Detail accepts only the closed ProcessInstanceDTO shape. Verify exact selected ID, correlation and release, submittedAt as equal UTC instant, definition and business syntax, and ACTIVE/SUSPENDED/COMPLETED/CANCELLED with the C finish nullability. All unrecognized/corrupt detail fields fail independently. Browser JSON decoder works on already parsed shared transport values and does not claim a raw-byte parser guarantee.

## 8. Package Structure and Code File Tree

| Operation | Exact path |
| --- | --- |
| Create | `src/api/processCorrelations.test.ts` |
| Create | `src/pages/ExecutionTimelinePage.test.tsx` |
| Modify | `src/App.test.tsx` |
| Create | `src/api/processCorrelations.ts` |
| Create | `src/pages/ExecutionTimelinePage.tsx` |
| Modify | `src/permissions/resources.ts` |
| Modify | `src/permissions/references.ts` |
| Modify | `src/permissions/messages.ts` |
| Modify | `src/App.tsx` |
| Create | `docs/egon/spec/2026-11-05-21-19-process-correlation-console.md` |
| Create | `docs/egon/plan/2026-11-05-21-20-process-correlation-console.md` |
| Create | `docs/egon/evidence/2026-11-05-process-correlation-console.md` |

## 9. Interface Definitions

Scope disposition Context-only. The committed PS resource tianji.api.process.instance.correlations maps GET and implicit HEAD /api/tianji/v1/process-instance-correlations. The existing tianji.api.process.instance.get maps GET and HEAD /api/tianji/v1/process-instances/{instanceId}. Both use existing TIANJI_PROCESS_READ, tianji:process:read and exact verified owner. This Web consumer uses GET with cookie credentials and current expected tenant only. No new service API, method, contract or scope. Exact PaC manifests are checked independently in static validation.

## 10. POJO and Data Model Design

ProcessCorrelationQuery contains exact correlationId, fromInclusive, toExclusive and optional cursor. ProcessCorrelationPage contains correlationId, observedAt, items and nextCursor. ProcessCorrelationReceipt is instanceId, releaseVersion, submittedAt. ProcessInstanceSnapshot is existing C instanceId, definitionKey, releaseVersion, businessKey, correlationId, status, submittedAt, finishedAt. All TS records are readonly, rendered as plain text.

## 11. Database Design

Existing PS reads immutable START receipt and native details under separate current owner checks. This Web slice does not access or modify storage.

## 12. Frontend Page Design

ExecutionTimelinePage at /operations/process-correlations. PAGE and MENU tianji.page.processCorrelations and tianji.menu.processCorrelations require existing PROCESS_READ under current APP. zh-CN 流程关联查询 and en-US Process correlation lookup. Form has 关联标识, 开始时间（UTC，含）, 结束时间（UTC，不含） and 查询关联. Starts empty, no URL or storage prefill. Query again begins first page. 下一页 consumes only current valid cursor. Receipt Card uses 来源：Process START 回执, exact correlation, observation UTC, submitted UTC and release/instance. Empty current page uses 当前时间窗无流程启动回执.

One 查看详情 button per current visible row is read-only within the same page. Distinct detail Card uses 来源：Process 实例快照 and actual instance/definition/release/business/status/submitted/finished fields. A malformed or foreign detail never replaces receipt evidence. Old page is cleared on new list/next and edit. Auth failures clear state through shared owner invalidation. Current UI shows fixed request and detail errors. No route, write, inference or total for Agent/Worker history.

## 13. Design Patterns and Architecture Principles

Reuse existing bounded read adapter and page-scoped request generation. No new shared library, store, generic history engine or authorization layer.

## 14. Test Design

| Test | Scope |
| --- | --- |
| TEST-001 | Exact paths/encoding/tenant/abort, Gregorian micros, immutable page and UTF-8 order/cap/cursor, two GET affinity and malformed inputs |
| TEST-002 | Explicit query/no auto, output/source labels, next/restart, selected detail, current owner/epoch/edit abort and late isolation |
| TEST-003 | Existing App/landing, direct route, menu, exact READ and manifests, existing Worker unaffected |
| TEST-004 | Node24 finite/type/lint and actual Web package verified PaC against committed PS producer |

## 15. Non-functional and Cross-cutting Design

At most 20 rows and one local pending read. No tokens, actor selectors, cursor persistence, raw response logging or added request cache. Auth and permission remain current. UTC source times remain exact.

## 16. Compatibility, Migration, Rollout, and Rollback

One Web commit. Existing APP/landing, permission definitions, APIs and runtime configuration preserved. Static manifest adds exactly PAGE/MENU, two labels and two CALLS references. Current deployed BFF/IAM/PS and browser are separate, and no grants/activation are part of this step.

## 17. Alternatives and Decisions

Worker console has RECOVER alongside READ and deliberately uses known IDs. Separate correlation page supports current READ without expanding APP or requiring RECOVER. Existing detail reuses independent authority and avoids a second route.

## 18. Risks and Open Questions

PS producer package is fixed; actual network/IAM/Browser acceptance remains pending. Text IDs may be valid C but refused by shared URL traversal protections or deployment routing, so detail remains safely unavailable. Receipt table is not complete event history or cross-owner S12.

## 19. Traceability Matrix

| Requirement | Use case | Test |
| --- | --- | --- |
| REQ-001 | UC-001/002 | TEST-003/004 |
| REQ-002 | UC-001 | TEST-001/002 |
| REQ-003 | UC-002 | TEST-001/002 |
| REQ-004 | UC-001/002 | TEST-002/003 |
| REQ-005 | UC-001/002 | TEST-004 |

## 20. Review and Acceptance

### 20.5 Blocking Manual Check

| Check ID | Applicability | Status | Evidence | Finding | Required action/exception |
| --- | --- | --- | --- | --- | --- |
| MC-ARCH-001 | Applicable | PASS | §7/8/14 | Current Web read adapter and PS contract | None |
| MC-REUSE-001 | Applicable | PASS | §7/8/14 | Shared requestJson, existing authority and layout | None |
| MC-DEP-001 | Applicable | PASS | §7/8/14 | No dependency change | None |
| MC-NAME-001 | Applicable | PASS | §7/8/14 | Exact consumer and timeline file names | None |
| MC-VALID-001 | Applicable | PASS | §7/8/14 | Closed response, bound cursor, exact context and row affinity | None |
| MC-MODEL-001 | Applicable | PASS | §7/8/14 | Readonly TypeScript mirrors | None |
| MC-CONVERT-001 | Not applicable | N/A | §7/8/14 | No Java mapping layer | None |
| MC-LOG-001 | Not applicable | N/A | §7/8/14 | No new logging or raw values | None |
| MC-BEAN-001 | Not applicable | N/A | §7/8/14 | No Java bean | None |
| MC-UTIL-001 | Applicable | PASS | §7/8/14 | Existing validator and browser primitives | None |
| MC-JSON-001 | Applicable | PASS | §7/8/14 | Closed parsed JSON only | None |
| MC-TIME-001 | Applicable | PASS | §7/8/14 | Exact UTC and microseconds | None |
| MC-CONFIG-001 | Not applicable | N/A | §7/8/14 | No profile/config changes | None |
| MC-PATTERN-001 | Applicable | PASS | §7/8/14 | Existing bounded page request composition | None |
| MC-SCOPE-001 | Applicable | PASS | §7/8/14 | One route, existing APP and two GET references | None |
| MC-TEST-001 | Applicable | PASS | §7/8/14 | Exact finite and static proof | None |
| MC-BLOCKER-001 | Applicable | PASS | §7/8/14 | Producer packaged, source review and runtime separate | None |

**PASS — Ready for user review**
