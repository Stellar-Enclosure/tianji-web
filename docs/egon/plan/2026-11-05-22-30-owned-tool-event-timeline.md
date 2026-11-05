# T4-04G 已记录 Tool 时间线实施计划

| Field | Value |
| --- | --- |
| Document | 2026-11-05-22-30-owned-tool-event-timeline.md |
| Template Version | 5 |
| Status | Review |
| Created | 2026-11-05 22:30 Asia/Shanghai |
| Updated | 2026-11-05 22:30 Asia/Shanghai |
| Owner | Tianji Web |
| Repository | tianji-web |
| Scope | 现有 Agent 运行详情的 Tool 行投影和测试，三份文档 |
| Source Requirement | Master §19 T4-04 既有 Agent/Tool 事实 |
| Baseline Revision | Web 12ca685a606a6c55c28c1ae48d4258290aed482b；Service authority 7072e5b9153d1cda4ee38be60eeb9651b102a885 |
| Implements Spec | [Owned Tool events](../spec/2026-11-05-22-29-owned-tool-event-timeline.md) |
| Spec Status | Review |
| Spec Revision | 2026-11-05 22:29 Asia/Shanghai, SHA-256 ed14d1dc82f447c21635837ecf0c9d83450b4bc8c7290a6bd0c3064b5177b95b |
| Effective Specs | [Owned Tool events](../spec/2026-11-05-22-29-owned-tool-event-timeline.md) |
| Depends On Plans | None |
| Supersedes | None |
| Superseded By | None |
| Related Plans | [Master](../../../../docs/plans/agent-framework-upgrade-plan.md) |

## 1. Summary

复用当前 owner SSE，在已有 Run Detail 时间线显示准确已记录 Tool 状态，隐藏原始治理值。两个 Web 文件和三份文档，单逻辑提交。

## 2. Target Spec and Effective Design

Spec §§7/9/10/12 固定真实 ToolEventVO 形态、现有 SSE/current scope 与独立结果。私有恢复、真实 S11 和部署独立。Source GO 需单独锁。

## 3. Effective Requirements and Acceptance

| ID | Acceptance |
| --- | --- |
| REQ-001 | Same already authorized stream and current owner |
| REQ-002 | Closed Tool projection from actual event shapes |
| REQ-003 | No raw Tool leak, malformed independent of existing result |
| REQ-004 | actual finite/static zero PaC and exact five paths |

## 4. Implementation Strategy and Dependency Order

R1 test-only on baseline generic raw rendering. B one page change plus finite suite. Existing static builder and declaration equality. No new authority or shared change.

### 4.7 Java, Spring, and Egon-COLA Implementation Standards

| Concern | Current repository evidence | Effective Spec decision |
| --- | --- | --- |
| Producer | Current AR ToolEventVO and AS SSE | Read existing payload only |
| UI | Current Run Detail visible event and SSE | Local typed privacy projection |
| Auth | Current owner scope | No new resource |

| Need | Candidates inspected | Exact evidence | Fit/gap | Decision |
| --- | --- | --- | --- | --- |
| Tool facts | Existing persisted events | Already authorized owner stream | raw JSON before change | safe structured |
| Recovery | Source74 private read | no public authorized endpoint | outside source | defer |
| UTC | Existing strict browser UTC helper | actual Agent timestamps micros | reuse | no new dependency |

### 4.8 User-mandated Java Rule Implementation Matrix

| Literal rule | Spec source | Repository evidence | Exact files and order | Pseudocode obligations | Validation gate | Steps | Status/blocker |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Rule 1 | §6.2 | Web only | Step 1 | No Java behavior | G1/P1 | 1 | N/A |
| Rule 2 | §6.2 | Web only | Step 1 | No Java behavior | G1/P1 | 1 | N/A |
| Rule 3 | §6.2 | Web only | Step 1 | No Java behavior | G1/P1 | 1 | N/A |
| Rule 4 | §6.2 | Web only | Step 1 | No Java behavior | G1/P1 | 1 | N/A |
| Rule 5 | §6.2 | Web only | Step 1 | No Java behavior | G1/P1 | 1 | N/A |
| Rule 6 | §6.2 | Web only | Step 1 | No Java behavior | G1/P1 | 1 | N/A |
| Rule 7 | §6.2 | Web only | Step 1 | No Java behavior | G1/P1 | 1 | N/A |
| Rule 9 | §6.2 | Web only | Step 1 | No Java behavior | G1/P1 | 1 | N/A |
| Rule 10 | §6.2 | Web only | Step 1 | No Java behavior | G1/P1 | 1 | N/A |
| Rule 11 | §6.2 | Web only | Step 1 | No Java behavior | G1/P1 | 1 | N/A |

### 4.9 Time semantics and conversion contract

Time contract: Required

| Time ID | Fields/symbols | Semantics | Java/runtime type | Storage policy | Wire policy | Business zone source | Display zone source | Boundary / DST rules | Precision / Clock | Compatibility | Verification |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| TIME-001 | Tool event occurredAt | Occurred instant | TS string | Not persisted | UTC Z | Existing owner AgentDB UTC | UTC time element | strict Gregorian, no offsets/zone conversion | microseconds, source clock | invalid timestamp fixed unverified, generic rows unchanged | Step 1 TEST-001 and TEST-002 |

## 5. Change File Tree

| Operation | Exact path | Purpose | Gate |
| --- | --- | --- | --- |
| MODIFY | `src/pages/AgentRunDetailPage.test.tsx` | Tool presentation finite test | R1/G1 |
| MODIFY | `src/pages/AgentRunDetailPage.tsx` | Tool row projection | G1 |
| CREATE | `docs/egon/spec/2026-11-05-22-29-owned-tool-event-timeline.md` | Canonical Spec | S1 |
| CREATE | `docs/egon/plan/2026-11-05-22-30-owned-tool-event-timeline.md` | Canonical Plan | S1 |
| CREATE | `docs/egon/evidence/2026-11-05-owned-tool-event-timeline.md` | Actual source evidence | S1 |

## 6. Prerequisites, Constraints, and Plan Clarifications

Lock clean Web exact 12ca685a606a6c55c28c1ae48d4258290aed482b and committed Service event authority 7072e5b9153d1cda4ee38be60eeb9651b102a885. An independent later PS producer commit must have no diff to AS/AR event authority. Use Node24 already installed deps and existing checked local artifact copies. Scratch at t4-04/owned-tool-timeline/{a,b}. No tracked change before Source GO, runtime/browser, PaC registration or deployment.

## 7. Ordered File-by-file Implementation Steps

### Step 1 — Render current owner's recorded Tool evidence

- Requirements: REQ-001, REQ-002, REQ-003, REQ-004.
- Dependencies: Exact source lock, approved Spec/Plan and Source GO.
- Baseline state: Existing tool events shown as generic payload.
- Observable outcome: Recorded Tool facts become a narrow fixed status/UTC view.
- End state: Two Web files and three docs, single commit.
- Test-first gate: Required. R1 valid TOOL_FINISHED UNKNOWN resolves current event stream but expected fixed label is absent.
- Manual Checks: MC-ARCH-001, MC-REUSE-001, MC-DEP-001, MC-NAME-001, MC-VALID-001, MC-MODEL-001, MC-JSON-001, MC-TIME-001, MC-SCOPE-001, MC-TEST-001, MC-BLOCKER-001.
- Literal Rules: Rule 1, Rule 2, Rule 6, Rule 10, Rule 11. Existing Java scope remains separate.
- Ordered files:

#### File 1 — `MODIFY src/pages/AgentRunDetailPage.test.tsx`

- Purpose: Tool presentation finite test.
- Symbols: Tool presentation finite test at the exact owning path.
- Repository evidence: Existing Run Detail mock SSE/current result.
- Dependencies and consumers: Existing Web owner and R1/G1 phase.
- Why now: Establish the owning R1/G1 behavior.
- Contract/signature changes: Local Web or document only.
- Input/output and state mapping: Exact local behavior below.
- Error and edge behavior: Keep existing owner/result, strict Tool fallback.
- Standards impact: MC-REUSE-001, MC-SCOPE-001, MC-TEST-001.
- Literal rule enforcement: Rule 11 preserves current Web and Agent owner boundaries.
- Implementation pseudocode:

```tsx
deliver a current owned TOOL_FINISHED UNKNOWN payload through existing stream callback;
assert fixed result label absent on baseline and present after B;
verify real emitted branch shapes, no raw field exposure, invalid fallback and unaffected result;
```

- Verification contribution: R1/G1.
- After this file: Owning source or proof is ready for R1/G1.

#### File 2 — `MODIFY src/pages/AgentRunDetailPage.tsx`

- Purpose: Tool row projection.
- Symbols: Tool row projection at the exact owning path.
- Repository evidence: Actual ToolEventVO and current generic page display.
- Dependencies and consumers: Existing Web owner and G1 phase.
- Why now: Establish the owning G1 behavior.
- Contract/signature changes: Local Web or document only.
- Input/output and state mapping: Exact local behavior below.
- Error and edge behavior: Keep existing owner/result, strict Tool fallback.
- Standards impact: MC-REUSE-001, MC-SCOPE-001, MC-TEST-001.
- Literal rule enforcement: Rule 11 preserves current Web and Agent owner boundaries.
- Implementation pseudocode:

```tsx
detect TOOL_ namespace and parse only existing exact Tool metadata;
valid known rows display bounded declared tool/version, fixed outcome/accounting and UTC sequence;
bad/unknown Tool shape never enters raw JSON; preserve non-Tool result logic;
```

- Verification contribution: G1.
- After this file: Owning source or proof is ready for G1.

#### File 3 — `CREATE docs/egon/spec/2026-11-05-22-29-owned-tool-event-timeline.md`

- Purpose: Canonical Spec.
- Symbols: Canonical Spec at the exact owning path.
- Repository evidence: Master and current owner stream.
- Dependencies and consumers: Existing Web owner and S1 phase.
- Why now: Establish the owning S1 behavior.
- Contract/signature changes: Local Web or document only.
- Input/output and state mapping: Exact local behavior below.
- Error and edge behavior: Keep existing owner/result, strict Tool fallback.
- Standards impact: MC-REUSE-001, MC-SCOPE-001, MC-TEST-001.
- Literal rule enforcement: Rule 11 preserves current Web and Agent owner boundaries.
- Implementation pseudocode:

```text
copy reviewed Spec at exact canonical path and verify digest;
check actual source scope, same owner and current result preservation;
run strict Spec validation with no new API or authority;
```

- Verification contribution: S1.
- After this file: Owning source or proof is ready for S1.

#### File 4 — `CREATE docs/egon/plan/2026-11-05-22-30-owned-tool-event-timeline.md`

- Purpose: Canonical Plan.
- Symbols: Canonical Plan at the exact owning path.
- Repository evidence: Existing prior Web verification style.
- Dependencies and consumers: Existing Web owner and S1 phase.
- Why now: Establish the owning S1 behavior.
- Contract/signature changes: Local Web or document only.
- Input/output and state mapping: Exact local behavior below.
- Error and edge behavior: Keep existing owner/result, strict Tool fallback.
- Standards impact: MC-REUSE-001, MC-SCOPE-001, MC-TEST-001.
- Literal rule enforcement: Rule 11 preserves current Web and Agent owner boundaries.
- Implementation pseudocode:

```text
copy exact reviewed Plan and validate its Spec hash;
lock one true RED, focused finite, type/lint and official static evidence;
verify exactly five paths and one logical commit;
```

- Verification contribution: S1.
- After this file: Owning source or proof is ready for S1.

#### File 5 — `CREATE docs/egon/evidence/2026-11-05-owned-tool-event-timeline.md`

- Purpose: Actual source evidence.
- Symbols: Actual source evidence at the exact owning path.
- Repository evidence: Current Web finite and static proof.
- Dependencies and consumers: Existing Web owner and S1 phase.
- Why now: Establish the owning S1 behavior.
- Contract/signature changes: Local Web or document only.
- Input/output and state mapping: Exact local behavior below.
- Error and edge behavior: Keep existing owner/result, strict Tool fallback.
- Standards impact: MC-REUSE-001, MC-SCOPE-001, MC-TEST-001.
- Literal rule enforcement: Rule 11 preserves current Web and Agent owner boundaries.
- Implementation pseudocode:

```text
record actual red and green counts, exact Web/Service authority, typecheck/lint;
record current actual static artifact and zero PaC declaration changes;
record one commit and separate browser/BFF/S11 runtime limits;
```

- Verification contribution: S1.
- After this file: Owning source or proof is ready for S1.


- Validation working directory: /Users/mario/SelfProject/Stellar-Enclosure/tianji-web.
- Verification command: §8 R1/G1/P1/S1.
- Expected result: one intended assertion and actual targeted, type/lint and static package proof.
- Failure returns to: exact Web scope; no Service/grant changes.
- Completion criteria: actual tests and zero declarative PaC, exact five staged paths.
- Rollback: Before commit withdraw only owned files. After commit separate focused revert approval.
- Commit paths: `src/pages/AgentRunDetailPage.test.tsx`, `src/pages/AgentRunDetailPage.tsx`, `docs/egon/spec/2026-11-05-22-29-owned-tool-event-timeline.md`, `docs/egon/plan/2026-11-05-22-30-owned-tool-event-timeline.md`, `docs/egon/evidence/2026-11-05-owned-tool-event-timeline.md`
- Commit: feat(tianji-web): render owned Tool event states.

## 8. Test, Validation, and Quality Gates

```sh
npm test -- src/pages/AgentRunDetailPage.test.tsx -t 'shows persisted Tool event state without raw governance identifiers$'
npm test -- src/pages/AgentRunDetailPage.test.tsx src/api/agentEvents.test.ts
npm run typecheck
npm run lint

tool_web_pac=/Users/mario/.codex/tmp/tianji-agent-upgrade-20261105/t4-04/agent-correlation-web/root-proof.KjBe1y
PAC_SDK_DIR=/Users/mario/SelfProject/Stellar-Enclosure/web-sdk \
PAC_TOOLCHAIN_LOCK="$tool_web_pac/validation-toolchain.lock.json" \
PAC_CONTRACT_ARTIFACT="$tool_web_pac/verified-jianshen-contract.jar" npm run build
python3 ../.agents/skills/stellar-enclosure-coding-writing-spec/scripts/validate_spec.py \
  docs/egon/spec/2026-11-05-22-29-owned-tool-event-timeline.md --strict
python3 ../.agents/skills/stellar-enclosure-coding-writing-plan/scripts/validate_plan.py \
  docs/egon/plan/2026-11-05-22-30-owned-tool-event-timeline.md --strict
git diff --check
git diff --cached --check
git diff --cached --name-only
```

R1 run only A test on unchanged page, one exact assertion failure. G1 run B full owning page plus existing SSE, fresh reports and no failures. The isolated candidate ran 23 tests and tsc/lint, which does not replace real source gate. P1 actual official static build with prior verified toolchain. Compare declarations, references, application, producer, policy and metadata against exact previous final-manifest.json using existing SDK checks. Verify new embedded artifact. No permissions/refs delta, and existing tianji.api.agent.events unchanged. No new script, no app/browser.

## 9. Migration, Compatibility, Rollout, and Rollback

No API/config/data/permission change. Existing generic events and terminal result preserved. Only Tool presentation and unknown fallback change. Runtime browser/BFF and external effects remain independent.

## 10. Requirement-to-Step Traceability Matrix

| ID | Step | Gate |
| --- | --- | --- |
| REQ-001 | 1 | G1/P1 |
| REQ-002 | 1 | R1/G1 |
| REQ-003 | 1 | G1 |
| REQ-004 | 1 | G1/P1/S1 |

## 11. Risks, Blockers, and User Decisions

This timeline shows recorded recent events and never supplies recovery permission or complete Tool history. Runtime SSE proxy/owner testing and S11 remain independent.

## 12. Review and Acceptance

### 12.5 Blocking Manual Check

| Check ID | Applicability | Status | Evidence | Finding | Required action/exception |
| --- | --- | --- | --- | --- | --- |
| MC-ARCH-001 | Applicable | PASS | §7/8/14 | Current Web page and owner stream | None |
| MC-REUSE-001 | Applicable | PASS | §7/8/14 | Existing SSE and safe UI | None |
| MC-DEP-001 | Applicable | PASS | §7/8/14 | No dependency | None |
| MC-NAME-001 | Applicable | PASS | §7/8/14 | Local Tool projection | None |
| MC-VALID-001 | Applicable | PASS | §7/8/14 | Closed current ToolEventVO shape | None |
| MC-MODEL-001 | Applicable | PASS | §7/8/14 | Readonly safe Tool view | None |
| MC-CONVERT-001 | Not applicable | N/A | §7/8/14 | No Java conversion | None |
| MC-LOG-001 | Not applicable | N/A | §7/8/14 | No logging | None |
| MC-BEAN-001 | Not applicable | N/A | §7/8/14 | No backend bean | None |
| MC-UTIL-001 | Applicable | PASS | §7/8/14 | Existing UTC validator and safe TypeScript | None |
| MC-JSON-001 | Applicable | PASS | §7/8/14 | Closed decoded Tool and fixed fallback | None |
| MC-TIME-001 | Applicable | PASS | §7/8/14 | Exact UTC micros | None |
| MC-CONFIG-001 | Not applicable | N/A | §7/8/14 | No config | None |
| MC-PATTERN-001 | Applicable | PASS | §7/8/14 | Direct existing view composition | None |
| MC-SCOPE-001 | Applicable | PASS | §7/8/14 | Exact two Web files plus docs | None |
| MC-TEST-001 | Applicable | PASS | §7/8/14 | Exact finite and static gates | None |
| MC-BLOCKER-001 | Applicable | PASS | §7/8/14 | Existing authority and separate runtime | None |

**PASS — Ready for user review**
