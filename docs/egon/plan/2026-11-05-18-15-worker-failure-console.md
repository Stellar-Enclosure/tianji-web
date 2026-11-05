# 天机已知流程的 Worker 失败观察台实施计划

| Field | Value |
| --- | --- |
| Document | `2026-11-05-18-15-worker-failure-console.md` |
| Template Version | `5` |
| Status | `Review` |
| Created | `2026-11-05 18:15 Asia/Shanghai` |
| Updated | `2026-11-05 18:21 Asia/Shanghai` |
| Owner | 天机平台决策人，Root 完成范围审阅并负责执行和提交 |
| Repository | `tianji-web` |
| Scope | T4-04A，单 Web Step：已有 Worker 失败 GET、精确实例只读页面、现有双权限及有限证据 |
| Source Requirement | [整体蓝图](../../../../docs/plans/agent-framework-upgrade-plan.md) `§19 T4-04` 与主 Spec `REQ-001–005` |
| Baseline Revision | `tianji-web f558e02c8d07da2da758c5273a5eb531ca251018` clean。PS 合同锚点 `tianji-service 17fee280792e95da938c68ba65a783b965ca63d8` |
| Implements Spec | [Worker 失败观察台 Spec](../spec/2026-11-05-18-03-worker-failure-console.md) |
| Spec Status | `Review` |
| Spec Revision | `2026-11-05 18:11 Asia/Shanghai`，SHA-256 `5c3b74d2d8f062a956a19d584a7bd22d1cbd36350afbcf323ccd6a132d99720a` |
| Effective Specs | [主 Spec](../spec/2026-11-05-18-03-worker-failure-console.md)，[现有 Worker 合同](../../../../tianji-service/docs/egon/spec/2026-11-05-13-41-process-worker-recovery.md) `§7, §9 API-001, §10`，[整体蓝图](../../../../docs/plans/agent-framework-upgrade-plan.md) `§19 T4-04` |
| Depends On Plans | `None` |
| Supersedes | `None` |
| Superseded By | `None` |
| Related Plans | `None` |

## 1. Summary

Root approved only this exact read-only Web source slice under the user master Plan. Existing PS wire, both permission checks, default-off provider, route safety and tracked toolchain lock remain unchanged. Use the independently checked off-repo validation-only archive lock; no browser, live permission or activation.

一个 Web 本地提交交付当前控制台用户的已知 Process 实例失败观察。先记录 decoder、page 和 route 的真实断言 RED，再实现唯一 GET、只读页面和原双权限资源。有限测试和官方 PAC 静态 build 对比现有 PS manifest。运行环境部署、IAM/grant/flag、Flowable/PG、S10/S11、T3-12 E 和浏览器验收分别记录。

## 2. Target Spec and Effective Design

### 2.1 Primary target

Root 审阅并批准准确 Web-only、现有双 IAM、仅 GET 的设计范围，并指定仓库外验证锁而不提交 tracked lock。本 Plan 保持 Review。正式源工作以前复核选定 Spec 与 Plan 精确 SHA、当前 Web 基线和 PS producer proof。

### 2.2 Effective Spec set

| Role | Spec/link | Status/revision | Effective sections | Why included |
| --- | --- | --- | --- | --- |
| Primary | [Worker 失败观察台](../spec/2026-11-05-18-03-worker-failure-console.md) | Review，SHA 如头部 | §3–§20 | 唯一新增 Web 要求 |
| Existing authority | [Worker 恢复](../../../../tianji-service/docs/egon/spec/2026-11-05-13-41-process-worker-recovery.md) | 现有已提交 C/CL/PS 为准 | §7，§9 API-001，§10 | 现有 owner、grant、wire、error 语义 |
| Roadmap | [整体蓝图](../../../../docs/plans/agent-framework-upgrade-plan.md) | §19 T4-04 | 本切片对应失败观察 | 保留完整计划的其他独立门禁 |

### 2.3 Superseded or excluded content

本次没有取代前序设计。POST 或取消、复原、激活、重放、费用、跨源 correlation、BFF 与 IAM policy、Java、SQL、配置、共享 SDK 或依赖改动均在此 Step 之外。T4-03 AR 和 T4-02 私有 AS 诊断是背景，未给出 Web 合同。

## 3. Effective Requirements and Acceptance

| Requirement | Source Spec section | Effective statement | Observable acceptance | Implementation impact |
| --- | --- | --- | --- | --- |
| REQ-001 | §4/§12.1 | existing console + dual PS permission | menu and direct route need ALL exact pair, APP and landing stay old | App, permission entries and tests |
| REQ-002 | §7/§9/§10 | one exact existing GET | encode one ID segment, current tenant assertion, matching instance and bounded closed rows | consumer and finite transport |
| REQ-003 | §10/§12 | display source facts safely | UTC literal, unknown independent, empty vs unavailable, no write control | page and finite states |
| REQ-004 | §7.3/§12.3–12.5 | stale/foreign replies never publish | edit, unmount, tenant/issuer/subject/epoch and permission changes discard old state | page and existing auth regression |
| REQ-005 | §14/§16 | prove exact Web and PaC increment | current-only source, actual artifact compare, no grants/config/runtime claims | evidence, docs and staged audit |

## 4. Implementation Strategy and Dependency Order

### 4.1 Ordered strategy

一个 commit 闭合可用页面，避免先提交无消费者的 adapter 或显示空路由。先对干净 Web 基线运行官方 PAC 静态构建作比较。随后写三份有限断言，创建仅让 TypeScript 解析的 API 和页面 A stub。记录三处行为 RED 后，依序完成 API、页面、权限声明、App route wiring。最后验证、写证据和精确提交。

### 4.2 Test-first strategy

A API 仅给出最终 readonly 类型、签名、固定 GET 路径和对现有 requestJson 的薄转发，尚未做 decoder/affinity。A page 仅导出返回 null 的同名组件。App 及权限源仍为基线。三个 R gate 分别因接受 foreign JSON、缺表单、缺路由行为失败。每个 selector 恰执行一个 test。Import/编译/fixture 环境错误不计 RED。B 完成最小生产实现和完整边界测试，同文件的 A/B 访问仍是一个路径、一次提交。

### 4.3 Sequential and parallel boundaries

| Step | Depends on | May run in parallel with | Must not overlap with | Reason |
| --- | --- | --- | --- | --- |
| Step 1 | approved scope, exact Web baseline, packaged PS proof, off-repo artifact lock | read-only PS/SDK inspection and nonoverlapping scratch drafts | other Web changes, shared PAC build, source step ordering and actual commit | same App/permission registry and one local artifact output |

### 4.4 Commit boundaries

一次提交精确 §5 的十三路径。Docs、API、路由及其测试属于同一个用户目标。源工作开始与最终验证的 Web HEAD 都是上述 baseline，提交后确认父提交与变更路径。tianji-service 和 web-sdk 只读取锁定的合同/工具工件，允许其他独立并行工作，不能被本 Step stage。

### 4.5 Spec Simplicity and Implementation-necessity Audit

| Spec element | Spec necessity verdict/section | Current repository evidence | Direct/reuse alternative | Interaction/implementation cost | Plan decision |
| --- | --- | --- | --- | --- | --- |
| owner GET | Keep §7.0 | PS Controller.failures, C records, CL codec/OAS | call existing GET | one call, no other owner | Already exists |
| auth/requestJson/SDK layout | Keep §7.0 | AuthContext, api/client, App | direct reuse | no new provider or token code | Already exists |
| closed decoder | Add §7.0/10 | cases.ts validates unknown/affinity | unchecked type is not safe | one TS consumer and test | Implement |
| page and route/menu | Add §7.0/12 | CaseDetail existing pattern for other domain | no worker UI exists | one page, bounded local state and guards | Implement |
| existing code references and page/menu metadata | Add §7.0/12 | resources and permission-manifest.config | no valid Agent/Case proxy for PS code | two refs, two resources, labels and one API CALLS | Implement |
| global store, operations directory, command | Remove §7.0/18 | exact owned GET only | local read serves current scope | no extra storage or request | Already excluded |

### 4.6 Change-unit Dependency Matrix

| Change unit | Requirements | Proof/RED point | Compile/runtime prerequisites | Produces | Consumers/unblocks | Owning Step |
| --- | --- | --- | --- | --- | --- | --- |
| safe wire read | REQ-002/003 | R1 foreign 200 resolves in A | C/CL wire, requestJson and A signature | validated ProcessWorkerFailures | WorkerFailuresPage | Step 1 |
| explicit form and scope | REQ-003/004 | R2 form absent in A | api signature and current AuthContext | read-only page + exact frame | App route | Step 1 |
| route and permission | REQ-001/005 | R3 direct route falls through | old App/test registry and stage page | ALL route/menu, source artifact refs | Web shell and PAC | Step 1 |
| proof | REQ-001–005 | W4–W7 | final exact source and baseline artifacts | finite reports, local PAC, scope audit | evidence and one commit | Step 1 |

### 4.7 Java, Spring, and Egon-COLA Implementation Standards

Java implementation is N/A. All executable edits are TS/React in the existing Web tree. Java provider, public REST contract, profile and storage are context-only.

| Concern | Current repository evidence | Effective Spec decision | Planned implementation consequence | Owning Steps/checks |
| --- | --- | --- | --- | --- |
| Architecture profile | src/api, src/pages, src/auth, src/permissions, App | §6.1 same Web profile | no Java or new architecture layer | Step 1 MC-ARCH-001 |
| Reuse/capability | requestJson, EnterpriseLayout, route and resourceRegistry | §7.0 direct reuse | one adapter, route and page | Step 1 MC-REUSE-001/DEP-001 |
| Validation/model/JSON | TS cases.ts and current CL codec | §10 decoded closed mirror | accept exact source shapes without raw JSON claims | Step 1 MC-VALID-001/JSON-001 |
| Time and state | existing Case UI and source Instant | §6.3/12 UTC and sequence fence | no persistence, one read lifecycle | Step 1 MC-TIME-001/PATTERN-001 |

#### Capability reuse ledger

| Need | Candidates inspected | Exact evidence | Fit/gap | Decision | Added dependency/custom code | Owning Step/check |
| --- | --- | --- | --- | --- | --- | --- |
| IAM transport | gatewayAuth/AuthContext/requestJson | session frame, header, auth error | fit | reuse | None | Step 1 MC-REUSE-001 |
| UI and route | RequireResource, AntD, EnterpriseLayout | current App and Case lookup | fit, Worker view absent | reuse existing components | WorkerFailuresPage | Step 1 MC-ARCH-001 |
| safe wire | cases.ts, Java codec/OAS | same primitives, distinct source shape | exact decoder absent | local TS decoder | None beyond consumer | Step 1 MC-JSON-001 |
| PaC | buildConsumer/createToolchainLock/verifyToolchain | existing official Node tool | fit with exact local archive | keep tracked lock | external evidence only | Step 1 MC-DEP-001 |

### 4.8 User-mandated Java Rule Implementation Matrix

| Literal rule | Spec source | Repository evidence | Exact files and order | Pseudocode obligations | Validation gate | Steps | Status/blocker |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Rule 1 | §6.2 | no Java target | §5 TS/docs | semantic TS exports | W4/W7 | Step 1 | N/A |
| Rule 2 | §6.2/10 | current PS and C validate | Files 1/4 | preserve PS owner and validate browser input | R1/W4 | Step 1 | N/A |
| Rule 3 | §6.2 | current immutable C DTOs | File 4 TS | no Java model or converter | W4/W7 | Step 1 | N/A |
| Rule 4 | §6.2 | no Spring wiring | §5 | no logger/bean change | W7 | Step 1 | N/A |
| Rule 5 | §6.2 | existing TS and DOM | Files 4/5 | no dependency or Java helper | W4/W7 | Step 1 | N/A |
| Rule 6 | §6.2/9/10 | existing C/CL wire | Files 1/4 | browser closed decoded shape | W4 | Step 1 | N/A |
| Rule 7 | §6.2/16 | existing default off PS flags | §5 | no YAML, env key or tracked lock changes | W7 | Step 1 | N/A |
| Rule 9 | §6.2/13 | Simple bounded GET | File 5 | local sequence and AbortController | W4 | Step 1 | N/A |
| Rule 10 | §6.2/6.3 | existing Instant and TS string | Files 1/2/4/5 | validate/display original canonical UTC | W4 | Step 1 | N/A |
| Rule 11 | §6.1/8/11 | existing Web owner and PS authority | every §5 path | preserve existing routes/API/DB/SDK | W4/W6/W7 | Step 1 | PASS |

### 4.9 Time semantics and conversion contract

Time contract: Required

| Time ID | Fields/symbols | Semantics | Java/runtime type | Storage policy | Wire policy | Business zone source | Display zone source | Boundary / DST rules | Precision / Clock | Compatibility | Verification |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| TIME-001 | ProcessWorkerFailuresDTO.observedAt | Occurred instant | existing Instant, readonly TS string | Not persisted | UTC Z | Not applicable: no calendar calculation | explicit UTC in visible text and semantic time | real Gregorian four-digit year, canonical fraction, reject offset/local/impossible dates, no DST | retain original string and fractional precision, no client Clock | PS observation unchanged | Step 1 TEST-001/003, W4 |

## 5. Change File Tree

| Operation | Path | Current evidence/symbol | Final symbols/state | Responsibility | Step | Requirements | Validation owner |
| --- | --- | --- | --- | --- | --- | --- | --- |
| CREATE | `src/api/processWorkerFailures.test.ts` | cases.test transport precedent | finite Worker GET/decoder assertions | contract test | Step 1 | REQ-002/003/005 | R1/W4 |
| CREATE | `src/pages/WorkerFailuresPage.test.tsx` | CaseDetailPage.test fixtures | lookup, scope and display | page test | Step 1 | REQ-003/004 | R2/W4 |
| MODIFY | `src/App.test.tsx` | App test with real registry | route, role and manifest assertions | route test | Step 1 | REQ-001/005 | R3/W4 |
| CREATE | `src/api/processWorkerFailures.ts` | requestJson/C/CL | isProcessInstanceId and processWorkerFailuresApi.get | wire boundary | Step 1 | REQ-002/003 | W4 |
| CREATE | `src/pages/WorkerFailuresPage.tsx` | CaseDetail and auth frame | WorkerFailuresPage and local content | read-only UI | Step 1 | REQ-003/004 | W4 |
| MODIFY | `src/permissions/permissions.ts` | definePermissionReferences | two Process code refs | permission code references | Step 1 | REQ-001/005 | W4/W6 |
| MODIFY | `src/permissions/resources.ts` | existing page/menu conventions | Worker page/menu exact ALL | owned UI resources | Step 1 | REQ-001/005 | W4/W6 |
| MODIFY | `src/permissions/references.ts` | existing API CALLS list | existing Worker GET resource only | service ref | Step 1 | REQ-005 | W4/W6 |
| MODIFY | `src/permissions/messages.ts` | existing zh-CN/en-US labels | two exact labels | i18n | Step 1 | REQ-001/005 | W4/W6 |
| MODIFY | `src/App.tsx` | SessionRoutes/RequireResource/Shell | page route and menu | reachable current scope | Step 1 | REQ-001/005 | W4/W6 |
| CREATE | `docs/egon/spec/2026-11-05-18-03-worker-failure-console.md` | locked Review bytes | approved source contract | Spec | Step 1 | REQ-001–005 | W7 |
| CREATE | `docs/egon/plan/2026-11-05-18-15-worker-failure-console.md` | reviewed exact Plan | one Web step | Plan | Step 1 | REQ-001–005 | W7 |
| CREATE | `docs/egon/evidence/2026-11-05-worker-failure-console.md` | existing Web EVD | actual finite/artifact/scope proof | evidence | Step 1 | REQ-001–005 | W7 |

## 6. Prerequisites, Constraints, and Plan Clarifications

### 6.1 Repository and worktree baseline

Working root `/Users/mario/SelfProject/Stellar-Enclosure/tianji-web`. Record clean exact baseline and all tracked file hashes/index before source. Existing ignored dependency/artifact directories are not commit scope. Verify PS provider proof SHA-256 `d427d8e88f7bc1dc5ab52e01928a2d73c2003e61762e2e8ffb08a10173cb7dfc` at `/Users/mario/.codex/tmp/tianji-agent-upgrade-20261105/recovery/step60-artifacts/final-manifest.json`. This is immutable reference evidence, not permission rollout.

### 6.2 Build, test, and environment prerequisites

| Concern | Exact source | Required state | Validation boundary |
| --- | --- | --- | --- |
| Node/npm and React | existing node_modules/package-lock and Node 24.14.1 | no install/change required with current dependencies | jsdom, no browser or server |
| PaC tool | `/Users/mario/SelfProject/Stellar-Enclosure/web-sdk/scripts/permissions/prepare-contract.mjs` | official verifyToolchain matches SDK digest and lock | offline, no online activate/register |
| Validated local artifact | exact local Maven cache JAR and SHA in §8 | 5 exact canonical entries and only archive hash differs in validation lock | pinned off-repo evidence only |
| Current Worker contract | C ProcessWorkerFailureDTO, CL codec and packaged OAS, PS existing manifest | exact GET USER/all pair and owner semantics | no PS rerun or live call |

### 6.3 Immutable constraints and approved decisions

Existing APP policy, landing, permissions policy, PS recovery flags, SDK, gateway, transport and toolchain lock do not change. No credential, role, registration, activation or scope escalation is part of the task. Production/external runtime remains separately operated.

### 6.4 Plan Clarifications

| ID | Small implementation inference | Repository evidence | Why semantics are unchanged | Impact if wrong |
| --- | --- | --- | --- | --- |
| PLAN-CLAR-001 | Use one checked function for form and API, canonical shapes remain local | cases.ts and C exact fields | no new wire or utility dependency | review exact validator table |
| PLAN-CLAR-002 | Use the installed Jianshen archive c018a124… for the off-repo verification lock | exact five canonical entry digests match the tracked lock; sibling target artifact can be rewritten by concurrent builds | only validation envelope archive hash, no tracked lock change | stop artifact gate on any mismatch |
| PLAN-CLAR-003 | Keep test literals colocated and use existing App fixture/registry | current App.test.tsx and CaseDetailPage.test.tsx | no added fixture paths or actual grant | verify meaningful route assertion RED |

## 7. Ordered File-by-file Implementation Steps

### Step 1 — Read exact owned Worker failure observations in the existing Web console

- Requirements: Primary REQ-001, REQ-002, REQ-003, REQ-004, REQ-005. Predecessor REQ-006, REQ-007 verified as preserved boundaries only.
- Dependencies: approved review hashes, clean exact Web baseline, present contract artifact, old PAC baseline build and PS manifest proof.
- Baseline state: no Worker frontend route, panel, decoder or resource references. Existing exact PS GET and default-off dual permission provider unchanged.
- Observable outcome: existing console user with both current codes can query one exact ID and see validated closed facts or safe empty/error state, with no mutations.
- End state: thirteen exact TS/docs paths in one commit, verified local source and PAC, no runtime claims.
- Test-first gate: Required. A enables import resolution. R1 accepts foreign JSON when it should reject, R2 page lacks required form, R3 missing direct route and menu. Execute before any B.
- Manual Checks: MC-ARCH-001, MC-REUSE-001, MC-DEP-001, MC-VALID-001, MC-JSON-001, MC-TIME-001, MC-PATTERN-001, MC-SCOPE-001, MC-TEST-001, MC-BLOCKER-001.
- Literal Rules: Rule 11. The other original rules are assessed individually in §4.8 and scoped to the unchanged Java surface.
- Ordered files:

#### File 1 — `CREATE src/api/processWorkerFailures.test.ts`

- Purpose: Lock exact Worker GET and response acceptance.
- Symbols: rejects a foreign instance snapshot; exact path and shape fixtures.
- Repository evidence: cases.test.ts gatewayPath/fetch mock, C/CL constructor and codec.
- Dependencies and consumers: A API signature, shared requestJson and fetch; B same actual API.
- Why now: Produces R1 before decoder is written.
- Contract/signature changes: One file test fixtures using closed typed response shape and unknown negatives.
- Input/output and state mapping: Fetch captures exact encoded GET, tenant assertion, Cookie and AbortSignal; own snapshot resolves and foreign rejects.
- Error and edge behavior: Reject dot paths, malformed Unicode, noncanonical UTC, coercions, missing/extra fields, wrong affinity, cross-rules, bad order and >128. Current auth boundary handles 401/403/409.
- Standards impact: MC-VALID-001, MC-JSON-001, MC-TIME-001, MC-TEST-001.
- Literal rule enforcement: Rule 11 keeps current PS contract and existing gateway; no service tests or listener.
- Implementation pseudocode:

```ts
it('rejects a foreign instance snapshot', async () => {
  stub gateway fetch with HTTP 200 own shape, mismatched instanceId and empty failures
  await expect(processWorkerFailuresApi.get('20', 'process-1')).rejects.toThrow()
  expect(fetch).toHaveBeenCalledTimes(1)
})
B covers exact path and no body/auth header; canonical times, UTF-8 sorting and 128/129
B checks exact status/reason/outcome/expectedVersion combinations and auth transport events
```

- Verification contribution: R1 one assertion RED; W4 exact TEST-001 GREEN.
- After this file: A compile prerequisite is enough to show an actual foreign 200 currently accepted.

#### File 2 — `CREATE src/pages/WorkerFailuresPage.test.tsx`

- Purpose: Prove an explicit read-only lookup and stale reply boundaries.
- Symbols: renders only an explicit worker failure lookup; closed page/read frame cases.
- Repository evidence: CaseDetailPage.test.tsx fixtures, useAuth mock, Testing Library and async request controls.
- Dependencies and consumers: A page returns null; B real page, current API mocked or mocked fetch.
- Why now: Produces R2 before page state exists.
- Contract/signature changes: Default page with verified-frame mock, no new test setup.
- Input/output and state mapping: Valid form → one GET → explicit row/empty/error state. Edit/unmount, issuer/tenant/subject/epoch/resource change reset before late result.
- Error and edge behavior: No fetch without valid ID/permission. Unknown independent; old result, stale error, malformed body/404/503 cannot appear as an empty list.
- Standards impact: MC-VALID-001, MC-TIME-001, MC-SCOPE-001, MC-TEST-001.
- Literal rule enforcement: Rule 11 isolates UI under current auth and read adapter.
- Implementation pseudocode:

```ts
it('renders only an explicit worker failure lookup', () => {
  render(<WorkerFailuresPage />) with mock verified frame and allowed resource
  expect(processWorkerFailuresApi.get).not.toHaveBeenCalled()
  expect(screen.queryByRole('button', {name: '查询失败快照'})).toBeInTheDocument()
})
B resolve deferred reads after editing and frame revocation; no stale row or render
B assert UTC wire text, honest empty/UNKNOWN/error, no write button
```

- Verification contribution: R2 one missing-form RED; W4 TEST-003/004.
- After this file: Bounded page requirements execute against A without dependency/import failures.

#### File 3 — `MODIFY src/App.test.tsx`

- Purpose: Prove route/menu dual rights and no expanded APP/landing.
- Symbols: opens Worker failure observations only in the existing dual-permission console; metadata tests.
- Repository evidence: Existing open/auth fixtures with actual resourceRegistry and mocked siblings.
- Dependencies and consumers: Current App + A component imported only once real route is wired. Use literal code/keys before registry edits.
- Why now: Produces R3 before App and permissions edit.
- Contract/signature changes: Add colocated tests only, preserve existing tests.
- Input/output and state mapping: Mock eligible existing console session plus both Process codes; explicit navigation, page heading and expected link. Registry fixtures prove pair and existing APP scope.
- Error and edge behavior: Absent either code means deny/hide and no page mount. Pair alone does not qualify for APP. Manifest references GET only, both labels exact.
- Standards impact: MC-SCOPE-001, MC-TEST-001, MC-VALID-001.
- Literal rule enforcement: Rule 11 uses existing route guard and resource registry.
- Implementation pseudocode:

```ts
it('opens Worker failure observations only in the existing dual-permission console', async () => {
  open('/operations/worker-failures', ['TIANJI_TASK_READ', 'TIANJI_PROCESS_READ', 'TIANJI_PROCESS_WORKER_RECOVER'])
  expect(await screen.findByRole('heading', {name: 'Worker 失败观察'})).toBeInTheDocument()
  expect(screen.getByRole('link', {name: 'Worker 失败观察'})).toHaveAttribute('href', '/operations/worker-failures')
})
B use actual resourceRegistry to deny each single code and APP pair-only
B assert exact two resources and one API CALLS reference
```

- Verification contribution: R3 one missing route/page assertion RED; W4 TEST-002.
- After this file: Before wiring current route falls through without a fixture or module failure.

#### File 4 — `CREATE src/api/processWorkerFailures.ts`

- Purpose: Implement the only TS wire seam.
- Symbols: isProcessInstanceId, processWorkerFailuresApi.get, ProcessWorkerFailures and ProcessWorkerFailure.
- Repository evidence: cases.ts closed decoded validators; C ProcessWorkerFailureDTO; CL ProcessWorkerRecoveryResponseCodec.
- Dependencies and consumers: Existing requestJson, gateway and future page.
- Why now: A enables R1/R2. B follows all recorded RED gates and precedes page.
- Contract/signature changes: get(tenant: string, instanceId: string, signal?: AbortSignal): Promise<ProcessWorkerFailures>.
- Input/output and state mapping: Validate Java-compatible ID and encode once. Validate exact decoded keys/types/nullability/affinity, UTF-8 order, canonical UTC and all C relationships. Return readonly projected fields.
- Error and edge behavior: A forwards a valid-segment GET unchecked only for RED. B fixed errors, no JSON raw-parser guarantees or fallback. Shared auth errors propagate to page/context.
- Standards impact: MC-ARCH-001, MC-REUSE-001, MC-VALID-001, MC-JSON-001, MC-TIME-001.
- Literal rule enforcement: Rule 11 keeps current Web transport and authoritative PS boundary.
- Implementation pseudocode:

```ts
A export readonly types and get, return requestJson with only exact GET path and signal
B async get(tenant, instanceId, signal) {
  require isProcessInstanceId(instanceId) including dot/dotdot, trim/isBlank and UTF-16 rules
  const value = await requestJson<unknown>(exact prefix + encodeURIComponent(instanceId) + suffix, tenant, {method: 'GET', signal})
  require exact envelope, same instanceId, canonical UTC and <=128 real rows
  for each row validate closed shape + Java branch; compare encoded jobId strictly with previous
  return readonly-safe projection
}
```

- Verification contribution: R1 RED then W4 accepted/rejected transport; shared auth test.
- After this file: Only one validated GET consumer becomes available.

#### File 5 — `CREATE src/pages/WorkerFailuresPage.tsx`

- Purpose: Render the owner-local Worker observation.
- Symbols: default WorkerFailuresPage, same-frame local content and query state.
- Repository evidence: CaseDetailPage.tsx form/auth lifecycle, App.tsx and current AntD styles.
- Dependencies and consumers: Depends on B API. Consumer App exact route.
- Why now: A null stub before R2, B page after API checks.
- Contract/signature changes: Default function, no global state or feature configuration.
- Input/output and state mapping: Use verified context keyed by issuer/tenant/subject/epoch. Validate exact input; submit one read, clear prior state, only matching frame renders response.
- Error and edge behavior: Edit/unmount/permission loss abort and increment sequence. Fixed auth/404/503 states; unknown remains explicit. Do not display opaque expectedVersion or accept actions.
- Standards impact: MC-REUSE-001, MC-VALID-001, MC-TIME-001, MC-PATTERN-001, MC-TEST-001.
- Literal rule enforcement: Rule 11 uses existing React/AntD/AuthContext, no state or request framework.
- Implementation pseudocode:

```ts
A export default function WorkerFailuresPage() { return null }
B WorkerFailuresPage() {
  require authorization and allows('tianji.page.workerFailures')
  render local content keyed by verified issuer, tenantId, subject and requestEpoch
}
on input change clear result/error, increment sequence, abort request
on valid submit read once; check current sequence, signal, and resource before result/error
render current ID and <time dateTime={observedAt}>{observedAt} UTC</time>
show explicit unknown/failure labels and observed empty state; no action
on unmount abort and advance sequence
```

- Verification contribution: R2 then W4 TEST-003/004.
- After this file: Read-only page ready for manifest and route.

#### File 6 — `MODIFY src/permissions/permissions.ts`

- Purpose: Declare references to existing Process permission definitions.
- Symbols: PROCESS_READ, PROCESS_WORKER_RECOVER, permissions.
- Repository evidence: Existing definePermissionReferences with frontend-only ref list, PS manifest exact codes.
- Dependencies and consumers: Existing SDK scanner and resources.ts import both constants.
- Why now: Before resource declarations consume constants.
- Contract/signature changes: Two exported string literals and two appended reference codes.
- Input/output and state mapping: Retain all old code refs; add exactly existing TIANJI_PROCESS_READ and TIANJI_PROCESS_WORKER_RECOVER.
- Error and edge behavior: No new permission definition, code or grant, no Process scope mutation.
- Standards impact: MC-ARCH-001, MC-REUSE-001, MC-SCOPE-001.
- Literal rule enforcement: Rule 11 points at PS-owned definitions and preserves permission owner.
- Implementation pseudocode:

```ts
export const PROCESS_READ = 'TIANJI_PROCESS_READ' as const
export const PROCESS_WORKER_RECOVER = 'TIANJI_PROCESS_WORKER_RECOVER' as const
extend definePermissionReferences with both only, keeping old codes in their current order
verify generated permissionDefinitions equal baseline and no new permission owner
```

- Verification contribution: W4 registry plus W6 permission exact diff.
- After this file: Owned UI entries can reference actual code constants.

#### File 7 — `MODIFY src/permissions/resources.ts`

- Purpose: Declare the page/menu owned resource pair.
- Symbols: resources, tianji.page.workerFailures, tianji.menu.workerFailures.
- Repository evidence: Current Case PAGE/MENU and manifest owned prefixes.
- Dependencies and consumers: File 6 refs, existing resourceRegistry, App and build scanner.
- Why now: Before App wiring. Keep APP requirement old.
- Contract/signature changes: Add exactly two `defineResources` entries for same route.
- Input/output and state mapping: PAGE target route, MENU same route parent tianji.app.console; exact ALL dual Process code and matching label keys.
- Error and edge behavior: No BUTTON, APP changes, menu auto-authorization or inferred backend policy.
- Standards impact: MC-ARCH-001, MC-SCOPE-001, MC-VALID-001.
- Literal rule enforcement: Rule 11 keeps existing Web resource syntax and source authority.
- Implementation pseudocode:

```ts
const route = '/operations/worker-failures' // use literal route in scanner declarations
add PAGE tianji.page.workerFailures, exact route, ALL [PROCESS_READ, PROCESS_WORKER_RECOVER]
add MENU tianji.menu.workerFailures, same route, parentKey 'tianji.app.console', same ALL
associate tianji.web.permissions / page.workerFailures and menu.workerFailures
preserve old APP and all existing entries
```

- Verification contribution: W4 resource gate test and W6 exact generated resources.
- After this file: App can bind both existing registry resource keys.

#### File 8 — `MODIFY src/permissions/references.ts`

- Purpose: Reference the verified PS read contract.
- Symbols: references, tianji.api.process.instance.worker-failures.
- Repository evidence: defineResourceReferences and PS bundled manifest producer scope.
- Dependencies and consumers: Current backend manifest resource; PAC build reads Web CALLS list.
- Why now: After principal/code association is fixed.
- Contract/signature changes: One new exact CALLS reference.
- Input/output and state mapping: GET key attached to existing PS resource, no server path/method mapping duplicated in permissions config.
- Error and edge behavior: No recoveries/cancellations or new backend resource key. Packaged PS implicit HEAD not emitted as a TS request.
- Standards impact: MC-REUSE-001, MC-SCOPE-001, MC-TEST-001.
- Literal rule enforcement: Rule 11 declares an existing producer boundary.
- Implementation pseudocode:

```ts
defineResourceReferences([...baselineRefs,
  {key: 'tianji.api.process.instance.worker-failures', usage: 'CALLS'}])
compare final reference set to baseline plus exact one pair
prove the referenced protected PS resource has exact GET/HEAD, dual codes and scopes
```

- Verification contribution: W4 App reference assertions and W6 producer diff.
- After this file: Official scanner has one new existing GET reference.

#### File 9 — `MODIFY src/permissions/messages.ts`

- Purpose: Add localized page and menu metadata.
- Symbols: messages, page.workerFailures, menu.workerFailures.
- Repository evidence: Existing defineMessages same namespace and locales.
- Dependencies and consumers: File 7 label keys, PAC scanner and manifest.
- Why now: Before official build validates labels.
- Contract/signature changes: Two labels under tianji.web.permissions.
- Input/output and state mapping: Each label zh-CN `Worker 失败观察`, en-US `Worker failure observations`, defaultLocale zh-CN.
- Error and edge behavior: Do not change other labels/locale policy.
- Standards impact: MC-REUSE-001, MC-SCOPE-001, MC-TEST-001.
- Literal rule enforcement: Rule 11 preserves current localization entrypoint and owner.
- Implementation pseudocode:

```ts
for each of page.workerFailures and menu.workerFailures declare tianji.web.permissions label
set defaultLocale 'zh-CN' and defaults {'zh-CN': 'Worker 失败观察', 'en-US': 'Worker failure observations'}
require both generated label objects and all preexisting labels to match
leave component's local status wording in WorkerFailuresPage
```

- Verification contribution: W4 labels and W6 messages diff.
- After this file: Both new resources have exact localized metadata.

#### File 10 — `MODIFY src/App.tsx`

- Purpose: Connect one protected Worker route and menu.
- Symbols: SessionRoutes, RequireResource, Shell, WorkerFailuresPage.
- Repository evidence: Existing /cases lookup under Shell and current APP/landing.
- Dependencies and consumers: B page and three metadata files plus current resourceRegistry.
- Why now: Complete safe user entry after page and metadata exist.
- Contract/signature changes: Add route and menu only, existing Shell/landing unchanged.
- Input/output and state mapping: Read route guard tianji.page.workerFailures; link rendered when tianji.menu.workerFailures allowed, existing path conventions.
- Error and edge behavior: No route-level ID, grant check approximation, extra shell bootstrap, or public fallback.
- Standards impact: MC-ARCH-001, MC-REUSE-001, MC-VALID-001, MC-SCOPE-001.
- Literal rule enforcement: Rule 11 uses current route/guard/layout without another application layer.
- Implementation pseudocode:

```ts
import WorkerFailuresPage from './pages/WorkerFailuresPage'
in SessionRoutes add literal '/operations/worker-failures' under Shell
render <RequireResource resource="tianji.page.workerFailures"><WorkerFailuresPage /></RequireResource>
in Shell add menu with key workerFailures, label Worker 失败观察, existing icon package and path/prefix
do not alter existing landing or top-level session behavior
```

- Verification contribution: R3 missing route then W4 full route and PAC W6.
- After this file: Eligible user entry is connected, ready for all finite checks.

#### File 11 — `CREATE docs/egon/spec/2026-11-05-18-03-worker-failure-console.md`

- Purpose: Persist exact reviewed implementation authority.
- Symbols: Current reviewed Spec, REQ-001–005.
- Repository evidence: Reviewed off-repo bytes and T3-11 Web Spec convention.
- Dependencies and consumers: Root review and exact SHA; used by Plan and evidence links.
- Why now: Off-repo review locks authority before source. Create the canonical file here before final review.
- Contract/signature changes: Documentation only, exact named file.
- Input/output and state mapping: Canonical Doc metadata/relative links. No normative edits during this Step.
- Error and edge behavior: Mismatch or missing contract relation blocks Step. Do not silently update approved bytes.
- Standards impact: MC-SCOPE-001, MC-BLOCKER-001.
- Literal rule enforcement: Rule 11 documentation locks the Web-only architecture.
- Implementation pseudocode:

```text
assert source Spec SHA equals the locked revision at the top of this Plan
create canonical Web Spec from exact reviewed bytes and verify relative predecessor links
strictly validate the Spec in its canonical repo layout before scope/commit review
```

- Verification contribution: W7 exact authority and strict validation.
- After this file: The final reviewed design has one canonical Web target.

#### File 12 — `CREATE docs/egon/plan/2026-11-05-18-15-worker-failure-console.md`

- Purpose: Persist exact reviewed ordered file plan.
- Symbols: One Step, 13 paths and W1–W7 gates.
- Repository evidence: Existing task-case-approval-web Plan and this reviewed canonical Plan.
- Dependencies and consumers: Final Spec path/approval and Root read review.
- Why now: Off-repo review locks this Plan before source. Create the canonical file with the reviewed Spec here.
- Contract/signature changes: Documentation only.
- Input/output and state mapping: Exact Plan bytes, intended order, rollback and verification contract.
- Error and edge behavior: Do not accept new behavior or wider scope by editing the Plan in source stage.
- Standards impact: MC-SCOPE-001, MC-TEST-001, MC-BLOCKER-001.
- Literal rule enforcement: Rule 11 documents existing frontend and PS authority.
- Implementation pseudocode:

```text
verify the reviewed Plan SHA and exact Web predecessor before creating the canonical file
copy exact Plan at its locked name and validate both relative Spec and upstream authority links
use final Section 7 path list to compare staged paths and block any unexpected file
```

- Verification contribution: W7 Plan strict and reviewed source scope.
- After this file: One canonical reviewed Plan links to the intended Spec.

#### File 13 — `CREATE docs/egon/evidence/2026-11-05-worker-failure-console.md`

- Purpose: Record actual source and static evidence, not deployment.
- Symbols: R1–R3, W4–W7, exact artifact metadata and runtime status.
- Repository evidence: Current Web task/case source evidence convention.
- Dependencies and consumers: Actual focused reports, full suite, PAC build/diff, strict docs and root verification.
- Why now: After finite and static checks, before exact commit.
- Contract/signature changes: Documentation only.
- Input/output and state mapping: Record actual selector/count/exit, baseline/Spec/Plan hash, official lock and artifact proof, path audit and explicit runtime boundary.
- Error and edge behavior: Do not record anticipated gates as passed. Missing/skipped tests, unsafe grants or wrong artifact stop commit.
- Standards impact: MC-SCOPE-001, MC-TEST-001, MC-BLOCKER-001.
- Literal rule enforcement: Rule 11 records actual Web-only verified scope and separate owners.
- Implementation pseudocode:

```text
record the three intended assertion failures and subsequent focused/full green counts from actual reports
include both generated manifest digests, existing PS resource proof, scope and exact validation-lock hash
record user-operated S10/S11/E and browser/gateway/IAM runtime as pending without claiming deployment
```

- Verification contribution: W7 final conformance and reviewable evidence.
- After this file: Complete only after exact staged paths and all actual gates pass.

- Validation working directory: `/Users/mario/SelfProject/Stellar-Enclosure/tianji-web`.
- Verification command: §8 W1, R1–R3, W4–W7 in that order. W1 starts at clean baseline. B follows all three assertion REDs.
- Expected result: W1 exact old artifact, R1–R3 each one failed assertion with no unrelated error. W4/W5 tests 0 failed/skipped. W6 official static build and exact manifest delta. W7 strict review and thirteen staged paths.
- Failure returns to: Files 1–3 for fixture or expectation defects, Files 4–10 for behavior/manifest failures, §6 for digest/tooling mismatch. Scope or authority drift returns to review.
- Completion criteria: All intended gates have actual evidence; excluded tracked paths and lock byte-identical; no pending source behavior.
- Rollback: Before commit only revert owned incomplete paths under Root's control. After commit use one Web path-limited revert, preserving user changes and any service/runtime state.
- Commit paths: `src/api/processWorkerFailures.test.ts`, `src/pages/WorkerFailuresPage.test.tsx`, `src/App.test.tsx`, `src/api/processWorkerFailures.ts`, `src/pages/WorkerFailuresPage.tsx`, `src/permissions/permissions.ts`, `src/permissions/resources.ts`, `src/permissions/references.ts`, `src/permissions/messages.ts`, `src/App.tsx`, `docs/egon/spec/2026-11-05-18-03-worker-failure-console.md`, `docs/egon/plan/2026-11-05-18-15-worker-failure-console.md`, `docs/egon/evidence/2026-11-05-worker-failure-console.md`.
- Commit: `feat(web): observe owned process worker failures`.

## 8. Test, Validation, and Quality Gates

Transport clarification from current Web source: use existing `requestJson` and exact body checks. Do not invent HTTP-success status visibility or bypass existing path protection. The established provider status contract remains 200; malformed/empty success and non-success cases fail safely.


### W1 — Baseline and validation-only PAC lock

Run from the Web repository with the current pinned dependency install. This is static verification. No dev/preview server or browser. Record logs in the fresh outside-repo proof directory. The exported variables below remain in scope for W6. Existing reports/generations may be overwritten by the official build, so preserve the W1 bytes before W6.

```bash
set -euo pipefail
test "$(git rev-parse HEAD)" = f558e02c8d07da2da758c5273a5eb531ca251018
test -z "$(git status --porcelain)"
test "$(node --version)" = v24.14.1
test -d node_modules
test -d /Users/mario/SelfProject/Stellar-Enclosure/web-sdk/node_modules
export PAC_SDK_DIR=/Users/mario/SelfProject/Stellar-Enclosure/web-sdk
export TIANJI_WORKER_PROOF_DIR="$(mktemp -d /Users/mario/.codex/tmp/tianji-agent-upgrade-20261105/t4-04/web-proof.XXXXXX)"
git ls-tree -r HEAD > "$TIANJI_WORKER_PROOF_DIR/web-baseline-git-tree.txt"
export PAC_TOOLCHAIN_LOCK="$TIANJI_WORKER_PROOF_DIR/validation-toolchain.lock.json"
export PAC_CONTRACT_ARTIFACT="$TIANJI_WORKER_PROOF_DIR/verified-jianshen-contract.jar"
source_jar=/Users/mario/maven/repository/top/egon/stellar-enclosure-tianquan-jianshen-contract/0.0.1/stellar-enclosure-tianquan-jianshen-contract-0.0.1.jar
cp "$source_jar" "$PAC_CONTRACT_ARTIFACT"
node --input-type=module - <<'NODE'
import assert from 'node:assert/strict'
import {pathToFileURL} from 'node:url'
const {createToolchainLock, verifyToolchain} = await import(pathToFileURL(
  process.env.PAC_SDK_DIR + '/scripts/permissions/prepare-contract.mjs'))
const archive = 'c018a124bce8ee97c8403367f83802dc56fd1cea7bfe04fd68b24b051abeb9c6'
const old = await verifyToolchain('./permission-toolchain.local.lock.json')
assert.equal(old.contract.sha256, '2077ebbb0e5aa9d35bb1350c869fc7e38879f5d476b649a754094da230ac7b18')
await createToolchainLock({artifact: process.env.PAC_CONTRACT_ARTIFACT, artifactSha256: archive,
  output: process.env.PAC_TOOLCHAIN_LOCK, mode: 'LOCAL_UNCOMMITTED'})
const next = await verifyToolchain(process.env.PAC_TOOLCHAIN_LOCK)
assert.deepEqual(next, {...old, contract: {...old.contract, sha256: archive}})
NODE
npm run build 2>&1 | tee "$TIANJI_WORKER_PROOF_DIR/w1-baseline-build.log"
cp .generated/permissions/manifest-v1.json "$TIANJI_WORKER_PROOF_DIR/baseline-manifest.json"
cp dist/permission-build.json "$TIANJI_WORKER_PROOF_DIR/baseline-embedded.json"
cp .generated/permissions/artifact-record.json "$TIANJI_WORKER_PROOF_DIR/baseline-artifact.json"
test -z "$(git status --porcelain)"
```

The archive comparison is all-five-entry exact, SDK/dependency/Node unchanged, archive SHA explicit. Whole archive mismatch, missing archive, official validation failure or scope mismatch blocks the gate. Do not overwrite/re-pin the tracked lock, alter SDK or use live registration. The toolchain prepares entries under the external lock's directory.

### R1–R3 — Genuine test-first assertion RED

After writing Files 1–3 and A stubs in Files 4–5, App and the permission sources must still match baseline. Record each separate nonzero exit with exactly one executing test and the expected assertion. Filtered unrelated tests are out of scope for the named RED; report the complete W4/W5 execution separately. A fixture error never counts.

```bash
red() {
  local gate=$1 file=$2 title=$3 status=0
  npm test -- "$file" -t "$title" > "$TIANJI_WORKER_PROOF_DIR/$gate.log" 2>&1 || status=$?
  test "$status" -eq 1
}
red r1 src/api/processWorkerFailures.test.ts 'rejects a foreign instance snapshot$'
red r2 src/pages/WorkerFailuresPage.test.tsx 'renders only an explicit worker failure lookup$'
red r3 src/App.test.tsx 'opens Worker failure observations only in the existing dual-permission console$'
```

### W4–W5 — Focused and full regression

```bash
npm test -- src/api/processWorkerFailures.test.ts src/pages/WorkerFailuresPage.test.tsx src/App.test.tsx src/auth/AuthContext.test.tsx
npm run typecheck
npm run lint
npm test
```

Each focused owning file must run and have zero failures or intentional skips. Record actual counts, exit codes and stable existing diagnostics. Full suite provides regression on runs/Memory/Task/Case, shared auth and the expense wire fixture.

### W6 — Official static build and exact PAC increment

Use the same env and verified archive as W1. Build validates the source manifest, TS, Vite and embedded proof. No production catalog registration, grant, activation or deployment.

```bash
npm run build 2>&1 | tee "$TIANJI_WORKER_PROOF_DIR/w6-final-build.log"
cp .generated/permissions/manifest-v1.json "$TIANJI_WORKER_PROOF_DIR/final-manifest.json"
cp dist/permission-build.json "$TIANJI_WORKER_PROOF_DIR/final-embedded.json"
cp .generated/permissions/artifact-record.json "$TIANJI_WORKER_PROOF_DIR/final-artifact.json"
export TIANJI_WORKER_PS_MANIFEST=/Users/mario/.codex/tmp/tianji-agent-upgrade-20261105/recovery/step60-artifacts/final-manifest.json
node --input-type=module - <<'NODE'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {pathToFileURL} from 'node:url'
const {canonicalJson, compareManifests, manifestDigests, sha256} = await import(pathToFileURL(
  process.env.PAC_SDK_DIR + '/scripts/permissions/canonicalize.mjs'))
const proof = process.env.TIANJI_WORKER_PROOF_DIR
const read = async file => JSON.parse(await readFile(file, 'utf8'))
const old = await read(proof + '/baseline-manifest.json')
const next = await read(proof + '/final-manifest.json')
const pair = ['TIANJI_PROCESS_READ', 'TIANJI_PROCESS_WORKER_RECOVER']
const keys = ['tianji.menu.workerFailures', 'tianji.page.workerFailures']
const key = 'tianji.api.process.instance.worker-failures'
const route = '/operations/worker-failures'
const delta = compareManifests(old, next)
const just = added => ({added, changed: [], removed: []})
assert.deepEqual(delta.resources, just(keys))
assert.deepEqual(delta.permissions, just([]))
assert.deepEqual(delta.messages, just(['tianji.web.permissions/menu.workerFailures', 'tianji.web.permissions/page.workerFailures']))
assert.deepEqual(next.producer, old.producer)
assert.deepEqual(next.application, old.application)
assert.deepEqual([...next.permissionReferences].sort(), [...old.permissionReferences, ...pair].sort())
assert.deepEqual(next.resourceReferences.map(canonicalJson).sort(),
  [...old.resourceReferences, {key, usage: 'CALLS'}].map(canonicalJson).sort())
for (const [i, newKey] of keys.entries()) {
  const value = next.resources.find(resource => resource.key === newKey)
  assert.deepEqual(value.requirement, {mode: 'ALL', codes: pair})
  assert.deepEqual(value.allowedPrincipals, ['USER'])
  assert.equal(value.type, i === 0 ? 'MENU' : 'PAGE')
  assert.deepEqual(value.target, i === 0 ? {route, parentKey: 'tianji.app.console'} : {route})
  const label = next.messages.find(message => message.pageCode === 'tianji.web.permissions'
    && message.key === value.i18n.labelKey)
  assert.equal(label.defaultLocale, 'zh-CN')
  assert.deepEqual(label.defaults, {'zh-CN': 'Worker 失败观察', 'en-US': 'Worker failure observations'})
}
const psBytes = await readFile(process.env.TIANJI_WORKER_PS_MANIFEST)
assert.equal(sha256(psBytes), 'd427d8e88f7bc1dc5ab52e01928a2d73c2003e61762e2e8ffb08a10173cb7dfc')
const ps = JSON.parse(psBytes)
const api = ps.resources.find(resource => resource.key === key)
assert.equal(api.type, 'API')
assert.equal(api.access, 'PROTECTED')
assert.deepEqual(api.target.methods, ['GET', 'HEAD'])
assert.deepEqual(api.target.paths, ['/api/tianji/v1/process-instances/{instanceId}/worker-failures'])
assert.deepEqual(api.allowedPrincipals, ['SERVICE', 'USER'])
assert.deepEqual(api.requirement, {mode: 'ALL', codes: pair})
assert.deepEqual(api.oauthScopes, ['tianji:process:read', 'tianji:process:worker-recover'])
for (const [name, manifest] of [['baseline', old], ['final', next]]) {
  const embedded = await read(proof + '/' + name + '-embedded.json')
  const artifact = await read(proof + '/' + name + '-artifact.json')
  const recomputed = manifestDigests(manifest)
  for (const field of ['manifestDigest', 'policyDigest', 'metadataDigest']) {
    assert.equal(embedded[field], recomputed[field])
    assert.equal(artifact[field], recomputed[field])
  }
  assert.equal(embedded.mode, 'LOCAL_UNCOMMITTED')
  assert.equal(artifact.status, 'BUILT')
  assert.equal(artifact.artifactDigest.length, 64)
  assert.equal(artifact.buildEvidenceDigest, embedded.buildEvidenceDigest)
  assert.equal(embedded.contractSha256, 'c018a124bce8ee97c8403367f83802dc56fd1cea7bfe04fd68b24b051abeb9c6')
}
NODE
```

### W7 — Docs, source scope and commit audit

Create the canonical reviewed Spec and Plan from the locked bytes, then evidence with actual results. Use the existing strict scripts. Freeze all source paths with the exact list and hash/excluded-scope audit. Do not stage ignored artifacts.

```bash
spec=docs/egon/spec/2026-11-05-18-03-worker-failure-console.md
plan=docs/egon/plan/2026-11-05-18-15-worker-failure-console.md
evd=docs/egon/evidence/2026-11-05-worker-failure-console.md
python3 ../.agents/skills/stellar-enclosure-coding-writing-spec/scripts/validate_spec.py --strict "$spec"
python3 ../.agents/skills/stellar-enclosure-coding-writing-plan/scripts/validate_plan.py --strict "$plan"
git add -- src/api/processWorkerFailures.test.ts src/pages/WorkerFailuresPage.test.tsx src/App.test.tsx \
  src/api/processWorkerFailures.ts src/pages/WorkerFailuresPage.tsx src/permissions/permissions.ts \
  src/permissions/resources.ts src/permissions/references.ts src/permissions/messages.ts src/App.tsx \
  "$spec" "$plan" "$evd"
git diff --cached --check
git ls-tree -r HEAD | cmp - "$TIANJI_WORKER_PROOF_DIR/web-baseline-git-tree.txt"
git diff --cached --name-only | LC_ALL=C sort
git diff --exit-code
test -z "$(git ls-files --others --exclude-standard)"
git diff --cached --exit-code -- permission-toolchain.local.lock.json package.json package-lock.json
```

Confirm the printed sorted list exactly equals §5 and that source changes in existing files match their per-file scope. Compare baseline and final Git tracked identities/hashes for excluded paths. Read the final diff, run strict checks, then one commit. Reconfirm commit parent, exact paths, and clean status. Capture final commit SHA in handoff outside staged evidence when necessary. No commands start an application, connect to live services, open a browser, or operate catalog/grants.

## 9. Migration, Compatibility, Rollout, and Rollback

Existing Process GET and C/CL/PS source are reused with their existing owner and current permission checks. No DB migration, framework change, gate enablement or roles. Git rollback is a Web commit revert only. Source verification does not prove gateway, IAM, provider flags, escaped path handling, PG/Flowable, browser or S10/S11/T3-12 E.

## 10. Requirement-to-Step Traceability Matrix

| Requirement | Effective Spec section | Steps | Files | Tests/gates | Completion evidence |
| --- | --- | --- | --- | --- | --- |
| REQ-001 | §4/12.1 | Step 1 | 3, 6, 7, 9, 10 | R3, W4, W6 | both codes, same APP/landing, protected page and menu |
| REQ-002 | §4/9/10 | Step 1 | 1, 4 | R1, W4 | single exact GET and exact owner-affine decode |
| REQ-003 | §4/10/12.4 | Step 1 | 1, 2, 4, 5 | R1/R2, W4 | canonical UTC, known/unknown, observed empty and failures |
| REQ-004 | §4/7.3/12.3 | Step 1 | 2, 5, 10 | R2, W4/W5 | current frame, abort and denial regression |
| REQ-005 | §14/16 | Step 1 | 1–13 | W1, W4–W7 | official local build, exact delta and safe live boundary |
| REQ-006 | Worker predecessor §4/9/11, preserved | Step 1 | none in backend | W6/W7 | already delivered C/CL/PS wire and V10 history are existing dependencies, no Web change to them |
| REQ-007 | Worker predecessor §4/14/16, preserved | Step 1 | 13 evidence only | W7 | preceding finite source proof distinct from live PG, engine, IAM, S10/S11, E |

## 11. Risks, Blockers, and User Decisions

| ID | Risk or decision | Impacted Steps/files | Evidence | Owner | Status/action |
| --- | --- | --- | --- | --- | --- |
| DEC-001 | Existing console plus both current PS grants, GET only | Step 1 | Spec §5 and Root review | Root | approved for Plan design |
| DEC-002 | Validation-only off-repo lock and unchanged tracked lock | W1/W6 | exact existing SDK path and five identical JAR entries | Root | approved for Plan design |
| RISK-001 | Browser/gateway route and current rights may be unavailable in the user's environment | Page and actual deployment | PS feature default off, existing gateway auth | Operator | independent runtime gate, source remains usable and fail closed |
| RISK-002 | Installed verified contract archive or SDK pin may drift | W1/W6 | exact hashes and official verification | Root | block build if bytes differ, keep tracked lock |
| RISK-003 | Overread of RETRY_AVAILABLE or no rows | File 5 | Spec status/outcome separation | Root | no action/control, truthful copy and tests |

No pending design decision prevents review of this exact source slice. Actual execution requires the finalized reviewed locks.

## 12. Review and Acceptance

### 12.1 Original requirement fidelity

One existing owner query for known ID, honest uncertain and unavailable facts and bounded scope. Both permission codes and current shell maintained. No backend/grant or action addition.

### 12.2 Spec consistency

Follows approved Web scope, exact console routes and fields, current dual IAM, read-only operation, and off-repo toolchain lock. Existing Java/HTTP authority unchanged. All five primary requirements covered.

### 12.3 Repository executability

One repository-local Step with initial clean baseline, genuine A/RED and B/green. Existing Node/npm scripts and official SDK for all normal validation. Inline checks use standard Node and Git; no added permanent script, package, or lock.

### 12.4 Test and release completeness

W1 immutable artifact proof, R1–R3 assertion RED, W4–W5 finite green, W6 actual local PAC output, W7 exact diff. Evidence keeps finite and runtime meanings separate.

### 12.5 Blocking Manual Check

| Check ID | Applicability | Status | Evidence | Finding | Required action/exception |
| --- | --- | --- | --- | --- | --- |
| MC-ARCH-001 | Applicable | PASS | §4.7/§5 | existing Web and untouched Java owner | None |
| MC-REUSE-001 | Applicable | PASS | §4.7 and Files 4/5/10 | exact reused transport/auth/layout | None |
| MC-DEP-001 | Applicable | PASS | W1/W6/W7 | no dependency or tracked lock change | None |
| MC-NAME-001 | Not applicable | N/A | §5 TS/docs | no Java types | None |
| MC-VALID-001 | Applicable | PASS | R1/W4 and Files 4/5 | closed browser checks plus existing owner | None |
| MC-MODEL-001 | Not applicable | N/A | File 4 TS mirror | no Java object design | None |
| MC-CONVERT-001 | Not applicable | N/A | §5/§9 | no Java conversion or mapper | None |
| MC-LOG-001 | Not applicable | N/A | §5 Files 4/5 | no Java log or new browser diagnostic | None |
| MC-BEAN-001 | Not applicable | N/A | §5 | no Spring Bean/wiring | None |
| MC-UTIL-001 | Not applicable | N/A | §4.7 Files 4/5 | current TS/DOM built-ins | None |
| MC-JSON-001 | Applicable | PASS | File 1 and W4 | unchanged wire and precise decoded checks | None |
| MC-TIME-001 | Applicable | PASS | TIME-001, Files 1/2/4/5 | canonical raw UTC, no new clock/storage | None |
| MC-CONFIG-001 | Not applicable | N/A | §6 and W7 | profiles, flags, config and tracked lock unchanged | None |
| MC-PATTERN-001 | Applicable | PASS | §4.5/4.7 File 5 | simple direct local read lifecycle | None |
| MC-SCOPE-001 | Applicable | PASS | §5, W6/W7 | exact source/artifact scope | None |
| MC-TEST-001 | Applicable | PASS | §8 and §10 | objective finite gates, implementation evidence pending | None |
| MC-BLOCKER-001 | Applicable | PASS | §11, §12.5 | no remaining design blocker for review | None |

### 12.6 Final verdict

PASS — Ready for user review

Review verdict applies to this Plan. Actual implementation verification and independently operated runtime acceptance remain pending.
