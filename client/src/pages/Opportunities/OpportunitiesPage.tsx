import React, { useEffect, useState } from 'react';
import { PageHeader } from '../../components/layout/PageHeader.tsx';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '../../components/ui/Card.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { Badge } from '../../components/ui/Badge.tsx';
import { LoadingState } from '../../components/ui/LoadingState.tsx';
import { Clock, ExternalLink, ArrowRight } from 'lucide-react';
import { opportunityService } from '../../services/opportunity.service.ts';
import { eligibilityService } from '../../services/eligibility.service.ts';
import { EligibilityStatusBadge } from '../../components/eligibility/EligibilityStatusBadge.tsx';
import type { Opportunity } from '../../types/opportunity.ts';
import type { OpportunityEligibility } from '../../types/eligibility.ts';
import { formatCurrency, formatDate } from '../../utils/formatters.ts';
import { Link } from 'react-router-dom';

export const OpportunitiesPage: React.FC = () => {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [eligibilitySummaries, setEligibilitySummaries] = useState<OpportunityEligibility[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      opportunityService.getOpportunities(),
      eligibilityService.getAllEligibilitySummaries(),
    ]).then(([opps, eligs]) => {
      setOpportunities(opps);
      setEligibilitySummaries(eligs);
      setIsLoading(false);
    });
  }, []);

  const eligibilityMap = new Map(eligibilitySummaries.map((e) => [e.opportunityId, e]));

  return (
    <div>
      <PageHeader
        title="Scholarships & Opportunities"
        description="Curated opportunities matched against your verified student evidence profile."
      />

      {isLoading ? (
        <LoadingState message="Fetching opportunity directory..." fullHeight />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '20px' }}>
          {opportunities.map((opp) => {
            const eligibility = eligibilityMap.get(opp.id);

            return (
              <Card key={opp.id} style={{ display: 'flex', flexDirection: 'column' }}>
                <CardHeader>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--brand-primary)', fontWeight: 600, textTransform: 'uppercase' }}>
                      {opp.provider}
                    </span>
                    {eligibility && (
                      <EligibilityStatusBadge status={eligibility.overallStatus} size="sm" />
                    )}
                  </div>
                  <CardTitle style={{ fontSize: 'var(--text-md)', marginTop: '4px' }}>
                    {opp.title}
                  </CardTitle>
                </CardHeader>

                <CardContent style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                    {opp.description}
                  </p>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <Badge variant="neutral" size="sm">
                      {formatCurrency(opp.amount)}
                    </Badge>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Clock size={12} /> Deadline: {formatDate(opp.deadline)}
                    </span>
                  </div>

                  {opp.tags.length > 0 && (
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {opp.tags.map((tag) => (
                        <span
                          key={tag}
                          style={{
                            fontSize: '11px',
                            color: 'var(--text-muted)',
                            backgroundColor: 'var(--surface-muted)',
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

                <CardFooter style={{ justifyContent: 'space-between' }}>
                  <Link to="/app/eligibility">
                    <Button variant="secondary" size="sm" rightIcon={<ArrowRight size={14} />}>
                      Audit Evidence
                    </Button>
                  </Link>

                  <a
                    href={opp.applicationUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{ textDecoration: 'none' }}
                  >
                    <Button variant="ghost" size="sm" rightIcon={<ExternalLink size={14} />}>
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
