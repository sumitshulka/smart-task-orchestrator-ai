import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, FolderPlus, Upload } from "lucide-react";
import { apiClient } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Version = { version: number; author: string; url: string; uploadedAt: string; sizeBytes: number | null };
type DocumentRow = { id: string; name: string; document_type: string; version_number: number; author: string; drive_file_url: string; uploaded_at: string; versions: Version[] };
type DocumentData = { documents: DocumentRow[]; folderUrl: string | null; documentTypes: string[] };

export default function ProjectDocumentsPanel({ projectId }: { projectId: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [documentType, setDocumentType] = useState("");
  const [author, setAuthor] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const queryKey = ["/api/projects", projectId, "documents"];
  const { data, isLoading, isError } = useQuery<DocumentData>({
    queryKey,
    queryFn: () => apiClient.get(`/projects/${projectId}/documents`),
  });
  const createFolder = useMutation({
    mutationFn: () => apiClient.post(`/projects/${projectId}/documents/folder`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    onError: (error: Error) => toast({ title: "Could not create project folder", description: error.message, variant: "destructive" }),
  });
  const uploadDocument = useMutation({
    mutationFn: () => {
      if (!file) throw new Error("Choose a file to upload.");
      const body = new FormData();
      body.append("file", file);
      body.append("name", name);
      body.append("documentType", documentType);
      body.append("author", author);
      return apiClient.post(`/projects/${projectId}/documents`, body);
    },
    onSuccess: () => {
      setName(""); setAuthor(""); setFile(null);
      queryClient.invalidateQueries({ queryKey });
      toast({ title: "Document uploaded" });
    },
    onError: (error: Error) => toast({ title: "Could not upload document", description: error.message, variant: "destructive" }),
  });

  if (isLoading) return <div className="animate-pulse rounded-xl bg-muted p-10" />;
  if (isError || !data) return <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Project Documents could not be loaded.</CardContent></Card>;

  return <div className="space-y-5">
    <header><p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">Repository</p><h2 className="mt-1 text-2xl font-semibold">Project Documents</h2><p className="mt-1 text-sm text-muted-foreground">Files are stored in the organization’s Google Drive. New uploads to an existing document create a numbered version.</p></header>
    <Card>
      <CardHeader><CardTitle className="text-base">Project folder</CardTitle><CardDescription>The folder is created inside the organization repository connected in Settings.</CardDescription></CardHeader>
      <CardContent className="flex flex-wrap items-center justify-between gap-3">
        {data.folderUrl ? <a href={data.folderUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm text-primary underline">Open project folder <ExternalLink className="h-4 w-4" /></a> : <p className="text-sm text-muted-foreground">No project folder has been created yet.</p>}
        {!data.folderUrl && <Button onClick={() => createFolder.mutate()} disabled={createFolder.isPending}><FolderPlus className="mr-2 h-4 w-4" />{createFolder.isPending ? "Creating…" : "Create project folder"}</Button>}
      </CardContent>
    </Card>
    <Card>
      <CardHeader><CardTitle className="text-base">Upload document</CardTitle><CardDescription>Maximum file size: 25 MB. Configure document types in Project Settings → Project Documents.</CardDescription></CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5"><Label htmlFor="project-document-name">Document name</Label><Input id="project-document-name" value={name} maxLength={180} onChange={(event) => setName(event.target.value)} placeholder="e.g. System requirements" /></div>
        <div className="space-y-1.5"><Label>Document type</Label><Select value={documentType} onValueChange={setDocumentType}><SelectTrigger><SelectValue placeholder="Choose a type" /></SelectTrigger><SelectContent>{data.documentTypes.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-1.5"><Label htmlFor="project-document-author">Author</Label><Input id="project-document-author" value={author} maxLength={180} onChange={(event) => setAuthor(event.target.value)} placeholder="Document author" /></div>
        <div className="space-y-1.5"><Label htmlFor="project-document-file">File</Label><Input id="project-document-file" type="file" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></div>
        {!data.documentTypes.length && <p className="text-sm text-amber-700 sm:col-span-2">A Project Manager must add at least one document type in Project Settings before uploading.</p>}
        <div className="sm:col-span-2"><Button onClick={() => uploadDocument.mutate()} disabled={!data.folderUrl || !name.trim() || !documentType || !author.trim() || !file || uploadDocument.isPending}><Upload className="mr-2 h-4 w-4" />{uploadDocument.isPending ? "Uploading…" : "Upload document"}</Button></div>
      </CardContent>
    </Card>
    <Card>
      <CardHeader><CardTitle className="text-base">Documents</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {data.documents.length ? data.documents.map((doc) => <div key={doc.id} className="rounded-lg border p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><p className="font-medium">{doc.name}</p><p className="text-sm text-muted-foreground">{doc.document_type} · Author: {doc.author ?? "—"} · Updated {doc.uploaded_at ? new Date(doc.uploaded_at).toLocaleDateString() : "—"}</p></div>
            {doc.drive_file_url && <a href={doc.drive_file_url} target="_blank" rel="noreferrer"><Button type="button" variant="outline" size="sm">Open latest <ExternalLink className="ml-2 h-3.5 w-3.5" /></Button></a>}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">{(doc.versions ?? []).map((version) => <a key={version.version} href={version.url} target="_blank" rel="noreferrer"><Badge variant="secondary" className="cursor-pointer">v{version.version}.0 · {version.author}</Badge></a>)}</div>
        </div>) : <p className="py-8 text-center text-sm text-muted-foreground">No documents uploaded yet.</p>}
      </CardContent>
    </Card>
  </div>;
}
