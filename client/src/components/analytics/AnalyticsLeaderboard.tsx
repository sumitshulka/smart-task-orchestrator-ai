
import React from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

type Performer = {
  name: string;
  completed: number;
  email?: string;
};

type AnalyticsLeaderboardProps = {
  performers: Performer[];
};

export default function AnalyticsLeaderboard({ performers }: AnalyticsLeaderboardProps) {
  const max = Math.max(...performers.map(p => p.completed), 1);
  return (
    <div>
      <h2 className="text-lg font-medium mb-3">Top Performers</h2>
      <div className="space-y-2">
        {performers.map((p, idx) => (
          <div 
            key={p.email || p.name || idx}
            className="flex items-center gap-3"
          >
            <Avatar className="w-8 h-8 text-sm">
              <AvatarFallback>{(p.name || "?").substring(0,2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex justify-between">
                <span className="font-medium">{p.name}</span>
                <span className="font-mono text-xs">{p.completed} done</span>
              </div>
              <div className="w-full bg-muted/50 rounded h-2 mt-1">
                <div
                  className="h-2 bg-green-500 rounded transition-all"
                  style={{ width: `${Math.round((p.completed / max) * 100)}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
