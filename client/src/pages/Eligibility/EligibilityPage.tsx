import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../../components/layout/PageHeader.tsx';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { Badge } from '../../components/ui/Badge.tsx';
import { EligibilityStatusBadge } from '../../components/eligibility/EligibilityStatusBadge.tsx';
import { LoadingState } from '../../components/ui/LoadingState.tsx';
import { EmptyState } from '../../components/ui/EmptyState.tsx';
import {
  FileText,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ShieldCheck,
  PlayCircle,
  Upload,
  BookOpen,
} from 'lucide-react';
import { eligibilityService } from '../../services/eligibility.service.ts';
import { useToast } from '../../hooks/useToast.ts';
import type { OpportunityEligibility, EligibilityRequirement } from '../../types/eligibility.ts';

export const EligibilityPage: React.FC = () => {
  const [eligibilityList, setEligibilityList] = useState<OpportunityEligibility[]>([]);
  const [selectedEvaluation, setSelectedEvaluation] = useState<OpportunityEligibility | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();
  const toast = useToast();

  const loadEvaluations = useCallback(async () => {
    try {
      const list = await eligibilityService.getAllEligibilitySummaries();
      setEligibilityList(list);
      if (list.length > 0) {
        setSelectedEvaluation((prev) => {
          if (!prev) return list[0];
          const updated = list.find((item) => item.opportunityId === prev.opportunityId);
          return updated || list[0];
        });
      }
    } catch (err: any) {
      setError(err?.message || 'Could not load eligibility evaluations from server.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEvaluations();
  }, [loadEvaluations]);

  const handleEvaluateSingle = async (oppId: string) => {
    setIsEvaluating(true);
    try {
      const res = await eligibilityService.evaluateOpportunity(oppId);
      toast.success(`Evaluated ${res.opportunityTitle}: ${res.overallStatus}`, 'Evaluation Complete');
      await loadEvaluations();
      setSelectedEvaluation(res);
    } catch (err: any) {
      toast.error(err?.message || 'Evaluation failed');
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleEvaluateAll = async () => {
    setIsEvaluating(true);
    try {
      const list = await eligibilityService.evaluateAllOpportunities();
      setEligibilityList(list);
      if (list.length > 0) {
        setSelectedEvaluation(list[0]);
      }
      toast.success(`Evaluated all active opportunities against verified evidence!`, 'Evaluations Updated');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to evaluate opportunities');
    } finally {
      setIsEvaluating(false);
    }
  };

  if (isLoading) {
    return <LoadingState message="Loading structured eligibility rules & audit trails..." fullHeight />;
  }

  const getStatusIcon = (status: EligibilityRequirement['status']) => {
    switch (status) {
      case 'PASS':
        return <CheckCircle2 size={16} style={{ color: 'var(--success)' }} />;
      case 'FAIL':
        return <XCircle size={16} style={{ color: 'var(--danger)' }} />;
      case 'UNKNOWN':
      case 'NOT_VERIFIED':
      default:
        return <HelpCircle size={16} style={{ color: 'var(--warning)' }} />;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <PageHeader
        title="Eligibility Audit & Verification"
        description="Transparent rule-by-rule audit showing verified mathematical comparisons and source document page citations."
        actions={
          <div style={{ display: 'flex', gap: '10px' }}>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleEvaluateAll}
              isLoading={isEvaluating}
              leftIcon={<PlayCircle size={15} />}
            >
              Run Full Audit
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => navigate('/app/documents')}
              leftIcon={<Upload size={15} />}
            >
              Upload More Evidence
            </Button>
          </div>
        }
      />

      {error ? (
        <Card style={{ padding: '24px', backgroundColor: 'var(--surface-muted)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--danger)' }}>
            <XCircle size={20} />
            <span>{error}</span>
          </div>
        </Card>
      ) : eligibilityList.length === 0 ? (
        <EmptyState
          icon={<FileText size={40} />}
          title="No eligibility evaluations available"
          description="Click 'Run Full Audit' to compare your uploaded personal & educational documents against opportunity rules."
          action={
            <Button variant="primary" onClick={handleEvaluateAll} isLoading={isEvaluating} leftIcon={<PlayCircle size={16} />}>
              Evaluate Available Opportunities
            </Button>
          }
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px', alignItems: 'start' }}>
          {/* Left Column: List of Evaluated Opportunities */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
              <h3 style={{ fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--text-secondary)', margin: 0 }}>
                Evaluated Opportunities ({eligibilityList.length})
              </h3>
              <Badge variant="neutral" size="sm">
                Rule Engine
              </Badge>
            </div>

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
                    transition: 'all var(--transition-fast)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
                    <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                      {evalItem.opportunityTitle}
                    </h4>
                    <EligibilityStatusBadge status={evalItem.overallStatus} size="sm" />
                  </div>
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: '8px', margin: 0 }}>
                    {evalItem.summary}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '10px', fontSize: '11px', color: 'var(--text-muted)' }}>
                    <span>{evalItem.requirements.length} Rules Checked</span>
                    {evalItem.missingDocuments.length > 0 && (
                      <span style={{ color: 'var(--warning)', fontWeight: 500 }}>
                        {evalItem.missingDocuments.length} missing docs
                      </span>
                    )}
                  </div>
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
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleEvaluateSingle(selectedEvaluation.opportunityId)}
                        isLoading={isEvaluating}
                        leftIcon={<PlayCircle size={14} />}
                      >
                        Re-Audit
                      </Button>
                      <EligibilityStatusBadge status={selectedEvaluation.overallStatus} size="md" />
                    </div>
                  </div>
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginTop: '8px', margin: 0 }}>
                    {selectedEvaluation.summary}
                  </p>
                </CardHeader>

                <CardContent style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
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
                              {req.operator} {String(req.expectedValue)} {req.unit ? ` ${req.unit}` : ''}
                            </strong>
                          </div>
                          <div>
                            <span style={{ color: 'var(--text-muted)' }}>Actual Evidence: </span>
                            <strong style={{ color: req.status === 'PASS' ? 'var(--success)' : 'var(--text-primary)' }}>
                              {req.actualValue != null ? String(req.actualValue) : 'Not extracted'}{' '}
                              {req.unit && req.actualValue != null ? ` ${req.unit}` : ''}
                            </strong>
                          </div>
                        </div>

                        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
                          {req.explanation}
                        </p>

                        {(req.sourceDocumentName || req.sourceDocumentId) && (
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              fontSize: '11px',
                              color: 'var(--brand-primary)',
                              marginTop: '2px',
                            }}
                          >
                            <BookOpen size={12} />
                            <span>
                              Evidence Source: {req.sourceDocumentName || `Document ID: ${req.sourceDocumentId}`}{' '}
                              {req.sourcePage ? `(Page ${req.sourcePage})` : ''}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Missing documents callout */}
                  {selectedEvaluation.missingDocuments && selectedEvaluation.missingDocuments.length > 0 && (
                    <div
                      style={{
                        marginTop: '8px',
                        padding: '12px 14px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: 'var(--warning-light)',
                        border: '1px solid var(--warning-border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '10px',
                        flexWrap: 'wrap',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <HelpCircle size={18} style={{ color: 'var(--warning)', flexShrink: 0 }} />
                        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                          <strong>Missing required document:</strong>{' '}
                          {selectedEvaluation.missingDocuments.join(', ')} required to complete final submission.
                        </span>
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => navigate('/app/documents')}
                        leftIcon={<Upload size={14} />}
                      >
                        Upload Document
                      </Button>
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
                <span>
                  Preliminary automated assessment based on verified mathematical comparisons, not an official government decision.
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
