'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Briefcase, CheckSquare, Mail, Calendar, FileText,
  RefreshCw, ArrowRight, Zap, Clock, Award,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Header from '../../../components/layout/Header';
import { trackingApi, jobsApi, applicationsApi } from '../../../lib/api';
import { formatDate, timeAgo, cn } from '../../../lib/utils';
import type { DashboardStats } from '../../../types';

function StatCard({ icon: Icon, label, value, sub, color, href }: {
  icon: React.ElementType; label: string; value: string | number;
  sub?: string; color: string; href?: string;
}) {
  const content = (
    <div className={`card p-5 flex items-start gap-4 hover:shadow-md transition-shadow ${href ? 'cursor-pointer' : ''}`}>
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon size={22} className="text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-sm text-gray-600">{label}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
  return href ? <Link href={href}>{content}</Link> : content;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [discovering, setDiscovering] = useState(false);
  const [applying, setApplying] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadStats(); }, []);

  async function loadStats() {
    try {
      const res = await trackingApi.dashboard();
      setStats(res.data.data);
    } catch {
      toast.error('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }

  async function handleDiscover() {
    setDiscovering(true);
    try {
      await jobsApi.discover();
      toast.success('Job discovery started! Check the Jobs page in a few minutes.');
    } catch {
      toast.error('Failed to start job discovery');
    } finally {
      setDiscovering(false);
    }
  }

  async function handleAutoApply() {
    setApplying(true);
    try {
      const res = await applicationsApi.autoApply();
      const { stats: s } = res.data.data;
      toast.success(`Auto-apply done: ${s.applied} applied, ${s.errors} errors`);
      await loadStats();
    } catch {
      toast.error('Auto-apply failed');
    } finally {
      setApplying(false);
    }
  }

  return (
    <>
      <Header
        title="Dashboard"
        subtitle={`Today is ${formatDate(new Date(), 'EEEE, MMMM d')}`}
        actions={
          <div className="flex gap-2">
            <button onClick={handleDiscover} disabled={discovering} className="btn-secondary">
              <RefreshCw size={15} className={discovering ? 'animate-spin' : ''} />
              {discovering ? 'Discovering...' : 'Discover Jobs'}
            </button>
            <button onClick={handleAutoApply} disabled={applying} className="btn-primary">
              <Zap size={15} />
              {applying ? 'Applying...' : 'Auto-Apply'}
            </button>
          </div>
        }
      />

      <main className="flex-1 p-6 space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={Briefcase}
            label="Total Jobs Matched"
            value={stats?.jobs.total || 0}
            sub={`Avg score: ${stats?.jobs.avg_score || 0}%`}
            color="bg-primary-600"
            href="/jobs"
          />
          <StatCard
            icon={CheckSquare}
            label="Applications"
            value={stats?.applications.total || 0}
            sub={`${stats?.applications.applied_today || 0} applied today`}
            color="bg-green-600"
            href="/applications"
          />
          <StatCard
            icon={Calendar}
            label="Interviews"
            value={stats?.applications.interviews || 0}
            sub={`${stats?.applications.offers || 0} offers received`}
            color="bg-amber-500"
            href="/applications"
          />
          <StatCard
            icon={Mail}
            label="Emails Sent"
            value={stats?.emails.sent || 0}
            sub={`${stats?.emails.opened || 0} opened`}
            color="bg-purple-600"
            href="/email"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Upcoming Interviews */}
          <div className="card p-5 lg:col-span-1">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">Upcoming Interviews</h2>
              <Link href="/applications" className="text-xs text-primary-600 hover:underline flex items-center gap-1">
                View all <ArrowRight size={12} />
              </Link>
            </div>
            {stats?.upcoming_interviews.length === 0 && (
              <div className="text-center py-6">
                <Calendar size={32} className="text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No upcoming interviews</p>
              </div>
            )}
            <div className="space-y-3">
              {stats?.upcoming_interviews.map((interview, i) => (
                <div key={i} className="flex items-center gap-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                  <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Calendar size={16} className="text-amber-700" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{interview.company}</p>
                    <p className="text-xs text-gray-500 truncate">{interview.role}</p>
                    <p className="text-xs font-medium text-amber-700">{formatDate(interview.interview_at, 'MMM d, h:mm a')}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Application Pipeline */}
          <div className="card p-5 lg:col-span-1">
            <h2 className="font-semibold text-gray-900 mb-4">Application Pipeline</h2>
            {[
              { label: 'Applied',    value: stats?.applications.applied,    color: 'bg-blue-500' },
              { label: 'Interviews', value: stats?.applications.interviews, color: 'bg-amber-500' },
              { label: 'Offers',     value: stats?.applications.offers,     color: 'bg-green-500' },
            ].map(({ label, value, color }) => {
              const total = parseInt(stats?.applications.total || '1', 10) || 1;
              const pct = Math.round((parseInt(value || '0', 10) / total) * 100);
              return (
                <div key={label} className="mb-3">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">{label}</span>
                    <span className="font-medium text-gray-900">{value || 0}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Recent Activity */}
          <div className="card p-5 lg:col-span-1">
            <h2 className="font-semibold text-gray-900 mb-4">Recent Activity</h2>
            {!stats?.recent_activity.length && (
              <div className="text-center py-6">
                <Clock size={32} className="text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No activity yet</p>
              </div>
            )}
            <div className="space-y-3">
              {stats?.recent_activity.slice(0, 6).map((item, i) => (
                <div key={i} className="flex gap-3">
                  <div className="w-2 h-2 rounded-full bg-primary-400 mt-1.5 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-gray-700 leading-snug">{item.description}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{timeAgo(item.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { href: '/resume',         label: 'Upload Resume',  icon: FileText,   color: 'text-blue-600 bg-blue-50 hover:bg-blue-100'   },
              { href: '/jobs',           label: 'Browse Jobs',    icon: Briefcase,  color: 'text-green-600 bg-green-50 hover:bg-green-100' },
              { href: '/email',          label: 'Send Outreach',  icon: Mail,       color: 'text-purple-600 bg-purple-50 hover:bg-purple-100' },
              { href: '/interview-prep', label: 'Prep Interview', icon: Award,      color: 'text-amber-600 bg-amber-50 hover:bg-amber-100'  },
            ].map(({ href, label, icon: Icon, color }) => (
              <Link
                key={href}
                href={href}
                className={cn('flex flex-col items-center gap-2 p-4 rounded-xl transition-colors text-center', color)}
              >
                <Icon size={22} />
                <span className="text-sm font-medium">{label}</span>
              </Link>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}
