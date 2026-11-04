# tianji-web

React console for Tianji Agent runs. The console lists runs belonging to the current identity, starts a versioned Agent definition, displays persisted events and results, and requests cancellation. Event subscriptions resume from the last sequence; retrying an uncertain write keeps its original operation identifier. The service remains the authority for tenant isolation and every permission decision.

The application uses the shared Enterprise layout, gateway Cookie/CSRF client and Jianshen resource registry. It does not store browser bearer tokens. The permission view must match the verified issuer, subject, tenant and catalog scope before routes or actions are shown. The `X-Egon-Tianji-Tenant` header checks that the gateway session has not changed; it does not select a tenant.

The candidate-memory page reads an explicitly selected personal or team scope. Personal ownership comes from the verified subject; team access is checked by the service. Only unconfirmed candidates are displayed, as plain text. Confirmation preserves the reviewed content through a revision-checked correction with a new human-review source declaration; discard uses the separate forget permission and command. An uncertain response keeps its original command and freezes further edits until the operator retries it. A rejected command requires a fresh read. Candidate reading, confirmation and discard require their respective Memory permissions; Agent-run access remains independently controlled. This page requires the service's default-off Memory HTTP feature to be configured separately. It does not automatically extract, activate or merge memories.

An owned successful run can prepare explicit preference candidates after its actual matching completion event is available. The action requires Agent READ and Memory READ/WRITE so the user can continue to candidate review. The user enters only a business scope; the service selects the approved immutable source and policy. Preparation shows a bounded key/count/classification projection and performs no write. The separate generate action submits the opaque source command without editing configuration identifiers or source text. Unknown results retain that exact command across a detail refresh for manual retry; a rejected write requires another source check. Identity/tenant/issuer/request-epoch changes abort and discard pending UI state. The API decoder checks closed shapes, source/owner/scope/policy affinity, prepared key coverage and reference receipt bounds; the Java SDK additionally verifies each source-derived UUID. This flow needs the separate default-off extraction HTTP service feature and performs no model call or automatic activation.

Candidate comparison needs only Memory READ and the service's separate default-off merge-suggestion HTTP feature. Opening a candidate starts fact comparison; semantic comparison requires a separate explicit request with a 0–1 threshold. The dialog displays the current candidate, confirmed targets, literal field/value hints, source confidence and separate transient similarity scores. Fact pages preserve continuation through nonmatching rows instead of claiming an empty scope. Closing the dialog or changing identity cancels pending reads, and candidate revision/content changes invalidate replies. The dialog has no mutation controls; confirmation and discard remain the existing separately authorized actions. Both candidate and target content render as plain React text. No similarity score, target selection or comparison response automatically edits or confirms a fact.

The run detail also provides owned background preference progress before or after run completion. The user explicitly selects a business scope and queries reference-only status; the UI performs no automatic polling or grant issuance. Reading requires Agent READ + Memory READ. Stopping additionally requires Memory FORGET, explicit confirmation and the current intent revision. A completed projection counts acknowledged proposals, including content deduplication, and does not claim that every item created a new candidate. Internal grants, hashes and configuration IDs are not displayed.

An unknown stop outcome retains its exact command ID/body across detail refresh, freezes scope/refresh and permits only manual retry of that original command. A rejected operation clears the selection and requires a fresh query. Current issuer/tenant/subject/request-epoch or run changes abort and discard old reads and writes; late replies cannot update the new frame. Stopping pending extraction preserves submitted candidates and does not cancel the Agent run. The typed decoder rejects foreign/extra/coerced fields, missing intent projections, invalid state/progress and mismatched cancellation revisions. This flow uses the separate default-off `memory.extraction.intents.http.enabled` service feature, which can remain enabled for old intents when background processing is disabled. Component/transport tests and static builds do not establish actual browser, gateway, IAM or database acceptance.

The task inbox lists PROCESS or CASE tasks visible to the current identity, with assigned, candidate and all-visible selections. All-visible is not an administrator query. Cursor navigation remains available when an empty page carries a continuation, and changing filters resets pagination. A task-read-only identity can enter the console and its task routes independently of Agent or Memory access. Claim/return, transfer and completion each require their own action resource as well as Task READ. Transfer selects only a released queue, not an arbitrary assignee; the service rechecks actual roles, assignment and applicant/approver separation.

Task completion accepts only the released STRING/INTEGER/BOOLEAN schema, including an exact empty form when no fields are declared. Approval has no default decision: approve and reject are explicit choices, and `false` is preserved. A proposed operation captures one command ID, opaque version, form and source snapshot. Network failures, malformed success responses, HTTP 408/429 and server errors freeze related controls and allow only manual retry of that original request. A definitive rejection clears old writable facts and requires a fresh read. An accepted receipt remains a historical result while the page reads current state again; a missing task does not prove completion. Leaving the page cannot withdraw a command already handled by the service.

Task identity, route, issuer, tenant, subject and request-epoch changes abort/discard old page state; late replies cannot populate the new frame. Task timestamps explicitly display UTC and retain the original wire instant, without inferring an ended task from its due date. These routes need the existing Process/task HTTP capability, gateway routing and separately managed permissions. Component/contract tests and the dedicated permission build do not establish live task advancement, actual applicant/role enforcement, IAM, gateway/CSRF, PostgreSQL/Flowable or browser acceptance; the user starts that environment separately.

## Configuration

Copy `.env.example` to an ignored local environment file and set:

- `VITE_PERMISSION_NAMESPACE` and `VITE_PERMISSION_ENVIRONMENT`: the fixed catalog scope of the deployed Tianji permission view. Missing or mismatched values deny access.
- `VITE_OAUTH_APP_ALIAS`: gateway application alias; defaults to `edge-tianji`.
- `VITE_YUHENG_ORIGIN`: gateway origin, or empty for same-origin access.
- `VITE_BASE_PATH`: optional static mount path, default `/`.

The development proxy forwards `/apps` to `TIANJI_AUTH_PROXY`, defaulting to `http://127.0.0.1:18180`. The gateway must route the alias and Tianji API and supply identity, CSRF and permission endpoints. Configure and run that environment separately.

## Validation and build

Node 24 and the reviewed, matching web SDK and Jianshen permission-contract artifact are required. The application uses published SDK packages at the versions in `package-lock.json`; the source checkout passed as `PAC_SDK_DIR` supplies the permission build tools.

```sh
npm ci
npm run typecheck
npm run lint
npm test
PAC_SDK_DIR=/absolute/path/to/web-sdk \
PAC_TOOLCHAIN_LOCK="$PWD/permission-toolchain.local.lock.json" \
PAC_CONTRACT_ARTIFACT=/absolute/path/to/verified-contract.jar \
npm run build
```

The build validates the declared UI resources, permissions and API references, then embeds `permission-build.json` in `dist/`. The checked-in `LOCAL_UNCOMMITTED` toolchain lock is for same-batch local verification only; it does not register or activate permissions and is not a production release pin. Production delivery requires a reviewed pinned toolchain, matching contract, explicit build identity and the platform's separate registration, activation and grant procedures. No credentials belong in these files or build arguments.

The Agent API and runtime are disabled by default in the service until their deployment and execution dependencies are configured. Mock-based tests and a successful static build do not establish real gateway, browser, model or service acceptance.
