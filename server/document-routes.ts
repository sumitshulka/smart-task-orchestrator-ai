import type { Express, Request, Response } from "express";
import multer from "multer";
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";
import { pool } from "./db";
import { storage } from "./storage";
import { requireProjectAccess } from "./project-settings";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });
const DRIVE_API = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD = "https://www.googleapis.com/upload/drive/v3/files";
const USERINFO = "https://www.googleapis.com/oauth2/v2/userinfo";
const GRAPH_API = "https://graph.microsoft.com/v1.0";

function encryptionKey() {
  if (!process.env.SESSION_SECRET) throw new Error("Session secret is not configured");
  return createHash("sha256").update(process.env.SESSION_SECRET).digest();
}
function encrypt(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const data = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [iv.toString("base64"), cipher.getAuthTag().toString("base64"), data.toString("base64")].join(".");
}
function decrypt(value: string) {
  const [iv, tag, data] = value.split(".").map((part) => Buffer.from(part, "base64"));
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}
function redirectUri(req: Request) {
  const proto = String(req.headers["x-forwarded-proto"] ?? req.protocol).split(",")[0].trim();
  const host = String(req.headers["x-forwarded-host"] ?? req.headers.host ?? "").split(",")[0].trim();
  return `${proto}://${host}/api/organization-settings/document-repository/google/callback`;
}
function oneDriveRedirectUri(req: Request) {
  const proto = String(req.headers["x-forwarded-proto"] ?? req.protocol).split(",")[0].trim();
  const host = String(req.headers["x-forwarded-host"] ?? req.headers.host ?? "").split(",")[0].trim();
  return `${proto}://${host}/api/organization-settings/document-repository/onedrive/callback`;
}
function signState(payload: string) {
  return createHmac("sha256", process.env.SESSION_SECRET ?? "").update(payload).digest("hex");
}
function isValidState(state: string) {
  const [payload, signature] = state.split(".");
  if (!payload || !signature) return null;
  const expected = signState(payload);
  const a = Buffer.from(signature, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (Date.now() - parsed.at > 10 * 60_000) return null;
    return parsed as { userId: string; nonce: string };
  } catch { return null; }
}
async function roleNames(userId: string) {
  const [assigned, roles] = await Promise.all([storage.getUserRoles(userId), storage.getAllRoles()]);
  return assigned.map((assignment) => roles.find((role) => role.id === assignment.role_id)?.name).filter(Boolean);
}
function requireOrganizationAdmin(req: Request, res: Response, next: (error?: unknown) => void) {
  const userId = String(req.headers["x-user-id"] ?? "");
  if (!userId) return res.status(401).json({ error: "Authentication required" });
  roleNames(userId).then((roles) => roles.includes("admin")
    ? next()
    : res.status(403).json({ error: "Organization administrator access required" }))
    .catch(() => res.status(500).json({ error: "Could not verify organization role" }));
}
async function connection() {
  const result = await pool.query("SELECT * FROM organization_document_repositories WHERE provider='google_drive' LIMIT 1");
  return result.rows[0] as any;
}
async function activeConnection() {
  const result = await pool.query("SELECT * FROM organization_document_repositories ORDER BY updated_at DESC LIMIT 1");
  return result.rows[0] as any;
}
async function oneDriveConnection() {
  const result = await pool.query("SELECT * FROM organization_document_repositories WHERE provider='onedrive' LIMIT 1");
  return result.rows[0] as any;
}
async function oauthConfig() {
  const result = await pool.query("SELECT encrypted_client_id,encrypted_client_secret FROM organization_document_repository_config WHERE provider='google_drive' LIMIT 1");
  const row = result.rows[0] as any;
  return row ? { clientId: decrypt(row.encrypted_client_id), clientSecret: decrypt(row.encrypted_client_secret) } : null;
}
async function oneDriveConfig() {
  const result = await pool.query("SELECT encrypted_client_id,encrypted_client_secret FROM organization_document_repository_config WHERE provider='onedrive' LIMIT 1");
  const row = result.rows[0] as any;
  return row ? { clientId: decrypt(row.encrypted_client_id), clientSecret: decrypt(row.encrypted_client_secret) } : null;
}
async function googleAccessToken() {
  const saved = await connection();
  if (!saved) throw new Error("Connect Google Drive in Organization Settings first");
  if (saved.expires_at && new Date(saved.expires_at).getTime() > Date.now() + 60_000) return decrypt(saved.encrypted_access_token);
  const config = await oauthConfig();
  if (!config) throw new Error("Save Google OAuth credentials in Organization Settings first");
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: decrypt(saved.encrypted_refresh_token),
      grant_type: "refresh_token",
    }),
  });
  const data = await response.json() as any;
  if (!response.ok || !data.access_token) throw new Error("Google Drive authorization expired. Reconnect it in Organization Settings.");
  await pool.query(
    "UPDATE organization_document_repositories SET encrypted_access_token=$1, expires_at=now()+($2::text || ' seconds')::interval, updated_at=now() WHERE id=$3",
    [encrypt(data.access_token), String(data.expires_in ?? 3600), saved.id],
  );
  return data.access_token as string;
}
async function driveRequest(path: string, init: RequestInit = {}) {
  const token = await googleAccessToken();
  const response = await fetch(`${DRIVE_API}${path}`, {
    ...init, headers: { Authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
  });
  const body = await response.json().catch(() => ({})) as any;
  if (!response.ok) throw new Error(body.error?.message ?? "Google Drive request failed");
  return body;
}
async function oneDriveAccessToken() {
  const saved = await oneDriveConnection();
  if (!saved) throw new Error("Connect OneDrive in Organization Settings first");
  if (saved.expires_at && new Date(saved.expires_at).getTime() > Date.now() + 60_000) return decrypt(saved.encrypted_access_token);
  const config = await oneDriveConfig();
  if (!config) throw new Error("Save Microsoft OAuth credentials in Organization Settings first");
  const response = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId, client_secret: config.clientSecret,
      refresh_token: decrypt(saved.encrypted_refresh_token), grant_type: "refresh_token",
      scope: "offline_access User.Read Files.ReadWrite",
    }),
  });
  const data = await response.json() as any;
  if (!response.ok || !data.access_token) throw new Error("OneDrive authorization expired. Reconnect it in Organization Settings.");
  await pool.query("UPDATE organization_document_repositories SET encrypted_access_token=$1,encrypted_refresh_token=$2,expires_at=now()+($3::text || ' seconds')::interval,updated_at=now() WHERE id=$4",
    [encrypt(data.access_token), encrypt(data.refresh_token ?? decrypt(saved.encrypted_refresh_token)), String(data.expires_in ?? 3600), saved.id]);
  return data.access_token as string;
}
async function oneDriveRequest(path: string, init: RequestInit = {}) {
  const response = await fetch(`${GRAPH_API}${path}`, {
    ...init, headers: { Authorization: `Bearer ${await oneDriveAccessToken()}`, ...(init.headers ?? {}) },
  });
  const body = await response.json().catch(() => ({})) as any;
  if (!response.ok) throw new Error(body.error?.message ?? "OneDrive request failed");
  return body;
}
async function createDriveFolder(name: string, parentId: string) {
  return driveRequest("/files?fields=id,name,webViewLink", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, mimeType: "application/vnd.google-apps.folder", parents: [parentId] }),
  });
}
async function shareWithProjectMembers(projectId: string, driveItemId: string) {
  const members = await storage.getProjectMembers(projectId);
  const userIds = Array.from(new Set(members
    .filter((member) => member.user_id && member.member_user_type !== "client_contact")
    .map((member) => member.user_id!)));
  const users = await Promise.all(userIds.map((id) => storage.getUser(id)));
  const emails = Array.from(new Set(users.map((user) => user?.email?.trim().toLowerCase()).filter(Boolean)));
  const repository = await activeConnection();
  for (const email of emails) {
    if (repository?.provider === "onedrive") {
      await oneDriveRequest(`/me/drive/items/${encodeURIComponent(driveItemId)}/invite`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipients: [{ email }], roles: ["read"], requireSignIn: true, sendInvitation: false }),
      });
    } else {
      await driveRequest(`/files/${encodeURIComponent(driveItemId)}/permissions?supportsAllDrives=true&sendNotificationEmail=false`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "user", role: "reader", emailAddress: email }),
      });
    }
  }
}
async function canManageProject(projectId: string, userId: string) {
  const roles = await roleNames(userId);
  if (roles.some((role) => ["admin", "manager", "team_manager"].includes(String(role)))) return true;
  const members = await storage.getProjectMembers(projectId);
  return members.some((member) => member.user_id === userId && member.member_type === "project_manager");
}

export function registerDocumentRoutes(app: Express) {
  app.get("/api/organization-settings/document-repository", requireOrganizationAdmin, async (_req, res) => {
    try {
      const saved = await activeConnection();
      const config = await oneDriveConfig();
      res.json({
        connected: saved?.provider === "onedrive",
        provider: "onedrive",
        email: saved?.connected_email ?? null,
        rootFolderUrl: saved?.root_folder_url ?? null,
        oauthConfigured: Boolean(config),
        redirectUri: oneDriveRedirectUri(_req),
      });
    } catch (error) {
      console.error("Document repository status failed", error);
      res.status(500).json({ error: "Could not load document repository status" });
    }
  });
  app.post("/api/organization-settings/document-repository/onedrive/credentials", requireOrganizationAdmin, async (req, res) => {
    const clientId = typeof req.body?.clientId === "string" ? req.body.clientId.trim() : "";
    const clientSecret = typeof req.body?.clientSecret === "string" ? req.body.clientSecret.trim() : "";
    if (clientId.length < 10 || clientId.length > 500 || clientSecret.length < 10 || clientSecret.length > 500) {
      return res.status(400).json({ error: "Enter a valid Microsoft application client ID and client secret." });
    }
    try {
      const userId = String(req.headers["x-user-id"]);
      await pool.query(
        `INSERT INTO organization_document_repository_config(provider,encrypted_client_id,encrypted_client_secret,updated_by)
         VALUES('onedrive',$1,$2,$3)
         ON CONFLICT(provider) DO UPDATE SET encrypted_client_id=EXCLUDED.encrypted_client_id,
         encrypted_client_secret=EXCLUDED.encrypted_client_secret,updated_by=EXCLUDED.updated_by,updated_at=now()`,
        [encrypt(clientId), encrypt(clientSecret), userId],
      );
      await pool.query("DELETE FROM organization_document_repositories");
      res.json({ configured: true });
    } catch (error) {
      console.error("Could not save OneDrive OAuth credentials", error);
      res.status(500).json({ error: "Could not securely save Microsoft OAuth credentials." });
    }
  });
  app.post("/api/organization-settings/document-repository/onedrive/start", requireOrganizationAdmin, async (req, res) => {
    const config = await oneDriveConfig();
    if (!config) return res.status(503).json({ error: "Microsoft OAuth credentials are not configured." });
    const payload = Buffer.from(JSON.stringify({ userId: String(req.headers["x-user-id"]), at: Date.now(), nonce: randomBytes(16).toString("hex") })).toString("base64url");
    const state = `${payload}.${signState(payload)}`;
    const url = new URL("https://login.microsoftonline.com/common/oauth2/v2.0/authorize");
    url.search = new URLSearchParams({
      client_id: config.clientId, redirect_uri: oneDriveRedirectUri(req), response_type: "code",
      response_mode: "query", scope: "offline_access User.Read Files.ReadWrite",
      prompt: "select_account", state,
    }).toString();
    res.json({ authorizationUrl: url.toString() });
  });
  app.get("/api/organization-settings/document-repository/onedrive/callback", async (req, res) => {
    const state = isValidState(String(req.query.state ?? ""));
    if (!state || !req.query.code) return res.status(400).send("OneDrive authorization state is invalid or expired.");
    try {
      const config = await oneDriveConfig();
      if (!config) throw new Error("Microsoft OAuth credentials are not configured.");
      if (!(await roleNames(state.userId)).includes("admin")) return res.status(403).send("Organization administrator access is required.");
      const tokenResponse = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
        method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code: String(req.query.code), client_id: config.clientId, client_secret: config.clientSecret,
          redirect_uri: oneDriveRedirectUri(req), grant_type: "authorization_code",
          scope: "offline_access User.Read Files.ReadWrite",
        }),
      });
      const tokens = await tokenResponse.json() as any;
      if (!tokenResponse.ok || !tokens.access_token || !tokens.refresh_token) throw new Error(tokens.error_description ?? "Microsoft did not return a refresh token.");
      const graphHeaders = { Authorization: `Bearer ${tokens.access_token}` };
      const userResponse = await fetch(`${GRAPH_API}/me?$select=displayName,mail,userPrincipalName`, { headers: graphHeaders });
      const user = await userResponse.json() as any;
      if (!userResponse.ok) throw new Error(user.error?.message ?? "Could not read the connected Microsoft account.");
      const rootResponse = await fetch(`${GRAPH_API}/me/drive/root/children?$select=id,name,webUrl,folder&$top=200`, { headers: graphHeaders });
      const rootData = await rootResponse.json() as any;
      if (!rootResponse.ok) throw new Error(rootData.error?.message ?? "Could not access the connected OneDrive.");
      let folder = (rootData.value ?? []).find((item: any) => item.name === "Project Documents" && item.folder);
      if (!folder) {
        const createResponse = await fetch(`${GRAPH_API}/me/drive/root/children`, {
          method: "POST", headers: { ...graphHeaders, "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Project Documents", folder: {}, "@microsoft.graph.conflictBehavior": "fail" }),
        });
        folder = await createResponse.json();
        if (!createResponse.ok) throw new Error(folder.error?.message ?? "Could not create the Project Documents root folder.");
      }
      await pool.query("DELETE FROM organization_document_repositories");
      await pool.query(
        `INSERT INTO organization_document_repositories(provider,connected_email,encrypted_access_token,encrypted_refresh_token,expires_at,root_folder_id,root_folder_url,connected_by)
         VALUES('onedrive',$1,$2,$3,now()+($4::text || ' seconds')::interval,$5,$6,$7)`,
        [user.mail ?? user.userPrincipalName ?? null, encrypt(tokens.access_token), encrypt(tokens.refresh_token), String(tokens.expires_in ?? 3600), folder.id, folder.webUrl ?? null, state.userId],
      );
      res.redirect("/admin/settings?tab=document-repository&connected=1");
    } catch (error: any) {
      console.error("OneDrive connection failed", error);
      res.status(502).send(error.message ?? "Could not connect OneDrive.");
    }
  });
  app.post("/api/organization-settings/document-repository/google/credentials", requireOrganizationAdmin, async (req, res) => {
    const clientId = typeof req.body?.clientId === "string" ? req.body.clientId.trim() : "";
    const clientSecret = typeof req.body?.clientSecret === "string" ? req.body.clientSecret.trim() : "";
    if (clientId.length < 10 || clientId.length > 500 || clientSecret.length < 10 || clientSecret.length > 500) {
      return res.status(400).json({ error: "Enter a valid Google OAuth client ID and client secret." });
    }
    try {
      const userId = String(req.headers["x-user-id"]);
      await pool.query(
        `INSERT INTO organization_document_repository_config(provider,encrypted_client_id,encrypted_client_secret,updated_by)
         VALUES('google_drive',$1,$2,$3)
         ON CONFLICT(provider) DO UPDATE SET encrypted_client_id=EXCLUDED.encrypted_client_id,
         encrypted_client_secret=EXCLUDED.encrypted_client_secret,updated_by=EXCLUDED.updated_by,updated_at=now()`,
        [encrypt(clientId), encrypt(clientSecret), userId],
      );
      // A changed OAuth client may invalidate stored refresh tokens. Require a fresh authorization.
      await pool.query("DELETE FROM organization_document_repositories WHERE provider='google_drive'");
      res.json({ configured: true });
    } catch (error) {
      console.error("Could not save document repository OAuth credentials", error);
      res.status(500).json({ error: "Could not securely save Google OAuth credentials." });
    }
  });
  app.post("/api/organization-settings/document-repository/google/start", requireOrganizationAdmin, async (req, res) => {
    const config = await oauthConfig();
    if (!config) {
      return res.status(503).json({ error: "Google Drive OAuth credentials are not configured." });
    }
    const payload = Buffer.from(JSON.stringify({ userId: String(req.headers["x-user-id"]), at: Date.now(), nonce: randomBytes(16).toString("hex") })).toString("base64url");
    const state = `${payload}.${signState(payload)}`;
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.search = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: redirectUri(req),
      response_type: "code",
      access_type: "offline",
      prompt: "consent",
      scope: "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email",
      state,
    }).toString();
    res.json({ authorizationUrl: url.toString(), redirectUri: redirectUri(req) });
  });
  app.get("/api/organization-settings/document-repository/google/callback", async (req, res) => {
    const state = isValidState(String(req.query.state ?? ""));
    if (!state || !req.query.code) return res.status(400).send("Google Drive authorization state is invalid or expired.");
    try {
      const config = await oauthConfig();
      if (!config) throw new Error("Google OAuth credentials are not configured.");
      if (!(await roleNames(state.userId)).includes("admin")) return res.status(403).send("Organization administrator access is required.");
      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code: String(req.query.code),
          client_id: config.clientId,
          client_secret: config.clientSecret,
          redirect_uri: redirectUri(req),
          grant_type: "authorization_code",
        }),
      });
      const tokens = await tokenResponse.json() as any;
      if (!tokenResponse.ok || !tokens.access_token || !tokens.refresh_token) throw new Error(tokens.error_description ?? "Google did not return a refresh token.");
      const userResponse = await fetch(USERINFO, { headers: { Authorization: `Bearer ${tokens.access_token}` } });
      const user = await userResponse.json() as any;
      const root = await fetch(`${DRIVE_API}/files?fields=files(id,name)&pageSize=1`, { headers: { Authorization: `Bearer ${tokens.access_token}` } });
      if (!root.ok) throw new Error("Could not access the connected Google Drive.");
      const folderResponse = await fetch(`${DRIVE_API}/files?fields=files(id,name,webViewLink)&q=${encodeURIComponent("name='Project Documents' and mimeType='application/vnd.google-apps.folder' and trashed=false")}`, { headers: { Authorization: `Bearer ${tokens.access_token}` } });
      const folderData = await folderResponse.json() as any;
      let folder = folderData.files?.[0];
      if (!folder) {
        const createResponse = await fetch(`${DRIVE_API}/files?fields=id,name,webViewLink`, {
          method: "POST", headers: { Authorization: `Bearer ${tokens.access_token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Project Documents", mimeType: "application/vnd.google-apps.folder" }),
        });
        folder = await createResponse.json();
        if (!createResponse.ok) throw new Error("Could not create the Project Documents root folder.");
      }
      await pool.query(
        `INSERT INTO organization_document_repositories(provider,connected_email,encrypted_access_token,encrypted_refresh_token,expires_at,root_folder_id,root_folder_url,connected_by)
         VALUES('google_drive',$1,$2,$3,now()+($4::text || ' seconds')::interval,$5,$6,$7)
         ON CONFLICT (provider) DO UPDATE SET connected_email=EXCLUDED.connected_email,encrypted_access_token=EXCLUDED.encrypted_access_token,
         encrypted_refresh_token=EXCLUDED.encrypted_refresh_token,expires_at=EXCLUDED.expires_at,root_folder_id=EXCLUDED.root_folder_id,
         root_folder_url=EXCLUDED.root_folder_url,connected_by=EXCLUDED.connected_by,updated_at=now()`,
        [user.email ?? null, encrypt(tokens.access_token), encrypt(tokens.refresh_token), String(tokens.expires_in ?? 3600), folder.id, folder.webViewLink ?? null, state.userId],
      );
      res.redirect("/admin/settings?tab=document-repository&connected=1");
    } catch (error: any) {
      console.error("Google Drive connection failed", error);
      res.status(502).send(error.message ?? "Could not connect Google Drive.");
    }
  });
  app.delete("/api/organization-settings/document-repository", requireOrganizationAdmin, async (_req, res) => {
    await pool.query("DELETE FROM organization_document_repositories");
    res.json({ ok: true });
  });

  app.get("/api/projects/:id/documents", requireProjectAccess(), async (req: any, res) => {
    try {
      const [docs, folder, settings] = await Promise.all([
        pool.query(`SELECT d.id,d.name,d.document_type,d.created_at,
          v.version_number,v.author,v.drive_file_url,v.uploaded_at,v.mime_type,v.size_bytes,
          COALESCE((SELECT json_agg(json_build_object(
            'version',pv.version_number,'author',pv.author,'url',pv.drive_file_url,
            'uploadedAt',pv.uploaded_at,'mimeType',pv.mime_type,'sizeBytes',pv.size_bytes
          ) ORDER BY pv.version_number DESC) FROM project_document_versions pv WHERE pv.document_id=d.id),'[]'::json) AS versions
          FROM project_documents d LEFT JOIN LATERAL
          (SELECT * FROM project_document_versions WHERE document_id=d.id ORDER BY version_number DESC LIMIT 1) v ON true
          WHERE d.project_id=$1 ORDER BY d.updated_at DESC`, [req.params.id]),
        pool.query("SELECT drive_folder_url FROM project_document_folders WHERE project_id=$1", [req.params.id]),
        pool.query("SELECT settings FROM project_settings WHERE project_id=$1", [req.params.id]),
      ]);
      res.json({ documents: docs.rows, folderUrl: folder.rows[0]?.drive_folder_url ?? null, documentTypes: settings.rows[0]?.settings?.documents?.types ?? [] });
    } catch (error) {
      console.error("Project documents load failed", error);
      res.status(500).json({ error: "Could not load project documents" });
    }
  });
  app.put("/api/projects/:id/settings/document-types", requireProjectAccess(), async (req: any, res) => {
    const userId = String(req.headers["x-user-id"] ?? "");
    if (!(await canManageProject(req.params.id, userId))) return res.status(403).json({ error: "Project Manager access required" });
    const types = req.body?.types;
    if (!Array.isArray(types) || types.length > 100 || types.some((type: unknown) => typeof type !== "string" || !type.trim() || type.length > 80)) {
      return res.status(400).json({ error: "Document types must be a list of up to 100 names (80 characters max)." });
    }
    const normalized = Array.from(new Set(types.map((type: string) => type.trim())));
    const saved = await pool.query("SELECT settings FROM project_settings WHERE project_id=$1", [req.params.id]);
    const settings = saved.rows[0]?.settings ?? {};
    settings.documents = { ...(settings.documents ?? {}), types: normalized };
    await storage.saveProjectSettings(req.params.id, settings, userId);
    res.json({ types: normalized });
  });
  app.post("/api/projects/:id/documents/folder", requireProjectAccess(), async (req: any, res) => {
    const userId = String(req.headers["x-user-id"] ?? "");
    if (!(await canManageProject(req.params.id, userId))) return res.status(403).json({ error: "Project Manager access required" });
    const existing = await pool.query("SELECT drive_folder_id,drive_folder_url FROM project_document_folders WHERE project_id=$1", [req.params.id]);
    if (existing.rows[0]) return res.json(existing.rows[0]);
    const repository = await activeConnection();
    if (!repository) return res.status(409).json({ error: "Organization admin must connect a document repository in Organization Settings first." });
    const project = await storage.getProject(req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found" });
    const folder = repository.provider === "onedrive"
      ? await oneDriveRequest(`/me/drive/items/${encodeURIComponent(repository.root_folder_id)}/children`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: project.name, folder: {}, "@microsoft.graph.conflictBehavior": "rename" }),
        })
      : await createDriveFolder(project.name, repository.root_folder_id);
    await shareWithProjectMembers(req.params.id, folder.id);
    await pool.query("INSERT INTO project_document_folders(project_id,drive_folder_id,drive_folder_url,created_by) VALUES($1,$2,$3,$4)", [req.params.id, folder.id, folder.webViewLink ?? null, userId]);
    res.status(201).json({ drive_folder_id: folder.id, drive_folder_url: folder.webViewLink ?? null });
  });
  app.post("/api/projects/:id/documents", requireProjectAccess(), upload.single("file"), async (req: any, res) => {
    try {
      const userId = String(req.headers["x-user-id"] ?? "");
      if (!(await canManageProject(req.params.id, userId))) return res.status(403).json({ error: "Project Manager access required" });
      if (!req.file) return res.status(400).json({ error: "Choose a file to upload." });
      const { name, documentType, author } = req.body;
      if (!name?.trim() || !documentType?.trim() || !author?.trim()) return res.status(400).json({ error: "Document name, type, and author are required." });
      const settings = await pool.query("SELECT settings FROM project_settings WHERE project_id=$1", [req.params.id]);
      const validTypes = settings.rows[0]?.settings?.documents?.types ?? [];
      if (!validTypes.includes(documentType.trim())) return res.status(400).json({ error: "Choose a document type configured in Project Settings." });
      const folder = await pool.query("SELECT drive_folder_id FROM project_document_folders WHERE project_id=$1", [req.params.id]);
      if (!folder.rows[0]) return res.status(409).json({ error: "Create the project folder before uploading documents." });
      const repository = await activeConnection();
      if (!repository) return res.status(409).json({ error: "Connect OneDrive in Organization Settings first." });
      let file: any;
      if (repository.provider === "onedrive") {
        const safeName = `${Date.now()}-${randomBytes(6).toString("hex")}-${String(req.file.originalname).replace(/[\\/]/g, "_")}`;
        const response = await fetch(`${GRAPH_API}/me/drive/items/${encodeURIComponent(folder.rows[0].drive_folder_id)}:/${encodeURIComponent(safeName)}:/content`, {
          method: "PUT",
          headers: { Authorization: `Bearer ${await oneDriveAccessToken()}`, "Content-Type": req.file.mimetype || "application/octet-stream" },
          body: req.file.buffer,
        });
        file = await response.json() as any;
        if (!response.ok) throw new Error(file.error?.message ?? "OneDrive upload failed.");
        file.webViewLink = file.webUrl;
        file.mimeType = file.file?.mimeType ?? req.file.mimetype;
      } else {
        const boundary = `replit_${randomBytes(12).toString("hex")}`;
        const metadata = JSON.stringify({ name: req.file.originalname, parents: [folder.rows[0].drive_folder_id] });
        const body = Buffer.concat([
          Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${req.file.mimetype || "application/octet-stream"}\r\n\r\n`),
          req.file.buffer,
          Buffer.from(`\r\n--${boundary}--`),
        ]);
        const driveToken = await googleAccessToken();
        const response = await fetch(`${DRIVE_UPLOAD}?uploadType=multipart&fields=id,name,webViewLink,mimeType,size`, {
          method: "POST",
          headers: { Authorization: `Bearer ${driveToken}`, "Content-Type": `multipart/related; boundary=${boundary}`, "Content-Length": String(body.length) },
          body,
        });
        file = await response.json() as any;
        if (!response.ok) throw new Error(file.error?.message ?? "Google Drive upload failed.");
      }
      await shareWithProjectMembers(req.params.id, file.id);
      const docKey = name.trim().toLocaleLowerCase();
      const client = await pool.connect();
      let doc: any;
      let version: number;
      try {
        await client.query("BEGIN");
        const inserted = await client.query(
          `INSERT INTO project_documents(project_id,document_key,name,document_type,created_by)
           VALUES($1,$2,$3,$4,$5) ON CONFLICT(project_id,document_key) DO NOTHING RETURNING *`,
          [req.params.id, docKey, name.trim(), documentType.trim(), userId],
        );
        doc = inserted.rows[0] ?? (await client.query(
          "SELECT * FROM project_documents WHERE project_id=$1 AND document_key=$2 FOR UPDATE", [req.params.id, docKey],
        )).rows[0];
        await client.query("UPDATE project_documents SET name=$1,document_type=$2,updated_at=now() WHERE id=$3", [name.trim(), documentType.trim(), doc.id]);
        const latest = await client.query("SELECT COALESCE(MAX(version_number),0)+1 AS next FROM project_document_versions WHERE document_id=$1", [doc.id]);
        version = Number(latest.rows[0].next);
        await client.query(
          "INSERT INTO project_document_versions(document_id,version_number,author,drive_file_id,drive_file_url,mime_type,size_bytes,uploaded_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
          [doc.id, version, author.trim(), file.id, file.webViewLink ?? `https://drive.google.com/open?id=${file.id}`, file.mimeType ?? req.file.mimetype, Number(file.size ?? req.file.size), userId],
        );
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
      res.status(201).json({ id: doc.id, name: doc.name, documentType, author, version: `${version}.0`, url: file.webViewLink });
    } catch (error: any) {
      console.error("Document upload failed", error);
      res.status(500).json({ error: error.message ?? "Could not upload document." });
    }
  });
}
