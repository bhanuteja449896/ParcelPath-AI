# ParcelPilot AI Support System

> **AI development brief.** This README is the single source of truth for any AI model
> (or human) working on this repository. Read it fully before writing any code.

## 1. Project Overview

**Client / context:** CalQuity — AI Engineer hiring assessment (first-round AI Agent Assessment).
CalQuity builds AI infrastructure for financial institutions: AI agents, multi-step workflows,
retrieval and reasoning systems, and the APIs/pipelines/backends that power them.

**The product to build:** ParcelPilot is a fictional B2B logistics platform where businesses book
and manage shipments across multiple carrier partners. Its 20-person customer operations team
handles hundreds of support requests weekly. Customers ask about account entitlements,
customer-specific contract terms, shipment cancellations, service credits, and support SLAs.

**Goal:** Build at least one AI chatbot for ParcelPilot:

1. **Customer-facing support agent** — answers customer queries quickly and reliably; escalates
   when necessary.
2. **Internal support/operations chatbot** — helps authorised ParcelPilot staff investigate,
   prioritise, and act on issues across support activity.

Supporting **both contexts is encouraged**.

## 2. Data Pack (Information Base)

The chatbot(s) must use **only the supplied data pack** as its information base. Expected files:

| File | Purpose | Reliability notes |
|---|---|---|
| `01_Support_Policy_v3_CURRENT.pdf` | Current support policy | Authoritative |
| `02_Support_Policy_v2_DEPRECATED.pdf` | Old support policy | Deprecated — must NOT be used as current guidance |
| `03_Cancellation_and_Service_Credit_SOP_v4.pdf` | Cancellation & service credit SOP | Authoritative procedure |
| `04_Product_Operations_Guide_and_Known_Issues.pdf` | Product docs + known issues | Authoritative |
| `05_Northstar_Logistics_Enterprise_Agreement.pdf` | Customer agreement (Northstar) | Customer-specific — can override general policy for that account |
| `06_LumenWorks_Service_Agreement.pdf` | Customer agreement (LumenWorks) | Customer-specific — can override general policy for that account |
| `ParcelPilot_Assessment_Data.xlsx` | Internal account, order, ticket data | Structured data; historical ticket resolutions may be **incorrect** |

**Critical data rules:**

- Use the **dataset snapshot time stated in the workbook's README sheet** as the reference time
  for all time-based questions.
- The source base is **intentionally imperfect**: documents may be outdated, customer agreements
  may override general policies, and historical ticket resolutions may contain incorrect guidance.
  Handle these deliberately — never assume all sources are equally reliable.
- Do **not hard-code example IDs or answers**. Load and reason over the supplied data; the
  evaluators will test with other records and questions from the same pack.
- Adding more data is allowed if it makes the solution more complete.

## 3. Minimum Requirements

### 3.1 Chatbot & natural-language queries
- At least one chatbot accepting natural-language requests (customer-facing or internal staff).
- Answers confident, source-supported questions directly.
- Escalates to the human support team anything requiring judgment, unsupported exceptions, or
  actions beyond system capabilities.

### 3.2 Access control & data privacy
- Customer-facing context: customers may only access data belonging to **their own account**.
- Internal context: access limited to authorised ParcelPilot users, scoped by role.
- Authentication/account context/roles may be mocked.
- **Enforcement must live in the data/tool layer, not model instructions only.**
- Sensitive customer information must never reach unauthorised users.

### 3.3 Agent tools (minimum three distinct)
1. **Document search/retrieval** — search policies, agreements, product docs, SOPs.
2. **Structured-data lookup or calculation** — query/calculate using account, order, ticket data.
3. **State-changing action** — e.g. create an escalation, update a ticket, create a follow-up task
   (may be mocked locally).

The agent must autonomously choose between tools.

### 3.4 Confirmation before actions
Every state-changing action requires **explicit user confirmation** before execution. The agent
may prepare the action (e.g. draft an escalation), then ask before committing it.

### 3.5 Multi-step requests
Must support requests needing multiple tools/sources in sequence, e.g.: look up an order →
identify the customer's account → read the customer's agreement → check applicable policy/SOP →
perform a calculation → decide whether escalation/action is required.

### 3.6 Interface
- Simple **chat interface**, ideally showing which tool is being used per step.
- A hosted deployment is highly preferred.

### 3.7 Demo video (~5 minutes)
Cover: solution architecture, working-app demo, and key product/technical decisions with reasons.

## 4. Additional Client Problems (choose / go beyond)

1. **Proactive issue detection** — internal view for authorised users surfacing recurring, urgent,
   or unusual issues across support activity: complaint spikes, clusters of tickets on one product
   issue, high-severity tickets near/exceeding SLA, unusual order/support patterns, multi-customer
   incidents.
2. **Trust & reliability** — deliberate handling of source reliability, conflicts between sources,
   uncertainty, and when to defer to humans. A confidently wrong answer destroys adoption.

## 5. Example Queries (illustrative — do NOT hard-code)

- "Can Northstar cancel ORD-1001 without a cancellation fee? Explain why."
- "A pickup is three hours late because of carrier fault. Should I get a service credit?"

Evaluators will use other records/questions from the same pack.

## 6. Submission Deliverables

1. Public code repository with clear setup/run instructions.
2. Hosted application URL (highly preferred).
3. ~5-minute demo video (architecture, demo, decisions).
4. Architecture note: agent design, tool design, document & structured-data handling, source
   reliability/conflict handling, major trade-offs.
5. Product note: chosen additional problem + approach, future roadmap, intentional omissions,
   one metric to judge usefulness.
6. AI tool usage statement (which tools, how used).

Submission form: https://forms.gle/hLGBrDrNRmK7UAbv6

## 7. Engineering Guidance for AI Models Working on This Repo

> **Start with `ARCHITECTURE.md`** — it contains the locked-in stack decisions, system
> architecture, tool specs, and the phased task plan. Follow it; update its checkboxes as work completes.

- **Never trust a single source blindly.** Precedence: customer-specific agreement > current
  policy/SOP > product docs > historical tickets. Deprecated docs are context only.
- **Enforce scoping in code** (filters on every data query by authenticated account/role),
  never via prompts alone.
- **Gate all mutating actions** behind an explicit confirm step with a clear summary of what
  will happen.
- **Show reasoning traces**: cite sources/documents used and display tool calls in the UI.
- **Prefer deterministic retrieval over memorised answers**: chunk/index the PDFs, compute
  over the XLSX at runtime.
- Keep the stack simple, runnable, and well-documented (`README` setup steps, env vars, seed
  commands). Assume reviewers will clone and run it.
- When adding features, update this README's architecture section so future models stay aligned.

## 8. Repository Status

- [ ] Data pack PDFs/XLSX added to repo
- [ ] Backend (agent, tools, RAG, structured-data layer)
- [ ] Chat interface
- [ ] Access control layer
- [ ] Proactive issue detection / trust features
- [ ] Deployment + demo video + notes
