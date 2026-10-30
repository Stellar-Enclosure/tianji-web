# tianji-web

React console for Tianji Agent runs. The console lists runs belonging to the current identity, starts a versioned Agent definition, displays persisted events and results, and requests cancellation. Event subscriptions resume from the last sequence; retrying an uncertain write keeps its original operation identifier. The service remains the authority for tenant isolation and every permission decision.

The application uses the shared Enterprise layout, gateway Cookie/CSRF client and Jianshen resource registry. It does not store browser bearer tokens. The permission view must match the verified issuer, subject, tenant and catalog scope before routes or actions are shown. The `X-Egon-Tianji-Tenant` header checks that the gateway session has not changed; it does not select a tenant.

The candidate-memory page reads an explicitly selected personal or team scope. Personal ownership comes from the verified subject; team access is checked by the service. Only unconfirmed candidates are displayed, as plain text. Confirmation preserves the reviewed content through a revision-checked correction with a new human-review source declaration; discard uses the separate forget permission and command. An uncertain response keeps its original command and freezes further edits until the operator retries it. A rejected command requires a fresh read. Candidate reading, confirmation and discard require their respective Memory permissions; Agent-run access remains independently controlled. This page requires the service's default-off Memory HTTP feature to be configured separately. It does not automatically extract, activate or merge memories.

An owned successful run can prepare explicit preference candidates after its actual matching completion event is available. The action requires Agent READ and Memory READ/WRITE so the user can continue to candidate review. The user enters only a business scope; the service selects the approved immutable source and policy. Preparation shows a bounded key/count/classification projection and performs no write. The separate generate action submits the opaque source command without editing configuration identifiers or source text. Unknown results retain that exact command across a detail refresh for manual retry; a rejected write requires another source check. Identity/tenant/issuer/request-epoch changes abort and discard pending UI state. The API decoder checks closed shapes, source/owner/scope/policy affinity, prepared key coverage and reference receipt bounds; the Java SDK additionally verifies each source-derived UUID. This flow needs the separate default-off extraction HTTP service feature and performs no model call or automatic activation.

Candidate comparison needs only Memory READ and the service's separate default-off merge-suggestion HTTP feature. Opening a candidate starts fact comparison; semantic comparison requires a separate explicit request with a 0–1 threshold. The dialog displays the current candidate, confirmed targets, literal field/value hints, source confidence and separate transient similarity scores. Fact pages preserve continuation through nonmatching rows instead of claiming an empty scope. Closing the dialog or changing identity cancels pending reads, and candidate revision/content changes invalidate replies. The dialog has no mutation controls; confirmation and discard remain the existing separately authorized actions. Both candidate and target content render as plain React text. No similarity score, target selection or comparison response automatically edits or confirms a fact.

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
