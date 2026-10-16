---
name: Document Repository Provider
description: Why the application uses OneDrive rather than Google Drive for document repository testing.
---

Support Google Drive and Microsoft OneDrive as independent organization repository connections. The user wants multiple providers, not OneDrive replacing Google Drive. Each project must retain the provider selected when its repository folder is created.

**Why:** Google OAuth testing requires a Google or Google Workspace test user, while the organization administrator's account is not managed in Google. The user chose OneDrive as an additional provider and explicitly corrected a replacement-only design.

**How to apply:** Provider credential saves, OAuth callbacks, and disconnect actions must affect only the selected provider. Preserve existing provider connections and project-folder mappings when another provider is added.
