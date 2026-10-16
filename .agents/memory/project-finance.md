---
name: Project Finance Requirements
description: Product rules for accrual-only project profitability, expense categories, revenue recognition, and access.
---

Project Finance measures project profitability over its lifetime using accrued revenue and expenses; it does not track payments. Monthly resource costs are based on project resource allocation and effective salary information maintained in Project Settings. Other expenses use expense heads managed once at organization level. Revenue may be recognized monthly or by achieved milestone, with monthly and milestone-level detail available in reports. Organization admins decide which project role titles may enter revenue or choose the recognition basis; this must support custom project roles.

All finance amounts and allocated salary costs use the organization currency so project totals are comparable. Treat revenue recognition basis as a monthly/milestone enum, not a boolean option, wherever project settings are validated.

Keep Finance visually split into Revenue above Expenses. Entry forms open in dialogs. Salary-cost rows are computed from Project Settings and read-only here; user-entered accruals stay editable/deletable while pending, then lock after approval. Approval is limited to a different authorized project finance user.

**Why:** The user described Finance as an accrual profitability workflow, not accounting/payments, and selected project-role titles as the access model so PM, Project Director, Finance Incharge, and custom titles can be authorized per project.

**How to apply:** Keep organization-wide expense heads separate from project expense entries, preserve the effective-month salary history, record revenue with its monthly or milestone basis, enforce configured project-role access server-side, and report line-level accruals rather than only totals.
