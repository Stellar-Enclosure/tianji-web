# tianji-web

React console for Tianji processes, Cases and historical Agent runs. Use the Process workspace to save a draft, publish a fixed revision and activate its release separately. New work starts from the active release. The console lists prior Agent runs for the current identity, displays persisted events and results, and requests cancellation. Event subscriptions resume from the last sequence. Retrying an uncertain write keeps its original operation identifier. Services enforce tenant isolation and permissions.

The application uses the shared Enterprise layout, PUBLIC OAuth with S256 PKCE, and the Jianshen resource registry. REST and Agent SSE attach the Bearer for the deployed Tianji Resource. The verified issuer, subject, tenant and catalog scope must match the current permission snapshot.

Business applications own task inboxes, assignments, forms, opinions, attachments and Memory management. Their task completion sends the permitted typed result or an opaque business `resultRef` to Process. Old Task and Memory bookmarks open a static handoff without reading authorization or calling business APIs.

The Case page looks up a known Case ID through the existing get API; there is no Case directory, start or complete-history API. It displays current status and plan items, with a timeline limited to actual submitted/finished instants in UTC. An ACTIVE Case permits only the plan-item actions explicitly returned by the server and allowed by the current Case action resource. DISABLE, ENABLE, START and TERMINATE are finite plan-item operations; terminating an item does not claim that the whole Case or process ended or that external work was rolled back. Milestones and terminal Cases offer no invented actions.

Case commands reuse the original request when an outcome is uncertain. Accepted results appear separately as this page's operation receipts, which may be replays and do not represent a complete history or the latest state. Success clears writable facts before a fresh read. A failed read retains only confirmed historical receipts. Identity, Case ID, route/resource or read-permission changes discard old page state. Losing the action permission disables confirmation and retry while previously submitted commands retain their service-side state. Case read-only identities can enter their own route with Case permissions. Native Case-to-BPMN and S08/S09 acceptance require the server Case feature, gateway routing, IAM and the applicable permissions.

## Process workspace

A current identity with `TIANJI_PROCESS_RELEASE_PUBLISH` can open `/process-definitions` to list drafts it owns, save edits and reopen a saved draft. Save to update the draft. Validate the exact saved revision before publishing it. Activate the published release separately with `TIANJI_PROCESS_RELEASE_READ` and `TIANJI_PROCESS_RELEASE_ACTIVATE`.

A draft version conflict (`409`) keeps the editor's local buffer until the user confirms a reload. If publication is uncertain, the editor looks up the original command on the saved draft. For uncertain activation, the panel looks up the original command in activation history and shows its receipt separately from the active release. Recovery pointers belong to the current tenant and authenticated identity. The console clears the old pointers when that identity changes.

The technical START action requires `TIANJI_PROCESS_READ` and `TIANJI_PROCESS_START`. Process selects the active release and pins that version to the new instance. When the outcome is uncertain, the console queries the API-025 receipt with the original `commandId` and `requestSha256`.

Each workspace checks its page resource. `TIANJI_PROCESS_DATA_READ` governs access to instance data fields. Historical Case and Agent pages use `TIANJI_CASE_READ` and `TIANJI_AGENT_READ`. Opening `/tasks`, `/tasks/:taskId` or `/memory` directly shows the static handoff before authentication or API calls. See [App.tsx](src/App.tsx), [App.test.tsx](src/App.test.tsx), [AuthContext.test.tsx](src/auth/AuthContext.test.tsx), [ProcessDefinitionWorkspacePage.test.tsx](src/pages/ProcessDefinitionWorkspacePage.test.tsx), [ProcessDraftEditorPage.test.tsx](src/pages/ProcessDraftEditorPage.test.tsx) and [ProcessActivationPanel.test.tsx](src/pages/ProcessActivationPanel.test.tsx).

## Configuration

Copy `.env.example` to an ignored local environment file and set:

- `VITE_PERMISSION_NAMESPACE` and `VITE_PERMISSION_ENVIRONMENT`: the fixed catalog scope of the deployed Tianji permission view. Missing or mismatched values deny access.
- `VITE_TIANJI_OAUTH_CONFIG` contains the deployment-owned tenant PUBLIC registrations, `activeResource`, `webOrigin`, `resource` and `apiBaseUrl`. Every registration follows `PublicOAuthRegistration` from the shared SDK and uses the same Tianji Resource and API base. Set `webOrigin` to the console's approved HTTPS origin.
- Register `${webOrigin}${base}auth/oidc/callback/${registration.id}` exactly for the console SPA. For Wujie popup authorization, also register `${webOrigin}${base}auth/oidc/popup/${registration.id}` and set the registration's `popupRedirectUri`. Serve the SPA at both paths. The embedded console matches its issuer, tenant and Resource against its own registration before opening the popup. Its independent URL remains available if the popup is blocked.
- `VITE_BASE_PATH` sets the static console base prefix, with `/` as the default. Use the same base when registering the callback URIs.
- Set `VITE_PERMISSION_NAMESPACE` and `VITE_PERMISSION_ENVIRONMENT` to the backend permission catalog scope.

In Portal, the Tianji popup callback must share the browser opener's origin. Publish the console on a unique path under the Portal origin when using embedded authorization. The console provides an approved standalone link when the popup is unavailable.

Use an approved same-origin Cilium route for the console and Tianji API when deploying the current Agent Server. A deployment with separate Web/API origins requires matching backend CORS preflight, including Authorization, `X-Egon-Tianji-Tenant`, and `Last-Event-ID`. Expired sessions use a new authorization flow. Pending writes remain explicit user actions, and reconnecting a stream only resumes observation. A same-tab reauthorization resumes from the previously observed sequence for the same verified identity and Run. The browser stores only the binding digest and sequence, and explicit sign-out removes it.

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
