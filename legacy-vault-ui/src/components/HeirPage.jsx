import React from "react";
import HeirForm from "./HeirForm";
import TriggerInheritance from "./TriggerInheritance";
import VaultInfo from "./VaultInfo";

export default function HeirPage() {
  return (
    <div className="space-y-6">
      <section className="lv-glass p-6">
        <p className="lv-eyebrow">Heir and inheritance</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">
          Manage Succession
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
          Assign the heir for your vault and keep inheritance claiming separate
          from day-to-day vault management.
        </p>
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <HeirForm />
        <TriggerInheritance />
      </section>

      <VaultInfo />
    </div>
  );
}
