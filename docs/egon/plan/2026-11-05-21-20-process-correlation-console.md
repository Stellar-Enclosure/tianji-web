# T4-04E 流程关联查询台实施计划

| Field | Value |
| --- | --- |
| Document | 2026-11-05-21-20-process-correlation-console.md |
| Template Version | 5 |
| Status | Review |
| Created | 2026-11-05 21:20 Asia/Shanghai |
| Updated | 2026-11-05 21:20 Asia/Shanghai |
| Owner | Tianji Web |
| Repository | tianji-web |
| Scope | 一个现有 READ 权限路由和两条现有 GET 消费，九个 Web 路径及三份文档 |
| Source Requirement | Master §19 T4-04 和 T4-02 已有 Process producer |
| Baseline Revision | Web 0957379aade655d2d14d6064504d3426d3e6576f；PS producer 1b5700ae9ba409c948c4d1a261d7b002de2b4381；Service audit HEAD 8de3e76184d4812ed2b1bac982b7c6889e4c49c0 |
| Implements Spec | [Process correlation console](../spec/2026-11-05-21-19-process-correlation-console.md) |
| Spec Status | Review |
| Spec Revision | 2026-11-05 21:19 Asia/Shanghai, SHA-256 c529c85763727df6e24c3cfa6011d0744480bc78438526bd8d4c6fb5e049cb85 |
| Effective Specs | [Process correlation console](../spec/2026-11-05-21-19-process-correlation-console.md) |
| Depends On Plans | None |
| Supersedes | None |
| Superseded By | None |
| Related Plans | [Master](../../../../docs/plans/agent-framework-upgrade-plan.md) |

## 1. Summary

现有登录用户手动精确关联查询、翻页和已选回执的独立详情。单只读页面，同 PROCESS_READ，APP/landing 保持。一个 Web 逻辑提交。

## 2. Target Spec and Effective Design

Primary Spec §§7/9/10/12 决定 exact UTC、原请求授权、收据/详情边界、分页和 late discard。PS producer Spec 是现有 contract authority。Runtime BFF/IAM 和浏览器独立，source GO 在 review 后单独锁。

## 3. Effective Requirements and Acceptance

| ID | Acceptance |
| --- | --- |
| REQ-001 | Existing APP/landing and PROCESS_READ, exact PAGE/MENU and 2 CALLS |
| REQ-002 | exact manual UTC and correlation, closed bounded page/cursor |
| REQ-003 | selected row triggers exact independent existing detail GET and affinity |
| REQ-004 | context/epoch/edit/route abort and exact empty/error handling |
| REQ-005 | targeted/full finite, typecheck/lint and actual producer-bound static proof |

## 4. Implementation Strategy and Dependency Order

R1 real pass-through rejects foreign only after B. R2 field-only A submits no request. R3 baseline protected route absent. B order API decoder, page, PaC declarations, App. Verify existing React and permissions with one commit.

### 4.7 Java, Spring, and Egon-COLA Implementation Standards

| Concern | Current repository evidence | Effective Spec decision |
| --- | --- | --- |
| Backend boundary | Committed PS C/REST/PaC | Consume unchanged |
| Web authority | Existing App/AuthContext/shared requestJson | No new permission definition |
| View and decoder | Existing Worker/release manual lookups | Reuse exact read/query patterns |

| Need | Candidates inspected | Exact evidence | Fit/gap | Decision |
| --- | --- | --- | --- | --- |
| Correlation | Existing PS producer and old detail GET | actual package and public C shapes | no Web adapter | Add local TS consumer |
| Route | Worker/current app | Worker also requires RECOVER | unsuitable to widen | separate existing READ page |
| UTC | Current browser APIs and PS UTC | micros and canonical bounds | local fixed parser | no shared refactor |

### 4.8 User-mandated Java Rule Implementation Matrix

| Literal rule | Spec source | Repository evidence | Exact files and order | Pseudocode obligations | Validation gate | Steps | Status/blocker |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Rule 1 | §6.2 | Web only | Step 1 | No changed Java behavior | G1/P1 | 1 | N/A |
| Rule 2 | §6.2 | Web only | Step 1 | No changed Java behavior | G1/P1 | 1 | N/A |
| Rule 3 | §6.2 | Web only | Step 1 | No changed Java behavior | G1/P1 | 1 | N/A |
| Rule 4 | §6.2 | Web only | Step 1 | No changed Java behavior | G1/P1 | 1 | N/A |
| Rule 5 | §6.2 | Web only | Step 1 | No changed Java behavior | G1/P1 | 1 | N/A |
| Rule 6 | §6.2 | Web only | Step 1 | No changed Java behavior | G1/P1 | 1 | N/A |
| Rule 7 | §6.2 | Web only | Step 1 | No changed Java behavior | G1/P1 | 1 | N/A |
| Rule 9 | §6.2 | Web only | Step 1 | No changed Java behavior | G1/P1 | 1 | N/A |
| Rule 10 | §6.2 | Web only | Step 1 | No changed Java behavior | G1/P1 | 1 | N/A |
| Rule 11 | §6.2 | Web only | Step 1 | No changed Java behavior | G1/P1 | 1 | N/A |

### 4.9 Time semantics and conversion contract

Time contract: Required

| Time ID | Fields/symbols | Semantics | Java/runtime type | Storage policy | Wire policy | Business zone source | Display zone source | Boundary / DST rules | Precision / Clock | Compatibility | Verification |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| TIME-001 | fromInclusive and toExclusive | Occurred instant | TS string and bigint micros | Not persisted | UTC Z | Explicit UTC | UTC form labels | half-open and positive ≤31d, Gregorian no leap second or 24:00 | Up to 6 decimal digits, DB future check only | Equivalent fractional spellings allowed | Step 1 TEST-001 and TEST-002 |
| TIME-002 | observedAt, submittedAt and finishedAt | Occurred instant | TS string and bigint micros | Not persisted | UTC Z | Existing PS UTC source | UTC time element | source text retained, no local calendar or status inference | microsecond order and detail affinity | nullable finishedAt by C status | Step 1 TEST-001 and TEST-002 |

## 5. Change File Tree

| Operation | Exact path | Purpose | Gate |
| --- | --- | --- | --- |
| CREATE | `src/api/processCorrelations.test.ts` | API contract test | R1/G1 |
| CREATE | `src/pages/ExecutionTimelinePage.test.tsx` | Page test | R2/G1 |
| MODIFY | `src/App.test.tsx` | App test | R3/G1 |
| CREATE | `src/api/processCorrelations.ts` | Two strict GET adapters | R1/G1 |
| CREATE | `src/pages/ExecutionTimelinePage.tsx` | Process correlation page | R2/G1 |
| MODIFY | `src/permissions/resources.ts` | PAGE and MENU | G1/P1 |
| MODIFY | `src/permissions/references.ts` | Two existing API references | G1/P1 |
| MODIFY | `src/permissions/messages.ts` | Localized labels | G1/P1 |
| MODIFY | `src/App.tsx` | Route and navigation | R3/G1/P1 |
| CREATE | `docs/egon/spec/2026-11-05-21-19-process-correlation-console.md` | Canonical Spec | S1 |
| CREATE | `docs/egon/plan/2026-11-05-21-20-process-correlation-console.md` | Canonical Plan | S1 |
| CREATE | `docs/egon/evidence/2026-11-05-process-correlation-console.md` | Actual evidence | S1 |

## 6. Prerequisites, Constraints, and Plan Clarifications

Verify clean Web exact 0957379aade655d2d14d6064504d3426d3e6576f, same current PS producer artifact 962bfd793883597f09736aa4d773829c014d2430acab7731acc6d3ff8fe1891f, PaC SHA 7dff4a536948c260304fb92552391acf6cc1b74d658bea3e88f137f1ec62ce90, OAS SHA 80bd174998a1dd6b3188bbd3931447c4e7eb79e055bb5046cd3a35e87f090b0a, and no Service writes. Node 24.14.1 and reviewed offline dependencies, no install. Scratch Web API/Page under t4-04/process-correlation-web; App/PaC under t4-04/process-correlations/root. Use real Source89 independent validated PAC copies and actual baseline manifest. No runtime/browser authority.

## 7. Ordered File-by-file Implementation Steps

### Step 1 — Query exact owned Process correlations and one chosen detail

- Requirements: REQ-001, REQ-002, REQ-003, REQ-004, REQ-005.
- Dependencies: Exact baseline, packaged PS manifest and Source GO.
- Baseline state: Existing Worker/Release routes, no Web correlation consumer.
- Observable outcome: Existing READ user may discover only owned START receipt IDs and fetch one chosen current detail.
- End state: Exact 12 paths and one logical commit.
- Test-first gate: Required. R1 wrong correlation 200 accepted, R2 explicit click expected one list call vs zero, R3 direct allowed route heading missing.
- Manual Checks: MC-ARCH-001, MC-REUSE-001, MC-DEP-001, MC-NAME-001, MC-VALID-001, MC-MODEL-001, MC-JSON-001, MC-TIME-001, MC-PATTERN-001, MC-SCOPE-001, MC-TEST-001, MC-BLOCKER-001.
- Literal Rules: Rule 1, Rule 2, Rule 6, Rule 10, Rule 11. Java-only items are inapplicable and current production owner remains.
- Ordered files:

#### File 1 — `CREATE src/api/processCorrelations.test.ts`

- Purpose: API contract test.
- Symbols: API contract test in this exact path.
- Repository evidence: Existing requestJson fake fetch and exact PS OAS.
- Dependencies and consumers: Existing exact Web owner path and declared R1/G1 source phase.
- Why now: Establish the declared R1/G1 behavior and proof before the next dependent phase.
- Contract/signature changes: Local Web and document scope only.
- Input/output and state mapping: Defined by the exact affinity and immutable page flow below.
- Error and edge behavior: Denied or stale context cannot mutate current page. Invalid data and permission differences fail the owning gate.
- Standards impact: MC-REUSE-001, MC-SCOPE-001, MC-TEST-001.
- Literal rule enforcement: Rule 11 preserves the existing Web and PS owner boundaries.
- Implementation pseudocode:

```ts
stub a valid-shaped foreign receipt page and expect rejection from existing transport;
capture exact list and independent detail GET, tenant/signal/no body;
cover UTC microsecond edges, closed bounded page, duplicate/order and detail affinity;
```

- Verification contribution: R1/G1.
- After this file: Exact source or evidence for the owning R1/G1 is available.

#### File 2 — `CREATE src/pages/ExecutionTimelinePage.test.tsx`

- Purpose: Page test.
- Symbols: Page test in this exact path.
- Repository evidence: Existing Worker/Release explicit lookup and useAuth tests.
- Dependencies and consumers: Existing exact Web owner path and declared R2/G1 source phase.
- Why now: Establish the declared R2/G1 behavior and proof before the next dependent phase.
- Contract/signature changes: Local Web and document scope only.
- Input/output and state mapping: Defined by the exact affinity and immutable page flow below.
- Error and edge behavior: Denied or stale context cannot mutate current page. Invalid data and permission differences fail the owning gate.
- Standards impact: MC-REUSE-001, MC-SCOPE-001, MC-TEST-001.
- Literal rule enforcement: Rule 11 preserves the existing Web and PS owner boundaries.
- Implementation pseudocode:

```tsx
render owning page with current identity; assert no request before manual submit;
assert query is exact, cursor next and selected inline detail are independent;
exercise clear/abort on edit/owner/epoch and discard late results, plus empty/error sources;
```

- Verification contribution: R2/G1.
- After this file: Exact source or evidence for the owning R2/G1 is available.

#### File 3 — `MODIFY src/App.test.tsx`

- Purpose: App test.
- Symbols: App test in this exact path.
- Repository evidence: Existing Worker/Release route, menu and manifest fixtures.
- Dependencies and consumers: Existing exact Web owner path and declared R3/G1 source phase.
- Why now: Establish the declared R3/G1 behavior and proof before the next dependent phase.
- Contract/signature changes: Local Web and document scope only.
- Input/output and state mapping: Defined by the exact affinity and immutable page flow below.
- Error and edge behavior: Denied or stale context cannot mutate current page. Invalid data and permission differences fail the owning gate.
- Standards impact: MC-REUSE-001, MC-SCOPE-001, MC-TEST-001.
- Literal rule enforcement: Rule 11 preserves the existing Web and PS owner boundaries.
- Implementation pseudocode:

```tsx
open exact path under current APP with PROCESS_READ and expect heading;
assert missing READ denies route/menu and READ alone still cannot enter APP;
check exact local resources/messages and both existing CALLS references;
```

- Verification contribution: R3/G1.
- After this file: Exact source or evidence for the owning R3/G1 is available.

#### File 4 — `CREATE src/api/processCorrelations.ts`

- Purpose: Two strict GET adapters.
- Symbols: Two strict GET adapters in this exact path.
- Repository evidence: Existing requestJson, C DTO and packaged OAS.
- Dependencies and consumers: Existing exact Web owner path and declared R1/G1 source phase.
- Why now: Establish the declared R1/G1 behavior and proof before the next dependent phase.
- Contract/signature changes: Local Web and document scope only.
- Input/output and state mapping: Defined by the exact affinity and immutable page flow below.
- Error and edge behavior: Denied or stale context cannot mutate current page. Invalid data and permission differences fail the owning gate.
- Standards impact: MC-REUSE-001, MC-SCOPE-001, MC-TEST-001.
- Literal rule enforcement: Rule 11 preserves the existing Web and PS owner boundaries.
- Implementation pseudocode:

```ts
A real requestJson pass-through permits foreign test 200;
B validate exact Gregorian microseconds and 20 unique descending receipts, exact correlation and opaque cursor;
detail GET by chosen exact ID, verify correlation/release/submitted instant and closed C state/nullability;
```

- Verification contribution: R1/G1.
- After this file: Exact source or evidence for the owning R1/G1 is available.

#### File 5 — `CREATE src/pages/ExecutionTimelinePage.tsx`

- Purpose: Process correlation page.
- Symbols: Process correlation page in this exact path.
- Repository evidence: Existing manual page and keyed verified identity.
- Dependencies and consumers: Existing exact Web owner path and declared R2/G1 source phase.
- Why now: Establish the declared R2/G1 behavior and proof before the next dependent phase.
- Contract/signature changes: Local Web and document scope only.
- Input/output and state mapping: Defined by the exact affinity and immutable page flow below.
- Error and edge behavior: Denied or stale context cannot mutate current page. Invalid data and permission differences fail the owning gate.
- Standards impact: MC-REUSE-001, MC-SCOPE-001, MC-TEST-001.
- Literal rule enforcement: Rule 11 preserves the existing Web and PS owner boundaries.
- Implementation pseudocode:

```tsx
A shows exact form fields and inert submit;
B key issuer/tenant/subject/requestEpoch; one active read generation, clear after form edits or replacement;
manual next and chosen detail, preserve exact UTC labels and source-specific display;
```

- Verification contribution: R2/G1.
- After this file: Exact source or evidence for the owning R2/G1 is available.

#### File 6 — `MODIFY src/permissions/resources.ts`

- Purpose: PAGE and MENU.
- Symbols: PAGE and MENU in this exact path.
- Repository evidence: Existing Process read and APP roles.
- Dependencies and consumers: Existing exact Web owner path and declared G1/P1 source phase.
- Why now: Establish the declared G1/P1 behavior and proof before the next dependent phase.
- Contract/signature changes: Local Web and document scope only.
- Input/output and state mapping: Defined by the exact affinity and immutable page flow below.
- Error and edge behavior: Denied or stale context cannot mutate current page. Invalid data and permission differences fail the owning gate.
- Standards impact: MC-REUSE-001, MC-SCOPE-001, MC-TEST-001.
- Literal rule enforcement: Rule 11 preserves the existing Web and PS owner boundaries.
- Implementation pseudocode:

```ts
append tianji.page.processCorrelations and tianji.menu.processCorrelations;
set exact route /operations/process-correlations, existing APP parent and PROCESS_READ ALL;
keep existing APP rule, Worker RECOVER gate and every other resource entry;
```

- Verification contribution: G1/P1.
- After this file: Exact source or evidence for the owning G1/P1 is available.

#### File 7 — `MODIFY src/permissions/references.ts`

- Purpose: Two existing API references.
- Symbols: Two existing API references in this exact path.
- Repository evidence: Actual PS packaged current manifest.
- Dependencies and consumers: Existing exact Web owner path and declared G1/P1 source phase.
- Why now: Establish the declared G1/P1 behavior and proof before the next dependent phase.
- Contract/signature changes: Local Web and document scope only.
- Input/output and state mapping: Defined by the exact affinity and immutable page flow below.
- Error and edge behavior: Denied or stale context cannot mutate current page. Invalid data and permission differences fail the owning gate.
- Standards impact: MC-REUSE-001, MC-SCOPE-001, MC-TEST-001.
- Literal rule enforcement: Rule 11 preserves the existing Web and PS owner boundaries.
- Implementation pseudocode:

```ts
append CALLS reference to tianji.api.process.instance.correlations;
append CALLS reference to tianji.api.process.instance.get;
do not create a permission definition or change existing SDK/backend reference authority;
```

- Verification contribution: G1/P1.
- After this file: Exact source or evidence for the owning G1/P1 is available.

#### File 8 — `MODIFY src/permissions/messages.ts`

- Purpose: Localized labels.
- Symbols: Localized labels in this exact path.
- Repository evidence: Existing bilingual Web permission metadata.
- Dependencies and consumers: Existing exact Web owner path and declared G1/P1 source phase.
- Why now: Establish the declared G1/P1 behavior and proof before the next dependent phase.
- Contract/signature changes: Local Web and document scope only.
- Input/output and state mapping: Defined by the exact affinity and immutable page flow below.
- Error and edge behavior: Denied or stale context cannot mutate current page. Invalid data and permission differences fail the owning gate.
- Standards impact: MC-REUSE-001, MC-SCOPE-001, MC-TEST-001.
- Literal rule enforcement: Rule 11 preserves the existing Web and PS owner boundaries.
- Implementation pseudocode:

```ts
append only page.processCorrelations and menu.processCorrelations;
use default locale zh-CN and exact 流程关联查询 with en-US Process correlation lookup;
preserve other metadata and no IAM grant changes;
```

- Verification contribution: G1/P1.
- After this file: Exact source or evidence for the owning G1/P1 is available.

#### File 9 — `MODIFY src/App.tsx`

- Purpose: Route and navigation.
- Symbols: Route and navigation in this exact path.
- Repository evidence: Existing RequireResource and Shell navigation.
- Dependencies and consumers: Existing exact Web owner path and declared R3/G1/P1 source phase.
- Why now: Establish the declared R3/G1/P1 behavior and proof before the next dependent phase.
- Contract/signature changes: Local Web and document scope only.
- Input/output and state mapping: Defined by the exact affinity and immutable page flow below.
- Error and edge behavior: Denied or stale context cannot mutate current page. Invalid data and permission differences fail the owning gate.
- Standards impact: MC-REUSE-001, MC-SCOPE-001, MC-TEST-001.
- Literal rule enforcement: Rule 11 preserves the existing Web and PS owner boundaries.
- Implementation pseudocode:

```tsx
mount new ExecutionTimelinePage only under exact Process correlation PAGE route;
show one existing-style menu when tianji.menu.processCorrelations allows;
leave existing APP and default landing resolution unchanged, do not add an instance URL;
```

- Verification contribution: R3/G1/P1.
- After this file: Exact source or evidence for the owning R3/G1/P1 is available.

#### File 10 — `CREATE docs/egon/spec/2026-11-05-21-19-process-correlation-console.md`

- Purpose: Canonical Spec.
- Symbols: Canonical Spec in this exact path.
- Repository evidence: Current committed PS producer and Master T4-04.
- Dependencies and consumers: Existing exact Web owner path and declared S1 source phase.
- Why now: Establish the declared S1 behavior and proof before the next dependent phase.
- Contract/signature changes: Local Web and document scope only.
- Input/output and state mapping: Defined by the exact affinity and immutable page flow below.
- Error and edge behavior: Denied or stale context cannot mutate current page. Invalid data and permission differences fail the owning gate.
- Standards impact: MC-REUSE-001, MC-SCOPE-001, MC-TEST-001.
- Literal rule enforcement: Rule 11 preserves the existing Web and PS owner boundaries.
- Implementation pseudocode:

```text
copy approved exact reviewed Spec bytes and hash at canonical path;
verify source scope and PS protocol identity, owner and UTC boundaries;
run strict Spec validator and preserve runtime distinction;
```

- Verification contribution: S1.
- After this file: Exact source or evidence for the owning S1 is available.

#### File 11 — `CREATE docs/egon/plan/2026-11-05-21-20-process-correlation-console.md`

- Purpose: Canonical Plan.
- Symbols: Canonical Plan in this exact path.
- Repository evidence: Current Web workflow and existing static build proof.
- Dependencies and consumers: Existing exact Web owner path and declared S1 source phase.
- Why now: Establish the declared S1 behavior and proof before the next dependent phase.
- Contract/signature changes: Local Web and document scope only.
- Input/output and state mapping: Defined by the exact affinity and immutable page flow below.
- Error and edge behavior: Denied or stale context cannot mutate current page. Invalid data and permission differences fail the owning gate.
- Standards impact: MC-REUSE-001, MC-SCOPE-001, MC-TEST-001.
- Literal rule enforcement: Rule 11 preserves the existing Web and PS owner boundaries.
- Implementation pseudocode:

```text
copy approved exact Plan bytes and verify primary Spec link and digest;
enforce real R1–R3 and the focused/full finite and P1 gates;
stage exactly twelve task paths in one logical commit;
```

- Verification contribution: S1.
- After this file: Exact source or evidence for the owning S1 is available.

#### File 12 — `CREATE docs/egon/evidence/2026-11-05-process-correlation-console.md`

- Purpose: Actual evidence.
- Symbols: Actual evidence in this exact path.
- Repository evidence: Existing Web EVD convention and actual proof artifacts.
- Dependencies and consumers: Existing exact Web owner path and declared S1 source phase.
- Why now: Establish the declared S1 behavior and proof before the next dependent phase.
- Contract/signature changes: Local Web and document scope only.
- Input/output and state mapping: Defined by the exact affinity and immutable page flow below.
- Error and edge behavior: Denied or stale context cannot mutate current page. Invalid data and permission differences fail the owning gate.
- Standards impact: MC-REUSE-001, MC-SCOPE-001, MC-TEST-001.
- Literal rule enforcement: Rule 11 preserves the existing Web and PS owner boundaries.
- Implementation pseudocode:

```text
record source locks, actual reds and positive reports, typecheck/lint/full suite;
record final Web artifact and exact declaration delta vs actual PS producer;
record unchanged Service and real BFF/IAM/browser/S12 separate;
```

- Verification contribution: S1.
- After this file: Exact source or evidence for the owning S1 is available.


- Validation working directory: /Users/mario/SelfProject/Stellar-Enclosure/tianji-web.
- Verification command: §8 R1/R2/R3/G1/G2/P1/S1.
- Expected result: Three exact RED assertions, finite and package positive, exact declared PaC delta.
- Failure returns to: Exact owned source or contract gate. No source or runtime scope expansion.
- Completion criteria: Exact 12 staged paths, actual reports and embedded package proof, unchanged Service.
- Rollback: Before commit withdraw only task paths. After commit a separately approved focused revert.
- Commit paths: `src/api/processCorrelations.test.ts`, `src/pages/ExecutionTimelinePage.test.tsx`, `src/App.test.tsx`, `src/api/processCorrelations.ts`, `src/pages/ExecutionTimelinePage.tsx`, `src/permissions/resources.ts`, `src/permissions/references.ts`, `src/permissions/messages.ts`, `src/App.tsx`, `docs/egon/spec/2026-11-05-21-19-process-correlation-console.md`, `docs/egon/plan/2026-11-05-21-20-process-correlation-console.md`, `docs/egon/evidence/2026-11-05-process-correlation-console.md`
- Commit: feat(tianji-web): find owned Process starts by correlation.

## 8. Test, Validation, and Quality Gates

| Gate | Exact source phase | Expected |
| --- | --- | --- |
| R1 | API A declaration/pass-through + A API test | One owning assertion that expected rejection vs foreign resolved 200 |
| R2 | API A + field-only Page A + red page test | One assertion expected one GET after explicit query vs zero |
| R3 | Baseline App and root/r3/App.test.tsx | One assertion allowed new route heading missing |
| G1 | Full B, focused 4 files | Fresh zero-failure focused, typecheck and lint |
| G2 | Full B and existing shared APP path | Actual full Vitest, zero failure |
| P1 | Existing official static build and actual producer comparison | Exact PaC delta and GET authority check |
| S1 | Strict docs and staging | exact 12 paths, old baseline/authority preserved |

```sh
npm test -- src/api/processCorrelations.test.ts -t 'rejects a foreign Process correlation receipt page$'
npm test -- src/pages/ExecutionTimelinePage.test.tsx -t 'submits an exact current-tenant correlation window only on explicit query$'
npm test -- src/App.test.tsx -t 'opens Process correlation lookup with the existing Process read permission$'
npm test -- src/api/processCorrelations.test.ts src/pages/ExecutionTimelinePage.test.tsx src/App.test.tsx src/auth/AuthContext.test.tsx
npm run typecheck
npm run lint
npm test

correlation_web_pac=/Users/mario/.codex/tmp/tianji-agent-upgrade-20261105/t4-04/result-usage-draft/root-proof.F8XShw
PAC_SDK_DIR=/Users/mario/SelfProject/Stellar-Enclosure/web-sdk \
PAC_TOOLCHAIN_LOCK="$correlation_web_pac/validation-toolchain.lock.json" \
PAC_CONTRACT_ARTIFACT="$correlation_web_pac/verified-jianshen-contract.jar" npm run build
python3 ../.agents/skills/stellar-enclosure-coding-writing-spec/scripts/validate_spec.py \
  docs/egon/spec/2026-11-05-21-19-process-correlation-console.md --strict
python3 ../.agents/skills/stellar-enclosure-coding-writing-plan/scripts/validate_plan.py \
  docs/egon/plan/2026-11-05-21-20-process-correlation-console.md --strict
git diff --check
git diff --cached --check
git diff --cached --name-only
```

Run each RED only at declared phase and verify exactly one intentional owning failure, other cases filtered. P1 compare actual final manifest/artifact to Source89 final-manifest.json and actual packaged PS raw manifest at t4-02/process-correlation/root/process-server-manifest.json using existing SDK canonicalize/build verifier. Require exactly +2 resource declarations PAGE/MENU with READ and current APP parent, +2 bilingual labels, +2 CALLS references. No removed/modified other authority, no permission definitions/references delta. For both producer refs require exact GET/HEAD, paths and USER/SERVICE with current READ/scope. Independently verify embedded dist/permission-build.json matches official static manifest/artifact. Keep validation-only lock outside source, no local consumer catalog registration/grants, no server/browser. Existing commands cover all gates.

## 9. Migration, Compatibility, Rollout, and Rollback

No C/CL/PS/migration/dependency/auth/wire changes. Existing APP and default landing stay. Current PS default-off and deployment authority remain current. No browser/network acceptance or runtime activation.

## 10. Requirement-to-Step Traceability Matrix

| ID | Step | Gate |
| --- | --- | --- |
| REQ-001 | 1 | R3/G1/P1 |
| REQ-002 | 1 | R1/R2/G1 |
| REQ-003 | 1 | G1/P1 |
| REQ-004 | 1 | G1/G2 |
| REQ-005 | 1 | G1/G2/P1/S1 |

## 11. Risks, Blockers, and User Decisions

Provider artifact is verified offline. Existing browser gateway/routing and IAM need separate test. Receipt-only results cannot prove complete histories or cross-owner Agent/Worker facts. Optional detail errors leave receipt status unchanged.

## 12. Review and Acceptance

### 12.5 Blocking Manual Check

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
