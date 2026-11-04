# 天机任务、审批与案件前端实施计划

| Field | Value |
| --- | --- |
| Document | `2026-11-04-23-14-task-case-approval-web.md` |
| Template Version | `5` |
| Status | `Review` |
| Created | `2026-11-04 23:14 Asia/Shanghai` |
| Updated | `2026-11-04 23:26 Asia/Shanghai` |
| Owner | Root 已全文审阅并批准主Spec设计；原用户整体目标继续授权；Plan尚待Root审阅 |
| Repository | `tianji-web` |
| Scope | 仅T3-11 frontend，三个串行语义Step/commit |
| Source Requirement | 原用户继续整体Agent框架蓝图；主Spec REQ-501至REQ-510 |
| Baseline Revision | `main@14f89aaaedad21d650481f14e5496bbf5debfc68` clean；Root baseline `/tmp/tianji-web-step40-baseline.json` |
| Implements Spec | [任务/Case/审批Web Spec](../spec/2026-11-04-22-56-task-case-approval-web.md) |
| Spec Status | `Review` |
| Spec Revision | `Updated 2026-11-04 23:26 Asia/Shanghai`；SHA-256 `14c997cb92e3ad035f14ba9fa237d373597e0c93bb5da5803266fc259e1df07c`（后续仅Related Plans metadata可更新） |
| Effective Specs | [主Spec](../spec/2026-11-04-22-56-task-case-approval-web.md)；无追加实施REQ的amendment/replacement；不变合同依赖见§2.2 |
| Depends On Plans | `None` |
| Supersedes | `None` |
| Superseded By | `None` |
| Related Plans | `None` |

## 1. Summary

在现有React/AntD/Cookie-CSRF/PaC壳中按三个串行commit交付：①六HumanTask+两Case consumer、fixtures、State协议和本地artifact锁；②任务箱/任务详情/schema审批及task路由权限；③Case IDlookup/详情/本页确认回执及Case路由权限。每Step有真实行为RED、有限GREEN/静态/官方build和聚焦commit；下一Step必须等待前一步commit完成。最终审计原REQ与未改边界，不宣称S08/S09或真实浏览器已通过。

## 2. Target Spec and Effective Design

### 2.1 Primary target

主Spec路径如header；status保持Review，不自行改Accepted。Root明确全文审阅其550行设计并批准继续原目标，授权本Review Plan；本Plan不是Ready。本次只澄清408/429属unknown，见tmp exactdiff，原400/401/403/404/409拒绝语义保持。正式写入repo前Root再次读完整Plan。

### 2.2 Effective Spec set

| Role | Spec/link | Status/revision | Effective sections | Why included |
| --- | --- | --- | --- | --- |
| Primary | [主Spec](../spec/2026-11-04-22-56-task-case-approval-web.md) | Review / headerhash | 全文，REQ-501..510 | 唯一新增Web实施需求 |
| Unchanged contract dependency | [正式Case backend](../../../../tianji-service/docs/egon/spec/2026-11-04-15-50-formal-cmmn-case-server.md) | Review；当前源码cfffb764 | §7.3/9/10/12，已编译入主Spec§9/10 | native/角色/版本权威，不重做backend REQ |
| Unchanged consumer authority | [Case Java](../../../../tianji-service/docs/egon/spec/2026-11-01-23-20-case-client-contract.md)、[Case HTTP](../../../../tianji-service/docs/egon/spec/2026-11-01-23-45-case-http-client.md) | 源码C/CL为准 | DTO/command/codec/OAS contract | 只读引用，不把backend完成项转成新Web任务 |
| Source roadmap | [整体蓝图](../../../../docs/plans/agent-framework-upgrade-plan.md) | 当前T3-11/S08/S09 | T3-11；最新T3-08runtime边界 | 限Web与真实环境acceptance区分 |

### 2.3 Superseded or excluded content

无supersession。backend/DB/API/Java/Spring/DDL/POM、SERVICE凭据、admin-taskUI、Case start/list/history/完整audit不属于本Plan；主Spec§3.2有效。

## 3. Effective Requirements and Acceptance

| Requirement | Source Spec section | Effective statement | Observable acceptance | Implementation impact |
| --- | --- | --- | --- | --- |
| REQ-501 | 主Spec§4/12 | task/case-only身份可达相应授权page | page/menu/button与landing正确 | Step2 task；Step3case |
| REQ-502 | §4/10/12 | PROCESS/CASE、ASSIGNED/CANDIDATE/ALL-visible分页 | emptyitems+next继续；filter reset | Step1contract；Step2inbox |
| REQ-503 | §4/10/12 | taskfacts/claim/unclaim/lanetransfer | flags+resource；serverroles权威 | Step1/2 |
| REQ-504 | §4/10/12 | schema-only ACTION/APPROVAL | primitivebounds/全keys/显式truefalse | Step1/2 |
| REQ-505 | §4/10/12 | CaseID及真实snapshot/times | 无list/history；terminal sparse | Step1/3 |
| REQ-506 | §4/10/12 | plan-item有限动作 | ACTIVE∩serveractions∩permission；TERMINATE确认 | Step1/3 |
| REQ-507 | §4/7/13 | frozen originalcommand manualretry | oneUUID/version/body；write ref；unknown冻结 | Step1State；Step2/3effects |
| REQ-508 | §4/7.3.4 | knownreject清旧facts、success后freshread | 408/429/5xx未知；400/401/403/404/409拒绝 | Step1/2/3 |
| REQ-509 | §4/7/15 | fullidentity/resourceaffinity | issuer+tenant+subject+epoch+resource；abort晚响应 | Step1/2/3 |
| REQ-510 | §4/14/16 | 真实RED/GREEN和验证边界 | npm脚本/官方PaCbuild；runtime未验收明确 | 每Step evidence |

## 4. Implementation Strategy and Dependency Order

### 4.1 Ordered strategy

Step1只提供已批准当前consumer/State技术行为，不加路由。Step2在同壳闭合task用户路径；Step3闭合Case路径并最终审计。每Step开始核前commit/cleanstatus，Root单独运行有限验证与commit；其他agent不能抢跑下一Step或改App/四permission共享文件。共同文档在Step1创建，后续只append当前证据/metadata；只有当前Step路径可stage。

### 4.2 Test-first strategy

不存在的新export允许先建只含类型/签名的compile seam：API薄调用requestJson并原样返回unknown；State reducer暂return原state；新组件暂return null。不得预先编写decoder/状态transition/页面行为。随后tests真实执行：非法response被原样接受使reject断言失败、unknown transition不发生使state断言失败、页面缺label使TestingLibrary断言失败。记录这些assertion RED后再完成GREEN。missingimport、tsc、fixturebug、环境错误不计RED；新文件先做compile prerequisite并返回原RED命令。每Step文件顺序中A=compile seam，B=已记录RED后的最小实现；同一文件A/B重复访问但仅一个inventory项/一次聚焦commit。

### 4.3 Sequential and parallel boundaries

| Step | Depends on | May run in parallel with | Must not overlap with | Reason |
| --- | --- | --- | --- | --- |
| Step 1 | clean14f89aa、Spec/Plan全文审阅 | 只读contract审计 | Step2/3任何edit/test/commit | exportedcontracts/State先稳定 |
| Step 2 | Step1已commit且Root核HEAD | 非重叠只读review | Step3全部、其他agent共享文件写 | App/四entrypoint后续增量 |
| Step 3 | Step2已commit且Root核HEAD | 非重叠只读audit | 其他写/commit | 最终conformance只有Root收口 |

### 4.4 Commit boundaries

三个semanticcommit：`feat(tianji-web): add governed task and case consumers`；`feat(tianji-web): add current-user task inbox and approval`；`feat(tianji-web): add governed case detail actions`。每步仅一次，均含其相应tests/docs；Step1可对应Root全局Step40，后续编号仅交付流水映射。不可在前三步完成后额外auto cleanup/第四commit。

### 4.5 Spec Simplicity and Implementation-necessity Audit

| Spec element | Spec necessity verdict/section | Current repository evidence | Direct/reuse alternative | Interaction/implementation cost | Plan decision |
| --- | --- | --- | --- | --- | --- |
| API TS mirrors | Add §7.0/10 | memoryPreferenceIntents.ts pattern；当前无task/case文件 | requestJson复用但无runtime DTOcheck | 六task/两Case旧POST，无新preflight | Implement |
| pureState/schemaform/三页 | Add §7.0/12/13 | MemoryPreferenceIntentStatus strongpending style | 全局provider/cache无额外需求 | 局部state/knownvariation，零新框架 | Implement |
| App+四entrypoints | Expand §12.1 | defineResources/defineMessages/currentShell | 原ANY只Agent/Memory不支持新readidentity | 必要ownedresources/CALLS | Implement |
| PAC local lock | Add §8/14 | officialprepare-contract/createToolchainLock | 已验证canonical相同但artifactSHA漂移 | 仅contract.sha256，可精确diff | Implement |
| backend/auth/dependency/history/admin/start | Remove §3.2 | 当前合同/既有auth可复用 | 已知ID/当前facts即可 | 禁增调用/缓存/持久化/依赖 | Already exists / excluded |

### 4.6 Change-unit Dependency Matrix

| Change unit | Requirements | Proof/RED point | Compile/runtime prerequisites | Produces | Consumers/unblocks | Owning Step |
| --- | --- | --- | --- | --- | --- | --- |
| typeddecoder/affinity/State | REQ-502..510 | invalidresponse接受/transition缺失 | compile seams，不启动runtime | humanTasksApi/casesApi/actionReducer | 两detail/inbox | Step 1 |
| inbox/approval动作 | REQ-501..504, REQ-507..510 | App现无taskroute；schema/页面shell无内容 | Step1commit | taskpages/taskresources | 人工路径；Case link后Step3接通 | Step 2 |
| Case snapshot/action | REQ-501, REQ-505..510 | 现App无Case route；shell无facts/actions | Step2commit | Casepage/resources/finalaudit | 当前用户Case路径 | Step 3 |

### 4.7 Java, Spring, and Egon-COLA Implementation Standards

Java-specific N/A：所有目标是既有TS frontend/Markdown/一个localPACartifactlock，backend Java完全不改。Rule11仍Applicable PASS，确认src/api→pages→App与auth/permissions既有依赖，未引入Java三层/COLA hybrid。

| Concern | Current repository evidence | Effective Spec decision | Planned implementation consequence | Owning Steps/checks |
| --- | --- | --- | --- | --- |
| Structure/reuse | App, requestJson, AuthContext, MemoryPreferenceIntentStatus | §6.1/13 | 既有TS布局/SDK；State小模块 | all；MC-ARCH-001/MC-REUSE-001 |
| JSON/form/time | C/CL records/codecs、ProcessValues | §10/TIME-501 | closedvaluechecks/exactform/rawinstant；不改Jackson | all；MC-JSON-001/MC-VALID-001/MC-TIME-001 |
| State pattern | proposed/pending前例 | §7.3/13 | reducerprotocol+pageeffects，非provider | all；MC-PATTERN-001 |

| Need | Candidates inspected | Exact evidence | Fit/gap | Decision | Added dependency/custom code | Owning Step/check |
| --- | --- | --- | --- | --- | --- | --- |
| network/auth | sharedSDK/requestJson | src/api/client.ts | 已有Cookie/CSRF/tenant | reuse | 无新依赖；新typedconsumer | Step1/MC-REUSE-001 |
| layout/permission | AntD/EnterpriseLayout/registry | App+四entrypoints | 新资源未定义 | reuse+extend | 三页面/schemaform | Step2/3/MC-DEP-001 |
| verify/build | Vitest/npm/PACofficial | package.json/scripts/build.mjs | 已有有限命令足够 | reuse | 不创建scripts/work harness | all/MC-TEST-001 |

### 4.8 User-mandated Java Rule Implementation Matrix

| Literal rule | Spec source | Repository evidence | Exact files and order | Pseudocode obligations | Validation gate | Steps | Status/blocker |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Rule 1 | §6.2 | 无Java目标 | §5TS/docs | semanticTSnames，Java无变更 | diffinventory | all | N/A |
| Rule 2 | §6.2/10 | 无Springlayer变化 | API→schemaform | TSboundaryvalidation不冒充BeanValidation | TEST-501/504 | all | N/A |
| Rule 3 | §6.2 | 无JavaPOJO/mapper | readonlyTS | 无Lombok/MapStruct变更 | diffinventory | all | N/A |
| Rule 4 | §6.2 | 无SpringBean | TScomponents | 不生成日志/DI代码 | diffinventory | all | N/A |
| Rule 5 | §6.2 | 无Javautility | nativeDOM/TS | 无新dependency | package/lockunchanged | all | N/A |
| Rule 6 | §6.2/10 | Jacksonserverunchanged | APItests→decoder | 保留wire，closedvaluecheck | TEST-501/502 | all | N/A |
| Rule 7 | §6.2/15 | 无Springprofile/env变更 | localPAC锁非profile | 不改结构key/服务config | exactdiff | all | N/A |
| Rule 9 | §13 | commandunknown是现有variation | State→twodetails | mandatoryState+transitiontests | TEST-508 | all | PASS |
| Rule 10 | TIME-501 | 无Java时间变化 | TSdecoder→UTCdisplay | rawstring保纳秒，无Date版本/回传 | TEST-506 | all | N/A |
| Rule 11 | §6.1/8 | 既有api/pages/auth/permissions | 每个文件按§7 | 保持架构/复用SDK，不增持久化/Event层 | baseline+pathreview | Every Step | PASS |

### 4.9 Time semantics and conversion contract

Time contract: Required

| Time ID | Fields/symbols | Semantics | Java/runtime type | Storage policy | Wire policy | Business zone source | Display zone source | Boundary / DST rules | Precision / Clock | Compatibility | Verification |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| TIME-501 | task.createdAt/dueAt、taskreceipt.occurredAt、case.submittedAt/finishedAt、caseoperation.occurredAt | Occurred instant | TSreadonlystring；serverexistingInstant | Not persisted | UTC Z | Not applicable: no business/calendar calculation | 显式UTC标签与Intl timeZone UTC | 有Z/offset、合法日期/offset；无裸local/epoch；不增加chronology，不做DST业务计算 | raw纳秒保留；Date仅展示毫秒不回传，不作version/order；无新Clock | 保持C/CL offset/nanosecond允许，UTC显示不改wire/DB | Step 1 API TEST-506；Step 2/3 UTCdisplay TEST-506；§8commands |

## 5. Change File Tree

全部路径相对tianji-web；同一文件跨Step的增量修改已明确，不在inventory重复。C=CREATE，M=MODIFY。

| Operation | Path | Current evidence/symbol | Final symbols/state | Responsibility | Step | Requirements | Validation owner |
| --- | --- | --- | --- | --- | --- | --- | --- |
| C | src/api/humanTasks.ts；src/api/humanTasks.test.ts | memoryPreferenceIntents.ts/tests前例；当前缺失 | humanTasksApi六方法/readonlytypes/decoder | exacttaskcontract | 1 | REQ-502,503,504,507,508,509,510 | TEST-501 |
| C | src/api/cases.ts；src/api/cases.test.ts | C/CLCaseauthority；当前缺失 | casesApi.get/actPlanItem/types/decoder | exactCasecontract | 1 | REQ-505,506,507,508,509,510 | TEST-502 |
| C | src/pages/orchestrationAction.ts；src/pages/orchestrationAction.test.ts | Memoryproposedpending；当前缺失 | actionReducer、OrchestrationActionState/Event | Stateprotocol | 1 | REQ-507,508,509 | TEST-508 |
| C | src/test/humanTaskFixtures.ts；src/test/caseFixtures.ts | existingfixturefactory风格 | typedgolden/negativevariants | testdata | 1 | REQ-510 | API/componenttests |
| M | permission-toolchain.local.lock.json | Root官方candidateverify | 仅contract.sha256 | officialbuildpin | 1 | REQ-510 | officialPaCbuild |
| C | docs/egon/spec/2026-11-04-22-56-task-case-approval-web.md | reviewedtmpSpec | Review+RelatedPlans | normativeboundary | 1 | REQ-510 | strictSpec |
| C | docs/egon/plan/2026-11-04-23-14-task-case-approval-web.md | thistmpPlan | reviewedPlan | exactsequence | 1 | REQ-510 | strictPlan |
| C | docs/egon/evidence/2026-11-04-task-case-approval-web.md | 现无Webevidence | 三Step真实logs/SHA/limits | sourceacceptanceaudit | 1；append2/3 | all | Root |
| C | src/pages/TaskInboxPage.tsx；src/pages/TaskInboxPage.test.tsx | AgentRunsPage table/cursor前例 | TaskInboxPage/Content | currentusertasklist | 2 | REQ-502,509 | TEST-503 |
| C | src/pages/TaskDetailPage.tsx；src/pages/TaskDetailPage.test.tsx | Memorystrongpending前例 | TaskDetailPage/Content | actions/receipt/freshread | 2 | REQ-503,504,507,508,509 | TEST-504/507/508 |
| C | src/pages/TaskSchemaForm.tsx；src/pages/TaskSchemaForm.test.tsx | AntDFormstyle | TaskSchemaForm/FormValues | exactprimitiveform | 2 | REQ-504 | TEST-504 |
| C | src/App.test.tsx | 当前App仅runs/memory | route/landing/resourceassertions | shellregression | 2；extend3 | REQ-501,509 | TEST-507 |
| M | src/App.tsx | SessionRoutes/RequireResource/Shell | taskroutes后Caseroutes | existingrouter/nav | 2；extend3 | REQ-501 | TEST-507 |
| M | src/permissions/permissions.ts | existingdefinePermissionReferences | TASK_*后CASE_* | permissionreferences | 2；extend3 | REQ-501,503,506 | registry/PAC |
| M | src/permissions/resources.ts | existingdefineResources | taskownedresources后Case | route/buttongates | 2；extend3 | REQ-501,503,506 | registry/PAC |
| M | src/permissions/references.ts | existingCALLS | 六task后两Case | APIkeybindings | 2；extend3 | REQ-502..506 | PAC |
| M | src/permissions/messages.ts | defineMessages zh/en | 新ownedresourcelabels | currenti18nstyle | 2；extend3 | REQ-501 | PAC |
| M | README.md | 现有功能/验证文档 | task后Case真实能力/limits | consumerdocumentation | 2；extend3 | REQ-510 | Rootdiff |
| C | src/pages/CaseDetailPage.tsx；src/pages/CaseDetailPage.test.tsx | existingpage-stack/AntD | CaseDetailPage/Content | IDlookup/currentfacts/actions | 3 | REQ-505..509 | TEST-505..508 |

## 6. Prerequisites, Constraints, and Plan Clarifications

### 6.1 Repository and worktree baseline

本Plan编写未改repo。Root已核clean main14f89aa，59tracked基线 `/tmp/tianji-web-step40-baseline.json`；现有14testfiles/62tests在2026-11-04 23:16:42通过，log `/tmp/tianji-web-task-case-baseline-test.log`，仅现有jsdompseudo警告。后续每Step重新status/diff，保存无关work；只stage exactcommitpaths，不gitadd全仓/forceadd产物。

### 6.2 Build, test, and environment prerequisites

Root核Node24.14.1；SDK clean aff7e164且officialverifyToolchain(oldlock)PASS。固定artifact为 `/var/folders/gb/vwfj36c909xgtbr0jl267d880000gp/T/tianji-web-task-case-contract-x71mc1hq/verified-contract.jar`，SHA `2077ebbb0e5aa9d35bb1350c869fc7e38879f5d476b649a754094da230ac7b18`；metadata `/tmp/tianji-web-task-case-artifact.json`。官方已产出仅SHA变化candidate `/var/folders/gb/vwfj36c909xgtbr0jl267d880000gp/T/tianji-task-case-lock-WBR6OT/permission-toolchain.local.lock.json`；Step1由Root再核其diff并采用/官方重新生成，不在Plan阶段复制到repo。

### 6.3 Immutable constraints and approved decisions

backend/C/CL/OAS/SQL/POM、package/package-lock、scripts、auth/env/styles/registry/manifestconfig均不改。PAC锁仅contract.sha256变化，五canonicalentries/SDKsourceDigest/dependencyLock/mode LOCAL_UNCOMMITTED/nodeMajor24/其余keys逐值相同。UI token/role/userassignee/approval.verify禁入；普通ALL不能调用admin。请求body无tenant/identity，trustedtenant只作existingheadercheck。

### 6.4 Plan Clarifications

| ID | Small implementation inference | Repository evidence | Why semantics are unchanged | Impact if wrong |
| --- | --- | --- | --- | --- |
| PLAN-CLAR-501 | API export命名humanTasksApi/casesApi，State名actionReducer | existingmemoryApi命名风格 | 纯内部symbol，主Spec职责不变 | 局部rename对应tests |
| PLAN-CLAR-502 | compile-seam A后真实assertion RED，再B完成 | skill允许compileprerequisite；全新文件不存在 | 无seam冒充验收，不改变最终行为 | RED不达标先修seam/fixture |
| PLAN-CLAR-503 | 三Step共享一个evidence文件append | 当前无固定Webevidence格式；主Spec要求证据边界 | 无新runtime/用户行为 | Root可改文档filename并一致链接 |

## 7. Ordered File-by-file Implementation Steps

### Step 1 — 交付精确task/Case consumer与可重试State协议
- Requirements: REQ-502, REQ-503, REQ-504, REQ-505, REQ-506, REQ-507, REQ-508, REQ-509, REQ-510
- Dependencies: None；Root先审全文Spec/Plan
- Baseline state: clean14f89aa；现有14files/62tests已PASS；无新API/State
- Observable outcome: 交付精确task/Case consumer与可重试State协议。
- End state: 六task/两Case typedconsumer+fixtures+State tests GREEN；PAC锁正确；无新routes
- Test-first gate: Required — API A-seam接受invalidresponse使rejectassertion失败；State A-seam不能unknown使phaseassertion失败；missingimport/compile/fixture环境错不算RED。
- Manual Checks: MC-ARCH-001, MC-REUSE-001, MC-DEP-001, MC-NAME-001, MC-VALID-001, MC-MODEL-001, MC-CONVERT-001, MC-LOG-001, MC-BEAN-001, MC-UTIL-001, MC-JSON-001, MC-TIME-001, MC-CONFIG-001, MC-PATTERN-001, MC-SCOPE-001, MC-TEST-001, MC-BLOCKER-001。
- Literal Rules: Rule 1, Rule 2, Rule 3, Rule 4, Rule 5, Rule 6, Rule 7, Rule 9, Rule 10, Rule 11；逐项适用性见本Step末表；Rule11始终Applicable PASS。
- Ordered files: 按以下File编号；A-pass compile-only签名先于tests，RED后回访已列生产file的B-pass，禁止提前写validation/render行为。

#### File 1 — `CREATE src/test/humanTaskFixtures.ts`
- Purpose: humanTask(), humanTaskPage(), humanTaskReceipt()，仅本Step职责。
- Symbols: humanTask(), humanTaskPage(), humanTaskReceipt()。
- Repository evidence: src/test/preferenceIntentFixtures.ts factory style。
- Dependencies and consumers: APItests→组件tests；仅import type humanTasks。
- Why now: 按本Step RED→最小GREEN→接线顺序；compile seam仅A-pass，B-pass须等真实RED。
- Contract/signature changes: export readonly fixture factories，参数只覆盖合法业务variation。
- Input/output and state mapping: C DTO全字段；PROCESS/CASE，ACTION/APPROVAL，64hex，nullable。
- Error and edge behavior: golden C/CL来源；非法variant由test显式clone，不污染合法factory。
- Standards impact: MC-SCOPE-001, MC-TEST-001；既有TS/AntD/SDK结构，不触Java/DB/dependency。
- Literal rule enforcement: Rule 11；保留主Spec逐条适用性与原模块边界。
- Implementation pseudocode:
```typescript
humanTask(overrides) => complete C/CL wire object with valid primitive schema and version
humanTaskPage(items=[], nextAfterTaskId=null) => scopeType/selection/items/cursor
humanTaskReceipt(command, action) => command-linked source and nullable receipt fields
```
- Verification contribution: TEST-501/503/504。
- After this file: fixtures可用于真实契约断言；A-pass只需type contract。

#### File 2 — `CREATE src/test/caseFixtures.ts`
- Purpose: caseInstance(), casePlanItem(), caseOperationResult()，仅本Step职责。
- Symbols: caseInstance(), casePlanItem(), caseOperationResult()。
- Repository evidence: 现有fixture factories；C Case DTO/OAS。
- Dependencies and consumers: cases tests/Case page tests。
- Why now: 按本Step RED→最小GREEN→接线顺序；compile seam仅A-pass，B-pass须等真实RED。
- Contract/signature changes: export fixture factories，覆盖完整12field结果。
- Input/output and state mapping: ACTIVE finishednull；terminal sparse；四transition来源。
- Error and edge behavior: 不把receipt当currentcase；不虚造PI timestamp。
- Standards impact: MC-SCOPE-001, MC-TEST-001；既有TS/AntD/SDK结构，不触Java/DB/dependency。
- Literal rule enforcement: Rule 11；保留主Spec逐条适用性与原模块边界。
- Implementation pseudocode:
```typescript
caseInstance(overrides) => C fields with submittedAt, finishedAt, bounded planItems
casePlanItem(state, availableActions) => known id/key/kind/version and server subset
caseOperationResult(command) => all twelve fields matching frozen source and transition
```
- Verification contribution: TEST-502/505/506。
- After this file: Case golden数据稳定；negativevariants另建。

#### File 3 — `CREATE src/api/humanTasks.test.ts`
- Purpose: six-route contract/decoder/form/cursor affinity tests，仅本Step职责。
- Symbols: six-route contract/decoder/form/cursor affinity tests。
- Repository evidence: memoryPreferenceIntents.test.ts fetch+CSRF模式。
- Dependencies and consumers: File1；先A-seam File6，再运行真实RED。
- Why now: 按本Step RED→最小GREEN→接线顺序；compile seam仅A-pass，B-pass须等真实RED。
- Contract/signature changes: Vitest spies，fetch返回unknown对象。
- Input/output and state mapping: exactbody/header/signal；nullable兼容；UTF8order/nextcontinuation。
- Error and edge behavior: 拒绝foreign/extra/coerced/invalidschema；不要missingimport RED。
- Standards impact: MC-SCOPE-001, MC-TEST-001；既有TS/AntD/SDK结构，不触Java/DB/dependency。
- Literal rule enforcement: Rule 11；保留主Spec逐条适用性与原模块边界。
- Implementation pseudocode:
```typescript
arrange csrf mock and fetch returning foreign taskId / invalid assignedToMe / extra property
await expect(humanTasksApi.get(tenant, query, signal)).rejects.toThrow(); assert one fetch
assert six POST routes only, no admin/verify; candidate empty page with next remains valid
```
- Verification contribution: TEST-501/506。
- After this file: 记录invalidresponse被原样接受的assertion RED。

#### File 4 — `CREATE src/api/cases.test.ts`
- Purpose: get/action shape + transition + affinity tests，仅本Step职责。
- Symbols: get/action shape + transition + affinity tests。
- Repository evidence: CL CaseResponseCodec/OAS；API sibling tests。
- Dependencies and consumers: File2；先A-seam File7。
- Why now: 按本Step RED→最小GREEN→接线顺序；compile seam仅A-pass，B-pass须等真实RED。
- Contract/signature changes: Vitest exact2routes/negative matrix。
- Input/output and state mapping: sourcebinding、terminal sparse、12fieldResult。
- Error and edge behavior: no start/list/history/COMPLETE；不加chronology。
- Standards impact: MC-SCOPE-001, MC-TEST-001；既有TS/AntD/SDK结构，不触Java/DB/dependency。
- Literal rule enforcement: Rule 11；保留主Spec逐条适用性与原模块边界。
- Implementation pseudocode:
```typescript
arrange fetch with missing finishedAt / foreign caseId / unavailable action / wrong previousVersion
await expect(casesApi.get(tenant, query, signal)).rejects.toThrow(); assert once only
accept sparse terminal snapshots, offset/nanosecond strings and only four valid action transitions
```
- Verification contribution: TEST-502/506。
- After this file: 记录缺校验导致reject断言失败，后GREEN复用。

#### File 5 — `CREATE src/pages/orchestrationAction.test.ts`
- Purpose: transition matrix/exact frozen command assertions，仅本Step职责。
- Symbols: transition matrix/exact frozen command assertions。
- Repository evidence: Memoryproposedpending语义、主Spec§7.3。
- Dependencies and consumers: 先A-seam File8；无React effects。
- Why now: 按本Step RED→最小GREEN→接线顺序；compile seam仅A-pass，B-pass须等真实RED。
- Contract/signature changes: reducer输入state+event返回state。
- Input/output and state mapping: immutableproposal/form；unknownmanualsend保持同命令。
- Error and edge behavior: 非法transition无变化；408/429由page测不在pureState解释HTTP。
- Standards impact: MC-SCOPE-001, MC-TEST-001；既有TS/AntD/SDK结构，不触Java/DB/dependency。
- Literal rule enforcement: Rule 9, Rule 11；保留主Spec逐条适用性与原模块边界。
- Implementation pseudocode:
```typescript
const proposed = actionReducer(idle, {type:'propose', command: frozenCommand})
const unknown = actionReducer(actionReducer(proposed, {type:'send'}), {type:'uncertain'})
expect(unknown.phase).toBe('unknown'); expect(actionReducer(unknown,{type:'send'}).command).toBe(frozenCommand)
```
- Verification contribution: TEST-508。
- After this file: 记录return-idle导致phase断言RED。

#### File 6 — `CREATE src/api/humanTasks.ts`
- Purpose: humanTasksApi.query/get/claim/unclaim/transfer/complete；HumanTask/HumanTaskPage/HumanTaskActionReceipt；ListHumanTasksQuery/GetHumanTaskQuery/ClaimHumanTaskCommand/UnclaimHumanTaskCommand/TransferHumanTaskCommand/CompleteHumanTaskCommand，仅本Step职责。
- Symbols: humanTasksApi.query/get/claim/unclaim/transfer/complete；HumanTask/HumanTaskPage/HumanTaskActionReceipt；ListHumanTasksQuery/GetHumanTaskQuery/ClaimHumanTaskCommand/UnclaimHumanTaskCommand/TransferHumanTaskCommand/CompleteHumanTaskCommand。
- Repository evidence: requestJson、C HumanTask records、CL codec/taskPage/taskAction。
- Dependencies and consumers: File3；TaskInbox/Detail/SchemaForm。
- Why now: 按本Step RED→最小GREEN→接线顺序；compile seam仅A-pass，B-pass须等真实RED。
- Contract/signature changes: query(tenant,ListHumanTasksQuery,signal?) / get(tenant,GetHumanTaskQuery,signal?)；四mutation(tenant,相应Command,source:HumanTask,signal?)，source必填。
- Input/output and state mapping: 精确六POST；mutation source:HumanTask必填，先校验shape/id/version/eligibility且仅本地，不出body；空next合法。
- Error and edge behavior: Java-equivalent id blank/ASCIIedge，NBSP/BOM合法保留；UTF16/safeUnicode；closedkeys、15digits、UTF8cursororder。
- Standards impact: MC-VALID-001, MC-JSON-001, MC-TIME-001, MC-SCOPE-001；既有TS/AntD/SDK结构，不触Java/DB/dependency。
- Literal rule enforcement: Rule 11；保留主Spec逐条适用性与原模块边界。
- Implementation pseudocode:
```typescript
A: export exact TS contracts and six thin requestJson pass-through methods; no decoder behavior yet
B after File3 RED: validate request and mandatory source HumanTask before mutation POST; bind taskId/version/flags/lane/form eligibility; decode receipt against exact source/command
return readonly validated result; reject missing/invalid source before fetch; receipt must match frozen source; no automatic retry or raw-error exposure
```
- Verification contribution: TEST-501/506。
- After this file: File3 GREEN；无admin/verify wrapper。

#### File 7 — `CREATE src/api/cases.ts`
- Purpose: casesApi.get/actPlanItem；CaseInstanceQuery/CaseInstance/CasePlanItem/ActOnPlanItemCommand/CaseOperationResult，仅本Step职责。
- Symbols: casesApi.get/actPlanItem；CaseInstanceQuery/CaseInstance/CasePlanItem/ActOnPlanItemCommand/CaseOperationResult。
- Repository evidence: C records/CaseResponseCodec/OAS与requestJson。
- Dependencies and consumers: File4；CaseDetailPage。
- Why now: 按本Step RED→最小GREEN→接线顺序；compile seam仅A-pass，B-pass须等真实RED。
- Contract/signature changes: get(tenant,CaseInstanceQuery,signal?)；actPlanItem(tenant,ActOnPlanItemCommand,source:CaseInstance,signal?)，source必填且仅本地；不新增servicecontract。
- Input/output and state mapping: allfieldsrequired；≤16 uniquePI；hash/version/source；UTCrawstring。
- Error and edge behavior: 仅serveraction子集；四transition；terminal sparse；JavaID NBSP/BOM；不以Date推断chronology。
- Standards impact: MC-VALID-001, MC-JSON-001, MC-TIME-001, MC-SCOPE-001；既有TS/AntD/SDK结构，不触Java/DB/dependency。
- Literal rule enforcement: Rule 11；保留主Spec逐条适用性与原模块边界。
- Implementation pseudocode:
```typescript
A: export exact contracts and get/actPlanItem thin requestJson pass-through, no validation yet
B after File4 RED: validate CaseInstanceQuery or ActOnPlanItemCommand plus mandatory source CaseInstance, same Case/PI/version, ACTIVE/server-action eligibility; POST once then bind receipt source
reject COMPLETE/extra fields/missing nullable finishedAt/coercion; preserve offset and nanosecond raw strings
```
- Verification contribution: TEST-502/506。
- After this file: File4 GREEN；不新增CaseStart/list/history方法。

#### File 8 — `CREATE src/pages/orchestrationAction.ts`
- Purpose: OrchestrationActionState/OrchestrationActionEvent/actionReducer，仅本Step职责。
- Symbols: OrchestrationActionState/OrchestrationActionEvent/actionReducer。
- Repository evidence: 主Spec State；MemoryIntentStatus。
- Dependencies and consumers: File5；Task/Case detailuseReducer。
- Why now: 按本Step RED→最小GREEN→接线顺序；compile seam仅A-pass，B-pass须等真实RED。
- Contract/signature changes: idle/proposed/submitting/unknown discriminatedunion，闭合events。
- Input/output and state mapping: deepcopy冻结command/form由propose调用者提供；samecommand exactref。
- Error and edge behavior: 无UUID/network/auth/provider；非法event保留state。
- Standards impact: MC-PATTERN-001, MC-SCOPE-001, MC-TEST-001；既有TS/AntD/SDK结构，不触Java/DB/dependency。
- Literal rule enforcement: Rule 9, Rule 11；保留主Spec逐条适用性与原模块边界。
- Implementation pseudocode:
```typescript
A: export typed state/event signatures and reducer that returns input state
B after File5 RED: allow idle→proposed→submitting→unknown→submitting with original command only
settled/reset→idle; cancelProposal only proposed; reject overwriting command while submitting/unknown
```
- Verification contribution: TEST-508。
- After this file: File5 GREEN，pageeffects后续复用。

#### File 9 — `MODIFY permission-toolchain.local.lock.json`
- Purpose: contract.sha256，仅本Step职责。
- Symbols: contract.sha256。
- Repository evidence: officialcreateToolchainLock/verifyToolchain；Rootcandidate path §6.2。
- Dependencies and consumers: 固定artifactSHA；官方SDK；buildConsumer。
- Why now: 按本Step RED→最小GREEN→接线顺序；compile seam仅A-pass，B-pass须等真实RED。
- Contract/signature changes: 唯一field由c292...→2077ebbb...。
- Input/output and state mapping: 五entries/SDK/node24/mode/coordinates/contractDirectory完全相同。
- Error and edge behavior: 官方writeflagwx：写新临时candidate，diff通过后替换目标；不可覆盖旧lock重建或手改放宽。
- Standards impact: MC-DEP-001, MC-SCOPE-001, MC-TEST-001；既有TS/AntD/SDK结构，不触Java/DB/dependency。
- Literal rule enforcement: Rule 11；保留主Spec逐条适用性与原模块边界。
- Implementation pseudocode:
```typescript
await createToolchainLock({artifact: fixedJar, artifactSha256: fixedSha, output: freshCandidate, mode:'LOCAL_UNCOMMITTED'})
assert verifyToolchain(candidate); compare parsed old/new after removing contract.sha256, require equality
assert candidate.contract.sha256===fixedSha; only then Root copies reviewed candidate to existing lock
```
- Verification contribution: TEST-510。
- After this file: officialbuild可消费新artifact，未register/activate。

#### File 10 — `CREATE docs/egon/spec/2026-11-04-22-56-task-case-approval-web.md`
- Purpose: reviewedSpec + RelatedPlans backlink，仅本Step职责。
- Symbols: reviewedSpec + RelatedPlans backlink。
- Repository evidence: Root全文审阅tmpSpec；408/JavaID澄清授权。
- Dependencies and consumers: 已完成Plan路径；strictSpec。
- Why now: 按本Step RED→最小GREEN→接线顺序；compile seam仅A-pass，B-pass须等真实RED。
- Contract/signature changes: 复制exactfinaltmp；保持Review，不假Accepted。
- Input/output and state mapping: 关联新Planrelativepath；freeze finaldesignSHA。
- Error and edge behavior: 仅metadata backlink，不能写新行为。
- Standards impact: MC-SCOPE-001, MC-TEST-001；既有TS/AntD/SDK结构，不触Java/DB/dependency。
- Literal rule enforcement: Rule 11；保留主Spec逐条适用性与原模块边界。
- Implementation pseudocode:
```typescript
copy final reviewed tmp Spec to the exact repository path; preserve Review and all ten REQs
set Related Plans to ../plan/2026-11-04-23-14-task-case-approval-web.md only
run existing strict Spec validator; record sha256 and metadata-only relationship update
```
- Verification contribution: Specstrict。
- After this file: 审阅过Spec入repo且strict通过。

#### File 11 — `CREATE docs/egon/plan/2026-11-04-23-14-task-case-approval-web.md`
- Purpose: reviewedthreeStepPlan，仅本Step职责。
- Symbols: reviewedthreeStepPlan。
- Repository evidence: thistmpPlan/Rootreview。
- Dependencies and consumers: File10+Root全文审阅。
- Why now: 按本Step RED→最小GREEN→接线顺序；compile seam仅A-pass，B-pass须等真实RED。
- Contract/signature changes: 复制exactfinalPlan，Review，SpecRevision最终SHA。
- Input/output and state mapping: 三semanticcommits串行；无runtimeclaim。
- Error and edge behavior: 不能把Root原goal授权伪造Spec/PlanAccepted。
- Standards impact: MC-SCOPE-001, MC-TEST-001；既有TS/AntD/SDK结构，不触Java/DB/dependency。
- Literal rule enforcement: Rule 11；保留主Spec逐条适用性与原模块边界。
- Implementation pseudocode:
```typescript
copy reviewed Plan to exact formal path and bind final Spec revision/hash
validate with existing validate_plan.py --strict; keep three sequential commits and no next-Step overlap
record Root review authority and effective contract dependencies without expanding backend requirements
```
- Verification contribution: Planstrict。
- After this file: Plan可审计入repo；当前Step执行证据另写。

#### File 12 — `CREATE docs/egon/evidence/2026-11-04-task-case-approval-web.md`
- Purpose: Step1 RED/GREEN/build/hash/scope evidence，仅本Step职责。
- Symbols: Step1 RED/GREEN/build/hash/scope evidence。
- Repository evidence: Rootbaseline/logs；formalSpec/Plan。
- Dependencies and consumers: Root实际已跑命令；禁止虚报。
- Why now: 按本Step RED→最小GREEN→接线顺序；compile seam仅A-pass，B-pass须等真实RED。
- Contract/signature changes: createoneevidence文档，后续Stepappend。
- Input/output and state mapping: 命令cwd/start/end/exit/assertionRED/SHA/stagedpaths。
- Error and edge behavior: runtime/browser/S08S09未验收独立列；不记secret/rawform。
- Standards impact: MC-SCOPE-001, MC-TEST-001, MC-BLOCKER-001；既有TS/AntD/SDK结构，不触Java/DB/dependency。
- Literal rule enforcement: Rule 11；保留主Spec逐条适用性与原模块边界。
- Implementation pseudocode:
```typescript
append baseline commit, 62-test baseline evidence and each actual assertion RED/GREEN command/result
record official lock diff-only artifact SHA, build manifest/digest checks and excluded-path hashes
state no browser/server/DB/IAM runtime execution; commit exact Step1 paths after staged diff review
```
- Verification contribution: TEST-510。
- After this file: Step1实际证据完整、无产物/日志stage。

- Validation working directory: `/Users/mario/SelfProject/Stellar-Enclosure/tianji-web`。
- Verification command: `npm test -- src/api/humanTasks.test.ts src/api/cases.test.ts src/pages/orchestrationAction.test.ts`；随后§8对应Step静态/官方build门。
- Expected result: RED为指定assertion失败；GREEN全通过、typecheck/lint/build exit0，manifest/diff与scope相符。
- Failure returns to: 本Step最早失败file；contract矛盾回主Spec，不能改backend/放宽validator；未GREEN不得commit。
- Completion criteria: 六task/两Case+pureState合同通过；旧62tests回归；仅PACartifactSHA变；Spec/Planstrict；全新pages仍不存在；逐项MC/Rule设计与实际结果写evidence，Root审stageddiff后提交。
- Rollback: 未提交仅还原本Step自有改动并保留外部work；已提交如需回滚用聚焦revert，不重写history，不变server。
- Commit paths: `src/test/humanTaskFixtures.ts`; `src/test/caseFixtures.ts`; `src/api/humanTasks.test.ts`; `src/api/cases.test.ts`; `src/pages/orchestrationAction.test.ts`; `src/api/humanTasks.ts`; `src/api/cases.ts`; `src/pages/orchestrationAction.ts`; `permission-toolchain.local.lock.json`; `docs/egon/spec/2026-11-04-22-56-task-case-approval-web.md`; `docs/egon/plan/2026-11-04-23-14-task-case-approval-web.md`; `docs/egon/evidence/2026-11-04-task-case-approval-web.md`。
- Commit: `feat(tianji-web): add governed task and case consumers`。

本Step逐条设计检查（PASS是Plan可执行性，不是实现已通过）：

| Literal rule | Status | Evidence / enforcement |
| --- | --- | --- |
| Rule 1 | N/A | Step 1；仅TS/docs，无Java命名 |
| Rule 2 | N/A | Step 1；无Javahandoff；TSvalidation由TEST-501/504证明 |
| Rule 3 | N/A | Step 1；无JavaPOJO/MapStruct，readonlyTS |
| Rule 4 | N/A | Step 1；无SpringBean/DI/log类 |
| Rule 5 | N/A | Step 1；无Javautility/新依赖 |
| Rule 6 | N/A | Step 1；Jackson未变；consumerwire按C/CL |
| Rule 7 | N/A | Step 1；无Springprofile/env；PAC锁仅artifactSHA |
| Rule 9 | PASS | Step 1；State已定义；本Step创建或使用封闭transition协议 |
| Rule 10 | N/A | Step 1；无Java时间变化；TIME-501 rawstring/UTC显示 |
| Rule 11 | PASS | Step 1；src/api/pages/App/permissions既有结构，SDK复用；全部files受scope审计 |

| Check ID | Applicability | Status | Evidence | Finding | Required action/exception |
| --- | --- | --- | --- | --- | --- |
| MC-ARCH-001 | Applicable | PASS | Step 1：§5既有TS目标tree，Rule11 | Plan义务明确，执行前后按此核实 | None |
| MC-REUSE-001 | Applicable | PASS | Step 1：requestJson/AuthContext/AntD/fixture前例 | Plan义务明确，执行前后按此核实 | None |
| MC-DEP-001 | Applicable | PASS | Step 1：package/lock/scripts原样；仅批准PACartifactSHA | Plan义务明确，执行前后按此核实 | None |
| MC-NAME-001 | Not applicable | N/A | Step 1：只有TS/docs，无Java类型 | Java限定关注点未变化 | None |
| MC-VALID-001 | Applicable | PASS | Step 1：主Spec§10/12，API/form负测 | Plan义务明确，执行前后按此核实 | None |
| MC-MODEL-001 | Not applicable | N/A | Step 1：readonlyTS，无Java构造 | Java限定关注点未变化 | None |
| MC-CONVERT-001 | Not applicable | N/A | Step 1：无JavaMapStruct/BaseConverter变更 | Java限定关注点未变化 | None |
| MC-LOG-001 | Not applicable | N/A | Step 1：无JavaBean/新日志，form不写console | Java限定关注点未变化 | None |
| MC-BEAN-001 | Not applicable | N/A | Step 1：无Spring/DI文件 | Java限定关注点未变化 | None |
| MC-UTIL-001 | Not applicable | N/A | Step 1：无Javautility/newdependency | Java限定关注点未变化 | None |
| MC-JSON-001 | Applicable | PASS | Step 1：C/CL字段/nullable/affinity测试 | Plan义务明确，执行前后按此核实 | None |
| MC-TIME-001 | Applicable | PASS | Step 1：TIME-501；TEST-506，无DB/timezone业务计算 | Plan义务明确，执行前后按此核实 | None |
| MC-CONFIG-001 | Not applicable | N/A | Step 1：无Springprofile/frontendenvkey变更 | Java限定关注点未变化 | None |
| MC-PATTERN-001 | Applicable | PASS | Step 1：actionReducer封闭State及pageeffects | Plan义务明确，执行前后按此核实 | None |
| MC-SCOPE-001 | Applicable | PASS | Step 1：本Step exactpaths与unchangedbaseline | Plan义务明确，执行前后按此核实 | None |
| MC-TEST-001 | Applicable | PASS | Step 1：§8真实RED/GREEN/静态/PAC gates | Plan义务明确，执行前后按此核实 | None |
| MC-BLOCKER-001 | Applicable | PASS | Step 1：本Step文件/规则/MC逐条设计闭合，runtime边界保留 | Plan义务明确，执行前后按此核实 | None |

### Step 2 — 交付当前用户任务箱与schema审批
- Requirements: REQ-501, REQ-502, REQ-503, REQ-504, REQ-507, REQ-508, REQ-509, REQ-510
- Dependencies: Step1 commit完成且Root核HEAD/cleanstatus
- Baseline state: Step1consumer/State已commit；无taskroutes/page；原runs/memory保留
- Observable outcome: 交付当前用户任务箱与schema审批。
- End state: 任务浏览/认领/归还/队列转交/完成与明确审批闭合；无Case路由；原功能回归
- Test-first gate: Required — App已有实现task-onlylanding断言失败；newpage A-shell后label/form/action断言失败；missingimport/compile/fixture环境错不算RED。
- Manual Checks: MC-ARCH-001, MC-REUSE-001, MC-DEP-001, MC-NAME-001, MC-VALID-001, MC-MODEL-001, MC-CONVERT-001, MC-LOG-001, MC-BEAN-001, MC-UTIL-001, MC-JSON-001, MC-TIME-001, MC-CONFIG-001, MC-PATTERN-001, MC-SCOPE-001, MC-TEST-001, MC-BLOCKER-001。
- Literal Rules: Rule 1, Rule 2, Rule 3, Rule 4, Rule 5, Rule 6, Rule 7, Rule 9, Rule 10, Rule 11；逐项适用性见本Step末表；Rule11始终Applicable PASS。
- Ordered files: 按以下File编号；A-pass compile-only签名先于tests，RED后回访已列生产file的B-pass，禁止提前写validation/render行为。

#### File 1 — `CREATE src/App.test.tsx`
- Purpose: mockedAuth route/nav/landing/resource tests，仅本Step职责。
- Symbols: mockedAuth route/nav/landing/resource tests。
- Repository evidence: App.tsx existingSessionRoutes/Shell；fixtures.authorization。
- Dependencies and consumers: 现有App+useAuth mock；pagecomponents后续import。
- Why now: 按本Step RED→最小GREEN→接线顺序；compile seam仅A-pass，B-pass须等真实RED。
- Contract/signature changes: VitestrenderApp/MemoryRouter-safe browserhistory jsdom；不打开GUI。
- Input/output and state mapping: task-onlyidentity→/tasks；run/memory沿原顺序。
- Error and edge behavior: 首次RED现有App不能显示任务箱；no newCasepermission直到Step3。
- Standards impact: MC-SCOPE-001, MC-TEST-001；既有TS/AntD/SDK结构，不触Java/DB/dependency。
- Literal rule enforcement: Rule 11；保留主Spec逐条适用性与原模块边界。
- Implementation pseudocode:
```typescript
mock AuthProvider and useAuth ready identity with TIANJI_TASK_READ only; render existing App
expect(screen.getByRole('heading',{name:'任务箱'})).toBeVisible(); this assertion fails before task wiring
assert routes/menu/button require respective resources and runs/memory landing behavior stays valid
```
- Verification contribution: TEST-507。
- After this file: 记录现有App行为RED，新增page测试仍待GREEN。

#### File 2 — `CREATE src/pages/TaskInboxPage.test.tsx`
- Purpose: paging/filter/affinity/visible-links tests，仅本Step职责。
- Symbols: paging/filter/affinity/visible-links tests。
- Repository evidence: AgentRunsPage.test.tsx/componentmock风格。
- Dependencies and consumers: Step1fixtures/API；A-shell File5。
- Why now: 按本Step RED→最小GREEN→接线顺序；compile seam仅A-pass，B-pass须等真实RED。
- Contract/signature changes: mockhumanTasksApi+useAuth；真实Table/Form。
- Input/output and state mapping: PROCESS/CASE和三selection；emptyitems+cursor Next。
- Error and edge behavior: issuer/tenant/subject/epoch/filter各切换abort+ignorelate；ALL不admin。
- Standards impact: MC-SCOPE-001, MC-TEST-001；既有TS/AntD/SDK结构，不触Java/DB/dependency。
- Literal rule enforcement: Rule 11；保留主Spec逐条适用性与原模块边界。
- Implementation pseudocode:
```typescript
render TaskInboxPage A-shell then expect scope and selection controls; record missing-content assertion RED
mock empty items with nextAfterTaskId; click Next and assert exact cursor, then reset on changed filters
resolve old deferred response after identity/epoch/filter change; assert no old row or command residue
```
- Verification contribution: TEST-503/507。
- After this file: 真实componentRED后允许File5 B实现。

#### File 3 — `CREATE src/pages/TaskSchemaForm.test.tsx`
- Purpose: exact primitive form/explicitapproval tests，仅本Step职责。
- Symbols: exact primitive form/explicitapproval tests。
- Repository evidence: AntDForm+TestingLibrary现有style。
- Dependencies and consumers: Step1taskfixture；A-shell File6。
- Why now: 按本Step RED→最小GREEN→接线顺序；compile seam仅A-pass，B-pass须等真实RED。
- Contract/signature changes: controlledform props；onSubmit primitivevalues。
- Input/output and state mapping: missing/extra/null、STRINGempty/utf16/bytes、INTEGER±15digit、BOOLEANfalse。
- Error and edge behavior: approvalundefined阻止submit；false必须提交；dangerouskeys不走prototype。
- Standards impact: MC-SCOPE-001, MC-TEST-001；既有TS/AntD/SDK结构，不触Java/DB/dependency。
- Literal rule enforcement: Rule 11；保留主Spec逐条适用性与原模块边界。
- Implementation pseudocode:
```typescript
render schema with STRING/INTEGER/BOOLEAN and APPROVAL approvalField, no initial decision
expect labelled decision control to exist; choose false, submit and assert exact keys and boolean false
assert empty STRING valid, 15-digit limits exact, decimal/exponent/undefined/extra keys issue zero callback
```
- Verification contribution: TEST-504。
- After this file: 记录表单缺行为真实RED；边界tests后续GREEN。

#### File 4 — `CREATE src/pages/TaskDetailPage.test.tsx`
- Purpose: taskactions/retry/status/identity tests，仅本Step职责。
- Symbols: taskactions/retry/status/identity tests。
- Repository evidence: MemoryPreferenceIntentStatus.test.tsx deferredpromises。
- Dependencies and consumers: Step1State/taskfixtures；A-shell File7。
- Why now: 按本Step RED→最小GREEN→接线顺序；compile seam仅A-pass，B-pass须等真实RED。
- Contract/signature changes: mockAPI/realModal/Form；currentAuthallows。
- Input/output and state mapping: DTOflags→guard；readonlyfrozencommand→onewrite→receipt→freshget。
- Error and edge behavior: 408/429/5xx/malformed/networkunknown exactretry；400/401/403/404/409清snapshot；404不称completed。
- Standards impact: MC-SCOPE-001, MC-TEST-001；既有TS/AntD/SDK结构，不触Java/DB/dependency。
- Literal rule enforcement: Rule 11；保留主Spec逐条适用性与原模块边界。
- Implementation pseudocode:
```typescript
render readable task then expect name/actions; record missing-content assertion RED against A-shell
confirm complete, pass required frozen HumanTask source; reject408/429 and assert form/lane/refresh frozen and exact retry body+source
assert known rejection clears facts, accepted receipt+get failure never repeats write, oldidentity responses ignored
```
- Verification contribution: TEST-504/507/508。
- After this file: 记录真实detailRED；File7 B实现后GREEN。

#### File 5 — `CREATE src/pages/TaskInboxPage.tsx`
- Purpose: TaskInboxPage/TaskInboxContent，仅本Step职责。
- Symbols: TaskInboxPage/TaskInboxContent。
- Repository evidence: AgentRunsPage/useEffect/table/cursor；Memoryfullidentitykey。
- Dependencies and consumers: humanTasksApi/useAuth；App routes；TaskDetail。
- Why now: 按本Step RED→最小GREEN→接线顺序；compile seam仅A-pass，B-pass须等真实RED。
- Contract/signature changes: wrapperfullkey→localreadstate；defaultPROCESS/ASSIGNED/limit20。
- Input/output and state mapping: queryfilters/afterTaskId；readsequence/AbortController；pagingstack。
- Error and edge behavior: emptyitems+next允许Next；readfailure清page；sameframe旧reply不覆盖；CASElink直到casepageauthorized再开放。
- Standards impact: MC-REUSE-001, MC-TIME-001, MC-SCOPE-001, MC-TEST-001；既有TS/AntD/SDK结构，不触Java/DB/dependency。
- Literal rule enforcement: Rule 9, Rule 11；保留主Spec逐条适用性与原模块边界。
- Implementation pseudocode:
```typescript
A: default export TaskInboxPage returning null only; B starts after File2 assertion RED
B: key frame by issuer/tenant/subject/requestEpoch/resource and filters; read via query with abort+serial guard
render current table/filters and cursor buttons; next nonnull enables even empty; no auto polling/admin query
```
- Verification contribution: TEST-503/507。
- After this file: inbox组件行为GREEN；等待Apptask接线。

#### File 6 — `CREATE src/pages/TaskSchemaForm.tsx`
- Purpose: TaskSchemaForm/FormValues controlledprops，仅本Step职责。
- Symbols: TaskSchemaForm/FormValues controlledprops。
- Repository evidence: AntDForm/Input/Select既有用法。
- Dependencies and consumers: humanTask.formSchema；TaskDetail callbacks。
- Why now: 按本Step RED→最小GREEN→接线顺序；compile seam仅A-pass，B-pass须等真实RED。
- Contract/signature changes: props schema/kind/approvalField/disabled/onSubmit；no generic schemaengine。
- Input/output and state mapping: exactallkeys；STRING保空、INTEGER显式十进制parse、BOOLEAN无默认。
- Error and edge behavior: prototype-safeentries；NUL/unpaired/utf16bytes；false有效；无额外变量。
- Standards impact: MC-VALID-001, MC-JSON-001, MC-SCOPE-001；既有TS/AntD/SDK结构，不触Java/DB/dependency。
- Literal rule enforcement: Rule 11；保留主Spec逐条适用性与原模块边界。
- Implementation pseudocode:
```typescript
A: declare typed props and return null; B begins after File3 form assertion RED
B: render Object.entries(schema) using STRING Input, INTEGER text input+bounded parse, BOOLEAN Select
validate all exact keys with current schema; approval has explicit approve/reject no default; emit primitive form only
```
- Verification contribution: TEST-504。
- After this file: schemaformtestsGREEN，消费页面保留frozenstate控制。

#### File 7 — `CREATE src/pages/TaskDetailPage.tsx`
- Purpose: TaskDetailPage/TaskDetailContent/read/send/propose，仅本Step职责。
- Symbols: TaskDetailPage/TaskDetailContent/read/send/propose。
- Repository evidence: MemoryIntentStatusfullkey/proposedpending/Modal/AbortController。
- Dependencies and consumers: humanTasksApi/actionReducer/TaskSchemaForm/useAuth；App。
- Why now: 按本Step RED→最小GREEN→接线顺序；compile seam仅A-pass，B-pass须等真实RED。
- Contract/signature changes: fullidentity+taskIdkey；pageeffects由state驱动。
- Input/output and state mapping: freshget→readonlytask；flags∩resource；command UUID/version/formdeepcopy；receipt独立。
- Error and edge behavior: synchronouswrite lock；unknownfreeze/manualexactretry；408/429/5xx未知；positiveknown4xxfreshread；serverrole/applicant权威。
- Standards impact: MC-VALID-001, MC-PATTERN-001, MC-TIME-001, MC-SCOPE-001；既有TS/AntD/SDK结构，不触Java/DB/dependency。
- Literal rule enforcement: Rule 9, Rule 11；保留主Spec逐条适用性与原模块边界。
- Implementation pseudocode:
```typescript
A: export component returning null; B after File4 assertion RED captures full identity+taskId and page-owned controllers
B: propose immutable command plus captured HumanTask source once; api.method(tenant,command,source,signal) under write ref;408/429/network/5xx/invalidsuccess→unknown
on validated receipt clear writable facts and fresh get; on400/401/403/404/409 clear pending+facts; render safe404 copy/UTC/receipt
```
- Verification contribution: TEST-504/507/508。
- After this file: detailtestsGREEN；未知命令只留本frame，无全局provider。

#### File 8 — `MODIFY src/permissions/permissions.ts`
- Purpose: TASK_READ/TASK_CLAIM/TASK_COMPLETE/TASK_TRANSFER，仅本Step职责。
- Symbols: TASK_READ/TASK_CLAIM/TASK_COMPLETE/TASK_TRANSFER。
- Repository evidence: 现有四entrypoint/SessionRoutes/Shell，同名符号已核。
- Dependencies and consumers: File1 App tests+taskpages；existingregistry/buildConsumer。
- Why now: 按本Step RED→最小GREEN→接线顺序；compile seam仅A-pass，B-pass须等真实RED。
- Contract/signature changes: 只新增taskdelta，Case字段等Step3。
- Input/output and state mapping: permissioncode→ownedresource→label/APIreference；不改serverrole。
- Error and edge behavior: task-only可达；按钮不因menu可见而放权；旧key保持。
- Standards impact: MC-ARCH-001, MC-REUSE-001, MC-SCOPE-001, MC-TEST-001；既有TS/AntD/SDK结构，不触Java/DB/dependency。
- Literal rule enforcement: Rule 11；保留主Spec逐条适用性与原模块边界。
- Implementation pseudocode:
```typescript
define exact TIANJI_TASK_* constants matching existing server permissions
append four references to existing definePermissionReferences call
preserve original READ/START/CANCEL/MEMORY codes and all existing exports
```
- Verification contribution: TEST-507/510。
- After this file: taskroute/permissionwiring完整，可跑App+PAC GREEN。

#### File 9 — `MODIFY src/permissions/resources.ts`
- Purpose: taskInbox/taskDetail/tasks menu/fourtaskbuttons/appANY，仅本Step职责。
- Symbols: taskInbox/taskDetail/tasks menu/fourtaskbuttons/appANY。
- Repository evidence: 现有四entrypoint/SessionRoutes/Shell，同名符号已核。
- Dependencies and consumers: File1 App tests+taskpages；existingregistry/buildConsumer。
- Why now: 按本Step RED→最小GREEN→接线顺序；compile seam仅A-pass，B-pass须等真实RED。
- Contract/signature changes: 只新增taskdelta，Case字段等Step3。
- Input/output and state mapping: permissioncode→ownedresource→label/APIreference；不改serverrole。
- Error and edge behavior: task-only可达；按钮不因menu可见而放权；旧key保持。
- Standards impact: MC-ARCH-001, MC-REUSE-001, MC-SCOPE-001, MC-TEST-001；既有TS/AntD/SDK结构，不触Java/DB/dependency。
- Literal rule enforcement: Rule 11；保留主Spec逐条适用性与原模块边界。
- Implementation pseudocode:
```typescript
add page /tasks and /tasks/:taskId, menu under tianji.app.console with TASK_READ
add claim/unclaim READ+CLAIM, transfer READ+TRANSFER, complete READ+COMPLETE owned BUTTON resources
add TASK_READ to app ANY and bind all new resources to existing pageCode/labelKeys
```
- Verification contribution: TEST-507/510。
- After this file: taskroute/permissionwiring完整，可跑App+PAC GREEN。

#### File 10 — `MODIFY src/permissions/references.ts`
- Purpose: six exacttaskCALLS，仅本Step职责。
- Symbols: six exacttaskCALLS。
- Repository evidence: 现有四entrypoint/SessionRoutes/Shell，同名符号已核。
- Dependencies and consumers: File1 App tests+taskpages；existingregistry/buildConsumer。
- Why now: 按本Step RED→最小GREEN→接线顺序；compile seam仅A-pass，B-pass须等真实RED。
- Contract/signature changes: 只新增taskdelta，Case字段等Step3。
- Input/output and state mapping: permissioncode→ownedresource→label/APIreference；不改serverrole。
- Error and edge behavior: task-only可达；按钮不因menu可见而放权；旧key保持。
- Standards impact: MC-ARCH-001, MC-REUSE-001, MC-SCOPE-001, MC-TEST-001；既有TS/AntD/SDK结构，不触Java/DB/dependency。
- Literal rule enforcement: Rule 11；保留主Spec逐条适用性与原模块边界。
- Implementation pseudocode:
```typescript
append tianji.api.process.task.query/get/claim/unclaim/transfer/complete as CALLS
keep prior Agent/Memory references bytewise behavior unchanged
add neither adminQuery nor approval.verify nor any owned API definition
```
- Verification contribution: TEST-507/510。
- After this file: taskroute/permissionwiring完整，可跑App+PAC GREEN。

#### File 11 — `MODIFY src/permissions/messages.ts`
- Purpose: newtaskownedlabels zh-CN/en-US，仅本Step职责。
- Symbols: newtaskownedlabels zh-CN/en-US。
- Repository evidence: 现有四entrypoint/SessionRoutes/Shell，同名符号已核。
- Dependencies and consumers: File1 App tests+taskpages；existingregistry/buildConsumer。
- Why now: 按本Step RED→最小GREEN→接线顺序；compile seam仅A-pass，B-pass须等真实RED。
- Contract/signature changes: 只新增taskdelta，Case字段等Step3。
- Input/output and state mapping: permissioncode→ownedresource→label/APIreference；不改serverrole。
- Error and edge behavior: task-only可达；按钮不因menu可见而放权；旧key保持。
- Standards impact: MC-ARCH-001, MC-REUSE-001, MC-SCOPE-001, MC-TEST-001；既有TS/AntD/SDK结构，不触Java/DB/dependency。
- Literal rule enforcement: Rule 11；保留主Spec逐条适用性与原模块边界。
- Implementation pseudocode:
```typescript
append labels for task pages/menu/claim/unclaim/transfer/complete using defineMessages
set defaultLocale zh-CN and both zh-CN/en-US defaults on existing tianji.web.permissions pageCode
assert every new resource labelKey resolves and no unrelated message is changed
```
- Verification contribution: TEST-507/510。
- After this file: taskroute/permissionwiring完整，可跑App+PAC GREEN。

#### File 12 — `MODIFY src/App.tsx`
- Purpose: SessionRoutes/Shell taskroutes/navigation/landing，仅本Step职责。
- Symbols: SessionRoutes/Shell taskroutes/navigation/landing。
- Repository evidence: 现有四entrypoint/SessionRoutes/Shell，同名符号已核。
- Dependencies and consumers: File1 App tests+taskpages；existingregistry/buildConsumer。
- Why now: 按本Step RED→最小GREEN→接线顺序；compile seam仅A-pass，B-pass须等真实RED。
- Contract/signature changes: 只新增taskdelta，Case字段等Step3。
- Input/output and state mapping: permissioncode→ownedresource→label/APIreference；不改serverrole。
- Error and edge behavior: task-only可达；按钮不因menu可见而放权；旧key保持。
- Standards impact: MC-ARCH-001, MC-REUSE-001, MC-SCOPE-001, MC-TEST-001；既有TS/AntD/SDK结构，不触Java/DB/dependency。
- Literal rule enforcement: Rule 11；保留主Spec逐条适用性与原模块边界。
- Implementation pseudocode:
```typescript
import TaskInboxPage/TaskDetailPage; add /tasks and /tasks/:taskId inside existing RequireResource guards
add task menu only via tianji.menu.tasks; landing first allowed runs→memory→tasks, else403
preserve BrowserRouter basePath validation, session UI, embedded layout and all prior routes
```
- Verification contribution: TEST-507/510。
- After this file: taskroute/permissionwiring完整，可跑App+PAC GREEN。

#### File 13 — `MODIFY README.md`
- Purpose: taskcapability/uncertainresult/approval/validationlimits，仅本Step职责。
- Symbols: taskcapability/uncertainresult/approval/validationlimits。
- Repository evidence: existingREADME功能段落/Configuration/Validation。
- Dependencies and consumers: 当前Step实际taskbehavior与Rootresults。
- Why now: 按本Step RED→最小GREEN→接线顺序；compile seam仅A-pass，B-pass须等真实RED。
- Contract/signature changes: 新增task说明，不改命令/部署配置。
- Input/output and state mapping: my/candidate/allvisible、lane非用户、serverrole、explicitfalse、unknownfreeze。
- Error and edge behavior: 404不可断言completed；Case未上线先不宣称Case能力。
- Standards impact: MC-SCOPE-001, MC-TEST-001；既有TS/AntD/SDK结构，不触Java/DB/dependency。
- Literal rule enforcement: Rule 11；保留主Spec逐条适用性与原模块边界。
- Implementation pseudocode:
```typescript
document current task inbox/claim/unclaim/lane transfer/schema approval behavior in existing README style
state server applicant-role authority and exact same-command manual retry after 408/429/unknown outcomes
retain existing build commands and static/mock versus user-started runtime/browser limitations
```
- Verification contribution: Rootdiff/TEST-510。
- After this file: README如实反映taskcommit，无Case提前宣传。

#### File 14 — `MODIFY docs/egon/evidence/2026-11-04-task-case-approval-web.md`
- Purpose: Step2 evidenceappend，仅本Step职责。
- Symbols: Step2 evidenceappend。
- Repository evidence: Step1同一文档。
- Dependencies and consumers: Root真实RED/GREEN/typecheck/lint/build/stageddiff。
- Why now: 按本Step RED→最小GREEN→接线顺序；compile seam仅A-pass，B-pass须等真实RED。
- Contract/signature changes: appendStep2，不改Step1历史结果。
- Input/output and state mapping: timestamps/exits/testcounts/manifest/allowedpaths。
- Error and edge behavior: 失败如实归因；无GUI/nativeacceptance。
- Standards impact: MC-SCOPE-001, MC-TEST-001, MC-BLOCKER-001；既有TS/AntD/SDK结构，不触Java/DB/dependency。
- Literal rule enforcement: Rule 11；保留主Spec逐条适用性与原模块边界。
- Implementation pseudocode:
```typescript
append actual App/form/page assertion RED and successful focused/regression/static/build outputs
record full identity race, 408/429 original retry, approval false and empty-next assertions
append exact staged paths/commit SHA and mark S08/S09/native/browser still unverified
```
- Verification contribution: TEST-510。
- After this file: Step2证据/commit边界完整。

- Validation working directory: `/Users/mario/SelfProject/Stellar-Enclosure/tianji-web`。
- Verification command: `npm test -- src/App.test.tsx src/pages/TaskInboxPage.test.tsx src/pages/TaskSchemaForm.test.tsx src/pages/TaskDetailPage.test.tsx`；随后§8对应Step静态/官方build门。
- Expected result: RED为指定assertion失败；GREEN全通过、typecheck/lint/build exit0，manifest/diff与scope相符。
- Failure returns to: 本Step最早失败file；contract矛盾回主Spec，不能改backend/放宽validator；未GREEN不得commit。
- Completion criteria: task完整Mockpath+fullidentity/unknown/formboundaries证明；原62tests回归；官方PACtaskresource/CALLS通过；Case仍未接线；逐项MC/Rule设计与实际结果写evidence，Root审stageddiff后提交。
- Rollback: 未提交仅还原本Step自有改动并保留外部work；已提交如需回滚用聚焦revert，不重写history，不变server。
- Commit paths: `src/App.test.tsx`; `src/pages/TaskInboxPage.test.tsx`; `src/pages/TaskSchemaForm.test.tsx`; `src/pages/TaskDetailPage.test.tsx`; `src/pages/TaskInboxPage.tsx`; `src/pages/TaskSchemaForm.tsx`; `src/pages/TaskDetailPage.tsx`; `src/permissions/permissions.ts`; `src/permissions/resources.ts`; `src/permissions/references.ts`; `src/permissions/messages.ts`; `src/App.tsx`; `README.md`; `docs/egon/evidence/2026-11-04-task-case-approval-web.md`。
- Commit: `feat(tianji-web): add current-user task inbox and approval`。

本Step逐条设计检查（PASS是Plan可执行性，不是实现已通过）：

| Literal rule | Status | Evidence / enforcement |
| --- | --- | --- |
| Rule 1 | N/A | Step 2；仅TS/docs，无Java命名 |
| Rule 2 | N/A | Step 2；无Javahandoff；TSvalidation由TEST-501/504证明 |
| Rule 3 | N/A | Step 2；无JavaPOJO/MapStruct，readonlyTS |
| Rule 4 | N/A | Step 2；无SpringBean/DI/log类 |
| Rule 5 | N/A | Step 2；无Javautility/新依赖 |
| Rule 6 | N/A | Step 2；Jackson未变；consumerwire按C/CL |
| Rule 7 | N/A | Step 2；无Springprofile/env；PAC锁仅artifactSHA |
| Rule 9 | PASS | Step 2；State已定义；本Step创建或使用封闭transition协议 |
| Rule 10 | N/A | Step 2；无Java时间变化；TIME-501 rawstring/UTC显示 |
| Rule 11 | PASS | Step 2；src/api/pages/App/permissions既有结构，SDK复用；全部files受scope审计 |

| Check ID | Applicability | Status | Evidence | Finding | Required action/exception |
| --- | --- | --- | --- | --- | --- |
| MC-ARCH-001 | Applicable | PASS | Step 2：§5既有TS目标tree，Rule11 | Plan义务明确，执行前后按此核实 | None |
| MC-REUSE-001 | Applicable | PASS | Step 2：requestJson/AuthContext/AntD/fixture前例 | Plan义务明确，执行前后按此核实 | None |
| MC-DEP-001 | Applicable | PASS | Step 2：package/lock/scripts原样；仅批准PACartifactSHA | Plan义务明确，执行前后按此核实 | None |
| MC-NAME-001 | Not applicable | N/A | Step 2：只有TS/docs，无Java类型 | Java限定关注点未变化 | None |
| MC-VALID-001 | Applicable | PASS | Step 2：主Spec§10/12，API/form负测 | Plan义务明确，执行前后按此核实 | None |
| MC-MODEL-001 | Not applicable | N/A | Step 2：readonlyTS，无Java构造 | Java限定关注点未变化 | None |
| MC-CONVERT-001 | Not applicable | N/A | Step 2：无JavaMapStruct/BaseConverter变更 | Java限定关注点未变化 | None |
| MC-LOG-001 | Not applicable | N/A | Step 2：无JavaBean/新日志，form不写console | Java限定关注点未变化 | None |
| MC-BEAN-001 | Not applicable | N/A | Step 2：无Spring/DI文件 | Java限定关注点未变化 | None |
| MC-UTIL-001 | Not applicable | N/A | Step 2：无Javautility/newdependency | Java限定关注点未变化 | None |
| MC-JSON-001 | Applicable | PASS | Step 2：C/CL字段/nullable/affinity测试 | Plan义务明确，执行前后按此核实 | None |
| MC-TIME-001 | Applicable | PASS | Step 2：TIME-501；TEST-506，无DB/timezone业务计算 | Plan义务明确，执行前后按此核实 | None |
| MC-CONFIG-001 | Not applicable | N/A | Step 2：无Springprofile/frontendenvkey变更 | Java限定关注点未变化 | None |
| MC-PATTERN-001 | Applicable | PASS | Step 2：actionReducer封闭State及pageeffects | Plan义务明确，执行前后按此核实 | None |
| MC-SCOPE-001 | Applicable | PASS | Step 2：本Step exactpaths与unchangedbaseline | Plan义务明确，执行前后按此核实 | None |
| MC-TEST-001 | Applicable | PASS | Step 2：§8真实RED/GREEN/静态/PAC gates | Plan义务明确，执行前后按此核实 | None |
| MC-BLOCKER-001 | Applicable | PASS | Step 2：本Step文件/规则/MC逐条设计闭合，runtime边界保留 | Plan义务明确，执行前后按此核实 | None |

### Step 3 — 交付Case查询详情与允许计划项操作并完成审计
- Requirements: REQ-501, REQ-505, REQ-506, REQ-507, REQ-508, REQ-509, REQ-510
- Dependencies: Step2 commit完成且Root核HEAD/cleanstatus
- Baseline state: task用户路径已commit，Case API/fixtures来自Step1，无Case routes
- Observable outcome: 交付Case查询详情与允许计划项操作并完成审计。
- End state: Case IDlookup/currentfacts/serveractions+本页confirmedreceipts，最终10REQ源码一致性审计
- Test-first gate: Required — Appcase-only授权无可达Casepage断言失败；A-shellCase内容断言失败；missingimport/compile/fixture环境错不算RED。
- Manual Checks: MC-ARCH-001, MC-REUSE-001, MC-DEP-001, MC-NAME-001, MC-VALID-001, MC-MODEL-001, MC-CONVERT-001, MC-LOG-001, MC-BEAN-001, MC-UTIL-001, MC-JSON-001, MC-TIME-001, MC-CONFIG-001, MC-PATTERN-001, MC-SCOPE-001, MC-TEST-001, MC-BLOCKER-001。
- Literal Rules: Rule 1, Rule 2, Rule 3, Rule 4, Rule 5, Rule 6, Rule 7, Rule 9, Rule 10, Rule 11；逐项适用性见本Step末表；Rule11始终Applicable PASS。
- Ordered files: 按以下File编号；A-pass compile-only签名先于tests，RED后回访已列生产file的B-pass，禁止提前写validation/render行为。

#### File 1 — `MODIFY src/App.test.tsx`
- Purpose: case-onlyroutes/landing/menu/button regressions，仅本Step职责。
- Symbols: case-onlyroutes/landing/menu/button regressions。
- Repository evidence: Step2 App tests。
- Dependencies and consumers: 既有App无Case实现，先RED；File7接线。
- Why now: 按本Step RED→最小GREEN→接线顺序；compile seam仅A-pass，B-pass须等真实RED。
- Contract/signature changes: addcase-onlyauthcases，旧assertions保留。
- Input/output and state mapping: orderedlanding runs→memory→tasks→cases；directpageguard。
- Error and edge behavior: read与act权限分开；无start/menu绕权。
- Standards impact: MC-SCOPE-001, MC-TEST-001；既有TS/AntD/SDK结构，不触Java/DB/dependency。
- Literal rule enforcement: Rule 11；保留主Spec逐条适用性与原模块边界。
- Implementation pseudocode:
```typescript
render App with TIANJI_CASE_READ only, expect heading 案件查询 and correct /cases landing
assert missing CASE_READ blocks direct case route and menu, while missing act only removes actions
retain task-only/run/memory tests and verify landing chooses first authorized page
```
- Verification contribution: TEST-507。
- After this file: 记录现有App Case不可达的真实RED。

#### File 2 — `CREATE src/pages/CaseDetailPage.test.tsx`
- Purpose: lookup/currentfacts/actions/receipt/unknown/scope tests，仅本Step职责。
- Symbols: lookup/currentfacts/actions/receipt/unknown/scope tests。
- Repository evidence: Casefixtures、Memorydeferredpromise风格。
- Dependencies and consumers: A-shell File3；casesApi+useAuth mock。
- Why now: 按本Step RED→最小GREEN→接线顺序；compile seam仅A-pass，B-pass须等真实RED。
- Contract/signature changes: componenttests不调用native/backend。
- Input/output and state mapping: terminal sparse/currentactionintersection/UTC facts/confirmedreceiptlabel。
- Error and edge behavior: 禁止历史伪事件/全案terminate/COMPLETE；408/429exactretry；oldframeignored。
- Standards impact: MC-SCOPE-001, MC-TEST-001；既有TS/AntD/SDK结构，不触Java/DB/dependency。
- Literal rule enforcement: Rule 11；保留主Spec逐条适用性与原模块边界。
- Implementation pseudocode:
```typescript
render A-shell and expect Case ID label/facts to fail as genuine content RED
exercise server subset vs state, terminate confirmation, dynamic terminal refresh and sparse planItems
assert 本页操作回执 label, submitted/finished facts only, unknown408/429 freeze+exactretry and fullidentity/reset
```
- Verification contribution: TEST-505/506/507/508。
- After this file: Case真实componentRED后允许B实现。

#### File 3 — `CREATE src/pages/CaseDetailPage.tsx`
- Purpose: CaseDetailPage/CaseDetailContent/lookup/propose/send/read，仅本Step职责。
- Symbols: CaseDetailPage/CaseDetailContent/lookup/propose/send/read。
- Repository evidence: existingAntD page style；主Spec§12。
- Dependencies and consumers: casesApi/actionReducer/useAuth；App/taskCASElink。
- Why now: 按本Step RED→最小GREEN→接线顺序；compile seam仅A-pass，B-pass须等真实RED。
- Contract/signature changes: routeID可选；/cases仅lookup，/cases/:id读取。
- Input/output and state mapping: fullidentity+caseIDkey；currentDTO/readonlycommand/receipt分存；UTCrawinstants。
- Error and edge behavior: ACTIVE∩serverlist∩resource；TERMINATE逐项确认；unknown冻结ID/read/actions；knownreject清facts；404非completed。
- Standards impact: MC-VALID-001, MC-PATTERN-001, MC-TIME-001, MC-SCOPE-001；既有TS/AntD/SDK结构，不触Java/DB/dependency。
- Literal rule enforcement: Rule 9, Rule 11；保留主Spec逐条适用性与原模块边界。
- Implementation pseudocode:
```typescript
A: declare component with null render; B after File2 RED keys frame by issuer/tenant/subject/epoch/case/resource
B: validate Java-compatible Case ID, navigate/get; display current snapshot and submitted/finished UTC facts only
propose frozen command plus CaseInstance source; actPlanItem(tenant,command,source,signal), syncwrite lock; unknown keeps same command/source;receipt→freshget and 本页操作回执
```
- Verification contribution: TEST-505/506/507/508。
- After this file: Case组件GREEN，待permission/router接线。

#### File 4 — `MODIFY src/permissions/permissions.ts`
- Purpose: CASE_READ/CASE_PLAN_ITEM_ACT，仅本Step职责。
- Symbols: CASE_READ/CASE_PLAN_ITEM_ACT。
- Repository evidence: Step2同名符号/defineResources/defineMessages风格。
- Dependencies and consumers: File1/2tests+Casepage；registryexistingbuild。
- Why now: 按本Step RED→最小GREEN→接线顺序；compile seam仅A-pass，B-pass须等真实RED。
- Contract/signature changes: 只加Case差量，既有资源完整保留。
- Input/output and state mapping: CASE_READ→pages/menu；READ+ACT→button；twoAPIrefs。
- Error and edge behavior: task回归不能删改权限；roleauthority仍server。
- Standards impact: MC-ARCH-001, MC-REUSE-001, MC-SCOPE-001, MC-TEST-001；既有TS/AntD/SDK结构，不触Java/DB/dependency。
- Literal rule enforcement: Rule 11；保留主Spec逐条适用性与原模块边界。
- Implementation pseudocode:
```typescript
append exact TIANJI_CASE_READ and TIANJI_CASE_PLAN_ITEM_ACT constants and references
preserve all task/run/memory permission references introduced before this Step
add no CASE_START, SERVICE scope, approval verify or administrator permission
```
- Verification contribution: TEST-507/510。
- After this file: Case route/permission GREEN，完整PAC清单可核。

#### File 5 — `MODIFY src/permissions/resources.ts`
- Purpose: cases/caseDetail/casesmenu/actPlanItem/appANY，仅本Step职责。
- Symbols: cases/caseDetail/casesmenu/actPlanItem/appANY。
- Repository evidence: Step2同名符号/defineResources/defineMessages风格。
- Dependencies and consumers: File1/2tests+Casepage；registryexistingbuild。
- Why now: 按本Step RED→最小GREEN→接线顺序；compile seam仅A-pass，B-pass须等真实RED。
- Contract/signature changes: 只加Case差量，既有资源完整保留。
- Input/output and state mapping: CASE_READ→pages/menu；READ+ACT→button；twoAPIrefs。
- Error and edge behavior: task回归不能删改权限；roleauthority仍server。
- Standards impact: MC-ARCH-001, MC-REUSE-001, MC-SCOPE-001, MC-TEST-001；既有TS/AntD/SDK结构，不触Java/DB/dependency。
- Literal rule enforcement: Rule 11；保留主Spec逐条适用性与原模块边界。
- Implementation pseudocode:
```typescript
add /cases lookup and /cases/:caseInstanceId detail PAGE plus cases MENU with CASE_READ
add single actPlanItem BUTTON requiring CASE_READ and CASE_PLAN_ITEM_ACT; app ANY gains CASE_READ
retain every task resource and label binding, never derive authority from availableActions alone
```
- Verification contribution: TEST-507/510。
- After this file: Case route/permission GREEN，完整PAC清单可核。

#### File 6 — `MODIFY src/permissions/references.ts`
- Purpose: caseget/actPlanItem exactCALLS，仅本Step职责。
- Symbols: caseget/actPlanItem exactCALLS。
- Repository evidence: Step2同名符号/defineResources/defineMessages风格。
- Dependencies and consumers: File1/2tests+Casepage；registryexistingbuild。
- Why now: 按本Step RED→最小GREEN→接线顺序；compile seam仅A-pass，B-pass须等真实RED。
- Contract/signature changes: 只加Case差量，既有资源完整保留。
- Input/output and state mapping: CASE_READ→pages/menu；READ+ACT→button；twoAPIrefs。
- Error and edge behavior: task回归不能删改权限；roleauthority仍server。
- Standards impact: MC-ARCH-001, MC-REUSE-001, MC-SCOPE-001, MC-TEST-001；既有TS/AntD/SDK结构，不触Java/DB/dependency。
- Literal rule enforcement: Rule 11；保留主Spec逐条适用性与原模块边界。
- Implementation pseudocode:
```typescript
append tianji.api.process.case.get and tianji.api.process.case.actPlanItem as CALLS
keep six task references unchanged and validate existing producer ownership resolution
add no case.start/list/history/admin/approval verification wrapper or reference
```
- Verification contribution: TEST-507/510。
- After this file: Case route/permission GREEN，完整PAC清单可核。

#### File 7 — `MODIFY src/permissions/messages.ts`
- Purpose: Caseownedlabels zh-CN/en-US，仅本Step职责。
- Symbols: Caseownedlabels zh-CN/en-US。
- Repository evidence: Step2同名符号/defineResources/defineMessages风格。
- Dependencies and consumers: File1/2tests+Casepage；registryexistingbuild。
- Why now: 按本Step RED→最小GREEN→接线顺序；compile seam仅A-pass，B-pass须等真实RED。
- Contract/signature changes: 只加Case差量，既有资源完整保留。
- Input/output and state mapping: CASE_READ→pages/menu；READ+ACT→button；twoAPIrefs。
- Error and edge behavior: task回归不能删改权限；roleauthority仍server。
- Standards impact: MC-ARCH-001, MC-REUSE-001, MC-SCOPE-001, MC-TEST-001；既有TS/AntD/SDK结构，不触Java/DB/dependency。
- Literal rule enforcement: Rule 11；保留主Spec逐条适用性与原模块边界。
- Implementation pseudocode:
```typescript
append cases lookup/detail/menu and actPlanItem labels on tianji.web.permissions
use existing defaultLocale zh-CN plus zh-CN/en-US values for every new labelKey
retain all prior messages and ensure resource registry build has no dangling labels
```
- Verification contribution: TEST-507/510。
- After this file: Case route/permission GREEN，完整PAC清单可核。

#### File 8 — `MODIFY src/App.tsx`
- Purpose: CaseDetail routes/Shellcasemenu/finalorderedlanding，仅本Step职责。
- Symbols: CaseDetail routes/Shellcasemenu/finalorderedlanding。
- Repository evidence: Step2同名符号/defineResources/defineMessages风格。
- Dependencies and consumers: File1/2tests+Casepage；registryexistingbuild。
- Why now: 按本Step RED→最小GREEN→接线顺序；compile seam仅A-pass，B-pass须等真实RED。
- Contract/signature changes: 只加Case差量，既有资源完整保留。
- Input/output and state mapping: CASE_READ→pages/menu；READ+ACT→button；twoAPIrefs。
- Error and edge behavior: task回归不能删改权限；roleauthority仍server。
- Standards impact: MC-ARCH-001, MC-REUSE-001, MC-SCOPE-001, MC-TEST-001；既有TS/AntD/SDK结构，不触Java/DB/dependency。
- Literal rule enforcement: Rule 11；保留主Spec逐条适用性与原模块边界。
- Implementation pseudocode:
```typescript
import CaseDetailPage, guard /cases and /cases/:caseInstanceId with their exact page resources
append authorized Case menu; landing picks first allowed runs→memory→tasks→cases else403
preserve task/run/memory routes and embedded/session/basePath behavior; CASE task link now resolves authorized route
```
- Verification contribution: TEST-507/510。
- After this file: Case route/permission GREEN，完整PAC清单可核。

#### File 9 — `MODIFY README.md`
- Purpose: Casecapability and finalacceptancelimits，仅本Step职责。
- Symbols: Casecapability and finalacceptancelimits。
- Repository evidence: Step2README existingsections。
- Dependencies and consumers: 最终Case页面及tests。
- Why now: 按本Step RED→最小GREEN→接线顺序；compile seam仅A-pass，B-pass须等真实RED。
- Contract/signature changes: addCase段落，不变命令/config。
- Input/output and state mapping: IDonly/currentfacts/serveractions/confirmedreceipts；无fullhistory。
- Error and edge behavior: terminal sparse正常；receipt历史不开放写；runtime S09仍未执行。
- Standards impact: MC-SCOPE-001, MC-TEST-001；既有TS/AntD/SDK结构，不触Java/DB/dependency。
- Literal rule enforcement: Rule 11；保留主Spec逐条适用性与原模块边界。
- Implementation pseudocode:
```typescript
document Case ID lookup and finite plan item controls using server availableActions plus current permission
label timeline as submitted/finished facts and 本页确认操作回执, not complete audit or latest current state
retain task exact retry/security sections and explicit user-started browser/native/IAM acceptance boundary
```
- Verification contribution: Rootfinaldiff/TEST-510。
- After this file: README与最终功能一致，无native/runtime虚报。

#### File 10 — `MODIFY docs/egon/evidence/2026-11-04-task-case-approval-web.md`
- Purpose: Step3 + finalsourceconformanceaudit，仅本Step职责。
- Symbols: Step3 + finalsourceconformanceaudit。
- Repository evidence: Step1/2既有证据、主Spec10REQ。
- Dependencies and consumers: Root真实commands/stagedsource/SHA。
- Why now: 按本Step RED→最小GREEN→接线顺序；compile seam仅A-pass，B-pass须等真实RED。
- Contract/signature changes: append逐REQ最终implemented/tested/unverified分类。
- Input/output and state mapping: 全部§5path/10REQ/17MC/10Rule、三commits、baselineexcludedhash。
- Error and edge behavior: 只staticMock通过不宣布native S08S09或权限已激活；noAutoStart。
- Standards impact: MC-SCOPE-001, MC-TEST-001, MC-BLOCKER-001；既有TS/AntD/SDK结构，不触Java/DB/dependency。
- Literal rule enforcement: Rule 11；保留主Spec逐条适用性与原模块边界。
- Implementation pseudocode:
```typescript
append actual Case/App RED/GREEN and final full tests/typecheck/lint/official build plus manifest digest review
compare every REQ501..510 to actual source and focused assertions; audit all permitted/untouched file hashes and old routes
record final three commits, no unresolved source requirement, and separate browser/gateway/IAM/PG/S08S09 runtime-unverified list
```
- Verification contribution: TEST-510/finalaudit。
- After this file: 最终sourceconformance闭合；User自行启动runtime。

- Validation working directory: `/Users/mario/SelfProject/Stellar-Enclosure/tianji-web`。
- Verification command: `npm test -- src/App.test.tsx src/pages/CaseDetailPage.test.tsx`；随后§8对应Step静态/官方build门。
- Expected result: RED为指定assertion失败；GREEN全通过、typecheck/lint/build exit0，manifest/diff与scope相符。
- Failure returns to: 本Step最早失败file；contract矛盾回主Spec，不能改backend/放宽validator；未GREEN不得commit。
- Completion criteria: Case与task全部主Spec源码要求/负测一致；fullsuite/typecheck/lint/PAC GREEN；exactsourceconformance完成；runtime未验收独立保留；逐项MC/Rule设计与实际结果写evidence，Root审stageddiff后提交。
- Rollback: 未提交仅还原本Step自有改动并保留外部work；已提交如需回滚用聚焦revert，不重写history，不变server。
- Commit paths: `src/App.test.tsx`; `src/pages/CaseDetailPage.test.tsx`; `src/pages/CaseDetailPage.tsx`; `src/permissions/permissions.ts`; `src/permissions/resources.ts`; `src/permissions/references.ts`; `src/permissions/messages.ts`; `src/App.tsx`; `README.md`; `docs/egon/evidence/2026-11-04-task-case-approval-web.md`。
- Commit: `feat(tianji-web): add governed case detail actions`。

本Step逐条设计检查（PASS是Plan可执行性，不是实现已通过）：

| Literal rule | Status | Evidence / enforcement |
| --- | --- | --- |
| Rule 1 | N/A | Step 3；仅TS/docs，无Java命名 |
| Rule 2 | N/A | Step 3；无Javahandoff；TSvalidation由TEST-501/504证明 |
| Rule 3 | N/A | Step 3；无JavaPOJO/MapStruct，readonlyTS |
| Rule 4 | N/A | Step 3；无SpringBean/DI/log类 |
| Rule 5 | N/A | Step 3；无Javautility/新依赖 |
| Rule 6 | N/A | Step 3；Jackson未变；consumerwire按C/CL |
| Rule 7 | N/A | Step 3；无Springprofile/env；PAC锁仅artifactSHA |
| Rule 9 | PASS | Step 3；State已定义；本Step创建或使用封闭transition协议 |
| Rule 10 | N/A | Step 3；无Java时间变化；TIME-501 rawstring/UTC显示 |
| Rule 11 | PASS | Step 3；src/api/pages/App/permissions既有结构，SDK复用；全部files受scope审计 |

| Check ID | Applicability | Status | Evidence | Finding | Required action/exception |
| --- | --- | --- | --- | --- | --- |
| MC-ARCH-001 | Applicable | PASS | Step 3：§5既有TS目标tree，Rule11 | Plan义务明确，执行前后按此核实 | None |
| MC-REUSE-001 | Applicable | PASS | Step 3：requestJson/AuthContext/AntD/fixture前例 | Plan义务明确，执行前后按此核实 | None |
| MC-DEP-001 | Applicable | PASS | Step 3：package/lock/scripts原样；仅批准PACartifactSHA | Plan义务明确，执行前后按此核实 | None |
| MC-NAME-001 | Not applicable | N/A | Step 3：只有TS/docs，无Java类型 | Java限定关注点未变化 | None |
| MC-VALID-001 | Applicable | PASS | Step 3：主Spec§10/12，API/form负测 | Plan义务明确，执行前后按此核实 | None |
| MC-MODEL-001 | Not applicable | N/A | Step 3：readonlyTS，无Java构造 | Java限定关注点未变化 | None |
| MC-CONVERT-001 | Not applicable | N/A | Step 3：无JavaMapStruct/BaseConverter变更 | Java限定关注点未变化 | None |
| MC-LOG-001 | Not applicable | N/A | Step 3：无JavaBean/新日志，form不写console | Java限定关注点未变化 | None |
| MC-BEAN-001 | Not applicable | N/A | Step 3：无Spring/DI文件 | Java限定关注点未变化 | None |
| MC-UTIL-001 | Not applicable | N/A | Step 3：无Javautility/newdependency | Java限定关注点未变化 | None |
| MC-JSON-001 | Applicable | PASS | Step 3：C/CL字段/nullable/affinity测试 | Plan义务明确，执行前后按此核实 | None |
| MC-TIME-001 | Applicable | PASS | Step 3：TIME-501；TEST-506，无DB/timezone业务计算 | Plan义务明确，执行前后按此核实 | None |
| MC-CONFIG-001 | Not applicable | N/A | Step 3：无Springprofile/frontendenvkey变更 | Java限定关注点未变化 | None |
| MC-PATTERN-001 | Applicable | PASS | Step 3：actionReducer封闭State及pageeffects | Plan义务明确，执行前后按此核实 | None |
| MC-SCOPE-001 | Applicable | PASS | Step 3：本Step exactpaths与unchangedbaseline | Plan义务明确，执行前后按此核实 | None |
| MC-TEST-001 | Applicable | PASS | Step 3：§8真实RED/GREEN/静态/PAC gates | Plan义务明确，执行前后按此核实 | None |
| MC-BLOCKER-001 | Applicable | PASS | Step 3：本Step文件/规则/MC逐条设计闭合，runtime边界保留 | Plan义务明确，执行前后按此核实 | None |

## 8. Test, Validation, and Quality Gates

所有执行cwd均 `/Users/mario/SelfProject/Stellar-Enclosure/tianji-web`，Root独占运行/commit。每Step使用§7自己的focused命令先记录真实assertion RED，再GREEN；随后 `npm run typecheck`、`npm run lint`、`npm test`、下述唯一官方build，均exit0才可stage/commit。没有缺失命令需要新harness，禁止增加scripts/work或绕开现有工具。

| Gate/order | Working directory | Command or method | Scope | Expected result | Failure returns to | Requirements/runtime boundary |
| --- | --- | --- | --- | --- | --- | --- |
| Step1 RED→GREEN | webroot | `npm test -- src/api/humanTasks.test.ts src/api/cases.test.ts src/pages/orchestrationAction.test.ts` | TEST-501/502/506/508 | 非法value接受/无transition真实RED→全部GREEN | Step1测试/decoder/State | REQ-502..510；纯合同Mock |
| Step2 RED→GREEN | webroot | `npm test -- src/App.test.tsx src/pages/TaskInboxPage.test.tsx src/pages/TaskSchemaForm.test.tsx src/pages/TaskDetailPage.test.tsx` | TEST-503/504/507/508 | 现App无route或A-shell缺内容真实RED→GREEN | Step2pages/resources/App | REQ-501..504/507..510；jsdom组件 |
| Step3 RED→GREEN | webroot | `npm test -- src/App.test.tsx src/pages/CaseDetailPage.test.tsx` | TEST-505..508 | Case-onlyroute/内容真实RED→GREEN | Step3Case/App/resources | REQ-501/505..510；jsdom组件 |
| 每Step静态/回归 | webroot | `npm run typecheck`；`npm run lint`；`npm test` | TypeScript/ESLint/全suite | exit0，原62test不退化；不宣称固定新增testcount | 当前Step最早失败file | all；无backend/native验收 |
| 每Step正式build | webroot | 下方固定env `npm run build` | TEST-510 | officialartifact/toolchain/manifest checks+Vite全通过 | lock仅Step1或本Step资源 | all；LOCAL_UNCOMMITTED不等于上线 |
| Step1 documents | outerroot | `python3 .agents/skills/stellar-enclosure-coding-writing-spec/scripts/validate_spec.py tianji-web/docs/egon/spec/2026-11-04-22-56-task-case-approval-web.md --strict`；同writing-plan路径`validate_plan.py tianji-web/docs/egon/plan/2026-11-04-23-14-task-case-approval-web.md --strict` | Spec/Plan | strict exit0，链接/metadata一致 | docs与原设计 | 结构检查非代码验收 |
| 每Step提交前 | webroot | `git diff --check`；`git diff --cached --stat`；`git diff --cached`；baseline逐SHA比较 | exactpaths/sourceboundary | 仅本Step授权paths；旧config/deps/SQL/backend不变 | 当前Step编辑owner | all；no deploy/grant |
| Step3 finalaudit | webroot | 逐行对照主Spec§4/8/10/12/14及本Plan§10，读取实际源码/断言/buildmanifest | 10REQ+17MC+10Rule | 必需源码无残项，unvalidatedruntime单列；按source而非文档自证 | 缺失要求所属Step或Spec | S08/S09 Required/RuntimeUnverified保留 |

正式build命令（Root已核本机Node24路径进入PATH后）：

```sh
PAC_SDK_DIR=/Users/mario/SelfProject/Stellar-Enclosure/web-sdk \
PAC_TOOLCHAIN_LOCK="$PWD/permission-toolchain.local.lock.json" \
PAC_CONTRACT_ARTIFACT=/var/folders/gb/vwfj36c909xgtbr0jl267d880000gp/T/tianji-web-task-case-contract-x71mc1hq/verified-contract.jar \
npm run build
```

官方lock重建只在Step1：使用SDK现有 `scripts/permissions/prepare-contract.mjs` 的 `createToolchainLock({artifact,artifactSha256,output:全新临时path,mode:'LOCAL_UNCOMMITTED'})` 与 `verifyToolchain(candidate)`。核candidate SHA、五entry/SDK/其余字段逐值等同oldlock且仅contract.sha256变化后Root复制；官方工具wx不能直接覆盖现有path。Root已有candidate可重新核对采用。提交不包含fixedJAR、dist/.generated、临时logs或node_modules。

408/429、网络/超时/未验证成功/5xx均unknown，必须原UUID+expectedVersion+exactbody手动重试，表单/查询/相关动作冻结；400/401/403/404/409明确拒绝则clear+freshread/reauthorize。任何401/403/tenant409保留现有AuthContext failclosed。UTF8 unsigned cursor排序不能用localeCompare；ID不能用JS trim或`\s`替代Java规则；原wire offset/nanos不能经Date再serialize。approve=false有效且必须显式选择。

本Plan阶段没有执行以上实现验证；Root已提供baseline62test与officialcandidate验证单列§6，不扩称本次新增行为GREEN。用户启动的环境仍需真实gateway/CSRF/IAM/grants/role/applicant、task推进/Timer竞争、Case→BPMN、PG/native与浏览器验收；本任务不自动启动任何runtime/GUI。

## 9. Migration, Compatibility, Rollout, and Rollback

数据库/Java/API迁移N/A：主Spec§11与当前C/CL/PS契约不变，所有旧Flyway不可编辑。本次只有Web资源和一个localartifactSHA，app读入口逐Step增加task再Case，不添加flags/env。PaCbuild产物只用于验证，catalog注册/激活/rolegrants与部署单独控制。普通ALL始终currentvisible、lane不是assignee，Casecontroller本已USER/SERVICE读但Web始终现有USERsession。

每Stepcommit前可修本Step路径；commit后以聚焦revert回滚，不改history/server进行中流程。最终回滚关闭Webroute/版本不等于撤回已提交任务/Case动作。README与evidence必须留明确未知结果和runtime未验收边界。完成后不自动启动项目，不打开浏览器。

## 10. Requirement-to-Step Traceability Matrix

| Requirement | Effective Spec section | Steps | Files | Tests/gates | Completion evidence |
| --- | --- | --- | --- | --- | --- |
| REQ-501 | §4/12 | Step2/3 | App+fourentrypoints+App.test | TEST-507/PAC | task/case-only identity及ownedresources |
| REQ-502 | §4/10/12 | Step1/2 | humanTasks/fixtures/Inbox | TEST-501/503 | all3selection、empty-next/filterreset |
| REQ-503 | §4/10/12 | Step1/2 | taskdecoder/Detail/resources | TEST-501/504 | flags∩resource、laneonly、serverdenial |
| REQ-504 | §4/10/12 | Step1/2 | taskdecoder/SchemaForm/Detail | TEST-501/504 | exactkeys/15digit/stringunicode/explicitfalse |
| REQ-505 | §4/10/12 | Step1/3 | cases/fixtures/CaseDetail | TEST-502/505/506 | IDonly、truefacts、sparseterminal |
| REQ-506 | §4/10/12 | Step1/3 | cases/CaseDetail/permissions | TEST-502/505 | 4actions/subset/ACTIVE/confirm/noCOMPLETE |
| REQ-507 | §4/7/13 | Step1/2/3 | State+twodetails/tests | TEST-508/504/505 | exactretry/freeze/activeWriteref |
| REQ-508 | §4/7.3.4 | Step1/2/3 | decoders/twodetails | TEST-501/502/504/505/508 | 408429unknown；knownrejectclear；freshgetfailure |
| REQ-509 | §4/7/15 | Step1/2/3 | readonlyaffinity/allpageframes/App | TEST-507/508 | issuer/tenant/subject/epoch/resource各切换abort/ignore |
| REQ-510 | §4/14/16 | Step1/2/3 | alltests/docs/PACartifactlock | TEST-509/510/fullsuite/build/audit | 真RED/GREEN日志、strict/hash、3focusedcommits、runtime未验收 |

## 11. Risks, Blockers, and User Decisions

| ID | Risk or decision | Impacted Steps/files | Evidence | Owner | Status/action |
| --- | --- | --- | --- | --- | --- |
| RISK-501 | 桌面artifact临时目录可过期 | Step1lock/eachbuild | fixedSHA/meta §6.2 | Root | 无阻塞；若文件消失停止build并取同已批准JAR固定副本，不联网/放宽hash |
| RISK-502 | 未知命令只内存保留，强制离页不能撤回server | Step2/3 | 主Spec§7.3/18 | Root | 已设计freeze/警示/新framefreshread；不增persistence |
| RISK-503 | 把静态/Mock当S08S09已验收 | finalevidence/README | 原蓝图RuntimeUnverified | Root | 明确仍未验收；不自动开启环境 |
| RISK-504 | JavaID Unicode/opaque版本/UTF8cursor被JS常规转换破坏 | Step1/2/3 | C/CL独立sourceaudit | Root | 精确validator/negativefixtures，不generictrim/locale排序/数字version |

无待用户重大合同/架构决策；本Plan等待Root全文审阅后才可实施，不假Accepted/Ready。

## 12. Review and Acceptance

### 12.1 Original requirement fidelity

只T3-11，所有10REQ在Step及traceability中；不扩大backend/API/DB、admin/start/history/建模器、token、依赖、runtime范围。三个semanticcommits遵守原目标明确聚焦提交结构。

### 12.2 Spec consistency

主Spec已审阅；仅408/JavaID/mandatory local source签名澄清和RelatedPlans metadata更新。六task+两Case、三pages/schemaform/pureState、fullidentitykey、exactretry、UTC/currentfacts/sourceaffinity一致；无fetch-then-forward或新增globalprovider/cache。

### 12.3 Repository executability

当前App/API/permissions/style/npm/officiallock函数已核。compile-seam仅解missingimport；真实assertRED先于GREEN；逐filemarker/pseudocode/commitpaths明确。Root独占finitechecks/commit，每Step必须完成commit后才开始下一Step。

### 12.4 Test and release completeness

RED/GREEN→focused→typecheck/lint/fullsuite→officialPACbuild→stageddiff/excludedhash→commit，最后sourceconformance。无新harness/runtime/GUI；全部计划验证不能冒充已执行。每Step17MC/10Rule表逐条适用性，最终摘要如下。

### 12.5 Blocking Manual Check

| Check ID | Applicability | Status | Evidence | Finding | Required action/exception |
| --- | --- | --- | --- | --- | --- |
| MC-ARCH-001 | Applicable | PASS | §4/5及每Step Rule11 | 既有TS结构/SDK复用，backend未改 | None |
| MC-REUSE-001 | Applicable | PASS | §4.7ledger/requestJson/AuthContext/AntD | 实有缺口才新增consumer/page/State | None |
| MC-DEP-001 | Applicable | PASS | §6.2/PAC lock官方API/diff | 无dependency升级，仅artifactSHA | None |
| MC-NAME-001 | Not applicable | N/A | §5全TS/docs/lock | 无Java类型命名 | None |
| MC-VALID-001 | Applicable | PASS | Step1decoder/Step2form/Step3actions | exact输入/响应/Unicode/boolean/range边界明确 | None |
| MC-MODEL-001 | Not applicable | N/A | readonlyTS mirrors | 无JavaPOJO/Lombok构造变化 | None |
| MC-CONVERT-001 | Not applicable | N/A | 目标tree无JavaMapper | 无MapStruct/BaseConverter变化 | None |
| MC-LOG-001 | Not applicable | N/A | no newJavaBean/log；formprivacy明确 | 无Java@Slf4j变化 | None |
| MC-BEAN-001 | Not applicable | N/A | 无Spring目标 | 无DI/Qualifier构造变化 | None |
| MC-UTIL-001 | Not applicable | N/A | 仅既有TS/DOM | 无Javautils/新增dependency | None |
| MC-JSON-001 | Applicable | PASS | C/CL→Step1→pageaffinitytests | 原wire/Jackson不改，browserclosedvaluecheck | None |
| MC-TIME-001 | Applicable | PASS | TIME-501/Step1/2/3 TEST-506 | UTCexplicit/rawprecision保留，DB/calendar无改 | None |
| MC-CONFIG-001 | Not applicable | N/A | 无Springprofile/frontendenv | PACartifactSHA不是新增环境key/服务配置 | None |
| MC-PATTERN-001 | Applicable | PASS | actionReducer+两detail Stateusage | 真实variation有封闭State，无provider/框架 | None |
| MC-SCOPE-001 | Applicable | PASS | §5/7exactcommitpaths/excludedhash | 只授权Web变化，旧data/config/API保留 | None |
| MC-TEST-001 | Applicable | PASS | §8realassertRED/gates/§10 | focused/full/PAC/finalaudit有执行顺序 | None |
| MC-BLOCKER-001 | Applicable | PASS | §11+每Stepchecks | 无未决设计blocker；runtime未验收单列 | None |

### 12.6 Final verdict

PASS — Ready for user review

此PASS仅Plan内部完整可审阅，不宣称实现/测试/build/权限激活/runtime已完成；主Spec与Plan保持Review，待Root全文审阅后按原用户继续授权执行。
