# T4-04F 独立 Agent 关联查询实施计划

| Field | Value |
| --- | --- |
| Document | 2026-11-05-22-16-agent-correlation-console.md |
| Template Version | 5 |
| Status | Review |
| Created | 2026-11-05 22:16 Asia/Shanghai |
| Updated | 2026-11-05 22:16 Asia/Shanghai |
| Owner | Tianji Web |
| Repository | tianji-web |
| Scope | 现有 Process 关联页可选 Agent 读取，四个 Web 文件及三份文档 |
| Source Requirement | Master §19 T4-04/T4-02 exact current owner discovery |
| Baseline Revision | Web 45184f1b464d2c6d7c1a4838db8f2dbc4392282a；AS actual producer 7072e5b9153d1cda4ee38be60eeb9651b102a885 |
| Implements Spec | [Agent correlation console](../spec/2026-11-05-22-15-agent-correlation-console.md) |
| Spec Status | Review |
| Spec Revision | 2026-11-05 22:15 Asia/Shanghai, SHA-256 5f5289238e8b001c68ab18f9f5e71a60966e3ca938566306b4f483f1fa5eb585 |
| Effective Specs | [Agent correlation console](../spec/2026-11-05-22-15-agent-correlation-console.md) |
| Depends On Plans | None |
| Supersedes | None |
| Superseded By | None |
| Related Plans | [Master](../../../../docs/plans/agent-framework-upgrade-plan.md) |

## 1. Summary

在已成功显示 Process 回执页后，现有 Agent READ 用户可手动发起另一个已授权 LIST。现有 route/PaC 不变。一个 Web 逻辑提交。

## 2. Target Spec and Effective Design

Primary Spec §§7/9/10/12 决定 exact current owner、独立分页、同文本无关系、现有 auth invalidation。实际 AS producer 先于 Web source GO。Backend/PS 配置无变动。

## 3. Effective Requirements and Acceptance

| ID | Acceptance |
| --- | --- |
| REQ-001 | Existing READ and APP/resources only |
| REQ-002 | exact LIST filter with independent cursor and bounded page |
| REQ-003 | independent source and existing detail route, no inferred link |
| REQ-004 | state clear/abort and current global auth, ordinary failures stay local |
| REQ-005 | targeted/type/lint/static zero-PaC and exact seven paths |

## 4. Implementation Strategy and Dependency Order

R1 API A and test prove out-of-window acceptance. R2 baseline UI with test proves missing explicit Agent read. B API then UI. Existing declarations and Service byte-identical. One commit.

### 4.7 Java, Spring, and Egon-COLA Implementation Standards

| Concern | Current repository evidence | Effective Spec decision |
| --- | --- | --- |
| Backend | AS actual existing LIST filter/PaC | Consume only, no Java |
| Web owner | Current timeline page and Agent route | Reuse existing current local guards and shared auth |
| API | Current agentApi/list and Process query validators | Separate exact optional read without changing old list |

| Need | Candidates inspected | Exact evidence | Fit/gap | Decision |
| --- | --- | --- | --- | --- |
| New consumer | Existing Agent LIST filter | actual packaged OAS + current manifest | can safely reuse | TS method only |
| Optional UI | Existing Process timeline and Agent run page | current resources and route | same page meets need | separate owned panel |
| Error authority | Shared requestJson/AuthContext | 403 invalidates global context | use current policy | no override |

### 4.8 User-mandated Java Rule Implementation Matrix

| Literal rule | Spec source | Repository evidence | Exact files and order | Pseudocode obligations | Validation gate | Steps | Status/blocker |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Rule 1 | §6.2 | Web only | Step 1 | No Java behavior change | G1/P1 | 1 | N/A |
| Rule 2 | §6.2 | Web only | Step 1 | No Java behavior change | G1/P1 | 1 | N/A |
| Rule 3 | §6.2 | Web only | Step 1 | No Java behavior change | G1/P1 | 1 | N/A |
| Rule 4 | §6.2 | Web only | Step 1 | No Java behavior change | G1/P1 | 1 | N/A |
| Rule 5 | §6.2 | Web only | Step 1 | No Java behavior change | G1/P1 | 1 | N/A |
| Rule 6 | §6.2 | Web only | Step 1 | No Java behavior change | G1/P1 | 1 | N/A |
| Rule 7 | §6.2 | Web only | Step 1 | No Java behavior change | G1/P1 | 1 | N/A |
| Rule 9 | §6.2 | Web only | Step 1 | No Java behavior change | G1/P1 | 1 | N/A |
| Rule 10 | §6.2 | Web only | Step 1 | No Java behavior change | G1/P1 | 1 | N/A |
| Rule 11 | §6.2 | Web only | Step 1 | No Java behavior change | G1/P1 | 1 | N/A |

### 4.9 Time semantics and conversion contract

Time contract: Required

| Time ID | Fields/symbols | Semantics | Java/runtime type | Storage policy | Wire policy | Business zone source | Display zone source | Boundary / DST rules | Precision / Clock | Compatibility | Verification |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| TIME-001 | fromInclusive/toExclusive, createdAt | Occurred instant | TS string, exact UTC key | Not persisted | UTC Z | Explicit UTC | UTC time text | Same half-open current PS window, no local calendar | six fraction digits, current server clock authority | Existing public Agent time values | Step 1 TEST-001 and TEST-002 |

## 5. Change File Tree

| Operation | Exact path | Purpose | Gate |
| --- | --- | --- | --- |
| MODIFY | `src/api/agent.test.ts` | Existing Agent API filter tests | R1/G1 |
| MODIFY | `src/pages/ExecutionTimelinePage.test.tsx` | Timeline optional Agent tests | R2/G1 |
| MODIFY | `src/api/agent.ts` | Strict optional Agent transport | R1/G1 |
| MODIFY | `src/pages/ExecutionTimelinePage.tsx` | Independent Agent panel | R2/G1 |
| CREATE | `docs/egon/spec/2026-11-05-22-15-agent-correlation-console.md` | Canonical Spec | S1 |
| CREATE | `docs/egon/plan/2026-11-05-22-16-agent-correlation-console.md` | Canonical Plan | S1 |
| CREATE | `docs/egon/evidence/2026-11-05-agent-correlation-console.md` | Actual evidence | S1 |

## 6. Prerequisites, Constraints, and Plan Clarifications

Verify Web clean exact 45184f1b464d2c6d7c1a4838db8f2dbc4392282a and actual AS producer commit plus exec SHA f4cf3380bb22929bad18ff198d0e85b7cc67b7b5d061d5ac6a17f29187e4b1b4, manifest SHA 1042f3e1b48fe202b3bb17a8c551b1b6eaafa22352e9c96fd12806582dd0e971, OAS SHA 718db475744eab746ad41f9307a8263381a0582ec6682bbb953f70ec6e4b3b6a. Scratch API at t4-04/agent-correlation-web/api-draft; UI at t4-02/agent-correlation/web-ui-draft. Node24 existing installed deps, previous approved Process console static toolchain copy, no browser/start/install/grants. Review and exact source GO independent.

## 7. Ordered File-by-file Implementation Steps

### Step 1 — Show independently authorized same-correlation Agent runs

- Requirements: REQ-001, REQ-002, REQ-003, REQ-004, REQ-005.
- Dependencies: Reviewed exact Spec, Plan, current AS producer and source GO.
- Baseline state: Current Process timeline only; existing Agent LIST has no Web consumer for filter.
- Observable outcome: Same query user may explicitly show bounded independent owned Agent list.
- End state: Four exact Web files and three docs, one commit.
- Test-first gate: Required. R1 expected rejection of out-of-window vs resolved baseline; R2 expected authorized optional control missing on baseline UI.
- Manual Checks: MC-ARCH-001, MC-REUSE-001, MC-DEP-001, MC-NAME-001, MC-VALID-001, MC-MODEL-001, MC-JSON-001, MC-TIME-001, MC-PATTERN-001, MC-SCOPE-001, MC-TEST-001, MC-BLOCKER-001.
- Literal Rules: Rule 1, Rule 2, Rule 6, Rule 10, Rule 11. Java-only surface stays unchanged.
- Ordered files:

#### File 1 — `MODIFY src/api/agent.test.ts`

- Purpose: Existing Agent API filter tests.
- Symbols: Existing Agent API filter tests in this exact path.
- Repository evidence: Shared mock fetch and existing agent.test.
- Dependencies and consumers: Existing exact Web owner and R1/G1 source phase.
- Why now: Establish R1/G1 before the next dependent phase.
- Contract/signature changes: Local Web only, current service unchanged.
- Input/output and state mapping: Exact scoped behavior below.
- Error and edge behavior: Existing global auth and current request invalidation preserve scope.
- Standards impact: MC-REUSE-001, MC-SCOPE-001, MC-TEST-001.
- Literal rule enforcement: Rule 11 preserves existing Web and Agent/Process owner boundaries.
- Implementation pseudocode:

```ts
return a valid-shaped run at exclusive upper boundary; expect rejection;
assert exact existing GET/tenant/abort and old list cursor stays intact;
cover cap/cursor/order/window and actual shared 403 invalidation;
```

- Verification contribution: R1/G1.
- After this file: Exact source or evidence enters R1/G1.

#### File 2 — `MODIFY src/pages/ExecutionTimelinePage.test.tsx`

- Purpose: Timeline optional Agent tests.
- Symbols: Timeline optional Agent tests in this exact path.
- Repository evidence: Existing useAuth and Process timeline owner test.
- Dependencies and consumers: Existing exact Web owner and R2/G1 source phase.
- Why now: Establish R2/G1 before the next dependent phase.
- Contract/signature changes: Local Web only, current service unchanged.
- Input/output and state mapping: Exact scoped behavior below.
- Error and edge behavior: Existing global auth and current request invalidation preserve scope.
- Standards impact: MC-REUSE-001, MC-SCOPE-001, MC-TEST-001.
- Literal rule enforcement: Rule 11 preserves existing Web and Agent/Process owner boundaries.
- Implementation pseudocode:

```tsx
mount under current Process and Agent grants, submit a valid Process query;
assert no automatic Agent request, then explicit optional button and exact independent filter;
exercise next, ordinary Agent failure with PS receipt preserved, permission/epoch invalidation and detail gate;
```

- Verification contribution: R2/G1.
- After this file: Exact source or evidence enters R2/G1.

#### File 3 — `MODIFY src/api/agent.ts`

- Purpose: Strict optional Agent transport.
- Symbols: Strict optional Agent transport in this exact path.
- Repository evidence: Existing agentApi, shared requestJson and Process UTC validator.
- Dependencies and consumers: Existing exact Web owner and R1/G1 source phase.
- Why now: Establish R1/G1 before the next dependent phase.
- Contract/signature changes: Local Web only, current service unchanged.
- Input/output and state mapping: Exact scoped behavior below.
- Error and edge behavior: Existing global auth and current request invalidation preserve scope.
- Standards impact: MC-REUSE-001, MC-SCOPE-001, MC-TEST-001.
- Literal rule enforcement: Rule 11 preserves existing Web and Agent/Process owner boundaries.
- Implementation pseudocode:

```ts
A pass-through uses same GET and allows valid-shaped out-of-window result;
B capture exact query, cap Agent cursor at 256 and send only existing GET filter keys;
validate ≤20 closed AgentRun rows, unique C order and UTC window, keep legacy method intact;
```

- Verification contribution: R1/G1.
- After this file: Exact source or evidence enters R1/G1.

#### File 4 — `MODIFY src/pages/ExecutionTimelinePage.tsx`

- Purpose: Independent Agent panel.
- Symbols: Independent Agent panel in this exact path.
- Repository evidence: Existing ExecutionTimelinePage/Agent detail navigation.
- Dependencies and consumers: Existing exact Web owner and R2/G1 source phase.
- Why now: Establish R2/G1 before the next dependent phase.
- Contract/signature changes: Local Web only, current service unchanged.
- Input/output and state mapping: Exact scoped behavior below.
- Error and edge behavior: Existing global auth and current request invalidation preserve scope.
- Standards impact: MC-REUSE-001, MC-SCOPE-001, MC-TEST-001.
- Literal rule enforcement: Rule 11 preserves existing Web and Agent/Process owner boundaries.
- Implementation pseudocode:

```tsx
after a successful Process result and current Agent page grant show one explicit read;
separate Agent state and cursor, strip PS cursor, abort on frame and edits;
show current owned same-correlation results and allowed existing detail links, never infer relation;
```

- Verification contribution: R2/G1.
- After this file: Exact source or evidence enters R2/G1.

#### File 5 — `CREATE docs/egon/spec/2026-11-05-22-15-agent-correlation-console.md`

- Purpose: Canonical Spec.
- Symbols: Canonical Spec in this exact path.
- Repository evidence: Master and actual AS producer.
- Dependencies and consumers: Existing exact Web owner and S1 source phase.
- Why now: Establish S1 before the next dependent phase.
- Contract/signature changes: Local Web only, current service unchanged.
- Input/output and state mapping: Exact scoped behavior below.
- Error and edge behavior: Existing global auth and current request invalidation preserve scope.
- Standards impact: MC-REUSE-001, MC-SCOPE-001, MC-TEST-001.
- Literal rule enforcement: Rule 11 preserves existing Web and Agent/Process owner boundaries.
- Implementation pseudocode:

```text
copy reviewed Spec at the exact canonical path and verify digest;
check current AS owner contract and existing global auth remain;
run strict validator and preserve independent runtime limits;
```

- Verification contribution: S1.
- After this file: Exact source or evidence enters S1.

#### File 6 — `CREATE docs/egon/plan/2026-11-05-22-16-agent-correlation-console.md`

- Purpose: Canonical Plan.
- Symbols: Canonical Plan in this exact path.
- Repository evidence: Current source and actual build patterns.
- Dependencies and consumers: Existing exact Web owner and S1 source phase.
- Why now: Establish S1 before the next dependent phase.
- Contract/signature changes: Local Web only, current service unchanged.
- Input/output and state mapping: Exact scoped behavior below.
- Error and edge behavior: Existing global auth and current request invalidation preserve scope.
- Standards impact: MC-REUSE-001, MC-SCOPE-001, MC-TEST-001.
- Literal rule enforcement: Rule 11 preserves existing Web and Agent/Process owner boundaries.
- Implementation pseudocode:

```text
copy approved Plan bytes and verify primary Spec hash;
enforce exact R1/R2, finite and official static verification;
compare all seven paths and one commit before source close;
```

- Verification contribution: S1.
- After this file: Exact source or evidence enters S1.

#### File 7 — `CREATE docs/egon/evidence/2026-11-05-agent-correlation-console.md`

- Purpose: Actual evidence.
- Symbols: Actual evidence in this exact path.
- Repository evidence: Existing Web source evidence.
- Dependencies and consumers: Existing exact Web owner and S1 source phase.
- Why now: Establish S1 before the next dependent phase.
- Contract/signature changes: Local Web only, current service unchanged.
- Input/output and state mapping: Exact scoped behavior below.
- Error and edge behavior: Existing global auth and current request invalidation preserve scope.
- Standards impact: MC-REUSE-001, MC-SCOPE-001, MC-TEST-001.
- Literal rule enforcement: Rule 11 preserves existing Web and Agent/Process owner boundaries.
- Implementation pseudocode:

```text
record actual red and focused/type/lint and static proof;
record zero declarative PaC delta and exact current AS artifact reference;
record one commit and current BFF/browser/S12 boundary separately;
```

- Verification contribution: S1.
- After this file: Exact source or evidence enters S1.


- Validation working directory: /Users/mario/SelfProject/Stellar-Enclosure/tianji-web.
- Verification command: §8 R1/R2/G1/P1/S1.
- Expected result: Two intended owning failures and actual positive scope.
- Failure returns to: Exact affected scope; no cross-owner/authority adjustment.
- Completion criteria: Actual finite and static zero-PaC, exact seven staged paths.
- Rollback: Before commit withdraw only task paths. After commit separate focused revert approval.
- Commit paths: `src/api/agent.test.ts`, `src/pages/ExecutionTimelinePage.test.tsx`, `src/api/agent.ts`, `src/pages/ExecutionTimelinePage.tsx`, `docs/egon/spec/2026-11-05-22-15-agent-correlation-console.md`, `docs/egon/plan/2026-11-05-22-16-agent-correlation-console.md`, `docs/egon/evidence/2026-11-05-agent-correlation-console.md`
- Commit: feat(tianji-web): inspect owned Agent runs by correlation.

## 8. Test, Validation, and Quality Gates

| Gate | Exact phase | Expected |
| --- | --- | --- |
| R1 | API A declaration/pass-through plus API test | 200 out-of-window wrongly resolves, one assertion |
| R2 | unchanged timeline plus web-ui-draft/red test | optional authorized control absent, one assertion |
| G1 | B files | actual focus 4 files, typecheck/lint |
| P1 | official offline static package | exact prior policy, metadata and declarations, actual AS producer |
| S1 | strict docs and scope | 7 paths and one commit |

```sh
npm test -- src/api/agent.test.ts -t 'rejects an Agent run outside the captured correlation window$'
npm test -- src/pages/ExecutionTimelinePage.test.tsx -t 'offers an explicit Agent lookup only after an authorized Process result$'
npm test -- src/api/agent.test.ts src/api/processCorrelations.test.ts src/pages/ExecutionTimelinePage.test.tsx src/auth/AuthContext.test.tsx
npm run typecheck
npm run lint

agent_web_pac=/Users/mario/.codex/tmp/tianji-agent-upgrade-20261105/t4-04/process-correlations/root/build.n1OUnm
PAC_SDK_DIR=/Users/mario/SelfProject/Stellar-Enclosure/web-sdk \
PAC_TOOLCHAIN_LOCK="$agent_web_pac/validation-toolchain.lock.json" \
PAC_CONTRACT_ARTIFACT="$agent_web_pac/verified-jianshen-contract.jar" npm run build
python3 ../.agents/skills/stellar-enclosure-coding-writing-spec/scripts/validate_spec.py \
  docs/egon/spec/2026-11-05-22-15-agent-correlation-console.md --strict
python3 ../.agents/skills/stellar-enclosure-coding-writing-plan/scripts/validate_plan.py \
  docs/egon/plan/2026-11-05-22-16-agent-correlation-console.md --strict
git diff --check
git diff --cached --check
git diff --cached --name-only
```

Run only named RED selectors with corresponding A/baseline phase, verify exactly one intentional failure. G1 fresh selected reports with no failure. P1 compare actual final Web manifest and artifact to same current Web baseline final-manifest.json using existing SDK canonicalize/build verifier. Exact zero delta of application, producer, permission definitions/references, resource declarations/references, messages, policy and metadata. Verify existing tianji.api.agent.list in actual AS raw manifest at t4-02/agent-correlation/root/agent-server-manifest.json, GET/HEAD same path, existing READ/scope, and embedded Web artifact digest binding. Existing build/test scripts suffice. No full Web suite required because App, auth, registries and shared transport unchanged.

## 9. Migration, Compatibility, Rollout, and Rollback

No service, schema, config, dependencies, IAM or browser changes. Existing PS flow and Agent old list unchanged. Shared invalidation remains authoritative, ordinary Agent failures stay in its block.

## 10. Requirement-to-Step Traceability Matrix

| ID | Step | Gate |
| --- | --- | --- |
| REQ-001 | 1 | R2/G1/P1 |
| REQ-002 | 1 | R1/G1 |
| REQ-003 | 1 | R2/G1 |
| REQ-004 | 1 | G1 |
| REQ-005 | 1 | G1/P1/S1 |

## 11. Risks, Blockers, and User Decisions

Current AS filtered response does not echo correlation. Browser validates current query/frame and returned shape/order/time, not provenance. Backend producer proof and current AuthContext authority retain their limits. No cross-owner assertion or real S12.

## 12. Review and Acceptance

### 12.5 Blocking Manual Check

| Check ID | Applicability | Status | Evidence | Finding | Required action/exception |
| --- | --- | --- | --- | --- | --- |
| MC-ARCH-001 | Applicable | PASS | §7/8/14 | Existing Web/API owners | None |
| MC-REUSE-001 | Applicable | PASS | §7/8/14 | Existing shared transport and routes | None |
| MC-DEP-001 | Applicable | PASS | §7/8/14 | No dependency changes | None |
| MC-NAME-001 | Applicable | PASS | §7/8/14 | Existing exact local API/page names | None |
| MC-VALID-001 | Applicable | PASS | §7/8/14 | Closed filtered shape/current owner | None |
| MC-MODEL-001 | Applicable | PASS | §7/8/14 | Readonly existing C mirror | None |
| MC-CONVERT-001 | Not applicable | N/A | §7/8/14 | No Java conversion | None |
| MC-LOG-001 | Not applicable | N/A | §7/8/14 | No new log | None |
| MC-BEAN-001 | Not applicable | N/A | §7/8/14 | No backend bean | None |
| MC-UTIL-001 | Applicable | PASS | §7/8/14 | Existing UTC and local Web primitives | None |
| MC-JSON-001 | Applicable | PASS | §7/8/14 | Closed parsed summary | None |
| MC-TIME-001 | Applicable | PASS | §7/8/14 | UTC micros | None |
| MC-CONFIG-001 | Not applicable | N/A | §7/8/14 | No config | None |
| MC-PATTERN-001 | Applicable | PASS | §7/8/14 | Existing scoped request | None |
| MC-SCOPE-001 | Applicable | PASS | §7/8/14 | Four Web files, no PaC delta | None |
| MC-TEST-001 | Applicable | PASS | §7/8/14 | Exact finite/static proof | None |
| MC-BLOCKER-001 | Applicable | PASS | §7/8/14 | Actual producer fixed, runtime separate | None |

**PASS — Ready for user review**
