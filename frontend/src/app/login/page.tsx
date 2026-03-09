'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { authApi } from '../../lib/api';
import { setToken } from '../../lib/auth';
import { cn } from '../../lib/utils';

const loginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password required'),
});

const registerSchema = loginSchema.extend({
  full_name: z.string().min(2, 'Name must be at least 2 characters'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type LoginForm = z.infer<typeof loginSchema>;
type RegisterForm = z.infer<typeof registerSchema>;

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(false);

  const form = useForm<RegisterForm>({
    resolver: zodResolver(mode === 'login' ? loginSchema : registerSchema),
    defaultValues: { email: '', password: '', full_name: '' },
  });

  async function onSubmit(data: RegisterForm) {
    setLoading(true);
    try {
      const fn = mode === 'login' ? authApi.login : authApi.register;
      const res = await fn(data);
      const { token } = res.data.data;
      setToken(token);
      toast.success(mode === 'login' ? 'Welcome back!' : 'Account created!');
      router.push('/dashboard');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-900 via-primary-800 to-primary-700 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-4xl">🤖</span>
          </div>
          <h1 className="text-3xl font-bold text-white">AI Job Agent</h1>
          <p className="text-primary-200 mt-2">Find jobs, apply automatically, land offers</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {/* Tabs */}
          <div className="flex rounded-lg bg-gray-100 p-1 mb-6">
            {(['login', 'register'] as const).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); form.reset(); }}
                className={cn(
                  'flex-1 py-2 text-sm font-medium rounded-md transition-all',
                  mode === m ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700',
                )}
              >
                {m === 'login' ? 'Sign In' : 'Sign Up'}
              </button>
            ))}
          </div>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="label">Full Name</label>
                <input
                  {...form.register('full_name')}
                  placeholder="John Smith"
                  className="input"
                />
                {form.formState.errors.full_name && (
                  <p className="text-red-500 text-xs mt-1">{form.formState.errors.full_name.message}</p>
                )}
              </div>
            )}

            <div>
              <label className="label">Email</label>
              <input
                {...form.register('email')}
                type="email"
                placeholder="john@example.com"
                className="input"
              />
              {form.formState.errors.email && (
                <p className="text-red-500 text-xs mt-1">{form.formState.errors.email.message}</p>
              )}
            </div>

            <div>
              <label className="label">Password</label>
              <input
                {...form.register('password')}
                type="password"
                placeholder={mode === 'register' ? 'Min. 8 characters' : '••••••••'}
                className="input"
              />
              {form.formState.errors.password && (
                <p className="text-red-500 text-xs mt-1">{form.formState.errors.password.message}</p>
              )}
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-2.5 mt-2">
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  {mode === 'login' ? 'Signing in...' : 'Creating account...'}
                </span>
              ) : (
                mode === 'login' ? 'Sign In' : 'Create Account'
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-primary-300 text-sm mt-6">
          Powered by OpenAI + Perplexity AI
        </p>
      </div>
    </div>
  );
}
