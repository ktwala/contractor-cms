export default function BootstrapLoading() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)',
        color: 'white',
        padding: '2rem',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          marginBottom: '1.5rem',
        }}
      >
        <div
          style={{
            width: '48px',
            height: '48px',
            background: 'rgba(255,255,255,0.1)',
            borderRadius: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid rgba(255,255,255,0.2)',
          }}
        >
          <svg
            width="28"
            height="28"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
            />
          </svg>
        </div>
        <div>
          <span
            style={{
              fontSize: '1.35rem',
              fontWeight: 700,
              display: 'block',
            }}
          >
            Hubsec Workforce
          </span>
          <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>
            Administration
          </span>
        </div>
      </div>
      <p
        style={{
          fontSize: '0.95rem',
          opacity: 0.85,
          margin: 0,
        }}
      >
        Checking environment setup…
      </p>
      <div
        style={{
          marginTop: '1.5rem',
          width: 32,
          height: 32,
          border: '3px solid rgba(255,255,255,0.2)',
          borderTopColor: 'white',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }}
      />
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
