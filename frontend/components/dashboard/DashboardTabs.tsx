"use client";

type DashboardTab = "upload" | "history" | "backup";

type DashboardTabsProps = {
  activeTab: DashboardTab;
  onChange: (tab: DashboardTab) => void;
};

const TABS: {
  id: DashboardTab;
  label: string;
  icon: React.ReactNode;
}[] = [
  {
    id: "upload",
    label: "Upload",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m0 0 7 7m-7-7-7 7" />
      </svg>
    ),
  },
  {
    id: "history",
    label: "History",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    id: "backup",
    label: "Backup",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 7.5V18a2 2 0 002 2h12a2 2 0 002-2V7.5M4 7.5 7 4.5h10l3 3M4 7.5h16" />
      </svg>
    ),
  },
];

export default function DashboardTabs({ activeTab, onChange }: DashboardTabsProps) {
  return (
    <nav
      className="relative flex rounded-xl bg-white/[0.04] p-1 ring-1 ring-white/10"
      role="tablist"
      aria-label="Dashboard sections"
    >
      <div
        className={`pointer-events-none absolute bottom-1 top-1 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 shadow-lg shadow-violet-900/40 transition-all duration-300 ease-out ${
          activeTab === "upload"
            ? "left-1 w-[calc(33.333%-5px)]"
            : activeTab === "history"
              ? "left-[calc(33.333%+2px)] w-[calc(33.333%-5px)]"
              : "left-[calc(66.666%+2px)] w-[calc(33.333%-5px)]"
        }`}
        aria-hidden="true"
      />
      {TABS.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={`relative z-10 flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-200 ${
              isActive ? "text-white" : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

export type { DashboardTab };
