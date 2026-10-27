import React from 'react';
import type { Document } from '../../types/document.ts';
import { DOCUMENT_TYPE_LABELS } from '../../types/document.ts';
import { Modal } from '../ui/Modal.tsx';
import { Button } from '../ui/Button.tsx';
import { DocumentStatusBadge } from './DocumentStatusBadge.tsx';
import { DocumentProcessingTimeline } from './DocumentProcessingTimeline.tsx';
import { FileText, Lock, Trash2, RotateCcw, BookOpen, Shield } from 'lucide-react';
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
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

          <div style={{ display: 'flex', gap: '10px' }}>
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
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Current Processing Status
            </span>
            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
              {document.statusMessage || 'Processing background job pipeline'}
            </span>
          </div>

          <DocumentStatusBadge status={document.status} size="md" />
        </div>

        {/* Document Metadata Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: '12px',
            backgroundColor: 'var(--surface-subtle)',
            padding: '14px 16px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>DOCUMENT TYPE</div>
            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>
              {typeLabel}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>UPLOADED ON</div>
            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>
              {formatDate(document.createdAt)}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>FILE FORMAT</div>
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
              Extracted Evidence Attributes ({document.extractedAttributes.length})
            </h4>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Grounded in document clauses
            </span>
          </div>

          {document.extractedAttributes.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '10px' }}>
              {document.extractedAttributes.map((attr) => (
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
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    {attr.label || attr.field}
                  </span>
                  <div style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {String(attr.value)}
                  </div>
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
                : 'Attributes will appear here once background OCR and rule analysis complete.'}
            </div>
          )}
        </div>

        {/* Privacy Note */}
        <div
          style={{
            padding: '10px 14px',
            backgroundColor: 'var(--surface-subtle)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-xs)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: 'var(--text-xs)',
            color: 'var(--text-secondary)',
          }}
        >
          <Shield size={14} style={{ color: 'var(--brand-primary)', flexShrink: 0 }} />
          <span>
            Your document is private. Upload only the documents you are comfortable processing.
          </span>
        </div>
      </div>
    </Modal>
  );
};
