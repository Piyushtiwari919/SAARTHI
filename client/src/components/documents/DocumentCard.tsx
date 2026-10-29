import React from 'react';
import { Link } from 'react-router-dom';
import type { Document, ExtractedAttribute } from '../../types/document.ts';
import { DOCUMENT_TYPE_LABELS } from '../../types/document.ts';
import { Card } from '../ui/Card.tsx';
import { DocumentStatusBadge } from './DocumentStatusBadge.tsx';
import { ProgressBar } from '../ui/ProgressBar.tsx';
import { Badge } from '../ui/Badge.tsx';
import { Button } from '../ui/Button.tsx';
import {
  FileText,
  Lock,
  Trash2,
  ExternalLink,
  RotateCcw,
  AlertCircle,
  BookOpen,
  MessageSquareText,
} from 'lucide-react';
import { formatFileSize, formatDate } from '../../utils/formatters.ts';

export interface DocumentCardProps {
  document: Document;
  onView?: (doc: Document) => void;
  onDelete?: (doc: Document) => void;
  onRetry?: (doc: Document) => void;
}

export function getDisplayableAttributes(attributes?: ExtractedAttribute[]): ExtractedAttribute[] {
  if (!Array.isArray(attributes)) return [];
  return attributes.filter(
    (attr) =>
      attr &&
      attr.status !== 'NOT_FOUND' &&
      attr.field !== 'currency' &&
      attr.value !== null &&
      attr.value !== undefined &&
      String(attr.value).trim() !== ''
  );
}

export function formatAttributeDisplayValue(attr: ExtractedAttribute): string {
  const raw = String(attr.value ?? '').trim();
  if (!raw) return '';
  if (attr.currency && !raw.includes(attr.currency) && !raw.includes('₹')) {
    return `${attr.currency} ${Number(raw) ? Number(raw).toLocaleString('en-IN') : raw}`;
  }
  if (attr.field.includes('percentage') && !raw.endsWith('%')) {
    return `${raw}%`;
  }
  return raw;
}

export const DocumentCard: React.FC<DocumentCardProps> = ({
  document,
  onView,
  onDelete,
  onRetry,
}) => {
  const isProcessing =
    document.status === 'UPLOADED' ||
    document.status === 'QUEUED' ||
    document.status === 'PROCESSING' ||
    document.status === 'OCR_COMPLETE' ||
    document.status === 'ANALYZING' ||
    document.status === 'INDEXING';

  const isFailed = document.status === 'FAILED';
  const typeLabel = DOCUMENT_TYPE_LABELS[document.category] || document.category;
  const visibleAttributes = getDisplayableAttributes(document.extractedAttributes);

  return (
    <Card
      className="saarthi-document-card"
      style={{
        padding: '18px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        borderColor: isFailed ? 'var(--danger-border)' : 'var(--border)',
        minWidth: 0,
        overflow: 'hidden',
      }}
    >
      {/* Top Row: Type Label and Status Badge */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', minWidth: 0 }}>
        <span
          style={{
            fontSize: '11px',
            fontWeight: 600,
            color: 'var(--brand-primary)',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {typeLabel}
        </span>
        <DocumentStatusBadge status={document.status} />
      </div>

      {/* File info: Icon, Title, and Metadata */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', minWidth: 0 }}>
        <div
          style={{
            padding: '10px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: isFailed ? 'var(--danger-light)' : 'var(--surface-muted)',
            color: isFailed ? 'var(--danger)' : 'var(--brand-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <FileText size={20} />
        </div>

        <div style={{ minWidth: 0, flex: 1 }}>
          <h4
            style={{
              fontSize: 'var(--text-base)',
              fontWeight: 600,
              color: 'var(--text-primary)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              marginBottom: '3px',
            }}
            title={document.customTitle || document.fileName}
          >
            {document.customTitle || document.fileName}
          </h4>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
              {document.fileName}
            </span>
            <span style={{ color: 'var(--border)' }}>•</span>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
              {formatFileSize(document.fileSizeBytes)}
            </span>
            <span style={{ color: 'var(--border)' }}>•</span>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
              {formatDate(document.createdAt)}
            </span>
            {document.isSensitive && (
              <>
                <span style={{ color: 'var(--border)' }}>•</span>
                <Badge variant="neutral" size="sm" icon={<Lock size={10} />}>
                  Private Document
                </Badge>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Background Processing Progress Bar */}
      {isProcessing && (
        <div style={{ backgroundColor: 'var(--surface-subtle)', padding: '10px 12px', borderRadius: 'var(--radius-sm)' }}>
          <ProgressBar
            value={document.progressPercent}
            label={document.statusMessage || 'Processing document pipeline...'}
            showValue
            size="sm"
          />
        </div>
      )}

      {/* Failure Message Callout */}
      {isFailed && (
        <div
          style={{
            padding: '10px 12px',
            backgroundColor: 'var(--danger-light)',
            border: '1px solid var(--danger-border)',
            borderRadius: 'var(--radius-xs)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: 'var(--text-xs)', color: 'var(--danger)' }}>
            <AlertCircle size={15} style={{ flexShrink: 0 }} />
            <span>{document.error || document.statusMessage || 'OCR recognition failed. Image may be low resolution.'}</span>
          </div>

          {onRetry && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onRetry(document)}
              leftIcon={<RotateCcw size={12} />}
              style={{ flexShrink: 0, padding: '4px 8px', fontSize: '11px', borderColor: 'var(--danger)', color: 'var(--danger)' }}
            >
              Retry
            </Button>
          )}
        </div>
      )}

      {/* Extracted Evidence Attributes preview when ready (strictly non-empty, extracted/review fields only) */}
      {visibleAttributes.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px',
            paddingTop: '6px',
            borderTop: '1px solid var(--border-subtle)',
          }}
        >
          {visibleAttributes.slice(0, 3).map((attr) => (
            <div
              key={attr.id}
              style={{
                fontSize: 'var(--text-xs)',
                backgroundColor: 'var(--surface-muted)',
                padding: '4px 10px',
                borderRadius: 'var(--radius-xs)',
                display: 'flex',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '4px 6px',
                maxWidth: '100%',
                wordBreak: 'break-word',
              }}
            >
              <span style={{ color: 'var(--text-muted)' }}>{attr.label || attr.field}:</span>
              <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                {formatAttributeDisplayValue(attr)}
              </strong>
              {attr.sourcePage && (
                <span style={{ color: 'var(--brand-primary)', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '2px', whiteSpace: 'nowrap' }}>
                  <BookOpen size={9} /> p.{attr.sourcePage}
                </span>
              )}
            </div>
          ))}
          {visibleAttributes.length > 3 && (
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', alignSelf: 'center' }}>
              +{visibleAttributes.length - 3} more
            </span>
          )}
        </div>
      )}

      {/* Footer Actions */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: '10px',
          borderTop: '1px solid var(--border-subtle)',
          marginTop: 'auto',
          flexWrap: 'wrap',
          gap: '8px',
        }}
      >
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
          {document.pageCount ? `${document.pageCount} page(s)` : 'Scanned Document'}
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isFailed && onRetry && (
            <button
              onClick={() => onRetry(document)}
              style={{
                color: 'var(--brand-primary)',
                fontSize: 'var(--text-xs)',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 8px',
                borderRadius: 'var(--radius-xs)',
              }}
            >
              <RotateCcw size={12} />
              <span>Retry</span>
            </button>
          )}

          {document.status === 'READY' && (
            <Link
              to={`/app/assistant?documentId=${document.id}`}
              style={{
                color: 'var(--brand-primary)',
                fontSize: 'var(--text-xs)',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 8px',
                borderRadius: 'var(--radius-xs)',
                textDecoration: 'none',
                backgroundColor: 'var(--brand-light)',
              }}
              title="Ask questions grounded in this document"
            >
              <MessageSquareText size={12} />
              <span>Ask AI</span>
            </Link>
          )}

          {onDelete && (
            <button
              onClick={() => onDelete(document)}
              aria-label="Delete document"
              title="Delete document"
              style={{
                color: 'var(--text-muted)',
                padding: '6px',
                borderRadius: 'var(--radius-xs)',
                display: 'flex',
                alignItems: 'center',
                transition: 'color var(--transition-fast)',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--danger)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
            >
              <Trash2 size={15} />
            </button>
          )}

          {onView && (
            <button
              onClick={() => onView(document)}
              style={{
                color: 'var(--brand-primary)',
                fontSize: 'var(--text-xs)',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 8px',
                borderRadius: 'var(--radius-xs)',
              }}
            >
              <span>View details</span>
              <ExternalLink size={12} />
            </button>
          )}
        </div>
      </div>
    </Card>
  );
};
