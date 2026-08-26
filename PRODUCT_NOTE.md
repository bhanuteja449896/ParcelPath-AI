# Product Note

## Additional Client Problem Addressed
**Problem 1: Proactive Issue Detection**
To move beyond a purely reactive support experience, we built an internal **"Proactive Issues"** dashboard for authorized support and operations staff. This dashboard surfaces:
- Recurring and unusual issues across support activity.
- A grouped view of tickets related to the same product issue (e.g. system-wide login failures).
- High-severity tickets approaching or exceeding SLA limits.
By grouping these issues structurally and giving the agent context of system-wide anomalies, the support team can triage effectively, identify root causes, and proactively dispatch fixes before individual users even submit a ticket.

## Future Roadmap (What Else I Would Build)
If continuing work on ParcelPilot, I would prioritize:
1. **Automated Billing/Refund Integration:** Extending the structured-data tool to actually trigger real refunds via Stripe or a billing API for immediate service credit application, rather than just calculating and drafting the task.
2. **Analytics & Satisfaction Dashboard:** A dashboard tracking metrics like *First Contact Resolution (FCR)*, *Average Handling Time (AHT)*, and *Agent Handoff Rate* to continuously monitor the AI agent's effectiveness.
3. **Automated Document Ingestion:** A webhook-based pipeline to automatically chunk and embed new PDFs (e.g., updated enterprise agreements) as soon as they are uploaded to a cloud storage bucket.

## Intentional Omissions
- **Third-Party Managed Authentication (e.g., OAuth/SSO):** I intentionally built a custom session-based auth system using Argon2id to clearly demonstrate how application-level context variables can be securely passed to PostgreSQL to enforce Row Level Security (RLS) dynamically.
- **Complex UI Animations:** Kept the UI straightforward and heavily functional rather than prioritizing complex animations, ensuring the focus remained strictly on the reliability of the agent tools.
- **Real-Time WebSockets:** While a live chat is simulated, WebSockets were left out to keep the deployment architecture stateless and serverless-friendly on Vercel.

## Success Metric
The primary metric I would use to judge whether the product is useful is the **AI Resolution Rate** — the percentage of customer support conversations that are fully resolved by the AI agent without requiring escalation to a human support agent. A secondary metric would be **Time to Resolution (TTR)** for both AI-handled requests and human-handled escalations.
