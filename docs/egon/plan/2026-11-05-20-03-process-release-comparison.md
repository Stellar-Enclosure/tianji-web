# T4-04C 流程版本元数据对比实施计划

| Field | Value |
| --- | --- |
| Document | 2026-11-05-20-03-process-release-comparison.md |
| Template Version | 5 |
| Status | Review |
| Created | 2026-11-05 20:03 Asia/Shanghai |
| Updated | 2026-11-05 20:03 Asia/Shanghai |
| Owner | Tianji Web operations owner |
| Repository | tianji-web |
| Scope | Two Web page source/test files and three exact archive documents, one Step |
| Source Requirement | [Master §19 T4-04](../../../../docs/plans/agent-framework-upgrade-plan.md) version differences |
| Baseline Revision | tianji-web 6e58cdf3b4c283f348f262523e01f2424e054aa5 |
| Implements Spec | [Process release comparison](../spec/2026-11-05-20-02-process-release-comparison.md) |
| Spec Status | Review |
| Spec Revision | 2026-11-05 20:02 Asia/Shanghai SHA-256 9dd734f0f342f199baf56a1cb8dbfcc160f798374cb0e13919b5f6ff92ce5351 |
| Effective Specs | [Comparison](../spec/2026-11-05-20-02-process-release-comparison.md), [T4-04B](../spec/2026-11-05-19-29-process-release-metadata.md#9-interface-definitions) |
| Depends On Plans | [Existing metadata](2026-11-05-19-35-process-release-metadata.md#7-ordered-file-by-file-implementation-steps) |
| Supersedes | None |
| Superseded By | None |
| Related Plans | None |

## 1. Summary

现有 Web 页面增加可选对比版本。沿用同一授权、BFF 和精确 GET，两个结果同一观察并做本地差异。一个 focused Step 完成 source、finite 与静态权限对照。

## 2. Target Spec and Effective Design

### 2.1 Primary target

[Comparison](../spec/2026-11-05-20-02-process-release-comparison.md) Review and pinned SHA above. Source-only, current page and GET. Freeze exact approved pair and baseline before repo execution.

### 2.2 Effective Spec set

| Role | Spec/link | Status/revision | Effective sections | Why included |
| --- | --- | --- | --- | --- |
| Primary | [Comparison](../spec/2026-11-05-20-02-process-release-comparison.md) | Review / header | All | exact new UI |
| Dependency | [Metadata](../spec/2026-11-05-19-29-process-release-metadata.md#9-interface-definitions) | committed 6e58cdf | §9/10/12 | existing read/authority/default |

### 2.3 Superseded or excluded content

None. Existing one-version default, role, App, route, BFF, decoder and backend unchanged.

## 3. Effective Requirements and Acceptance

| Requirement | Source Spec section | Effective statement | Observable acceptance | Implementation impact |
| --- | --- | --- | --- | --- |
| REQ-001 | §12 and prior metadata | Exact optional version, old default | Blank one GET; invalid no read | Form |
| REQ-002 | §7.3/§12 | Deterministic exact differences | Both manifests, ordered add/remove/change | Local UI |
| REQ-003 | §7/§12 | One pair observation | Shared abort, no partial | Page state |
| REQ-004 | §12 | Current auth only | Edit/identity/epoch/permission clear | Existing guard |
| REQ-005 | §8/§14/§16 | Read-only and scoped tests | Two source paths, zero PaC delta | Evidence |

## 4. Implementation Strategy and Dependency Order

### 4.1 Ordered strategy

Presence test → optional field-only A seam → exact two-request RED → local B behavior and finite tests → static PaC and docs. Keep source files under current page only.

### 4.2 Test-first strategy

| Gate | Before behavior | Expected failure | GREEN |
| --- | --- | --- | --- |
| R1 | File 1 optional field test on base | Label not found | File 2 A |
| R2 | File 2 A has field only; File 1 A typed query test | Expected two calls, actual one | File 2 B |
| G1 | Both B files | Every failed/missing/skipped expected case blocks | 16 owning and 56 focused |

### 4.3 Sequential and parallel boundaries

| Step | Depends on | May run in parallel with | Must not overlap with | Reason |
| --- | --- | --- | --- | --- |
| Step 1 | Approved scope and clean source | Read-only checks | Same page, docs or test proof path writes | Current baseline and scope |

### 4.4 Commit boundaries

One Web commit, exact two source and three docs paths.

### 4.5 Spec Simplicity and Implementation-necessity Audit

| Spec element | Spec necessity verdict/section | Current repository evidence | Direct/reuse alternative | Interaction/implementation cost | Plan decision |
| --- | --- | --- | --- | --- | --- |
| Compare input/UI | §7 Add | Existing page exact form | Manual two single lookups | Optional bounded read | Keep |
| Existing GET/auth/epoch | §7 Keep | processReleasesApi and useAuth | New backend or route | None | Reuse |
| Static PaC | §14 Keep | Prior build | New permission not needed | Artifact recheck only | Reuse |

### 4.6 Change-unit Dependency Matrix

| Change unit | Requirements | Proof/RED point | Compile/runtime prerequisites | Produces | Consumers/unblocks | Owning Step |
| --- | --- | --- | --- | --- | --- | --- |
| Page test | REQ-001–005 | R1/R2 | Existing jsdom/Auth mock | Exact proof | Page | Step 1 |
| Page behavior | REQ-001–005 | G1 | Existing API | Local pair view | User | Step 1 |
| Archive | REQ-005 | S1 | Actual tests/PaC | Review proof | Owner | Step 1 |

### 4.7 Java, Spring, and Egon-COLA Implementation Standards

| Concern | Current repository evidence | Effective Spec decision | Planned implementation consequence | Owning Steps/checks |
| --- | --- | --- | --- | --- |
| Architecture | Current Web React TS page | §7/§8 | Same page and client | Step 1 MC-ARCH-001 |
| Reuse | Existing auth/API/AntD | §6/§12 | No dependency | Step 1 MC-REUSE-001 |
| Validation | Existing strict decoder | §9/§12 | Exact optional input and pair abort | Step 1 MC-VALID-001 |

#### Capability reuse ledger

| Need | Candidates inspected | Exact evidence | Fit/gap | Decision | Added dependency/custom code | Owning Step/check |
| --- | --- | --- | --- | --- | --- | --- |
| Exact release metadata | processReleasesApi.get | Current strict API | Existing sufficient | Reuse | None | Step 1 MC-REUSE-001 |
| UI and identity | AntD/useAuth/current epoch | Current page | One optional field | Reuse | Page only | Step 1 MC-ARCH-001 |
| PaC | Existing build and Step85 artifact | Verified copied toolchain | Current declarations | Reuse | None | Step 1 MC-DEP-001 |

### 4.8 User-mandated Java Rule Implementation Matrix

| Literal rule | Spec source | Repository evidence | Exact files and order | Pseudocode obligations | Validation gate | Steps | Status/blocker |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Rule 1 | §6.2 | TS only | 1/2 | Existing semantic names | G1 | Step 1 | N/A |
| Rule 2 | §6.2 | Existing API | 1/2 | Exact form | G1 | Step 1 | N/A |
| Rule 3 | §6.2 | Immutable DTO | 2 | Local values only | G1 | Step 1 | N/A |
| Rule 4 | §6.2 | No Java | 1/2 | No bean/log | S1 | Step 1 | N/A |
| Rule 5 | §6.2 | Existing TS | 1/2 | Reuse libs | S1 | Step 1 | N/A |
| Rule 6 | §6.2 | Exact GET | 2 | No wire change | G1 | Step 1 | N/A |
| Rule 7 | §6.2 | No config | All | Keep existing config | S1 | Step 1 | N/A |
| Rule 9 | §6.2 | Simple UI | 2 | Direct reuse | G1 | Step 1 | N/A |
| Rule 10 | §6.3 | Existing UTC | 2 | No time change | G1 | Step 1 | N/A |
| Rule 11 | §8 | Existing Web | All | Same layer and authority | S1 | Step 1 | PASS |

### 4.9 Time semantics and conversion contract

Time contract: Not applicable

Reason: Compare excludes createdAt and keeps the existing single version UTC rendering intact.

## 5. Change File Tree

| Operation | Path | Current evidence/symbol | Final symbols/state | Responsibility | Step | Requirements | Validation owner |
| --- | --- | --- | --- | --- | --- | --- | --- |
| MODIFY | src/pages/DefinitionReleasePage.test.tsx | Existing jsdom and mocked current auth/api | R1 optional field, R2 exact pair, existing seven tests and new bounded compare cases | Lock optional field, exact paired API and final behavior | Step 1 | REQ-001–005 | R1/R2/G1 |
| MODIFY | src/pages/DefinitionReleasePage.tsx | Current page and API decoder; no App/API edits | LookupForm comparisonVersion, compareModels, local comparison state and Card | Add optional local comparison and preserve old one-version flow | Step 1 | REQ-001–005 | R2/G1/S1 |
| CREATE | docs/egon/evidence/2026-11-05-process-release-comparison.md | Current Step85 evidence format | R1/R2/G1/S1, exact source files and build identity | Record actual source-only proof | Step 1 | REQ-001–005 | S1 |
| CREATE | docs/egon/spec/2026-11-05-20-02-process-release-comparison.md | Existing Web docs owner | New Spec and reciprocal Plan link | Archive approved exact Spec | Step 1 | REQ-001–005 | S1 strict Spec |
| CREATE | docs/egon/plan/2026-11-05-20-03-process-release-comparison.md | Existing Web docs owner | Current Step and Implements Spec | Archive approved exact Plan | Step 1 | REQ-001–005 | S1 strict Plan |

## 6. Prerequisites, Constraints, and Plan Clarifications

### 6.1 Repository and worktree baseline

tianji-web 6e58cdf3b4c283f348f262523e01f2424e054aa5 clean at review. Preserve unrelated changes, stage exact files. Use prior verified Step85 local toolchain copies, no install.

### 6.2 Build, test, and environment prerequisites

| Concern | Exact command/source | Required state | Validation boundary |
| --- | --- | --- | --- |
| Tests | §8 existing npm and Vitest | Node 24.14.1, local jsdom | No browser or server |
| Type/lint | npm run typecheck, npm run lint | Current cached dependencies | Static |
| PaC | npm run build, prior Step85 toolchain and official Web SDK | Exact copied lock/contract JAR | Local artifact and static declarations |

### 6.3 Immutable constraints and approved decisions

No App/API/Auth/permissions/config/toolchain/backend changes. Compare only two explicit known published versions. Existing live deployments independently validated.

### 6.4 Plan Clarifications

| ID | Small implementation inference | Repository evidence | Why semantics are unchanged | Impact if wrong |
| --- | --- | --- | --- | --- |
| PLAN-CLAR-001 | Same signal for both GETs | Existing requestJson/AbortController | Page remains only read owner | G1 fails |
| PLAN-CLAR-002 | Compare static declarations, not manifestDigest containing artifact metadata | Step85 build evidence and official canonicalizer | Build/commit/source bytes change, authority does not | S1 fails |

## 7. Ordered File-by-file Implementation Steps

### Step 1 — 交付当前页面两版本比较

- Requirements: REQ-001, REQ-002, REQ-003, REQ-004, REQ-005.
- Dependencies: Current Web owner, exact approved pair.
- Baseline state: Single version available, no comparison field or pair.
- Observable outcome: Both exact manifests and reproducible added/removed/changed rows in same authorized frame.
- End state: Two source/test paths and three archive docs, one commit.
- Test-first gate: Required. R1 missing field, R2 shape-only old one read, G1 final.
- Manual Checks: MC-ARCH-001, MC-REUSE-001, MC-DEP-001, MC-VALID-001, MC-JSON-001, MC-PATTERN-001, MC-SCOPE-001, MC-TEST-001, MC-BLOCKER-001.
- Literal Rules: Rule 11, no Java sources.
- Ordered files:

#### File 1 — `MODIFY src/pages/DefinitionReleasePage.test.tsx`

- Purpose: Lock optional field, exact paired API and final behavior.
- Symbols: R1 optional field, R2 exact pair, existing seven tests and new bounded compare cases.
- Repository evidence: Existing jsdom and mocked current auth/api.
- Dependencies and consumers: File 2 and immutable fixture values.
- Why now: R1 before page changes; R2 after optional field-only seam; full expectations in B.
- Contract/signature changes: Same owner test; no new test helper path.
- Input/output and state mapping: Mock two exact reads with shared AbortSignal; compare raw manifests, model rows, failures and epoch.
- Error and edge behavior: No partial, no stale render, exact localized errors; preserve old blank lookup.
- Standards impact: MC-VALID-001/MC-TEST-001.
- Literal rule enforcement: Rule 11.
- Implementation pseudocode:

```tsx
it('offers an optional comparison version without loading either release', () => {
  render(<DefinitionReleasePage />)
  expect(screen.getByLabelText('对比版本（可选）')).toHaveValue('')
  expect(processReleasesApi.get).not.toHaveBeenCalled()
})
it('requests two exact published releases with one comparison signal', async () => {
  submitTwoExactVersions()
  await waitFor(() => expect(processReleasesApi.get).toHaveBeenCalledTimes(2))
  assertSameSignalAndCurrentTenant()
})
// B: assert exact diff, both manifests, invalid forms, aborted sibling, edit and epoch.
```

- Verification contribution: R1/R2/G1.
- After this file: R1 one absent-label assertion; after File 2 A, R2 one-call assertion; B total 16 owning.

#### File 2 — `MODIFY src/pages/DefinitionReleasePage.tsx`

- Purpose: Add optional local comparison and preserve old one-version flow.
- Symbols: LookupForm comparisonVersion, compareModels, local comparison state and Card.
- Repository evidence: Current page and API decoder; no App/API edits.
- Dependencies and consumers: File 1, processReleasesApi, current useAuth and AntD.
- Why now: A exposes optional empty field and keeps old loader; B connects exact behavior.
- Contract/signature changes: No new public API; same route and body decoder.
- Input/output and state mapping: Optional distinct exact version; shared abort and sequence; result only after both reads; sorted composite model differences.
- Error and edge behavior: Invalid no request, stale drops, either failure aborts sibling, fixed localized errors, auth clear. Blank old behavior and UTC preserved.
- Standards impact: MC-REUSE-001/MC-VALID-001/MC-PATTERN-001/MC-SCOPE-001.
- Literal rule enforcement: Rule 11.
- Implementation pseudocode:

```tsx
if (validCurrentForm && currentAllows(PAGE)) {
  const shared = new AbortController()
  const baseline = processReleasesApi.get(tenant, releaseVersion, shared.signal)
  if (comparisonVersion !== '') {
    const [from, to] = await Promise.all([
      baseline, processReleasesApi.get(tenant, comparisonVersion, shared.signal),
    ])
    if (current()) renderPair(from, to)
  } else {
    const snapshot = await baseline
    if (current()) renderSingle(snapshot)
  }
}
// On pair failure before render, abort sibling and apply current fixed errors.
// Group model entries by ASCII type + ':' + definitionKey and compare raw hash and own input map.

```

- Verification contribution: R2/G1/S1.
- After this file: A produces old one-read RED; B complete same local page.

#### File 3 — `CREATE docs/egon/evidence/2026-11-05-process-release-comparison.md`

- Purpose: Record actual source-only proof.
- Symbols: R1/R2/G1/S1, exact source files and build identity.
- Repository evidence: Current Step85 evidence format.
- Dependencies and consumers: Actual Vitest/lint/typecheck and official PaC output.
- Why now: After observed gates.
- Contract/signature changes: Docs only.
- Input/output and state mapping: Record exact tests, raw hashes, zero declaration delta and live boundary.
- Error and edge behavior: Do not claim browser, deployed IAM, server or DB.
- Standards impact: MC-SCOPE-001/MC-TEST-001/MC-BLOCKER-001.
- Literal rule enforcement: Rule 11.
- Implementation pseudocode:

```text
check actual owning Vitest output against each exact expected RED/GREEN gate
record two source paths, pinned source and exact Spec/Plan SHA
record static permission declaration equality and independent live/browser state
```

- Verification contribution: S1.
- After this file: Actual evidence ready.

#### File 4 — `CREATE docs/egon/spec/2026-11-05-20-02-process-release-comparison.md`

- Purpose: Archive approved exact Spec.
- Symbols: New Spec and reciprocal Plan link.
- Repository evidence: Existing Web docs owner.
- Dependencies and consumers: Approved scratch Spec, File 5.
- Why now: Approval before code, same commit archival.
- Contract/signature changes: Docs only.
- Input/output and state mapping: Preserve exact approved bytes and hash.
- Error and edge behavior: Occupied path or wrong checksum stops staging.
- Standards impact: MC-SCOPE-001/MC-BLOCKER-001.
- Literal rule enforcement: Rule 11.
- Implementation pseudocode:

```sh
test ! -e docs/egon/spec/2026-11-05-20-02-process-release-comparison.md
cp -n "$COMPARE_APPROVED_SPEC" docs/egon/spec/2026-11-05-20-02-process-release-comparison.md
cmp "$COMPARE_APPROVED_SPEC" docs/egon/spec/2026-11-05-20-02-process-release-comparison.md
```

- Verification contribution: S1 strict Spec.
- After this file: Exact Spec ready for reciprocal link.

#### File 5 — `CREATE docs/egon/plan/2026-11-05-20-03-process-release-comparison.md`

- Purpose: Archive approved exact Plan.
- Symbols: Current Step and Implements Spec.
- Repository evidence: Existing Web docs owner.
- Dependencies and consumers: Approved scratch Plan and File 4.
- Why now: After source proof, archive approved design.
- Contract/signature changes: Docs only.
- Input/output and state mapping: Preserve exact approved bytes and checksum.
- Error and edge behavior: Occupied path, wrong hash or bad link blocks.
- Standards impact: MC-SCOPE-001/MC-BLOCKER-001.
- Literal rule enforcement: Rule 11.
- Implementation pseudocode:

```sh
test ! -e docs/egon/plan/2026-11-05-20-03-process-release-comparison.md
cp -n "$COMPARE_APPROVED_PLAN" docs/egon/plan/2026-11-05-20-03-process-release-comparison.md
cmp "$COMPARE_APPROVED_PLAN" docs/egon/plan/2026-11-05-20-03-process-release-comparison.md
```

- Verification contribution: S1 strict Plan.
- After this file: Exact five paths ready for one focused commit.

- Validation working directory: /Users/mario/SelfProject/Stellar-Enclosure/tianji-web.
- Verification command: R1/R2/G1/S1 in §8.
- Expected result: One exact assertion per RED, 16 owning and 56 focused actual passes, zero static PaC authority delta.
- Failure returns to: File 1 assertion setup, File 2 behavior, Files 3–5 evidence or approval.
- Completion criteria: Exact metadata differences, stable current identity, unchanged read authorization and default.
- Rollback: Revert the focused Web commit.
- Commit paths: `src/pages/DefinitionReleasePage.test.tsx`, `src/pages/DefinitionReleasePage.tsx`, `docs/egon/evidence/2026-11-05-process-release-comparison.md`, `docs/egon/spec/2026-11-05-20-02-process-release-comparison.md`, `docs/egon/plan/2026-11-05-20-03-process-release-comparison.md`.
- Commit: feat(tianji-web): compare published Process releases.

## 8. Test, Validation, and Quality Gates

Work from /Users/mario/SelfProject/Stellar-Enclosure/tianji-web after GO. Node v24.14.1. Use actual local package installation.

```sh
npm test -- src/pages/DefinitionReleasePage.test.tsx -t 'offers an optional comparison version without loading either release$'
npm test -- src/pages/DefinitionReleasePage.test.tsx -t 'requests two exact published releases with one comparison signal$'
npm test -- src/pages/DefinitionReleasePage.test.tsx src/api/processReleases.test.ts src/auth/AuthContext.test.tsx src/App.test.tsx
npm run typecheck
npm run lint
git diff --check
git diff --cached --check
```

| Gate | Actual requirement | Failure returns to |
| --- | --- | --- |
| R1 | Exactly one missing-label failure; other tests filtered | File 1 |
| R2 | Exactly one expected two calls versus one; other tests filtered | File 1 A / File 2 A |
| G1 | 56 actual focused passes including 16 owning page cases, zero failure/skip, typecheck and lint pass | Files 1/2 |
| S1 | Official static build and zero declarative PaC delta, strict documents, exact scope | Files 2–5 |

Reuse independently verified copied files from /Users/mario/.codex/tmp/tianji-agent-upgrade-20261105/t4-04/release-slice/proof.zEOrOX/validation-toolchain.lock.json and verified-jianshen-contract.jar. Compare new manifest to that same directory final-manifest.json using Web SDK canonicalize compareManifests/manifestDigests. Require no added, removed or changed resources/permissions/messages, identical application/producer/permissionReferences/resourceReferences, identical policy/metadata digests and normal new artifact provenance. Verify packaged current artifact independently. Full Web suite remains optional because shared paths did not change.

For S1, the following uses verified Step85 toolchain copies and the actual current static package:

```sh
compare_pac=/Users/mario/.codex/tmp/tianji-agent-upgrade-20261105/t4-04/release-slice/proof.zEOrOX
export PAC_SDK_DIR=/Users/mario/SelfProject/Stellar-Enclosure/web-sdk
export PAC_TOOLCHAIN_LOCK="$compare_pac/validation-toolchain.lock.json"
export PAC_CONTRACT_ARTIFACT="$compare_pac/verified-jianshen-contract.jar"
npm run build
node --input-type=module - "$compare_pac/final-manifest.json" .generated/permissions/manifest-v1.json <<'JS'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {compareManifests, manifestDigests} from '/Users/mario/SelfProject/Stellar-Enclosure/web-sdk/scripts/permissions/canonicalize.mjs'
const [before, after] = process.argv.slice(2).map(file => JSON.parse(readFileSync(file, 'utf8')))
const delta = compareManifests(before, after)
for (const field of ['resources', 'permissions', 'messages']) assert.deepEqual(delta[field], {added: [], removed: [], changed: []})
for (const field of ['application', 'producer', 'permissionReferences', 'resourceReferences']) assert.deepEqual(after[field], before[field])
const previous = manifestDigests(before), next = manifestDigests(after)
assert.equal(next.policyDigest, previous.policyDigest)
assert.equal(next.metadataDigest, previous.metadataDigest)
const embedded = JSON.parse(readFileSync('dist/permission-build.json', 'utf8'))
const artifact = JSON.parse(readFileSync('.generated/permissions/artifact-record.json', 'utf8'))
assert.equal(artifact.status, 'BUILT')
assert.equal(embedded.manifestDigest, next.manifestDigest)
assert.equal(artifact.manifestDigest, next.manifestDigest)
JS
```

## 9. Migration, Compatibility, Rollout, and Rollback

No migrations or server changes. Single default retained. Existing route permission and no-store. Revert one focused commit.

## 10. Requirement-to-Step Traceability Matrix

| Requirement | Effective Spec section | Steps | Files | Tests/gates | Completion evidence |
| --- | --- | --- | --- | --- | --- |
| REQ-001 | §12/prior metadata | Step 1 | 1/2 | R1/R2/G1 | Exact old/new form |
| REQ-002 | §7.3/§12 | Step 1 | 1/2 | G1 | Stable difference evidence |
| REQ-003 | §7/§12 | Step 1 | 1/2 | G1 | No partial and cancellation |
| REQ-004 | §12 | Step 1 | 1/2 | G1 | Existing auth regression |
| REQ-005 | §8/§16 | Step 1 | 3–5 | S1 | Zero PaC delta and exact source |

## 11. Risks, Blockers, and User Decisions

| ID | Risk or decision | Impacted Steps/files | Evidence | Owner | Status/action |
| --- | --- | --- | --- | --- |
| RISK-001 | Comparison may be mistaken for compatibility | File 2 | Spec §18 | Web owner | Fixed metadata-only text and no controls |
| RISK-002 | Live deployment still unverified | Future | Step85 evidence | Operator | Separate acceptance |

## 12. Review and Acceptance

### 12.1 Original requirement fidelity

Two explicit exact versions, same current role and no write.

### 12.2 Spec consistency

Composite identity, closed metadata, common signal and no partial match.

### 12.3 Repository executability

Current clean baseline, exact existing page, toolchain and source-independent PaC fields inspected.

### 12.4 Test and release completeness

Two exact REDs, page/API/Auth/App finite, typecheck/lint and official PaC static. No live claim.

### 12.5 Blocking Manual Check

| Check ID | Applicability | Status | Evidence | Finding | Required action/exception |
| --- | --- | --- | --- | --- | --- |
| MC-ARCH-001 | Applicable | PASS | §4/§5 | Same Web page | None |
| MC-REUSE-001 | Applicable | PASS | §4.7 | Existing GET/Auth | None |
| MC-DEP-001 | Applicable | PASS | §6 | No dependency | None |
| MC-NAME-001 | Not applicable | N/A | §5 | TS only | None |
| MC-VALID-001 | Applicable | PASS | §7 | Exact form and identity | None |
| MC-MODEL-001 | Not applicable | N/A | §5 | No Java POJO | None |
| MC-CONVERT-001 | Not applicable | N/A | §7 | Local existing DTO | None |
| MC-LOG-001 | Not applicable | N/A | §7 | No new logs | None |
| MC-BEAN-001 | Not applicable | N/A | §5 | No Java bean | None |
| MC-UTIL-001 | Not applicable | N/A | §4.7 | No Java utility | None |
| MC-JSON-001 | Applicable | PASS | §7 | Same decoder | None |
| MC-TIME-001 | Not applicable | N/A | §4.9 | No changed time | None |
| MC-CONFIG-001 | Not applicable | N/A | §6 | No config | None |
| MC-PATTERN-001 | Applicable | PASS | §4.5 | Direct bounded comparison | None |
| MC-SCOPE-001 | Applicable | PASS | §5/§7 | Two source paths and exact docs | None |
| MC-TEST-001 | Applicable | PASS | §8 | Exact finite tests | None |
| MC-BLOCKER-001 | Applicable | PASS | §11 | Reviewable source | Live separate |

### 12.6 Final verdict

PASS — Ready for user review

仓库外 Plan 草稿及有限测试证明。真实浏览器、部署与 IAM 未运行。
