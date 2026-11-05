# T4-01B1/T4-04 单实例迁移预检控制台实施计划

| Field | Value |
| --- | --- |
| Document | 2026-11-05-23-52-process-migration-preflight-console.md |
| Template Version | 5 |
| Status | Review |
| Created | 2026-11-05 23:52 Asia/Shanghai |
| Updated | 2026-11-05 23:52 Asia/Shanghai |
| Owner | Tianji Web |
| Repository | tianji-web |
| Scope | Current exact Process detail, two explicit read actions and one CALLS |
| Source Requirement | Master §19 T4-01/T4-04 single-instance preflight observation |
| Baseline Revision | Web bc926e477ddcd2fca20c00d33ba8346c0601d108; PS producer 410874c58d88b766e27706d80e639ebf2d734f4d |
| Implements Spec | [Migration preflight console](../spec/2026-11-05-23-51-process-migration-preflight-console.md) |
| Spec Status | Review |
| Spec Revision | 2026-11-05 23:51 Asia/Shanghai SHA-256 5951157528f5ea7cd8a89ca9765f3bc387bc62f17625410787ce4ea3ad7a46e5 |
| Effective Specs | [Web consumer](../spec/2026-11-05-23-51-process-migration-preflight-console.md), [PS B1 API](../../../../tianji-service/docs/egon/spec/2026-11-05-23-44-process-migration-preflight-api.md#9-interface-definitions) |
| Depends On Plans | [Process B1 producer](../../../../tianji-service/docs/egon/plan/2026-11-05-23-45-process-migration-preflight-api.md#7-ordered-file-by-file-implementation-steps) |
| Supersedes | None |
| Superseded By | None |
| Related Plans | None |

## 1. Summary

Add a local read-only preflight consumer to the existing Process timeline. Exact current detail and both existing page guards enable two explicit GET actions. One static CALLS, two true RED cases, exact finite and packaged permission evidence close one eight-path commit.

## 2. Target Spec and Effective Design

[Web Spec](../spec/2026-11-05-23-51-process-migration-preflight-console.md) §4/7/12/14 and exact PS B1 API §9 govern this scope. No producer changes, permission registration, browser/server use or migration execution.

## 3. Effective Requirements and Acceptance

| Requirement | Spec | Observable acceptance | Impact |
| --- | --- | --- | --- |
| REQ-001 | Web §4/7/12 | Existing PAGE and release page guard plus current selected detail | UI |
| REQ-002 | Web §4/7/12 | Two explicit authorized reads, exact pinned target and structural result | API/UI |
| REQ-003 | Web §4/7/10 | Closed response and existing epoch/selection/abort | API/UI |
| REQ-004 | Web §4/14/16 | Single CALLS and exact actual producer proof | PaC/package |

## 4. Implementation Strategy and Dependency Order

Use existing exact Process release reader and current detail lifecycle. R1 proves the lax API seam admits a different target; B strict API follows. R2 proves the current page lacks the explicit panel with proper prerequisites. B page and one existing producer reference follow. Complete actual finite and static build in one commit.

### 4.7 Java, Spring, and Egon-COLA Implementation Standards

| Concern | Current repository evidence | Effective Spec decision | Implementation obligation | Gate |
| --- | --- | --- | --- | --- |
| Web structure | Existing page/API/PaC | §7/12 | Local child and client, no provider change | G1 |
| Authorization and request | Shared requestJson and current PAGE checks | §5/7 | Same current tenant/auth and detail selection | R2/G1 |
| Time and shape | Existing UTC validator and PS contract | §6.3/10 | Exact source/target/instance and raw UTC | R1/G1 |
| Static permissions | Current generator and producer proof | §16 | One exact CALLS and preserve all others | P1 |

#### Capability reuse ledger

| Need | Candidates inspected | Exact evidence | Fit/gap | Decision | Added dependency/custom code | Owning Step/check |
| --- | --- | --- | --- | --- | --- | --- |
| Release SHA | Existing Process release API | processReleasesApi.get | Fits exact target | Reuse | None | Step 1 MC-REUSE-001 |
| Auth/tenant/cancel | requestJson and current ExecutionTimelinePage | Existing owner/epoch and selected detail | Fits | Reuse | Local pending state | Step 1 MC-VALID-001 |
| Wire projection | PS B1 OAS and existing strict TS identifiers | Closed preflight result | Fits through new adapter | Add exact decoder | No dependency | Step 1 MC-JSON-001 |

### 4.8 User-mandated Java Rule Implementation Matrix

Java implementation is not applicable to this Web-only scope. The existing Java/C producer and previous PS evidence are referenced as read contracts.

| Literal rule | Spec source | Repository evidence | Exact files and order | Pseudocode obligations | Validation gate | Steps | Status/blocker |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Rule 1 | §6.2 | Web only | No Java files | Existing PS unaffected | G1/P1 | Step 1 | N/A |
| Rule 2 | §6.2 | Web only | No Java files | Existing PS unaffected | G1/P1 | Step 1 | N/A |
| Rule 3 | §6.2 | Web only | No Java files | Existing PS unaffected | G1/P1 | Step 1 | N/A |
| Rule 4 | §6.2 | Web only | No Java files | Existing PS unaffected | G1/P1 | Step 1 | N/A |
| Rule 5 | §6.2 | Web only | No Java files | Existing PS unaffected | G1/P1 | Step 1 | N/A |
| Rule 6 | §6.2 | Web only | No Java files | Existing PS unaffected | G1/P1 | Step 1 | N/A |
| Rule 7 | §6.2 | Web only | No Java files | Existing PS unaffected | G1/P1 | Step 1 | N/A |
| Rule 9 | §6.2 | Web only | No Java files | Existing PS unaffected | G1/P1 | Step 1 | N/A |
| Rule 10 | §6.2 | Web only | No Java files | Existing PS unaffected | G1/P1 | Step 1 | N/A |
| Rule 11 | §6.2 | Web only | No Java files | Existing PS unaffected | G1/P1 | Step 1 | N/A |

### 4.9 Time semantics and conversion contract

Time contract: Required

| Time ID | Fields/symbols | Semantics | Java/runtime type | Storage policy | Wire policy | Business zone source | Display zone source | Boundary / DST rules | Precision / Clock | Compatibility | Verification |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| TIME-001 | observedAt | Occurred instant | TypeScript string | Not persisted | UTC Z | Explicit UTC instant | Raw UTC text | Calendar validation, no local conversion | Existing producer micros | Existing times unchanged | Step 1 G1 TEST-001/002 |

## 5. Change File Tree

| Operation | Exact path |
| --- | --- |
| Create | `src/api/processMigrationPreflight.test.ts` |
| Modify | `src/pages/ExecutionTimelinePage.test.tsx` |
| Create | `src/api/processMigrationPreflight.ts` |
| Modify | `src/pages/ExecutionTimelinePage.tsx` |
| Modify | `src/permissions/references.ts` |
| Create | `docs/egon/spec/2026-11-05-23-51-process-migration-preflight-console.md` |
| Create | `docs/egon/plan/2026-11-05-23-52-process-migration-preflight-console.md` |
| Create | `docs/egon/evidence/2026-11-05-process-migration-preflight-console.md` |

## 6. Prerequisites, Constraints, and Plan Clarifications

Exact clean Web bc926e477ddcd2fca20c00d33ba8346c0601d108. Verify exact PS producer PS producer 410874c58d88b766e27706d80e639ebf2d734f4d, raw PaC 2997f98b0a33d964465fecc143009131b24d249f502fc8c1a82437af1dda0edd and required exact resource before tracked copy. Use Node24, existing package dependencies, actual local PaC SDK/Jianshen contract pins. No install, application, network, browser, DB, migration or role registration. Existing UI permission and producer authorization are separate. The digest comes only from the explicitly returned release read, never a user-typed hash.

## 7. Ordered File-by-file Implementation Steps

### Step 1 — Read one pinned structural preflight from current Process detail

- Requirements: REQ-001, REQ-002, REQ-003, REQ-004.
- Dependencies: Exact committed PS B1 static provider proof, reviewed Web Spec/Plan and existing Process timeline/release readers.
- Baseline state: Existing authorized Process detail, no preflight panel or adapter.
- Observable outcome: Explicit two reads, current observed report and one exact CALLS.
- End state: Five source/test/reference paths and three governance paths, one focused commit.
- Test-first gate: Required. R1 lax typed API result accepted; R2 existing page lacks the explicit action.
- Manual Checks: MC-ARCH-001, MC-REUSE-001, MC-DEP-001, MC-NAME-001, MC-VALID-001, MC-MODEL-001, MC-UTIL-001, MC-JSON-001, MC-TIME-001, MC-PATTERN-001, MC-SCOPE-001, MC-TEST-001, MC-BLOCKER-001.
- Literal Rules: Rule 11 scope preservation; Java implementation and persistence are not applicable to the Web paths.
- Ordered files:

#### File 1 — `CREATE src/api/processMigrationPreflight.test.ts`

- Purpose: Prove closed affinity and exact wire before behavior.
- Symbols: rejects a preflight report for a different target release; uses only the exact encoded GET with both pinned parameters and current tenant; rejects mismatched sources, unexpected fields and invalid native evidence.
- Repository evidence: Existing strict Process API adapter tests and current transport stub.
- Dependencies and consumers: File 3 A then B, no server.
- Why now: R1 uses a lax typed adapter and actual positive fake response, then verifies strict behavior.
- Contract/signature changes: Typed A test first, complete three method test in B.
- Input/output and state mapping: Typed A test first, complete three method test in B.
- Error and edge behavior: Unexpected shape and mismatched current source/instance/target reject safely.
- Standards impact: MC-SCOPE-001 and R1 genuine resolving promise assertion, G1 three.
- Literal rule enforcement: Rule 11 preserves existing Web and external owning persistence boundaries.
- Implementation pseudocode:

```typescript
it('rejects a preflight report for a different target release', async () => {
  stub({...report, targetReleaseVersion: 'release-other'})
  await expect(processMigrationPreflightApi.get('20', target)).rejects.toThrow('服务返回的迁移预检证据无效')
})
// Also prove exact encoded URL, tenant, flags, shape and nullable activity rules.
```

- Verification contribution: R1 genuine resolving promise assertion, G1 three.
- After this file: R1 A fixture compiles against File 3 A.

#### File 2 — `MODIFY src/pages/ExecutionTimelinePage.test.tsx`

- Purpose: Prove exact detail and both PAGE gates plus two explicit reads.
- Symbols: offers an explicit migration preflight only after current Process detail and release permission; pins the displayed target digest before the explicit structure-only preflight; aborts and discards a late target release after the user changes the version; keeps preflight unavailable without the current release read permission.
- Repository evidence: Existing ExecutionTimelinePage scope and finite tests.
- Dependencies and consumers: File 3 B, old page for R2, File 4 B for G1.
- Why now: The original page must fail presence after current detail and both guards.
- Contract/signature changes: R2 phase replaces only page test from root red; B assertions cover UI and existing page behavior.
- Input/output and state mapping: R2 phase replaces only page test from root red; B assertions cover UI and existing page behavior.
- Error and edge behavior: Do not issue early or unauthorized read; drop abort and stale version.
- Standards impact: MC-SCOPE-001 and R2 actual null and G1 page.
- Literal rule enforcement: Rule 11 preserves existing Web and external owning persistence boundaries.
- Implementation pseudocode:

```tsx
it('offers an explicit migration preflight only after current Process detail and release permission', async () => {
  render(<ExecutionTimelinePage />)
  await openCurrentOwnedDetail()
  expect(screen.queryByLabelText('预检目标发布版本')).not.toBeNull()
  expect(processMigrationPreflightApi.get).not.toHaveBeenCalled()
})
// Test independent release digest read and explicit next action, edit abort and no release permission.
```

- Verification contribution: R2 actual null and G1 page.
- After this file: B page test ready after File 4.

#### File 3 — `CREATE src/api/processMigrationPreflight.ts`

- Purpose: Consume current B1 exact read and closed response.
- Symbols: ProcessMigrationPreflight, ProcessMigrationTarget, processMigrationPreflightApi.get.
- Repository evidence: requestJson, strict existing identifier and UTC validators, B1 exact producer.
- Dependencies and consumers: File 1 A then B and File 4.
- Why now: API A strict behavioral RED before B projection.
- Contract/signature changes: Readonly current pin; GET no-store exact path and two params; source version used only for response affinity.
- Input/output and state mapping: Readonly current pin; GET no-store exact path and two params; source version used only for response affinity.
- Error and edge behavior: Bad input, unexpected fields/status, wrong IDs or invalid UTC reject; use existing shared auth flow.
- Standards impact: MC-SCOPE-001 and R1 A deliberately lax, B G1 exact adapter.
- Literal rule enforcement: Rule 11 preserves existing Web and external owning persistence boundaries.
- Implementation pseudocode:

```typescript
async function get(tenant: string, target: ProcessMigrationTarget, signal?: AbortSignal) {
  assertExactInstanceVersionsAndLowercaseSha(target)
  const params = new URLSearchParams({targetReleaseVersion: target.targetReleaseVersion,
    expectedTargetManifestSha256: target.expectedTargetManifestSha256})
  const result = await requestJson<unknown>(encodedInstancePath(target.instanceId, params), tenant, {method: 'GET', cache: 'no-store', signal})
  return parsePreflight(result, target)
}
// Check exact six fields, same instance/source/target, status/activity relationship and original UTC.
```

- Verification contribution: R1 A deliberately lax, B G1 exact adapter.
- After this file: B API replaces A after R1.

#### File 4 — `MODIFY src/pages/ExecutionTimelinePage.tsx`

- Purpose: Display existing-current-detail preflight with two explicit authorized reads.
- Symbols: ExecutionTimelinePage, ProcessMigrationPreflightLookup, preflightLabels.
- Repository evidence: Existing current selection generation, processReleasesApi and Web page guards.
- Dependencies and consumers: Files 2/3 and existing Process detail.
- Why now: After R2 add only optional scoped child.
- Contract/signature changes: Both existing PAGE keys plus current snapshot. First button reads exact target digest and second issues preflight.
- Input/output and state mapping: Both existing PAGE keys plus current snapshot. First button reads exact target digest and second issues preflight.
- Error and edge behavior: Abort pending on edit or scope unmount, guard current callback, fixed safe errors, no execute controls.
- Standards impact: MC-SCOPE-001 and G1 35 page tests plus old release behavior.
- Literal rule enforcement: Rule 11 preserves existing Web and external owning persistence boundaries.
- Implementation pseudocode:

```tsx
{detail.phase === 'snapshot' && allows(RELEASE_PAGE) &&
  <ProcessMigrationPreflightLookup key={detail.selection} tenant={tenant} instance={detail.snapshot}
    isSelectionCurrent={() => sequence.current === detail.selection && currentAllows.current(PAGE)
      && currentAllows.current(RELEASE_PAGE)} />}
// First explicit click reads processReleasesApi.get; stores scoped pin only if current.
// Second explicit click sends processMigrationPreflightApi.get and renders structure only.
```

- Verification contribution: G1 35 page tests plus old release behavior.
- After this file: Complete final page and selected tests.

#### File 5 — `MODIFY src/permissions/references.ts`

- Purpose: Declare exactly one proven existing provider reference.
- Symbols: references and CALLS tianji.api.process.migration.preflight.
- Repository evidence: Existing Web PaC references and actual PS manifest.
- Dependencies and consumers: Committed PS raw artifact and File 3.
- Why now: Add reference only after exact provider proof.
- Contract/signature changes: Append one CALLS; keep all prior page/navigation/permission values.
- Input/output and state mapping: Append one CALLS; keep all prior page/navigation/permission values.
- Error and edge behavior: Wrong producer key/path/policy blocks final static proof.
- Standards impact: MC-SCOPE-001 and P1 actual one CALLS plus package digests.
- Literal rule enforcement: Rule 11 preserves existing Web and external owning persistence boundaries.
- Implementation pseudocode:

```typescript
const reference = {key: 'tianji.api.process.migration.preflight', usage: 'CALLS'} as const
// Add reference to the existing defineResourceReferences list.
// Keep existing resource, permissions, messages and page definitions unchanged.
```

- Verification contribution: P1 actual one CALLS plus package digests.
- After this file: Five source paths ready for finite/static gates.

#### File 6 — `CREATE docs/egon/spec/2026-11-05-23-51-process-migration-preflight-console.md`

- Purpose: Archive exact reviewed SPEC.
- Symbols: Canonical governance document.
- Repository evidence: Existing strict Web doc conventions.
- Dependencies and consumers: Reviewed scratch bytes and exact hash.
- Why now: Keep approved source contract with this commit.
- Contract/signature changes: Exact copy to canonical path.
- Input/output and state mapping: Exact copy to canonical path.
- Error and edge behavior: Occupied path or wrong SHA blocks staging.
- Standards impact: MC-SCOPE-001 and S1 strict validation and exact hash.
- Literal rule enforcement: Rule 11 preserves existing Web and external owning persistence boundaries.
- Implementation pseudocode:

```sh
test ! -e docs/egon/spec/2026-11-05-23-51-process-migration-preflight-console.md
printf '%s  %s\n' "$WEB_APPROVED_SPEC_SHA" "$WEB_APPROVED_SPEC" | shasum -a 256 -c -
cp -n "$WEB_APPROVED_SPEC" docs/egon/spec/2026-11-05-23-51-process-migration-preflight-console.md
cmp "$WEB_APPROVED_SPEC" docs/egon/spec/2026-11-05-23-51-process-migration-preflight-console.md
```

- Verification contribution: S1 strict validation and exact hash.
- After this file: Document ready for review.

#### File 7 — `CREATE docs/egon/plan/2026-11-05-23-52-process-migration-preflight-console.md`

- Purpose: Archive exact reviewed PLAN.
- Symbols: Canonical governance document.
- Repository evidence: Existing strict Web doc conventions.
- Dependencies and consumers: Reviewed scratch bytes and exact hash.
- Why now: Keep approved source contract with this commit.
- Contract/signature changes: Exact copy to canonical path.
- Input/output and state mapping: Exact copy to canonical path.
- Error and edge behavior: Occupied path or wrong SHA blocks staging.
- Standards impact: MC-SCOPE-001 and S1 strict validation and exact hash.
- Literal rule enforcement: Rule 11 preserves existing Web and external owning persistence boundaries.
- Implementation pseudocode:

```sh
test ! -e docs/egon/plan/2026-11-05-23-52-process-migration-preflight-console.md
printf '%s  %s\n' "$WEB_APPROVED_PLAN_SHA" "$WEB_APPROVED_PLAN" | shasum -a 256 -c -
cp -n "$WEB_APPROVED_PLAN" docs/egon/plan/2026-11-05-23-52-process-migration-preflight-console.md
cmp "$WEB_APPROVED_PLAN" docs/egon/plan/2026-11-05-23-52-process-migration-preflight-console.md
```

- Verification contribution: S1 strict validation and exact hash.
- After this file: Document ready for review.

#### File 8 — `CREATE docs/egon/evidence/2026-11-05-process-migration-preflight-console.md`

- Purpose: Record actual finite and static proof.
- Symbols: R1/R2/G1/P1/S1.
- Repository evidence: Current isolated and owning outputs.
- Dependencies and consumers: Actual owning tests and provider/static manifest.
- Why now: Write only after observing gates.
- Contract/signature changes: Record exact tests, static digests, current PS source/artifact and stage proof.
- Input/output and state mapping: Record exact tests, static digests, current PS source/artifact and stage proof.
- Error and edge behavior: Missing output cannot establish delivery.
- Standards impact: MC-SCOPE-001 and S1 objective source evidence.
- Literal rule enforcement: Rule 11 preserves existing Web and external owning persistence boundaries.
- Implementation pseudocode:

```text
Record actual R1/R2 failure assertions and 45-test G1, typecheck and lint.
Record the verified PS provider raw hash and one added Web CALLS with actual package/digest.
Verify exact eight paths and one commit, keep browser and runtime separate.
```

- Verification contribution: S1 objective source evidence.
- After this file: Ready for exact stage.

- Validation working directory: /Users/mario/SelfProject/Stellar-Enclosure/tianji-web.
- Verification command: R1/R2/G1/P1/S1 in §8.
- Expected result: Two exact RED assertions, 45 selected green, typecheck and lint, actual static one CALLS.
- Failure returns to: Files 1–3 for exact client and fixtures, File 4 for selection/epoch, File 5 for producer provenance.
- Completion criteria: Current source-only consumer and actual PaC proof, no runtime claim.
- Rollback: Revert a single commit.
- Commit paths: `src/api/processMigrationPreflight.test.ts`, `src/pages/ExecutionTimelinePage.test.tsx`, `src/api/processMigrationPreflight.ts`, `src/pages/ExecutionTimelinePage.tsx`, `src/permissions/references.ts`, `docs/egon/spec/2026-11-05-23-51-process-migration-preflight-console.md`, `docs/egon/plan/2026-11-05-23-52-process-migration-preflight-console.md`, `docs/egon/evidence/2026-11-05-process-migration-preflight-console.md`.
- Commit: feat(web): read owned Process migration preflight.

## 8. Test, Validation, and Quality Gates

| Gate | Exact phase and selector | Expected |
| --- | --- | --- |
| R1 | Root A API and A test, rejects a preflight report for a different target release | Promise resolves instead of rejecting, one actual assertion failure |
| R2 | Exact B API, old page, root red page test, offers an explicit migration preflight only after current Process detail and release permission | Null control assertion, one actual focused failure |
| G1 | Exact B, three owning classes | 45 tests in three files, zero errors/failures/skips, typecheck and lint |
| P1 | Actual static package and prior artifact lock | Exactly one new CALLS, existing resources/permissions/messages/metadata preserved |
| S1 | Exact scope and strict document closure | Eight selected paths and one commit |

```sh
preflight_web=/Users/mario/.codex/tmp/tianji-agent-upgrade-20261105/t4-01/migration-preflight-console/root
test "$(git rev-parse --verify HEAD)" = bc926e477ddcd2fca20c00d33ba8346c0601d108
npm test -- src/api/processMigrationPreflight.test.ts -t 'rejects a preflight report for a different target release$'
npm test -- src/pages/ExecutionTimelinePage.test.tsx -t 'offers an explicit migration preflight only after current Process detail and release permission$'
npm test -- src/api/processMigrationPreflight.test.ts src/pages/ExecutionTimelinePage.test.tsx src/api/processReleases.test.ts
npm run typecheck
npm run lint
printf '%s  %s\n' '6d060c3afbf79b288b49a04abe4128f65a5985e97fdf4250743887e9de35a0ce' "$preflight_web/pac-build.sh" | shasum -a 256 -c -
EXPECTED_PS_PAC_SHA256=2997f98b0a33d964465fecc143009131b24d249f502fc8c1a82437af1dda0edd bash "$preflight_web/pac-build.sh"
```

R1/R2 commands are run only on their exact phases. Package helper uses the prior Web producer, current committed PS raw manifest, independently pinned local PaC tooling and contract, and actual static build. Exact checked output is one CALLS `tianji.api.process.migration.preflight`, unchanged existing resources/permissions/messages and no activation. No listener or browser.

```sh
python3 ../.agents/skills/stellar-enclosure-coding-writing-spec/scripts/validate_spec.py --strict \
  docs/egon/spec/2026-11-05-23-51-process-migration-preflight-console.md
python3 ../.agents/skills/stellar-enclosure-coding-writing-plan/scripts/validate_plan.py --strict \
  docs/egon/plan/2026-11-05-23-52-process-migration-preflight-console.md
git diff --check
git add -- \
  src/api/processMigrationPreflight.test.ts \
  src/pages/ExecutionTimelinePage.test.tsx \
  src/api/processMigrationPreflight.ts \
  src/pages/ExecutionTimelinePage.tsx \
  src/permissions/references.ts \
  docs/egon/spec/2026-11-05-23-51-process-migration-preflight-console.md \
  docs/egon/plan/2026-11-05-23-52-process-migration-preflight-console.md \
  docs/egon/evidence/2026-11-05-process-migration-preflight-console.md
git diff --cached --check
git diff --cached --name-status
```

Exact eight paths, no generated files, old config/toolchain unchanged. One commit after finite/producer closure.

## 9. Migration, Compatibility, Rollout, and Rollback

No schema, new resource definition, nav or producer change. Existing timeline and release views preserved. One source commit reversible. Actual BFF, browser, IAM and runtime remain separate.

## 10. Requirement-to-Step Traceability Matrix

| Requirement | Step | Files | Gates |
| --- | --- | --- | --- |
| REQ-001 | Step 1 | 2/4 | R2/G1 |
| REQ-002 | Step 1 | 1–4 | R1/R2/G1 |
| REQ-003 | Step 1 | 1–4 | G1 |
| REQ-004 | Step 1 | 5–8 | P1/S1 |

## 11. Risks, Blockers, and User Decisions

Only actual committed PS artifact proves provider scope, required before Web source. Current status is one structural observation. Actual auth, browser and runtime are independent.

## 12. Review and Acceptance

### 12.5 Blocking Manual Check

| Check ID | Applicability | Status | Evidence | Finding | Required action/exception |
| --- | --- | --- | --- | --- | --- |
| MC-ARCH-001 | Applicable | PASS | §7/8/14 | Current Process page and exact owner consumer | None |
| MC-REUSE-001 | Applicable | PASS | §7/8/14 | Existing layout, requestJson, authority | None |
| MC-DEP-001 | Applicable | PASS | §7/8/14 | No dependency change | None |
| MC-NAME-001 | Applicable | PASS | §7/8/14 | Exact local API and page names | None |
| MC-VALID-001 | Applicable | PASS | §7/8/14 | Exact instance/source/target, pin, closed status and UTC | None |
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

### 12.6 Final verdict

PASS — Ready for user review
