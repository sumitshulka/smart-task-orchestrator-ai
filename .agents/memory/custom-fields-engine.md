---
name: Custom Fields Engine
description: Metadata-driven custom field system — tables, storage methods, and REST APIs. No UI built yet.
---

## Tables (all in DB as of 2026-07-01)
- `custom_field_groups` — named sections per module; optional (fields can be standalone)
- `custom_field_definitions` — master registry; unique on (module, field_key); has is_system flag
- `custom_field_values` — per-entity values; unique on (field_definition_id, entity_type, entity_id); uses typed columns (value_text/number/date/boolean/json)

## Module names (text column, not enum)
`"task"` | `"project"` | `"defect"` — validated at app layer so new modules need no migration

## Field-type enum (`custom_field_type`)
text, textarea, number, decimal, date, datetime, boolean, select, multiselect, url, email, phone, user_reference, rating, attachment

## API base path
`/api/custom-fields/`

### Groups
- GET    /groups?module=task
- POST   /groups
- PUT    /groups/reorder  (body: {orders: [{id, display_order}]})
- PUT    /groups/:id
- DELETE /groups/:id

### Definitions
- GET    /definitions?module=task
- GET    /schema/:module  ← primary frontend endpoint; returns {groups:[{...fields[]}], standalone:[]}
- POST   /definitions
- PUT    /definitions/reorder
- PUT    /definitions/:id
- DELETE /definitions/:id  (blocked for is_system=true fields)

### Values
- GET    /values/:entityType/:entityId
- PUT    /values/:entityType/:entityId  (body: {values:[{field_definition_id, value_text?, ...}]}) — upserts
- DELETE /values/:entityType/:entityId/:fieldDefinitionId  (single field)
- DELETE /values/:entityType/:entityId                     (all fields for entity)

## Auth
All endpoints use `requireAnyAuthenticated` (x-user-id header check).

**Why:** Single existence guarantee (unique constraint), typed columns for future DB-level queries, JSONB for extensibility, module as text avoids enum migrations.
