"use client";

type DashboardTab = "upload" | "history";

type DashboardTabsProps = {
  activeTab: DashboardTab;
  onChange: (tab: DashboardTab) => void;
};

const TABS: { id: DashboardTab; label: string }[] = [
  { id: "upload", label: "Upload" },
  { id: "history", label: "History" },
];

export default function DashboardTabs({ activeTab, onChange }: DashboardTabsProps) {
  return (
    <div className="flex gap-1 rounded-xl border border-zinc-200 bg-zinc-100 p-1">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition ${
            activeTab === tab.id
              ? "bg-white text-zinc-900 shadow-sm"
              : "text-zinc-600 hover:text-zinc-900"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export type { DashboardTab };
