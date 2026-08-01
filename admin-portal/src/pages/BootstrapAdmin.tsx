import React, { useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../services/api';

function validatePassword(p: string): { valid: boolean; messages: string[] } {
  const messages: string[] = [];
  if (p.length < 12) messages.push('At least 12 characters');
  if (!/[a-z]/.test(p)) messages.push('One lowercase letter');
  if (!/[A-Z]/.test(p)) messages.push('One uppercase letter');
  if (!/\d/.test(p)) messages.push('One number');
  if (!/[@$!%*?&#^()[\]\-_+=.,;:'"`~]/.test(p)) messages.push('One special character (@$!%*?&# etc.)');
  return { valid: messages.length === 0, messages };
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.875rem 1rem',
  background: '#f8fafc',
  border: '2px solid #e2e8f0',
  borderRadius: '12px',
  fontSize: '1rem',
  color: '#1e293b',
  outline: 'none',
  boxSizing: 'border-box',
};

export default function BootstrapAdmin() {
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [createdEmail, setCreatedEmail] = useState('');

  const passwordValidation = useMemo(
    () => (password ? validatePassword(password) : null),
    [password],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    const pv = validatePassword(password);
    if (!pv.valid) {
      setError('Password must meet all requirements: ' + pv.messages.join(', '));
      return;
    }

    setLoading(true);

    try {
      const response = await api.post('/bootstrap/admin', {
        first_name: firstName,
        last_name: lastName,
        email,
        password,
      });

      const { access_token, user } = response.data;

      localStorage.setItem('auth_token', access_token);
      localStorage.setItem('token', access_token);

      const role = Array.isArray(user?.roles) && user.roles.length > 0 ? user.roles[0] : '';
      const permissions = Array.isArray(user?.permissions) ? user.permissions : [];

      localStorage.setItem('role', role);
      localStorage.setItem('admin_permissions', JSON.stringify(permissions));

      setCreatedEmail(email);
      setSuccess(true);

      setTimeout(() => {
        navigate('/enterprise/organisation', { replace: true });
        window.location.reload();
      }, 3000);
    } catch (err: any) {
      setError(
        err.response?.data?.message || 'Failed to create first administrator',
      );
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f8fafc',
          padding: '2rem',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 480,
            background: 'white',
            borderRadius: 24,
            padding: '2.5rem',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.08)',
            border: '1px solid #e2e8f0',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              margin: '0 auto 1.25rem',
              background: '#dcfce7',
              borderRadius: 14,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="28" height="28" fill="none" stroke="#16a34a" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.5rem' }}>
            Administrator Created
          </h1>
          <p style={{ color: '#64748b', lineHeight: 1.6, marginBottom: '0.25rem' }}>
            Your account has been created and you are now signed in.
          </p>
          <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
            {createdEmail}
          </p>
          <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
            Redirecting to the dashboard...
          </p>
          <button
            type="button"
            onClick={() => { navigate('/enterprise/organisation', { replace: true }); window.location.reload(); }}
            style={{
              width: '100%',
              padding: '1rem',
              background: '#1e293b',
              color: 'white',
              border: 'none',
              borderRadius: 12,
              fontSize: '1rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f8fafc',
        padding: '2rem',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 520,
          background: 'white',
          borderRadius: 24,
          padding: '2.5rem',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.08)',
          border: '1px solid #e2e8f0',
        }}
      >
        <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
          <h1
            style={{
              fontSize: '1.8rem',
              fontWeight: 800,
              color: '#1e293b',
              marginBottom: '0.5rem',
            }}
          >
            Create First Administrator
          </h1>
          <p style={{ color: '#64748b', lineHeight: 1.5 }}>
            This environment has no users yet. Create the first administrator to
            start configuring Hubsec Workforce Platform.
          </p>
          <p
            style={{
              color: '#94a3b8',
              fontSize: '0.8rem',
              marginTop: '0.75rem',
            }}
          >
            This setup is only available when no users exist in the environment.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '1rem',
              marginBottom: '1rem',
            }}
          >
            <input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="First name"
              required
              style={inputStyle}
            />
            <input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Last name"
              required
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@company.com"
              required
              style={inputStyle}
            />
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '1rem',
              marginBottom: '0.5rem',
            }}
          >
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password (min 12 chars)"
              required
              minLength={12}
              style={inputStyle}
            />
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm password"
              required
              minLength={12}
              style={inputStyle}
            />
          </div>
          {passwordValidation && !passwordValidation.valid && (
            <div
              style={{
                fontSize: '0.75rem',
                color: '#64748b',
                marginBottom: '1rem',
                padding: '0.5rem 0',
              }}
            >
              Password must have: {passwordValidation.messages.join(', ')}
            </div>
          )}

          {error && (
            <div
              style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#dc2626',
                padding: '0.75rem 1rem',
                borderRadius: 12,
                fontSize: '0.875rem',
                marginBottom: '1rem',
              }}
            >
              {error}
            </div>
          )}

          <p style={{ textAlign: 'center', marginBottom: '1rem' }}>
            <Link to="/login" style={{ fontSize: '0.875rem', color: '#64748b', textDecoration: 'underline' }}>
              Already have an account? Sign in
            </Link>
          </p>
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '1rem',
              background: '#1e293b',
              color: 'white',
              border: 'none',
              borderRadius: 12,
              fontSize: '1rem',
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Creating administrator...' : 'Create Administrator'}
          </button>
        </form>
      </div>
    </div>
  );
}
