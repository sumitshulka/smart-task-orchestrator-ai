import React, { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  MessageSquare, Paperclip, CheckSquare, Activity, Send,
  Smile, Pencil, Trash2, Plus, X, ChevronDown, ChevronUp,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

// ── Types ─────────────────────────────────────────────────────────────────────
interface WsAuthor { id: string; user_name: string; email: string; }
interface WsReaction { id: string; message_id: string; user_id: string; emoji: string; }
interface WsMessage {
  id: string; entity_type: string; entity_id: string; author_id: string;
  content: string; is_edited: boolean; is_deleted: boolean;
  created_at: string; updated_at: string;
  author: WsAuthor | null; reactions: WsReaction[];
}
interface WsDecision {
  id: string; entity_type: string; entity_id: string; title: string;
  description: string | null; approved_by: string | null; status: string;
  created_by: string; created_at: string;
}
interface WsAttachment {
  id: string; entity_type: string; entity_id: string; message_id: string | null;
  uploaded_by: string; file_name: string; file_type: string;
  file_size: number | null; file_url: string; created_at: string;
}
interface WorkspaceData {
  messages: WsMessage[];
  decisions: WsDecision[];
  attachments: WsAttachment[];
}

type FeedItem =
  | { kind: "message"; ts: string; data: WsMessage }
  | { kind: "decision"; ts: string; data: WsDecision }
  | { kind: "attachment"; ts: string; data: WsAttachment };

type Filter = "all" | "messages" | "decisions" | "files";

const QUICK_EMOJIS = ["👍", "✅", "❤️", "😊", "🔥", "👀"];

function getInitials(name: string) {
  return name.split(" ").map(p => p[0]?.toUpperCase()).slice(0, 2).join("");
}

const STATUS_STYLES: Record<string, string> = {
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  pending:  "bg-yellow-100 text-yellow-700",
};

// ── Main Component ─────────────────────────────────────────────────────────────
interface Props {
  entityType: "task" | "project" | "milestone" | "defect";
  entityId: string;
}

const WorkspaceTab: React.FC<Props> = ({ entityType, entityId }) => {
  const { user } = useAuth();
  const feedBottomRef = useRef<HTMLDivElement>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [compose, setCompose] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [showEmojiFor, setShowEmojiFor] = useState<string | null>(null);
  const [decisionModal, setDecisionModal] = useState(false);
  const [decisionForm, setDecisionForm] = useState({ title: "", description: "", status: "pending" });
  const [titleError, setTitleError] = useState("");

  const queryKey = [`/api/workspace/${entityType}/${entityId}`];

  const { data, isLoading } = useQuery<WorkspaceData>({ queryKey });

  // scroll to bottom when new messages arrive
  useEffect(() => {
    if (data) feedBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [data?.messages?.length]);

  // ── Mutations ─────────────────────────────────────────────────────────────
  const postMsg = useMutation({
    mutationFn: (content: string) =>
      apiRequest(`/api/workspace/${entityType}/${entityId}/messages`, { method: "POST", body: JSON.stringify({ content }) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey }); setCompose(""); },
    onError: () => toast({ title: "Failed to send message", variant: "destructive" }),
  });

  const editMsg = useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) =>
      apiRequest(`/api/workspace/messages/${id}`, { method: "PATCH", body: JSON.stringify({ content }) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey }); setEditingId(null); },
    onError: () => toast({ title: "Failed to edit message", variant: "destructive" }),
  });

  const deleteMsg = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/workspace/messages/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    onError: () => toast({ title: "Failed to delete message", variant: "destructive" }),
  });

  const react = useMutation({
    mutationFn: ({ id, emoji }: { id: string; emoji: string }) =>
      apiRequest(`/api/workspace/messages/${id}/reactions`, { method: "POST", body: JSON.stringify({ emoji }) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey }); setShowEmojiFor(null); },
    onError: () => toast({ title: "Failed to add reaction", variant: "destructive" }),
  });

  const postDecision = useMutation({
    mutationFn: (body: typeof decisionForm) =>
      apiRequest(`/api/workspace/${entityType}/${entityId}/decisions`, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      setDecisionModal(false);
      setDecisionForm({ title: "", description: "", status: "pending" });
      setTitleError("");
      toast({ title: "Decision recorded" });
    },
    onError: (err: any) => toast({ title: "Failed to save decision", description: err?.message ?? "Please try again.", variant: "destructive" }),
  });

  const deleteDecision = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/workspace/decisions/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    onError: () => toast({ title: "Failed to delete decision", variant: "destructive" }),
  });

  const updateDecisionStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiRequest(`/api/workspace/decisions/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  // ── Build unified feed ────────────────────────────────────────────────────
  const feed: FeedItem[] = [];
  if (data) {
    for (const m of data.messages) feed.push({ kind: "message", ts: m.created_at, data: m });
    for (const d of data.decisions) feed.push({ kind: "decision", ts: d.created_at, data: d });
    for (const a of data.attachments) feed.push({ kind: "attachment", ts: a.created_at, data: a });
  }
  feed.sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());

  const filtered = feed.filter(item => {
    if (filter === "all") return true;
    if (filter === "messages") return item.kind === "message";
    if (filter === "decisions") return item.kind === "decision";
    if (filter === "files") return item.kind === "attachment";
    return true;
  });

  // ── Render helpers ────────────────────────────────────────────────────────
  const renderReactions = (msg: WsMessage) => {
    const grouped: Record<string, number> = {};
    for (const r of msg.reactions) grouped[r.emoji] = (grouped[r.emoji] ?? 0) + 1;
    const myReactions = new Set(msg.reactions.filter(r => r.user_id === user?.id).map(r => r.emoji));
    return (
      <div className="flex flex-wrap gap-1 mt-1">
        {Object.entries(grouped).map(([emoji, count]) => (
          <button
            key={emoji}
            onClick={() => react.mutate({ id: msg.id, emoji })}
            className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs border transition-colors
              ${myReactions.has(emoji) ? "bg-indigo-100 border-indigo-300 text-indigo-700" : "bg-gray-100 border-gray-200 text-gray-600 hover:bg-gray-200"}`}
          >
            {emoji} {count}
          </button>
        ))}
        <div className="relative">
          <button
            onClick={() => setShowEmojiFor(showEmojiFor === msg.id ? null : msg.id)}
            className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs border border-gray-200 text-gray-400 hover:bg-gray-100 transition-colors"
          >
            <Smile className="w-3 h-3" />
          </button>
          {showEmojiFor === msg.id && (
            <div className="absolute bottom-7 left-0 bg-white border border-gray-200 rounded-xl shadow-lg p-1.5 flex gap-1 z-50">
              {QUICK_EMOJIS.map(e => (
                <button key={e} onClick={() => react.mutate({ id: msg.id, emoji: e })}
                  className="text-base hover:scale-125 transition-transform px-1">{e}</button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderMessage = (msg: WsMessage) => {
    const isMine = msg.author_id === user?.id;
    const isDeleted = msg.is_deleted;
    return (
      <div key={msg.id} className={`flex gap-3 ${isMine ? "flex-row-reverse" : ""}`}>
        <Avatar className="h-8 w-8 flex-shrink-0 mt-0.5">
          <AvatarFallback className="bg-indigo-600 text-white text-xs">
            {getInitials(msg.author?.user_name ?? msg.author?.email ?? "?")}
          </AvatarFallback>
        </Avatar>
        <div className={`max-w-[75%] ${isMine ? "items-end" : "items-start"} flex flex-col`}>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-xs font-medium text-gray-700">
              {msg.author?.user_name ?? msg.author?.email ?? "Unknown"}
            </span>
            <span className="text-[10px] text-gray-400">
              {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
              {msg.is_edited && !isDeleted && <span className="ml-1 italic">(edited)</span>}
            </span>
          </div>

          {editingId === msg.id ? (
            <div className="flex flex-col gap-1 w-full">
              <Textarea
                value={editContent}
                onChange={e => setEditContent(e.target.value)}
                className="text-sm min-h-[60px]"
                autoFocus
              />
              <div className="flex gap-1">
                <Button size="sm" className="h-7 text-xs" onClick={() => editMsg.mutate({ id: msg.id, content: editContent })}>Save</Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingId(null)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <div className={`px-3 py-2 rounded-2xl text-sm leading-relaxed
              ${isDeleted ? "bg-gray-100 text-gray-400 italic" : isMine ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-800"}`}>
              {isDeleted ? "This message was deleted" : msg.content}
            </div>
          )}

          {!isDeleted && !editingId && (
            <div className="flex items-center gap-1 mt-0.5">
              {renderReactions(msg)}
              {isMine && (
                <>
                  <button onClick={() => { setEditingId(msg.id); setEditContent(msg.content); }}
                    className="p-1 text-gray-400 hover:text-gray-600 transition-colors">
                    <Pencil className="w-3 h-3" />
                  </button>
                  <button onClick={() => deleteMsg.mutate(msg.id)}
                    className="p-1 text-gray-400 hover:text-red-500 transition-colors">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderDecision = (d: WsDecision) => (
    <div key={d.id} className="border border-amber-200 bg-amber-50 rounded-xl p-3 flex items-start gap-3">
      <CheckSquare className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-gray-800">{d.title}</span>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_STYLES[d.status] ?? STATUS_STYLES.pending}`}>
            {d.status}
          </span>
          <span className="text-[10px] text-gray-400 ml-auto">
            {formatDistanceToNow(new Date(d.created_at), { addSuffix: true })}
          </span>
        </div>
        {d.description && <p className="text-xs text-gray-600 mt-1">{d.description}</p>}
        <div className="flex gap-1 mt-2 flex-wrap">
          {["pending","approved","rejected"].filter(s => s !== d.status).map(s => (
            <button key={s} onClick={() => updateDecisionStatus.mutate({ id: d.id, status: s })}
              className="text-[10px] px-2 py-0.5 rounded-full border border-gray-300 hover:bg-gray-100 text-gray-600 transition-colors capitalize">
              Mark {s}
            </button>
          ))}
          {d.created_by === user?.id && (
            <button onClick={() => deleteDecision.mutate(d.id)}
              className="text-[10px] px-2 py-0.5 rounded-full border border-red-200 text-red-500 hover:bg-red-50 transition-colors ml-auto">
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );

  const renderAttachment = (a: WsAttachment) => {
    const isImage = a.file_type.startsWith("image/");
    return (
      <div key={a.id} className="border border-gray-200 bg-white rounded-xl p-3 flex items-center gap-3">
        <Paperclip className="w-4 h-4 text-gray-400 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <a href={a.file_url} target="_blank" rel="noreferrer"
            className="text-sm font-medium text-indigo-600 hover:underline truncate block">
            {a.file_name}
          </a>
          <span className="text-[10px] text-gray-400">
            {a.file_type} {a.file_size ? `· ${Math.round(a.file_size / 1024)} KB` : ""}
            {" · "}{formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
          </span>
        </div>
        {isImage && (
          <img src={a.file_url} alt={a.file_name} className="h-10 w-10 rounded object-cover flex-shrink-0" />
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full min-h-[500px]">
      {/* ── Filter pills ── */}
      <div className="flex items-center gap-2 pb-3 flex-wrap">
        {([
          { key: "all", label: "All", icon: <Activity className="w-3 h-3" /> },
          { key: "messages", label: "Messages", icon: <MessageSquare className="w-3 h-3" /> },
          { key: "decisions", label: "Decisions", icon: <CheckSquare className="w-3 h-3" /> },
          { key: "files", label: "Files", icon: <Paperclip className="w-3 h-3" /> },
        ] as { key: Filter; label: string; icon: React.ReactNode }[]).map(({ key, label, icon }) => (
          <button key={key} onClick={() => setFilter(key)}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-colors
              ${filter === key ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-600 border-gray-200 hover:border-indigo-300 hover:text-indigo-600"}`}>
            {icon}{label}
          </button>
        ))}
        <button onClick={() => setDecisionModal(true)}
          className="ml-auto inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors">
          <Plus className="w-3 h-3" />Add Decision
        </button>
      </div>

      {/* ── Feed ── */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1 pb-2 min-h-[300px] max-h-[420px]">
        {isLoading && (
          <div className="flex items-center justify-center py-12 text-gray-400 text-sm">Loading workspace…</div>
        )}
        {!isLoading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400 text-sm gap-2">
            <MessageSquare className="w-8 h-8 opacity-30" />
            <span>No {filter === "all" ? "activity" : filter} yet. Start the conversation.</span>
          </div>
        )}
        {filtered.map(item => {
          if (item.kind === "message") return renderMessage(item.data);
          if (item.kind === "decision") return renderDecision(item.data);
          if (item.kind === "attachment") return renderAttachment(item.data);
          return null;
        })}
        <div ref={feedBottomRef} />
      </div>

      {/* ── Compose bar ── */}
      <div className="pt-3 border-t border-gray-100">
        <div className="flex gap-2 items-end">
          <Textarea
            value={compose}
            onChange={e => setCompose(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey && compose.trim()) {
                e.preventDefault();
                postMsg.mutate(compose.trim());
              }
            }}
            placeholder="Type a message… (Enter to send, Shift+Enter for new line)"
            className="resize-none text-sm min-h-[60px] flex-1"
          />
          <Button
            size="sm"
            disabled={!compose.trim() || postMsg.isPending}
            onClick={() => compose.trim() && postMsg.mutate(compose.trim())}
            className="h-10 px-4 bg-indigo-600 hover:bg-indigo-700"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* ── Add Decision Modal ── */}
      <Dialog open={decisionModal} onOpenChange={setDecisionModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-amber-600" />
              Record a Decision
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Title *</label>
              <Input
                value={decisionForm.title}
                onChange={e => { setDecisionForm(f => ({ ...f, title: e.target.value })); setTitleError(""); }}
                placeholder="e.g. Deployment moved to Friday"
                className={titleError ? "border-red-400 focus-visible:ring-red-300" : ""}
              />
              {titleError && <p className="text-xs text-red-500 mt-1">{titleError}</p>}
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Details</label>
              <Textarea
                value={decisionForm.description}
                onChange={e => setDecisionForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Context or rationale…"
                className="min-h-[70px]"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Status</label>
              <div className="flex gap-2">
                {["pending","approved","rejected"].map(s => (
                  <button key={s} onClick={() => setDecisionForm(f => ({ ...f, status: s }))}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors capitalize
                      ${decisionForm.status === s ? (STATUS_STYLES[s] ?? "") + " border-current" : "border-gray-200 text-gray-500 hover:border-gray-300"}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setDecisionModal(false); setTitleError(""); }}>Cancel</Button>
            <Button
              disabled={postDecision.isPending}
              onClick={() => {
                if (!decisionForm.title.trim()) {
                  setTitleError("A title is required to save a decision.");
                  return;
                }
                postDecision.mutate(decisionForm);
              }}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {postDecision.isPending ? "Saving…" : "Save Decision"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WorkspaceTab;
