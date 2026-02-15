"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Eye,
  FileText,
  BookOpen,
  MessageSquare,
  Settings,
  ChevronLeft,
  ChevronRight,
  Bot,
} from "lucide-react";
import { useState } from "react";

const navItems = [
  { href: "/", label: "Meeting", icon: Eye, description: "Live assistant" },
  {
    href: "/chat",
    label: "Chat",
    icon: Bot,
    description: "Talk with GPT-5.2",
  },
  {
    href: "/directives",
    label: "Directives",
    icon: FileText,
    description: "AI instructions",
  },
  {
    href: "/knowledge",
    label: "Knowledge",
    icon: BookOpen,
    description: "Upload files",
  },
  {
    href: "/qa-bank",
    label: "Q&A Bank",
    icon: MessageSquare,
    description: "Prepared answers",
  },
  {
    href: "/settings",
    label: "Settings",
    icon: Settings,
    description: "Configuration",
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`flex flex-col bg-bg-secondary border-r border-border transition-all duration-300 ${
        collapsed ? "w-16" : "w-60"
      }`}
    >
      <div className="flex items-center justify-between p-4 border-b border-border">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
              <Eye className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight">Observer</span>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-md hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors"
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      </div>

      <nav className="flex-1 p-2 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${
                isActive
                  ? "bg-accent-dim text-accent"
                  : "text-text-secondary hover:bg-bg-hover hover:text-text-primary"
              }`}
              title={collapsed ? item.label : undefined}
            >
              <Icon
                className={`w-5 h-5 flex-shrink-0 ${
                  isActive
                    ? "text-accent"
                    : "text-text-muted group-hover:text-text-primary"
                }`}
              />
              {!collapsed && (
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">
                    {item.label}
                  </div>
                  <div
                    className={`text-xs truncate ${
                      isActive ? "text-accent/70" : "text-text-muted"
                    }`}
                  >
                    {item.description}
                  </div>
                </div>
              )}
            </Link>
          );
        })}
      </nav>

      {!collapsed && (
        <div className="p-4 border-t border-border">
          <div className="text-xs text-text-muted text-center">
            Observer v1.0 — GPT-5.2
          </div>
        </div>
      )}
    </aside>
  );
}
