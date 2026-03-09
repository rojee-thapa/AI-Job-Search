'use client';

import { useEffect, useState } from 'react';
import { RefreshCw, TableIcon, ExternalLink, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import Header from '../../../components/layout/Header';
import { applicationsApi } from '../../../lib/api';
import { cn, formatDate, formatSalary, STATUS_CONFIG, getWorkModeLabel } from '../../../lib/utils';
import type { Application, ApplicationStatus } from '../../../types';

const STATUSES: ApplicationStatus[] = [
  'pending', 'applied', 'follow_up_sent', 'interview_scheduled',
  'interviewed', 'offer_received', 'rejected', 'withdrawn',
];

export default function ApplicationsPage() {
  const [apps, setApps] = useState<Application[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [syncingSheets, setSyncingSheets] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  useEffect(() => { loadApps(); }, [page, statusFilter]);

  useEffect(() => {
    applicationsApi.stats().then((r) => setStats(r.data.data)).catch(() => {});
  }, []);

  async function loadApps() {
    setLoading(true);
    try {
      const res = await applicationsApi.list({ page, limit: 30, status: statusFilter || undefined });
      setApps(res.data.data.applications);
      setTotal(res.data.data.total);
    } catch { toast.error('Failed to load applications'); }
    finally { setLoading(false); }
  }

  async function updateStatus(id: string, status: ApplicationStatus, extra?: { interview_at?: string; notes?: string }) {
    try {
      await applicationsApi.updateStatus(id, { status, ...extra });
      toast.success(`Status updated to ${STATUS_CONFIG[status].label}`);
      setEditing(null);
      loadApps();
    } catch { toast.error('Failed to update status'); }
  }

  async function syncSheets() {
    setSyncingSheets(true);
    try {
      const res = await applicationsApi.syncSheets();
      toast.success(`Synced ${res.data.data.synced} applications to Google Sheets`);
    } catch { toast.error('Sheets sync failed — check your Google Sheets configuration'); }
    finally { setSyncingSheets(false); }
  }

  return (
    <>
      <Header
        title="Applications"
        subtitle={`${total} total applications`}
        actions={
          <button onClick={syncSheets} disabled={syncingSheets} className="btn-secondary">
            <RefreshCw size={15} className={syncingSheets ? 'animate-spin' : ''} />
            {syncingSheets ? 'Syncing...' : 'Sync to Sheets'}
          </button>
        }
      />

      <main className="flex-1 p-6 space-y-5">
        {/* Stats Bar */}
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
          {(['applied', 'follow_up_sent', 'interview_scheduled', 'offer_received', 'rejected'] as ApplicationStatus[]).map((s) => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s === statusFilter ? '' : s); setPage(1); }}
              className={cn(
                'card p-3 text-center transition-all',
                statusFilter === s ? 'ring-2 ring-primary-500' : 'hover:shadow-md',
              )}
            >
              <p className={cn('text-lg font-bold', STATUS_CONFIG[s].color)}>{stats[s] || 0}</p>
              <p className="text-xs text-gray-500 leading-tight">{STATUS_CONFIG[s].label}</p>
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Company', 'Role', 'Location', 'Score', 'Status', 'Applied', 'Follow-up', 'Interview', 'Actions'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan={9} className="py-12 text-center text-gray-400">
                    <RefreshCw size={20} className="animate-spin mx-auto mb-2" />Loading...
                  </td></tr>
                ) : apps.length === 0 ? (
                  <tr><td colSpan={9} className="py-12 text-center text-gray-400">No applications yet</td></tr>
                ) : apps.map((app) => (
                  <tr key={app.id} className={cn('hover:bg-gray-50 transition-colors', STATUS_CONFIG[app.status]?.bg.replace('bg-', 'hover:bg-'))}>
                    <td className="px-4 py-3 font-medium text-gray-900">{app.company}</td>
                    <td className="px-4 py-3 text-gray-700">{app.role}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{app.location || '—'}</td>
                    <td className="px-4 py-3">
                      {app.overall_score ? (
                        <span className={cn('font-semibold', app.overall_score >= 80 ? 'text-green-600' : app.overall_score >= 65 ? 'text-blue-600' : 'text-gray-500')}>
                          {Math.round(app.overall_score)}%
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {editing === app.id ? (
                        <select
                          autoFocus
                          defaultValue={app.status}
                          onChange={(e) => updateStatus(app.id, e.target.value as ApplicationStatus)}
                          onBlur={() => setEditing(null)}
                          className="input py-1 text-xs w-36"
                        >
                          {STATUSES.map((s) => (
                            <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                          ))}
                        </select>
                      ) : (
                        <button onClick={() => setEditing(app.id)}>
                          <span className={cn('badge', STATUS_CONFIG[app.status]?.bg, STATUS_CONFIG[app.status]?.color)}>
                            {STATUS_CONFIG[app.status]?.label || app.status}
                          </span>
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{formatDate(app.applied_at)}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{formatDate(app.follow_up_at)}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{formatDate(app.interview_at)}</td>
                    <td className="px-4 py-3">
                      {app.application_url && (
                        <a href={app.application_url} target="_blank" rel="noopener noreferrer"
                          className="text-primary-600 hover:text-primary-800 transition-colors">
                          <ExternalLink size={14} />
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination */}
        {total > 30 && (
          <div className="flex items-center justify-center gap-2">
            <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="btn-secondary py-1.5">Prev</button>
            <span className="text-sm text-gray-600">Page {page} of {Math.ceil(total / 30)}</span>
            <button disabled={page >= Math.ceil(total / 30)} onClick={() => setPage((p) => p + 1)} className="btn-secondary py-1.5">Next</button>
          </div>
        )}
      </main>
    </>
  );
}
