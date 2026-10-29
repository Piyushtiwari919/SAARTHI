import React, { useEffect, useState, useCallback } from 'react';
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
  CheckCircle2,
} from 'lucide-react';
import { PageHeader } from '../../components/layout/PageHeader.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card.tsx';
import { Badge } from '../../components/ui/Badge.tsx';
import { LoadingState } from '../../components/ui/LoadingState.tsx';
import { ErrorState } from '../../components/ui/ErrorState.tsx';
import {
  DocumentCard,
  formatAttributeDisplayValue,
  getDisplayableAttributes,
} from '../../components/documents/DocumentCard.tsx';
import { EligibilityStatusBadge } from '../../components/eligibility/EligibilityStatusBadge.tsx';
import { useAuth } from '../../hooks/useAuth.ts';
import { useToast } from '../../hooks/useToast.ts';
import { documentService } from '../../services/document.service.ts';
import { opportunityService } from '../../services/opportunity.service.ts';
import { eligibilityService } from '../../services/eligibility.service.ts';
import { USE_MOCKS } from '../../services/api.ts';
import type { Document, ExtractedAttribute } from '../../types/document.ts';
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

  const loadDashboardData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [docsRes, oppsRes, eligRes, actionsRes] = await Promise.allSettled([
        documentService.getDocuments(),
        opportunityService.getOpportunities(),
        eligibilityService.getAllEligibilitySummaries(),
        eligibilityService.getActionItems(),
      ]);

      const docsData = docsRes.status === 'fulfilled' ? docsRes.value : [];
      const oppsData = oppsRes.status === 'fulfilled' ? oppsRes.value : [];
      const eligData = eligRes.status === 'fulfilled' ? eligRes.value : [];
      const actionsData = actionsRes.status === 'fulfilled' ? actionsRes.value : [];

      setDocuments(docsData);
      setOpportunities(oppsData);
      setEligibilitySummaries(eligData);
      setActionItems(actionsData);
    } catch {
      setError('Unable to load dashboard intelligence. Please try refreshing.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();

    const unsubscribe = documentService.subscribe(() => {
      documentService.getDocuments().then((docs) => {
        setDocuments(docs);
      });
    });

    return () => {
      unsubscribe();
    };
  }, [loadDashboardData]);

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
    return <LoadingState message="Loading your documents and scholarship catalogue..." fullHeight />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={loadDashboardData} />;
  }

  // Map opportunity ID to eligibility result
  const eligibilityMap = new Map(eligibilitySummaries.map((item) => [item.opportunityId, item]));

  // Documents processing count
  const processingCount = documents.filter(
    (doc) => doc.status !== 'READY' && doc.status !== 'FAILED'
  ).length;

  const eligibleCount = eligibilitySummaries.filter(
    (item) => item.overallStatus === 'PASS'
  ).length;

  const inReviewCount = eligibilitySummaries.filter(
    (item) => item.overallStatus === 'UNKNOWN' || item.overallStatus === 'NOT_VERIFIED'
  ).length;

  // Aggregate only genuinely extracted, non-empty attributes across user documents
  const allExtractedAttributes: Array<ExtractedAttribute & { docName: string }> = [];
  for (const doc of documents) {
    const docName = doc.customTitle || doc.fileName;
    const validAttrs = getDisplayableAttributes(doc.extractedAttributes);
    for (const attr of validAttrs) {
      allExtractedAttributes.push({ ...attr, docName });
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* Page Header */}
      <PageHeader
        title={`Welcome back, ${user?.fullName?.split(' ')[0] || 'Student'}`}
        description={`${user?.academicDetails?.course || 'Student Applicant'}${user?.academicDetails?.institution ? ` • ${user.academicDetails.institution}` : ''}`}
        actions={
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {USE_MOCKS && (
              <Badge variant="neutral" size="sm">
                Demo Mode
              </Badge>
            )}
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
              Scholarship Catalogue
            </span>
            <div style={{ color: 'var(--brand-primary)' }}>
              <GraduationCap size={18} />
            </div>
          </div>
          <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 700, color: 'var(--text-primary)' }}>
            {opportunities.length}
          </div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            {eligibilitySummaries.length === 0 ? (
              <span>Not evaluated yet</span>
            ) : (
              <>
                <span style={{ color: 'var(--success)' }}>{eligibleCount} Eligible</span>
                <span>• {inReviewCount} Needs Evidence</span>
              </>
            )}
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
              `${documents.filter((d) => d.status === 'READY').length} documents ready`
            )}
          </div>
        </Card>

        <Card style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', fontWeight: 500 }}>
              Extracted Attributes
            </span>
            <div style={{ color: 'var(--brand-primary)' }}>
              <ShieldCheck size={18} />
            </div>
          </div>
          <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 700, color: 'var(--text-primary)' }}>
            {allExtractedAttributes.length}
          </div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: '4px' }}>
            Extracted from your uploaded documents
          </div>
        </Card>

        <Card style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', fontWeight: 500 }}>
              Action Items
            </span>
            <div style={{ color: actionItems.length > 0 ? 'var(--warning)' : 'var(--text-muted)' }}>
              {actionItems.length > 0 ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
            </div>
          </div>
          <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 700, color: 'var(--text-primary)' }}>
            {actionItems.length}
          </div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: '4px' }}>
            {actionItems.length > 0
              ? 'From evaluated scholarship requirements'
              : eligibilitySummaries.length > 0
                ? 'All evaluated criteria satisfied'
                : 'Run an eligibility audit to generate actions'}
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
        {/* Left Column: Top Opportunities */}
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
                <CardTitle>Public Scholarship Catalogue</CardTitle>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                  Evaluate your extracted document evidence against scholarship rules
                </span>
              </div>
              <Link to="/app/opportunities">
                <Button variant="ghost" size="sm" rightIcon={<ArrowRight size={14} />}>
                  View All
                </Button>
              </Link>
            </CardHeader>

            <CardContent style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '0 24px 20px 24px' }}>
              {opportunities.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>
                  No active opportunities found in directory.
                </div>
              ) : (
                opportunities.slice(0, 3).map((opp) => {
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
                        {eligibility ? (
                          <EligibilityStatusBadge status={eligibility.overallStatus} size="sm" />
                        ) : (
                          <Badge variant="neutral" size="sm">Not Evaluated</Badge>
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
                })
              )}
            </CardContent>
          </Card>

          {/* Extracted Attributes Preview */}
          <Card>
            <CardHeader>
              <CardTitle style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={18} style={{ color: 'var(--brand-primary)' }} />
                <span>Extracted Document Attributes</span>
              </CardTitle>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                Fields extracted from your uploaded documents with page provenance
              </span>
            </CardHeader>
            <CardContent>
              {allExtractedAttributes.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--text-xs)', backgroundColor: 'var(--surface-muted)', borderRadius: 'var(--radius-sm)' }}>
                  No attributes extracted yet. Upload your marksheets, registration forms, or certificates in the Document Vault.
                </div>
              ) : (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: '12px',
                  }}
                >
                  {allExtractedAttributes.slice(0, 6).map((attr) => (
                    <div key={attr.id} style={{ padding: '12px', backgroundColor: 'var(--surface-muted)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                        {attr.label || attr.field}
                      </div>
                      <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>
                        {formatAttributeDisplayValue(attr)}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--brand-primary)', marginTop: '4px' }}>
                        Source: {attr.docName} {attr.sourcePage ? `(p.${attr.sourcePage})` : ''}
                      </div>
                    </div>
                  ))}
                </div>
              )}
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
                  Real-time status of your uploaded documents
                </span>
              </div>
              <Link to="/app/documents">
                <Button variant="ghost" size="sm" rightIcon={<ArrowRight size={14} />}>
                  Manage
                </Button>
              </Link>
            </CardHeader>

            <CardContent style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '0 24px 20px 24px' }}>
              {documents.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>
                  No documents in vault. Click "Upload Document" to get started.
                </div>
              ) : (
                documents.slice(0, 3).map((doc) => (
                  <DocumentCard
                    key={doc.id}
                    document={doc}
                    onView={(d) => navigate(`/app/documents/${d.id}`)}
                    onDelete={handleDeleteDocument}
                    onRetry={handleRetryDocument}
                  />
                ))
              )}
            </CardContent>
          </Card>

          {/* Action Items Panel */}
          <Card>
            <CardHeader>
              <CardTitle>Personalized Action Plan</CardTitle>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                Items generated when you evaluate scholarship opportunities
              </span>
            </CardHeader>
            <CardContent style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {actionItems.length === 0 ? (
                <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--text-xs)', backgroundColor: 'var(--surface-muted)', borderRadius: 'var(--radius-sm)' }}>
                  {eligibilitySummaries.length === 0
                    ? 'No eligibility evaluations run yet. Open Eligibility Check to evaluate opportunities against your documents.'
                    : 'All evaluated criteria verified. Ready to apply!'}
                </div>
              ) : (
                actionItems.slice(0, 3).map((item) => (
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
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
