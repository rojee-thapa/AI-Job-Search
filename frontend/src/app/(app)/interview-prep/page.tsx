'use client';

import { useEffect, useState } from 'react';
import { Mic, Plus, ChevronDown, ChevronUp, Star, BookOpen, Code, Users, Building } from 'lucide-react';
import toast from 'react-hot-toast';
import Header from '../../../components/layout/Header';
import { interviewApi, jobsApi } from '../../../lib/api';
import { cn, formatDate } from '../../../lib/utils';
import type { InterviewSession, Job } from '../../../types';

const QUESTION_TYPE_CONFIG = {
  technical:         { label: 'Technical',       icon: Code,     color: 'bg-blue-50 border-blue-200 text-blue-700' },
  behavioural:       { label: 'Behavioural',     icon: Users,    color: 'bg-purple-50 border-purple-200 text-purple-700' },
  system_design:     { label: 'System Design',   icon: BookOpen, color: 'bg-amber-50 border-amber-200 text-amber-700' },
  company_specific:  { label: 'Company-Specific',icon: Building, color: 'bg-green-50 border-green-200 text-green-700' },
};

export default function InterviewPrepPage() {
  const [sessions, setSessions] = useState<InterviewSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<InterviewSession | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [creating, setCreating] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [expandedQ, setExpandedQ] = useState<string | null>(null);
  const [practiceMode, setPracticeMode] = useState<string | null>(null);
  const [practiceAnswer, setPracticeAnswer] = useState('');
  const [feedback, setFeedback] = useState<any>(null);
  const [evaluating, setEvaluating] = useState(false);
  const [activeTab, setActiveTab] = useState<'technical' | 'behavioural' | 'system_design' | 'company_specific'>('technical');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    Promise.all([
      interviewApi.list().then((r) => setSessions(r.data.data)),
      jobsApi.list({ limit: 50, min_score: 60 }).then((r) => setJobs(r.data.data.jobs)),
    ]).finally(() => setLoading(false));
  }, []);

  async function createSession() {
    if (!selectedJobId) { toast.error('Select a job first'); return; }
    setGenerating(true);
    try {
      const res = await interviewApi.createSession({ job_id: selectedJobId });
      const newSession = res.data.data;
      setSessions((prev) => [newSession, ...prev]);
      setSelectedSession(newSession);
      setCreating(false);
      toast.success('Interview prep session created!');
    } catch { toast.error('Failed to create session'); }
    finally { setGenerating(false); }
  }

  async function loadSession(id: string) {
    try {
      const res = await interviewApi.get(id);
      setSelectedSession(res.data.data);
    } catch { toast.error('Failed to load session'); }
  }

  async function evaluateAnswer(question: string) {
    if (!practiceAnswer.trim()) { toast.error('Enter your answer first'); return; }
    setEvaluating(true);
    try {
      const res = await interviewApi.evaluate({ question, answer: practiceAnswer, job_id: selectedSession!.job_id || '' });
      setFeedback(res.data.data);
    } catch { toast.error('Evaluation failed'); }
    finally { setEvaluating(false); }
  }

  const questions = selectedSession?.questions;

  return (
    <>
      <Header
        title="Interview Prep"
        subtitle="AI-generated company-specific questions and coaching"
        actions={
          <button onClick={() => setCreating(true)} className="btn-primary">
            <Plus size={15} /> New Session
          </button>
        }
      />

      <main className="flex-1 p-6 flex gap-6">
        {/* Session List */}
        <div className="w-64 flex-shrink-0 space-y-2">
          {creating && (
            <div className="card p-4 space-y-3">
              <p className="text-sm font-medium text-gray-900">New Prep Session</p>
              <select value={selectedJobId} onChange={(e) => setSelectedJobId(e.target.value)} className="input text-sm py-1.5">
                <option value="">Select a job...</option>
                {jobs.map((j) => (
                  <option key={j.id} value={j.id}>{j.company} — {j.role}</option>
                ))}
              </select>
              <div className="flex gap-2">
                <button onClick={createSession} disabled={generating} className="btn-primary flex-1 py-1.5 text-xs justify-center">
                  {generating ? 'Generating...' : 'Generate'}
                </button>
                <button onClick={() => setCreating(false)} className="btn-secondary py-1.5 text-xs">Cancel</button>
              </div>
            </div>
          )}

          {sessions.map((s) => (
            <button
              key={s.id}
              onClick={() => { setSelectedSession(s); loadSession(s.id); setExpandedQ(null); setFeedback(null); }}
              className={cn(
                'w-full text-left card p-3 transition-all hover:shadow-md',
                selectedSession?.id === s.id ? 'ring-2 ring-primary-500' : '',
              )}
            >
              <p className="font-medium text-sm text-gray-900 truncate">{s.company}</p>
              <p className="text-xs text-gray-500 truncate">{s.role}</p>
              <p className="text-xs text-gray-400 mt-1">{formatDate(s.created_at)}</p>
            </button>
          ))}

          {sessions.length === 0 && !loading && (
            <div className="card p-6 text-center">
              <Mic size={28} className="text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No sessions yet</p>
              <p className="text-xs text-gray-400 mt-1">Click "New Session" to start</p>
            </div>
          )}
        </div>

        {/* Question View */}
        {selectedSession && questions ? (
          <div className="flex-1 min-w-0 space-y-4">
            {/* Session Header */}
            <div className="card p-5">
              <h2 className="text-lg font-semibold text-gray-900">{selectedSession.company}</h2>
              <p className="text-primary-700">{selectedSession.role}</p>
              {questions.company_brief && (
                <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-2 gap-3 text-xs text-gray-600">
                  <div><span className="font-medium">Culture:</span> {(questions.company_brief as any).culture_values?.slice(0, 2).join(', ')}</div>
                  <div><span className="font-medium">Stack:</span> {(questions.company_brief as any).tech_stack?.slice(0, 4).join(', ')}</div>
                </div>
              )}
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
              {(Object.keys(QUESTION_TYPE_CONFIG) as Array<keyof typeof QUESTION_TYPE_CONFIG>).map((type) => {
                const { label, icon: Icon } = QUESTION_TYPE_CONFIG[type];
                const count = (questions[type] as any[])?.length || 0;
                return (
                  <button
                    key={type}
                    onClick={() => setActiveTab(type)}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-all flex-1 justify-center',
                      activeTab === type ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700',
                    )}
                  >
                    <Icon size={13} />{label}
                    <span className="bg-gray-200 text-gray-600 rounded-full px-1.5 py-0.5 text-xs">{count}</span>
                  </button>
                );
              })}
            </div>

            {/* Questions */}
            <div className="space-y-3">
              {((questions[activeTab] as any[]) || []).map((q, i) => {
                const qKey = `${activeTab}-${i}`;
                const isExpanded = expandedQ === qKey;
                const isPracticing = practiceMode === qKey;

                return (
                  <div key={qKey} className={cn('card border overflow-hidden', QUESTION_TYPE_CONFIG[activeTab]?.color.split(' ')[0])}>
                    <button className="w-full px-5 py-4 text-left flex items-start justify-between gap-4" onClick={() => { setExpandedQ(isExpanded ? null : qKey); setFeedback(null); }}>
                      <div className="flex items-start gap-3 min-w-0">
                        <span className="font-bold text-gray-400 text-sm flex-shrink-0 mt-0.5">Q{i + 1}</span>
                        <p className="text-sm font-medium text-gray-900 leading-snug">{q.question}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {q.difficulty && (
                          <span className={cn('badge text-xs', q.difficulty === 'hard' ? 'bg-red-100 text-red-700' : q.difficulty === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700')}>
                            {q.difficulty}
                          </span>
                        )}
                        {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="px-5 pb-5 border-t border-gray-100 pt-4 space-y-3">
                        <div className="bg-gray-50 rounded-lg p-4">
                          <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Suggested Answer</p>
                          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{q.suggested_answer}</p>
                        </div>

                        {q.tips && (
                          <div className="bg-amber-50 rounded-lg p-3">
                            <p className="text-xs font-semibold text-amber-700 mb-1">Tips</p>
                            <p className="text-xs text-amber-800">{q.tips}</p>
                          </div>
                        )}

                        {/* Practice Mode */}
                        {!isPracticing ? (
                          <button onClick={() => { setPracticeMode(qKey); setPracticeAnswer(''); setFeedback(null); }} className="btn-secondary text-xs py-1.5">
                            <Star size={12} /> Practice Answer
                          </button>
                        ) : (
                          <div className="space-y-2">
                            <p className="text-xs font-medium text-gray-700">Your Answer:</p>
                            <textarea
                              value={practiceAnswer}
                              onChange={(e) => setPracticeAnswer(e.target.value)}
                              rows={4}
                              className="input text-sm resize-y"
                              placeholder="Type your answer here..."
                            />
                            <div className="flex gap-2">
                              <button onClick={() => evaluateAnswer(q.question)} disabled={evaluating} className="btn-primary text-xs py-1.5">
                                {evaluating ? 'Evaluating...' : 'Get AI Feedback'}
                              </button>
                              <button onClick={() => { setPracticeMode(null); setFeedback(null); }} className="btn-secondary text-xs py-1.5">Cancel</button>
                            </div>
                            {feedback && (
                              <div className="mt-3 space-y-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-semibold">Score: {feedback.score}/10</span>
                                  <div className="h-2 flex-1 bg-gray-100 rounded-full">
                                    <div className="h-full bg-primary-500 rounded-full" style={{ width: `${feedback.score * 10}%` }} />
                                  </div>
                                </div>
                                {feedback.strengths?.length > 0 && (
                                  <div className="bg-green-50 rounded p-2 text-xs text-green-800">
                                    <p className="font-semibold mb-1">Strengths:</p>
                                    {feedback.strengths.map((s: string, j: number) => <p key={j}>✓ {s}</p>)}
                                  </div>
                                )}
                                {feedback.improvements?.length > 0 && (
                                  <div className="bg-amber-50 rounded p-2 text-xs text-amber-800">
                                    <p className="font-semibold mb-1">Improve:</p>
                                    {feedback.improvements.map((s: string, j: number) => <p key={j}>→ {s}</p>)}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Questions to Ask */}
            {activeTab === 'technical' && questions.questions_to_ask?.length > 0 && (
              <div className="card p-5">
                <h3 className="font-semibold text-gray-900 mb-3">Questions to Ask the Interviewer</h3>
                <ul className="space-y-2">
                  {questions.questions_to_ask.map((q, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                      <span className="text-primary-400 flex-shrink-0 mt-0.5">→</span>{q}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Mic size={48} className="text-gray-200 mx-auto mb-4" />
              <h3 className="text-gray-500 font-medium">Select a session or create a new one</h3>
              <p className="text-sm text-gray-400 mt-1">Get AI-generated interview questions tailored to each company</p>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
