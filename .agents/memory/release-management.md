---
name: Release Management Workflow
description: Scope-based release readiness and role rules for project delivery approvals.
---

Release approval is evaluated server-side against the release's selected milestones and release items: task completion plus task approval, milestone-scoped test outcomes, required document approval with stored location, milestone-scoped defects, and QA approval.

**Why:** Release readiness must remain enforceable when users bypass the UI, and a release may contain only selected work from each attached milestone.

**How to apply:** Keep release scope immutable enough to audit, use explicit evidence records for documents and tests, and require a project manager/system admin for lifecycle approval plus an assigned Quality Analyst for QA approval.

Quality Analyst eligibility is based on the configured project-specific title or recognized system QA roles; project template roles provide the controlled title vocabulary used by project members.

**Why:** Projects need role-specific QA accountability without hard-coding one organization-wide title.

**How to apply:** Prefer template role titles over free-text member titles, preserve the QA designation when a template is applied, and never treat a hidden UI control as authorization.

Project templates start with a broad industry-standard delivery-role catalog, while administrators can add organization-specific roles and customize the template.

**Why:** Projects need a useful baseline without restricting organizations that use different delivery structures.

**How to apply:** Seed standard roles idempotently for existing and new templates; use the template role records as the source of truth for member title selection.