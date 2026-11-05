# 天机已知流程的 Worker 失败观察台

| Field | Value |
| --- | --- |
| Document | `2026-11-05-18-03-worker-failure-console.md` |
| Template Version | `9` |
| Archetype Cleanup | `Not applicable` |
| Status | `Review` |
| Type | `Feature` |
| Complexity | `Simple` |
| Complexity Drivers | `None` |
| Created | `2026-11-05 18:03 Asia/Shanghai` |
| Updated | `2026-11-05 18:11 Asia/Shanghai` |
| Owner | 天机平台决策人 |
| Repository | `tianji-web` |
| Scope | T4-04A，现有控制台用户查询已知 Process 实例的 Worker 失败快照 |
| Change Surface | 一个受保护的 Web 路由和菜单，一个已有 PS GET 的 TS 消费者，一个只读页面，四个现有 permission entrypoints 的必要增量及对应有限测试 |
| Affected Chapters | `§7, §8, §10, §12, §13, §14, §15, §16, §17, §18` |
| Source Requirement | [整体蓝图](../../../../docs/plans/agent-framework-upgrade-plan.md) `§19 T4-04` 的失败分类和当前可观察事实 |
| Baseline Revision | `tianji-web f558e02c8d07da2da758c5273a5eb531ca251018` clean。所消费既有 PS/C/CL 在 `tianji-service 17fee280792e95da938c68ba65a783b965ca63d8` |
| Amends | `None` |
| Supersedes | `None` |
| Depends On | [整体蓝图](../../../../docs/plans/agent-framework-upgrade-plan.md) `§19 T4-04`。[Worker 恢复](../../../../tianji-service/docs/egon/spec/2026-11-05-13-41-process-worker-recovery.md) `§7, §9 API-001, §10` |
| Related Specs | [任务箱、案件与审批 Web](2026-11-04-22-56-task-case-approval-web.md) `§6.3, §7, §12, §14` |
| Related Plans | `None` |

## 1. Summary

现有控制台用户可输入一个已知 Process 实例标识，查看 Process Server 当前提供的有界 Worker 失败快照。快照保留原生 deadletter、服务分类、报告结果与观察时间。页面醒目标记未知结果和证据缺失。显示范围取决于现有控制台入口、两项现有 Process 权限以及 PS 对该实例完整 START 所有者的校验。

本切片只接一个既有 GET。发布治理、Agent 恢复、用量查询、跨源 correlation、积压与恢复命令继续由各自所有者提供前置能力和验收证据。本文是仓库外的可审阅设计。

## 2. Background and Current State

### 2.1 Business and user context

持有 Process READ 与 Worker RECOVER 的天机操作员，目前可通过既有 PS 合同观察自己启动的实例。Web 壳已经可访问 Agent、Memory、任务、Case，但没有 Worker 失败视图。需要让用户先看清当前证据，再独立决定是否进入已批准的处理流程。这里的操作员是已验证且精确拥有实例的 USER。权限集合或“管理员”称呼本身不产生跨主体访问。

### 2.2 Repository evidence

本文中的 C、CL、PS、AS、AR 分别是 tianji-service 下 `stellar-enclosure-tianji-contract`、`stellar-enclosure-tianji-client`、`stellar-enclosure-tianji-process-server`、`stellar-enclosure-tianji-agent-server`、`stellar-enclosure-tianji-agent-runtime`。Java 符号取该模块当前 main package。

| Evidence ID | Classification | Exact source | Observed fact | Verification limit |
| --- | --- | --- | --- | --- |
| EVD-001 | Static repository | Web `src/App.tsx` `SessionRoutes,RequireResource,Shell` 与 `src/permissions/{permissions,resources,references,messages,registry}.ts` | 路由、菜单、APP 权限独立。APP ANY 当前为 Agent/Memory/Task/Case READ。Web 仅拥有 app/menu/page/button 前缀 | Web HEAD 源码 |
| EVD-002 | Static repository | Web `src/auth/AuthContext.tsx` `retry,allows`、`src/auth/gatewayAuth.ts`、`src/api/client.ts` `requestJson` | 同一 gateway alias 默认 `edge-tianji`，Cookie transport、issuer/tenant/subject/catalog/requestEpoch 绑定，409 tenant-change 使会话失效。tenant header 只断言 | 实际 route 和 IAM grant 未运行 |
| EVD-003 | Static repository | C `ProcessWorkerRecoveryClient,GetProcessInstanceQuery,ProcessWorkerFailuresDTO,ProcessWorkerFailureDTO`。CL `ProcessWorkerRecoveryResponseCodec,HttpProcessClient#workerFailures`、`META-INF/tianji/openapi/process-worker-recovery-v1.json` | 有 exact instance GET、128 条完整上限、UTF-8 byte sort、闭合状态、canonical Instant、exact error envelope。C 与 CL 是 wire 权威 | 不代表浏览器可达 |
| EVD-004 | Static repository | PS `api/ProcessWorkerRecoveryController#failures,recover`、`security/TianjiProcessPermissions`、`security/TianjiProcessAccess#require`、`execution/ProcessWorkerRecoveryService#workerFailures` | GET 与 POST 都需要 READ + WORKER_RECOVER。访问先经 IAM，再以当前 actor 验证 START receipt。GET、POST 共享三个启用开关 | 没有只读专属 permission。默认关闭。现有 source-only 证据 |
| EVD-005 | Existing finite evidence | PS [Worker recovery provider](../../../../tianji-service/docs/egon/evidence/2026-11-05-worker-recovery-provider.md) | 255 项有限测试、真实可执行 JAR 内资源及 manifest，支持 GET resource key。记录 recovery=false | S10/S11、真实 IAM/gateway/DB/Flowable 独立 |
| EVD-006 | Static repository | Web `src/pages/CaseDetailPage.tsx`、`src/api/cases.ts`、`src/App.test.tsx` | 已知 ID 查询、闭合解析、UTC 显示、切换身份/路由后 AbortController 和 request sequence | 复用交互与测试方式 |
| EVD-007 | Static repository and reviewed predecessor | AS `AgentModelUsageDiagnostics#byRun,byCorrelation` 的 package-private private adapter。AR T4-03 `AgentLedgerService#inspectRecovery` 已交付的 owner-only 技术查询。PS `PlatformReleaseArtifactCli` 和 `ProcessController#release` | Agent 用量和恢复缺 HTTP。candidate CLI 是离线文件验证。Process 已有单版本 GET，只代表其 release 表示。无跨 AS/PS/Tool correlation 目录、live bundle 激活治理 | 各能力须独立取证。T4-03 源码已提交，真实快照与 E/S11 独立，且它不作为本切片依赖 |
| EVD-008 | Static repository | Web `package.json`、`permission-manifest.config.json`、`scripts/build.mjs`、`permission-toolchain.local.lock.json` | 已有 Vitest/jsdom、Node 24 与专门 PAC build。Jianshen contract artifact 锁独立于 PS resource manifest。当前 SDK 对 checked-in lock 的 verifyToolchain 已在 Node 24.14.1 离线通过 | 本次不执行构建、注册或发布 |

### 2.3 Problem statement and gap

当前 Web 路由不会发起 Worker 失败查询，无法呈现已经存在的闭合状态、已报告副作用和源不可用区别。已有 GET 刚好满足已知实例的观察目标。当前不存在可给任意权限组合用户使用的跨实例失败队列，也没有仅凭 `correlationId` 找到 Process 实例的授权索引。页面仅对这个明确输入的实例负责。

### 2.4 Evidence and current-chain map

| Trigger | Current chain | Data | Consumer and boundary |
| --- | --- | --- | --- |
| 用户进入已授权 Web | `AuthProvider → gateway identity/effective-permissions → resourceRegistry → SessionRoutes/Shell` | 认证与权限仅在现有请求上下文。路由 guard | EVD-001/002，继续沿用 |
| 已知实例失败查询 | `PS ProcessWorkerRecoveryController.failures → TianjiProcessAccess.require → ProcessWorkerRecoveryService.workerFailures → exact START + Process native/Worker evidence` | 同一 Process 所有者的快照，固定上限，无业务写入 | EVD-003/004，新增一位 Web 消费者 |
| Agent 和发布内部技术事实 | `AS diagnostics → AR model usage`、AR disposition。PS offline CLI | owner-local read 或离线文件 | EVD-007，不共享当前 Web 合同 |

### 2.5 Archetype example cleanup

Cleanup disposition: Not applicable

Reason: `tianji-web/package.json` 和实际 `src/App.tsx` 是现有 React console，runs、Memory、Task、Case 均为业务路径。本次仅现有 Web frontend，未生成 Maven archetype 或新增 Java business project。

## 3. Goals and Non-goals

### 3.1 Goals

提供一个用户发起的只读 Worker 失败页。用户输入准确实例 ID，读取当前所有者快照，看到事实、未知和不可用区别，并能按需重新查询同一或另一已知实例。

### 3.2 Non-goals

首切片不涉及恢复、取消、重放、激活、回滚、修复数据、跨所有者检索、前端缓存/导出、批量失败列表、correlation 聚合、费用和发布目录。沿用现有服务开关、IAM 授权、gateway 路由、CSRF/token 策略和构建工具。真实部署、权限注册/激活/授予、PostgreSQL/Flowable、S10/S11、T3-12 E 及浏览器由独立验收控制。

### 3.3 Change Surface and Design Depth

| Area/layer | Disposition | Exact repository evidence | Delta or invariant | Treatment | Chapter(s) |
| --- | --- | --- | --- | --- | --- |
| Web consumer, app route, local state and PAC references | Affected | EVD-001/002/003/006/008 | 单 GET、已知 ID、只读快照、页面和菜单的双权限、同一会话丢弃旧状态 | exact paths, TS shape, screen, proof and deployment limits | §7, §8, §10, §12, §13, §14, §15, §16, §17, §18 |
| PS/C/CL and deployed gateway transport | Context-only | EVD-002/003/004/005 | route/method/wire/permission/owner 开关保持 | existing authority and consumer boundary | §9 |
| AS/AR, release/usage/Agent APIs and databases | Unchanged | EVD-007。当前所有权 | 仅记录后续依赖和不能混合的源 | concise context | §11 |
| Java scaffolding | Not applicable | EVD-008。§8 无 Java | 无新增模块、类或业务 Bean | evidence-backed absence | §8 |

## 4. Requirements and Acceptance Criteria

| ID | Atomic requirement | Priority | Observable acceptance | Source |
| --- | --- | --- | --- | --- |
| REQ-001 | 现有控制台用户凭双权限访问专用入口 | Must | 两项 PS 权限均具备且现有 APP 入口已通过才显示菜单并准入页面。任何单项、失效、错误 tenant/issuer 都不会调用 GET | T4-04。EVD-001/002/004 |
| REQ-002 | 按 exact known instance 获取单一快照 | Must | 有效 ID 只发既有 GET。当前 verified tenant header 与 AbortSignal。结果 instanceId 精确匹配。严格解析上限和闭合枚举 | T4-04。EVD-003 |
| REQ-003 | 显示快照事实、真实空集、未知和不可用 | Must | UTC 时间、job/activity、native、状态/原因、已报告结果。UNKNOWN 显式且独立。404 或错误与真实 200 空列表分开。无任何恢复写入口 | T4-04。EVD-003/005 |
| REQ-004 | 过期请求/身份切换保护 | Must | 新查询先清快照，旧请求被 abort/失序丢弃。切路由、issuer、tenant、subject、epoch、当前 read resource 后丢弃快照和 form。401/403/tenant conflict 保留原会话边界 | EVD-002/006 |
| REQ-005 | 证明 Web 增量及其与运行验收的边界 | Must | 合同、组件、route 权限及静态 PAC 产物。唯一新增 API CALLS 为 GET key。PS/C/CL、旧页面和 scope 均无行为扩展。无新 IAM grant、浏览器或服务启动 | T4-04。EVD-005/008 |

### 4.1 Scenario matrix

| Scenario | Trigger/precondition | Result | Postcondition | Requirements |
| --- | --- | --- | --- | --- |
| S-A owner with allowed record | valid exact ID, existing console+both permissions | PS 200 closed snapshot | row evidence shown, only UI state changed | REQ-001/002/003 |
| S-B no rows | exact PS 200 with empty failures | clear observed empty text + observedAt | no claim about historical or external effects | REQ-002/003 |
| S-C foreign or disabled | PS/gateway 404, or missing page permission | same fixed unavailable copy for authorized query; no GET when local gate fails | no old data or existence inference | REQ-001/003/004 |
| S-D unknown or contradiction | known enum, UNKNOWN reported result | preserves server classification and explicit unknown | zero retry/restore writes | REQ-003 |
| S-E stale or malformed | route/identity change, transport error, mismatched result | abort or safe error, no previous or foreign row | manual fresh GET permitted only under current grant | REQ-002/004 |

### 4.2 Use-case analysis

| Actor ID | Actor/role | Goal and responsibility | Entry/channel | Permission/tenant context | Evidence |
| --- | --- | --- | --- | --- | --- |
| ACTOR-001 | Existing console USER and exact Process START owner | Understand failed Worker evidence for a known instance | protected page and exact ID form | existing APP + current READ and RECOVER + exact ownership | EVD-001/004 |
| ACTOR-002 | Existing gateway/IAM and PS | Verify current user, grants and ownership, supply bounded observation | existing effective permissions and PS GET | verified USER/issuer/tenant/subject | EVD-002/004 |

| ID | Use case/goal | Primary actor | Supporting actors/systems | Trigger | Preconditions | Main success outcome | Alternatives/failures | Postconditions | Requirements | Interfaces/pages | Tests |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| UC-001 | 观察某已知流程的失败事实 | ACTOR-001 | ACTOR-002 | 手工提交 exact ID | 现有控制台与双权限 | 显示有界当时快照 | 错 ID、无可见实例、服务不可用、空结果均分别呈现 | 不产生业务写入 | REQ-001/002/003 | WorkerFailuresPage / existing GET | TEST-001/002/003 |
| UC-002 | 更换查询或身份后仍只看当前事实 | ACTOR-001 | ACTOR-002 | 发出下一次查询、路由退出或会话变更 | 已存在当前或 pending observation | 当前身份/请求结果才可呈现 | 旧答复取消或丢弃，鉴权异常沿用现有会话流程 | 不保留前一身份的快照 | REQ-004/005 | same route / AuthContext | TEST-004/005 |

## 5. Constraints, Assumptions, and Decisions

| ID | Decision or assumption | Source and impact |
| --- | --- | --- |
| DEC-001 | Web-only, existing console users plus exact GET READ+WORKER_RECOVER | EVD-001/004。前端 READ 界面并未变更 PS 授权含义。独立 read-only IAM audience 需要新的已批准后端权限设计 |
| DEC-002 | Existing lookup rather than list, with a local transient single result | EVD-003。当前没有稳定的 owner-visible cross-instance query，增加目录会改变数据访问权限与容量 |
| DEC-003 | Existing provider feature and scope remain independently operated | EVD-004/005。现有三开关也控制 POST。本切片不通过打开恢复开关来上线只读页 |
| ASM-001 | 当前边界的后续运行环境可显式核对已有 BFF PS GET 路由和当前 USER grant | EVD-002/005 只证明客户端结构和 PS 制品。环境缺路由或 flag off 时页面保持安全不可用。此假设不能用于新增 gateway 规则或授予权限 |

## 6. Project Technology Context

现有 React 19、TypeScript 6、Ant Design、React Router、Vite/Vitest、Testing Library 和 pinned web-shared/Jianshen SDK。以 `package-lock.json` 为精确工具链。客户端同源通过既有请求适配器，无需引入网络库、缓存、序列化库或权限 SDK。

### 6.1 Java architecture profile and capability baseline

现有 Web `src/api`、`src/pages`、`src/App.tsx`、`src/auth`、`src/permissions` 结构继续使用。Java PS/AS/AR 在本切片仅是当前合同/未来依赖的证据，既有 Java 技术层无目标文件。已有 requestJson/Route/AntD/registry 满足能力，缺口仅是此 GET 的受控消费。

### 6.2 User-mandated Java rule compliance

| Literal rule | Affected? | Repository evidence | Exact design decision | Files/types/interfaces | Validation/test evidence | Status/blocker |
| --- | --- | --- | --- | --- | --- | --- |
| Rule 1 | No | §8 TS/Web paths | Java naming not changed | readonly TS mirrors | inventory | N/A |
| Rule 2 | No | C/PS validation existing | Java annotations unchanged; browser validates input and response | §10 | TEST-001 | N/A |
| Rule 3 | No | current C records | Java model and converters unchanged | TS mirrors only | inventory | N/A |
| Rule 4 | No | no Spring Bean scope | no new Java DI/logger | none | inventory | N/A |
| Rule 5 | No | browser TextEncoder and built-ins | no Java utility or dependency | API TS | package diff | N/A |
| Rule 6 | No | EVD-003 | Java wire preserved; TS parsed value checked | §9/10 | TEST-001 | N/A |
| Rule 7 | No | EVD-004 | existing profile flags and frontend env unchanged | none | diff | N/A |
| Rule 9 | No | one read-only owner request, page-local lifecycle | direct state and existing adapter, no new abstraction | §13 | TEST-003/004 | N/A |
| Rule 10 | No | C Instant unchanged | Web displays original immutable timestamp with explicit UTC | TIME-001 | TEST-003 | N/A |
| Rule 11 | Yes | EVD-001/002/003 | preserve Web ownership and Java boundary, reuse existing SDK; no DB/Event layer | §8/9/11 | TEST-005 | PASS |

### 6.3 Time semantics and conversion contract

Time contract: Required

| Time ID | Fields/symbols | Semantics | Java/runtime type | Storage policy | Wire policy | Business zone source | Display zone source | Boundary / DST rules | Precision / Clock | Compatibility | Verification |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| TIME-001 | `ProcessWorkerFailuresDTO.observedAt` | Occurred instant | C Instant; TS readonly string | Not persisted | UTC Z | Not applicable: no business calendar | explicit UTC in visible text and `time dateTime` | exact source UTC timestamp; no local-time input, comparisons, DST or expiry calculation | preserve canonical original seconds/fraction string; no browser clock substitute | native DB observation and serialization unchanged; formatting never supplies a command version | TEST-001/003: UTC, invalid calendar/time, preserved fraction |

## 7. Architecture Design

### 7.0 Minimum-design baseline and element-necessity audit

| Proposed element | Change | Requirements | Existing/direct alternative | Concrete inadequacy of alternative | Added calls/state/coupling/failures/migration/operations | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| Auth/requestJson/layout/registry | Existing | REQ-001/004 | direct reuse | none | same request and authority | Keep |
| WorkerFailuresPage + route/menu | New | REQ-001/003 | existing Case page | Case starts from a separate ID and permission | one local form/snapshot, no added round trip | Add |
| Typed consumer and closed decoder | New | REQ-002/003 | unchecked requestJson type assertion | untrusted JSON and instance affinity need validation | one GET, fixed decoder error, no server state | Add |
| Two existing permission code refs, page/menu, GET CALLS and labels | Expand | REQ-001/005 | use Agent/Case permission as proxy | absent exact PS grants and API ownership in browser build | two code refs and one cross-manifest reference, no IAM policy registration | Add |
| Existing PS GET and C/CL/OAS | Existing | REQ-002/003 | direct reuse | none | same provider and bounded observation | Keep |
| Cache, state framework, discovery and action components | Exclude | REQ-002/005 | local single bounded query | no independent use case or second caller | no added dependency or persistence | Remove |

| Path | Network calls | Client states | Server contracts/state | Failure and TOCTOU points | Additional user/business value |
| --- | --- | --- | --- | --- | --- |
| Direct existing GET baseline | one GET per explicit lookup | local input and response | existing exact owner observation | new result can be stale or foreign if blindly rendered | existing PS provides facts |
| Selected typed consumer | same single GET | current frame and sequence, validated snapshot or fixed failure | same provider, no writes | current authorization and exact instance match, local abort and sequence | current eligible console user can see safe read-only observations |

### 7.1 System Architecture Design

`WorkerFailuresPage → processWorkerFailuresApi.get → requestJson → current gateway alias → PS Worker GET`. Auth and resource evaluation reuse current IAM context and client. PS still derives tenant/issuer/subject from verified identity, applies both guards and exact START owner before native evidence. The response belongs to one Process source, independent from Agent and release stores.

### 7.2 High-Level Design

One screen, one optional selected instance, one pending request and one validated result. The form requires a deliberate submit. It neither auto-loads on mount nor adds an instance identifier to the browser URL, history or external storage. A repeat submit is a new current observation. The transport carries only the GET path and existing trusted tenant assertion. Existing failures are never replaced by a fetch of some alternate system.

### 7.3 Detailed Design

Guard the App route with existing `RequireResource`, then key page content by exact verified issuer/tenant/subject/requestEpoch. Menu entry tests menu resource, page and fetch test page resource. Validate the ID in the form and API method. Start a new request sequence, abort the earlier signal and clear result/error, then GET. Set result only if sequence, signal and current page resource still match. On rejection use fixed page state. Cleanup aborts and advances sequence, removing mounted results. Current AuthContext subscription handles session invalidation; a late response has no authority to restore old state.

## 8. Package Structure and Code File Tree

All paths relative to `tianji-web/`. This is proposed implementation scope, excluding future Plan/evidence documents.

| Operation | Exact path | Symbols and responsibility |
| --- | --- | --- |
| Modify | `src/App.tsx` | `SessionRoutes` add protected route, `Shell` add conditional menu; current landing unchanged |
| Modify | `src/App.test.tsx` | direct URL, menu/route permission combinations, existing APP and landing preservation |
| Create | `src/api/processWorkerFailures.ts` | `processWorkerFailuresApi.get`, `isProcessInstanceId`, readonly mirror and closed response decoding |
| Create | `src/api/processWorkerFailures.test.ts` | current C/CL/OAS fixture parity, path, tenant, errors, shape and bound/affinity |
| Create | `src/pages/WorkerFailuresPage.tsx` | exact lookup, local state, scoped abort, data presentation |
| Create | `src/pages/WorkerFailuresPage.test.tsx` | form, populated/empty/unknown/error/late and tenant/session tests |
| Modify | `src/permissions/permissions.ts` | `PROCESS_READ = 'TIANJI_PROCESS_READ'` and `PROCESS_WORKER_RECOVER = 'TIANJI_PROCESS_WORKER_RECOVER'` existing code references |
| Modify | `src/permissions/resources.ts` | exact menu/page and ALL pair, no APP mutation |
| Modify | `src/permissions/references.ts` | add only `tianji.api.process.instance.worker-failures` with `CALLS` |
| Modify | `src/permissions/messages.ts` | zh-CN/en-US page/menu labels |

Canonical Spec target `docs/egon/spec/2026-11-05-18-03-worker-failure-console.md`. No new frontend store, registry, test setup, dependencies, build scripts, service files, lock files or CSS. Tests may keep golden/negative fixture literals colocated.

## 9. Interface Definitions

Scope disposition: Context-only. Existing REST Query `GET /api/tianji/v1/process-instances/{instanceId}/worker-failures`, operation `getProcessWorkerFailures`, is owned by PS `ProcessWorkerRecoveryController#failures` and described in C/CL `ProcessWorkerRecoveryClient` and packaged `META-INF/tianji/openapi/process-worker-recovery-v1.json`. The existing `tianji.api.process.instance.worker-failures` resource requires `TIANJI_PROCESS_READ` + `TIANJI_PROCESS_WORKER_RECOVER` and OAuth scopes `tianji:process:read` + `tianji:process:worker-recover` for supported principals. This Web consumer uses the authenticated USER cookie path only. Required path ID is exact, no body/query/correlation/owner selector. The present frontend additionally sends its existing `X-Egon-Tianji-Tenant` assertion. Success is JSON 200/no-store. Runtime mappings preserve current transport and provider behavior. No new API number, OAS, authentication logic, native storage access or POST reference is introduced.

| Existing response | Web consumer disposition |
| --- | --- |
| 200 closed envelope with nonempty/empty list | Display validated facts or explicit observed empty list |
| 400 `TIANJI_INVALID_COMMAND` | Fixed invalid-query message; no previous rows |
| 401, 403 and 409 `TIANJI_TENANT_CONTEXT_CHANGED` | Keep current shared auth invalidation. No results in the new frame |
| 404 `TIANJI_RESOURCE_NOT_FOUND`, absent route 404 | One fixed unavailable text, no distinction or existence claim |
| 500, 503, offline/timeout/transport or body failure/shape | Fixed read-unavailable state; deliberate fresh GET under current authority |

## 10. POJO and Data Model Design

Define exact readonly TS mirrors, no Java model. Public TS consumer `get(tenant: string, instanceId: string, signal?: AbortSignal): Promise<ProcessWorkerFailures>` checks ID and calls `requestJson<unknown>` with relative path and GET, no body or query. Encode the one path segment exactly once with `encodeURIComponent`. No double-decoding, input trimming, route navigation, or alternate selector. The encoded-segment mock verifies browser request construction. Actual gateway handling of escaped IDs is a deployment verification. Input and returned instanceId obey C `GetProcessInstanceQuery`, with exact equality after parsing. Runtime errors contain only fixed user-facing copy at page, no raw response or URL.

| Shape | Fields | Validation |
| --- | --- | --- |
| ID | instanceId, jobId, activityId | instance/job 1–255 and activity 1–128 Java UTF-16 units. Match Java trim/isBlank/safeText, reject control/NUL/DEL, unpaired surrogate. `instanceId` also rejects literal `.` and `..`. Preserve valid interior spaces/Unicode and no canonicalization |
| ProcessWorkerFailures | exactly `instanceId, observedAt, failures` | exact identity; canonical UTC timestamp; actual array length ≤128; row job IDs strictly ascending under unsigned UTF-8 bytes using TextEncoder, rejecting duplicates/out-of-order rather than sorting |
| ProcessWorkerFailure | exactly `jobId, activityId, nativeDeadletter, status, reason, reportedFailure, expectedVersion` | nativeDeadletter is true boolean; activityId and expectedVersion explicit null when absent; version nonnull only if allowed below |
| status | RETRY_AVAILABLE, MANUAL_REVIEW, HISTORICAL_FAILURE | no coercion/default |
| reason | NONE, NO_NATIVE_DEADLETTER, UNKNOWN_OUTCOME, BUSINESS_REJECTED, RESTORE_LIMIT_REACHED, UNSUPPORTED_NATIVE_JOB, PROCESS_INACTIVE, EVIDENCE_CONFLICT, ACTIVE_LEASE, BINDING_UNVERIFIED, HISTORY_INCOMPLETE, UNSUPPORTED_EFFECT | same C enum |
| reportedFailure | NONE, RETRYABLE, BUSINESS_REJECTED, UNKNOWN, UNVERIFIED | displayed independently; no client-derived classification |
| row cross-check | exact C constructor | UNKNOWN_OUTCOME implies UNKNOWN; BUSINESS_REJECTED reason implies BUSINESS_REJECTED outcome. RETRY_AVAILABLE requires native=true, activity nonnull, reason NONE, RETRYABLE, 64 lowercase hex expectedVersion. MANUAL_REVIEW requires native=true, version null, reason neither NONE nor NO_NATIVE_DEADLETTER. HISTORICAL_FAILURE requires native=false, version null and reason among NO_NATIVE_DEADLETTER/UNKNOWN_OUTCOME/BUSINESS_REJECTED/HISTORY_INCOMPLETE |

Validate the observed UTC Instant with a four-digit Gregorian year, valid date and time to seconds, terminal Z, and an optional canonical 3/6/9-digit fraction. The final three-digit fraction group must contain a nonzero digit. Reject offset/local/epoch forms, impossible dates, second 60 and an observation outside the existing operational year range. This checks the source clock observation, which is always current, rather than defining a general Java Instant parser. Preserve original precision and render the source string with an explicit UTC label and semantic `time`. Do not reinterpret parsed timestamps to establish freshness, infer elapsed time, infer that Worker ran, or use them as a version. Browser validates decoded values under existing JSON transport. The existing transport exposes decoded successful bodies without the HTTP status; this adapter checks the exact body and handles empty/malformed success and non-success safely, but does not independently distinguish a shape-valid non-200 success. The provider contract remains exact 200. Existing path protection may refuse a C-valid encoded identifier containing traversal-like segments or backslash; the page reports safe unavailability and never bypasses or re-encodes the path. The CL byte parser’s duplicate-key detection, body byte bound and UTF-8 rejection remain service/SDK evidence; this browser adapter does not advertise equivalent raw parser guarantees.

## 11. Database Design

Scope disposition: Unchanged. Existing PS ProcessDB START/Worker/native evidence and versioned DDL stay within the provider. No persistence, transaction, data sync, index, new Flyway migration or ER change arises from this page.

## 12. Frontend Page Design

### 12.1 Route, navigation, permission, and page ownership

| Page | Route | Menu / guard | Permission and deep link |
| --- | --- | --- | --- |
| Worker 失败观察 | `/operations/worker-failures` | `tianji.menu.workerFailures` beneath `tianji.app.console`, fixed path/prefix; `tianji.page.workerFailures` in RequireResource | both resources ALL `[PROCESS_READ, PROCESS_WORKER_RECOVER]`. APP gate and existing landing remain current; direct route uses same page guard. No instance-bearing URL |

Labels use page code `tianji.web.permissions` with keys `page.workerFailures` and `menu.workerFailures`, zh-CN `Worker 失败观察`, en-US `Worker failure observations`. Existing app resource codes and SDK registry/bootstrap stay unchanged.

### 12.2 Layout and component tree

`WorkerFailuresPage` uses existing `page-stack/page-heading/surface-card` and Ant Design form, input, button, alert, table, tag and typography. Header explains exact owned-ID observation; search card has label `流程实例标识` and action `查询失败快照`. Snapshot card, only after validated 200, has exact returned ID, UTC observation instant, bounded table or empty state. Render plain React text. No link to a recovery or cancellation command. No render of expectedVersion or raw errors.

### 12.3 User flows, forms, and validation

Form is required, starts empty, has no route/query prefills, no autocomplete, UTF-16 max 255, exact validation shared with the TS consumer, and no silent normalization. A submit captures that ID and current frame. Disable duplicate in-flight submit. Editing the input clears a displayed snapshot or pending outcome, increments sequence and aborts prior read; user explicitly submits the new ID. If the ID is unchanged, a later manual submit refreshes it with one new GET. Identity or route departure clears form and results. Current snapshot is always labeled with the captured exact instance ID and observedAt.

### 12.4 UI state and API/data mapping

| State | Trigger | Presentation | Enabled action |
| --- | --- | --- | --- |
| Initial | mount with permitted identity | heading and form only | submit valid ID |
| Loading | exact request running | accessible loading label, prior rows removed | edit or leave; duplicate submit disabled |
| Empty | validated 200 failures=[] | `此快照未返回 Worker 失败记录。` and observation UTC | manual query |
| Populated | validated nonempty | job ID, activity ID or `—`, native deadletter yes/no, state, reason and reported result. Stable server order and exact row key | manual query |
| Unknown evidence | row reports UNKNOWN | visible `结果未知，需核对` independent of status/native indication; report reason separately | manual query |
| Unverified evidence | row is UNVERIFIED, BINDING_UNVERIFIED, HISTORY_INCOMPLETE, EVIDENCE_CONFLICT or relevant reason | fixed label preserving that distinction; no success/permission inference | manual query |
| Invalid input | local validator or provider 400 | input-associated fixed error; no stale result | correct and submit |
| Not visible / route off | 404 | `当前无法观察该流程实例。` | manual query |
| Read unavailable | malformed/foreign body, unexpected code, timeout/network/503 | `暂时无法读取 Worker 失败快照。` | manual query |
| Denied or changed session | local guard, 401/403/tenant change | existing shell gate or sign-in/revalidate flow; clear results | existing shell behavior |

Map RETRY_AVAILABLE to `服务端快照标记可重试` with neutral styling, MANUAL_REVIEW to `需人工核对` and HISTORICAL_FAILURE to `历史失败记录`. Use the fixed reason labels below. The report field shows NONE `未报告失败结果`, RETRYABLE `已报告可重试`, BUSINESS_REJECTED `已报告业务拒绝`, UNKNOWN `结果未知，需核对`, and UNVERIFIED `报告结果尚未验证`.

| Reason | Label | Reason | Label |
| --- | --- | --- | --- |
| NONE | 无额外原因 | NO_NATIVE_DEADLETTER | 当前未见原生 deadletter |
| UNKNOWN_OUTCOME | 结果未知，需核对 | BUSINESS_REJECTED | 业务拒绝 |
| RESTORE_LIMIT_REACHED | 已达恢复次数上限 | UNSUPPORTED_NATIVE_JOB | 原生任务类型暂不支持 |
| PROCESS_INACTIVE | 流程当前未运行 | EVIDENCE_CONFLICT | 证据存在冲突 |
| ACTIVE_LEASE | 仍有活动租约 | BINDING_UNVERIFIED | 来源绑定尚未验证 |
| HISTORY_INCOMPLETE | 历史证据不完整 | UNSUPPORTED_EFFECT | 副作用类型不支持 |

 Keep client displays of status and reason separate. No claim that a historical failure is resolved, a missing row is complete history, or an eligible snapshot is a current recovery authorization.

### 12.5 Accessibility, responsiveness, and interaction safety

Use native form submit/Enter, associated field error, heading landmarks and live loading/error feedback. Unknown and unverified are text, independent from color. Present the table with headers and horizontal scrolling on narrow layouts. Retain original text where display truncation would obscure ID. Default focus stays on the form; invalid submit focuses the relevant input. No modal, keyboard mutation shortcut, stored command or destructive action.

## 13. Design Patterns and Architecture Principles

Existing transport and auth form the adapter boundary. Direct page-owned state and sequence/abort are sufficient for a single read. Reuse current Case lookup interaction without sharing Case validation or its command reducer. No second provider, generic failure state manager or command abstraction is justified.

## 14. Test Design

| ID | Owner and exact scope | Assertions |
| --- | --- | --- |
| TEST-001 | `src/api/processWorkerFailures.test.ts` | exact GET encoded path including interior space, slash and plus as percent escapes; dot/dotdot/control/surrogate and oversized IDs rejected before transport; tenant context/signal; closed keys/nullability/boolean/enums, 128/129 cap, UTF-8 ordering with non-BMP boundary, duplicate ID, foreign instance, canonical/invalid UTC, legal/illegal rows |
| TEST-002 | `src/App.test.tsx` | existing APP/landing unchanged; PAGE and MENU manifest resources use ALL pair; no menu/deep-link fetch when one or both absent; both plus existing shell grant permit dedicated page; only exact GET CALLS reference and zh-CN/en-US labels |
| TEST-003 | `src/pages/WorkerFailuresPage.test.tsx` | mount zero network, manual submit/refresh, empty 200 with time distinct from 404/503, unknown and history independent, rejected body never renders, explicit UTC original fraction, no mutation/recovery control |
| TEST-004 | same page plus existing `src/auth/AuthContext.test.tsx` | abort and late result ignored after ID change/unmount/full frame/permission changes; fresh request only; 401/403/tenant change standard AuthContext handling |
| TEST-005 | current Web verification plus verified PAC output | exact test/typecheck/lint and static Web build, resource/ref allowlist, no new API producer definition, no POST call or permission grant; backend/Gateway runtime not executed |

Future Plan selects `npm test -- src/api/processWorkerFailures.test.ts src/pages/WorkerFailuresPage.test.tsx src/App.test.tsx src/auth/AuthContext.test.tsx`, then `npm run typecheck` and `npm run lint`. Dedicated `npm run build` uses existing official `PAC_SDK_DIR` and explicit `PAC_TOOLCHAIN_LOCK` with matching `PAC_CONTRACT_ARTIFACT`. Verify actual Web manifest/artifact and independently compare the GET resource/principal/scope against the packaged PS producer manifest, including its framework-declared HEAD. The TS consumer calls GET only.

The checked-in lock expects Jianshen JAR SHA-256 `2077ebbb0e5aa9d35bb1350c869fc7e38879f5d476b649a754094da230ac7b18`. The earlier temporary JAR path is absent. The current sibling Jianshen contract target JAR has SHA-256 `4d11ac69c2afc19c9286129ba267696f8bfc2cefd1a11893efd31a943dc9977c`, with all five canonical entry digests exactly matching the checked-in lock. A future Plan may use the original exact artifact if recovered or an explicitly reviewed, off-repo `LOCAL_UNCOMMITTED` validation lock from existing `createToolchainLock`, with only `contract.sha256` differing and official `verifyToolchain` passing. `buildConsumer` accepts the explicit absolute lock path. Keep the tracked lock unchanged. A production pinned toolchain or committed lock repin is separate. This Spec turn ran offline SDK lock verification and static SHA/entry comparisons. It did not run JS tests or a Web build.

## 15. Non-functional and Cross-cutting Design

One bounded GET per explicit action, no poll, waterfall, cache or persistence. Bound rows to 128 and never truncate silently. Keep current Cookie/AuthContext/tenant semantics and abort fence, no credentials or browser token handling. Backend error detail and permission diagnostics stay out of the page. Reuse focus, AntD, text and semantic time rendering for readability. Preserve retry safety through reads only.

## 16. Compatibility, Migration, Rollout, and Rollback

Future source deployment only after Web tests/static build, exact permission manifest checks, existing PS and contract artifacts pinned. No changes to old Web route ordering, existing roles/grants, process storage or C/CL/PS wire. Registration of Web resources, actual gateway route availability, current user grants and flags are independently controlled. Since PS flags also gate POST, do not request enabling Worker recovery as a side effect of adding this page. If the environment already deliberately enables the source, verify live exact-owner success and cross-owner denial through the authorized environment. A route rollback removes only this menu/page/reference; no data or PS rollback follows.

## 17. Alternatives and Decisions

| Alternative | Evidence and trade-off | Decision |
| --- | --- | --- |
| Existing Worker GET, exact owner, existing console only | bounded contract and actual packaged PS evidence | Select |
| Add Worker-read-only IAM audience now | GET currently shares two codes with POST; changing audience requires a separate PS/PaC/OAuth grant design, not a frontend reference | Defer |
| First expose Agent disposition, usage or cross-source timeline | existing AR/AS internal results have no approved Web REST or current manifest resource; correlation does not imply same owner | Defer |
| Show release/restore commands | existing Process release GET is version lookup only; offline candidate validation gives no live activation authority. Worker POST runtime acceptance separate | Defer |

## 18. Risks and Open Questions

This source slice is useful for users who already have the existing console and both Process permissions. If the requirement becomes a separately granted read-only audience, the current permission pair is insufficient. That design must be reviewed before any new grant, with independent provider and browser verification.

| Later capability | Proposed stage boundary and exact candidate anchors | Authority and stop condition |
| --- | --- | --- |
| Worker observation for principals lacking recovery permission | PS `ProcessWorkerRecoveryController#failures` and `TianjiProcessPermissions`, USER permission→scope mapping and route feature distinction. Independently review a GET-specific `TIANJI_PROCESS_WORKER_FAILURE_READ` / `tianji:process:worker-failure:read` candidate. If modifying existing route authorization, review old holder compatibility and C `ProcessWorkerRecoveryClient`/CL `process-worker-recovery-v1.json` authority and SDK negatives before any TS resource revision | User-approved new audience, exact START owner preserved. Never issue the current recover grant solely for observation |
| Agent recovery panel | Start with committed T4-03 AR `inspectRecovery` and exact owner finite tests. Independently propose C `AgentRecoveryDispositionDTO` and existing `GetAgentRunQuery`, AS `AgentRunController` candidate `GET /api/tianji/v1/agent-runs/{runId}/recovery-disposition`, new narrow API resource with explicit current Agent READ and a separately decided diagnostics grant. AS `TianjiAgentAccess#require` precedes AR exact owner. Add CL OpenAPI resource and typed HTTP client only if the approved contract's consumer/build needs it, then Web detail section and exact TS reference | Do not invent permission reuse or grant. Fixed safe readonly shape, no raw result or restoration. Need independent design and runtime gates |
| Agent model usage panel | First keep T4-02 AS `AgentModelUsageDiagnostics` and V15 optional semantics. Separately design C read DTO/typed cursor and AS per-run GET candidate `/api/tianji/v1/agent-runs/{runId}/model-usage` with no-store/current owner and exact privacy/permission decision. CL API package if accepted, TS decoder only after producer manifest. A correlation lookup needs a separate exact-owner window/cursor contract and UX | Confirmed zero, UNKNOWN, unpriced and unavailable preserved; no billing or aggregates from UI. Runtime provider/PG/S12 independent |
| Cross-source correlation / release governance | Review each AS and PS owner query, then compare authorized opaque links, source-specific clocks, bounded pagination and partial outcomes. Existing PS `ProcessController#release` may support separate known-version lens; PS CLI candidate and T4-01 governance remain distinct | No shared timeline or release activation until scope, auth and live evidence are approved |
| Existing Worker recovery action | Later consumer references POST only after current permission, expectedVersion/reason/idempotent receipt UX and live S10/S11 accepted; package stage keeps current C/CL/PS boundaries | No source claim of operational safety from this observation page |

## 19. Traceability Matrix

| Requirement | Use case | Affected areas/chapters | Context-only/unchanged boundary | Tests | Acceptance evidence |
| --- | --- | --- | --- | --- | --- |
| REQ-001 | UC-001 | App/PAC, §7/8/12.1 | existing identity/grants EVD-001/002/004 | TEST-002/004/005 | route and permission negatives |
| REQ-002 | UC-001 | consumer and form, §9/10/12.3 | existing exact Process owner EVD-003/004 | TEST-001/003 | one safe GET and closed decoding |
| REQ-003 | UC-001 | page facts, §10/12.2/12.4 | existing closed evidence EVD-003/005 | TEST-001/003 | empty, UNKNOWN, unavailable |
| REQ-004 | UC-002 | lifecycle, §7.3/12.3–12.5 | current request context EVD-002/006 | TEST-003/004 | discard late/old scope |
| REQ-005 | UC-001, UC-002 | build and boundaries, §14/16/18 | existing PS and PAC EVD-005/008 | TEST-002/005 | finite plus static artifact, live separated |

## 20. Review and Acceptance

### 20.1 Original-request fidelity

First useful Worker failure observation only. Full T4-04 still depends on accepted service contracts and actual source-specific runtime gates. The design preserves unknown outcomes, current owner and explicit permission boundaries.

### 20.2 Repository and technical fidelity

Exact module routes, C/CL authorities, manifest references, security, file ownership and existing Web tooling cited above. Scope inspection and document validation are independent of implementation/tests.

### 20.3 Cross-section consistency

One GET, one page and no write path across §7–§16. Existing REST remains context-only; unknown remains separate from eligibility. Runtime verification is separately pending, especially current USER route/grants and PS default-off feature.

### 20.4 Relationship and effective-design review

Depends on the main blueprint and the current Worker provider contract only. Existing Task/Case Web informs the layout and does not alter its scope. No amendment or supersession.

### 20.5 Blocking Manual Check

| Check ID | Applicability | Status | Evidence | Finding | Required action/exception |
| --- | --- | --- | --- | --- | --- |
| MC-ARCH-001 | Applicable | PASS | EVD-001/002, §7/8 | Existing TS ownership, untouched technical Java path | None |
| MC-REUSE-001 | Applicable | PASS | §6.1/7 | Reuse exact transport/auth/layout/route | None |
| MC-DEP-001 | Applicable | PASS | EVD-008, §8/14 | No new dependency or build structure | None |
| MC-NAME-001 | Not applicable | N/A | §8 TS-only | no Java type naming | None |
| MC-VALID-001 | Applicable | PASS | EVD-003, §10, TEST-001 | closed TS input/response and exact owner in PS | None |
| MC-MODEL-001 | Not applicable | N/A | §10, existing C | no Java carrier change | None |
| MC-CONVERT-001 | Not applicable | N/A | §8/10 | no Java mapper/converter | None |
| MC-LOG-001 | Not applicable | N/A | §8/15 | no new Java logger or dynamic browser logging | None |
| MC-BEAN-001 | Not applicable | N/A | §8 | no Java/Spring Bean change | None |
| MC-UTIL-001 | Not applicable | N/A | §6.1/10 | browser primitives only | None |
| MC-JSON-001 | Applicable | PASS | §9/10, TEST-001 | current decoded wire, closed shapes and honest raw-byte limits | None |
| MC-TIME-001 | Applicable | PASS | TIME-001, TEST-001/003 | UTC source with unchanged precision | None |
| MC-CONFIG-001 | Not applicable | N/A | §8/16 | no profile, auth or gateway config changes | None |
| MC-PATTERN-001 | Applicable | PASS | §7.0/13 | direct bounded read and reusable adapter, no new pattern framework | None |
| MC-SCOPE-001 | Applicable | PASS | §3.3/8/9/11/16 | one frontend source slice with exact boundaries | None |
| MC-TEST-001 | Applicable | PASS | §14 TEST-001–005 | verification design with finite and live boundary | None |
| MC-BLOCKER-001 | Applicable | PASS | §5/18 | no blocker for review of selected existing-holder slice; proposed broader audience is independent | None |

### 20.6 Final verdict

PASS — Ready for user review

This verdict applies to the candidate design. Implementation, static Web build, deployment and real browser, gateway, IAM and Flowable evidence are independently pending.
