---
name: Document Repository Provider
description: Why the application uses OneDrive rather than Google Drive for document repository testing.
---

Use Microsoft OneDrive for the current document repository test flow. The organization administrator's account is not eligible for the Google OAuth test-user setup, so the user chose OneDrive instead.

**Why:** Google OAuth testing required a Google or Google Workspace test user; the user's current application admin account is not managed in Google.

**How to apply:** Keep OneDrive available for testing with personal or organizational Microsoft accounts. Do not switch the active test provider back to Google or another provider unless the user asks.
