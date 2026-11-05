# 天机按版本读取流程发布元数据

| Field | Value |
| --- | --- |
| Document | `2026-11-05-19-29-process-release-metadata.md` |
| Template Version | `9` |
| Archetype Cleanup | `Not applicable` |
| Status | `Review` |
| Type | `Feature` |
| Complexity | `Simple` |
| Complexity Drivers | `None` |
| Created | `2026-11-05 19:29 Asia/Shanghai` |
| Updated | `2026-11-05 19:32 Asia/Shanghai` |
| Owner | 天机平台决策人 |
| Repository | `tianji-web` |
| Scope | T4-04B，现有控制台用户查询一个已知 Process 发布版本 |
| Change Surface | 一个受控 Web 路由和菜单、一个已有 GET 的 TS 消费者、一个只读页面和现有四个 PaC entrypoint 增量 |
| Affected Chapters | `§7, §8, §10, §12, §13, §14, §15, §16, §17, §18` |
| Source Requirement | [整体蓝图](../../../../docs/plans/agent-framework-upgrade-plan.md) `§19 T4-04`。Root 授权现有 Process release GET source-only |
| Baseline Revision | `tianji-web e5d14225abacd4766aa21f9b59ce2364cd23bb3b`，PS `tianji-service 6fcd76be629680d8cd8863537a4c31adc2506952`，EDGE `yuheng-service d2682b44f680024d028747d26812caaaa4ba2adf` |
| Amends | `None` |
| Supersedes | `None` |
| Depends On | [整体蓝图](../../../../docs/plans/agent-framework-upgrade-plan.md) `§19 T4-04`，既有 PS ProcessReleaseDTO 和 release GET |
| Related Specs | [Worker 失败观察台](2026-11-05-18-03-worker-failure-console.md) `§7, §12, §14, §16` |
| Related Plans | `None` |

## 1. Summary

现有控制台用户凭现有流程发布读取权限，按准确版本查看 Process release 的 manifest SHA、创建 UTC 时间、模型类型、定义 key、内容 SHA 和声明输入类型。一次只查一个版本。沿用 Web Cookie/BFF 和 PS 当前租户授权。已检查的 EDGE profiles 缺 Tianji 转发证据，实际网关部署独立验收。Root 已批准独立有限源交付。

## 2. Background and Current State

### 2.1 Business and user context

已授权的租户用户需要核对某个已知流程版本的模型和输入 schema。发布读取属于当前租户资源权限，和 Worker exact START 所有者读取独立。该视图只解释发布元数据。

### 2.2 Repository evidence

| Evidence ID | Classification | Exact source | Observed fact | Verification limit |
| --- | --- | --- | --- | --- |
| EVD-001 | Static repository | PS `ProcessController#release,noStore`、`ProcessReleaseService#get,load` | exact GET tenant-scoped release, no engine IDs. Legacy ACTIVE is stored published state | no activation/bundle/signer authority |
| EVD-002 | Static repository | C `GetProcessReleaseQuery,ProcessReleaseClient,ProcessReleaseDTO,ProcessModelDTO,ProcessModelTypeEnum,ProcessValueTypeEnum,OrchestrationChecks`，CL `HttpProcessClient#get` | exact version/hash/schema shape and response affinity | no list/diff |
| EVD-003 | Static repository | PS `TianjiProcessAccess#require,TianjiProcessPermissions` and application.yml | existing `TIANJI_PROCESS_RELEASE_READ`, `tianji:process:release:read`, `tianji.api.process.release.get`, USER/SERVICE, API conditional | browser uses current USER session only |
| EVD-004 | Static repository and pure serialization | PS `ProcessControllerTest` release/CMMN; pure JDK25 pinned Jackson 3.1.7 serialization of actual C DTO outside repo | createdAt serialized as UTC Z with fractional precision, CMMN empty inputs supported | no app/listener/browser |
| EVD-005 | Static repository | Web `App.tsx,WorkerFailuresPage.tsx,auth/AuthContext.tsx,auth/gatewayAuth.ts,api/client.ts` and SDK `gatewayAuthClient.ts` | current Shell, guard, issuer/tenant/subject/requestEpoch, existing /apps/edge-tianji prefix | prefix is not a route |
| EVD-006 | Static repository | EDGE `EdgeSecurityConfiguration,EdgeResourceAuthorizationGatewayFilterFactory#apply`, tracked `application.yml/application-local.yml` and [EDGE README](../../../../yuheng-service/stellar-enclosure-yuheng-edge-gateway/README.md) | generic authenticated matcher is not forwarding. Actual filter requires alias, route ID, allowlisted path, resource URI/audience and verified access. Tianji absent from both tracked profiles | deployed overlays not evidenced |
| EVD-007 | Existing artifact | T4-04A Web local PaC and actual PS permission producer evidence | official existing lock override/build available | no live registration/grant |

### 2.3 Problem statement and gap

Web 缺独立的发布查看。现有 exact GET 可消费。路由和 issuer/audience 的当前部署未知，不可凭 PS route 或 SDK alias 推断。首切片不增加比较查询。

### 2.4 Evidence and current-chain map

| Entry/trigger | Current chain | Data owner | Boundary |
| --- | --- | --- | --- |
| Web session | AuthContext → gateway identity/bootstrap → registry/Shell | verified frame | existing auth |
| Release GET | PS Controller → access guard → release store | current tenant released data | no-store, same existing policy |
| Gateway relay | SDK prefix → deployed route → alias/path/audience filter | operator config | tracked profiles lack Tianji |

### 2.5 Archetype example cleanup

Cleanup disposition: Not applicable

Reason: Existing React console; current routes are business code. No generated Java project, module or example scope.

## 3. Goals and Non-goals

### 3.1 Goals

只读显示已知版本的公开 Process 元数据，保证当前身份、租户、返回版本和页面状态绑定。

### 3.2 Non-goals

无列表、搜索、比较、XML、发布、执行、激活、回滚、迁移、Agent bundle、后台刷新、新 BFF route、权限策略或 grant、DB/后端改动。

### 3.3 Change Surface and Design Depth

| Area/layer | Disposition | Exact repository evidence | Changed or preserved behavior | Required Spec treatment | Chapter(s) |
| --- | --- | --- | --- | --- | --- |
| Web route/menu/typed API/page/tests | Affected | EVD-002/005/007 | one exact existing GET, read-only display | full Web design | §7, §8, §10, §12, §13, §14, §15, §16, §17, §18 |
| PS/C/CL/EDGE | Context-only | EVD-001/003/006 | retain same source/transport | exact existing interface and separate gate | §9 |
| database | Unchanged | EVD-001 | existing data owner | scope only | §11 |
| Java scaffolding | Not applicable | all target files TS | no generator | scope only | §8 |

## 4. Requirements and Acceptance Criteria

| ID | Atomic requirement | Priority | Observable acceptance | Source |
| --- | --- | --- | --- | --- |
| REQ-001 | existing console and exact release-read | Must | route/menu require existing APP session + exact code, landing unchanged | EVD-003/005 |
| REQ-002 | one exact GET | Must | explicit valid version, no prefetch, no body, tenant assertion, exact response shape and affinity | EVD-001/002 |
| REQ-003 | existing metadata only | Must | real digests/time/type/schema, empty schema and safe error, no action | EVD-001/002/004 |
| REQ-004 | abort/discard old frame | Must | input/identity/permission/route change clears, existing auth error flow | EVD-005 |
| REQ-005 | finite/static proof, live separate | Must | official build exact resource/ref, no policy/route or live claim | EVD-006/007 |

### 4.1 Scenario matrix

| Scenario | Trigger | Result | Requirements |
| --- | --- | --- | --- |
| valid version | authorized explicit query | exact metadata | REQ-001/002/003 |
| hidden or missing | failed gate or 404 | fixed outcome, no previous data | REQ-001/003 |
| stale reply | edit/leave/new frame | dropped | REQ-004 |
| no route witness | operator unable to prove deployment | source-only evidence | REQ-005 |

### 4.2 Use-case analysis

| Actor ID | Actor/role | Goal and responsibility | Entry/channel | Permission/tenant context | Evidence |
| --- | --- | --- | --- | --- | --- |
| ACTOR-001 | current console USER | read known release | guarded page | existing app and release READ | EVD-003/005 |
| ACTOR-002 | PS and EDGE | enforce source/tenant | existing GET/provisioned route | exact current authority | EVD-001/006 |

| ID | Use case/goal | Primary actor | Supporting actors/systems | Trigger | Preconditions | Main success outcome | Alternatives/failures | Postconditions | Requirements | Interfaces/pages | Tests |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| UC-001 | Read one release | ACTOR-001 | ACTOR-002 | deliberate submit | existing guard, exact ID | source metadata shown | invalid/foreign/malformed/unavailable | no mutation | REQ-001/002/003 | page/existing GET | TEST-001/002/003 |
| UC-002 | discard old observation | ACTOR-001 | ACTOR-002 | edit/leave/new frame | prior or pending read | clean current frame | old reply ignored | no data retained | REQ-004/005 | same | TEST-004/005 |

## 5. Constraints, Assumptions, and Decisions

| ID | Decision | Evidence |
| --- | --- | --- |
| DEC-001 | one explicit exact release and one GET | Root scope, EVD-001 |
| DEC-002 | existing APP gate and existing release-read only | EVD-003/005, no role change |
| DEC-003 | source-only approved despite unproved route | Root direction and EVD-006 |
| ASM-001 | actual deployment supplies approved alias/route/issuer/audience/bootstrap | no tracked/live proof. Missing evidence blocks live acceptance |

## 6. Project Technology Context

Existing React 19, TypeScript 6, AntD, React Router, Vitest/jsdom and official PaC build. No dependency or package-lock changes.

### 6.1 Java architecture profile and capability baseline

TS App/API/pages/auth/permissions profile. Existing Java provider and EDGE remain context. Reuse transport, current guard, registry and layout without a new layer.

### 6.2 User-mandated Java rule compliance

| Literal rule | Affected? | Repository evidence | Exact design decision | Files/types/interfaces | Validation/test evidence | Status/blocker |
| --- | --- | --- | --- | --- | --- | --- |
| Rule 1 | No | §8 TS | no Java names | TS mirrors | TEST-001 | N/A |
| Rule 2 | No | C existing | exact browser checks | §10 | TEST-001 | N/A |
| Rule 3 | No | C records | readonly TS only | §10 | TEST-001 | N/A |
| Rule 4 | No | no Spring | no Bean/log | §8 | diff | N/A |
| Rule 5 | No | existing TS/DOM | no Java util/dependency | §8 | diff | N/A |
| Rule 6 | No | existing PS wire | no serializer change | §9/10 | TEST-001 | N/A |
| Rule 7 | No | existing PS/EDGE | no config edit | §16 | TEST-005 | N/A |
| Rule 9 | No | direct single read | local abort/sequence | §13 | TEST-004 | N/A |
| Rule 10 | No | C Instant unchanged | preserve raw UTC string | §6.3 | TEST-001/003 | N/A |
| Rule 11 | Yes | existing Web and PS | preserve structure and authority | §7/8/11 | TEST-005 | PASS |

### 6.3 Time semantics and conversion contract

Time contract: Required

| Time ID | Fields/symbols | Semantics | Java/runtime type | Storage policy | Wire policy | Business zone source | Display zone source | Boundary / DST rules | Precision / Clock | Compatibility | Verification |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| TIME-001 | ProcessReleaseDTO.createdAt | Occurred instant | Instant, TS string | Not persisted | UTC Z | Not applicable: no calendar computation | explicit UTC and HTML time | no offset/local conversion | original fraction, no wall clock | existing source instant, no inferred activation | TEST-001, TEST-003 |

## 7. Architecture Design

### 7.0 Minimum-design baseline and element-necessity audit

| Proposed element | Change | Requirements | Existing/direct alternative | Concrete inadequacy of alternative | Added calls/state/coupling/failures/migration/operations | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| current GET and auth | Keep | REQ-001/002 | direct reuse | none | current authority | Keep |
| typed decoder | Add | REQ-002/003 | unchecked body | no ID or schema validation | same one call | Add |
| page/menu | Add | REQ-001/003/004 | current Worker page | different permission and resource | one local frame | Add |
| comparison, list and actions | Exclude | REQ-005 | exact single view | no need for additional state | none | Remove |

| Path | Network calls | Client states | Server contracts/state | Failure and TOCTOU points | Additional user/business value |
| --- | --- | --- | --- | --- | --- |
| raw existing GET | one | unchecked body | existing PS | invalid/foreign body possible | existing API |
| selected | one | local form/read/error | same PS | exact body, version and frame | owned metadata display |

### 7.1 System Architecture Design

DefinitionReleasePage → processReleasesApi.get → existing requestJson → EDGE alias prefix → existing PS GET. Actual forwarding depends on already reviewed deployment.

### 7.2 High-Level Design

One explicit form, no route prefill, directory, auto-fetch, comparison or version-bearing browser route. Tenant is asserted by existing transport and determined by PS identity.

### 7.3 Detailed Design

Existing RequireResource and full [issuer,tenant,subject,epoch] key. Abort and sequence guard on edit, exit, resource loss or frame change. Valid deliberate submit dispatches once. Results require current authority, same request sequence and exact requested version. 401/403/409 preserve shared behavior. 404 is generic unavailable without a visibility or existence inference.

## 8. Package Structure and Code File Tree

| Operation | Exact path | Responsibility |
| --- | --- | --- |
| Modify | `src/App.tsx`, `src/App.test.tsx` | existing Shell route/menu and regression |
| Create | `src/api/processReleases.ts`, `src/api/processReleases.test.ts` | exact GET and DTO validation |
| Create | `src/pages/DefinitionReleasePage.tsx`, `src/pages/DefinitionReleasePage.test.tsx` | read-only view and lifecycle |
| Modify | `src/permissions/permissions.ts`, `src/permissions/resources.ts`, `src/permissions/references.ts`, `src/permissions/messages.ts` | current code, two resources and one API ref |

Only these ten TS paths and canonical docs. Existing auth, tracked lock, style and dependencies unchanged.

## 9. Interface Definitions

Scope disposition: Context-only. Existing GET `/api/tianji/v1/process-releases/{releaseVersion}`, PS ProcessController.release, C ProcessReleaseClient.get and CL HttpProcessClient.get. Existing resource `tianji.api.process.release.get`, code `TIANJI_PROCESS_RELEASE_READ` and scope `tianji:process:release:read`. Browser existing USER Cookie path with tenant assertion. Success no-store JSON. No endpoint, OAS, scopes or transport changes.

## 10. POJO and Data Model Design

| TS mirror | Exact fields and invariants |
| --- | --- |
| ProcessRelease | exact releaseVersion, manifestSha256, createdAt, models. Requested version matches, grammar `^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$`, hash64 lowercase, array 1–16 |
| ProcessReleaseModel | exact type, definitionKey, contentSha256, inputs. BPMN/CMMN/DMN, `^[A-Za-z_][A-Za-z0-9_.-]{0,127}$` and hash64. Unique type/key pair, same key in different types allowed |
| inputs | own schema entries 0–16, keys `^[A-Za-z_][A-Za-z0-9_]{0,63}$` and exact C OrchestrationChecks.RESERVED exclusion. STRING/INTEGER/BOOLEAN. Object.fromEntries preserves legal own __proto__ data key |
| createdAt | canonical four-digit Gregorian UTC instant, valid day/time, optional canonical 3/6/9 fractional digits with nonzero final triplet. Preserve exact fraction and reject local/offset/numeric or impossible values |

Export isProcessReleaseVersion and processReleasesApi.get(tenant,version,signal?). Existing requestJson with GET/no-store/signal, one encoded segment and no body. Validate decoded shape, no claim of raw duplicate detection. Keep server model order and sort own input field names ASCII only for display.

## 11. Database Design

Scope disposition: Unchanged. Existing Process release/definition model and tenant scope remain backend-owned. No SQL or schema edits.

## 12. Frontend Page Design

### 12.1 Route, navigation, permission, and page ownership

`/operations/process-releases` under Shell. `tianji.page.processReleases` and `tianji.menu.processReleases` each ALL `PROCESS_RELEASE_READ` only. Current APP and landing unchanged. Only GET CALLS ref `tianji.api.process.release.get`. Keys page.processReleases/menu.processReleases under tianji.web.permissions. Labels zh-CN `流程发布元数据` and en-US `Process release metadata`.

### 12.2 Layout and component tree

Reuse page-stack/page-heading/surface-card, AntD form/table. Label `发布版本`, button `查询发布`. Output exact version, manifest digest, UTC creation time, type/key/content digest and schema. `无声明输入` for empty schema. Plain React text. No controls, engine IDs or XML.

### 12.3 User flows, forms, and validation

Empty exact input, 128 max, no trim/prefill. Deliberate Enter/submit, one read; loading suppresses duplicate but edit aborts. Invalid input focuses field and displays `请输入有效的发布版本。`. Later manual submit refreshes.

### 12.4 UI state and API/data mapping

| State | Presentation |
| --- | --- |
| Loading | `正在查询发布元数据`, no previous snapshot |
| Found | precise UTC and actual model metadata |
| Invalid/400 | fixed field error |
| 404 | `当前无法读取该发布版本。` |
| Network/malformed/503 | `暂时无法读取流程发布元数据。` |
| Denied/session changed | current auth flow and cleared state |

### 12.5 Accessibility, responsiveness, and interaction safety

Form semantics, field focus and live status. UTC HTML time with original wire. Table headers and horizontal scroll for long digests. No mutation, external links or clipboard flow.

## 13. Design Patterns and Architecture Principles

Reuse existing auth/transport and guard. Keep direct one-read state and strict TS decoder. No shared component refactor or new provider.

## 14. Test Design

| ID | Owner | Proof |
| --- | --- | --- |
| TEST-001 | processReleases.test.ts | one exact GET, tenant/signal/no-store, wrong ID/extra fields/types, 1/16/17, duplicate pair, safe input schema and own prototype-like key, real UTC precision |
| TEST-002 | App.test.tsx | route/menu/current APP, exact release code, existing landing, existing Worker, sole GET ref |
| TEST-003 | DefinitionReleasePage.test.tsx | deliberate load, real metadata and empty inputs, safe errors and zero action |
| TEST-004 | same and existing AuthContext | pending/stale abort on edit/identity/route/resource, existing 401/403/409 |
| TEST-005 | existing npm and official local PaC | exact source and static artifact, source/live distinction |

Use targeted tests plus typecheck/lint/full suite and official PaC build. Revalidate previous off-repo toolchain lock and exact five canonical entries without changing tracked lock.

## 15. Non-functional and Cross-cutting Design

One bounded GET, no storage/cache/poll, no raw exception or engine data, no activation/compatibility inference.

## 16. Compatibility, Migration, Rollout, and Rollback

Source-only approved. Live acceptance requires operator proof of existing deployed Tianji alias, resource/issuer/audience, route IDs and allowlisted request path, strip prefix, identity/permission bootstrap, exact release-read and real browser foreign-tenant denial. No route or grant addition. Revert only Web paths.

## 17. Alternatives and Decisions

Select single exact GET. Two known versions could be independently read, but comparison is deferred to separate demand. Direct PS browser access, directory, actions and governance are outside scope.

## 18. Risks and Open Questions

Tracked profiles lack Tianji route. Live acceptance remains blocked until actual configured existing route and authority are proven. Source read and page safely fail closed on unavailable or unsupported responses.

## 19. Traceability Matrix

| Requirement | Use case | Design | Tests |
| --- | --- | --- | --- |
| REQ-001 | UC-001 | §7/8/12 | TEST-002/005 |
| REQ-002 | UC-001 | §9/10 | TEST-001/003 |
| REQ-003 | UC-001 | §10/12 | TEST-001/003 |
| REQ-004 | UC-002 | §7/12 | TEST-003/004 |
| REQ-005 | UC-001, UC-002 | §14/16/18 | TEST-002/005 |

## 20. Review and Acceptance

### 20.1 Original-request fidelity

Single exact Process release metadata GET. No controls or policy invention.

### 20.2 Repository and technical fidelity

Actual PS DTO, EDGE source allowlist and official Web ownership verified statically, plus bounded pure Jackson serialization.

### 20.3 Cross-section consistency

Single read, current scope, full DTO validation, exact route and no mutation. Runtime availability independently gated.

### 20.4 Relationship and effective-design review

No changes to earlier Worker view or PS contract. Source-only explicit Root decision.

### 20.5 Blocking Manual Check

| Check ID | Applicability | Status | Evidence | Finding | Required action/exception |
| --- | --- | --- | --- | --- | --- |
| MC-ARCH-001 | Applicable | PASS | §6/8 | existing Web owner | None |
| MC-REUSE-001 | Applicable | PASS | §6/7 | existing SDK/auth/layout | None |
| MC-DEP-001 | Applicable | PASS | §8/14 | no new dependency | None |
| MC-NAME-001 | Not applicable | N/A | §8 | no Java | None |
| MC-VALID-001 | Applicable | PASS | §10/12 | exact browser and source checks | None |
| MC-MODEL-001 | Not applicable | N/A | §10 | no Java model change | None |
| MC-CONVERT-001 | Not applicable | N/A | §8 | no Java converter | None |
| MC-LOG-001 | Not applicable | N/A | §15 | no logger changes | None |
| MC-BEAN-001 | Not applicable | N/A | §8 | no Java Bean | None |
| MC-UTIL-001 | Not applicable | N/A | §6/8 | no Java utility | None |
| MC-JSON-001 | Applicable | PASS | EVD-004/§10 | exact decoded wire | None |
| MC-TIME-001 | Applicable | PASS | TIME-001/TEST-001/003 | original UTC | None |
| MC-CONFIG-001 | Not applicable | N/A | §8/16 | no config changes | None |
| MC-PATTERN-001 | Applicable | PASS | §7/13 | direct bounded local read | None |
| MC-SCOPE-001 | Applicable | PASS | §3/8/16 | Web source only | None |
| MC-TEST-001 | Applicable | PASS | §14 | finite gates defined | None |
| MC-BLOCKER-001 | Applicable | PASS | §5/18 | source allowed, live gated | None |

### 20.6 Final verdict

PASS — Ready for user review

No claim of implemented source, Web package, IAM, live gateway or browser acceptance.
