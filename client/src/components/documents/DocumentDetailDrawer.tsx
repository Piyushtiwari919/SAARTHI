import React from 'react';
import { Link } from 'react-router-dom';
import type { Document } from '../../types/document.ts';
import { DOCUMENT_TYPE_LABELS } from '../../types/document.ts';
import { Modal } from '../ui/Modal.tsx';
import { Button } from '../ui/Button.tsx';
import { Badge } from '../ui/Badge.tsx';
import { DocumentStatusBadge } from './DocumentStatusBadge.tsx';
import { DocumentProcessingTimeline } from './DocumentProcessingTimeline.tsx';
import { formatAttributeDisplayValue, getDisplayableAttributes } from './DocumentCard.tsx';
import {
  FileText,
  Lock,
  Trash2,
  RotateCcw,
  BookOpen,
  ExternalLink,
  MessageSquareText,
  AlertTriangle,
} from 'lucide-react';
import { formatFileSize, formatDate } from '../../utils/formatters.ts';

export interface DocumentDetailDrawerProps {
  document: Document | null;
  isOpen: boolean;
  onClose: () => void;
  onDelete?: (doc: Document) => void;
  onRetry?: (doc: Document) => void;
}

export const DocumentDetailDrawer: React.FC<DocumentDetailDrawerProps> = ({
  document,
  isOpen,
  onClose,
  onDelete,
  onRetry,
}) => {
  if (!document) return null;

  const isFailed = document.status === 'FAILED';
  const typeLabel = DOCUMENT_TYPE_LABELS[document.category] || document.category;
  const visibleAttributes = getDisplayableAttributes(document.extractedAttributes);

  const renderAttributeStatus = (status?: string) => {
    switch (status?.toUpperCase()) {
      case 'EXTRACTED':
        return <Badge variant="success" size="sm">Extracted</Badge>;
      case 'NEEDS_REVIEW':
        return <Badge variant="warning" size="sm">Needs Review</Badge>;
      case 'NOT_FOUND':
        return <Badge variant="neutral" size="sm">Not Found</Badge>;
      default:
        return null;
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              padding: '6px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--brand-light)',
              color: 'var(--brand-primary)',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <FileText size={18} />
          </div>
          <div>
            <div style={{ fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--text-primary)' }}>
              {document.customTitle || document.fileName}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              {typeLabel} • {formatFileSize(document.fileSizeBytes)}
            </div>
          </div>
        </div>
      }
      maxWidth="680px"
      footer={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            {onDelete && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(document)}
                leftIcon={<Trash2 size={14} style={{ color: 'var(--danger)' }} />}
                style={{ color: 'var(--danger)' }}
              >
                Delete Document
              </Button>
            )}
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            {document.status === 'READY' && (
              <Link to={`/app/assistant?documentId=${document.id}`} onClick={onClose} style={{ textDecoration: 'none' }}>
                <Button variant="primary" size="sm" leftIcon={<MessageSquareText size={13} />}>
                  Ask Questions About This Document
                </Button>
              </Link>
            )}

            <Link to={`/app/documents/${document.id}`} onClick={onClose} style={{ textDecoration: 'none' }}>
              <Button variant="outline" size="sm" rightIcon={<ExternalLink size={13} />}>
                Full Page Analysis
              </Button>
            </Link>

            {isFailed && onRetry && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => onRetry(document)}
                leftIcon={<RotateCcw size={14} />}
              >
                Retry Processing
              </Button>
            )}

            <Button variant="secondary" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
        {/* Status Header Banner */}
        <div
          style={{
            padding: '14px 16px',
            backgroundColor: isFailed ? 'var(--danger-light)' : 'var(--surface-muted)',
            border: `1px solid ${isFailed ? 'var(--danger-border)' : 'var(--border-subtle)'}`,
            borderRadius: 'var(--radius-sm)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              CURRENT STATUS
            </span>
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>
              {document.statusMessage || (isFailed ? 'Processing failed' : 'Information extraction ready')}
            </div>
          </div>
          <DocumentStatusBadge status={document.status} size="md" />
        </div>

        {/* Warnings if present */}
        {document.warnings && document.warnings.length > 0 && (
          <div
            style={{
              padding: '12px 14px',
              backgroundColor: 'var(--warning-light, #FFFBEB)',
              border: '1px solid var(--warning-border, #FDE68A)',
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              fontSize: 'var(--text-xs)',
              color: 'var(--warning-dark, #92400E)',
            }}
          >
            {document.warnings.map((w, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={14} style={{ flexShrink: 0 }} />
                <span>{w}</span>
              </div>
            ))}
          </div>
        )}

        {/* Metadata Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
            gap: '14px',
            padding: '14px 16px',
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
          }}
        >
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>CATEGORY</div>
            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>
              {typeLabel}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>UPLOAD DATE</div>
            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>
              {formatDate(document.createdAt)}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>FORMAT & SIZE</div>
            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>
              {document.mimeType.split('/').pop()?.toUpperCase() || 'PDF'} ({formatFileSize(document.fileSizeBytes)})
            </div>
          </div>

          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>PRIVACY STATE</div>
            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--brand-primary)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Lock size={11} /> Private Document
            </div>
          </div>
        </div>

        {/* Processing Timeline Section */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
            Background Processing Pipeline
          </h4>
          <div
            style={{
              padding: '18px 20px',
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            <DocumentProcessingTimeline
              currentStatus={document.status}
              steps={document.processingSteps}
              errorMessage={document.error}
            />
          </div>
        </div>

        {/* Evidence-Backed Extracted Attributes */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
              Extracted Evidence Attributes ({visibleAttributes.length})
            </h4>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Grounded in document clauses
            </span>
          </div>

          {visibleAttributes.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '10px' }}>
              {visibleAttributes.map((attr) => (
                <div
                  key={attr.id}
                  style={{
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--surface-muted)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                      {attr.label || attr.field}
                    </span>
                    {renderAttributeStatus(attr.status)}
                  </div>

                  <div style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {formatAttributeDisplayValue(attr)}
                  </div>

                  {attr.evidenceSnippet && (
                    <div
                      style={{
                        fontSize: '11px',
                        color: 'var(--text-secondary)',
                        fontStyle: 'italic',
                        padding: '4px 6px',
                        backgroundColor: 'var(--surface)',
                        borderRadius: 'var(--radius-xs)',
                        borderLeft: '2px solid var(--brand-primary)',
                        marginTop: '2px',
                      }}
                    >
                      "{attr.evidenceSnippet}"
                    </div>
                  )}

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '11px',
                      color: 'var(--brand-primary)',
                      marginTop: '4px',
                      paddingTop: '4px',
                      borderTop: '1px dashed var(--border)',
                    }}
                  >
                    <BookOpen size={11} />
                    <span>
                      Source: {attr.sourceDocumentName || document.fileName}{' '}
                      {attr.sourcePage ? `· Page ${attr.sourcePage}` : ''}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div
              style={{
                padding: '18px',
                textAlign: 'center',
                backgroundColor: 'var(--surface-muted)',
                borderRadius: 'var(--radius-sm)',
                border: '1px dashed var(--border)',
                color: 'var(--text-muted)',
                fontSize: 'var(--text-xs)',
              }}
            >
              {isFailed
                ? 'Processing failed before attributes could be extracted. Please retry with a clearer document.'
                : 'No structured fields were extracted from this document.'}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
