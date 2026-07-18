import type React from "react";
import {
  LayoutDashboard,
  Inbox,
  Bot,
  CheckSquare,
  Clock,
  Users,
  Calendar,
  CreditCard,
  Package,
  Paperclip,
  Search,
  Zap,
  Shield,
  BarChart2,
  Settings,
} from "lucide-react";

export interface ActionItem {
  text?: string;
  from?: string;
  priority?: string;
  dueDate?: string;
  emailId?: string;
}

export type { GmailEmail, Insights } from "../lib/normalize";

export interface DailyBrief {
  summary: string;
  highlights: string[];
}

export interface Stats {
  total: number;
  unread: number;
  important: number;
  needsReply: number;
  byCategory: Record<string, number>;
}

export type View =
  | "dashboard"
  | "inbox"
  | "ai"
  | "action"
  | "waiting"
  | "followup"
  | "calendar"
  | "bills"
  | "purchases"
  | "attachments"
  | "search"
  | "automations"
  | "security"
  | "analytics"
  | "settings";

export type AppState = "loading" | "unauthenticated" | "syncing" | "ready" | "error";

export interface AIProcessingStatus {
  classificationStatus: "idle" | "running" | "completed" | "partial" | "failed" | "fallback";
  classificationProvider: "groq" | "gemini" | "fallback" | null;
  insightsStatus: "idle" | "running" | "completed" | "failed" | "fallback";
  insightsProvider: "groq" | "gemini" | "fallback" | null;
  classifiedCount: number;
  fallbackCount: number;
}

export interface FocusItem {
  text: string;
  priority: "high" | "medium" | "low";
  type: string;
}

export const navItems: {
  id: View;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badgeKey?: keyof Stats | string;
}[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "inbox", label: "Inbox", icon: Inbox, badgeKey: "unread" },
  { id: "ai", label: "AI Assistant", icon: Bot },
  { id: "action", label: "Action Center", icon: CheckSquare },
  { id: "waiting", label: "Waiting On", icon: Clock },
  { id: "followup", label: "Follow Ups", icon: Users },
  { id: "calendar", label: "Calendar", icon: Calendar },
  { id: "bills", label: "Bills & Subscriptions", icon: CreditCard },
  { id: "purchases", label: "Purchases", icon: Package },
  { id: "attachments", label: "Attachments", icon: Paperclip },
  { id: "search", label: "Search", icon: Search },
  { id: "automations", label: "Automations", icon: Zap },
  { id: "security", label: "Security", icon: Shield },
  { id: "analytics", label: "Analytics", icon: BarChart2 },
  { id: "settings", label: "Settings", icon: Settings },
];
