# Published Process release comparison — Source87

Effective [Spec](../spec/2026-11-05-20-02-process-release-comparison.md) and [Plan](../plan/2026-11-05-20-03-process-release-comparison.md), Web baseline `6e58cdf3b4c283f348f262523e01f2424e054aa5`. Both strict validators passed.

An optional second exact version in the existing release page reuses the same tenant, permissions and public GET. Two valid distinct versions share one abort signal; both must succeed before the page displays either result. The UI shows both manifest SHA-256 values and classifies model additions, removals and changes by model type and definition key, comparing content hashes and declared inputs. An edit, identity change or failed lookup drops the entire comparison. The original one-version lookup stays the default. The view does not establish migration compatibility or authority to activate or roll back a release.

| Gate | Actual result |
| --- | --- |
| R1 | 1 intended missing optional field failure, other cases filtered. |
| R2 | 1 intended expected-two-calls versus actual-one-call failure, other cases filtered. |
| G1 | 56 passed across 4 targeted Vitest files, including 16 owning page tests; typecheck and lint passed. |
| Static | Official Vite/PaC build passed; policy, metadata and all authority declarations identical to Source85. |
| S1 | Strict docs, exactly two page paths and three docs, excluded tracked bytes and tracked toolchain lock unchanged. |

The actual static build artifact digest was `15704d6e110c9f45233cd18563a18bc7cfa8d4f176567308828468c2d6430e23`; policy and metadata digests remained `9b32edd70610b0054aba5170ef7848a44e548bee64a198cd8e3079166f483066` and `59df33d856466266580d2d7ebcdd07e86c2f815bfe04dc5a4a8ff901b44bbff6`. Exact tests and proof are under `/Users/mario/.codex/tmp/tianji-agent-upgrade-20261105/t4-04/release-comparison/`.

The Manual Checks and literal rules were reviewed against the existing route/auth/request ownership, bounded deterministic model comparison, complete-pair rendering, clean source lock and actual static permission equality. No dependency, schema, public wire, backend, permission definition, grant, profile, logging or time-contract change. Java-only conversion and bean checks are outside this Web slice. Browser and deployed BFF/IAM verification remain operator-controlled; none were started.
