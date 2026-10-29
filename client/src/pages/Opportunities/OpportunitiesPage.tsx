import React, { useEffect, useState, useCallback } from 'react';
import { PageHeader } from '../../components/layout/PageHeader.tsx';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '../../components/ui/Card.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { Badge } from '../../components/ui/Badge.tsx';
import { Input } from '../../components/ui/Input.tsx';
import { LoadingState } from '../../components/ui/LoadingState.tsx';
import { EmptyState } from '../../components/ui/EmptyState.tsx';
import { Clock, ExternalLink, ArrowRight, Search, PlayCircle, FileSearch } from 'lucide-react';
import { opportunityService } from '../../services/opportunity.service.ts';
import { eligibilityService } from '../../services/eligibility.service.ts';
import { EligibilityStatusBadge } from '../../components/eligibility/EligibilityStatusBadge.tsx';
import { useToast } from '../../hooks/useToast.ts';
import type { Opportunity } from '../../types/opportunity.ts';
import type { OpportunityEligibility } from '../../types/eligibility.ts';
import { formatCurrency, formatDate } from '../../utils/formatters.ts';
import { Link } from 'react-router-dom';

export const OpportunitiesPage: React.FC = () => {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [eligibilitySummaries, setEligibilitySummaries] = useState<OpportunityEligibility[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [evaluatingOppId, setEvaluatingOppId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const toast = useToast();

  const loadData = useCallback(async () => {
    try {
      const [oppsRes, eligsRes] = await Promise.allSettled([
        opportunityService.getOpportunities(),
        eligibilityService.getAllEligibilitySummaries(),
      ]);

      const opps = oppsRes.status === 'fulfilled' ? oppsRes.value : [];
      const eligs = eligsRes.status === 'fulfilled' ? eligsRes.value : [];

      setOpportunities(opps);
      setEligibilitySummaries(eligs);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load opportunities');
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleEvaluate = async (oppId: string) => {
    setEvaluatingOppId(oppId);
    try {
      const result = await eligibilityService.evaluateOpportunity(oppId);
      setEligibilitySummaries((prev) => {
        const index = prev.findIndex((e) => e.opportunityId === oppId);
        if (index >= 0) {
          const updated = [...prev];
          updated[index] = result;
          return updated;
        }
        return [...prev, result];
      });

      if (result.overallStatus === 'PASS') {
        toast.success(`Verified: You qualify for this opportunity!`, 'Eligibility Verified');
      } else if (result.overallStatus === 'FAIL') {
        toast.warning(`Criteria not met: ${result.summary}`, 'Evaluation Verdict');
      } else {
        toast.info(`Evidence required: ${result.summary}`, 'Evaluation Verdict');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Could not evaluate opportunity criteria');
    } finally {
      setEvaluatingOppId(null);
    }
  };

  const eligibilityMap = new Map(eligibilitySummaries.map((e) => [e.opportunityId, e]));

  // Filter opportunities
  const filteredOpportunities = opportunities.filter((opp) => {
    const matchesCategory =
      selectedCategory === 'ALL' || opp.category === selectedCategory;

    const matchesSearch =
      !searchQuery.trim() ||
      opp.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      opp.provider.toLowerCase().includes(searchQuery.toLowerCase()) ||
      opp.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesCategory && matchesSearch;
  });

  const categories = ['ALL', 'SCHOLARSHIP', 'FELLOWSHIP', 'GRANT'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <PageHeader
        title="Scholarships & Opportunities"
        description="Curated opportunities matched against your verified student evidence profile."
      />

      {/* Filter and Search Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {categories.map((cat) => (
            <Button
              key={cat}
              variant={selectedCategory === cat ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setSelectedCategory(cat)}
            >
              {cat === 'ALL' ? 'All Opportunities' : cat.charAt(0) + cat.slice(1).toLowerCase() + 's'}
            </Button>
          ))}
        </div>

        <div style={{ width: '100%', maxWidth: '320px' }}>
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by title, provider, tag..."
            leftIcon={<Search size={16} />}
          />
        </div>
      </div>

      {isLoading ? (
        <LoadingState message="Fetching opportunity directory..." fullHeight />
      ) : filteredOpportunities.length === 0 ? (
        <EmptyState
          icon={<FileSearch size={40} />}
          title="No opportunities found"
          description={
            searchQuery || selectedCategory !== 'ALL'
              ? 'Try adjusting your search keywords or category filters.'
              : 'There are currently no active opportunities in the directory.'
          }
          action={
            searchQuery || selectedCategory !== 'ALL' ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('ALL');
                }}
              >
                Clear Filters
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
            gap: '20px',
          }}
        >
          {filteredOpportunities.map((opp) => {
            const eligibility = eligibilityMap.get(opp.id);
            const isEvaluating = evaluatingOppId === opp.id;

            return (
              <Card key={opp.id} style={{ display: 'flex', flexDirection: 'column' }}>
                <CardHeader>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: '10px',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '11px',
                        color: 'var(--brand-primary)',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                      }}
                    >
                      {opp.provider}
                    </span>
                    {eligibility ? (
                      <EligibilityStatusBadge status={eligibility.overallStatus} size="sm" />
                    ) : (
                      <Badge variant="neutral" size="sm">
                        Not Evaluated
                      </Badge>
                    )}
                  </div>
                  <CardTitle style={{ fontSize: 'var(--text-md)', marginTop: '4px' }}>
                    {opp.title}
                  </CardTitle>
                </CardHeader>

                <CardContent style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <p
                    style={{
                      fontSize: 'var(--text-xs)',
                      color: 'var(--text-secondary)',
                      lineHeight: 1.5,
                      margin: 0,
                    }}
                  >
                    {opp.description}
                  </p>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <Badge variant="neutral" size="sm">
                      {formatCurrency(opp.amount)}
                    </Badge>
                    <span
                      style={{
                        fontSize: 'var(--text-xs)',
                        color: 'var(--text-muted)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <Clock size={12} /> Deadline: {formatDate(opp.deadline)}
                    </span>
                  </div>

                  {/* Criteria summary chips */}
                  {Array.isArray(opp.criteriaSummary) && opp.criteriaSummary.length > 0 && (
                    <div
                      style={{
                        padding: '10px 12px',
                        backgroundColor: 'var(--surface-muted)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '11px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                      }}
                    >
                      <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
                        Key Requirements:
                      </span>
                      {opp.criteriaSummary.slice(0, 2).map((crit) => (
                        <div key={crit.id} style={{ color: 'var(--text-muted)' }}>
                          • {crit.ruleDescription}
                        </div>
                      ))}
                    </div>
                  )}

                  {opp.tags && opp.tags.length > 0 && (
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {opp.tags.map((tag) => (
                        <span
                          key={tag}
                          style={{
                            fontSize: '11px',
                            color: 'var(--text-muted)',
                            backgroundColor: 'var(--surface-subtle)',
                            padding: '2px 6px',
                            borderRadius: 'var(--radius-xs)',
                          }}
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </CardContent>

                <CardFooter style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <Button
                      variant={eligibility ? 'secondary' : 'primary'}
                      size="sm"
                      onClick={() => handleEvaluate(opp.id)}
                      isLoading={isEvaluating}
                      leftIcon={<PlayCircle size={14} />}
                    >
                      {eligibility ? 'Re-Evaluate' : 'Evaluate'}
                    </Button>

                    <Link to="/app/eligibility">
                      <Button variant="ghost" size="sm" rightIcon={<ArrowRight size={14} />}>
                        Audit
                      </Button>
                    </Link>
                  </div>

                  <a
                    href={opp.applicationUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{ textDecoration: 'none' }}
                  >
                    <Button variant="outline" size="sm" rightIcon={<ExternalLink size={14} />}>
                      Official Portal
                    </Button>
                  </a>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
