import { Link } from 'react-router-dom';

type Props = {
  onRetry: () => void;
  retrying: boolean;
};

export default function BootstrapConnectionError({ onRetry, retrying }: Props) {
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
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div
            style={{
              width: 56,
              height: 56,
              margin: '0 auto 1rem',
              background: '#ede9fe',
              borderRadius: 14,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="28" height="28" fill="none" stroke="#7c3aed" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
              />
            </svg>
          </div>
          <h1
            style={{
              fontSize: '1.5rem',
              fontWeight: 700,
              color: '#1e293b',
              marginBottom: '0.5rem',
            }}
          >
            Welcome to Hubsec Workforce
          </h1>
          <p
            style={{
              color: '#64748b',
              lineHeight: 1.6,
              fontSize: '0.95rem',
            }}
          >
            It looks like the platform is starting up or this is a fresh
            environment. You can set up the first administrator, sign in if
            you already have an account, or retry connecting.
          </p>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
          }}
        >
          <Link
            to="/setup/admin"
            style={{
              display: 'block',
              width: '100%',
              padding: '1rem',
              background: '#7c3aed',
              color: 'white',
              border: 'none',
              borderRadius: 12,
              fontSize: '1rem',
              fontWeight: 600,
              textAlign: 'center',
              textDecoration: 'none',
              boxSizing: 'border-box',
            }}
          >
            Create first administrator
          </Link>
          <Link
            to="/login"
            style={{
              display: 'block',
              textAlign: 'center',
              padding: '0.875rem',
              color: '#475569',
              fontWeight: 500,
              textDecoration: 'none',
              border: '1px solid #e2e8f0',
              borderRadius: 12,
            }}
          >
            Sign in
          </Link>
          <button
            type="button"
            onClick={onRetry}
            disabled={retrying}
            style={{
              width: '100%',
              padding: '0.75rem',
              background: 'none',
              color: '#64748b',
              border: 'none',
              borderRadius: 12,
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: retrying ? 'not-allowed' : 'pointer',
              opacity: retrying ? 0.7 : 1,
              textDecoration: 'underline',
            }}
          >
            {retrying ? 'Retrying…' : 'Retry connection'}
          </button>
        </div>
      </div>
    </div>
  );
}
