import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import type { ApplicationStatus } from '../types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date | null | undefined, fmt = 'MMM d, yyyy') {
  if (!date) return '—';
  try {
    const d = typeof date === 'string' ? parseISO(date) : date;
    return format(d, fmt);
  } catch {
    return '—';
  }
}

export function timeAgo(date: string | Date | null | undefined) {
  if (!date) return '—';
  try {
    const d = typeof date === 'string' ? parseISO(date) : date;
    return formatDistanceToNow(d, { addSuffix: true });
  } catch {
    return '—';
  }
}

export function formatSalary(min: number | null, max: number | null, currency = 'USD') {
  if (!min && !max) return 'Not specified';
  const fmt = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n);
  if (min && max) return `${fmt(min)} – ${fmt(max)}`;
  if (min) return `${fmt(min)}+`;
  return `Up to ${fmt(max!)}`;
}

export function getScoreColor(score: number): string {
  if (score >= 85) return 'text-green-600';
  if (score >= 70) return 'text-blue-600';
  if (score >= 55) return 'text-yellow-600';
  return 'text-red-500';
}

export function getScoreBg(score: number): string {
  if (score >= 85) return 'bg-green-50 border-green-200';
  if (score >= 70) return 'bg-blue-50 border-blue-200';
  if (score >= 55) return 'bg-yellow-50 border-yellow-200';
  return 'bg-red-50 border-red-200';
}

export const STATUS_CONFIG: Record<ApplicationStatus, { label: string; color: string; bg: string }> = {
  pending:             { label: 'Pending',          color: 'text-gray-600',   bg: 'bg-gray-100'   },
  applied:             { label: 'Applied',          color: 'text-blue-700',   bg: 'bg-blue-100'   },
  follow_up_sent:      { label: 'Follow-up Sent',   color: 'text-indigo-700', bg: 'bg-indigo-100' },
  interview_scheduled: { label: 'Interview Sched.', color: 'text-amber-700',  bg: 'bg-amber-100'  },
  interviewed:         { label: 'Interviewed',      color: 'text-orange-700', bg: 'bg-orange-100' },
  offer_received:      { label: 'Offer Received',   color: 'text-green-700',  bg: 'bg-green-100'  },
  rejected:            { label: 'Rejected',         color: 'text-red-700',    bg: 'bg-red-100'    },
  withdrawn:           { label: 'Withdrawn',        color: 'text-gray-500',   bg: 'bg-gray-100'   },
  saved:               { label: 'Saved',            color: 'text-violet-700', bg: 'bg-violet-100' },
};

export function getWorkModeLabel(mode: string) {
  const map: Record<string, string> = {
    remote: 'Remote',
    hybrid: 'Hybrid',
    onsite: 'On-site',
    flexible: 'Flexible',
  };
  return map[mode] || mode;
}

export function getSourceLabel(source: string) {
  const map: Record<string, string> = {
    linkedin: 'LinkedIn',
    indeed: 'Indeed',
    glassdoor: 'Glassdoor',
    wellfound: 'Wellfound',
    perplexity: 'AI Discovery',
    perplexity_hidden: 'Hidden Jobs',
  };
  return map[source] || source;
}
