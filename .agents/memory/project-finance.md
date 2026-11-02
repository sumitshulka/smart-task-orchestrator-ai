---
name: Project Finance Requirements
description: Product rules for accrual-only project profitability, expense categories, revenue recognition, and access.
---

Project Finance measures project profitability over its lifetime using accrued revenue and expenses; it does not track payments. Monthly resource costs are based on project resource allocation and effective salary information maintained in Project Settings. Other expenses use expense heads managed once at organization level. Revenue may be recognized monthly or by achieved milestone, with monthly and milestone-level detail available in reports. Organization admins decide which project role titles may enter revenue or choose the recognition basis; this must support custom project roles.

Deallocation is distinct from deletion: close a member's active project allocation, retain membership/resource audit history, include costs only in months the allocation overlapped, and exclude future months.

All finance amounts and allocated salary costs use the organization currency so project totals are comparable. Treat revenue recognition basis as a monthly/milestone enum, not a boolean option, wherever project settings are validated.

Project estimates use project currency and need an auditable ledger: retain the original estimate, record each change-request top-up separately with reference, reason, actor, and date, and show the estimate history in Project Finance. Top-ups increase the current total; they do not replace the original estimate.

Keep Finance visually split into Revenue above Expenses. Entry forms open in dialogs. Salary-cost rows are computed from Project Settings and read-only here; user-entered accruals stay editable/deletable while pending, then lock after approval. Approval is limited to a different authorized project finance user.

The profitability matrix belongs in the project Finance view and both sections share calendar-month columns. Milestone-recognized revenue is grouped by achieved month while milestone details remain available; report filters support month, quarter, year, custom range, and inception-to-date. Authorized resource-cost viewers can inspect each salary calculation.

Finance entry rows use icon-only edit/delete actions revealed on hover (and keyboard focus); pending and approved states use accessible icons rather than inline status text.

**Why:** The user described Finance as an accrual profitability workflow, not accounting/payments, and explicitly requires resource deallocation to preserve project history for audit.

**How to apply:** Keep organization-wide expense heads separate from project expense entries, preserve effective-month salaries and membership periods, record revenue with its monthly or milestone basis, enforce configured project-role access server-side, and report line-level accruals rather than only totals.
