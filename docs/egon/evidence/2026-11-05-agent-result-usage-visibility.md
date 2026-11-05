# Agent result usage visibility — Source89

Effective [Spec](../spec/2026-11-05-20-18-agent-result-usage-visibility.md) and [Plan](../plan/2026-11-05-20-19-agent-result-usage-visibility.md), Web baseline `ee026e99fe898989b3affe7641cd1d145353a15d` and Service baseline `d5ccd8225da3c8f27adffdee04cb9d1d787ed7f2`. Both strict validators passed.

The existing authorized result GET is unchanged. On a matching terminal result, the Web displays reported actual or estimated token counters that are safe integers, preserves a real zero and distinguishes unknown. A malformed optional usage value does not hide the existing result or error. No raw price reference, currency or numeric amount is projected into the page. A Java BigDecimal parsed as a JavaScript Number does not prove exact monetary precision, so the UI shows either “费用未知” or “暂无可核验金额”. The current production executor's null usage is intentionally shown as unknown.

| Gate | Actual result |
| --- | --- |
| R1 | 1 intended assertion: baseline exposed the raw usage shape rather than the bounded view. |
| R2 | 1 intended assertion: baseline rendered the existing output without the unknown-cost status. |
| G1 | 63 passed across 5 focused Vitest files, typecheck and ESLint passed. |
| Static | Official Vite/PaC build passed. Resources, permission definitions/references, labels, policy and metadata equal Source87 outside build artifact metadata. |
| S1 | Strict docs, exact four Web source/test paths and three docs, 94 excluded tracked paths unchanged. |

The actual static artifact digest is `426201849466194bece4ca6f5d8b655fedefd54000a9f9da60b1dd9731cb9bc9`. The actual policy and metadata digests are `9b32edd70610b0054aba5170ef7848a44e548bee64a198cd8e3079166f483066` and `59df33d856466266580d2d7ebcdd07e86c2f815bfe04dc5a4a8ff901b44bbff6`. The tracked toolchain lock was unchanged. Exact selector output and static proof are under `/Users/mario/.codex/tmp/tianji-agent-upgrade-20261105/t4-04/result-usage-draft/`.

Manual and literal review confirmed current API and epoch reuse, bounded optional projection, safe owner/result matching, unchanged authority and dependencies, and no production Java, persistence, logging, time or config change. No application, database or browser started. This result-status view does not publish the private per-call ledger or prove priced usage, a spend dashboard, or actual I/E/L.
