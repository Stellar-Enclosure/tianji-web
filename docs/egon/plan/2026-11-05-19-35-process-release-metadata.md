# 天机流程发布元数据实施计划

| Field | Value |
| --- | --- |
| Document | `2026-11-05-19-35-process-release-metadata.md` |
| Template Version | `5` |
| Status | `Review` |
| Created | `2026-11-05 19:35 Asia/Shanghai` |
| Updated | `2026-11-05 19:35 Asia/Shanghai` |
| Owner | 天机平台决策人、Root |
| Repository | `tianji-web` |
| Scope | T4-04B 单 Web 提交，已知版本只读元数据 |
| Source Requirement | [整体蓝图](../../../../docs/plans/agent-framework-upgrade-plan.md) `§19 T4-04` 与 REQ-001–005 |
| Baseline Revision | `tianji-web e5d14225abacd4766aa21f9b59ce2364cd23bb3b` clean，现有 PS `6fcd76be629680d8cd8863537a4c31adc2506952` |
| Implements Spec | [流程发布元数据](../spec/2026-11-05-19-29-process-release-metadata.md) |
| Spec Status | `Review` |
| Spec Revision | `2026-11-05 19:32 Asia/Shanghai` SHA-256 `754044118453a94eb5a940bbd8eedf08a20f9c27869259b9482af333de07f0df` |
| Effective Specs | [主 Spec](../spec/2026-11-05-19-29-process-release-metadata.md)，[整体蓝图](../../../../docs/plans/agent-framework-upgrade-plan.md) `§19 T4-04` |
| Depends On Plans | `None` |
| Supersedes | `None` |
| Superseded By | `None` |
| Related Plans | [既有 Worker Web](2026-11-05-18-15-worker-failure-console.md) |

## 1. Summary

在现有 Web Shell 增加一个显式版本查询，读取 existing PS release GET，显示当前发布元数据。真实三处 assertion RED、有限 GREEN、静态 PaC 证明一个源提交。实际 EDGE 路由、部署和权限独立验收。

## 2. Target Spec and Effective Design

### 2.1 Primary target

Root 批准 existing GET/authority 的 source-only 范围，且不修改 Gateway/IdP/权限 policy。Spec、Plan 保持 Review，执行前锁定确切最终文件和当前 Git。

### 2.2 Effective Spec set

| Role | Spec/link | Status/revision | Effective sections | Why included |
| --- | --- | --- | --- | --- |
| Primary | [流程发布元数据](../spec/2026-11-05-19-29-process-release-metadata.md) | Review, exact hash | §3–§20 | only five current requirements |
| Roadmap | [整体蓝图](../../../../docs/plans/agent-framework-upgrade-plan.md) | current | §19 T4-04 | one source slice |
| Existing context | current PS C/CL/authority and Worker Web | existing committed | exact release contract, existing App/AuthContext | preserve current policy |

### 2.3 Superseded or excluded content

No supersession. Comparison, directory, activation, writes, XML, control, backend, gateway, IdP, IAM/PaC policy, packages, dependencies and real runtime all outside scope.

## 3. Effective Requirements and Acceptance

| Requirement | Source Spec section | Effective statement | Observable acceptance | Implementation impact |
| --- | --- | --- | --- | --- |
| REQ-001 | §4/12 | existing console and exact release READ | same APP/landing, exact page/menu grant | App/PAC |
| REQ-002 | §9/10 | one exact GET | no body and exact identity/affinity/shape | API |
| REQ-003 | §10/12 | existing metadata only | digest/model/input/UTC, no action | page |
| REQ-004 | §7/12 | current identity and local abort | stale row/error discarded | page |
| REQ-005 | §14/16 | finite/static, live separate | exact Web scope/official artifacts | docs/gates |

## 4. Implementation Strategy and Dependency Order

### 4.1 Ordered strategy

One Web commit. Baseline PaC static first. Write three tests and two compiling A declarations. Record one intended assertion per named RED. B closes exact consumer, page, permission and App wiring. Final finite/build/diff evidence.

### 4.2 Test-first strategy

R1 foreign valid-looking body resolves under A thin GET. R2 null page has no form. R3 existing App falls through unknown path. Module/fixture/setup errors never count as RED. Complete assertions before B.

### 4.3 Sequential and parallel boundaries

| Step | Depends on | May run in parallel with | Must not overlap with | Reason |
| --- | --- | --- | --- | --- |
| Step 1 | approved hashes and clean baseline | read-only PS/EDGE and off-repo proofs | shared Web edits/build | same App and registry |

### 4.4 Commit boundaries

Exactly 13 Web paths including three canonical docs. One cohesive Step. No stage of SDK, EDGE, PS, generated output or tracked lock.

### 4.5 Spec Simplicity and Implementation-necessity Audit

| Spec element | Spec necessity verdict/section | Current repository evidence | Direct/reuse alternative | Interaction/implementation cost | Plan decision |
| --- | --- | --- | --- | --- | --- |
| current GET/authority | Keep §7 | PS/C/CL | direct | one read | Already exists |
| closed TS reader | Add §10 | requestJson and Worker decoder | raw cast lacks safe checks | one module | Implement |
| one page and menu | Add §12 | existing Shell/Worker | distinct resource | local state only | Implement |
| comparison/list/controls | Remove §17 | exact GET | single current query | none | Excluded |

### 4.6 Change-unit Dependency Matrix

| Change unit | Requirements | Proof/RED point | Compile/runtime prerequisites | Produces | Consumers/unblocks | Owning Step |
| --- | --- | --- | --- | --- | --- | --- |
| existing wire | REQ-002/003 | R1 | A consumer/types | strict validated response | page | Step 1 |
| view | REQ-003/004 | R2 | A page/API | scoped read-only state | App | Step 1 |
| route | REQ-001/005 | R3 | current registry | one guarded entry and exact PaC | shell/artifact | Step 1 |
| final proof | REQ-001–005 | W4–W7 | source green | finite/package/commit evidence | review | Step 1 |

### 4.7 Java, Spring, and Egon-COLA Implementation Standards

N/A Java source. Current React/TS boundary and unchanged PS/EDGE. Reuse requestJson, existing Shell/page layout, current identity, registry and official build. No dependency or helper framework.

| Concern | Current repository evidence | Effective Spec decision | Planned implementation consequence | Owning Steps/checks |
| --- | --- | --- | --- | --- |
| profile | current Web App/api/pages | same owner | only listed TS and docs | Step 1 MC-ARCH-001 |
| reuse | existing SDK/AuthContext/layout | direct reuse | one local read | Step 1 MC-REUSE-001 |
| validation | actual C DTO and current TS patterns | strict decoded source | fixed affinity/input schema/UTC | Step 1 MC-VALID-001 |

#### Capability reuse ledger

| Need | Candidates inspected | Exact evidence | Fit/gap | Decision | Added dependency/custom code | Owning Step/check |
| --- | --- | --- | --- | --- | --- | --- |
| current auth and transport | Web AuthContext and requestJson | verified frame and Cookie tenant | fits | reuse | none | Step 1 MC-REUSE-001 |
| finite page | current Worker page and AntD | one known-ID lookup | different source data | local read-only component | no dependency | Step 1 MC-ARCH-001 |
| wire proof | actual C/CL and default Jackson3 | exact known release DTO | TS reader missing | exact consumer and tests | no dependency | Step 1 MC-VALID-001 |
| PaC | official Web build and Step78 proof | matching archived lock and canonical entries | fits | reuse copied lock outside Git | no tracked change | Step 1 MC-DEP-001 |

### 4.8 User-mandated Java Rule Implementation Matrix

| Literal rule | Spec source | Repository evidence | Exact files and order | Pseudocode obligations | Validation gate | Steps | Status/blocker |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Rule 1 | §6.2 | no Java | §5 | semantic TS | W4 | Step 1 | N/A |
| Rule 2 | §6.2 | existing C/PS | 1/4/5 | exact browser validation | W4 | Step 1 | N/A |
| Rule 3 | §6.2 | immutable C | 4 | readonly TS only | W4 | Step 1 | N/A |
| Rule 4 | §6.2 | no Java | §5 | no log/Bean | W7 | Step 1 | N/A |
| Rule 5 | §6.2 | TS/DOM | 4/5 | current APIs only | W7 | Step 1 | N/A |
| Rule 6 | §6.2 | no wire change | 1/4 | exact decoded wire | W4 | Step 1 | N/A |
| Rule 7 | §6.2 | no profiles | §5 | config/lock unchanged | W7 | Step 1 | N/A |
| Rule 9 | §6.2 | simple read | 5 | direct sequence/abort | W4 | Step 1 | N/A |
| Rule 10 | §6.3 | C Instant | 1/4/5 | explicit UTC exact string | W4 | Step 1 | N/A |
| Rule 11 | §6.1/8 | existing Web | all | preserve current authority and structure | W6/W7 | Step 1 | PASS |

### 4.9 Time semantics and conversion contract

Time contract: Required

| Time ID | Fields/symbols | Semantics | Java/runtime type | Storage policy | Wire policy | Business zone source | Display zone source | Boundary / DST rules | Precision / Clock | Compatibility | Verification |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| TIME-001 | ProcessReleaseDTO.createdAt | Occurred instant | Instant, TS string | Not persisted | UTC Z | Not applicable: no business calendar | explicit UTC | strict Gregorian time, no DST/local conversion | retain exact fraction and no wall clock | current native wire unchanged | Step 1 TEST-001, TEST-003 |

## 5. Change File Tree

| Operation | Path | Current evidence/symbol | Final symbols/state | Responsibility | Step | Requirements | Validation owner |
| --- | --- | --- | --- | --- | --- | --- | --- |
| CREATE | `src/api/processReleases.test.ts` | existing processWorkerFailures.test.ts/C DTO | rejects a different release version | exact GET and DTO assertion | Step 1 | REQ-001–005 | R1/W4 |
| CREATE | `src/pages/DefinitionReleasePage.test.tsx` | existing WorkerFailuresPage.test.tsx | renders an explicit release lookup | explicit read and scope UI | Step 1 | REQ-001–005 | R2/W4 |
| MODIFY | `src/App.test.tsx` | current App registry/Worker tests | opens release metadata with the existing release read permission | exact route and existing app boundary | Step 1 | REQ-001–005 | R3/W4 |
| CREATE | `src/api/processReleases.ts` | requestJson, C ProcessReleaseDTO/ModelDTO and pure wire probe | isProcessReleaseVersion, processReleasesApi.get, ProcessRelease and ProcessReleaseModel | sole typed consumer | Step 1 | REQ-001–005 | R1/W4 |
| CREATE | `src/pages/DefinitionReleasePage.tsx` | WorkerFailuresPage, current AuthContext, AntD | DefinitionReleasePage and its local lookup component | display existing metadata in current frame | Step 1 | REQ-001–005 | R2/W4 |
| MODIFY | `src/permissions/permissions.ts` | definePermissionReferences and PS producer code | PROCESS_RELEASE_READ | reference existing release read | Step 1 | REQ-001–005 | W4/W6 |
| MODIFY | `src/permissions/resources.ts` | existing Worker PAGE/MENU and APP | tianji.page.processReleases, tianji.menu.processReleases | declare existing owner UI resources | Step 1 | REQ-001–005 | W4/W6 |
| MODIFY | `src/permissions/references.ts` | existing defineResourceReferences and producer manifest | tianji.api.process.release.get | reference exact existing read route | Step 1 | REQ-001–005 | W4/W6 |
| MODIFY | `src/permissions/messages.ts` | existing defineMessages two locales | page.processReleases and menu.processReleases | localized release page/menu labels | Step 1 | REQ-001–005 | W4/W6 |
| MODIFY | `src/App.tsx` | current App, Worker route and nav | SessionRoutes and Shell | connect exact authorized route/menu | Step 1 | REQ-001–005 | R3/W4/W6 |
| CREATE | `docs/egon/spec/2026-11-05-19-29-process-release-metadata.md` | reviewed locked bytes | REQ-001–005 and scope | persist exact reviewed authority | Step 1 | REQ-001–005 | W7 |
| CREATE | `docs/egon/plan/2026-11-05-19-35-process-release-metadata.md` | current EGON Plan | R1–W7 and path inventory | persist one exact reviewed step | Step 1 | REQ-001–005 | W7 |
| CREATE | `docs/egon/evidence/2026-11-05-process-release-metadata.md` | current Web evidence convention | actual RED, GREEN, PaC and scope | record actual finite and static proof | Step 1 | REQ-001–005 | W7 |

## 6. Prerequisites, Constraints, and Plan Clarifications

### 6.1 Repository and worktree baseline

Existing Web e5d1422 clean. Existing PS GET and package manifest authority available. Current tracked EDGE profiles lack Tianji forwarding. Owner separately operates actual runtime.

### 6.2 Build, test, and environment prerequisites

Use existing Node 24.14.1 and node_modules. Reuse verified Step78 off-repo lock/JAR after hashing and copy to a fresh proof path. Preserve all repository toolchain files.

### 6.3 Immutable constraints and approved decisions

One GET only, one requested version, existing APP + release read, no route/grant/role/config or BFF changes.

### 6.4 Plan Clarifications

| ID | Small implementation inference | Repository evidence | Why semantics unchanged | Impact if wrong |
| --- | --- | --- | --- | --- |
| PLAN-CLAR-001 | exact TS closed values and own entries | C OrchestrationChecks and pure pinned wire probe | consumer only | fail closed |
| PLAN-CLAR-002 | reuse Step78 verified archive/lock in fresh directory | official current build supports explicit override | no tracked lock change | stop if hash mismatch |

## 7. Ordered File-by-file Implementation Steps

### Step 1 — Show metadata for one authorized Process release

- Requirements: REQ-001, REQ-002, REQ-003, REQ-004, REQ-005.
- Dependencies: clean Web baseline and exact reviewed Spec/Plan, current PS contract, verified SDK archive.
- Baseline state: Worker views available, no Process release page or GET consumer.
- Observable outcome: current existing console release-read user can submit one exact version and see bounded metadata through already configured authority.
- End state: thirteen Web files, one source commit, live deployment separate.
- Test-first gate: Required R1 typed foreign response, R2 null page, R3 old route.
- Manual Checks: MC-ARCH-001, MC-REUSE-001, MC-DEP-001, MC-VALID-001, MC-JSON-001, MC-TIME-001, MC-PATTERN-001, MC-SCOPE-001, MC-TEST-001, MC-BLOCKER-001.
- Literal Rules: Rule 11. Other original rules reviewed individually in §4.8.
- Ordered files:

#### File 1 — `CREATE src/api/processReleases.test.ts`

- Purpose: exact GET and DTO assertion
- Symbols: rejects a different release version
- Repository evidence: existing processWorkerFailures.test.ts/C DTO
- Dependencies and consumers: A API and mocked fetch
- Why now: Establish the focused behavior assertion before B.
- Contract/signature changes: rejects a different release version
- Input/output and state mapping: Foreign response 200 with different releaseVersion should reject; assert exact one request; B adds known version, type/key, native ID leak, schema count/type, UTC and wrong body.
- Error and edge behavior: Reject unknown, foreign, malformed or stale evidence with no side effects.
- Standards impact: MC-VALID-001, MC-JSON-001, MC-TIME-001, MC-TEST-001.
- Literal rule enforcement: Rule 11. Preserve existing Web structure and unchanged current PS/EDGE authority.
- Implementation pseudocode:

```ts
mock successful 200 for another exact releaseVersion using valid digest, UTC and one model;
await expect(processReleasesApi.get('20', 'release-1')).rejects.toThrow();
B record exact GET, no body, tenant, cache and signal; assert strict field, pair, cap and prototype-key negatives.
```

- Verification contribution: R1/W4 establishes exact GET and DTO assertion.
- After this file: The owning assertion is ready for its compile-safe RED and final green.

#### File 2 — `CREATE src/pages/DefinitionReleasePage.test.tsx`

- Purpose: explicit read and scope UI
- Symbols: renders an explicit release lookup
- Repository evidence: existing WorkerFailuresPage.test.tsx
- Dependencies and consumers: A null page, B current mocked auth/API
- Why now: Establish the focused behavior assertion before B.
- Contract/signature changes: renders an explicit release lookup
- Input/output and state mapping: No request on mount; query button absent in A. B tests visible fields, stale, safe errors and no actions.
- Error and edge behavior: Reject unknown, foreign, malformed or stale evidence with no side effects.
- Standards impact: MC-VALID-001, MC-JSON-001, MC-TIME-001, MC-TEST-001.
- Literal rule enforcement: Rule 11. Preserve existing Web structure and unchanged current PS/EDGE authority.
- Implementation pseudocode:

```ts
render with a verified frame and approved page resource;
expect(processReleasesApi.get).not.toHaveBeenCalled();
expect(screen.queryByRole('button', {name:'查询发布'})).toBeInTheDocument();
B use pending promise, change version/frame, resolve late and assert no stale data.
```

- Verification contribution: R2/W4 establishes explicit read and scope UI.
- After this file: The owning assertion is ready for its compile-safe RED and final green.

#### File 3 — `MODIFY src/App.test.tsx`

- Purpose: exact route and existing app boundary
- Symbols: opens release metadata with the existing release read permission
- Repository evidence: current App registry/Worker tests
- Dependencies and consumers: A page stub with mocked heading
- Why now: Establish the focused behavior assertion before B.
- Contract/signature changes: opens release metadata with the existing release read permission
- Input/output and state mapping: Existing console+release code allows exact URL. Missing release denies. Pair-only APP unchanged. Sole GET reference/labels and old landing.
- Error and edge behavior: Reject unknown, foreign, malformed or stale evidence with no side effects.
- Standards impact: MC-VALID-001, MC-JSON-001, MC-TIME-001, MC-TEST-001.
- Literal rule enforcement: Rule 11. Preserve existing Web structure and unchanged current PS/EDGE authority.
- Implementation pseudocode:

```ts
open('/operations/process-releases', ['TIANJI_TASK_READ','TIANJI_PROCESS_RELEASE_READ']);
expect(await screen.findByRole('heading', {name:'流程发布元数据'})).toBeInTheDocument();
B check existing registry rejects code alone for APP, denies route without release code, and adds exact PAGE/MENU/GET metadata.
```

- Verification contribution: R3/W4 establishes exact route and existing app boundary.
- After this file: The owning assertion is ready for its compile-safe RED and final green.

#### File 4 — `CREATE src/api/processReleases.ts`

- Purpose: sole typed consumer
- Symbols: isProcessReleaseVersion, processReleasesApi.get, ProcessRelease and ProcessReleaseModel
- Repository evidence: requestJson, C ProcessReleaseDTO/ModelDTO and pure wire probe
- Dependencies and consumers: A pass-through then B closed decoder
- Why now: Complete this owner file after the prerequisite REDs and before its consumer.
- Contract/signature changes: isProcessReleaseVersion, processReleasesApi.get, ProcessRelease and ProcessReleaseModel
- Input/output and state mapping: Readonly DTO exact keys, ID/hash/UTC, 1..16 unique type/key, input schema 0..16 with exact C reserved names. Unknown/mismatched response fixed unavailable.
- Error and edge behavior: Reject unknown, foreign, malformed or stale evidence with no side effects.
- Standards impact: MC-VALID-001, MC-JSON-001, MC-TIME-001, MC-TEST-001.
- Literal rule enforcement: Rule 11. Preserve existing Web structure and unchanged current PS/EDGE authority.
- Implementation pseudocode:

```ts
A return typed unchecked requestJson for the exact GET with no-store;
B validate exact releaseVersion and make one encoded GET with current tenant and signal;
check closed envelope and exact requested version; each model exact type/definition/hash and own validated inputs;
deduplicate pair, preserve server model order and use Object.fromEntries to preserve legal '__proto__'.
```

- Verification contribution: R1/W4 establishes sole typed consumer.
- After this file: The exact owner change is ready for its listed caller and finite gate.

#### File 5 — `CREATE src/pages/DefinitionReleasePage.tsx`

- Purpose: display existing metadata in current frame
- Symbols: DefinitionReleasePage and its local lookup component
- Repository evidence: WorkerFailuresPage, current AuthContext, AntD
- Dependencies and consumers: A null declaration then real reader
- Why now: Complete this owner file after the prerequisite REDs and before its consumer.
- Contract/signature changes: DefinitionReleasePage and its local lookup component
- Input/output and state mapping: Same auth frame and sequence, one exact release form, UTC/digests/models/inputs, safe state. No controls.
- Error and edge behavior: Reject unknown, foreign, malformed or stale evidence with no side effects.
- Standards impact: MC-VALID-001, MC-JSON-001, MC-TIME-001, MC-TEST-001.
- Literal rule enforcement: Rule 11. Preserve existing Web structure and unchanged current PS/EDGE authority.
- Implementation pseudocode:

```ts
A return null.
B require current authorization and allows('tianji.page.processReleases'); key child by full issuer/tenant/subject/epoch;
on valid deliberate submit clear data, create one request, apply only current result;
on edit/revoke/unmount abort and clear; display scope-safe error, original UTC time and readonly model/input table.
```

- Verification contribution: R2/W4 establishes display existing metadata in current frame.
- After this file: The exact owner change is ready for its listed caller and finite gate.

#### File 6 — `MODIFY src/permissions/permissions.ts`

- Purpose: reference existing release read
- Symbols: PROCESS_RELEASE_READ
- Repository evidence: definePermissionReferences and PS producer code
- Dependencies and consumers: resources and scan
- Why now: Complete this owner file after the prerequisite REDs and before its consumer.
- Contract/signature changes: PROCESS_RELEASE_READ
- Input/output and state mapping: One existing code only. No definition or grant.
- Error and edge behavior: Keep prior ownership and metadata; reject scope drift before staging.
- Standards impact: MC-REUSE-001, MC-SCOPE-001, MC-TEST-001.
- Literal rule enforcement: Rule 11. Preserve existing Web structure and unchanged current PS/EDGE authority.
- Implementation pseudocode:

```ts
export const PROCESS_RELEASE_READ = 'TIANJI_PROCESS_RELEASE_READ' as const;
add this exact existing value to current permission references without changing order of old values;
confirm official generated permissionDefinitions remain identical to the baseline.
```

- Verification contribution: W4/W6 establishes reference existing release read.
- After this file: The exact owner change is ready for its listed caller and finite gate.

#### File 7 — `MODIFY src/permissions/resources.ts`

- Purpose: declare existing owner UI resources
- Symbols: tianji.page.processReleases, tianji.menu.processReleases
- Repository evidence: existing Worker PAGE/MENU and APP
- Dependencies and consumers: App and official scanner
- Why now: Complete this owner file after the prerequisite REDs and before its consumer.
- Contract/signature changes: tianji.page.processReleases, tianji.menu.processReleases
- Input/output and state mapping: Both exact route, ALL release READ, menu parent existing APP, only exact labels.
- Error and edge behavior: Keep prior ownership and metadata; reject scope drift before staging.
- Standards impact: MC-REUSE-001, MC-SCOPE-001, MC-TEST-001.
- Literal rule enforcement: Rule 11. Preserve existing Web structure and unchanged current PS/EDGE authority.
- Implementation pseudocode:

```ts
add PAGE and MENU for literal '/operations/process-releases';
set ALL [PROCESS_RELEASE_READ] for both, and menu parentKey 'tianji.app.console';
assign 'page.processReleases' and 'menu.processReleases' under existing labels; preserve the APP gate.
```

- Verification contribution: W4/W6 establishes declare existing owner UI resources.
- After this file: The exact owner change is ready for its listed caller and finite gate.

#### File 8 — `MODIFY src/permissions/references.ts`

- Purpose: reference exact existing read route
- Symbols: tianji.api.process.release.get
- Repository evidence: existing defineResourceReferences and producer manifest
- Dependencies and consumers: official build
- Why now: Complete this owner file after the prerequisite REDs and before its consumer.
- Contract/signature changes: tianji.api.process.release.get
- Input/output and state mapping: One CALLS addition, no write or authority.
- Error and edge behavior: Keep prior ownership and metadata; reject scope drift before staging.
- Standards impact: MC-REUSE-001, MC-SCOPE-001, MC-TEST-001.
- Literal rule enforcement: Rule 11. Preserve existing Web structure and unchanged current PS/EDGE authority.
- Implementation pseudocode:

```ts
append {key:'tianji.api.process.release.get', usage:'CALLS'} only;
compare generated refs to all previous refs plus this exact pair;
match exact GET provider metadata from the independently retained Process manifest.
```

- Verification contribution: W4/W6 establishes reference exact existing read route.
- After this file: The exact owner change is ready for its listed caller and finite gate.

#### File 9 — `MODIFY src/permissions/messages.ts`

- Purpose: localized release page/menu labels
- Symbols: page.processReleases and menu.processReleases
- Repository evidence: existing defineMessages two locales
- Dependencies and consumers: resources and scan
- Why now: Complete this owner file after the prerequisite REDs and before its consumer.
- Contract/signature changes: page.processReleases and menu.processReleases
- Input/output and state mapping: Two existing pageCode labels, default zh-CN. Others unchanged.
- Error and edge behavior: Keep prior ownership and metadata; reject scope drift before staging.
- Standards impact: MC-REUSE-001, MC-SCOPE-001, MC-TEST-001.
- Literal rule enforcement: Rule 11. Preserve existing Web structure and unchanged current PS/EDGE authority.
- Implementation pseudocode:

```ts
add the two exact keys under 'tianji.web.permissions';
use zh-CN '流程发布元数据' and en-US 'Process release metadata' with zh-CN default;
ensure only these two labels are added to packaged Web permission metadata.
```

- Verification contribution: W4/W6 establishes localized release page/menu labels.
- After this file: The exact owner change is ready for its listed caller and finite gate.

#### File 10 — `MODIFY src/App.tsx`

- Purpose: connect exact authorized route/menu
- Symbols: SessionRoutes and Shell
- Repository evidence: current App, Worker route and nav
- Dependencies and consumers: B page and metadata
- Why now: Complete this owner file after the prerequisite REDs and before its consumer.
- Contract/signature changes: SessionRoutes and Shell
- Input/output and state mapping: Add route under RequireResource and menu when resource allows. Keep APP, landing and existing route definitions.
- Error and edge behavior: Keep prior ownership and metadata; reject scope drift before staging.
- Standards impact: MC-REUSE-001, MC-SCOPE-001, MC-TEST-001.
- Literal rule enforcement: Rule 11. Preserve existing Web structure and unchanged current PS/EDGE authority.
- Implementation pseudocode:

```ts
import DefinitionReleasePage from './pages/DefinitionReleasePage';
add '/operations/process-releases' under existing Shell, using the exact page resource;
add conditional same-path menu under current navigation and preserve all old branches;
do not change existing APP admission or default landing priorities.
```

- Verification contribution: R3/W4/W6 establishes connect exact authorized route/menu.
- After this file: The exact owner change is ready for its listed caller and finite gate.

#### File 11 — `CREATE docs/egon/spec/2026-11-05-19-29-process-release-metadata.md`

- Purpose: persist exact reviewed authority
- Symbols: REQ-001–005 and scope
- Repository evidence: reviewed locked bytes
- Dependencies and consumers: Plan and evidence
- Why now: Preserve actual review and verification in the one source step.
- Contract/signature changes: REQ-001–005 and scope
- Input/output and state mapping: Copy exact bytes, no policy extension.
- Error and edge behavior: Keep prior ownership and metadata; reject scope drift before staging.
- Standards impact: MC-REUSE-001, MC-SCOPE-001, MC-TEST-001.
- Literal rule enforcement: Rule 11. Preserve existing Web structure and unchanged current PS/EDGE authority.
- Implementation pseudocode:

```text
validate the reviewed primary Spec hash at its canonical Web path;
verify its roadmap/Worker and existing authority relations with the strict validator;
preserve source-only boundary and exact release-read scope.
```

- Verification contribution: W7 establishes persist exact reviewed authority.
- After this file: The canonical evidence is available for final exact review.

#### File 12 — `CREATE docs/egon/plan/2026-11-05-19-35-process-release-metadata.md`

- Purpose: persist one exact reviewed step
- Symbols: R1–W7 and path inventory
- Repository evidence: current EGON Plan
- Dependencies and consumers: primary Spec and actual evidence
- Why now: Preserve actual review and verification in the one source step.
- Contract/signature changes: R1–W7 and path inventory
- Input/output and state mapping: Copy exact reviewed Plan, no mutable scope.
- Error and edge behavior: Keep prior ownership and metadata; reject scope drift before staging.
- Standards impact: MC-REUSE-001, MC-SCOPE-001, MC-TEST-001.
- Literal rule enforcement: Rule 11. Preserve existing Web structure and unchanged current PS/EDGE authority.
- Implementation pseudocode:

```text
copy the Root-reviewed exact Plan bytes to its canonical repository file;
run strict validation for both linked documents and compare staged paths to section 5;
reject any additional runtime, config, lock, authority or generated files.
```

- Verification contribution: W7 establishes persist one exact reviewed step.
- After this file: The canonical evidence is available for final exact review.

#### File 13 — `CREATE docs/egon/evidence/2026-11-05-process-release-metadata.md`

- Purpose: record actual finite and static proof
- Symbols: actual RED, GREEN, PaC and scope
- Repository evidence: current Web evidence convention
- Dependencies and consumers: fresh real reports and hashes
- Why now: Preserve actual review and verification in the one source step.
- Contract/signature changes: actual RED, GREEN, PaC and scope
- Input/output and state mapping: Only actual result counts, independent runtime availability.
- Error and edge behavior: Keep prior ownership and metadata; reject scope drift before staging.
- Standards impact: MC-REUSE-001, MC-SCOPE-001, MC-TEST-001.
- Literal rule enforcement: Rule 11. Preserve existing Web structure and unchanged current PS/EDGE authority.
- Implementation pseudocode:

```text
record actual three intended RED causes and focused/full GREEN results;
record archived official manifests, exact local lock and unchanged source authorities;
mark real EDGE alias/route, IAM, deployment and browser acceptance as independently pending.
```

- Verification contribution: W7 establishes record actual finite and static proof.
- After this file: The canonical evidence is available for final exact review.

- Validation working directory: `/Users/mario/SelfProject/Stellar-Enclosure/tianji-web`.
- Verification command: §8 W1, R1–R3, W4–W7 in order.
- Expected result: exact previous artifact, three independent real assertion failures, focused/full GREEN and exact static permission delta.
- Failure returns to: owner file or earlier RED. Scope, artifact or deployment drift returns to review.
- Completion criteria: actual finite and build evidence with exact thirteen files. No live deployment claim.
- Rollback: focused Web-only revert, no state changes.
- Commit paths: `src/api/processReleases.test.ts`, `src/pages/DefinitionReleasePage.test.tsx`, `src/App.test.tsx`, `src/api/processReleases.ts`, `src/pages/DefinitionReleasePage.tsx`, `src/permissions/permissions.ts`, `src/permissions/resources.ts`, `src/permissions/references.ts`, `src/permissions/messages.ts`, `src/App.tsx`, `docs/egon/spec/2026-11-05-19-29-process-release-metadata.md`, `docs/egon/plan/2026-11-05-19-35-process-release-metadata.md`, `docs/egon/evidence/2026-11-05-process-release-metadata.md`.
- Commit: `feat(tianji-web): inspect published Process release metadata`.

## 8. Test, Validation, and Quality Gates

W1 uses a fresh private proof directory. Reuse exact validated archive bytes, and never overwrite prior T4-04A evidence. Snapshot Web clean Git tree and compare again before staging.

```bash
set -euo pipefail
test "$(git rev-parse HEAD)" = e5d14225abacd4766aa21f9b59ce2364cd23bb3b
test -z "$(git status --porcelain)"
test "$(node --version)" = v24.14.1
previous=/Users/mario/.codex/tmp/tianji-agent-upgrade-20261105/t4-04/web-proof.xwBHUy
export RELEASE_WEB_PROOF="$(mktemp -d /Users/mario/.codex/tmp/tianji-agent-upgrade-20261105/t4-04/release-slice/proof.XXXXXX)"
export PAC_SDK_DIR=/Users/mario/SelfProject/Stellar-Enclosure/web-sdk
export PAC_TOOLCHAIN_LOCK="$RELEASE_WEB_PROOF/validation-toolchain.lock.json"
export PAC_CONTRACT_ARTIFACT="$RELEASE_WEB_PROOF/verified-jianshen-contract.jar"
cp "$previous/validation-toolchain.lock.json" "$PAC_TOOLCHAIN_LOCK"
cp "$previous/verified-jianshen-contract.jar" "$PAC_CONTRACT_ARTIFACT"
test "$(shasum -a 256 "$PAC_TOOLCHAIN_LOCK" | cut -d ' ' -f 1)" = 412e244be1a5e2e538983c448bf776523862580597f26add366fd91d73c38548
test "$(shasum -a 256 "$PAC_CONTRACT_ARTIFACT" | cut -d ' ' -f 1)" = c018a124bce8ee97c8403367f83802dc56fd1cea7bfe04fd68b24b051abeb9c6
git ls-tree -r HEAD > "$RELEASE_WEB_PROOF/baseline-tree"
npm run build 2>&1 | tee "$RELEASE_WEB_PROOF/w1-build.log"
cp .generated/permissions/manifest-v1.json "$RELEASE_WEB_PROOF/baseline-manifest.json"
test -z "$(git status --porcelain)"
```

Official build validates SDK, lock and all five canonical contract entries. If the artifact is unavailable or stale, stop the static gate and retain the current tracked lock.

After writing tests and exact A signatures, run R1–R3 separately. Each selector must execute one test and fail for the expected assertion, with no import/setup error.

```bash
npm test -- src/api/processReleases.test.ts -t 'rejects a different release version$'
npm test -- src/pages/DefinitionReleasePage.test.tsx -t 'renders an explicit release lookup$'
npm test -- src/App.test.tsx -t 'opens release metadata with the existing release read permission$'
```

W4/W5 after B:

```bash
npm test -- src/api/processReleases.test.ts src/pages/DefinitionReleasePage.test.tsx src/App.test.tsx src/auth/AuthContext.test.tsx src/pages/WorkerFailuresPage.test.tsx
npm run typecheck
npm run lint
npm test
```

W6 rerun official build with the same fresh proof env, archive outputs and confirm exact metadata against baseline and Step82 PS packaged producer authority.

```bash
npm run build 2>&1 | tee "$RELEASE_WEB_PROOF/w6-build.log"
cp .generated/permissions/manifest-v1.json "$RELEASE_WEB_PROOF/final-manifest.json"
cp dist/permission-build.json "$RELEASE_WEB_PROOF/final-embedded.json"
cp .generated/permissions/artifact-record.json "$RELEASE_WEB_PROOF/final-artifact.json"
export RELEASE_PS_MANIFEST=/Users/mario/.codex/tmp/tianji-agent-upgrade-20261105/t4-01/step82-process-manifest.json
node --input-type=module - <<'NODE'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {pathToFileURL} from 'node:url'
const {canonicalJson, compareManifests, manifestDigests, sha256} = await import(
  pathToFileURL(process.env.PAC_SDK_DIR + '/scripts/permissions/canonicalize.mjs'))
const dir = process.env.RELEASE_WEB_PROOF
const read = async name => JSON.parse(await readFile(dir + '/' + name))
const base = await read('baseline-manifest.json')
const current = await read('final-manifest.json')
const route = '/operations/process-releases'
const keys = ['tianji.menu.processReleases','tianji.page.processReleases']
const codes = ['TIANJI_PROCESS_RELEASE_READ']
const ref = 'tianji.api.process.release.get'
const delta = compareManifests(base,current)
const added = values => ({added:values,removed:[],changed:[]})
assert.deepEqual(delta.resources,added(keys))
assert.deepEqual(delta.permissions,added([]))
assert.deepEqual(delta.messages,added(['tianji.web.permissions/menu.processReleases','tianji.web.permissions/page.processReleases']))
assert.deepEqual(current.producer,base.producer)
assert.deepEqual(current.application,base.application)
assert.deepEqual([...current.permissionReferences].sort(),[...base.permissionReferences,...codes].sort())
assert.deepEqual(current.resourceReferences.map(canonicalJson).sort(),[...base.resourceReferences,{key:ref,usage:'CALLS'}].map(canonicalJson).sort())
for (const key of keys) {
  const resource = current.resources.find(value => value.key === key)
  assert.deepEqual(resource.requirement,{mode:'ALL',codes})
  assert.deepEqual(resource.allowedPrincipals,['USER'])
  assert.equal(resource.target.route,route)
  assert.equal(resource.type,key.includes('.menu.') ? 'MENU' : 'PAGE')
  assert.deepEqual(resource.target,key.includes('.menu.') ? {route,parentKey:'tianji.app.console'} : {route})
  const label = current.messages.find(item => item.pageCode === resource.i18n.pageCode && item.key === resource.i18n.labelKey)
  assert.deepEqual(label.defaults,{'zh-CN':'流程发布元数据','en-US':'Process release metadata'})
}
const psBytes = await readFile(process.env.RELEASE_PS_MANIFEST)
assert.equal(sha256(psBytes),'a6e8dc9a9edece682dbcf04b0584aa09dd1337b78f953bb5bfaa86b38c0fb4e9')
const ps = JSON.parse(psBytes).resources.find(item => item.key === ref)
assert.equal(ps.access,'PROTECTED')
assert.deepEqual(ps.allowedPrincipals,['SERVICE','USER'])
assert.deepEqual(ps.requirement,{mode:'ALL',codes})
assert.deepEqual(ps.oauthScopes,['tianji:process:release:read'])
assert.deepEqual(ps.target.methods,['GET','HEAD'])
assert.deepEqual(ps.target.paths,['/api/tianji/v1/process-releases/{releaseVersion}'])
const embedded = await read('final-embedded.json')
const artifact = await read('final-artifact.json')
const digests = manifestDigests(current)
for (const field of ['manifestDigest','policyDigest','metadataDigest']) {
  assert.equal(embedded[field],digests[field])
  assert.equal(artifact[field],digests[field])
}
assert.equal(artifact.status,'BUILT')
assert.equal(embedded.mode,'LOCAL_UNCOMMITTED')
assert.equal(embedded.buildEvidenceDigest,artifact.buildEvidenceDigest)
NODE
```

W7 strict Spec/Plan in canonical paths, exact stage, full Git diff check, original Git tree, no other tracked or untracked changes, then one approved commit. Live EDGE route, issuer, audience, access and browser testing are separate. Use existing docs validators and official checks, no new scratch script file in Git.

## 9. Migration, Compatibility, Rollout, and Rollback

No schema, role, gateway route, config or server contract change. Roll back one Web commit. Existing Worker and task behavior stays. Source approval does not activate live EDGE. An operator must independently verify existing deployment routing/authority, no source modification here.

## 10. Requirement-to-Step Traceability Matrix

| Requirement | Effective Spec section | Steps | Files | Tests/gates | Completion evidence |
| --- | --- | --- | --- | --- | --- |
| REQ-001 | §4/12 | Step 1 | 3,6,7,9,10 | R3/W4/W6 | exact one grant, old APP |
| REQ-002 | §9/10 | Step 1 | 1/4 | R1/W4 | one exact wire request |
| REQ-003 | §10/12 | Step 1 | 1/2/4/5 | R1/R2/W4 | safe metadata/UTC |
| REQ-004 | §7/12 | Step 1 | 2/5 | R2/W4/W5 | abort/frame |
| REQ-005 | §14/16 | Step 1 | 1–13 | W1/W6/W7 | finite/static scope and live pending |

## 11. Risks, Blockers, and User Decisions

| ID | Risk or decision | Impacted Steps/files | Evidence | Owner | Status/action |
| --- | --- | --- | --- | --- | --- |
| DEC-001 | source-only with current authority | Step 1 | Root authorization | Root | exact review |
| RISK-001 | actual EDGE deployment absent/unproved | live only | tracked profile audit | Operator | no route or grant changes |
| RISK-002 | cached verification bytes drift | W1/W6 | exact pinned hashes | Root | stop static build |

## 12. Review and Acceptance

### 12.1 Original requirement fidelity

Only current release metadata and one exact read. No compare, controls, authority or runtime change.

### 12.2 Spec consistency

Exact DTO, current code, same APP and verified frame. One Web owner, paired test gates.

### 12.3 Repository executability

Exact file order, tests and reusable local artifacts. No server/runtime steps.

### 12.4 Test and release completeness

Three genuine REDs, finite green, official static build and exact source scope. Existing owner deployment remains independent.

### 12.5 Blocking Manual Check

| Check ID | Applicability | Status | Evidence | Finding | Required action/exception |
| --- | --- | --- | --- | --- | --- |
| MC-ARCH-001 | Applicable | PASS | §4/5 | current Web | None |
| MC-REUSE-001 | Applicable | PASS | Files 4/5/10 | current auth/transport/layout | None |
| MC-DEP-001 | Applicable | PASS | W1/W6 | no dependencies/lock | None |
| MC-NAME-001 | Not applicable | N/A | §5 | no Java | None |
| MC-VALID-001 | Applicable | PASS | R1/W4 | exact input/body | None |
| MC-MODEL-001 | Not applicable | N/A | File 4 | no Java model | None |
| MC-CONVERT-001 | Not applicable | N/A | §5 | no Java converter | None |
| MC-LOG-001 | Not applicable | N/A | Files 4/5 | no logs | None |
| MC-BEAN-001 | Not applicable | N/A | §5 | no Java Bean | None |
| MC-UTIL-001 | Not applicable | N/A | §4 | current TS | None |
| MC-JSON-001 | Applicable | PASS | R1/W4 | exact existing wire | None |
| MC-TIME-001 | Applicable | PASS | TIME-001 | raw UTC | None |
| MC-CONFIG-001 | Not applicable | N/A | §5 | no config | None |
| MC-PATTERN-001 | Applicable | PASS | Files 4/5 | direct read | None |
| MC-SCOPE-001 | Applicable | PASS | §5/7/W7 | 13 exact paths | None |
| MC-TEST-001 | Applicable | PASS | §8/10 | finite/static boundaries | None |
| MC-BLOCKER-001 | Applicable | PASS | §11 | source review ready | None |

### 12.6 Final verdict

PASS — Ready for user review

Source gates and real deployment are not yet executed.
