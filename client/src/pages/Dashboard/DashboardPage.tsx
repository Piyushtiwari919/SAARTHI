import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  GraduationCap,
  FileText,
  ShieldCheck,
  AlertCircle,
  Upload,
  ArrowRight,
  MessageSquareText,
  Clock,
  Sparkles,
} from 'lucide-react';
import { PageHeader } from '../../components/layout/PageHeader.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card.tsx';
import { Badge } from '../../components/ui/Badge.tsx';
import { LoadingState } from '../../components/ui/LoadingState.tsx';
import { ErrorState } from '../../components/ui/ErrorState.tsx';
import { DocumentCard } from '../../components/documents/DocumentCard.tsx';
import { EligibilityStatusBadge } from '../../components/eligibility/EligibilityStatusBadge.tsx';
import { useAuth } from '../../hooks/useAuth.ts';
import { useToast } from '../../hooks/useToast.ts';
import { documentService } from '../../services/document.service.ts';
import { opportunityService } from '../../services/opportunity.service.ts';
import { eligibilityService } from '../../services/eligibility.service.ts';
import type { Document } from '../../types/document.ts';
import type { Opportunity } from '../../types/opportunity.ts';
import type { OpportunityEligibility, ActionItem } from '../../types/eligibility.ts';
import { formatCurrency, formatDate } from '../../utils/formatters.ts';

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [documents, setDocuments] = useState<Document[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [eligibilitySummaries, setEligibilitySummaries] = useState<OpportunityEligibility[]>([]);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboardData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [docsData, oppsData, eligData, actionsData] = await Promise.all([
        documentService.getDocuments(),
        opportunityService.getOpportunities(),
        eligibilityService.getAllEligibilitySummaries(),
        eligibilityService.getActionItems(),
      ]);

      setDocuments(docsData);
      setOpportunities(oppsData);
      setEligibilitySummaries(eligData);
      setActionItems(actionsData);
    } catch {
      setError('Unable to load dashboard intelligence. Please try refreshing.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    const fetchAll = async () => {
      try {
        const [docsData, oppsData, eligData, actionsData] = await Promise.all([
          documentService.getDocuments(),
          opportunityService.getOpportunities(),
          eligibilityService.getAllEligibilitySummaries(),
          eligibilityService.getActionItems(),
        ]);
        if (!ignore) {
          setDocuments(docsData);
          setOpportunities(oppsData);
          setEligibilitySummaries(eligData);
          setActionItems(actionsData);
        }
      } catch {
        if (!ignore) {
          setError('Unable to load dashboard intelligence. Please try refreshing.');
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    };

    fetchAll();

    const unsubscribe = documentService.subscribe(() => {
      documentService.getDocuments().then((docs) => {
        if (!ignore) setDocuments(docs);
      });
    });

    return () => {
      ignore = true;
      unsubscribe();
    };
  }, []);

  const handleRetryDocument = async (doc: Document) => {
    try {
      await documentService.retryDocument(doc.id);
      toast.info(`Retrying processing pipeline for ${doc.customTitle || doc.fileName}`);
    } catch {
      toast.error('Failed to retry document processing');
    }
  };

  const handleDeleteDocument = async (doc: Document) => {
    try {
      await documentService.deleteDocument(doc.id);
      setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
      toast.success(`Removed ${doc.customTitle || doc.fileName} from vault`);
    } catch {
      toast.error('Failed to remove document');
    }
  };

  if (isLoading) {
    return <LoadingState message="Aggregating verified attributes & opportunity rules..." fullHeight />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={loadDashboardData} />;
  }

  // Map opportunity ID to eligibility result
  const eligibilityMap = new Map( eligibilitySummaries.map((item) => [item.opportunityId, item]));

  // Documents processing count
  const processingCount = documents.filter(
    (doc) => doc.status !== 'READY' && doc.status !== 'FAILED'
  ).length;

  const eligibleCount = (eligibilitySummaries ?? []).filter(
  (item) => item.overallStatus === 'ELIGIBLE'
).length;

const inReviewCount = (eligibilitySummaries ?? []).filter(
  (item) => item.overallStatus === 'IN_REVIEW'
).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* Page Header */}
      <PageHeader
        title={`Welcome back, ${user?.fullName?.split(' ')[0] || 'Student'}`}
        description={`${user?.academicDetails?.course || 'Undergraduate'} • ${user?.academicDetails?.institution || 'Academic Institution'}`}
        actions={
          <div style={{ display: 'flex', gap: '10px' }}>
            <Link to="/app/assistant">
              <Button variant="secondary" size="md" leftIcon={<MessageSquareText size={16} />}>
                Ask Document AI
              </Button>
            </Link>
            <Link to="/app/documents">
              <Button variant="primary" size="md" leftIcon={<Upload size={16} />}>
                Upload Document
              </Button>
            </Link>
          </div>
        }
      />

      {/* Top Metric Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
        }}
      >
        <Card style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', fontWeight: 500 }}>
              Matched Opportunities
            </span>
            <div style={{ color: 'var(--brand-primary)' }}>
              <GraduationCap size={18} />
            </div>
          </div>
          <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 700, color: 'var(--text-primary)' }}>
            {opportunities.length}
          </div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--success)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span>{eligibleCount} Verified Eligible</span>
            <span style={{ color: 'var(--text-muted)' }}>• {inReviewCount} In Review</span>
          </div>
        </Card>

        <Card style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', fontWeight: 500 }}>
              Document Vault
            </span>
            <div style={{ color: 'var(--brand-primary)' }}>
              <FileText size={18} />
            </div>
          </div>
          <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 700, color: 'var(--text-primary)' }}>
            {documents.length}
          </div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: '4px' }}>
            {processingCount > 0 ? (
              <span style={{ color: 'var(--warning)', fontWeight: 500 }}>
                {processingCount} processing in background
              </span>
            ) : (
              'All documents verified'
            )}
          </div>
        </Card>

        <Card style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', fontWeight: 500 }}>
              Evidence Attributes
            </span>
            <div style={{ color: 'var(--brand-primary)' }}>
              <ShieldCheck size={18} />
            </div>
          </div>
          <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 700, color: 'var(--text-primary)' }}>
            6
          </div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: '4px' }}>
            Derived from official scanned proofs
          </div>
        </Card>

        <Card style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', fontWeight: 500 }}>
              Required Actions
            </span>
            <div style={{ color: 'var(--warning)' }}>
              <AlertCircle size={18} />
            </div>
          </div>
          <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 700, color: 'var(--text-primary)' }}>
            {actionItems.length}
          </div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: '4px' }}>
            Required for portal submissions
          </div>
        </Card>
      </div>

      {/* Main Grid: Opportunities on Left, Pipeline & Actions on Right */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))',
          gap: '24px',
          alignItems: 'start',
        }}
      >
        {/* Left Column: Top Matched Opportunities */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <Card>
            <CardHeader
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingBottom: '16px',
              }}
            >
              <div>
                <CardTitle>Top Matched Opportunities</CardTitle>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                  Evaluated against your evidence profile
                </span>
              </div>
              <Link to="/app/opportunities">
                <Button variant="ghost" size="sm" rightIcon={<ArrowRight size={14} />}>
                  View All
                </Button>
              </Link>
            </CardHeader>

            <CardContent style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '0 24px 20px 24px' }}>
              {opportunities.slice(0, 3).map((opp) => {
                const eligibility = eligibilityMap.get(opp.id);
                return (
                  <div
                    key={opp.id}
                    style={{
                      padding: '16px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-subtle)',
                      backgroundColor: 'var(--surface-subtle)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                      <div>
                        <span style={{ fontSize: '11px', color: 'var(--brand-primary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          {opp.provider}
                        </span>
                        <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>
                          {opp.title}
                        </h4>
                      </div>
                      {eligibility && (
                        <EligibilityStatusBadge status={eligibility.overallStatus} size="sm" />
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Badge variant="neutral" size="sm">
                          {formatCurrency(opp.amount)}
                        </Badge>
                        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Clock size={12} /> Deadline: {formatDate(opp.deadline)}
                        </span>
                      </div>

                      <Link to="/app/eligibility">
                        <Button variant="outline" size="sm">
                          Audit Rules
                        </Button>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Evidence-Backed User Attributes Preview */}
          <Card>
            <CardHeader>
              <CardTitle style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={18} style={{ color: 'var(--brand-primary)' }} />
                <span>Verified Student Evidence Profile</span>
              </CardTitle>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                Extracted from your uploaded government & university documents
              </span>
            </CardHeader>
            <CardContent>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: '12px',
                }}
              >
                <div style={{ padding: '12px', backgroundColor: 'var(--surface-muted)', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Annual Family Income</div>
                  <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>₹2,40,000 / year</div>
                  <div style={{ fontSize: '10px', color: 'var(--brand-primary)', marginTop: '4px' }}>✓ Tehsildar Income Proof (p.1)</div>
                </div>

                <div style={{ padding: '12px', backgroundColor: 'var(--surface-muted)', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Academic Standing</div>
                  <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>82.5% (8.42 CGPA)</div>
                  <div style={{ fontSize: '10px', color: 'var(--brand-primary)', marginTop: '4px' }}>✓ Semester 4 Grade Card (p.2)</div>
                </div>

                <div style={{ padding: '12px', backgroundColor: 'var(--surface-muted)', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Social Category</div>
                  <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>OBC (Non-Creamy Layer)</div>
                  <div style={{ fontSize: '10px', color: 'var(--warning)', marginTop: '4px' }}>⏳ Worker AI Analyzing...</div>
                </div>

                <div style={{ padding: '12px', backgroundColor: 'var(--surface-muted)', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>State Domicile</div>
                  <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>Maharashtra</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>⏳ OCR Complete</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Recent Documents & Async Processing Pipeline */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <Card>
            <CardHeader
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingBottom: '16px',
              }}
            >
              <div>
                <CardTitle>Vault Documents Pipeline</CardTitle>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                  Real-time status of document workers
                </span>
              </div>
              <Link to="/app/documents">
                <Button variant="ghost" size="sm" rightIcon={<ArrowRight size={14} />}>
                  Manage
                </Button>
              </Link>
            </CardHeader>

            <CardContent style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '0 24px 20px 24px' }}>
              {documents.slice(0, 3).map((doc) => (
                <DocumentCard
                  key={doc.id}
                  document={doc}
                  onView={(d) => navigate(`/app/documents/${d.id}`)}
                  onDelete={handleDeleteDocument}
                  onRetry={handleRetryDocument}
                />
              ))}
            </CardContent>
          </Card>

          {/* Action Items Panel */}
          <Card>
            <CardHeader>
              <CardTitle>Personalized Action Plan</CardTitle>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                Items required to finalize your applications
              </span>
            </CardHeader>
            <CardContent style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {actionItems.slice(0, 2).map((item) => (
                <div
                  key={item.id}
                  style={{
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border)',
                    backgroundColor: 'var(--surface-muted)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {item.title}
                    </span>
                    <Badge variant={item.priority === 'HIGH' ? 'danger' : 'neutral'} size="sm">
                      {item.priority}
                    </Badge>
                  </div>
                  <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
                    {item.description}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
