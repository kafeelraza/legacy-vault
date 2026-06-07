import React from "react";
import ActivityTimeline from "./ActivityTimeline";

export default function ActivityPage() {
  return (
    <div className="space-y-6">
      <section className="lv-glass p-6">
        <p className="lv-eyebrow">Activity</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">
          Timeline
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
          Review wallet, vault, spending, and recovery events synced through
          the LegacyVault oracle service.
        </p>
      </section>

      <ActivityTimeline limit={50} />
    </div>
  );
}
