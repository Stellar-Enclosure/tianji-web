# Owned Process migration preflight console evidence

Web baseline bc926e477ddcd2fca20c00d33ba8346c0601d108. PS producer 410874c58d88b766e27706d80e639ebf2d734f4d. [Spec](../spec/2026-11-05-23-51-process-migration-preflight-console.md) and [Plan](../plan/2026-11-05-23-52-process-migration-preflight-console.md) pass strict validation.

The existing authorized Process instance detail offers the preflight panel when the current identity also has release read. The user first reads and sees the exact target release manifest digest, then explicitly requests one structure-only preflight. The result must match the instance, source release and pinned target version. Changing the target or selected instance, losing permission or changing identity discards late requests and reports.

| Gate | Actual observation |
| --- | --- |
| R1 | One expected failure. The typed pass-through accepted a report for a different target version. |
| R2 | One expected failure. The baseline page lacked the explicit preflight panel after current instance detail. |
| G1 | 45 tests across three owning and adjacent files passed. TypeScript and ESLint passed. |
| P1 | Official static package passed. Exactly one CALLS reference was added and matched the actual PS producer's protected GET and HEAD plus both existing read permissions and scopes. |
| S1 | Strict docs, eight exact paths and excluded tracked bytes checked. |

Web artifact digest 5579d5623e6398607ce8e032b1ed6f3977c3491f7dcc1a1fa26f7e9fc2ae4531. Manifest digest 456d03f624320da1d24a8644498e2a971f49e5265f19d5b7d7bf3a0e16c2befd. Policy digest 87ee5ef7803dccd84cf9694f376005f096d61688b3c77f3f2f1fd2dc0a1f5205. Metadata digest 298603b4f24ddd10fac93a2ab43cf63e04f34c06b53f303405eed32ebbea7e40 matches baseline. The actual PS raw PaC SHA-256 is 2997f98b0a33d964465fecc143009131b24d249f502fc8c1a82437af1dda0edd. Other declarations and references match baseline.

Manual and applicable literal checks cover the existing dual read UI authority, owned selected detail, pin and state validation, abort and stale-response suppression, structure-only wording and exact static artifact scope. Real Flowable, PostgreSQL, BFF/IAM and browser validation remain separate.
