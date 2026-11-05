# T4-04 当前 Agent 结果的用量与费用状态

| Field | Value |
| --- | --- |
| Document | 2026-11-05-20-18-agent-result-usage-visibility.md |
| Template Version | 9 |
| Archetype Cleanup | Not applicable |
| Status | Review |
| Type | Feature |
| Complexity | Simple |
| Complexity Drivers | 既有单页和已有结果 GET 的一个可选字段投影 |
| Created | 2026-11-05 20:18 Asia/Shanghai |
| Updated | 2026-11-05 20:18 Asia/Shanghai |
| Owner | Tianji Web |
| Repository | tianji-web |
| Scope | 已授权的当前 run 终态结果及四个 Web 源码/测试路径 |
| Change Surface | 既有 Agent result decoder 与运行详情展示 |
| Affected Chapters | §7, §8, §10, §12, §14, §15, §16 |
| Source Requirement | Master §19 T4-04 的费用 UNKNOWN 可见性 |
| Baseline Revision | Web ee026e99fe898989b3affe7641cd1d145353a15d；Service d5ccd8225da3c8f27adffdee04cb9d1d787ed7f2 |
| Amends | None |
| Supersedes | None |
| Depends On | [Master §19 T4-04](../../../../docs/plans/agent-framework-upgrade-plan.md#t4-04--定义发布与失败恢复运维控制台) |
| Related Specs | None |
| Related Plans | None |

## 1. Summary

运行详情复用现有 GET 返回的可选 usage。终态且已返回可见结果时显示用量口径、安全整数计数和费用状态。当前执行器完成结果通常写 usage=null，页面会如实显示未知。没有价格或账单功能的验收。

## 2. Background and Current State

| ID | Source evidence | Current consequence |
| --- | --- | --- |
| EVD-001 | C AgentExecutionResult.usage 与 AgentUsageDTO | 现有公开可选对象，ACTUAL/ESTIMATED/UNKNOWN、三项可空 Long、可空 BigDecimal/currency/priceVersionRef |
| EVD-002 | AS AgentRunController#result、TianjiAgentAccess.require 与 AR AgentLedgerService#getResult | 既有 USER/SERVICE READ 和 owner 授权，当前 result GET 与 no-store 已存在 |
| EVD-003 | AR AdkAgentRunExecutor 正常完成创建结果，AgentLedgerService#projectActualModelUsage | 现有 executor 终值 usage=null；有值的已知生产构造是私有 V15 slot 投影，没有已交付的公开费用总额生产者 |
| EVD-004 | Web src/api/agent.ts、src/pages/AgentRunDetailPage.tsx 与 App route | 既有 result GET、可信 tenant/epoch、终态读取与输出；Web 类型未投影 usage |
| EVD-005 | Shared HTTP requestJson/createHttpClient 使用 response.json | JSON 数字已转换 Number，无法证明任意 BigDecimal 数值精度 |

### 2.5 Archetype example cleanup

Cleanup disposition: Not applicable
Reason: 既有 tianji-web 单页技术切片，没有生成或替换 archetype 示例。

## 3. Goals and Non-goals

同一已授权 run 当前结果可显示安全计数和未知费用状态。没有新 endpoint、owner 策略、查询、权限、PaC 声明、后端、依赖或 schema。私有 V15 诊断、pricing 计算、金额精确显示、跨源关联和 S12 独立。

### 3.3 Change Surface and Design Depth

| Area/layer | Disposition | Exact repository evidence | Exact delta or preserved invariant | Required Spec treatment | Chapters |
| --- | --- | --- | --- | --- | --- |
| Web API result decoder and detail | Affected | EVD-004/005 | optional closed usage projection and terminal display | full decoder/UI/gates | §7, §8, §10, §12, §14, §15, §16 |
| Service HTTP/C/CL and auth | Context-only | EVD-001/002 | existing result resource/contract | concise preserved boundary | §9 |
| Private V15 and persistence | Unchanged | EVD-003 | source owner and no new wire | preserve | §11 |

## 4. Requirements and Acceptance Criteria

| ID | Requirement | Acceptance |
| --- | --- | --- |
| REQ-001 | 只消费既有匹配结果 | 相同 run、tenant、GET、abort、permission；不增加请求、权限或 PaC |
| REQ-002 | 闭合可选用量投影 | 正常计数与零保留，非法可选用量归未知，不能使合法结果输出消失 |
| REQ-003 | 区分已报告实测、估算和未知 | 缺失/未知/非安全整数不冒充零；已报金额只显示暂无可核验金额，缺失显示费用未知 |
| REQ-004 | 终态/身份隔离和证据边界 | 现有 key/abort 路径清除过时结果，真实有限和静态构建，部署/浏览器独立 |

### 4.2 Use-case analysis

| ID | Actor | Evidence |
| --- | --- | --- |
| ACTOR-001 | 已获现有 READ 的运行 owner | 已有受保护运行详情和 result GET |

| ID | Use case/goal | Actor | Trigger | Outcome | Alternative | Postcondition |
| --- | --- | --- | --- | --- | --- | --- |
| UC-001 | 查看终态输出与已报告用量状态 | ACTOR-001 | 当前授权、匹配终态与结果 | 输出和计数/状态 | 缺失、malformed、UNKNOWN 或切换身份 | 输出继续可读，迟到值丢弃 |

## 5. Constraints, Assumptions, and Decisions

DEC-001 复用现有结果而不发布私有 ledger。DEC-002 数字金额只映射为 presence，不显示金额、币种或价目引用。即使 JSON 解析为 0，原 BigDecimal 可为正且下溢。DEC-003 malformed optional 不改变有效结果的成功或输出。既有 result envelope、HTTP error 和 exact runId affinity 按原语义。

## 6. Project Technology Context

既有 React/TypeScript、AntD、Vitest、Web SDK requestJson 与权限注册表。复用当前 build；不增加库、后端技术层或 Java 文件。

### 6.2 User-mandated Java rule compliance

| Literal rule | Affected? | Repository evidence | Exact design decision | Files/types/interfaces | Validation/test evidence | Status/blocker |
| --- | --- | --- | --- | --- | --- | --- |
| Rule 1 | No | Web-only §8 | No Java types | Existing boundary | §14 scope | N/A |
| Rule 2 | No | Web-only §8 | No Java handoff | Existing boundary | §14 scope | N/A |
| Rule 3 | No | Web-only §8 | No Java POJO | Existing boundary | §14 scope | N/A |
| Rule 4 | No | Web-only §8 | No bean or logging | Existing boundary | §14 scope | N/A |
| Rule 5 | No | Web-only §8 | No Java utility | Existing boundary | §14 scope | N/A |
| Rule 6 | No | Web-only §8 | No Java JSON or enum changes | Existing boundary | §14 scope | N/A |
| Rule 7 | No | Web-only §8 | No app profile | Existing boundary | §14 scope | N/A |
| Rule 9 | No | Web-only §8 | No complex Java business logic | Existing boundary | §14 scope | N/A |
| Rule 10 | No | Web-only §8 | No Java time change | Existing boundary | §14 scope | N/A |
| Rule 11 | No | Web-only §8 | No Java architecture or persistence | Existing boundary | §14 scope | N/A |

### 6.3 Time semantics and conversion contract

Time contract: Not applicable
Reason: 本切片只读已解析的可选 count/fee 状态。现有运行和事件时间字段及显示保持现有语义。

## 7. Architecture Design

### 7.0 Minimum-design baseline and element-necessity audit

| Proposed element | Change | Requirements | Direct alternative | Verdict |
| --- | --- | --- | --- | --- |
| Current Agent result decoder/detail | Modify | REQ-001, REQ-002, REQ-003, REQ-004 | Existing result supplies only public values | Reuse |
| Private ledger or new API | None | REQ-001, REQ-003 | Independent authorization and exact monetary wire needed | Outside this slice |

| Path | Network calls | Client states | Data delta | Risk |
| --- | --- | --- | --- | --- |
| Existing | Existing terminal GET | Existing run/result | No usage projection | Unknown invisible |
| Proposed | Same | Same state ownership | Narrow display-only projection | Unknown made explicit |

### 7.1 System Architecture Design

Current Run Detail → agentApi.result → requestJson → existing RESULT_API. Decoder projects the optional result subobject. Existing response output, identity and request lifecycle are retained.

### 7.2 High-Level Design

Keep optional schema independent of main result validation. Reuse Descriptions inside the existing execution output card, and derive display only from returned result when both current run and exact result are terminal.

### 7.3 Detailed Design

Accept only a non-array object with exactly seven existing usage keys and a closed enum. Three null-or-nonnegative integer Long slots are checked as parsed JSON. A positive unsafe integer projects to null; fractional, negative or wrongly typed values drop only the usage. UNKNOWN suppresses untrusted amounts and counters. Numeric cost with current string bounds is presence only. Do not recalculate totals or amounts. Return a new bounded usage projection and preserve public output, result metadata and identity affinity.

## 8. Package Structure and Code File Tree

| Operation | Exact path |
| --- | --- |
| Modify | src/api/agent.ts |
| Modify | src/api/agent.test.ts |
| Modify | src/pages/AgentRunDetailPage.tsx |
| Modify | src/pages/AgentRunDetailPage.test.tsx |
| Create | docs/egon/spec/2026-11-05-20-18-agent-result-usage-visibility.md |
| Create | docs/egon/plan/2026-11-05-20-19-agent-result-usage-visibility.md |
| Create | docs/egon/evidence/2026-11-05-agent-result-usage-visibility.md |

## 9. Interface Definitions

Scope disposition is Context-only. Existing REST GET /api/tianji/v1/agent-runs/{runId}/result, AgentRunController#result and tianji.api.agent.result retain exact permission, OAuth scope, owner, no-store, request and public wire. The Web consumer retains its existing Cookie transport and exact verified tenant assertion.

## 10. POJO and Data Model Design

AgentResultUsage is a Web-only readonly projection of kind, inputTokens, outputTokens, totalTokens and costReported. Missing optional usage returns null. For known kinds, counters remain number or null and the fee flag indicates only non-null numeric presence. Raw amount, currency and priceVersionRef are not copied. No server DTO or shared transport change.

## 11. Database Design

Existing result and optional private V15 ledger are separate authorities. No DB access, migration, table or data change.

## 12. Frontend Page Design

Inside existing execution output Card, add existing AntD Descriptions titled 用量与费用. ACTUAL = 已报告实测, ESTIMATED = 已报告估算, absent or UNKNOWN = 用量未知. Missing fields are 未知. Numeric presence renders 暂无可核验金额, otherwise 费用未知. Valid integer zero renders 0. An active run or a result still pending has no terminal usage block. There is no new control, route, resource or loading request. Existing output, cancellation and events remain available.

## 13. Design Patterns and Architecture Principles

Reuse the existing typed consumer, declarative rendering and request-bound component identity. A pure local projection suffices. No new production abstraction.

## 14. Test Design

| Test | Scope |
| --- | --- |
| TEST-001 | API retains exact old GET, tenant, signal and output; redacts numeric amount/currency/private reference |
| TEST-002 | Missing/null/malformed is optional. Unsafe Long, BigDecimal underflow and UNKNOWN never render false zero |
| TEST-003 | Terminal actual/estimated/unknown, nonterminal no new request, late old tenant ignored |
| TEST-004 | Node24 targeted tests, typecheck, lint and existing static PaC build with zero declaration delta |

## 15. Non-functional and Cross-cutting Design

Closed seven-key use of decoded data and bounded count display. Existing shared browser JSON reader cannot prove raw decimal lexemes or duplicate-key raw bytes. The UI emits fixed labels, no secret diagnostics or browser storage. This slice does not add request timing or background work.

## 16. Compatibility, Migration, Rollout, and Rollback

Older results without usage and present null both show unknown. Defensively ignored optional payload does not stop existing output. No migration, permission or environment change. One Web-only commit. Static PaC metadata and policy unchanged. Real BFF/browser and model usage remain separate.

## 17. Alternatives and Decisions

The private ledger contains reservation identifiers, route/model names, priceVersionRef and owner-local cursors. Publishing it would require new authority and contract. Existing result suffices for conservative status. An exact monetary UI requires an independently reviewed lossless wire representation and authoritative producing flow.

## 18. Risks and Open Questions

The current executor generally emits null. Positive values in fixtures verify compatible consumer behavior only. Exact money, true cost production and platform S12 remain separate.

## 19. Traceability Matrix

| Requirement | Use case | Test |
| --- | --- | --- |
| REQ-001 | UC-001 | TEST-001 |
| REQ-002 | UC-001 | TEST-001, TEST-002 |
| REQ-003 | UC-001 | TEST-002, TEST-003 |
| REQ-004 | UC-001 | TEST-003, TEST-004 |

## 20. Review and Acceptance

### 20.5 Blocking Manual Check

| Check ID | Applicability | Status | Evidence | Finding | Required action/exception |
| --- | --- | --- | --- | --- | --- |
| MC-ARCH-001 | Applicable | PASS | §7/8/14 | Existing Web API/detail | None |
| MC-REUSE-001 | Applicable | PASS | §7/8/14 | Existing result, authority and UI | None |
| MC-DEP-001 | Applicable | PASS | §7/8/14 | No dependency change | None |
| MC-NAME-001 | Applicable | PASS | §7/8/14 | Usage projection and existing result names | None |
| MC-VALID-001 | Applicable | PASS | §7/8/14 | Closed optional and affinity rules | None |
| MC-MODEL-001 | Applicable | PASS | §7/8/14 | Readonly bounded TypeScript projection | None |
| MC-CONVERT-001 | Not applicable | N/A | §7/8/14 | No Java mapping | None |
| MC-LOG-001 | Not applicable | N/A | §7/8/14 | No logging change | None |
| MC-BEAN-001 | Not applicable | N/A | §7/8/14 | No backend bean | None |
| MC-UTIL-001 | Applicable | PASS | §7/8/14 | Existing local Web primitives | None |
| MC-JSON-001 | Applicable | PASS | §7/8/14 | Closed decoded usage, optional fallback | None |
| MC-TIME-001 | Not applicable | N/A | §7/8/14 | No time change | None |
| MC-CONFIG-001 | Not applicable | N/A | §7/8/14 | No config change | None |
| MC-PATTERN-001 | Not applicable | N/A | §7/8/14 | Existing render and request composition | None |
| MC-SCOPE-001 | Applicable | PASS | §7/8/14 | Four Web files and three docs | None |
| MC-TEST-001 | Applicable | PASS | §7/8/14 | Exact finite and static gates | None |
| MC-BLOCKER-001 | Applicable | PASS | §7/8/14 | Source scope review; runtime separate | None |

**PASS — Ready for user review**
