---
name: Planning Module Architecture
description: Durable constraints and decisions for the planning module (phases/stages/milestones/features/stories/deps).
---

# Planning Module — Durable Decisions

## Authorization: Router-level middleware pattern
All planning routes are mounted on a single Express Router at `/api/projects/:projectId/planning`. `requireAuth` + `requireProjectMember` are applied once as router-level middleware — no individual route can accidentally skip auth.

**Why:** Previous approach of applying middleware per-route was error-prone; several routes were missed in code review, causing repeated rejections.

**How to apply:** When adding new planning routes, register them on the `router` object (not `app`); they automatically inherit the auth chain.

## Authentication: Session-based identity only
`getVerifiedUserId(req)` reads `req.session.userId` only — no `x-user-id` header fallback. The session is set by `/api/auth/login` as an httpOnly cookie.

**Why:** The `x-user-id` header is caller-supplied and can be forged. Session identity is server-verified.

**How to apply:** Any new code that needs the current user ID in a planning route must call `getVerifiedUserId(req)`, not `req.headers["x-user-id"]`.

## Dependency POST: source/target ownership validation
Before inserting a dependency, `itemBelongsToProject(id, type, projectId)` is called for both source and target. An unknown entity type returns `false` (reject). This prevents cross-project IDOR where a member of project A supplies UUIDs from project B.

**Why:** The dep table only scopes `project_id` at the dep row level; without item-level validation, any member could create deps referencing foreign items.

## Dependency ops: removals before additions
When `applyDeps` processes a pending queue of dep changes, it runs all DELETEs before all POSTs.

**Why:** If a PM removes FS and adds SS to the same predecessor, a POST-before-DELETE sequence hits a 409 (duplicate) and the subsequent DELETE leaves the DB in a broken state.

## DB migration pattern
Schema changes require a migration script (`db:migrate`) — never `db:push` in production. The planning tables (7 new tables + columns on milestones/features/feature_groups) were introduced this way.
