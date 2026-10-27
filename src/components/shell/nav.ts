import {
  BarChart3,
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  FileDown,
  FileUp,
  Flag,
  GraduationCap,
  HeartPulse,
  History,
  Home,
  Inbox,
  LayoutGrid,
  Lightbulb,
  type LucideIcon,
  MessageCircleQuestion,
  Milestone,
  Settings,
  ShieldCheck,
  Sparkles,
  Target,
  UserCog,
  UserPlus,
  Users,
  FileText,
  Upload,
  CalendarPlus,
  PenLine,
} from "lucide-react";
import type { Role } from "@/server/authz";

export type NavItem = { href: string; label: string; icon: LucideIcon; keywords?: string };

export const NAV: Record<Role, { dock: NavItem[]; more: NavItem[]; mobile: NavItem[] }> = {
  MENTEE: {
    dock: [
      { href: "/mentee", label: "Home", icon: Home },
      { href: "/mentee/academics", label: "Academics", icon: GraduationCap, keywords: "marks sgpa cgpa semester" },
      { href: "/mentee/insights", label: "Insights", icon: Lightbulb, keywords: "charts trends analytics" },
      { href: "/mentee/mentoring", label: "Mentoring", icon: Sparkles, keywords: "feedback goals plan" },
      { href: "/mentee/pulse", label: "Pulse", icon: HeartPulse, keywords: "check-in wellbeing week" },
      { href: "/mentee/ask", label: "Ask", icon: MessageCircleQuestion, keywords: "question mentor" },
    ],
    more: [
      { href: "/mentee/planner", label: "Goal planner", icon: Target, keywords: "target cgpa see" },
      { href: "/mentee/resources", label: "Resources", icon: BookOpen, keywords: "notes study material" },
      { href: "/mentee/sessions", label: "Sessions", icon: CalendarDays, keywords: "meeting schedule" },
      { href: "/mentee/journey", label: "Journey", icon: Milestone, keywords: "timeline history" },
      { href: "/mentee/profile", label: "Profile", icon: UserCog },
    ],
    mobile: [
      { href: "/mentee", label: "Home", icon: Home },
      { href: "/mentee/academics", label: "Academics", icon: GraduationCap },
      { href: "/mentee/ask", label: "Ask", icon: MessageCircleQuestion },
    ],
  },
  MENTOR: {
    dock: [
      { href: "/mentor", label: "Home", icon: Home },
      { href: "/mentor/mentees", label: "Mentees", icon: Users, keywords: "students" },
      { href: "/mentor/inbox", label: "Inbox", icon: Inbox, keywords: "ask questions" },
      { href: "/mentor/verifications", label: "Verify", icon: ClipboardCheck, keywords: "records corrections" },
      { href: "/mentor/sessions", label: "Sessions", icon: CalendarDays },
      { href: "/mentor/analytics", label: "Analytics", icon: BarChart3 },
    ],
    more: [
      { href: "/mentor/recommendations", label: "Recommendations", icon: Sparkles, keywords: "feedback goals" },
      { href: "/mentor/resources", label: "Resources", icon: BookOpen, keywords: "upload notes" },
      { href: "/mentor/reports", label: "Reports", icon: FileText, keywords: "pdf download" },
    ],
    mobile: [
      { href: "/mentor", label: "Home", icon: Home },
      { href: "/mentor/mentees", label: "Mentees", icon: Users },
      { href: "/mentor/inbox", label: "Inbox", icon: Inbox },
    ],
  },
  HOD: {
    dock: [
      { href: "/hod", label: "Home", icon: Home },
      { href: "/hod/students", label: "Students", icon: GraduationCap },
      { href: "/hod/mentors", label: "Mentors", icon: Users },
      { href: "/hod/assignments", label: "Assignments", icon: LayoutGrid, keywords: "assign reassign board" },
      { href: "/hod/analytics", label: "Analytics", icon: BarChart3 },
      { href: "/hod/interventions", label: "Interventions", icon: Flag, keywords: "risk flagged" },
    ],
    more: [
      { href: "/hod/users", label: "Users & roles", icon: ShieldCheck, keywords: "invite suspend" },
      { href: "/hod/imports", label: "Imports", icon: FileUp, keywords: "csv xlsx bulk" },
      { href: "/hod/exports", label: "Exports", icon: FileDown },
      { href: "/hod/settings", label: "Settings", icon: Settings, keywords: "grading thresholds pulse" },
      { href: "/hod/audit", label: "Audit history", icon: History },
    ],
    mobile: [
      { href: "/hod", label: "Home", icon: Home },
      { href: "/hod/students", label: "Students", icon: GraduationCap },
      { href: "/hod/assignments", label: "Assign", icon: LayoutGrid },
    ],
  },
};

export const QUICK: Record<Role, NavItem[]> = {
  MENTEE: [
    { href: "/mentee/pulse", label: "Weekly check-in", icon: HeartPulse },
    { href: "/mentee/ask/new", label: "Ask my mentor", icon: MessageCircleQuestion },
    { href: "/mentee/academics?new=1", label: "Add a semester", icon: GraduationCap },
    { href: "/mentee/planner", label: "Plan a goal", icon: Target },
  ],
  MENTOR: [
    { href: "/mentor/recommendations?new=1", label: "Write a recommendation", icon: PenLine },
    { href: "/mentor/resources?new=1", label: "Upload a resource", icon: Upload },
    { href: "/mentor/sessions?new=1", label: "Schedule a session", icon: CalendarPlus },
    { href: "/mentor/verifications", label: "Verify records", icon: ClipboardCheck },
  ],
  HOD: [
    { href: "/hod/users?invite=1", label: "Invite a user", icon: UserPlus },
    { href: "/hod/assignments", label: "Assign mentors", icon: LayoutGrid },
    { href: "/hod/imports", label: "Import data", icon: FileUp },
    { href: "/hod/exports", label: "Export a report", icon: FileDown },
  ],
};

export const isActive = (path: string, href: string, home: string) =>
  href === home ? path === home : path === href || path.startsWith(`${href}/`);
