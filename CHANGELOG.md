# Changelog

## 1.5.0

- Cord Trigger offers the retainer events: a payment charged (`retainer.charged`), a payment not charged (`retainer.charge_failed`) and a retainer canceled (`retainer.canceled`).

## 1.4.0

- Cord node version 2, the default for new nodes: every operation returns the Cord object itself, and Search returns one item per result, with Return All and Limit.
- Search quotes filters by quote number, client ID and status, as the Cord API does. It used to send a parameter the API ignores and returned every quote.
- Mark a quote as paid sends the action the Cord API expects. It failed on every call before.
- Create a task sends the due date as YYYY-MM-DD, so a date picked in n8n is accepted.
- Version 1 keeps its output shape, so existing workflows keep working.

## 1.3.0

- Cord Trigger offers the payment plan milestone event (`quote.milestone_completed`) and the Cord Workflows run events (`workflow_run.succeeded` and `workflow_run.failed`).
- New Cord icon, in light and dark.

## 1.2.0

- Payment terms now include Net 7, Net 15, Net 45 and Net 90 alongside Upfront, Net 30 and Net 60.

## 1.1.0

- Rebuilt on the official n8n node starter: TypeScript, strict lint and n8n Cloud eligibility.
- Light and dark icons, and the Cord node can be used as an AI agent tool.
- Published from GitHub Actions with npm provenance.

## 1.0.0

- First release: Cord Trigger with signed webhooks, and the Cord node for clients, quotes and tasks.
