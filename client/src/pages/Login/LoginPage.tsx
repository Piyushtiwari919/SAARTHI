import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Compass, Lock, Mail, ArrowRight } from 'lucide-react';
import { Button } from '../../components/ui/Button.tsx';
import { Input } from '../../components/ui/Input.tsx';
import { Card } from '../../components/ui/Card.tsx';
import { useAuth } from '../../hooks/useAuth.ts';
import { useToast } from '../../hooks/useToast.ts';
import { USE_MOCKS } from '../../services/api.ts';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const toast = useToast();

  const [email, setEmail] = useState(USE_MOCKS ? 'priya.sharma@nit.ac.in' : '');
  const [password, setPassword] = useState(USE_MOCKS ? 'password123' : '');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error('Please enter your institutional email');
      return;
    }

    setIsLoading(true);
    try {
      await login({ email, password });
      toast.success('Signed in successfully', 'Welcome back!');
      navigate('/app/dashboard');
    } catch {
      toast.error('Could not authenticate. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setIsLoading(true);
    try {
      await login({ email: 'priya.sharma@nit.ac.in', password: 'demo' });
      toast.success('Signed in as demo student (Priya Sharma)');
      navigate('/app/dashboard');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--bg-primary)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '24px',
      }}
    >
      <div style={{ width: '100%', maxWidth: '420px', marginBottom: '24px', textAlign: 'center' }}>
        <Link
          to="/"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            textDecoration: 'none',
            color: 'var(--text-primary)',
            marginBottom: '16px',
          }}
        >
          <div
            style={{
              width: '34px',
              height: '34px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--brand-primary)',
              color: 'var(--text-inverse)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Compass size={18} />
          </div>
          <span style={{ fontSize: 'var(--text-xl)', fontWeight: 700 }}>Saarthi</span>
        </Link>

        <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 6px 0' }}>
          Student Sign In
        </h2>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: 0 }}>
          Access your opportunity navigator and private document vault
        </p>
      </div>

      <Card style={{ width: '100%', maxWidth: '420px', padding: '28px' }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Input
            label="Institutional / Student Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="student@institution.ac.in"
            leftIcon={<Mail size={16} />}
            required
          />

          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            leftIcon={<Lock size={16} />}
            required
          />

          <Button
            type="submit"
            variant="primary"
            size="md"
            isLoading={isLoading}
            rightIcon={<ArrowRight size={16} />}
            style={{ width: '100%', marginTop: '4px' }}
          >
            Sign In to Dashboard
          </Button>

          {USE_MOCKS && (
            <>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  margin: '8px 0',
                }}
              >
                <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-subtle)' }} />
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>OR</span>
                <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-subtle)' }} />
              </div>

              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={handleDemoLogin}
                disabled={isLoading}
                style={{ width: '100%' }}
              >
                Sign In with Demo Student Profile
              </Button>
            </>
          )}
        </form>

        <div
          style={{
            marginTop: '20px',
            paddingTop: '16px',
            borderTop: '1px solid var(--border-subtle)',
            textAlign: 'center',
            fontSize: 'var(--text-xs)',
            color: 'var(--text-secondary)',
          }}
        >
          Don't have an account yet?{' '}
          <Link to="/signup" style={{ fontWeight: 600, color: 'var(--brand-primary)' }}>
            Register as a student
          </Link>
        </div>
      </Card>

      <div
        style={{
          marginTop: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: 'var(--text-xs)',
          color: 'var(--text-muted)',
        }}
      >
        <Lock size={12} />
        <span>Authenticated student session with private document storage</span>
      </div>
    </div>
  );
};
