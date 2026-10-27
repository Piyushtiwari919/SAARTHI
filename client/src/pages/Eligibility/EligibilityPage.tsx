import React, { useEffect, useState } from 'react';
import { PageHeader } from '../../components/layout/PageHeader.tsx';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card.tsx';
import { EligibilityStatusBadge } from '../../components/eligibility/EligibilityStatusBadge.tsx';
import { LoadingState } from '../../components/ui/LoadingState.tsx';
import { FileText, CheckCircle2, XCircle, HelpCircle, ShieldCheck } from 'lucide-react';
import { eligibilityService } from '../../services/eligibility.service.ts';
import type { OpportunityEligibility, EligibilityRequirement } from '../../types/eligibility.ts';

export const EligibilityPage: React.FC = () => {
  const [eligibilityList, setEligibilityList] = useState<OpportunityEligibility[]>([]);
  const [selectedEvaluation, setSelectedEvaluation] = useState<OpportunityEligibility | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    eligibilityService.getAllEligibilitySummaries().then((list) => {
      setEligibilityList(list);
      if (list.length > 0) {
        setSelectedEvaluation(list[0]);
      }
      setIsLoading(false);
    });
  }, []);

  if (isLoading) {
    return <LoadingState message="Loading structured eligibility rules & audit trails..." fullHeight />;
  }

  const getStatusIcon = (status: EligibilityRequirement['status']) => {
    switch (status) {
      case 'PASS':
        return <CheckCircle2 size={16} style={{ color: 'var(--success)' }} />;
      case 'FAIL':
        return <XCircle size={16} style={{ color: 'var(--danger)' }} />;
      case 'NOT_VERIFIED':
      default:
        return <HelpCircle size={16} style={{ color: 'var(--warning)' }} />;
    }
  };

  return (
    <div>
      <PageHeader
        title="Eligibility Audit & Verification"
        description="Transparent rule-by-rule audit showing verified mathematical comparisons and source document page citations."
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
        {/* Left Column: List of Evaluated Opportunities */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h3 style={{ fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
            Evaluated Opportunities ({eligibilityList.length})
          </h3>

          {eligibilityList.map((evalItem) => {
            const isSelected = selectedEvaluation?.opportunityId === evalItem.opportunityId;
            return (
              <Card
                key={evalItem.opportunityId}
                variant={isSelected ? 'default' : 'muted'}
                onClick={() => setSelectedEvaluation(evalItem)}
                style={{
                  cursor: 'pointer',
                  borderColor: isSelected ? 'var(--brand-primary)' : 'var(--border)',
                  backgroundColor: isSelected ? 'var(--surface)' : 'var(--surface-muted)',
                  padding: '16px',
                  boxShadow: isSelected ? 'var(--shadow-md)' : 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
                  <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {evalItem.opportunityTitle}
                  </h4>
                  <EligibilityStatusBadge status={evalItem.overallStatus} size="sm" />
                </div>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: '6px', margin: 0 }}>
                  {evalItem.summary}
                </p>
              </Card>
            );
          })}
        </div>

        {/* Right Column: Detailed Requirement Breakdown for Selected Evaluation */}
        {selectedEvaluation && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <Card>
              <CardHeader>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--brand-primary)', fontWeight: 600, textTransform: 'uppercase' }}>
                      Detailed Audit Trail
                    </span>
                    <CardTitle style={{ marginTop: '2px' }}>
                      {selectedEvaluation.opportunityTitle}
                    </CardTitle>
                  </div>
                  <EligibilityStatusBadge status={selectedEvaluation.overallStatus} size="md" />
                </div>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginTop: '8px', margin: 0 }}>
                  {selectedEvaluation.summary}
                </p>
              </CardHeader>

              <CardContent style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Rule-by-Rule Criteria Check
                </h4>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {selectedEvaluation.requirements.map((req) => (
                    <div
                      key={req.id}
                      style={{
                        padding: '14px 16px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: 'var(--surface-subtle)',
                        border: '1px solid var(--border-subtle)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {getStatusIcon(req.status)}
                          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {req.fieldLabel}
                          </span>
                        </div>
                        <EligibilityStatusBadge status={req.status} size="sm" />
                      </div>

                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                          gap: '8px',
                          backgroundColor: 'var(--surface)',
                          padding: '8px 12px',
                          borderRadius: 'var(--radius-xs)',
                          border: '1px solid var(--border-subtle)',
                          fontSize: 'var(--text-xs)',
                        }}
                      >
                        <div>
                          <span style={{ color: 'var(--text-muted)' }}>Required: </span>
                          <strong style={{ color: 'var(--text-primary)' }}>
                            {req.operator} {String(req.expectedValue)}
                          </strong>
                        </div>
                        <div>
                          <span style={{ color: 'var(--text-muted)' }}>Actual Value: </span>
                          <strong style={{ color: req.status === 'PASS' ? 'var(--success)' : 'var(--text-primary)' }}>
                            {req.actualValue != null ? String(req.actualValue) : 'Not extracted'}
                          </strong>
                        </div>
                      </div>

                      <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
                        {req.explanation}
                      </p>

                      {req.sourceDocumentName && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--brand-primary)', marginTop: '2px' }}>
                          <FileText size={12} />
                          <span>
                            Evidence: {req.sourceDocumentName} {req.sourcePage ? `(Page ${req.sourcePage})` : ''}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Missing documents callout */}
                {selectedEvaluation.missingDocuments.length > 0 && (
                  <div
                    style={{
                      marginTop: '8px',
                      padding: '12px 14px',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'var(--warning-light)',
                      border: '1px solid var(--warning-border)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                    }}
                  >
                    <HelpCircle size={18} style={{ color: 'var(--warning)', flexShrink: 0 }} />
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                      <strong>Missing verification document:</strong>{' '}
                      {selectedEvaluation.missingDocuments.join(', ')} required to complete final submission.
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: 'var(--text-xs)',
                color: 'var(--text-muted)',
                padding: '0 8px',
              }}
            >
              <ShieldCheck size={14} style={{ color: 'var(--brand-primary)' }} />
              <span>Verifications are computed purely by server-side rule engines against your verified vault evidence.</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
