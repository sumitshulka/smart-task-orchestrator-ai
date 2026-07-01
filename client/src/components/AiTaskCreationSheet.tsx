import React, { useState, useRef, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Send, Sparkles, User, Bot, Loader2, CheckCircle2,
  Calendar, Flag, Users, FileText, AlertTriangle, Edit2, Plus,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { apiClient } from "@/lib/api";
import { useUsersAndTeams } from "@/hooks/useUsersAndTeams";
import { useTaskStatuses } from "@/hooks/useTaskStatuses";
import { useQueryClient } from "@tanstack/react-query";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface TaskPreview {
  title: string;
  description?: string | null;
  assigned_to: string;
  priority: number;
  due_date?: string | null;
  status_name?: string;
  type?: string;
}

const PRIORITY_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: "Critical", color: "text-red-600" },
  2: { label: "High", color: "text-orange-500" },
  3: { label: "Medium", color: "text-yellow-600" },
  4: { label: "Low", color: "text-blue-500" },
  5: { label: "Minimal", color: "text-gray-500" },
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onTaskCreated?: () => void;
  currentUserId?: string;
}

const AiTaskCreationSheet: React.FC<Props> = ({ open, onOpenChange, onTaskCreated, currentUserId }) => {
  const qc = useQueryClient();
  const { users } = useUsersAndTeams();
  const { statuses } = useTaskStatuses();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [taskPreview, setTaskPreview] = useState<TaskPreview | null>(null);
  const [previewEdits, setPreviewEdits] = useState<Partial<TaskPreview>>({});
  const [creating, setCreating] = useState(false);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionStart, setMentionStart] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Reset on open
  useEffect(() => {
    if (open) {
      setMessages([
        {
          role: "assistant",
          content:
            "Hi! I can help you create a task. Tell me what you need — for example: \"Create a task for John to review the Q3 report by next Friday.\" You can also type @ to mention a user.",
        },
      ]);
      setInput("");
      setTaskPreview(null);
      setPreviewEdits({});
      setLoading(false);
    }
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, taskPreview]);

  const getUserName = (id: string) => {
    const u = users.find((u: any) => u.id === id);
    if (!u) return id;
    return u.user_name || u.email || id;
  };

  const getInitials = (id: string) => {
    const name = getUserName(id);
    return name
      .split(" ")
      .slice(0, 2)
      .map((w: string) => w[0])
      .join("")
      .toUpperCase();
  };

  // @ mention detection
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInput(val);

    const cursor = e.target.selectionStart ?? val.length;
    const textBefore = val.slice(0, cursor);
    const atIdx = textBefore.lastIndexOf("@");

    if (atIdx !== -1 && !textBefore.slice(atIdx).includes(" ")) {
      setMentionQuery(textBefore.slice(atIdx + 1));
      setMentionStart(atIdx);
      setShowMentions(true);
    } else {
      setShowMentions(false);
    }
  };

  const insertMention = (user: any) => {
    const name = user.user_name || user.email || "";
    const before = input.slice(0, mentionStart);
    const after = input.slice(inputRef.current?.selectionStart ?? input.length);
    setInput(before + "@" + name + " " + after);
    setShowMentions(false);
    inputRef.current?.focus();
  };

  const filteredMentions = users.filter((u: any) => {
    const name = (u.user_name || u.email || "").toLowerCase();
    return name.includes(mentionQuery.toLowerCase());
  });

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const newMessages: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(newMessages);
    setInput("");
    setShowMentions(false);
    setLoading(true);

    try {
      const res = await apiClient.post("/ai/chat", {
        messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
      });

      if (res.type === "task_preview") {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: res.message || "Here's the task I'll create:" },
        ]);
        setTaskPreview(res.task);
        setPreviewEdits({});
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: res.message || "(empty response)" },
        ]);
      }
    } catch (err: any) {
      const msg = err?.message || "Something went wrong. Please try again.";
      setMessages((prev) => [...prev, { role: "assistant", content: `⚠️ ${msg}` }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
    if (e.key === "Escape") setShowMentions(false);
  };

  const mergedTask = { ...taskPreview, ...previewEdits } as TaskPreview;

  const createTask = async () => {
    if (!mergedTask.title || !mergedTask.assigned_to) {
      toast({ title: "Task missing required fields", variant: "destructive" });
      return;
    }

    setCreating(true);
    try {
      // Map status_name to status id
      const statusObj = statuses.find((s: any) =>
        s.name?.toLowerCase() === mergedTask.status_name?.toLowerCase()
      ) ?? statuses[0];

      const assignedUser = users.find((u: any) => u.id === mergedTask.assigned_to);

      // Check if any required CF fields exist — if so, flag the task for review
      let hasRequiredCfFields = false;
      try {
        const cfDefs: any[] = await apiClient.get("/custom-fields/definitions?module=task");
        hasRequiredCfFields = Array.isArray(cfDefs) && cfDefs.some((f: any) => f.is_required && f.is_active !== false);
      } catch { /* ignore — if check fails, default to false */ }

      await apiClient.post("/tasks", {
        title: mergedTask.title,
        description: mergedTask.description ?? null,
        assigned_to: mergedTask.assigned_to,
        assigned_by: currentUserId ?? null,
        created_by: currentUserId ?? mergedTask.assigned_to,
        priority: mergedTask.priority ?? 3,
        due_date: mergedTask.due_date ?? null,
        status: statusObj?.name ?? "Open",
        type: mergedTask.type ?? "team",
        team_id: assignedUser?.team_id ?? null,
        is_ai_created: true,
        needs_cf_review: hasRequiredCfFields,
      });

      qc.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({ title: "Task created successfully" });
      onTaskCreated?.();
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Failed to create task", description: err.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const editPreview = (field: keyof TaskPreview, value: any) => {
    setPreviewEdits((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl flex flex-col p-0"
      >
        {/* Header */}
        <SheetHeader className="px-6 py-4 border-b flex-shrink-0">
          <SheetTitle className="flex items-center gap-2">
            <Sparkles size={18} className="text-purple-500" />
            AI Task Creation
          </SheetTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            Describe your task in plain language. I'll ask for any missing details.
          </p>
        </SheetHeader>

        {/* Chat Area */}
        <ScrollArea className="flex-1 px-4 py-4 overflow-y-auto">
          <div className="space-y-4">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
              >
                <div
                  className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-white text-xs ${
                    msg.role === "user" ? "bg-blue-500" : "bg-purple-500"
                  }`}
                >
                  {msg.role === "user" ? <User size={14} /> : <Bot size={14} />}
                </div>
                <div
                  className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-blue-500 text-white rounded-tr-none"
                      : "bg-muted rounded-tl-none"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex gap-2.5">
                <div className="flex-shrink-0 w-7 h-7 rounded-full bg-purple-500 flex items-center justify-center">
                  <Bot size={14} className="text-white" />
                </div>
                <div className="bg-muted rounded-2xl rounded-tl-none px-3.5 py-3 flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Thinking…</span>
                </div>
              </div>
            )}

            {/* Task Preview Card */}
            {taskPreview && !loading && (
              <Card className="border-2 border-purple-200 dark:border-purple-900 bg-purple-50/50 dark:bg-purple-950/20">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-purple-700 dark:text-purple-300">
                    <CheckCircle2 size={16} />
                    Task Preview
                    <Badge variant="outline" className="ml-auto text-xs">
                      Review &amp; edit before creating
                    </Badge>
                  </div>

                  <Separator className="bg-purple-200 dark:bg-purple-800" />

                  {/* Title */}
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground flex items-center gap-1">
                      <FileText size={11} /> Title *
                    </label>
                    <input
                      className="w-full text-sm font-medium bg-white dark:bg-background border rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-purple-400"
                      value={mergedTask.title ?? ""}
                      onChange={(e) => editPreview("title", e.target.value)}
                    />
                  </div>

                  {/* Description */}
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground flex items-center gap-1">
                      <Edit2 size={11} /> Description
                    </label>
                    <textarea
                      rows={2}
                      className="w-full text-sm bg-white dark:bg-background border rounded px-2 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-purple-400"
                      value={mergedTask.description ?? ""}
                      onChange={(e) => editPreview("description", e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {/* Assigned To */}
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground flex items-center gap-1">
                        <User size={11} /> Assigned To *
                      </label>
                      <select
                        className="w-full text-sm bg-white dark:bg-background border rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-purple-400"
                        value={mergedTask.assigned_to ?? ""}
                        onChange={(e) => editPreview("assigned_to", e.target.value)}
                      >
                        <option value="">Select user…</option>
                        {users.filter((u: any) => u.is_active).map((u: any) => (
                          <option key={u.id} value={u.id}>
                            {u.user_name || u.email}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Priority */}
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground flex items-center gap-1">
                        <Flag size={11} /> Priority
                      </label>
                      <select
                        className="w-full text-sm bg-white dark:bg-background border rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-purple-400"
                        value={mergedTask.priority ?? 3}
                        onChange={(e) => editPreview("priority", parseInt(e.target.value))}
                      >
                        {Object.entries(PRIORITY_LABELS).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Due Date */}
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar size={11} /> Due Date
                      </label>
                      <input
                        type="date"
                        className="w-full text-sm bg-white dark:bg-background border rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-purple-400"
                        value={mergedTask.due_date ?? ""}
                        onChange={(e) => editPreview("due_date", e.target.value || null)}
                      />
                    </div>

                    {/* Type */}
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground flex items-center gap-1">
                        <Users size={11} /> Type
                      </label>
                      <select
                        className="w-full text-sm bg-white dark:bg-background border rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-purple-400"
                        value={mergedTask.type ?? "team"}
                        onChange={(e) => editPreview("type", e.target.value)}
                      >
                        <option value="team">Team</option>
                        <option value="personal">Personal</option>
                      </select>
                    </div>
                  </div>

                  {/* Assigned user display */}
                  {mergedTask.assigned_to && (
                    <div className="flex items-center gap-2 pt-1">
                      <Avatar className="w-6 h-6">
                        <AvatarFallback className="text-xs bg-blue-100 text-blue-700">
                          {getInitials(mergedTask.assigned_to)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-xs text-muted-foreground">
                        Assigned to{" "}
                        <strong className="text-foreground">
                          {getUserName(mergedTask.assigned_to)}
                        </strong>
                      </span>
                      <span
                        className={`ml-auto text-xs font-medium ${
                          PRIORITY_LABELS[mergedTask.priority ?? 3]?.color
                        }`}
                      >
                        {PRIORITY_LABELS[mergedTask.priority ?? 3]?.label} priority
                      </span>
                    </div>
                  )}

                  <Separator className="bg-purple-200 dark:bg-purple-800" />

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1 bg-purple-600 hover:bg-purple-700 gap-1.5"
                      onClick={createTask}
                      disabled={creating}
                    >
                      {creating ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Plus size={14} />
                      )}
                      Create Task
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setTaskPreview(null);
                        setPreviewEdits({});
                        setMessages((prev) => [
                          ...prev,
                          {
                            role: "assistant",
                            content:
                              "No problem! Let me know if you'd like to change anything about the task.",
                          },
                        ]);
                      }}
                    >
                      Revise
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <div ref={bottomRef} />
          </div>
        </ScrollArea>

        {/* Input Area */}
        <div className="flex-shrink-0 border-t px-4 py-3 space-y-2">
          {/* @ mention popover */}
          {showMentions && filteredMentions.length > 0 && (
            <div className="bg-white dark:bg-background border rounded-lg shadow-lg max-h-36 overflow-y-auto">
              {filteredMentions.slice(0, 8).map((u: any) => (
                <button
                  key={u.id}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center gap-2"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    insertMention(u);
                  }}
                >
                  <Avatar className="w-5 h-5">
                    <AvatarFallback className="text-xs">
                      {(u.user_name || u.email || "?")[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {u.user_name || u.email}
                </button>
              ))}
            </div>
          )}

          <div className="flex gap-2 items-end">
            <Textarea
              ref={inputRef}
              rows={2}
              className="flex-1 resize-none text-sm"
              placeholder="Describe your task… (@ to mention a user, Enter to send)"
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              disabled={loading}
            />
            <Button
              size="icon"
              className="bg-purple-600 hover:bg-purple-700 h-10 w-10 flex-shrink-0"
              onClick={sendMessage}
              disabled={!input.trim() || loading}
            >
              {loading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Send size={16} />
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Shift+Enter for new line · @ to mention a user
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default AiTaskCreationSheet;
