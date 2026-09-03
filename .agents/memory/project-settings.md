---
name: Project Settings Architecture
description: Durable design rules for project-level settings and module configuration.
---

Project-level configuration belongs in a structured settings record rather than a growing set of nullable columns on the operational project record. Existing project fields remain the source of truth for general project data, and existing membership, Workspace, defect, finance, audit, and Custom Fields systems should be reused.

**Why:** Settings need to grow by module without duplicating entities or making project rows hard to maintain. Disabling a module must hide or stop its workflows while retaining data for later re-enablement.

**How to apply:** Add validated settings keys and idempotent startup migrations for new structured configuration. Gate project navigation from persisted module toggles, enforce edits server-side by role, and record sensitive changes in project settings audit history.