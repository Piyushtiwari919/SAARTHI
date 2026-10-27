import React, { useState } from 'react';
import { PageHeader } from '../../components/layout/PageHeader.tsx';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { Input } from '../../components/ui/Input.tsx';
import { useAuth } from '../../hooks/useAuth.ts';
import { useToast } from '../../hooks/useToast.ts';
import { Shield, Lock } from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const { user } = useAuth();
  const toast = useToast();

  const [fullName, setFullName] = useState(user?.fullName || '');
  const [email] = useState(user?.email || '');
  const [institution, setInstitution] = useState(user?.academicDetails?.institution || '');
  const [course, setCourse] = useState(user?.academicDetails?.course || '');
  const [shareConsent, setShareConsent] = useState(user?.privacyConsent?.shareWithInstitutions || false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success('Your settings and privacy preferences have been updated');
  };

  return (
    <div>
      <PageHeader
        title="Account & Privacy Settings"
        description="Manage your verified profile attributes and control how your document vault operates."
      />

      <div style={{ maxWidth: '680px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <Card>
          <CardHeader>
            <CardTitle>Academic Profile Details</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <Input
                label="Full Name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />

              <Input
                label="Verified Institutional Email"
                value={email}
                disabled
                helperText="Email verified through student domain lookup"
              />

              <Input
                label="Institution"
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
              />

              <Input
                label="Degree / Major"
                value={course}
                onChange={(e) => setCourse(e.target.value)}
              />

              <Button type="submit" variant="primary" style={{ alignSelf: 'flex-start' }}>
                Save Profile Changes
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Privacy Controls Card */}
        <Card>
          <CardHeader>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Lock size={18} style={{ color: 'var(--brand-primary)' }} />
              <CardTitle>Confidentiality & Vault Controls</CardTitle>
            </div>
          </CardHeader>
          <CardContent style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                padding: '12px 14px',
                backgroundColor: 'var(--surface-muted)',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              <input
                type="checkbox"
                id="shareConsent"
                checked={shareConsent}
                onChange={(e) => setShareConsent(e.target.checked)}
                style={{ marginTop: '3px', accentColor: 'var(--brand-primary)', cursor: 'pointer' }}
              />
              <label
                htmlFor="shareConsent"
                style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', lineHeight: 1.4, cursor: 'pointer' }}
              >
                <strong style={{ color: 'var(--text-primary)' }}>Direct Application Auto-Fill:</strong> Allow Saarthi to securely export verified document attributes directly to official government portal forms when you initiate an application.
              </label>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
              <Shield size={14} style={{ color: 'var(--brand-primary)' }} />
              <span>Documents are stored in encrypted cold storage and automatically expire after your degree completion.</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
