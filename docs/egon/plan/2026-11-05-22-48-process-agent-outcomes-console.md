# T4-04H 流程侧 Agent 结果观察实施计划

| Field | Value |
| --- | --- |
| Document | 2026-11-05-22-48-process-agent-outcomes-console.md |
| Template Version | 5 |
| Status | Review |
| Created | 2026-11-05 22:48 Asia/Shanghai |
| Updated | 2026-11-05 22:48 Asia/Shanghai |
| Owner | Tianji Web |
| Repository | tianji-web |
| Scope | 现有详情独立 outcome panel，五个 Web 路径和三份文档 |
| Source Requirement | Master §19 T4-04 当前 Process 本地 Agent 证据 |
| Baseline Revision | Web 8d5cd44c1464589b72c584fb553915f22b473d00；PS producer 75d0c15a2ff9bef03be80e7cd7584b2bcbe8401e |
| Implements Spec | [Process Agent outcomes](../spec/2026-11-05-22-47-process-agent-outcomes-console.md) |
| Spec Status | Review |
| Spec Revision | 2026-11-05 22:47 Asia/Shanghai, SHA-256 6e353a8555e53e356fbb3f6ed94bed8de0cdbe055cd9cc8e1eaed26181d29a0f |
| Effective Specs | [Process Agent outcomes](../spec/2026-11-05-22-47-process-agent-outcomes-console.md) |
| Depends On Plans | None |
| Supersedes | None |
| Superseded By | None |
| Related Plans | [Master](../../../../docs/plans/agent-framework-upgrade-plan.md) |

## 1. Summary

在现有已验证 Process 实例详情中增加独立手动 Process-side Agent 结果读取。单 GET、单 CALLS、同 Process READ、独立分页。一个 Web 逻辑提交。

## 2. Target Spec and Effective Design

Spec §§7/9/10/12 定义 exact ID、current frame、严格 outcome DTO、分页、收件和 terminal 证据分离。实际 PS 包先于 Web source GO，runtime 不随源码授权。

## 3. Effective Requirements and Acceptance

| ID | Acceptance |
| --- | --- |
| REQ-001 | same current Process authority, one exact CALLS only |
| REQ-002 | exact GET, bounded page and UTC/nullable evidence |
| REQ-003 | separate local evidence, no inferred Agent association, ordinary errors isolate |
| REQ-004 | current abort/selection and actual finite/static producer proof |

## 4. Implementation Strategy and Dependency Order

R1 typed pass-through + foreign page. R2 baseline page + explicit authorized result control. B API → panel → one reference. Actual finite, static and exact staging after reviewed package lock.

### 4.7 Java, Spring, and Egon-COLA Implementation Standards

| Concern | Current repository evidence | Effective Spec decision |
| --- | --- | --- |
| Backend | Exact PS C/REST/PaC producer | Consume only, no Java |
| Authority | Current Process page/AuthContext | Existing READ and global invalidation |
| Web | Current timeline and strict APIs | Local same-instance shape and abort |

| Need | Candidates inspected | Exact evidence | Fit/gap | Decision |
| --- | --- | --- | --- | --- |
| Local outcome | New PS authoritative evidence | exact current producer | no consumer | new TS pair |
| UI entry | Existing Process detail | exact selected ID and current scope | no new route | local independent panel |
| PaC | existing references.ts | new actual API resource | one CALLS needed | additive reference only |

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
| TIME-001 | observedAt, dispatchRecordedAt, receivedAt, decidedAt | Occurred instant | TS string and canonical UTC key | Not persisted | UTC Z | Current PS UTC observation | UTC time element | per-row nondecreasing and at/before observation, nullable by C state | microseconds, no local clock | preserve raw UTC string and producer order | Step 1 TEST-001 and TEST-002 |

## 5. Change File Tree

| Operation | Exact path | Purpose | Gate |
| --- | --- | --- | --- |
| CREATE | `src/api/processAgentOutcomes.test.ts` | Outcome contract test | R1/G1 |
| MODIFY | `src/pages/ExecutionTimelinePage.test.tsx` | Selected-detail UI tests | R2/G1 |
| CREATE | `src/api/processAgentOutcomes.ts` | Exact outcome adapter | R1/G1 |
| MODIFY | `src/pages/ExecutionTimelinePage.tsx` | Process-local selected panel | R2/G1 |
| MODIFY | `src/permissions/references.ts` | One actual producer CALLS | G1/P1 |
| CREATE | `docs/egon/spec/2026-11-05-22-47-process-agent-outcomes-console.md` | Canonical Spec | S1 |
| CREATE | `docs/egon/plan/2026-11-05-22-48-process-agent-outcomes-console.md` | Canonical Plan | S1 |
| CREATE | `docs/egon/evidence/2026-11-05-process-agent-outcomes-console.md` | Actual evidence | S1 |

## 6. Prerequisites, Constraints, and Plan Clarifications

Verify clean Web 8d5cd44c1464589b72c584fb553915f22b473d00 and actual PS producer commit 75d0c15a2ff9bef03be80e7cd7584b2bcbe8401e, Boot SHA da0fb659b90334dc9a1eb087ac8fe2c5c0444fd6092f21920d7428aa5b8392d4, raw PaC SHA cc85967f2c627e7afbf5f06564751cf82f9218dc4b0dc093babc5f61ad361f70, OAS SHA f1fa0bee4a842fb6210e4f6baac99697d9f309506b07e9ee07251ce4de70d58b. Actual producer commit/manifest/OAS must be locked before Web Source GO. Node24 existing reviewed dependencies. API scratch t4-04/process-agent-outcomes-web/api-draft; UI t4-02/process-agent-outcomes/web-ui-draft; root-owned reference patch exact one entry. No installs, GUI, browser, runtime, grants or Service change.

## 7. Ordered File-by-file Implementation Steps

### Step 1 — Observe Process-local Agent outcome from selected instance

- Requirements: REQ-001, REQ-002, REQ-003, REQ-004.
- Dependencies: Reviewed Spec/Plan, verified actual PS package, exact baseline and Source GO.
- Baseline state: Current Process detail and independent AS list, no Process outcome query.
- Observable outcome: Manual exact Process-side result page with distinct local facts.
- End state: Five exact Web source paths and three docs, one logical commit.
- Test-first gate: Required. R1 wrong instance resolves pass-through; R2 baseline detail has no explicit Process outcome button.
- Manual Checks: MC-ARCH-001, MC-REUSE-001, MC-DEP-001, MC-NAME-001, MC-VALID-001, MC-MODEL-001, MC-JSON-001, MC-TIME-001, MC-SCOPE-001, MC-TEST-001, MC-BLOCKER-001.
- Literal Rules: Rule 1, Rule 2, Rule 6, Rule 10, Rule 11. Existing Java owner and API unchanged.
- Ordered files:

#### File 1 — `CREATE src/api/processAgentOutcomes.test.ts`

- Purpose: Outcome contract test.
- Symbols: Outcome contract test at its exact path.
- Repository evidence: Existing requestJson fake fetch and exact PS public DTO.
- Dependencies and consumers: Existing exact Web owner and R1/G1 phase.
- Why now: Establish the owning R1/G1 behavior.
- Contract/signature changes: Web-only, current producer and authority unchanged.
- Input/output and state mapping: Exact local behavior below.
- Error and edge behavior: Existing auth and scope lifetime, local ordinary failures only.
- Standards impact: MC-REUSE-001, MC-SCOPE-001, MC-TEST-001.
- Literal rule enforcement: Rule 11 preserves existing Web/Process owner boundaries.
- Implementation pseudocode:

```ts
stub wrong instance in otherwise valid 200 and expect rejection from real request path;
capture exact GET with tenant/signal/optional opaque cursor and no body;
cover cap, exact closed shape, UTC chronology, nullable terminal and no row sorting;
```

- Verification contribution: R1/G1.
- After this file: Exact local source or evidence enters the declared gate.

#### File 2 — `MODIFY src/pages/ExecutionTimelinePage.test.tsx`

- Purpose: Selected-detail UI tests.
- Symbols: Selected-detail UI tests at its exact path.
- Repository evidence: Existing ExecutionTimelinePage test fixtures and useAuth.
- Dependencies and consumers: Existing exact Web owner and R2/G1 phase.
- Why now: Establish the owning R2/G1 behavior.
- Contract/signature changes: Web-only, current producer and authority unchanged.
- Input/output and state mapping: Exact local behavior below.
- Error and edge behavior: Existing auth and scope lifetime, local ordinary failures only.
- Standards impact: MC-REUSE-001, MC-SCOPE-001, MC-TEST-001.
- Literal rule enforcement: Rule 11 preserves existing Web/Process owner boundaries.
- Implementation pseudocode:

```tsx
complete current Process detail and assert the exact outcome query button exists;
assert no request before explicit click, separately page and keep other panels on ordinary error;
exercise selected instance/owner epoch/edit abort and discard late results;
```

- Verification contribution: R2/G1.
- After this file: Exact local source or evidence enters the declared gate.

#### File 3 — `CREATE src/api/processAgentOutcomes.ts`

- Purpose: Exact outcome adapter.
- Symbols: Exact outcome adapter at its exact path.
- Repository evidence: Current PS C DTO/OAS and Web exact Process validators.
- Dependencies and consumers: Existing exact Web owner and R1/G1 phase.
- Why now: Establish the owning R1/G1 behavior.
- Contract/signature changes: Web-only, current producer and authority unchanged.
- Input/output and state mapping: Exact local behavior below.
- Error and edge behavior: Existing auth and scope lifetime, local ordinary failures only.
- Standards impact: MC-REUSE-001, MC-SCOPE-001, MC-TEST-001.
- Literal rule enforcement: Rule 11 preserves existing Web/Process owner boundaries.
- Implementation pseudocode:

```ts
A same real transport passes through wrong instance;
B require exact instance path and v1 lower-hex cursor, 20 item cap and exact shape;
validate C timestamps/state/nullability without inventing order or IDs;
```

- Verification contribution: R1/G1.
- After this file: Exact local source or evidence enters the declared gate.

#### File 4 — `MODIFY src/pages/ExecutionTimelinePage.tsx`

- Purpose: Process-local selected panel.
- Symbols: Process-local selected panel at its exact path.
- Repository evidence: Existing timeline verified selected detail and abort generation.
- Dependencies and consumers: Existing exact Web owner and R2/G1 phase.
- Why now: Establish the owning R2/G1 behavior.
- Contract/signature changes: Web-only, current producer and authority unchanged.
- Input/output and state mapping: Exact local behavior below.
- Error and edge behavior: Existing auth and scope lifetime, local ordinary failures only.
- Standards impact: MC-REUSE-001, MC-SCOPE-001, MC-TEST-001.
- Literal rule enforcement: Rule 11 preserves existing Web/Process owner boundaries.
- Implementation pseudocode:

```tsx
mount local outcome panel only after a current exact detail;
run manual first or current opaque next with separate pending scope;
display Process dispatch/inbox/recorded terminal and UTC independently, preserve ordinary errors;
```

- Verification contribution: R2/G1.
- After this file: Exact local source or evidence enters the declared gate.

#### File 5 — `MODIFY src/permissions/references.ts`

- Purpose: One actual producer CALLS.
- Symbols: One actual producer CALLS at its exact path.
- Repository evidence: Existing Web permissions references and PS manifest.
- Dependencies and consumers: Existing exact Web owner and G1/P1 phase.
- Why now: Establish the owning G1/P1 behavior.
- Contract/signature changes: Web-only, current producer and authority unchanged.
- Input/output and state mapping: Exact local behavior below.
- Error and edge behavior: Existing auth and scope lifetime, local ordinary failures only.
- Standards impact: MC-REUSE-001, MC-SCOPE-001, MC-TEST-001.
- Literal rule enforcement: Rule 11 preserves existing Web/Process owner boundaries.
- Implementation pseudocode:

```ts
append only tianji.api.process.agent.outcomes with usage CALLS;
reuse current PROCESS_READ page, no permission definition/route or APP change;
verify one reference delta against exact actual PS GET and HEAD authority;
```

- Verification contribution: G1/P1.
- After this file: Exact local source or evidence enters the declared gate.

#### File 6 — `CREATE docs/egon/spec/2026-11-05-22-47-process-agent-outcomes-console.md`

- Purpose: Canonical Spec.
- Symbols: Canonical Spec at its exact path.
- Repository evidence: Current producer and Master T4-04.
- Dependencies and consumers: Existing exact Web owner and S1 phase.
- Why now: Establish the owning S1 behavior.
- Contract/signature changes: Web-only, current producer and authority unchanged.
- Input/output and state mapping: Exact local behavior below.
- Error and edge behavior: Existing auth and scope lifetime, local ordinary failures only.
- Standards impact: MC-REUSE-001, MC-SCOPE-001, MC-TEST-001.
- Literal rule enforcement: Rule 11 preserves existing Web/Process owner boundaries.
- Implementation pseudocode:

```text
copy exact reviewed Spec after actual producer lock;
verify expected Process local scope and independent identity;
run strict validator without introducing new authority;
```

- Verification contribution: S1.
- After this file: Exact local source or evidence enters the declared gate.

#### File 7 — `CREATE docs/egon/plan/2026-11-05-22-48-process-agent-outcomes-console.md`

- Purpose: Canonical Plan.
- Symbols: Canonical Plan at its exact path.
- Repository evidence: Existing static Web verification process.
- Dependencies and consumers: Existing exact Web owner and S1 phase.
- Why now: Establish the owning S1 behavior.
- Contract/signature changes: Web-only, current producer and authority unchanged.
- Input/output and state mapping: Exact local behavior below.
- Error and edge behavior: Existing auth and scope lifetime, local ordinary failures only.
- Standards impact: MC-REUSE-001, MC-SCOPE-001, MC-TEST-001.
- Literal rule enforcement: Rule 11 preserves existing Web/Process owner boundaries.
- Implementation pseudocode:

```text
copy exact approved Plan and verify primary Spec SHA;
enforce declared R1/R2 phases, focused and static source gates;
verify eight exact paths in one logical commit;
```

- Verification contribution: S1.
- After this file: Exact local source or evidence enters the declared gate.

#### File 8 — `CREATE docs/egon/evidence/2026-11-05-process-agent-outcomes-console.md`

- Purpose: Actual evidence.
- Symbols: Actual evidence at its exact path.
- Repository evidence: Current Web/PS artifact proof conventions.
- Dependencies and consumers: Existing exact Web owner and S1 phase.
- Why now: Establish the owning S1 behavior.
- Contract/signature changes: Web-only, current producer and authority unchanged.
- Input/output and state mapping: Exact local behavior below.
- Error and edge behavior: Existing auth and scope lifetime, local ordinary failures only.
- Standards impact: MC-REUSE-001, MC-SCOPE-001, MC-TEST-001.
- Literal rule enforcement: Rule 11 preserves existing Web/Process owner boundaries.
- Implementation pseudocode:

```text
record actual REDs and focused/type/lint, actual Web package and PS source/artifact;
prove exact +1 CALLS and no other permission delta;
record independent runtime/BFF/browser/S12 boundary and exact staged/commit state;
```

- Verification contribution: S1.
- After this file: Exact local source or evidence enters the declared gate.


- Validation working directory: /Users/mario/SelfProject/Stellar-Enclosure/tianji-web.
- Verification command: §8 R1/R2/G1/P1/S1.
- Expected result: Each RED one intentional owning assertion, actual finite/static pass.
- Failure returns to: Exact owner scope, no changes to other API/UI state or authority.
- Completion criteria: exact eight staged paths, actual gates, one commit.
- Rollback: Before commit withdraw only task paths. After commit separately approved focused revert.
- Commit paths: `src/api/processAgentOutcomes.test.ts`, `src/pages/ExecutionTimelinePage.test.tsx`, `src/api/processAgentOutcomes.ts`, `src/pages/ExecutionTimelinePage.tsx`, `src/permissions/references.ts`, `docs/egon/spec/2026-11-05-22-47-process-agent-outcomes-console.md`, `docs/egon/plan/2026-11-05-22-48-process-agent-outcomes-console.md`, `docs/egon/evidence/2026-11-05-process-agent-outcomes-console.md`
- Commit: feat(tianji-web): observe Process-local Agent outcomes.

## 8. Test, Validation, and Quality Gates

| Gate | Exact phase | Outcome |
| --- | --- | --- |
| R1 | API A real pass-through and A test | foreign page incorrectly resolves, one assertion |
| R2 | existing page and red UI test only | exact selected detail visible but outcome button absent |
| G1 | B source and exact finite files | all actual suites, typecheck/lint pass |
| P1 | official Web static package and actual producer comparison | one new exact CALLS, no other PaC authority |
| S1 | strict docs and stage | exact eight paths and one commit |

```sh
npm test -- src/api/processAgentOutcomes.test.ts -t 'rejects a foreign Process Agent outcome page$'
npm test -- src/pages/ExecutionTimelinePage.test.tsx -t 'offers an explicit Process Agent outcome lookup only after current detail succeeds$'
npm test -- src/api/processAgentOutcomes.test.ts src/pages/ExecutionTimelinePage.test.tsx src/auth/AuthContext.test.tsx src/App.test.tsx
npm run typecheck
npm run lint

outcomes_web_pac=/Users/mario/.codex/tmp/tianji-agent-upgrade-20261105/t4-04/owned-tool-timeline/root-proof.fg6w4G
PAC_SDK_DIR=/Users/mario/SelfProject/Stellar-Enclosure/web-sdk \
PAC_TOOLCHAIN_LOCK="$outcomes_web_pac/validation-toolchain.lock.json" \
PAC_CONTRACT_ARTIFACT="$outcomes_web_pac/verified-jianshen-contract.jar" npm run build
python3 ../.agents/skills/stellar-enclosure-coding-writing-spec/scripts/validate_spec.py \
  docs/egon/spec/2026-11-05-22-47-process-agent-outcomes-console.md --strict
python3 ../.agents/skills/stellar-enclosure-coding-writing-plan/scripts/validate_plan.py \
  docs/egon/plan/2026-11-05-22-48-process-agent-outcomes-console.md --strict
git diff --check
git diff --cached --check
git diff --cached --name-only
```

Run REDs only in their phases. G1 actual focused files, no browser. P1 compare final manifest/artifact against current Tool timeline final-manifest.json and actual PS producer raw manifest at t4-02/process-agent-outcomes/root/process-server-manifest.json. Require exactly added CALLS for tianji.api.process.agent.outcomes and no resource, permission, permission reference, message, APP or other CALLS delta. Compare producer actual GET+HEAD, exact path, existing READ/scope and principals. Verify embedded new artifact binding using existing SDK canonicalize/build proof. No package deployment, grant registration or browser.

## 9. Migration, Compatibility, Rollout, and Rollback

Existing PS flags default false and auth/current behavior remain. 404 unavailable, existing auth failure clears current global frame, other ordinary failures stay independent. No C/PS/CL/DB/config changes.

## 10. Requirement-to-Step Traceability Matrix

| ID | Step | Gate |
| --- | --- | --- |
| REQ-001 | 1 | R2/G1/P1 |
| REQ-002 | 1 | R1/G1 |
| REQ-003 | 1 | G1/P1 |
| REQ-004 | 1 | G1/P1/S1 |

## 11. Risks, Blockers, and User Decisions

PS local result is not current live AS truth or a grant to read a linked run. Actual BFF/IAM/browser and S12 independent. Wait for exact producer proof before source.

## 12. Review and Acceptance

### 12.5 Blocking Manual Check

| Check ID | Applicability | Status | Evidence | Finding | Required action/exception |
| --- | --- | --- | --- | --- | --- |
| MC-ARCH-001 | Applicable | PASS | §7/8/14 | Current Process page and exact owner consumer | None |
| MC-REUSE-001 | Applicable | PASS | §7/8/14 | Existing layout, requestJson, authority | None |
| MC-DEP-001 | Applicable | PASS | §7/8/14 | No dependency change | None |
| MC-NAME-001 | Applicable | PASS | §7/8/14 | Exact local API and page names | None |
| MC-VALID-001 | Applicable | PASS | §7/8/14 | Closed instance, cursor, state and chronology | None |
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

**PASS — Ready for user review**
