import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Compass, User, Mail, School, BookOpen, ArrowRight, Lock } from 'lucide-react';
import { Button } from '../../components/ui/Button.tsx';
import { Input } from '../../components/ui/Input.tsx';
import { Card } from '../../components/ui/Card.tsx';
import { useAuth } from '../../hooks/useAuth.ts';
import { useToast } from '../../hooks/useToast.ts';

export const SignupPage: React.FC = () => {
  const navigate = useNavigate();
  const { signup } = useAuth();
  const toast = useToast();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('password123');
  const [institution, setInstitution] = useState('');
  const [course, setCourse] = useState('');
  const [agreeToPrivacy, setAgreeToPrivacy] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !email || !institution || !course || !password) {
      toast.error('Please fill in all required academic fields and password');
      return;
    }

    if (password.length < 8) {
      toast.error('Password must be at least 8 characters long');
      return;
    }

    if (!agreeToPrivacy) {
      toast.warning('Please review and accept the student privacy consent');
      return;
    }

    setIsLoading(true);
    try {
      await signup({
        fullName,
        email,
        password,
        institution,
        course,
        agreeToPrivacy,
      });
      toast.success('Account created successfully', 'Welcome to Saarthi!');
      navigate('/app/dashboard');
    } catch (err: any) {
      toast.error(err?.message || 'Could not complete registration. Please try again.');
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
      <div style={{ width: '100%', maxWidth: '480px', marginBottom: '20px', textAlign: 'center' }}>
        <Link
          to="/"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            textDecoration: 'none',
            color: 'var(--text-primary)',
            marginBottom: '14px',
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
          Create Student Account
        </h2>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: 0 }}>
          Set up your academic profile to unlock evidence-backed scholarship discovery
        </p>
      </div>

      <Card style={{ width: '100%', maxWidth: '480px', padding: '28px' }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Input
            label="Full Name"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="e.g. Priya Sharma"
            leftIcon={<User size={16} />}
            required
          />

          <Input
            label="Institutional Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="student@institution.ac.in"
            helperText="We use your college domain to auto-verify institutional eligibility"
            leftIcon={<Mail size={16} />}
            required
          />

          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            leftIcon={<Lock size={16} />}
            required
          />

          <Input
            label="College / University Name"
            type="text"
            value={institution}
            onChange={(e) => setInstitution(e.target.value)}
            placeholder="e.g. National Institute of Technology, Nagpur"
            leftIcon={<School size={16} />}
            required
          />

          <Input
            label="Current Degree / Course"
            type="text"
            value={course}
            onChange={(e) => setCourse(e.target.value)}
            placeholder="e.g. B.Tech Computer Science (3rd Year)"
            leftIcon={<BookOpen size={16} />}
            required
          />

          {/* Privacy Consent Box */}
          <div
            style={{
              padding: '12px 14px',
              backgroundColor: 'var(--surface-muted)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
              gap: '10px',
              alignItems: 'flex-start',
            }}
          >
            <input
              type="checkbox"
              id="privacyConsent"
              checked={agreeToPrivacy}
              onChange={(e) => setAgreeToPrivacy(e.target.checked)}
              style={{ marginTop: '3px', cursor: 'pointer', accentColor: 'var(--brand-primary)' }}
            />
            <label
              htmlFor="privacyConsent"
              style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', lineHeight: 1.4, cursor: 'pointer' }}
            >
              <strong style={{ color: 'var(--text-primary)' }}>Student Data Privacy Guarantee:</strong> I consent to Saarthi extracting structured eligibility criteria from documents I choose to upload. My documents remain private to my vault and will never be shared without explicit permission.
            </label>
          </div>

          <Button
            type="submit"
            variant="primary"
            size="md"
            isLoading={isLoading}
            rightIcon={<ArrowRight size={16} />}
            style={{ width: '100%', marginTop: '6px' }}
          >
            Complete Registration
          </Button>
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
          Already registered?{' '}
          <Link to="/login" style={{ fontWeight: 600, color: 'var(--brand-primary)' }}>
            Sign in here
          </Link>
        </div>
      </Card>
    </div>
  );
};
