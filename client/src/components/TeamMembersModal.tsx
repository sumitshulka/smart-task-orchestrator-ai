
import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type TeamMember = {
  id: string;
  user_name?: string | null;
  email: string;
  allocationDate?: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: TeamMember[];
  teamName: string;
};

export default function TeamMembersModal({ open, onOpenChange, members, teamName }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Members of {teamName}</DialogTitle>
          <DialogDescription>
            See all users who are part of this team, with their email and allocation date.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-2 max-h-96 overflow-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="py-1 pl-1 font-medium">Name</th>
                <th className="py-1 font-medium">Email</th>
                <th className="py-1 font-medium">Team Allocation Date</th>
              </tr>
            </thead>
            <tbody>
              {members.map(m => (
                <tr key={m.id}>
                  <td className="py-1 pl-1">{m.user_name ?? "-"}</td>
                  <td className="py-1">{m.email}</td>
                  <td className="py-1">{m.allocationDate ? new Date(m.allocationDate).toLocaleDateString() : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
