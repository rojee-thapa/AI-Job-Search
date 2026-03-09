'use client';

import { useEffect, useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, CheckCircle, AlertCircle, ChevronDown, ChevronUp, FileText, Zap, TrendingUp } from 'lucide-react';
import toast from 'react-hot-toast';
import Header from '../../../components/layout/Header';
import { resumeApi } from '../../../lib/api';
import { cn } from '../../../lib/utils';
import type { Resume, ImprovementTip } from '../../../types';

const PRIORITY_CONFIG = {
  high:   { label: 'High',   color: 'bg-red-100 text-red-700 border-red-200' },
  medium: { label: 'Medium', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  low:    { label: 'Low',    color: 'bg-blue-100 text-blue-700 border-blue-200' },
};

const CATEGORY_ICONS: Record<string, string> = {
  formatting: '🎨', content: '✍️', keywords: '🔑',
  impact: '📈', structure: '🏗️', ats_optimisation: '🤖',
};

export default function ResumePage() {
  const [resume, setResume] = useState<Resume | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [expandedTip, setExpandedTip] = useState<number | null>(null);

  useEffect(() => {
    resumeApi.get().then((r) => setResume(r.data.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setUploading(true);
    try {
      const res = await resumeApi.upload(file);
      setResume(res.data.data);
      toast.success('Resume uploaded and analyzed!');
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'], 'application/msword': ['.doc'], 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'], 'text/plain': ['.txt'] },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024,
  });

  const parsed = resume?.parsed_data;
  const tips = resume?.improvement_tips || [];
  const highPriorityTips = tips.filter((t) => t.priority === 'high');

  return (
    <>
      <Header title="Resume" subtitle="Upload, analyze, and optimize your resume" />

      <main className="flex-1 p-6 space-y-6">
        {/* Upload Area */}
        <div
          {...getRootProps()}
          className={cn(
            'card p-10 text-center cursor-pointer border-2 border-dashed transition-all',
            isDragActive ? 'border-primary-500 bg-primary-50' : 'border-gray-300 hover:border-primary-400 hover:bg-gray-50',
            uploading && 'pointer-events-none opacity-60',
          )}
        >
          <input {...getInputProps()} />
          {uploading ? (
            <>
              <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Zap size={28} className="text-primary-600 animate-pulse" />
              </div>
              <p className="font-medium text-gray-900">Analyzing your resume with AI...</p>
              <p className="text-sm text-gray-500 mt-1">Extracting skills, experience, and generating tips</p>
            </>
          ) : (
            <>
              <div className={cn('w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4', isDragActive ? 'bg-primary-100' : 'bg-gray-100')}>
                <Upload size={28} className={isDragActive ? 'text-primary-600' : 'text-gray-400'} />
              </div>
              <p className="font-medium text-gray-900">{isDragActive ? 'Drop it here!' : 'Drag & drop your resume'}</p>
              <p className="text-sm text-gray-500 mt-1">or <span className="text-primary-600 font-medium">click to browse</span></p>
              <p className="text-xs text-gray-400 mt-2">Supports PDF, DOC, DOCX, TXT · Max 10 MB</p>
            </>
          )}
        </div>

        {resume && parsed && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Parsed Profile */}
            <div className="lg:col-span-2 space-y-4">
              {/* Summary */}
              <div className="card p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center">
                    <FileText size={20} className="text-primary-600" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-gray-900">{parsed.full_name}</h2>
                    <p className="text-sm text-gray-500">{parsed.email} · {parsed.location}</p>
                  </div>
                  <div className="ml-auto text-right">
                    <p className="text-lg font-bold text-gray-900">{parsed.years_of_experience}y exp</p>
                    <p className="text-xs text-gray-500 capitalize">{parsed.seniority_level}</p>
                  </div>
                </div>
                {parsed.summary && <p className="text-sm text-gray-600 leading-relaxed">{parsed.summary}</p>}
              </div>

              {/* Skills */}
              <div className="card p-5">
                <h3 className="font-semibold text-gray-900 mb-3">Skills ({parsed.skills?.length || 0})</h3>
                <div className="flex flex-wrap gap-2">
                  {parsed.skills?.map((skill) => (
                    <span key={skill} className="px-2.5 py-1 bg-primary-50 text-primary-700 text-sm rounded-lg border border-primary-200">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>

              {/* Experience */}
              {parsed.experience?.length > 0 && (
                <div className="card p-5">
                  <h3 className="font-semibold text-gray-900 mb-3">Work Experience</h3>
                  <div className="space-y-4">
                    {parsed.experience.map((exp, i) => (
                      <div key={i} className="border-l-2 border-primary-200 pl-4">
                        <p className="font-medium text-gray-900">{exp.title}</p>
                        <p className="text-sm text-primary-700">{exp.company}</p>
                        <p className="text-xs text-gray-400">{exp.start_date} – {exp.end_date || 'Present'}</p>
                        {exp.achievements?.length > 0 && (
                          <ul className="mt-1 space-y-0.5">
                            {exp.achievements.slice(0, 3).map((a, j) => (
                              <li key={j} className="text-xs text-gray-600 flex gap-1.5">
                                <span className="text-primary-400 flex-shrink-0">•</span>{a}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Improvement Tips */}
            <div className="space-y-4">
              <div className="card p-5">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp size={18} className="text-amber-600" />
                  <h3 className="font-semibold text-gray-900">Improvement Tips</h3>
                </div>
                <p className="text-xs text-gray-500 mb-4">{tips.length} suggestions · {highPriorityTips.length} high priority</p>

                <div className="space-y-2">
                  {tips.map((tip, i) => (
                    <div key={i} className={cn('rounded-lg border p-3 cursor-pointer', PRIORITY_CONFIG[tip.priority]?.color.split(' ').slice(0, 1).join(' '), 'border-gray-200 bg-white hover:bg-gray-50 transition-colors')}>
                      <button className="w-full text-left" onClick={() => setExpandedTip(expandedTip === i ? null : i)}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2 min-w-0">
                            <span className="text-base flex-shrink-0">{CATEGORY_ICONS[tip.category] || '💡'}</span>
                            <p className="text-sm text-gray-800 leading-snug">{tip.suggestion}</p>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <span className={cn('badge text-xs', PRIORITY_CONFIG[tip.priority]?.color)}>
                              {PRIORITY_CONFIG[tip.priority]?.label}
                            </span>
                            {expandedTip === i ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </div>
                        </div>
                      </button>
                      {expandedTip === i && tip.example && (
                        <div className="mt-2 pt-2 border-t border-gray-200">
                          <p className="text-xs text-gray-600 italic">{tip.example}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Stats */}
              <div className="card p-5">
                <h3 className="font-semibold text-gray-900 mb-3">Resume Score</h3>
                <div className="space-y-2">
                  {[
                    { label: 'Skills Listed', value: parsed.skills?.length || 0, max: 20 },
                    { label: 'Work Experience', value: parsed.experience?.length || 0, max: 5 },
                    { label: 'Education', value: parsed.education?.length || 0, max: 2 },
                    { label: 'Certifications', value: parsed.certifications?.length || 0, max: 3 },
                  ].map(({ label, value, max }) => (
                    <div key={label}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-600">{label}</span>
                        <span className="font-medium">{value}/{max}</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full">
                        <div className="h-full bg-primary-500 rounded-full" style={{ width: `${Math.min((value / max) * 100, 100)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
