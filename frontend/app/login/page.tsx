'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { EXTERNAL_WORKFORCE_LABELS } from '@/lib/external-workforce-labels';
import DemoLoginPersonas from '@/components/auth/DemoLoginPersonas';
import { DEMO_PRIMARY_LOGINS } from '@/lib/demo-login-personas';
import { isConnectorDemoUiEnabled } from '@/lib/demo-mode';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      router.push('/dashboard');
    } catch (err: any) {
      const message =
        err.response?.data?.message || 'Login failed. Please try again.';
      const hint =
        message === 'Invalid credentials'
          ? ' If this is a fresh Docker/local DB, run: docker compose exec backend npx prisma db seed'
          : '';
      setError(`${message}${hint}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-page">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow-lg">
        <div>
          <h2 className="text-center text-3xl font-extrabold text-content">
            {EXTERNAL_WORKFORCE_LABELS.product}
          </h2>
          <p className="mt-2 text-center text-sm text-content-muted">
            Sign in to {EXTERNAL_WORKFORCE_LABELS.productPlatform}
          </p>
        </div>

        <DemoLoginPersonas
          onSelect={(nextEmail, nextPassword) => {
            setEmail(nextEmail);
            setPassword(nextPassword);
            setError('');
          }}
        />

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 border border-red-400 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="label">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                className="input"
                placeholder={isConnectorDemoUiEnabled() ? DEMO_PRIMARY_LOGINS.operations.email : 'you@example.com'}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="password" className="label">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </div>

          <div className="text-center text-sm">
            <span className="text-gray-600">Don't have an account? </span>
            <Link href="/register" className="link-brand">
              Register here
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
