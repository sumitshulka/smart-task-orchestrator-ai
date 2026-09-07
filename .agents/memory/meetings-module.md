---
name: Project Meetings module
description: Durable design rules for project meeting records, visibility, and external integrations.
---

Meeting records are the source of truth for agendas, attendance, discussions, decisions, minutes, and action items. Calendar invitations and file storage are integration layers and must not become authoritative copies.

**Why:** Meeting history needs to remain auditable even when a calendar provider or storage URL changes.

**How to apply:** Keep new meeting workflow data project-scoped, enforce the Meetings project setting on server routes, and filter client-facing reads by explicit visibility rather than by UI-only hiding.

The current data model intentionally keeps recurrence metadata and calendar-provider state separate from the meeting record, so additional providers can be added without changing meeting semantics.