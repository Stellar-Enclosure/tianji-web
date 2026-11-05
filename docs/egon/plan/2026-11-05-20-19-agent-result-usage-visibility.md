# T4-04 Agent 结果用量状态实施计划

| Field | Value |
| --- | --- |
| Document | 2026-11-05-20-19-agent-result-usage-visibility.md |
| Template Version | 5 |
| Status | Review |
| Created | 2026-11-05 20:19 Asia/Shanghai |
| Updated | 2026-11-05 20:19 Asia/Shanghai |
| Owner | Tianji Web |
| Repository | tianji-web |
| Scope | 两个现有 Web 文件、两个现有测试及三份文档 |
| Source Requirement | Master T4-04 的费用 UNKNOWN 展示 |
| Baseline Revision | Web ee026e99fe898989b3affe7641cd1d145353a15d; Service d5ccd8225da3c8f27adffdee04cb9d1d787ed7f2 |
| Implements Spec | [Agent result usage visibility](../spec/2026-11-05-20-18-agent-result-usage-visibility.md) |
| Spec Status | Review |
| Spec Revision | 2026-11-05 20:18 Asia/Shanghai, SHA-256 43b52289a6f50c858543179ebfa84e32c4788e3792856a7e56b1f84d229952d5 |
| Effective Specs | [Agent result usage visibility](../spec/2026-11-05-20-18-agent-result-usage-visibility.md) |
| Depends On Plans | None |
| Supersedes | None |
| Superseded By | None |
| Related Plans | [Master T4-04](../../../../docs/plans/agent-framework-upgrade-plan.md) |

## 1. Summary

在现有结果 GET 和运行详情内显示已报告的安全整数及用量/费用状态。闭合 optional usage 保留既有结果。当前执行器一般返回 null。一个 Web-only 提交，无新请求、权限、backend 或价格生产链。

## 2. Target Spec and Effective Design

Spec §§7/10/12 约束 closed optional projection 和现有结果/终态身份。使用 Source87 的干净 Web、已确证静态工具链副本及当前已提交 AS 作为合同证据。实际 source GO 独立于 Review。

## 3. Effective Requirements and Acceptance

| ID | Evidence |
| --- | --- |
| REQ-001 | 同一 exact result GET、tenant、abort、既有 READ 与零 PaC |
| REQ-002 | malformed optional 不影响合法输出，raw 费用及引用不出投影 |
| REQ-003 | 实测、估算、未知，安全整数零保留，金额只显示两种安全状态 |
| REQ-004 | 终态、身份切换、有限和静态证据边界 |

## 4. Implementation Strategy and Dependency Order

R1/R2 只修改对应测试，保持原实现以验证 genuine RED。B 先 API 投影再当前页面。最终只提交七路径，静态权限策略保持等值。

### 4.7 Java, Spring, and Egon-COLA Implementation Standards

| Concern | Current repository evidence | Effective Spec decision |
| --- | --- | --- |
| Existing public result | C AgentExecutionResult and AS AgentRunController | Read existing only, no Java layer change |
| Frontend composition | agentApi and Run Detail | Reuse shared HTTP and existing AntD |
| Current authority | App protected Run Detail and verified requestJson | No PaC route/action or identity change |

| Need | Candidates inspected | Exact evidence | Fit/gap | Decision |
| --- | --- | --- | --- | --- |
| Public usage status | Existing Agent result | Optional known C DTO | Satisfies same-owner existing case | Reuse |
| Decimal precision | Shared JSON transport | BigDecimal becomes Number | Raw exact lexeme unavailable | Presence only |
| Terminal display | Existing AgentRunDetailPage Descriptions and output Card | Current verified terminal result | No new independent state | Reuse |

### 4.8 User-mandated Java Rule Implementation Matrix

| Literal rule | Spec source | Repository evidence | Exact files and order | Pseudocode obligations | Validation gate | Steps | Status/blocker |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Rule 1 | §6.2 | Web only | Step 1 | No Java production changes | G1/S1 | 1 | N/A |
| Rule 2 | §6.2 | Web only | Step 1 | No Java production changes | G1/S1 | 1 | N/A |
| Rule 3 | §6.2 | Web only | Step 1 | No Java production changes | G1/S1 | 1 | N/A |
| Rule 4 | §6.2 | Web only | Step 1 | No Java production changes | G1/S1 | 1 | N/A |
| Rule 5 | §6.2 | Web only | Step 1 | No Java production changes | G1/S1 | 1 | N/A |
| Rule 6 | §6.2 | Web only | Step 1 | No Java production changes | G1/S1 | 1 | N/A |
| Rule 7 | §6.2 | Web only | Step 1 | No Java production changes | G1/S1 | 1 | N/A |
| Rule 9 | §6.2 | Web only | Step 1 | No Java production changes | G1/S1 | 1 | N/A |
| Rule 10 | §6.2 | Web only | Step 1 | No Java production changes | G1/S1 | 1 | N/A |
| Rule 11 | §6.2 | Web only | Step 1 | No Java production changes | G1/S1 | 1 | N/A |

### 4.9 Time semantics and conversion contract

Time contract: Not applicable
Reason: Existing run/event timestamps stay intact. The optional usage projection does not contain any timestamp.

## 5. Change File Tree

| Operation | Exact path | Purpose | Gate |
| --- | --- | --- | --- |
| MODIFY | `src/api/agent.test.ts` | exact R1 and wire/usage checks | R1/G1 |
| MODIFY | `src/pages/AgentRunDetailPage.test.tsx` | exact R2 and terminal result visibility | R2/G1 |
| MODIFY | `src/api/agent.ts` | AgentResultUsage, resultUsage and result | G1 |
| MODIFY | `src/pages/AgentRunDetailPage.tsx` | Existing execution output Card and usage descriptions | G1 |
| CREATE | `docs/egon/spec/2026-11-05-20-18-agent-result-usage-visibility.md` | Spec and exact REQ-001–004 | S1 |
| CREATE | `docs/egon/plan/2026-11-05-20-19-agent-result-usage-visibility.md` | Step 1, R1/R2/G1/S1 | S1 |
| CREATE | `docs/egon/evidence/2026-11-05-agent-result-usage-visibility.md` | Actual RED, GREEN and static proof | S1 |

## 6. Prerequisites, Constraints, and Plan Clarifications

Require exact Web and Service baseline, clean tracked sources, Node 24.14.1 and already approved offline dependencies. C/AS/AR bytes are read-only proof. R1/R2 use scratch A test files only. The isolated 19-test B proof is preliminary and does not replace the actual source run. Use copied validated Source87 PAC lock/archive and capture actual baseline/final manifest independently. Do not touch checked-in lock or credentials.

## 7. Ordered File-by-file Implementation Steps

### Step 1 — Display existing Agent result usage safely

- Requirements: REQ-001, REQ-002, REQ-003, REQ-004.
- Dependencies: Reviewed exact Spec, Plan and Source GO. Exact Source87 Web and current Service lock.
- Baseline state: Existing result is returned with no typed usage display, current executor normally stores null.
- Observable outcome: Existing result output coexists with same-run terminal count and fixed monetary status.
- End state: Four exact Web files and three docs, one focused commit.
- Test-first gate: Required. R1 misses normalized presence and leaks raw shape; R2 checks missing 费用未知 only after existing output rendered.
- Manual Checks: MC-ARCH-001, MC-REUSE-001, MC-DEP-001, MC-NAME-001, MC-VALID-001, MC-MODEL-001, MC-JSON-001, MC-SCOPE-001, MC-TEST-001, MC-BLOCKER-001.
- Literal Rules: Rule 1, Rule 2, Rule 6, Rule 11. Java-only requirements are inapplicable. Existing production authority remains.
- Ordered files:

#### File 1 — `MODIFY src/api/agent.test.ts`

- Purpose: exact R1 and wire/usage checks.
- Symbols: exact R1 and wire/usage checks.
- Repository evidence: Agent JSON client fixture and requestJson.
- Dependencies and consumers: Existing agent result consumer and run detail or exact reviewed documentation.
- Why now: This path is used in the declared R1/G1 source phase.
- Contract/signature changes: exact R1 and wire/usage checks. Existing public service contract stays.
- Input/output and state mapping: See below for exact local conversion and observable output.
- Error and edge behavior: Reject foreign results and preserve valid output when optional usage is unavailable. Documentation records any unmet gate.
- Standards impact: MC-REUSE-001, MC-SCOPE-001, MC-TEST-001.
- Literal rule enforcement: Rule 11 preserves the existing Web/AS/AR owner boundaries.
- Implementation pseudocode:

```ts
stub existing GET with typed result plus all seven C usage keys
expect resolved normalized counters and presence without cost/currency/priceVersionRef
assert same endpoint/tenant/abort and valid output for absent, malformed and unsafe input
```

- Verification contribution: R1/G1.
- After this file: The corresponding exact R1/G1 artifact is ready for validation.

#### File 2 — `MODIFY src/pages/AgentRunDetailPage.test.tsx`

- Purpose: exact R2 and terminal result visibility.
- Symbols: exact R2 and terminal result visibility.
- Repository evidence: Current Agent Run Detail mocks and view.
- Dependencies and consumers: Existing agent result consumer and run detail or exact reviewed documentation.
- Why now: This path is used in the declared R2/G1 source phase.
- Contract/signature changes: exact R2 and terminal result visibility. Existing public service contract stays.
- Input/output and state mapping: See below for exact local conversion and observable output.
- Error and edge behavior: Reject foreign results and preserve valid output when optional usage is unavailable. Documentation records any unmet gate.
- Standards impact: MC-REUSE-001, MC-SCOPE-001, MC-TEST-001.
- Literal rule enforcement: Rule 11 preserves the existing Web/AS/AR owner boundaries.
- Implementation pseudocode:

```tsx
return matching terminal run and result without usage
wait for existing output, then assert 费用未知 exists
assert safe zero versus unknown, two labels, nonterminal no result and stale tenant suppression
```

- Verification contribution: R2/G1.
- After this file: The corresponding exact R2/G1 artifact is ready for validation.

#### File 3 — `MODIFY src/api/agent.ts`

- Purpose: AgentResultUsage, resultUsage and result.
- Symbols: AgentResultUsage, resultUsage and result.
- Repository evidence: Existing shared HTTP and C optional usage DTO.
- Dependencies and consumers: Existing agent result consumer and run detail or exact reviewed documentation.
- Why now: This path is used in the declared G1 source phase.
- Contract/signature changes: AgentResultUsage, resultUsage and result. Existing public service contract stays.
- Input/output and state mapping: See below for exact local conversion and observable output.
- Error and edge behavior: Reject foreign results and preserve valid output when optional usage is unavailable. Documentation records any unmet gate.
- Standards impact: MC-REUSE-001, MC-SCOPE-001, MC-TEST-001.
- Literal rule enforcement: Rule 11 preserves the existing Web/AS/AR owner boundaries.
- Implementation pseudocode:

```ts
validate existing result envelope and requested exact runId before reading optional usage
accept only seven closed keys and known kind; malformed returns null
project safe Long counters and amount presence; never forward raw price/currency/ref
return exact existing output, status, errors and normalized nullable usage
```

- Verification contribution: G1.
- After this file: The corresponding exact G1 artifact is ready for validation.

#### File 4 — `MODIFY src/pages/AgentRunDetailPage.tsx`

- Purpose: Existing execution output Card and usage descriptions.
- Symbols: Existing execution output Card and usage descriptions.
- Repository evidence: Current terminal refresh and owner component key.
- Dependencies and consumers: Existing agent result consumer and run detail or exact reviewed documentation.
- Why now: This path is used in the declared G1 source phase.
- Contract/signature changes: Existing execution output Card and usage descriptions. Existing public service contract stays.
- Input/output and state mapping: See below for exact local conversion and observable output.
- Error and edge behavior: Reject foreign results and preserve valid output when optional usage is unavailable. Documentation records any unmet gate.
- Standards impact: MC-REUSE-001, MC-SCOPE-001, MC-TEST-001.
- Literal rule enforcement: Rule 11 preserves the existing Web/AS/AR owner boundaries.
- Implementation pseudocode:

```tsx
render existing output as before from matched result
if current run and exact result are terminal show existing AntD Descriptions
render 0 via nullish fallback, distinguish ACTUAL/ESTIMATED/UNKNOWN and fixed fee labels
reuse request abort and remount for prior tenant; add no fetching or permission
```

- Verification contribution: G1.
- After this file: The corresponding exact G1 artifact is ready for validation.

#### File 5 — `CREATE docs/egon/spec/2026-11-05-20-18-agent-result-usage-visibility.md`

- Purpose: Spec and exact REQ-001–004.
- Symbols: Spec and exact REQ-001–004.
- Repository evidence: Master scope and current C/AS/Web sources.
- Dependencies and consumers: Existing agent result consumer and run detail or exact reviewed documentation.
- Why now: This path is used in the declared S1 source phase.
- Contract/signature changes: Spec and exact REQ-001–004. Existing public service contract stays.
- Input/output and state mapping: See below for exact local conversion and observable output.
- Error and edge behavior: Reject foreign results and preserve valid output when optional usage is unavailable. Documentation records any unmet gate.
- Standards impact: MC-REUSE-001, MC-SCOPE-001, MC-TEST-001.
- Literal rule enforcement: Rule 11 preserves the existing Web/AS/AR owner boundaries.
- Implementation pseudocode:

```text
copy the reviewed Spec bytes at the canonical exact path
verify scope retains result GET, owner, four Web files and no amount claim
run strict Spec validator and compare exact baseline commitments
```

- Verification contribution: S1.
- After this file: The corresponding exact S1 artifact is ready for validation.

#### File 6 — `CREATE docs/egon/plan/2026-11-05-20-19-agent-result-usage-visibility.md`

- Purpose: Step 1, R1/R2/G1/S1.
- Symbols: Step 1, R1/R2/G1/S1.
- Repository evidence: Existing Source87 validation shape.
- Dependencies and consumers: Existing agent result consumer and run detail or exact reviewed documentation.
- Why now: This path is used in the declared S1 source phase.
- Contract/signature changes: Step 1, R1/R2/G1/S1. Existing public service contract stays.
- Input/output and state mapping: See below for exact local conversion and observable output.
- Error and edge behavior: Reject foreign results and preserve valid output when optional usage is unavailable. Documentation records any unmet gate.
- Standards impact: MC-REUSE-001, MC-SCOPE-001, MC-TEST-001.
- Literal rule enforcement: Rule 11 preserves the existing Web/AS/AR owner boundaries.
- Implementation pseudocode:

```text
copy the approved Plan at its canonical exact path and validate primary Spec SHA
verify both real REDs precede the final source phase
confirm one commit, seven paths and existing PaC authority checks
```

- Verification contribution: S1.
- After this file: The corresponding exact S1 artifact is ready for validation.

#### File 7 — `CREATE docs/egon/evidence/2026-11-05-agent-result-usage-visibility.md`

- Purpose: Actual RED, GREEN and static proof.
- Symbols: Actual RED, GREEN and static proof.
- Repository evidence: Existing Web evidence conventions.
- Dependencies and consumers: Existing agent result consumer and run detail or exact reviewed documentation.
- Why now: This path is used in the declared S1 source phase.
- Contract/signature changes: Actual RED, GREEN and static proof. Existing public service contract stays.
- Input/output and state mapping: See below for exact local conversion and observable output.
- Error and edge behavior: Reject foreign results and preserve valid output when optional usage is unavailable. Documentation records any unmet gate.
- Standards impact: MC-REUSE-001, MC-SCOPE-001, MC-TEST-001.
- Literal rule enforcement: Rule 11 preserves the existing Web/AS/AR owner boundaries.
- Implementation pseudocode:

```text
record exact selected test reports, Node version and typecheck/lint from actual execution
record verified artifact digest and zero PaC policy/metadata change
state current producer generally emits null and real deployment remains operator-controlled
```

- Verification contribution: S1.
- After this file: The corresponding exact S1 artifact is ready for validation.


- Validation working directory: /Users/mario/SelfProject/Stellar-Enclosure/tianji-web.
- Verification command: §8 R1/R2/G1/S1.
- Expected result: Each red has exactly the owning assertion failure. Actual targeted B, typecheck/lint and static declaration equality pass.
- Failure returns to: Exact affected source, fixture or gate. Keep external runtime and authority out of scope.
- Completion criteria: Exact seven staged paths, fresh report and manifest facts, two clean repo revisions.
- Rollback: Before commit withdraw only owned changes. After commit use separate focused revert approval.
- Commit paths: `src/api/agent.test.ts`, `src/pages/AgentRunDetailPage.test.tsx`, `src/api/agent.ts`, `src/pages/AgentRunDetailPage.tsx`, `docs/egon/spec/2026-11-05-20-18-agent-result-usage-visibility.md`, `docs/egon/plan/2026-11-05-20-19-agent-result-usage-visibility.md`, `docs/egon/evidence/2026-11-05-agent-result-usage-visibility.md`
- Commit: feat(tianji-web): show reported Agent usage status.

## 8. Test, Validation, and Quality Gates

```sh
npm test -- src/api/agent.test.ts -t 'projects existing result usage without forwarding numeric amounts or private references$'
npm test -- src/pages/AgentRunDetailPage.test.tsx -t 'shows unknown usage and fees for an existing terminal result without usage$'
npm test -- src/api/agent.test.ts src/pages/AgentRunDetailPage.test.tsx src/api/agentEvents.test.ts src/auth/AuthContext.test.tsx src/App.test.tsx
npm run typecheck
npm run lint

usage_pac=/Users/mario/.codex/tmp/tianji-agent-upgrade-20261105/t4-04/release-comparison/root-proof.KPkm77
PAC_SDK_DIR=/Users/mario/SelfProject/Stellar-Enclosure/web-sdk \
PAC_TOOLCHAIN_LOCK="$usage_pac/validation-toolchain.lock.json" \
PAC_CONTRACT_ARTIFACT="$usage_pac/verified-jianshen-contract.jar" npm run build
python3 ../.agents/skills/stellar-enclosure-coding-writing-spec/scripts/validate_spec.py \
  docs/egon/spec/2026-11-05-20-18-agent-result-usage-visibility.md --strict
python3 ../.agents/skills/stellar-enclosure-coding-writing-plan/scripts/validate_plan.py \
  docs/egon/plan/2026-11-05-20-19-agent-result-usage-visibility.md --strict
git diff --check
git diff --cached --check
git diff --cached --name-only
```

Run only the first two commands before B in the stated test phases. R1 expect one deep-equality mismatch on the closed projection, R2 expect one exact missing DOM value assertion. G1 must run the focused five files with zero failures. The two owning suites have 19 cases in scratch. Static gate requires actual new build and equality of application, producer, resources, permissions, permissionReferences, resourceReferences, messages, policy digest and metadata digest against the verified Source87 manifest. Independently verify new embedded artifact binding. Static may update build metadata in the artifact. No runtime or browser, no need for dependency installation or full suite for this focused slice.

## 9. Migration, Compatibility, Rollout, and Rollback

Absent/null/malformed optional usage remains display-only unknown and preserves output. No schema, endpoint, configuration, permission or deployed action. Price production and actual money are independent.

## 10. Requirement-to-Step Traceability Matrix

| ID | Step | Gate |
| --- | --- | --- |
| REQ-001 | 1 | R1/G1/S1 |
| REQ-002 | 1 | R1/G1 |
| REQ-003 | 1 | R2/G1 |
| REQ-004 | 1 | G1/S1 |

## 11. Risks, Blockers, and User Decisions

Public results currently generally have null usage. Positive finite data proves compatible handling only. Existing shared browser JSON transport loses monetary lexemes. No exact fee, private ledger exposure, API or deployment is authorized by this slice.

## 12. Review and Acceptance

### 12.5 Blocking Manual Check

| Check ID | Applicability | Status | Evidence | Finding | Required action/exception |
| --- | --- | --- | --- | --- | --- |
| MC-ARCH-001 | Applicable | PASS | §4/7/8 | Existing Web API/detail | None |
| MC-REUSE-001 | Applicable | PASS | §4/7/8 | Existing result and authorization | None |
| MC-DEP-001 | Applicable | PASS | §4/7/8 | No dependency change | None |
| MC-NAME-001 | Applicable | PASS | §4/7/8 | Existing file ownership and typed projection | None |
| MC-VALID-001 | Applicable | PASS | §4/7/8 | Closed optional and affinity guard | None |
| MC-MODEL-001 | Applicable | PASS | §4/7/8 | Readonly TypeScript DTO | None |
| MC-CONVERT-001 | Not applicable | N/A | §4/7/8 | No Java mapping | None |
| MC-LOG-001 | Not applicable | N/A | §4/7/8 | No logging change | None |
| MC-BEAN-001 | Not applicable | N/A | §4/7/8 | No backend bean | None |
| MC-UTIL-001 | Applicable | PASS | §4/7/8 | Existing local primitives | None |
| MC-JSON-001 | Applicable | PASS | §4/7/8 | Closed decoded optional object | None |
| MC-TIME-001 | Not applicable | N/A | §4/7/8 | No changed time semantics | None |
| MC-CONFIG-001 | Not applicable | N/A | §4/7/8 | No profile change | None |
| MC-PATTERN-001 | Not applicable | N/A | §4/7/8 | Existing render/request composition | None |
| MC-SCOPE-001 | Applicable | PASS | §4/7/8 | Exact four Web paths and three docs | None |
| MC-TEST-001 | Applicable | PASS | §4/7/8 | Exact R1/R2/G1/S1 | None |
| MC-BLOCKER-001 | Applicable | PASS | §4/7/8 | Reviewed candidate scope and separate runtime | None |

**PASS — Ready for user review**
