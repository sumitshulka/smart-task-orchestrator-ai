---
name: Test Case Module
description: Project test-case authoring, AI generation, execution history, audit, closure, and defect linkage.
---

Test cases are requirement-level records linked to optional features and user stories; each execution is an immutable result row with execution number, pass/fail result, comment, tester, timestamp, and optional generated defect.

**Why:** Overwriting the current result loses the audit trail and prevents QA from showing repeated runs before closure.

**How to apply:** Update the test case's latest status for release readiness, but preserve every execution row and only allow closure after a passed result.

AI-generated cases are saved as editable draft-like records with source metadata; manual creation remains available regardless of AI availability.

**Why:** AI should accelerate authoring without bypassing review or requiring an AI service for core QA work.

**How to apply:** Scope AI input to project features/user stories, validate returned links, and expose the same edit and execution workflow for manual and AI-created cases.