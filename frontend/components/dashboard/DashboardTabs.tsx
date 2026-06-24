"use client";

type DashboardTab = "upload" | "history" | "backup";

type DashboardTabsProps = {
  activeTab: DashboardTab;
  onChange: (tab: DashboardTab) => void;
};

const TABS: { id: DashboardTab; label: string }[] = [
  { id: "upload", label: "Upload Transcript" },
  { id: "history", label: "History" },
  { id: "backup", label: "Backup" },
];

export default function DashboardTabs({ activeTab, onChange }: DashboardTabsProps) {
  return (
    <nav className="flex flex-wrap gap-x-6 gap-y-2">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={`border-b-2 pb-1 text-sm font-medium transition ${
            activeTab === tab.id
              ? "border-violet-600 text-violet-600"
              : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}

export type { DashboardTab };
