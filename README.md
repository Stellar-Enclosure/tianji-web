# tianji-web

React console for Tianji processes, Cases and historical Agent runs. Use the Process workspace to save a draft, publish a fixed revision and activate its release separately. New work starts from the active release. The console lists prior Agent runs for the current identity, displays persisted events and results, and requests cancellation. Event subscriptions resume from the last sequence. Retrying an uncertain write keeps its original operation identifier. Services enforce tenant isolation and permissions.

The application uses the shared Enterprise layout, gateway Cookie/CSRF client and Jianshen resource registry. It does not store browser bearer tokens. The permission view must match the verified issuer, subject, tenant and catalog scope before routes or actions are shown. The `X-Egon-Tianji-Tenant` header checks that the gateway session has not changed; it does not select a tenant.

Business applications own task inboxes, assignments, forms, opinions, attachments and Memory management. Their task completion sends the permitted typed result or an opaque business `resultRef` to Process. Old Task and Memory bookmarks open a static handoff without reading authorization or calling business APIs.

The Case page looks up a known Case ID through the existing get API; there is no Case directory, start or complete-history API. It displays current status and plan items, with a timeline limited to actual submitted/finished instants in UTC. An ACTIVE Case permits only the plan-item actions explicitly returned by the server and allowed by the current Case action resource. DISABLE, ENABLE, START and TERMINATE are finite plan-item operations; terminating an item does not claim that the whole Case or process ended or that external work was rolled back. Milestones and terminal Cases offer no invented actions.

Case commands reuse the original request when an outcome is uncertain. Accepted results appear separately as this page's operation receipts, which may be replays and do not represent a complete history or the latest state. Success clears writable facts before a fresh read. A failed read retains only confirmed historical receipts. Identity, Case ID, route/resource or read-permission changes discard old page state. Losing the action permission disables confirmation and retry while previously submitted commands retain their service-side state. Case read-only identities can enter their own route with Case permissions. Native Case-to-BPMN and S08/S09 acceptance require the server Case feature, gateway routing, IAM and the applicable permissions.

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
