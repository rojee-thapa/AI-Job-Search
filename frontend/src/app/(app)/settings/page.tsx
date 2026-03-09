'use client';

import { useEffect, useState } from 'react';
import { Save, Plus, X } from 'lucide-react';
import toast from 'react-hot-toast';
import Header from '../../../components/layout/Header';
import { preferencesApi } from '../../../lib/api';
import type { UserPreferences } from '../../../types';

const VISA_OPTIONS       = ['citizen', 'green_card', 'h1b', 'opt', 'tn', 'e3', 'other', 'no_visa_required'];
const WORK_MODE_OPTIONS  = ['remote', 'hybrid', 'onsite', 'flexible'];
const EMPLOYMENT_OPTIONS = ['full_time', 'part_time', 'contract', 'internship', 'freelance'];
const SENIORITY_OPTIONS  = ['intern', 'new grad', 'junior', 'mid', 'senior', 'lead', 'principal', 'executive'];

function TagInput({ label, value = [], onChange }: { label: string; value: string[]; onChange: (v: string[]) => void }) {
  const [input, setInput] = useState('');

  function add() {
    const trimmed = input.trim();
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed]);
      setInput('');
    }
  }

  return (
    <div>
      <label className="label">{label}</label>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {value.map((v) => (
          <span key={v} className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary-50 text-primary-700 text-sm rounded-lg border border-primary-200">
            {v}
            <button onClick={() => onChange(value.filter((x) => x !== v))} className="hover:text-primary-900"><X size={12} /></button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())}
          placeholder={`Add ${label.toLowerCase()}...`}
          className="input flex-1"
        />
        <button onClick={add} className="btn-secondary py-2 px-3"><Plus size={16} /></button>
      </div>
    </div>
  );
}

function CheckboxGroup({ label, options, value = [], onChange }: {
  label: string; options: string[]; value: string[]; onChange: (v: string[]) => void;
}) {
  function toggle(opt: string) {
    onChange(value.includes(opt) ? value.filter((v) => v !== opt) : [...value, opt]);
  }
  return (
    <div>
      <label className="label">{label}</label>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            key={opt}
            onClick={() => toggle(opt)}
            className={`px-3 py-1.5 text-sm rounded-lg border font-medium transition-all ${
              value.includes(opt)
                ? 'bg-primary-600 text-white border-primary-600'
                : 'bg-white text-gray-600 border-gray-300 hover:border-primary-400'
            }`}
          >
            {opt.replace(/_/g, ' ')}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const [prefs, setPrefs] = useState<Partial<UserPreferences>>({
    target_roles: [], preferred_locations: [], remote_ok: true,
    min_salary: null, max_salary: null, visa_status: 'citizen',
    requires_sponsorship: false, employment_types: ['full_time'],
    work_modes: ['remote', 'hybrid'], excluded_companies: [],
    daily_application_limit: 10, auto_apply_enabled: false,
    min_match_score: 70, alert_hour: 8,
    // New fields
    role_seniority: [], degree_required: false, degree_subjects: [],
  });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    preferencesApi.get()
      .then((r) => setPrefs(r.data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function update<K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) {
    setPrefs((prev) => ({ ...prev, [key]: value }));
  }

  async function save() {
    setSaving(true);
    try {
      await preferencesApi.update(prefs);
      toast.success('Preferences saved!');
    } catch { toast.error('Failed to save preferences'); }
    finally { setSaving(false); }
  }

  if (loading) return <div className="flex-1 flex items-center justify-center"><p className="text-gray-400">Loading...</p></div>;

  return (
    <>
      <Header
        title="Settings"
        subtitle="Configure your job search preferences and automation"
        actions={
          <button onClick={save} disabled={saving} className="btn-primary">
            <Save size={15} />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        }
      />

      <main className="flex-1 p-6 max-w-3xl space-y-6">
        {/* Job Preferences */}
        <div className="card p-6 space-y-5">
          <h2 className="text-base font-semibold text-gray-900 border-b border-gray-100 pb-3">Job Preferences</h2>
          <TagInput label="Target Roles" value={prefs.target_roles || []} onChange={(v) => update('target_roles', v)} />
          <TagInput label="Preferred Locations" value={prefs.preferred_locations || []} onChange={(v) => update('preferred_locations', v)} />
          <CheckboxGroup label="Work Mode" options={WORK_MODE_OPTIONS} value={prefs.work_modes || []} onChange={(v) => update('work_modes', v as any)} />
          <CheckboxGroup label="Employment Type" options={EMPLOYMENT_OPTIONS} value={prefs.employment_types || []} onChange={(v) => update('employment_types', v as any)} />
          <CheckboxGroup label="Target Seniority Level" options={SENIORITY_OPTIONS} value={prefs.role_seniority || []} onChange={(v) => update('role_seniority', v as any)} />

          <div className="flex items-center gap-3">
            <input type="checkbox" id="remote_ok" checked={!!prefs.remote_ok} onChange={(e) => update('remote_ok', e.target.checked)} className="w-4 h-4 accent-primary-600" />
            <label htmlFor="remote_ok" className="text-sm text-gray-700 cursor-pointer">Open to remote opportunities</label>
          </div>
        </div>

        {/* Salary & Visa */}
        <div className="card p-6 space-y-5">
          <h2 className="text-base font-semibold text-gray-900 border-b border-gray-100 pb-3">Salary & Visa</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Min Salary (USD/year)</label>
              <input type="number" value={prefs.min_salary || ''} onChange={(e) => update('min_salary', Number(e.target.value) || null)} placeholder="80000" className="input" />
            </div>
            <div>
              <label className="label">Max Salary (USD/year)</label>
              <input type="number" value={prefs.max_salary || ''} onChange={(e) => update('max_salary', Number(e.target.value) || null)} placeholder="150000" className="input" />
            </div>
          </div>
          <div>
            <label className="label">Visa Status</label>
            <select value={prefs.visa_status || 'citizen'} onChange={(e) => update('visa_status', e.target.value as any)} className="input">
              {VISA_OPTIONS.map((v) => <option key={v} value={v}>{v.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-3">
            <input type="checkbox" id="sponsorship" checked={!!prefs.requires_sponsorship} onChange={(e) => update('requires_sponsorship', e.target.checked)} className="w-4 h-4 accent-primary-600" />
            <label htmlFor="sponsorship" className="text-sm text-gray-700 cursor-pointer">I require visa sponsorship</label>
          </div>
        </div>

        {/* Degree Preferences */}
        <div className="card p-6 space-y-4">
          <h2 className="text-base font-semibold text-gray-900 border-b border-gray-100 pb-3">Education</h2>
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="degree_required"
              checked={!!prefs.degree_required}
              onChange={(e) => update('degree_required', e.target.checked)}
              className="w-4 h-4 accent-primary-600"
            />
            <label htmlFor="degree_required" className="text-sm text-gray-700 cursor-pointer">
              I have a degree (helps match degree-required roles)
            </label>
          </div>
          <TagInput
            label="Degree Subjects (e.g. Computer Science, Mathematics)"
            value={prefs.degree_subjects || []}
            onChange={(v) => update('degree_subjects', v)}
          />
        </div>

        {/* Automation */}
        <div className="card p-6 space-y-5">
          <h2 className="text-base font-semibold text-gray-900 border-b border-gray-100 pb-3">Automation</h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">Auto-Apply</p>
              <p className="text-xs text-gray-500">Automatically apply to top-matched jobs daily</p>
            </div>
            <button
              onClick={() => update('auto_apply_enabled', !prefs.auto_apply_enabled)}
              className={`relative w-12 h-6 rounded-full transition-colors ${prefs.auto_apply_enabled ? 'bg-primary-600' : 'bg-gray-300'}`}
            >
              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${prefs.auto_apply_enabled ? 'translate-x-7' : 'translate-x-1'}`} />
            </button>
          </div>

          <div>
            <label className="label">Daily Application Limit: <span className="font-bold">{prefs.daily_application_limit}</span></label>
            <input
              type="range" min={1} max={50} step={1}
              value={prefs.daily_application_limit || 10}
              onChange={(e) => update('daily_application_limit', Number(e.target.value))}
              className="w-full mt-1"
            />
            <div className="flex justify-between text-xs text-gray-400"><span>1</span><span>50</span></div>
          </div>

          <div>
            <label className="label">Minimum Match Score: <span className="font-bold">{prefs.min_match_score}%</span></label>
            <input
              type="range" min={0} max={100} step={5}
              value={prefs.min_match_score || 70}
              onChange={(e) => update('min_match_score', Number(e.target.value))}
              className="w-full mt-1"
            />
          </div>
        </div>

        {/* Exclusions */}
        <div className="card p-6 space-y-4">
          <h2 className="text-base font-semibold text-gray-900 border-b border-gray-100 pb-3">Exclusions</h2>
          <TagInput label="Excluded Companies" value={prefs.excluded_companies || []} onChange={(v) => update('excluded_companies', v)} />
        </div>

        {/* Alerts */}
        <div className="card p-6 space-y-4">
          <h2 className="text-base font-semibold text-gray-900 border-b border-gray-100 pb-3">Daily Alerts</h2>
          <div>
            <label className="label">Alert Email (optional override)</label>
            <input
              type="email"
              value={prefs.alert_email || ''}
              onChange={(e) => update('alert_email', e.target.value || null as any)}
              placeholder="Leave blank to use your account email"
              className="input"
            />
          </div>
          <div>
            <label className="label">Alert Time (24h): <span className="font-bold">{prefs.alert_hour}:00</span></label>
            <input
              type="range" min={0} max={23} step={1}
              value={prefs.alert_hour || 8}
              onChange={(e) => update('alert_hour', Number(e.target.value))}
              className="w-full mt-1"
            />
          </div>
        </div>

        <button onClick={save} disabled={saving} className="btn-primary px-8 py-2.5">
          <Save size={16} />
          {saving ? 'Saving...' : 'Save All Settings'}
        </button>
      </main>
    </>
  );
}
