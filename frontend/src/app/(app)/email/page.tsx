'use client';

import { useEffect, useState } from 'react';
import { Mail, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import Header from '../../../components/layout/Header';
import { emailApi, jobsApi } from '../../../lib/api';
import { cn, formatDate, timeAgo } from '../../../lib/utils';
import type { Email, Job } from '../../../types';

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  queued:  { label: 'Queued',  color: 'bg-gray-100 text-gray-600'     },
  sent:    { label: 'Sent',    color: 'bg-blue-100 text-blue-700'     },
  failed:  { label: 'Failed',  color: 'bg-red-100 text-red-700'       },
  opened:  { label: 'Opened',  color: 'bg-green-100 text-green-700'   },
  replied: { label: 'Replied', color: 'bg-purple-100 text-purple-700' },
};

export default function EmailPage() {
  const [emails, setEmails] = useState<Email[]>([]);
  const [stats, setStats] = useState<Record<string, string>>({});
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [composing, setComposing] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [recruiterName, setRecruiterName] = useState('');
  const [recruiterEmail, setRecruiterEmail] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState<{ subject: string; body: string } | null>(null);
  const [sendingFollowUps, setSendingFollowUps] = useState(false);

  useEffect(() => {
    Promise.all([
      emailApi.list({ limit: 50 }).then((r) => setEmails(r.data.data.emails)),
      emailApi.stats().then((r) => setStats(r.data.data)),
      jobsApi.list({ limit: 50, min_score: 60 }).then((r) => setJobs(r.data.data.jobs)),
    ]).finally(() => setLoading(false));
  }, []);

  async function generateEmail() {
    if (!selectedJobId) { toast.error('Select a job'); return; }
    setGenerating(true);
    try {
      const res = await emailApi.generateOutreach({
        job_id: selectedJobId,
        recruiter: { name: recruiterName || undefined, email: recruiterEmail || undefined },
      });
      setGenerated(res.data.data);
    } catch {
      toast.error('Failed to generate email');
    } finally {
      setGenerating(false);
    }
  }

  async function sendFollowUps() {
    setSendingFollowUps(true);
    try {
      const res = await emailApi.sendFollowUps();
      const sent = res.data.data.sent;
      toast.success(`${sent} follow-up email${sent !== 1 ? 's' : ''} sent`);
      emailApi.list({ limit: 50 }).then((r) => setEmails(r.data.data.emails));
    } catch {
      toast.error('Failed to send follow-ups');
    } finally {
      setSendingFollowUps(false);
    }
  }

  return (
    <>
      <Header
        title="Email Outreach"
        subtitle="Cold outreach, follow-ups, and email tracking"
        actions={
          <div className="flex gap-2">
            <button onClick={sendFollowUps} disabled={sendingFollowUps} className="btn-secondary">
              <Clock size={15} />
              {sendingFollowUps ? 'Sending...' : 'Send Follow-ups'}
            </button>
            <button onClick={() => setComposing(true)} className="btn-primary">
              <Mail size={15} /> Compose
            </button>
          </div>
        }
      />

      <main className="flex-1 p-6 space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Total Sent', value: stats.sent || 0,    color: 'text-blue-600'   },
            { label: 'Opened',     value: stats.opened || 0,  color: 'text-green-600'  },
            { label: 'Replied',    value: stats.replied || 0, color: 'text-purple-600' },
            { label: 'Failed',     value: stats.failed || 0,  color: 'text-red-500'    },
          ].map(({ label, value, color }) => (
            <div key={label} className="card p-4 text-center">
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
              <p className="text-sm text-gray-500">{label}</p>
            </div>
          ))}
        </div>

        {/* Compose Modal */}
        {composing && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Generate Cold Outreach</h2>
                <button
                  onClick={() => { setComposing(false); setGenerated(null); }}
                  className="text-gray-400 hover:text-gray-600 text-xl"
                >
                  ✕
                </button>
              </div>

              <div>
                <label className="label">Target Job</label>
                <select value={selectedJobId} onChange={(e) => setSelectedJobId(e.target.value)} className="input">
                  <option value="">Select a job...</option>
                  {jobs.map((j) => (
                    <option key={j.id} value={j.id}>{j.company} — {j.role}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Recruiter Name (optional)</label>
                  <input value={recruiterName} onChange={(e) => setRecruiterName(e.target.value)} placeholder="Jane Smith" className="input" />
                </div>
                <div>
                  <label className="label">Recruiter Email (optional)</label>
                  <input value={recruiterEmail} onChange={(e) => setRecruiterEmail(e.target.value)} placeholder="jane@company.com" type="email" className="input" />
                </div>
              </div>

              <button onClick={generateEmail} disabled={generating} className="btn-primary w-full justify-center">
                {generating ? 'Generating with AI...' : 'Generate Email'}
              </button>

              {generated && (
                <div className="space-y-3 border-t pt-4">
                  <div>
                    <p className="label">Subject</p>
                    <p className="text-sm font-medium text-gray-900 bg-gray-50 p-2 rounded-lg">{generated.subject}</p>
                  </div>
                  <div>
                    <p className="label">Body</p>
                    <pre className="text-xs text-gray-700 bg-gray-50 p-3 rounded-lg whitespace-pre-wrap font-sans leading-relaxed max-h-48 overflow-y-auto">
                      {generated.body}
                    </pre>
                  </div>
                  {recruiterEmail
                    ? <p className="text-xs text-green-600 font-medium">✓ Email sent to {recruiterEmail}</p>
                    : <p className="text-xs text-amber-600">Add a recruiter email above to send automatically, or copy and send manually.</p>
                  }
                </div>
              )}
            </div>
          </div>
        )}

        {/* Email List */}
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['To', 'Subject', 'Type', 'Status', 'Sent', 'Opened'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={6} className="py-10 text-center text-gray-400">Loading...</td></tr>
              ) : emails.length === 0 ? (
                <tr><td colSpan={6} className="py-10 text-center text-gray-400">No emails yet — compose your first outreach above</td></tr>
              ) : emails.map((email) => (
                <tr key={email.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900 text-xs">{email.to_name || email.to_email}</p>
                    <p className="text-gray-400 text-xs">{email.to_email}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-700 max-w-xs truncate">{email.subject}</td>
                  <td className="px-4 py-3">
                    <span className="badge bg-gray-100 text-gray-600 text-xs">{email.type.replace(/_/g, ' ')}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('badge text-xs', STATUS_CONFIG[email.status]?.color)}>
                      {STATUS_CONFIG[email.status]?.label || email.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{formatDate(email.sent_at)}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {email.opened_at ? `✓ ${timeAgo(email.opened_at)}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}
