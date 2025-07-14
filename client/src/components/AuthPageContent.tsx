
import React from "react";
import { ClipboardList, Users2, ShieldCheck } from "lucide-react";

const AuthPageContent: React.FC = () => (
  <div className="flex flex-col items-center justify-center gap-8 my-8 max-w-2xl mx-auto text-center">
    <div className="flex flex-col md:flex-row gap-6 items-center justify-center">
      <div className="flex flex-col items-center">
        <ClipboardList className="text-primary mb-2 h-10 w-10" />
        <div className="font-semibold">Organize &amp; Track Tasks</div>
        <p className="text-muted-foreground text-sm">Stay productive with clear lists and deadlines.</p>
      </div>
      <div className="hidden md:block h-12 border-l border-gray-300" />
      <div className="flex flex-col items-center">
        <Users2 className="text-primary mb-2 h-10 w-10" />
        <div className="font-semibold">Team Collaboration</div>
        <p className="text-muted-foreground text-sm">Assign tasks, comment, and manage your team effectively.</p>
      </div>
      <div className="hidden md:block h-12 border-l border-gray-300" />
      <div className="flex flex-col items-center">
        <ShieldCheck className="text-primary mb-2 h-10 w-10" />
        <div className="font-semibold">Secure &amp; Accessible</div>
        <p className="text-muted-foreground text-sm">Your work is protected and available everywhere.</p>
      </div>
    </div>
    <div className="italic text-muted-foreground text-base">
      Empower your workflow with <span className="font-bold text-primary">Smart Task Manager</span>.
    </div>
  </div>
);

export default AuthPageContent;
