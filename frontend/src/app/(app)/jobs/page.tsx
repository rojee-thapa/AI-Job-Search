'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  RefreshCw, Filter, ExternalLink, EyeOff, MapPin,
  DollarSign, Briefcase, Star, CheckCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Header from '../../../components/layout/Header';
import JobDetailsDrawer from '../../../components/jobs/JobDetailsDrawer';
import { jobsApi, applicationsApi } from '../../../lib/api';
import {
  cn, formatSalary, getScoreColor, getScoreBg,
  getWorkModeLabel, getSourceLabel, formatDate, STATUS_CONFIG,
} from '../../../lib/utils';
import type { Job } from '../../../types';

const SOURCES = ['', 'linkedin', 'indeed', 'wellfound', 'perplexity', 'perplexity_hidden'];
const MODES   = ['', 'remote', 'hybrid', 'onsite'];

export default function JobsPage() {
  const [jobs, setJobs]           = useState<Job[]>([]);
  const [total, setTotal]         = useState(0);
  const [page, setPage]           = useState(1);
  const [loading, setLoading]     = useState(true);
  const [discovering, setDiscovering] = useState(false);
  const [source, setSource]       = useState('');
  const [workMode, setWorkMode]   = useState('');
  const [minScore, setMinScore]   = useState(0);
  const [drawerJob, setDrawerJob] = useState<Job | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await jobsApi.list({
        page, limit: 20,
        source: source || undefined,
        work_mode: workMode || undefined,
        min_score: minScore,
      });
      setJobs(res.data.data.jobs);
      setTotal(res.data.data.total);
    } catch {
      toast.error('Failed to load jobs');
    } finally {
      setLoading(false);
    }
  }, [page, source, workMode, minScore]);

  useEffect(() => { load(); }, [load]);

  async function handleDiscover() {
    setDiscovering(true);
    try {
      await jobsApi.discover();
      toast.success('Job discovery started! Refresh in a minute to see new results.');
    } catch {
      toast.error('Discovery failed');
    } finally {
      setDiscovering(false);
    }
  }

  async function handleApply(job: Job) {
    try {
      await applicationsApi.create({ job_id: job.id });
      toast.success(`Application created for ${job.role} at ${job.company}`);
      const updated = { ...job, application_status: 'applied' as const };
      setJobs((prev) => prev.map((j) => j.id === job.id ? updated : j));
      if (drawerJob?.id === job.id) setDrawerJob(updated);
    } catch (e: any) {
      if (e.response?.status === 409) toast.error('Already applied!');
      else toast.error('Failed to create application');
    }
  }

  async function handleSave(job: Job) {
    const willSave = !job.is_saved;
    try {
      await jobsApi.save(job.id, willSave);
      const updated = { ...job, is_saved: willSave };
      setJobs((prev) => prev.map((j) => j.id === job.id ? updated : j));
      if (drawerJob?.id === job.id) setDrawerJob(updated);
      toast.success(willSave ? 'Job saved!' : 'Job unsaved');
    } catch {
      toast.error('Failed to save job');
    }
  }

  async function handleHide(jobId: string) {
    try {
      await jobsApi.hide(jobId);
      setJobs((prev) => prev.filter((j) => j.id !== jobId));
      if (drawerJob?.id === jobId) setDrawerJob(null);
      toast.success('Job hidden');
    } catch {
      toast.error('Failed to hide job');
    }
  }

  // Open drawer — show card data immediately, then fetch full data (includes company_research)
  async function handleOpenDrawer(job: Job) {
    setDrawerJob(job);
    try {
      const res = await jobsApi.get(job.id);
      setDrawerJob(res.data.data);
    } catch {
      // Drawer stays open with partial data
    }
  }

  return (
    <>
      <Header
        title="Matched Jobs"
        subtitle={`${total} jobs matched to your profile`}
        actions={
          <button onClick={handleDiscover} disabled={discovering} className="btn-primary">
            <RefreshCw size={15} className={discovering ? 'animate-spin' : ''} />
            {discovering ? 'Discovering...' : 'Discover Jobs'}
          </button>
        }
      />

      <main className="flex-1 p-6">
        {/* Filters */}
        <div className="card p-4 mb-5 flex flex-wrap items-center gap-3">
          <Filter size={16} className="text-gray-500" />
          <select
            value={source}
            onChange={(e) => { setSource(e.target.value); setPage(1); }}
            className="input w-40 py-1.5"
          >
            {SOURCES.map((s) => <option key={s} value={s}>{s ? getSourceLabel(s) : 'All Sources'}</option>)}
          </select>
          <select
            value={workMode}
            onChange={(e) => { setWorkMode(e.target.value); setPage(1); }}
            className="input w-36 py-1.5"
          >
            {MODES.map((m) => <option key={m} value={m}>{m ? getWorkModeLabel(m) : 'All Modes'}</option>)}
          </select>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Min score:</span>
            <input
              type="range" min={0} max={100} step={5} value={minScore}
              onChange={(e) => { setMinScore(Number(e.target.value)); setPage(1); }}
              className="w-28"
            />
            <span className="text-sm font-medium text-gray-900 w-8">{minScore}%</span>
          </div>
        </div>

        {/* Job Grid */}
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <RefreshCw size={24} className="animate-spin text-gray-400" />
          </div>
        ) : jobs.length === 0 ? (
          <div className="card p-12 text-center">
            <Briefcase size={40} className="text-gray-300 mx-auto mb-3" />
            <h3 className="text-gray-600 font-medium">No jobs found</h3>
            <p className="text-sm text-gray-400 mt-1">Try running job discovery or adjusting filters</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {jobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                onOpen={() => handleOpenDrawer(job)}
                onApply={handleApply}
                onSave={handleSave}
                onHide={handleHide}
              />
            ))}
          </div>
        )}

        {/* Pagination */}
        {total > 20 && (
          <div className="flex items-center justify-center gap-2 mt-6">
            <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="btn-secondary py-1.5">
              Previous
            </button>
            <span className="text-sm text-gray-600">Page {page} of {Math.ceil(total / 20)}</span>
            <button disabled={page >= Math.ceil(total / 20)} onClick={() => setPage((p) => p + 1)} className="btn-secondary py-1.5">
              Next
            </button>
          </div>
        )}
      </main>

      {/* Job Details Drawer */}
      <JobDetailsDrawer
        job={drawerJob}
        onClose={() => setDrawerJob(null)}
        onApply={handleApply}
        onSave={handleSave}
        onHide={handleHide}
      />
    </>
  );
}

// ─── Job Card ─────────────────────────────────────────────────

interface CardProps {
  job: Job;
  onOpen: () => void;
  onApply: (job: Job) => void;
  onSave: (job: Job) => void;
  onHide: (jobId: string) => void;
}

function JobCard({ job, onOpen, onApply, onSave, onHide }: CardProps) {
  return (
    <div
      className={cn('card p-5 border transition-all hover:shadow-md cursor-pointer', getScoreBg(job.overall_score || 0))}
      onClick={onOpen}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4 min-w-0">
          {/* Score Ring */}
          <div className={cn('score-ring flex-shrink-0', getScoreBg(job.overall_score || 0))}>
            <span className={cn('font-bold', getScoreColor(job.overall_score || 0))}>
              {Math.round(job.overall_score || 0)}
            </span>
          </div>

          {/* Job Info */}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h3 className="font-semibold text-gray-900">{job.role}</h3>
              <span className={cn('badge', job.work_mode === 'remote' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600')}>
                {getWorkModeLabel(job.work_mode)}
              </span>
              <span className="badge bg-gray-100 text-gray-500">{getSourceLabel(job.source)}</span>
              {job.visa_sponsorship && (
                <span className="badge bg-purple-100 text-purple-700">Visa Sponsored</span>
              )}
              {job.is_saved && (
                <span className="badge bg-violet-100 text-violet-700">
                  <Star size={10} className="inline mr-0.5 fill-violet-600" /> Saved
                </span>
              )}
              {job.application_status && (
                <span className={cn('badge', STATUS_CONFIG[job.application_status]?.bg, STATUS_CONFIG[job.application_status]?.color)}>
                  {STATUS_CONFIG[job.application_status]?.label}
                </span>
              )}
            </div>
            <p className="text-primary-700 font-medium">{job.company}</p>
            <div className="flex flex-wrap gap-3 mt-1 text-sm text-gray-500">
              {job.location && <span className="flex items-center gap-1"><MapPin size={12} />{job.location}</span>}
              {(job.salary_min || job.salary_max) && (
                <span className="flex items-center gap-1"><DollarSign size={12} />{formatSalary(job.salary_min, job.salary_max)}</span>
              )}
              {job.posted_at && <span>Posted {formatDate(job.posted_at)}</span>}
            </div>
            {/* Score breakdown */}
            <div className="flex flex-wrap gap-2 mt-2">
              {[
                { label: 'Skills',   score: job.skills_score },
                { label: 'Exp',      score: job.experience_score },
                { label: 'Salary',   score: job.salary_score },
                { label: 'Location', score: job.location_score },
              ].map(({ label, score }) => (
                <span key={label} className="text-xs text-gray-500">
                  {label}: <span className={cn('font-medium', getScoreColor(score || 0))}>{Math.round(score || 0)}%</span>
                </span>
              ))}
            </div>
            {/* Matched / missing skills */}
            {job.matched_skills?.length ? (
              <div className="flex flex-wrap gap-1 mt-2">
                {job.matched_skills.slice(0, 5).map((s) => (
                  <span key={s} className="text-xs bg-green-50 text-green-700 px-1.5 py-0.5 rounded">{s}</span>
                ))}
                {job.missing_skills?.slice(0, 3).map((s) => (
                  <span key={s} className="text-xs bg-red-50 text-red-600 px-1.5 py-0.5 rounded">−{s}</span>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        {/* Actions — stop propagation so button clicks don't open the drawer */}
        <div className="flex flex-col gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          {/* Apply */}
          {!job.application_status ? (
            <button
              onClick={() => onApply(job)}
              className="btn-primary py-1.5 text-xs flex items-center gap-1 justify-center"
            >
              <CheckCircle size={12} /> Apply
            </button>
          ) : (
            <span className={cn('badge py-1 px-2 text-center text-xs', STATUS_CONFIG[job.application_status]?.bg, STATUS_CONFIG[job.application_status]?.color)}>
              {STATUS_CONFIG[job.application_status]?.label}
            </span>
          )}

          {/* Open external link */}
          {job.application_url && (
            <a
              href={job.application_url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary py-1.5 text-xs flex items-center gap-1 justify-center"
            >
              <ExternalLink size={12} /> Open
            </a>
          )}

          {/* Save / Unsave */}
          <button
            onClick={() => onSave(job)}
            className={cn(
              'btn-secondary py-1.5 text-xs flex items-center gap-1 justify-center',
              job.is_saved ? 'text-violet-600 border-violet-300 bg-violet-50' : '',
            )}
          >
            <Star size={12} className={job.is_saved ? 'fill-violet-600' : ''} />
            {job.is_saved ? 'Saved' : 'Save'}
          </button>

          {/* Hide */}
          <button
            onClick={() => onHide(job.id)}
            className="btn-secondary py-1.5 text-xs text-gray-400 flex items-center gap-1 justify-center"
          >
            <EyeOff size={12} /> Hide
          </button>
        </div>
      </div>
    </div>
  );
}
