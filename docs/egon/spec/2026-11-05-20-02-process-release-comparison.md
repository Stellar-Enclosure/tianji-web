# T4-04C 已发布流程版本元数据对比

| Field | Value |
| --- | --- |
| Document | docs/egon/spec/2026-11-05-20-02-process-release-comparison.md |
| Template Version | 9 |
| Archetype Cleanup | Not applicable |
| Status | Review |
| Type | Feature |
| Complexity | Simple |
| Complexity Drivers | 现有页面的一项可选输入、两次已有精确 GET、局部差异渲染 |
| Created | 2026-11-05 20:02 Asia/Shanghai |
| Updated | 2026-11-05 20:02 Asia/Shanghai |
| Owner | Tianji Web operations owner |
| Repository | tianji-web |
| Scope | 当前授权租户的两个用户指定已发布 Process 版本的元数据对比 |
| Change Surface | 现有 DefinitionReleasePage 和 owning test |
| Affected Chapters | §7, §8, §12, §14, §15, §16 |
| Source Requirement | [主计划 §19/T4-04 版本差异](../../../../docs/plans/agent-framework-upgrade-plan.md) |
| Baseline Revision | tianji-web 6e58cdf3b4c283f348f262523e01f2424e054aa5；现有 PS 已发布 release GET |
| Amends | None |
| Supersedes | None |
| Depends On | [T4-04B Process release metadata](2026-11-05-19-29-process-release-metadata.md) §9/§10/§12 |
| Related Specs | None |
| Related Plans | [对比实现](../plan/2026-11-05-20-03-process-release-comparison.md) |

## 1. Summary

现有流程发布页增加一个可选对比版本。两个精确已发布版本读取成功后，显示两份原始 Manifest SHA-256，以及按模型类型和定义标识确定的元数据差异。留空仍走现有单版本查询与展示。

## 2. Background and Current State

| Evidence | Exact current owner | Observed scope |
| --- | --- | --- |
| EVD-001 | Web DefinitionReleasePage and owning test at 6e58cdf | 已有单精确版本、表单、当前授权帧与 AbortController。 |
| EVD-002 | processReleasesApi.get and requestJson | 严格解码版本、UTC、1–16 模型、唯一 type+definitionKey、content hash 和声明输入。现有租户、BFF 和 no-store。 |
| EVD-003 | tianji.page.processReleases, menu and tianji.api.process.release.get CALLS | 现有 TIANJI_PROCESS_RELEASE_READ 保护，App 路由和 PaC 不需要扩展。 |
| EVD-004 | [T4-04B evidence](../evidence/2026-11-05-process-release-metadata.md) | 现有单版本、PS GET 匹配、完整 256 有限 tests 与静态 artifact 已执行，live 独立。 |

### 2.5 Archetype example cleanup

Cleanup disposition: Not applicable

Reason: 已有 Web page，不创建项目或处理 archetype 示例。

## 3. Goals and Non-goals

让操作人员在当前租户查看两个已发布 Process 版本的模型元数据差异。保留旧入口、权限、单版本行为和现有展示。模型 XML、定义执行语义、迁移兼容性、审核、激活、回滚和其他跨 owner release 状态均在后续独立范围。

### 3.3 Change Surface and Design Depth

| Area/layer | Disposition | Exact repository evidence | Changed or preserved behavior/contract | Required Spec treatment | Chapter(s) |
| --- | --- | --- | --- | --- | --- |
| Web release lookup page | Affected | DefinitionReleasePage and owning tests | Optional compare with exact joint state | UI/data/ownership, finite gates | §7, §8, §12, §14, §15, §16 |
| Client/API/Auth/permission | Context-only | processReleasesApi, App and current resource registry | Same exact GET, no new authority | Existing contract only | §9, §10 |
| Server/DB | Unchanged | existing PS release owner | No new writes or APIs | No DDL | §11 |

## 4. Requirements and Acceptance Criteria

| ID | Atomic requirement | Priority | Observable acceptance criteria | Source |
| --- | --- | --- | --- | --- |
| REQ-001 | Preserve one-version default and exact input | Must | Blank compare retains one existing GET and metadata. Filled compare requires two distinct exact versions. No request on page entry or invalid form. | EVD-001 |
| REQ-002 | Compare exact metadata deterministically | Must | Both versions and Manifest SHA displayed. Added/removed/changed by type+key, changed reasons distinguish digest and input type/key. Order-independent inputs, sorted differences. | Master §19 |
| REQ-003 | Treat pair as one observation | Must | Shared abort signal; no single-side result before both success; side failure cancels other and shows fixed safe outcome. | EVD-001/002 |
| REQ-004 | Preserve auth/epoch boundaries | Must | Edit either field, tenant/issuer/subject/request epoch, permission loss or unmount discards prior pair; no stale rendering; existing auth flow unchanged. | EVD-001/003 |
| REQ-005 | Keep existing read-only surface | Must | No actions, route/API/permission changes. Focused/TS/lint and static PaC declarations unchanged. | EVD-003/004 |

### 4.2 Use-case analysis

#### 4.2.1 Actor inventory

| Actor ID | Actor/role | Goal and responsibility | Entry/channel | Permission/tenant context | Evidence |
| --- | --- | --- | --- | --- | --- |
| ACTOR-001 | Authorized operations USER | Read exact current tenant published versions | Existing release metadata route | Existing Process release read only | EVD-003 |
| ACTOR-002 | Process owner | Return existing exact release metadata | Existing BFF GET | Tenant and existing scope | EVD-002 |

#### 4.2.2 Use-case artifact

| ID | Use case/goal | Primary actor | Supporting actors/systems | Trigger | Preconditions | Main success outcome | Alternatives/failures | Postconditions | Requirements | Interfaces/pages | Tests |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| UC-001 | Compare two published versions | ACTOR-001 | ACTOR-002 | Explicit submit | Existing permission, two exact versions | Both hashes and stable differences | Invalid/no request, failed/cancel pair, stale/drop | Read only | REQ-001–005 | existing route and GET | TEST-001–004 |

## 5. Constraints, Assumptions, and Decisions

| ID | Decision |
| --- | --- |
| DEC-001 | Same Form, second version optional. Same exact validator, no trim/case normalization or special latest alias. |
| DEC-002 | Both reads share existing AbortController and sequence. Pair has no observable partial result. |
| DEC-003 | Compare declared metadata only, and display Manifest digest equality independently from model differences. |

## 6. Project Technology Context

Existing React 19, TypeScript 6, Ant Design 6, Vite/Vitest/jsdom, AuthContext and existing SDK. No dependency installation, layer, router or provider changes.

### 6.2 User-mandated Java rule compliance

| Literal rule | Affected? | Repository evidence | Exact design decision | Files/types/interfaces | Validation/test evidence | Status/blocker |
| --- | --- | --- | --- | --- | --- | --- |
| Rule 1 | No | TS only | Existing named page | §8 | TEST-001 | N/A |
| Rule 2 | No | Existing decoded API | Local form uses exact API validator | §12 | TEST-001 | N/A |
| Rule 3 | No | Existing immutable DTO | Local comparison state | §10 | TEST-002 | N/A |
| Rule 4 | No | No Java | No Bean or log | §8 | TEST-004 | N/A |
| Rule 5 | No | Existing TS/browser utilities | No new dependency | §6 | TEST-004 | N/A |
| Rule 6 | No | Exact current GET | No JSON contract change | §9 | TEST-004 | N/A |
| Rule 7 | No | No environment change | Existing source | §16 | TEST-004 | N/A |
| Rule 9 | No | Simple local query | Direct reuse | §13 | TEST-002 | N/A |
| Rule 10 | No | Existing UTC single UI | No new temporal behavior | §6.3 | TEST-001 | N/A |
| Rule 11 | No | Current Web layout | Keep same owner and permission | §8 | TEST-004 | N/A |

### 6.3 Time semantics and conversion contract

Time contract: Not applicable

Reason: Comparison does not use or display createdAt. The existing single-result canonical UTC rendering remains unchanged.

## 7. Architecture Design

### 7.0 Minimum-design baseline and element-necessity audit

| Proposed element | Change | Requirements | Existing/direct alternative | Concrete inadequacy of alternative | Added calls/state/coupling/failures/migration/operations | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| Local optional field and result | Expand | REQ-001–004 | Compare manually across single reads | No reproducible ordered diff or joint observation | One optional second existing GET | Add |
| Existing GET, auth, guard and page | Keep | REQ-004/005 | New backend comparison endpoint | Both exact DTOs already available | Zero interface/dependency change | Keep |

| Path | Network calls | Client states | Server contracts/state | Failure and TOCTOU points | Additional user/business value |
| --- | --- | --- | --- | --- | --- |
| Direct baseline | 1 | Current single lookup | Existing exact GET | Existing guard | Current metadata |
| Selected design | 1 or 2 | One loading, one optional pair | Same exact GET | No partial or stale result | Explicit exact diff |

### 7.1 System Architecture Design

Existing Web page → existing processReleasesApi via BFF → existing PS GET. Each response is already exact-version and tenant context bound. Browser derives the local view.

### 7.2 High-Level Design

Use one sequence/AbortController per submit. With comparison filled, issue two exact GETs against the same tenant with the same signal and resolve together. The page does not show a prior snapshot while loading. If either fails, abort the sibling and discard both.

### 7.3 Detailed Design

Treat the first version as baseline, second as target. Composite identity is type + colon + definitionKey. Compare digest and own input keys/types. Changed has one or both reasons. Added/removed use side absence. Omit unchanged rows and lexically sort ASCII composite identity. Show two independent Manifest SHA-256 strings even if model differences empty. Existing BFF 401/403/tenant-change behavior clears the pair.

## 8. Package Structure and Code File Tree

| Change | Exact path | Responsibility |
| --- | --- | --- |
| M | src/pages/DefinitionReleasePage.tsx | Optional comparison, joint request and local rendering |
| M | src/pages/DefinitionReleasePage.test.tsx | Finite page tests with existing auth/client seams |

Source-only commit may archive exact Spec/Plan/EVD through existing docs ownership.

## 9. Interface Definitions

Scope disposition: Context-only. Current GET /api/tianji/v1/process-releases/{releaseVersion}, existing no-store, current cookie/tenant and existing decoder. Two calls use the same entry point and permission, no new API contract.

## 10. POJO and Data Model Design

Existing ProcessRelease and ProcessReleaseModel. Page-local comparison state has baseline/comparison snapshots. Difference row contains only already-decoded model values and local labels. Input map equality compares own keys and declared values, independent of serialization order.

## 11. Database Design

Not applicable. Existing published reads only.

## 12. Frontend Page Design

### 12.1 Route, navigation, permission, and page ownership

Existing /operations/process-releases, Shell, page/menu permission TIANJI_PROCESS_RELEASE_READ and GET CALLS stay unchanged. No App or permission files affected.

### 12.2 Layout and component tree

Existing Card and Form. 发布版本 remains the first field, 对比版本（可选） is second, 查询发布 submits. Single mode keeps current metadata card. Pair card 发布版本对比 shows baseline/target exact versions and Manifest SHA-256, plus 摘要相同/不同. Ant Table columns model type, key, status/reasons, baseline and target digests/declared inputs.

### 12.3 User flows, forms, and validation

Blank compare retains one lookup. Explicit submit of two distinct exact strings issues two GETs. Malformed compare shows 请输入有效的对比版本。 Equal strings show 对比版本必须与发布版本不同。 Focus the first validation error. Editing either value aborts and clears current result/errors.

### 12.4 UI state and API/data mapping

| State | Presentation |
| --- | --- |
| Loading | Existing status, no snapshots, disabled duplicate submit |
| Single | Current page metadata and UTC text |
| Pair complete | Two manifests and exact deterministic model diff; no changes text if model metadata equal |
| Pair 404 | 当前无法读取其中一个发布版本。 No side disclosure |
| Pair 400/503/malformed/network | 暂时无法比较流程发布元数据。 No side disclosure |
| Identity/permission or tenant-context failure | Existing auth flow, current observation cleared |

### 12.5 Accessibility, responsiveness, and interaction safety

Use real form labels, existing status and field focus. Scroll wide table horizontally, each action remains a bounded read. Model differences contain no XML, private values or business actions.

## 13. Design Patterns and Architecture Principles

One current page, one existing data adapter, and direct local data comparison. No React Query provider, table abstraction, new API layer or permission definition.

## 14. Test Design

| ID | Owner | Expected proof |
| --- | --- | --- |
| TEST-001 | DefinitionReleasePage.test.tsx | R1 optional field absent; R2 two reads expected versus one in shape-only seam; old and blank behavior |
| TEST-002 | same | Exact direction, deterministic mixed-type rows, digest/input reasons and equal models vs different Manifest |
| TEST-003 | same | Shared signal, no partial, sibling abort, stale edit/epoch and 409 clear |
| TEST-004 | owning page, API/Auth/App regressions, typecheck/lint and existing official static build | Same permissions/resources/GET references; no live claim |

## 15. Non-functional and Cross-cutting Design

At most two explicit reads per submission and 32 composite model IDs. No caching, persistence, polling or unsafe HTML. Failures display fixed localized text. Current snapshots are independent immutable reads, with no cross-request transactional snapshot implied.

## 16. Compatibility, Migration, Rollout, and Rollback

Existing default, API, Auth, permission, PS service and runtime untouched. Revert focused Web commit. Live Edge/IAM/browser acceptance separately governed.

## 17. Alternatives and Decisions

Two existing exact reads meet the use case without a release list, server comparison API, or authority expansion.

## 18. Risks and Open Questions

A matching model summary does not establish equal Manifest or runtime compatibility. A different digest does not identify XML semantics. Both underlying GETs must be available in the approved deployed route before live acceptance.

## 19. Traceability Matrix

| Requirement | Use case | Design | Tests |
| --- | --- | --- | --- |
| REQ-001 | UC-001 | §12 | TEST-001 |
| REQ-002 | UC-001 | §7.3/§12 | TEST-002 |
| REQ-003 | UC-001 | §7/§12 | TEST-003 |
| REQ-004 | UC-001 | §12 | TEST-003/004 |
| REQ-005 | UC-001 | §8/§16 | TEST-004 |

## 20. Review and Acceptance

### 20.5 Blocking Manual Check

| Check ID | Applicability | Status | Evidence | Finding | Required action/exception |
| --- | --- | --- | --- | --- | --- |
| MC-ARCH-001 | Applicable | PASS | §7 | Current Web owner | None |
| MC-REUSE-001 | Applicable | PASS | §6/7 | Current Form, API and auth | None |
| MC-DEP-001 | Applicable | PASS | §6/8 | No dependency | None |
| MC-NAME-001 | Not applicable | N/A | §8 | TS only | None |
| MC-VALID-001 | Applicable | PASS | §12 | Exact form and current frame | None |
| MC-MODEL-001 | Not applicable | N/A | §10 | No Java model | None |
| MC-CONVERT-001 | Not applicable | N/A | §10 | Local projection | None |
| MC-LOG-001 | Not applicable | N/A | §15 | No new logging | None |
| MC-BEAN-001 | Not applicable | N/A | §8 | No Bean | None |
| MC-UTIL-001 | Not applicable | N/A | §6 | No Java utility | None |
| MC-JSON-001 | Applicable | PASS | §9/10 | Existing decoder | None |
| MC-TIME-001 | Not applicable | N/A | §6.3 | Existing UTC unchanged | None |
| MC-CONFIG-001 | Not applicable | N/A | §16 | No config changes | None |
| MC-PATTERN-001 | Applicable | PASS | §13 | Direct reuse | None |
| MC-SCOPE-001 | Applicable | PASS | §8 | Two source paths | None |
| MC-TEST-001 | Applicable | PASS | §14 | Exact finite gates | None |
| MC-BLOCKER-001 | Applicable | PASS | §18 | Review-ready source | Live separate |

### 20.6 Final verdict

PASS — Ready for user review

仓库外 Spec/Plan 和有限源码证据候选。真实浏览器、部署、权限和运行时未验收。
