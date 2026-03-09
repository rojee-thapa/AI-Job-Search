'use client';

/**
 * JobDetailsDrawer
 *
 * A slide-in right panel that shows full job details, match scores,
 * company AI research summary, and action buttons.
 */

import { useEffect } from 'react';
import {
  X, MapPin, DollarSign, Briefcase, ExternalLink,
  Star, EyeOff, CheckCircle, Building2, Users,
  Code2, BarChart3, ClipboardList, GraduationCap,
} from 'lucide-react';
import { cn, formatSalary, getScoreColor, getScoreBg, getWorkModeLabel, getSourceLabel, formatDate } from '../../lib/utils';
import type { Job } from '../../types';

interface Props {
  job: Job | null;
  onClose: () => void;
  onApply: (job: Job) => void;
  onSave: (job: Job) => void;
  onHide: (jobId: string) => void;
}

export default function JobDetailsDrawer({ job, onClose, onApply, onSave, onHide }: Props) {
  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  if (!job) return null;

  const research = job.company_research;

  const scoreSections = [
    { label: 'Skills',     score: job.skills_score },
    { label: 'Experience', score: job.experience_score },
    { label: 'Salary',     score: job.salary_score },
    { label: 'Location',   score: job.location_score },
    { label: 'Visa',       score: job.visa_score },
  ];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer panel */}
      <aside className="fixed inset-y-0 right-0 z-50 w-[520px] max-w-full bg-white shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className={cn('p-5 border-b', getScoreBg(job.overall_score || 0))}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-gray-900 leading-tight">{job.role}</h2>
              <p className="text-primary-700 font-semibold mt-0.5">{job.company}</p>
              <div className="flex flex-wrap gap-2 mt-2 text-sm text-gray-600">
                {job.location && (
                  <span className="flex items-center gap-1">
                    <MapPin size={13} />{job.location}
                  </span>
                )}
                {(job.salary_min || job.salary_max) && (
                  <span className="flex items-center gap-1">
                    <DollarSign size={13} />{formatSalary(job.salary_min, job.salary_max)}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Briefcase size={13} />{getWorkModeLabel(job.work_mode)}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                <span className="badge bg-gray-100 text-gray-500">{getSourceLabel(job.source)}</span>
                {job.visa_sponsorship && (
                  <span className="badge bg-purple-100 text-purple-700">Visa Sponsored</span>
                )}
                {job.posted_at && (
                  <span className="badge bg-gray-100 text-gray-400">Posted {formatDate(job.posted_at)}</span>
                )}
              </div>
            </div>

            {/* Overall score ring */}
            <div className="flex-shrink-0 text-center">
              <div className={cn('score-ring', getScoreBg(job.overall_score || 0))}>
                <span className={cn('font-bold text-lg', getScoreColor(job.overall_score || 0))}>
                  {Math.round(job.overall_score || 0)}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-1">Match</p>
            </div>

            <button onClick={onClose} className="flex-shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors ml-2">
              <X size={18} />
            </button>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 mt-4">
            {!job.application_status || job.application_status === 'saved' ? (
              <button
                onClick={() => onApply(job)}
                className="btn-primary py-1.5 text-sm flex-1"
              >
                <CheckCircle size={14} /> Apply
              </button>
            ) : (
              <span className="text-sm text-gray-500 py-1.5 px-3 bg-white rounded-lg border border-gray-200">
                {job.application_status}
              </span>
            )}
            {job.application_url && (
              <a
                href={job.application_url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary py-1.5 text-sm flex-1 text-center"
              >
                <ExternalLink size={14} /> Open
              </a>
            )}
            <button
              onClick={() => onSave(job)}
              className={cn(
                'btn-secondary py-1.5 text-sm px-3',
                job.is_saved ? 'text-violet-600 border-violet-300 bg-violet-50' : '',
              )}
              title={job.is_saved ? 'Unsave' : 'Save'}
            >
              <Star size={14} className={job.is_saved ? 'fill-violet-600' : ''} />
              {job.is_saved ? 'Saved' : 'Save'}
            </button>
            <button
              onClick={() => { onHide(job.id); onClose(); }}
              className="btn-secondary py-1.5 text-sm px-3 text-gray-400"
              title="Hide job"
            >
              <EyeOff size={14} />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* Match Score Breakdown */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Match Score Breakdown</h3>
            <div className="grid grid-cols-5 gap-2">
              {scoreSections.map(({ label, score }) => (
                <div key={label} className="text-center">
                  <div className={cn('text-base font-bold', getScoreColor(score || 0))}>
                    {Math.round(score || 0)}%
                  </div>
                  <div className="text-xs text-gray-400">{label}</div>
                </div>
              ))}
            </div>
          </section>

          {/* Skills */}
          {(job.matched_skills?.length || job.missing_skills?.length) && (
            <section>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Skills</h3>
              <div className="flex flex-wrap gap-1.5">
                {job.matched_skills?.map((s) => (
                  <span key={s} className="text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full">
                    ✓ {s}
                  </span>
                ))}
                {job.missing_skills?.map((s) => (
                  <span key={s} className="text-xs bg-red-50 text-red-600 border border-red-200 px-2 py-0.5 rounded-full">
                    − {s}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* Degree Requirements */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
              <GraduationCap size={14} /> Degree Requirements
            </h3>
            <p className="text-sm text-gray-600">
              {extractDegreeInfo(job.description)}
            </p>
          </section>

          {/* Job Description */}
          {job.description && (
            <section>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Job Description</h3>
              <p className="text-sm text-gray-600 whitespace-pre-line leading-relaxed">
                {job.description.length > 1200
                  ? job.description.slice(0, 1200) + '…'
                  : job.description}
              </p>
            </section>
          )}

          {/* Company Research */}
          {research ? (
            <section className="border-t pt-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
                <Building2 size={14} /> Company Research
                <span className="text-xs font-normal text-gray-400 ml-1">AI-generated</span>
              </h3>

              <div className="space-y-3">
                {/* Overview */}
                <p className="text-sm text-gray-600">{research.overview}</p>

                {/* Quick stats */}
                <div className="grid grid-cols-2 gap-3">
                  <InfoPill icon={<Briefcase size={12} />} label="Industry" value={research.industry} />
                  <InfoPill icon={<Users size={12} />} label="Employees" value={research.size} />
                  {research.headquarters && (
                    <InfoPill icon={<MapPin size={12} />} label="HQ" value={research.headquarters} />
                  )}
                  {research.founded && (
                    <InfoPill icon={<Building2 size={12} />} label="Founded" value={research.founded} />
                  )}
                </div>

                {/* Hiring difficulty */}
                <div className="flex items-center gap-2">
                  <BarChart3 size={13} className="text-gray-400" />
                  <span className="text-xs text-gray-500">Hiring difficulty:</span>
                  <span className={cn('text-xs font-semibold', {
                    'text-green-600': research.hiring_difficulty === 'Easy',
                    'text-yellow-600': research.hiring_difficulty === 'Medium',
                    'text-orange-600': research.hiring_difficulty === 'Hard',
                    'text-red-600': research.hiring_difficulty === 'Very Hard',
                  })}>
                    {research.hiring_difficulty}
                  </span>
                </div>

                {/* Tech stack */}
                {research.tech_stack?.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-500 flex items-center gap-1 mb-1.5">
                      <Code2 size={12} /> Tech Stack
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {research.tech_stack.map((t) => (
                        <span key={t} className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Interview process */}
                {research.interview_process?.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-500 flex items-center gap-1 mb-1.5">
                      <ClipboardList size={12} /> Interview Process
                    </p>
                    <ol className="space-y-1">
                      {research.interview_process.map((step, i) => (
                        <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                          <span className="flex-shrink-0 w-4 h-4 rounded-full bg-primary-100 text-primary-700 text-xs flex items-center justify-center font-medium mt-0.5">
                            {i + 1}
                          </span>
                          {step}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                {/* Culture */}
                {research.culture && (
                  <p className="text-xs text-gray-500 italic border-l-2 border-gray-200 pl-3">
                    {research.culture}
                  </p>
                )}
              </div>
            </section>
          ) : (
            <section className="border-t pt-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                <Building2 size={14} /> Company Research
              </h3>
              <p className="text-sm text-gray-400">
                Company research is generated automatically after job discovery. Check back shortly.
              </p>
            </section>
          )}
        </div>
      </aside>
    </>
  );
}

/** Small info pill used inside company research */
function InfoPill({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <span className="text-gray-400">{icon}</span>
      <span className="text-gray-500">{label}:</span>
      <span className="text-gray-700 font-medium">{value}</span>
    </div>
  );
}

/** Extract degree requirement text from job description */
function extractDegreeInfo(description: string | null): string {
  if (!description) return 'Not specified';
  const lower = description.toLowerCase();

  const patterns: [RegExp, string][] = [
    [/phd|doctorate/i, "PhD / Doctorate preferred"],
    [/master'?s?\s+degree|msc|m\.s\./i, "Master's degree preferred"],
    [/bachelor'?s?\s+degree|bsc|b\.s\.|b\.e\.|b\.tech/i, "Bachelor's degree required"],
    [/associate'?s?\s+degree/i, "Associate's degree required"],
    [/no\s+degree\s+required|degree\s+not\s+required|without\s+a\s+degree/i, "No degree required"],
    [/degree\s+preferred/i, "Degree preferred"],
    [/degree\s+required/i, "Degree required"],
  ];

  for (const [re, label] of patterns) {
    if (re.test(lower)) return label;
  }

  return 'Not specified in description';
}
