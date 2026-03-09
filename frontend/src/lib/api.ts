import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

export const api = axios.create({
  baseURL: API_BASE,
  timeout: 60000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token from localStorage
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 globally
api.interceptors.response.use(
  (res) => res,
  (err: AxiosError) => {
    if (err.response?.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  },
);

// ─── Auth ────────────────────────────────────────────────────
export const authApi = {
  register: (data: { email: string; password: string; full_name: string }) =>
    api.post('/auth/register', data),
  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data),
  me: () => api.get('/auth/me'),
};

// ─── Resume ──────────────────────────────────────────────────
export const resumeApi = {
  upload: (file: File) => {
    const formData = new FormData();
    formData.append('resume', file);
    return api.post('/resume/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  get: () => api.get('/resume'),
  getTips: () => api.get('/resume/tips'),
  tailor: (jobId: string) => api.post('/resume/tailor', { jobId }),
};

// ─── Jobs ────────────────────────────────────────────────────
export const jobsApi = {
  discover: () => api.post('/jobs/discover'),
  list: (params?: {
    page?: number;
    limit?: number;
    min_score?: number;
    source?: string;
    work_mode?: string;
  }) => api.get('/jobs', { params }),
  saved: (params?: { page?: number; limit?: number }) => api.get('/jobs/saved', { params }),
  get: (id: string) => api.get(`/jobs/${id}`),
  stats: () => api.get('/jobs/stats'),
  hide: (id: string) => api.patch(`/jobs/${id}/hide`),
  save: (id: string, save = true) => api.patch(`/jobs/${id}/save`, { save }),
};

// ─── Applications ────────────────────────────────────────────
export const applicationsApi = {
  list: (params?: { page?: number; limit?: number; status?: string }) =>
    api.get('/applications', { params }),
  stats: () => api.get('/applications/stats'),
  create: (data: { job_id: string; cover_letter?: string; notes?: string }) =>
    api.post('/applications', data),
  updateStatus: (id: string, data: { status: string; notes?: string; interview_at?: string }) =>
    api.patch(`/applications/${id}/status`, data),
  autoApply: (dailyLimit?: number) =>
    api.post('/applications/auto-apply', { daily_limit: dailyLimit }),
  syncSheets: () => api.post('/applications/sync-sheets'),
};

// ─── Email ───────────────────────────────────────────────────
export const emailApi = {
  generateOutreach: (data: {
    job_id: string;
    recruiter?: { name?: string; email?: string; company?: string; title?: string };
    application_id?: string;
  }) => api.post('/email/outreach', data),
  findRecruiter: (company: string, role?: string) =>
    api.get('/email/recruiter-hint', { params: { company, role } }),
  list: (params?: { page?: number; limit?: number; type?: string }) =>
    api.get('/email', { params }),
  sendFollowUps: (days?: number) =>
    api.post('/email/follow-ups', null, { params: { days } }),
  stats: () => api.get('/email/stats'),
};

// ─── Interview ───────────────────────────────────────────────
export const interviewApi = {
  createSession: (data: { job_id: string; application_id?: string }) =>
    api.post('/interview', data),
  list: () => api.get('/interview'),
  get: (id: string) => api.get(`/interview/${id}`),
  evaluate: (data: { question: string; answer: string; job_id: string }) =>
    api.post('/interview/evaluate', data),
  schedule: (data: { application_id: string; scheduled_at: string; notes?: string }) =>
    api.post('/interview/schedule', data),
};

// ─── Tracking ────────────────────────────────────────────────
export const trackingApi = {
  dashboard: () => api.get('/tracking/dashboard'),
  activity: (limit?: number) => api.get('/tracking/activity', { params: { limit } }),
};

// ─── Preferences ─────────────────────────────────────────────
export const preferencesApi = {
  get: () => api.get('/preferences'),
  update: (data: Partial<import('../types').UserPreferences>) =>
    api.put('/preferences', data),
};
