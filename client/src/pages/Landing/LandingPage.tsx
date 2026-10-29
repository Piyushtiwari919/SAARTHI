import React from 'react';
import { Link } from 'react-router-dom';
import { Compass, ShieldCheck, FileCheck2, Search, ArrowRight, Lock, BookOpen } from 'lucide-react';
import { Button } from '../../components/ui/Button.tsx';
import { Badge } from '../../components/ui/Badge.tsx';
import { Card } from '../../components/ui/Card.tsx';

export const LandingPage: React.FC = () => {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-primary)', display: 'flex', flexDirection: 'column' }}>
      {/* Header Navigation */}
      <header
        style={{
          borderBottom: '1px solid var(--border)',
          backgroundColor: 'var(--surface)',
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      >
        <div
          style={{
            maxWidth: 'var(--max-content-width)',
            margin: '0 auto',
            padding: '16px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--brand-primary)',
                color: 'var(--text-inverse)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Compass size={20} />
            </div>
            <div>
              <span style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em', display: 'block' }}>
                Saarthi
              </span>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Student Opportunity Navigator
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Link to="/login">
              <Button variant="ghost" size="sm">Sign In</Button>
            </Link>
            <Link to="/signup">
              <Button variant="primary" size="sm" rightIcon={<ArrowRight size={14} />}>
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section
        style={{
          padding: '64px 24px 48px 24px',
          maxWidth: '880px',
          margin: '0 auto',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '20px',
        }}
      >
        <Badge variant="brand" size="md" icon={<ShieldCheck size={14} />}>
          AI-Powered Document Intelligence for Students
        </Badge>

        <h1
          style={{
            fontSize: 'clamp(2rem, 4vw, 2.75rem)',
            fontWeight: 700,
            color: 'var(--text-primary)',
            letterSpacing: '-0.025em',
            lineHeight: 1.2,
          }}
        >
          Navigate scholarships with source-grounded clarity, not guesswork.
        </h1>

        <p
          style={{
            fontSize: 'var(--text-lg)',
            color: 'var(--text-secondary)',
            lineHeight: 1.6,
            maxWidth: '680px',
            margin: '0 auto',
          }}
        >
          Saarthi reads government and institutional scholarship circulars, extracts structured eligibility criteria,
          and compares them against your uploaded documents with page-level evidence.
        </p>

        <div style={{ display: 'flex', gap: '14px', marginTop: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <Link to="/signup">
            <Button size="lg" rightIcon={<ArrowRight size={16} />}>
              Explore Your Opportunities
            </Button>
          </Link>
          <Link to="/app/dashboard">
            <Button variant="outline" size="lg">
              Open Dashboard
            </Button>
          </Link>
        </div>

        {/* Calm Privacy Callout */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: 'var(--text-xs)',
            color: 'var(--text-muted)',
            marginTop: '8px',
          }}
        >
          <Lock size={12} style={{ color: 'var(--brand-primary)' }} />
          <span>Privacy First: Private server storage. Documents are used solely for your eligibility evaluation.</span>
        </div>
      </section>

      {/* Structured Process Architecture */}
      <section
        style={{
          maxWidth: 'var(--max-content-width)',
          margin: '32px auto 64px auto',
          padding: '0 24px',
          width: '100%',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <h2 style={{ fontSize: 'var(--text-2xl)', fontWeight: 600, marginBottom: '8px' }}>
            How Saarthi Works
          </h2>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
            Transparent evaluation built on extracted evidence rather than black-box guesses.
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '20px',
          }}
        >
          <Card style={{ padding: '24px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--surface-muted)',
                color: 'var(--brand-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px',
              }}
            >
              <FileCheck2 size={20} />
            </div>
            <h3 style={{ fontSize: 'var(--text-md)', fontWeight: 600, marginBottom: '8px' }}>
              1. Document Vault
            </h3>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Upload your marksheet, income proof, or certificates. Background workers extract structured student attributes with page citations.
            </p>
          </Card>

          <Card style={{ padding: '24px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--surface-muted)',
                color: 'var(--brand-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px',
              }}
            >
              <Search size={20} />
            </div>
            <h3 style={{ fontSize: 'var(--text-md)', fontWeight: 600, marginBottom: '8px' }}>
              2. Opportunity Extraction
            </h3>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Scholarship circulars and government schemes are parsed into structured eligibility rules (income limits, academic score thresholds).
            </p>
          </Card>

          <Card style={{ padding: '24px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--surface-muted)',
                color: 'var(--brand-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px',
              }}
            >
              <ShieldCheck size={20} />
            </div>
            <h3 style={{ fontSize: 'var(--text-md)', fontWeight: 600, marginBottom: '8px' }}>
              3. Evidence-Backed Audit
            </h3>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              View your eligibility result as PASS, FAIL, or UNKNOWN with specific document page references and deterministic rule comparisons.
            </p>
          </Card>

          <Card style={{ padding: '24px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--surface-muted)',
                color: 'var(--brand-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px',
              }}
            >
              <BookOpen size={20} />
            </div>
            <h3 style={{ fontSize: 'var(--text-md)', fontWeight: 600, marginBottom: '8px' }}>
              4. Document RAG Assistant
            </h3>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Ask specific questions regarding renewal criteria or application clauses, with citations pulled directly from the scholarship document.
            </p>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer
        style={{
          marginTop: 'auto',
          borderTop: '1px solid var(--border)',
          backgroundColor: 'var(--surface)',
          padding: '24px',
        }}
      >
        <div
          style={{
            maxWidth: 'var(--max-content-width)',
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Compass size={16} style={{ color: 'var(--brand-primary)' }} />
            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>Saarthi</span>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
              — Academic Opportunity & Document Navigator
            </span>
          </div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
            Designed for transparent, evidence-backed student financial support.
          </div>
        </div>
      </footer>
    </div>
  );
};
