"use client";

import { Archive, Clock, Upload } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
    icon: <Upload className="size-4" />,
  },
  {
    id: "history",
    label: "History",
    icon: <Clock className="size-4" />,
  },
  {
    id: "backup",
    label: "Backup",
    icon: <Archive className="size-4" />,
  },
];

export default function DashboardTabs({ activeTab, onChange }: DashboardTabsProps) {
  return (
    <Tabs
      value={activeTab}
      onValueChange={(value) => onChange(value as DashboardTab)}
      className="w-full"
    >
      <TabsList className="grid h-10 w-full grid-cols-3">
        {TABS.map((tab) => (
          <TabsTrigger key={tab.id} value={tab.id} className="gap-2">
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}

export type { DashboardTab };
