'use client';

/**
 * Saved Jobs Page
 *
 * Displays all jobs the user has bookmarked/saved.
 * Reuses the same JobCard and JobDetailsDrawer as the main jobs page.
 */

import { useEffect, useState, useCallback } from 'react';
import { RefreshCw, Star, MapPin, DollarSign, Briefcase, ExternalLink, EyeOff, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import Header from '../../../components/layout/Header';
import JobDetailsDrawer from '../../../components/jobs/JobDetailsDrawer';
import { jobsApi, applicationsApi } from '../../../lib/api';
import {
  cn, formatSalary, getScoreColor, getScoreBg,
  getWorkModeLabel, getSourceLabel, formatDate, STATUS_CONFIG,
} from '../../../lib/utils';
import type { Job } from '../../../types';

export default function SavedJobsPage() {
  const [jobs, setJobs]           = useState<Job[]>([]);
  const [total, setTotal]         = useState(0);
  const [page, setPage]           = useState(1);
  const [loading, setLoading]     = useState(true);
  const [drawerJob, setDrawerJob] = useState<Job | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await jobsApi.saved({ page, limit: 20 });
      setJobs(res.data.data.jobs);
      setTotal(res.data.data.total);
    } catch {
      toast.error('Failed to load saved jobs');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { load(); }, [load]);

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

  async function handleUnsave(job: Job) {
    try {
      await jobsApi.save(job.id, false);
      // Remove from saved list
      setJobs((prev) => prev.filter((j) => j.id !== job.id));
      if (drawerJob?.id === job.id) setDrawerJob(null);
      toast.success('Job unsaved');
    } catch {
      toast.error('Failed to unsave job');
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

  async function handleOpenDrawer(job: Job) {
    setDrawerJob(job);
    try {
      const res = await jobsApi.get(job.id);
      setDrawerJob(res.data.data);
    } catch {
      // keep partial data
    }
  }

  return (
    <>
      <Header
        title="Saved Jobs"
        subtitle={`${total} saved job${total !== 1 ? 's' : ''}`}
      />

      <main className="flex-1 p-6">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <RefreshCw size={24} className="animate-spin text-gray-400" />
          </div>
        ) : jobs.length === 0 ? (
          <div className="card p-12 text-center">
            <Star size={40} className="text-gray-300 mx-auto mb-3" />
            <h3 className="text-gray-600 font-medium">No saved jobs yet</h3>
            <p className="text-sm text-gray-400 mt-1">
              Click Save on any job in the Jobs page to bookmark it here.
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {jobs.map((job) => (
              <SavedJobCard
                key={job.id}
                job={job}
                onOpen={() => handleOpenDrawer(job)}
                onApply={handleApply}
                onUnsave={handleUnsave}
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

      <JobDetailsDrawer
        job={drawerJob}
        onClose={() => setDrawerJob(null)}
        onApply={handleApply}
        onSave={handleUnsave}
        onHide={handleHide}
      />
    </>
  );
}

// ─── Saved Job Card ───────────────────────────────────────────

interface CardProps {
  job: Job;
  onOpen: () => void;
  onApply: (job: Job) => void;
  onUnsave: (job: Job) => void;
  onHide: (jobId: string) => void;
}

function SavedJobCard({ job, onOpen, onApply, onUnsave, onHide }: CardProps) {
  return (
    <div
      className={cn('card p-5 border transition-all hover:shadow-md cursor-pointer', getScoreBg(job.overall_score || 0))}
      onClick={onOpen}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4 min-w-0">
          {/* Score ring */}
          <div className={cn('score-ring flex-shrink-0', getScoreBg(job.overall_score || 0))}>
            <span className={cn('font-bold', getScoreColor(job.overall_score || 0))}>
              {Math.round(job.overall_score || 0)}
            </span>
          </div>

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
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          {!job.application_status ? (
            <button
              onClick={() => onApply(job)}
              className="btn-primary py-1.5 text-xs flex items-center gap-1 justify-center"
            >
              <CheckCircle size={12} /> Apply
            </button>
          ) : (
            <span className={cn('badge py-1 px-2 text-xs text-center', STATUS_CONFIG[job.application_status]?.bg, STATUS_CONFIG[job.application_status]?.color)}>
              {STATUS_CONFIG[job.application_status]?.label}
            </span>
          )}
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
          <button
            onClick={() => onUnsave(job)}
            className="btn-secondary py-1.5 text-xs text-violet-600 border-violet-300 bg-violet-50 flex items-center gap-1 justify-center"
          >
            <Star size={12} className="fill-violet-600" /> Saved
          </button>
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
