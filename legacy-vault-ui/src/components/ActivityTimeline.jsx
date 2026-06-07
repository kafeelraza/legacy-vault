import React from "react";
import { useActivity } from "./ActivityContext";

function formatActivityTime(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ActivityTimeline({ limit = 6 }) {
  const { activities, clearActivity } = useActivity();
  const visibleItems = activities.slice(0, limit);

  return (
    <div id="recent-activity" className="lv-card">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="lv-eyebrow">Recent Activity</p>
          <h2 className="mt-2 text-xl font-semibold text-white">
            Synced timeline
          </h2>
        </div>
        {activities.length > 0 && (
          <button onClick={clearActivity} className="lv-btn-secondary py-2">
            Clear
          </button>
        )}
      </div>

      {visibleItems.length === 0 ? (
        <div className="lv-status-warning mt-5">
          No activity yet. Connect a wallet or submit a vault action to start
          the timeline.
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          {visibleItems.map((item) => (
            <div
              key={item.id}
              className="relative rounded-xl border border-white/10 bg-white/[0.04] p-4"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-semibold text-white">{item.title}</p>
                  {item.detail && (
                    <p className="mt-1 text-sm leading-5 text-slate-400">
                      {item.detail}
                    </p>
                  )}
                </div>
                <span className="text-xs text-slate-500">
                  {formatActivityTime(item.createdAt)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
