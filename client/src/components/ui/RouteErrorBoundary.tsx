import React from 'react';
import { useRouteError, isRouteErrorResponse, Link } from 'react-router-dom';
import { Card } from './Card.tsx';
import { Button } from './Button.tsx';
import { AlertCircle, RotateCcw, Home } from 'lucide-react';

export const RouteErrorBoundary: React.FC = () => {
  const error = useRouteError();
  let errorMessage = 'An unexpected error occurred while loading this view.';

  if (isRouteErrorResponse(error)) {
    errorMessage = error.statusText || error.data?.message || errorMessage;
  } else if (error instanceof Error) {
    errorMessage = error.message;
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        padding: '24px',
      }}
    >
      <Card
        style={{
          maxWidth: '520px',
          width: '100%',
          padding: '32px 28px',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
        }}
      >
        <div
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            backgroundColor: 'var(--danger-light)',
            color: 'var(--danger)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <AlertCircle size={24} />
        </div>

        <div>
          <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
            Something went wrong
          </h3>
          <p
            style={{
              fontSize: 'var(--text-sm)',
              color: 'var(--text-secondary)',
              marginTop: '8px',
              lineHeight: 1.5,
            }}
          >
            {errorMessage}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
          <Button
            variant="primary"
            size="md"
            leftIcon={<RotateCcw size={16} />}
            onClick={() => window.location.reload()}
          >
            Reload Page
          </Button>
          <Link to="/app/dashboard" style={{ textDecoration: 'none' }}>
            <Button variant="secondary" size="md" leftIcon={<Home size={16} />}>
              Go to Dashboard
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
};

