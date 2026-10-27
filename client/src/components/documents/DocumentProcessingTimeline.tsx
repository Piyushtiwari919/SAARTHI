import React from 'react';
import type { DocumentStatus, ProcessingStep } from '../../types/document.ts';
import { Check, Loader2, AlertCircle } from 'lucide-react';
import { formatDate } from '../../utils/formatters.ts';

export interface DocumentProcessingTimelineProps {
  currentStatus: DocumentStatus;
  steps?: ProcessingStep[];
  errorMessage?: string;
}

interface Milestone {
  status: DocumentStatus;
  title: string;
  description: string;
}

const ORDERED_MILESTONES: Milestone[] = [
  { status: 'UPLOADED', title: 'Uploaded', description: 'Stored in confidential vault' },
  { status: 'QUEUED', title: 'Ingest Queue', description: 'Awaiting worker pickup' },
  { status: 'PROCESSING', title: 'Preprocessing', description: 'Image normalization & slicing' },
  { status: 'OCR_COMPLETE', title: 'OCR', description: 'Text tokenization & extraction' },
  { status: 'ANALYZING', title: 'Rule Analysis', description: 'Entity & criteria parsing' },
  { status: 'INDEXING', title: 'RAG Indexing', description: 'Vector embeddings created' },
  { status: 'READY', title: 'Ready', description: 'Available for opportunity matching' },
];

export const DocumentProcessingTimeline: React.FC<DocumentProcessingTimelineProps> = ({
  currentStatus,
  steps = [],
  errorMessage,
}) => {
  const getStatusIndex = (st: DocumentStatus): number => {
    switch (st) {
      case 'UPLOADED': return 0;
      case 'QUEUED': return 1;
      case 'PROCESSING': return 2;
      case 'OCR_COMPLETE': return 3;
      case 'ANALYZING': return 4;
      case 'INDEXING': return 5;
      case 'READY': return 6;
      case 'FAILED': return 3; // Typically fails around processing/OCR
      default: return 0;
    }
  };

  const currentIndex = getStatusIndex(currentStatus);
  const isFailed = currentStatus === 'FAILED';

  // Map recorded steps by status for lookup
  const stepMap = new Map<DocumentStatus, ProcessingStep>();
  for (const s of steps) {
    stepMap.set(s.status, s);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0', width: '100%' }}>
      {ORDERED_MILESTONES.map((milestone, idx) => {
        const isCompleted = !isFailed ? idx <= currentIndex : idx < currentIndex;
        const isCurrent = !isFailed && idx === currentIndex && currentStatus !== 'READY';
        const isCurrentFailed = isFailed && idx === currentIndex;
        const isUpcoming = !isCompleted && !isCurrent && !isCurrentFailed;
        const stepData = stepMap.get(milestone.status);

        return (
          <div
            key={milestone.status}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              position: 'relative',
              paddingBottom: idx === ORDERED_MILESTONES.length - 1 ? '0' : '20px',
            }}
          >
            {/* Vertical connector line */}
            {idx < ORDERED_MILESTONES.length - 1 && (
              <div
                style={{
                  position: 'absolute',
                  left: '13px',
                  top: '26px',
                  bottom: '0',
                  width: '2px',
                  backgroundColor: isCompleted ? 'var(--brand-primary)' : 'var(--border-subtle)',
                  zIndex: 0,
                  transition: 'background-color var(--transition-base)',
                }}
              />
            )}

            {/* Status node icon */}
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                backgroundColor: isCurrentFailed
                  ? 'var(--danger)'
                  : isCompleted
                  ? 'var(--brand-primary)'
                  : isCurrent
                  ? 'var(--surface)'
                  : 'var(--surface-muted)',
                border: isCurrentFailed
                  ? '2px solid var(--danger)'
                  : isCurrent
                  ? '2px solid var(--brand-primary)'
                  : isCompleted
                  ? '2px solid var(--brand-primary)'
                  : '2px solid var(--border)',
                color: isCurrentFailed
                  ? 'var(--text-inverse)'
                  : isCompleted
                  ? 'var(--text-inverse)'
                  : isCurrent
                  ? 'var(--brand-primary)'
                  : 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                zIndex: 1,
                boxShadow: isCurrent ? '0 0 0 3px var(--brand-light)' : 'none',
                transition: 'all var(--transition-base)',
              }}
            >
              {isCurrentFailed ? (
                <AlertCircle size={14} />
              ) : isCompleted ? (
                <Check size={14} />
              ) : isCurrent ? (
                <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
              ) : (
                <span style={{ fontSize: '10px', fontWeight: 600 }}>{idx + 1}</span>
              )}
            </div>

            {/* Step text info */}
            <div style={{ marginLeft: '14px', minWidth: 0, flex: 1, paddingTop: '3px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                <span
                  style={{
                    fontSize: 'var(--text-sm)',
                    fontWeight: isCurrent || isCompleted ? 600 : 500,
                    color: isCurrentFailed
                      ? 'var(--danger)'
                      : isCurrent
                      ? 'var(--brand-primary)'
                      : isCompleted
                      ? 'var(--text-primary)'
                      : 'var(--text-muted)',
                  }}
                >
                  {milestone.title}
                </span>

                {stepData?.timestamp && (
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    {formatDate(stepData.timestamp)}
                  </span>
                )}
              </div>

              <p
                style={{
                  fontSize: 'var(--text-xs)',
                  color: isCurrentFailed
                    ? 'var(--danger)'
                    : isUpcoming
                    ? 'var(--text-muted)'
                    : 'var(--text-secondary)',
                  marginTop: '2px',
                  margin: 0,
                  lineHeight: 1.4,
                }}
              >
                {isCurrentFailed && errorMessage
                  ? errorMessage
                  : stepData?.message || milestone.description}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
};
