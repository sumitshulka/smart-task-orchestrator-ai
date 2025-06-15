
import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface ResetUserPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string | null;
  userEmail: string | undefined;
}

const ResetUserPasswordDialog: React.FC<ResetUserPasswordDialogProps> = ({
  open,
  onOpenChange,
  userId,
  userEmail,
}) => {
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !password) return;

    setSaving(true);

    // Supabase Admin API: update a user's password using "admin.updateUserById"
    // Note: this requires the service_role key in a secure backend (Edge function).
    // But for this UI demo in Lovable, we use a client-side administrative approach:
    // This method will only work if your client SDK is initialized with a key with admin rights.
    try {
      const { error } = await supabase.auth.admin.updateUserById(userId, { password });
      if (error) {
        throw error;
      }
      toast({ title: "Password reset", description: "Password was successfully updated for " + userEmail });
      setPassword("");
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Password reset failed", description: err.message || "Error occurred." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset Password</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleReset} className="space-y-3">
          <div>
            <div className="text-xs text-muted-foreground mb-2">
              Reset password for <span className="font-semibold">{userEmail}</span>
            </div>
            <Input
              type="password"
              placeholder="New password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving || !password}>
              {saving ? "Saving..." : "Reset Password"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ResetUserPasswordDialog;
