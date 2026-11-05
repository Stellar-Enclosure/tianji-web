# T4-03 当前 Agent 恢复证据面板实现计划

| Field | Value |
| --- | --- |
| Document | 2026-11-05-23-19-owned-agent-recovery-console.md |
| Template Version | 5 |
| Status | Review |
| Created | 2026-11-05 23:19 Asia/Shanghai |
| Updated | 2026-11-05 23:19 Asia/Shanghai |
| Owner | Tianji Web |
| Repository | tianji-web |
| Scope | Five Web source/test/permission paths and three review/evidence paths |
| Source Requirement | 主计划 §19 T4-03 只读恢复处置和 T4-04 呈现 |
| Baseline Revision | Web a5e7c15407f53d36378248e2cdf47bc7bfb26a4b；AS producer d9bec9c34bdbaa337cb5bd8eb776e2383bac97c6 |
| Implements Spec | [Owned Agent recovery console](../spec/2026-11-05-23-18-owned-agent-recovery-console.md) |
| Spec Status | Review |
| Spec Revision | 2026-11-05 23:18 Asia/Shanghai SHA-256 cdd1071e7ddeb1ffa943ccfa4af6a75bf2293d9088c1a6f5d44d78c534332949 |
| Effective Specs | [Owned Agent recovery console](../spec/2026-11-05-23-18-owned-agent-recovery-console.md), [AS producer](../../../../tianji-service/docs/egon/spec/2026-11-05-23-14-agent-owner-recovery-disposition.md#9-interface-definitions) |
| Depends On Plans | None |
| Supersedes | None |
| Superseded By | None |
| Related Plans | None |

## 1. Summary

一个 Web Step 在现有已授权运行详情增加显式恢复证据卡。复用当前登录、BFF 和状态边界，仅在实际 AS 生产者源和制品锁定后实施。

## 2. Target Spec and Effective Design

### 2.1 Primary target

[Owned Agent recovery console](../spec/2026-11-05-23-18-owned-agent-recovery-console.md)，REQ-001–004 and UI-001。

### 2.2 Effective Spec set

Web Spec and existing AS API-001. AS own route, READ and runtime authority remain independently enforced.

### 2.3 Superseded or excluded content

No existing Spec superseded. No API grants, Web navigation, Service changes or automated recovery.

## 3. Effective Requirements and Acceptance

| Requirement | Implementation | Acceptance |
| --- | --- | --- |
| REQ-001 | Exact explicit GET only after owned run view | One manual action, matching existing scope |
| REQ-002 | Strict decoder | Reject wrong run, malformed shape and unsafe state |
| REQ-003 | Independent read-only evidence | Safe labels, tri-state, UTC and abort |
| REQ-004 | Producer evidence and static delta | Exactly one CALLS, no grant/runtime |

## 4. Implementation Strategy and Dependency Order

### 4.1 Ordered strategy

Freeze actual producer, clean Web baseline, reviewed docs. Stage R1 pass-through and R2 current page test independently. Materialize B after exact RED. Run finite/typecheck/lint, official build and scope gates.

### 4.2 Test-first strategy

| Gate | Exact source state | Outcome |
| --- | --- | --- |
| R1 | A adapter and A API test | Wrong run incorrectly resolves, expected one assertion |
| R2 | Baseline Agent detail plus RED UI test | Existing detail renders, expected explicit control absent |
| G1 | Five B paths | Existing targeted tests all pass |
| P1/S1 | B official static package and doc/scope checks | Exact one CALLS and eight staged paths |

### 4.3 Sequential and parallel boundaries

R1 and R2 only after actual producer lock and source approval. B depends on both independent negative gates. P1 uses the same source.

### 4.4 Commit boundaries

One Web commit after verified static output and review. No tracked changes to Service.

### 4.5 Spec Simplicity and Implementation-necessity Audit

Direct reused detail, one fixed backend query and one CALLS dependency. No independent screen, API or new transport.

### 4.6 Change-unit Dependency Matrix

| Change unit | Depends on | Result |
| --- | --- | --- |
| Typed transport | Current BFF and producer | Existing no-store scoped request |
| Owned evidence card | Exact GET and current view | Explicit rendering/abort |
| PaC reference | Verified AS artifacts | Exact reference resolution |
| Docs/evidence | All gates | Source scope auditable |

### 4.7 Java, Spring, and Egon-COLA Implementation Standards

No Java change. Use existing React/TypeScript/BFF capabilities.

| Concern | Current repository evidence | Effective Spec decision | Planned implementation consequence | Owning Steps/checks |
| --- | --- | --- | --- | --- |
| Architecture | Current Agent detail and auth provider | §7 direct owned detail extension | One scoped component and adapter | Step 1 MC-ARCH-001 |
| Reuse | Shared requestJson and UTC guard | §7/§9 | No dependency or custom auth | Step 1 MC-REUSE-001 |
| Model and time | Current strict consumer validators | §6.3/§10 | Closed value validation and exact UTC output | Step 1 MC-VALID-001/MC-TIME-001 |

#### Capability reuse ledger

| Need | Candidates inspected | Exact evidence | Fit/gap | Decision | Added dependency/custom code | Owning Step/check |
| --- | --- | --- | --- | --- | --- | --- |
| Transport | requestJson | Current BFF epoch/tenant auth | Fits | Reuse | One reader method | Step 1 MC-REUSE-001 |
| Time | isProcessCorrelationUtc | Existing strict validator | Fits | Reuse | None | Step 1 MC-TIME-001 |
| Authority | AuthContext, references.ts | Existing run guard and actual resource | One missing CALLS | Extend exact reference | No grant/dependency | Step 1 MC-SCOPE-001 |

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
| TIME-001 | RecoveryDisposition.observedAt | Occurred instant | TypeScript string | Not persisted | UTC Z | Not applicable: observed instant | Explicit UTC | Keep UTC without local conversion | Existing strict calendar and microsecond parser | Original interfaces unaffected | Step 1 G1 TEST-001/002 |

## 5. Change File Tree

| Action | Exact path | Responsibility | Order |
| --- | --- | --- | --- |
| CREATE | `src/api/agentRecovery.test.ts` | Lock API GET and strict same-run response. | Step 1 File 1 |
| MODIFY | `src/pages/AgentRunDetailPage.test.tsx` | Lock explicit scoped UI behavior. | Step 1 File 2 |
| CREATE | `src/api/agentRecovery.ts` | Use shared requestJson and close response shape. | Step 1 File 3 |
| MODIFY | `src/pages/AgentRunDetailPage.tsx` | Present independent read-only evidence for current run. | Step 1 File 4 |
| MODIFY | `src/permissions/references.ts` | Declare one existing protected producer call. | Step 1 File 5 |
| CREATE | `docs/egon/spec/2026-11-05-23-18-owned-agent-recovery-console.md` | Bind exact reviewed Web behavior and accepted producer. | Step 1 File 6 |
| CREATE | `docs/egon/plan/2026-11-05-23-19-owned-agent-recovery-console.md` | Bind exact test and package sequence. | Step 1 File 7 |
| CREATE | `docs/egon/evidence/2026-11-05-owned-agent-recovery-console.md` | Record actual RED/GREEN and package scope. | Step 1 File 8 |

## 6. Prerequisites, Constraints, and Plan Clarifications

### 6.1 Repository and worktree baseline

Web `a5e7c15407f53d36378248e2cdf47bc7bfb26a4b` clean. AS producer `d9bec9c34bdbaa337cb5bd8eb776e2383bac97c6`. AS Boot SHA-256 76016c1d5140cccc707e9e020b457cc5946e854fa2c0c32e5580d76567bae333, raw PaC SHA-256 a762fbe7316bdb46c01a98438056b3277228b7eb7b45b04bb4dca23720723a26, and OAS SHA-256 c03760cd3bb0b4bee3dba9c11b707e7a3d8de4406cedce6f89c76969e0e9eb0c. Verify the exact accepted archived resource before source. The retained actual manifest is `t4-03/recovery-disposition-api/root-agent-server-manifest.json`.

### 6.2 Build, test, and environment prerequisites

Node 24 and installed reviewed dependencies, official Vite/PaC toolchain. Build using current off-repo validation lock and actual contract jar as prior source. No installs, browser, runtime, new credentials or lock repin.

### 6.3 Immutable constraints and approved decisions

One existing read UI, exact same-run GET and CALLS only. Shared auth remains authoritative. Existing result, Tool history and controls unchanged.

### 6.4 Plan Clarifications

Scratch RED/A/B files owned by root under `t4-03/recovery-console/root`. The exact read API existing producer owns closure and semantics.

## 7. Ordered File-by-file Implementation Steps

### Step 1 — Add explicit owned run recovery evidence

- Requirements: REQ-001, REQ-002, REQ-003, REQ-004.
- Dependencies: Exact reviewed Spec/Plan, actual producer source+package, clean Web and Source GO.
- Baseline state: Current Agent detail and Tool event timeline, no recovery evidence consumer.
- Observable outcome: Current eligible detail exposes manual evidence panel, one exact read and safe bounded output.
- End state: Eight exact Web paths, one logical commit.
- Test-first gate: Required. R1 wrong-run pass-through, R2 current detail missing evidence action.
- Manual Checks: MC-ARCH-001, MC-REUSE-001, MC-DEP-001, MC-NAME-001, MC-VALID-001, MC-MODEL-001, MC-JSON-001, MC-TIME-001, MC-SCOPE-001, MC-TEST-001, MC-BLOCKER-001.
- Literal Rules: Rule 1, Rule 2, Rule 6, Rule 10, Rule 11.
- Ordered files:

#### File 1 — `CREATE src/api/agentRecovery.test.ts`

- Purpose: Lock API GET and strict same-run response.
- Symbols: rejects recovery evidence belonging to a different run; three final client fixture tests
- Repository evidence: Existing requestJson/fake fetch patterns and exact AS OAS.
- Dependencies and consumers: Stages A/B adapter and fixture.
- Why now: Stage A checks same-run mismatch against old pass-through to obtain R1.
- Contract/signature changes: No exposed contract change.
- Input/output and state mapping: Exact GET/tenant/no-store/abort, wrong run, strict UTC/enum/coverage/conflict.
- Error and edge behavior: Malformed rows and unsafe identifiers rejected before rendering; no raw fallback.
- Standards impact: MC-VALID-001, MC-TEST-001, MC-TIME-001.
- Literal rule enforcement: Rule 1, Rule 2, Rule 6, Rule 10, Rule 11.
- Implementation pseudocode:

```typescript
const fetcher = stub({...fixture, runId: 'run-2'})
await expect(agentRecoveryApi.get('20', 'run-1')).rejects.toThrow('服务返回的恢复证据无效')
expect(fetcher).toHaveBeenCalledTimes(1)
```

- Verification contribution: R1/G1.
- After this file: A exact assertion fails; B expected strict response gates.

#### File 2 — `MODIFY src/pages/AgentRunDetailPage.test.tsx`

- Purpose: Lock explicit scoped UI behavior.
- Symbols: offers an explicit owned recovery evidence read after the run loads; final display/failure/abort cases
- Repository evidence: Existing Agent page fixtures and root scratch RED.
- Dependencies and consumers: Current detail route and A/B API.
- Why now: Test-only R2 on baseline page before UI implementation.
- Contract/signature changes: No existing route authority change.
- Input/output and state mapping: Current successful run detail exposes a button without an automatic API call.
- Error and edge behavior: Errors preserve still-current run, identity changes abort late evidence.
- Standards impact: MC-SCOPE-001, MC-TEST-001.
- Literal rule enforcement: Rule 1, Rule 2, Rule 11.
- Implementation pseudocode:

```typescript
render(view())
expect(await screen.findByText('research')).toBeInTheDocument()
expect(screen.queryByRole('button', {name: '读取恢复证据'})).not.toBeNull()
expect(agentRecoveryApi.get).not.toHaveBeenCalled()
```

- Verification contribution: R2/G1.
- After this file: Baseline fails missing button, B tests evidence and isolation.

#### File 3 — `CREATE src/api/agentRecovery.ts`

- Purpose: Use shared requestJson and close response shape.
- Symbols: agentRecoveryApi.get, RecoveryDisposition, parseDisposition
- Repository evidence: Existing client.ts and current AS exact schema.
- Dependencies and consumers: Used by detail card only.
- Why now: A includes GET pass-through for R1, B adds complete decoder after RED.
- Contract/signature changes: get(tenant, runId, signal?) returns RecoveryDisposition.
- Input/output and state mapping: Exact ASCII run 1–64, encoded exact GET, closed response validation.
- Error and edge behavior: Reject unknown fields/reason/coverage, wrong ID, wrong flag and conflict combinations.
- Standards impact: MC-VALID-001, MC-JSON-001, MC-TIME-001.
- Literal rule enforcement: Rule 1, Rule 2, Rule 6, Rule 10, Rule 11.
- Implementation pseudocode:

```typescript
if (!validRunId(runId)) throw new Error('运行标识无效')
const url = '/api/tianji/v1/agent-runs/' + encodeURIComponent(runId) + '/recovery-disposition'
const raw = await requestJson<unknown>(url, tenant, {method: 'GET', cache: 'no-store', signal})
return parseDisposition(raw, runId)
```

- Verification contribution: R1/G1/P1.
- After this file: The adapter no longer passes through unvalidated evidence.

#### File 4 — `MODIFY src/pages/AgentRunDetailPage.tsx`

- Purpose: Present independent read-only evidence for current run.
- Symbols: AgentRunDetailContent, RecoveryEvidenceCard
- Repository evidence: Current keyed Agent detail and no-auto UI conventions.
- Dependencies and consumers: Uses exact API and current useAuth.
- Why now: Add only after R2.
- Contract/signature changes: No new route or mutation.
- Input/output and state mapping: Current loaded owner and page access → manual button; source, UTC, status, coverage and tri-state flags.
- Error and edge behavior: Abort on unmount/reload, no duplicate, ordinary safe local failure, shared auth untouched.
- Standards impact: MC-NAME-001, MC-MODEL-001, MC-VALID-001, MC-TIME-001.
- Literal rule enforcement: Rule 1, Rule 2, Rule 10, Rule 11.
- Implementation pseudocode:

```tsx
{allows('tianji.page.runDetail') && <RecoveryEvidenceCard key={reload} runId={runId} tenant={tenant} />}
const result = await agentRecoveryApi.get(tenant, runId, request.signal)
if (!request.signal.aborted) setEvidence(result)
// abort pending work on unmount and keep failure/evidence local to the card
```

- Verification contribution: R2/G1.
- After this file: Existing detail remains authority and separate state.

#### File 5 — `MODIFY src/permissions/references.ts`

- Purpose: Declare one existing protected producer call.
- Symbols: tianji.api.agent.recovery.disposition CALLS
- Repository evidence: AS producer PaC and existing Web references list.
- Dependencies and consumers: Current official static package.
- Why now: After exact producer source and bytes locked.
- Contract/signature changes: Exactly one new reference; no code/grant/PAGE or MENU.
- Input/output and state mapping: Same exact API identifier joins verified manifest.
- Error and edge behavior: Missing resource or different policy blocks package proof.
- Standards impact: MC-SCOPE-001, MC-VALID-001.
- Literal rule enforcement: Rule 2, Rule 11.
- Implementation pseudocode:

```typescript
{key: 'tianji.api.agent.events', usage: 'CALLS'},
{key: 'tianji.api.agent.recovery.disposition', usage: 'CALLS'},
{key: 'tianji.api.agent.cancel', usage: 'CALLS'},
```

- Verification contribution: P1.
- After this file: Only one new reference is staged.

#### File 6 — `CREATE docs/egon/spec/2026-11-05-23-18-owned-agent-recovery-console.md`

- Purpose: Bind exact reviewed Web behavior and accepted producer.
- Symbols: REQ-001–004, UI-001
- Repository evidence: Current Web and verified AS artifact.
- Dependencies and consumers: Inputs to canonical Plan.
- Why now: Lock reviewed source before staging.
- Contract/signature changes: Source-only Spec.
- Input/output and state mapping: Record exact producer commit and PaC/OAS archive digests.
- Error and edge behavior: Producer unavailable blocks repo execution.
- Standards impact: MC-SCOPE-001.
- Literal rule enforcement: Rule 11.
- Implementation pseudocode:

```sh
test ! -e docs/egon/spec/2026-11-05-23-18-owned-agent-recovery-console.md
cp -n "$RECOVERY_WEB_REVIEWED_SPEC" docs/egon/spec/2026-11-05-23-18-owned-agent-recovery-console.md
cmp "$RECOVERY_WEB_REVIEWED_SPEC" docs/egon/spec/2026-11-05-23-18-owned-agent-recovery-console.md
```

- Verification contribution: S1.
- After this file: Reviewed Spec copied byte-for-byte.

#### File 7 — `CREATE docs/egon/plan/2026-11-05-23-19-owned-agent-recovery-console.md`

- Purpose: Bind exact test and package sequence.
- Symbols: R1/R2/G1/P1/S1
- Repository evidence: Current reviewed file paths and scripts.
- Dependencies and consumers: Canonical one logical Step.
- Why now: Lock reviewed bytes before staging.
- Contract/signature changes: Source plan only.
- Input/output and state mapping: Exact source/file phases and gate selectors.
- Error and edge behavior: Avoid tests/runtime beyond approved scope.
- Standards impact: MC-SCOPE-001, MC-TEST-001.
- Literal rule enforcement: Rule 11.
- Implementation pseudocode:

```sh
test ! -e docs/egon/plan/2026-11-05-23-19-owned-agent-recovery-console.md
cp -n "$RECOVERY_WEB_REVIEWED_PLAN" docs/egon/plan/2026-11-05-23-19-owned-agent-recovery-console.md
cmp "$RECOVERY_WEB_REVIEWED_PLAN" docs/egon/plan/2026-11-05-23-19-owned-agent-recovery-console.md
```

- Verification contribution: S1.
- After this file: Reviewed Plan copied byte-for-byte.

#### File 8 — `CREATE docs/egon/evidence/2026-11-05-owned-agent-recovery-console.md`

- Purpose: Record actual RED/GREEN and package scope.
- Symbols: Evidence owner counts and runtime boundary
- Repository evidence: Current root scratch reports, official source artifact.
- Dependencies and consumers: Reviewers and master evidence.
- Why now: After actual repo package validation.
- Contract/signature changes: No new runtime claim.
- Input/output and state mapping: Exact Web and producer revisions, G1 actual counts and P1 CALLS diff.
- Error and edge behavior: Record unexecuted runtime/GUI and S11 separately.
- Standards impact: MC-SCOPE-001, MC-TEST-001.
- Literal rule enforcement: Rule 11.
- Implementation pseudocode:

```text
Record exact red assertion sites, focused green test counts and no skipped results.
Record package manifest delta and its exact actual AS producer entry and scope.
Record default-off producer and unverified BFF, IAM, browser and S11 separately.
```

- Verification contribution: S1.
- After this file: Evidence completes one isolated Web change.

- Validation working directory: `/Users/mario/SelfProject/Stellar-Enclosure/tianji-web`.
- Verification command: Run R1/R2/G1/P1/S1 in §8 on corresponding source bytes.
- Expected result: One exact assertion each RED, all owning tests and official static package PASS, one reference delta.
- Failure returns to: Decoder or fixture for R1, page/fixture for R2 and G1, actual producer/consumer relation for P1.
- Completion criteria: Actual AS producer proof, exact Web package change, scope and no runtime claims.
- Rollback: Revert this one focused Web commit if authorized.
- Commit paths: `src/api/agentRecovery.test.ts`, `src/pages/AgentRunDetailPage.test.tsx`, `src/api/agentRecovery.ts`, `src/pages/AgentRunDetailPage.tsx`, `src/permissions/references.ts`, `docs/egon/spec/2026-11-05-23-18-owned-agent-recovery-console.md`, `docs/egon/plan/2026-11-05-23-19-owned-agent-recovery-console.md`, `docs/egon/evidence/2026-11-05-owned-agent-recovery-console.md`.
- Commit: `feat(tianji-web): show owned Agent recovery evidence`.

## 8. Test, Validation, and Quality Gates

```sh
npm test -- src/api/agentRecovery.test.ts -t 'rejects recovery evidence belonging to a different run$'
npm test -- src/pages/AgentRunDetailPage.test.tsx -t 'offers an explicit owned recovery evidence read after the run loads$'
npm test -- src/api/agentRecovery.test.ts src/pages/AgentRunDetailPage.test.tsx src/api/agentEvents.test.ts
npm run typecheck
npm run lint
recovery_web_pac=/Users/mario/.codex/tmp/tianji-agent-upgrade-20261105/t4-04/owned-tool-timeline/root-proof.fg6w4G
PAC_SDK_DIR=/Users/mario/SelfProject/Stellar-Enclosure/web-sdk \
PAC_TOOLCHAIN_LOCK="$recovery_web_pac/validation-toolchain.lock.json" \
PAC_CONTRACT_ARTIFACT="$recovery_web_pac/verified-jianshen-contract.jar" npm run build
python3 ../.agents/skills/stellar-enclosure-coding-writing-spec/scripts/validate_spec.py docs/egon/spec/2026-11-05-23-18-owned-agent-recovery-console.md --strict
python3 ../.agents/skills/stellar-enclosure-coding-writing-plan/scripts/validate_plan.py docs/egon/plan/2026-11-05-23-19-owned-agent-recovery-console.md --strict
git diff --check
git diff --cached --check
git diff --cached --name-only
```

| Gate | Required proof | Boundary |
| --- | --- | --- |
| R1 | One exact wrong-run promise-resolution assertion | A pass-through only |
| R2 | One exact missing-button assertion with successful existing run detail | Baseline page |
| G1 | 31 focused tests on three files, typecheck/lint | Mocks only |
| P1 | Official static build, actual AS Boot PaC/OAS and Web manifest exact CALLS-only delta | No deployed access proof |
| S1 | Both strict docs and exact eight paths | No other ownership changes |

P1 verifies actual AS Boot resource `META-INF/permissions/manifest-v1.json` and `META-INF/tianji/openapi/agent-recovery-disposition-v1.json` with exact producer locked digests. The sole new CALLS resolves to current protected GET/HEAD, USER/SERVICE and existing TIANJI_AGENT_READ / tianji:agent:read. Compare the new `.generated/permissions/manifest-v1.json` against the preceding actual Web manifest, ignoring only artifact identity changes. Bind the official static consumer result to `dist/permission-build.json`. No new permission registrations or grant.

## 9. Migration, Compatibility, Rollout, and Rollback

No migration. Producer defaults remain closed. Existing BFF forwarding and IAM assignment need separate runtime verification.

## 10. Requirement-to-Step Traceability Matrix

| Requirement | Step and files | Gate |
| --- | --- | --- |
| REQ-001 | Step 1 Files 1–4 | R1/R2/G1 |
| REQ-002 | Step 1 Files 1/3 | R1/G1 |
| REQ-003 | Step 1 Files 2/4 | R2/G1 |
| REQ-004 | Step 1 Files 5–8 | P1/S1 |

## 11. Risks, Blockers, and User Decisions

| Risk | Status | Disposition |
| --- | --- | --- |
| Actual AS producer package lock | Verified static artifact | Verify retained commit/Boot/PaC/OAS before Web execution |
| Actual BFF/IAM and browser | Unverified | Separate approved environment proof |
| Recovery/resume/S11 | Separate | Existing source and runtime gates |

## 12. Review and Acceptance

### 12.1 Original requirement fidelity

Read-only current-run evidence in existing protected detail.

### 12.2 Spec consistency

No new grants, no recovery mutations, exact evidence semantics.

### 12.3 Repository executability

Existing npm/PaC gates, no new dependencies or runtime.

### 12.4 Test and release completeness

Both assertion gates, source tests and artifact evidence required. Runtime acceptance separate.

### 12.5 Blocking Manual Check

| Check ID | Applicability | Status | Evidence | Finding | Required action/exception |
| --- | --- | --- | --- | --- | --- |
| MC-ARCH-001 | Applicable | PASS | §7/8/14 | Current Agent page and exact owner consumer | None |
| MC-REUSE-001 | Applicable | PASS | §7/8/14 | Existing layout, requestJson, authority | None |
| MC-DEP-001 | Applicable | PASS | §7/8/14 | No dependency change | None |
| MC-NAME-001 | Applicable | PASS | §7/8/14 | Exact local API and page names | None |
| MC-VALID-001 | Applicable | PASS | §7/8/14 | Closed run, lifecycle and evidence flag relationships | None |
| MC-MODEL-001 | Applicable | PASS | §7/8/14 | Readonly TS mirror | None |
| MC-CONVERT-001 | Not applicable | N/A | §7/8/14 | No Java conversion | None |
| MC-LOG-001 | Not applicable | N/A | §7/8/14 | No log/secret | None |
| MC-BEAN-001 | Not applicable | N/A | §7/8/14 | No Java beans | None |
| MC-UTIL-001 | Applicable | PASS | §7/8/14 | Existing Agent ID and UTC | None |
| MC-JSON-001 | Applicable | PASS | §7/8/14 | Closed parsed recovery evidence | None |
| MC-TIME-001 | Applicable | PASS | §7/8/14 | Exact UTC micros | None |
| MC-CONFIG-001 | Not applicable | N/A | §7/8/14 | No config | None |
| MC-PATTERN-001 | Applicable | PASS | §7/8/14 | Existing scoped local query | None |
| MC-SCOPE-001 | Applicable | PASS | §7/8/14 | Five Web files and one CALLS only | None |
| MC-TEST-001 | Applicable | PASS | §7/8/14 | Exact finite and static gates | None |
| MC-BLOCKER-001 | Applicable | PASS | §7/8/14 | Design review and separate actual producer source lock | None |


### 12.6 Final verdict

PASS — Ready for user review

实际 AS 生产者和制品已锁定。无浏览器或运行验收。
