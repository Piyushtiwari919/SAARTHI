import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { PageHeader } from '../../components/layout/PageHeader.tsx';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { Badge } from '../../components/ui/Badge.tsx';
import { DocumentStatusBadge } from '../../components/documents/DocumentStatusBadge.tsx';
import { DocumentProcessingTimeline } from '../../components/documents/DocumentProcessingTimeline.tsx';
import { formatAttributeDisplayValue } from '../../components/documents/DocumentCard.tsx';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog.tsx';
import { LoadingState } from '../../components/ui/LoadingState.tsx';
import { ErrorState } from '../../components/ui/ErrorState.tsx';
import {
  ArrowLeft,
  Lock,
  BookOpen,
  Trash2,
  RotateCcw,
  Shield,
  MessageSquareText,
  AlertTriangle,
} from 'lucide-react';
import { documentService } from '../../services/document.service.ts';
import { USE_MOCKS } from '../../services/api.ts';
import { DOCUMENT_TYPE_LABELS } from '../../types/document.ts';
import { formatFileSize, formatDate } from '../../utils/formatters.ts';
import { useToast } from '../../hooks/useToast.ts';
import type { Document } from '../../types/document.ts';

export const DocumentDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();

  const [document, setDocument] = useState<Document | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    let ignore = false;
    if (!id) return;

    documentService.getDocument(id)
      .then((doc) => {
        if (!ignore) {
          if (!doc) {
            setError('The requested document was not found in your vault.');
          } else {
            setDocument(doc);
            setError(null);
          }
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (!ignore) {
          setError('Could not retrieve document information.');
          setIsLoading(false);
        }
      });

    const unsubscribe = documentService.subscribe(() => {
      documentService.getDocument(id).then((updated) => {
        if (!ignore && updated) {
          setDocument(updated);
        }
      });
    });

    return () => {
      ignore = true;
      unsubscribe();
    };
  }, [id]);

  // Polling in real API mode if document is in-flight
  useEffect(() => {
    if (USE_MOCKS || !id || !document) return;
    if (document.status === 'READY' || document.status === 'FAILED') return;

    let ignore = false;
    const interval = setInterval(async () => {
      if (ignore) return;
      try {
        const statusRes = await documentService.getDocumentStatus(id);
        if (statusRes.status !== document.status) {
          const updated = await documentService.getDocument(id);
          if (!ignore && updated) {
            setDocument(updated);
          }
        }
      } catch (err) {
        console.warn('Document status polling warning:', err);
      }
    }, 4000);

    return () => {
      ignore = true;
      clearInterval(interval);
    };
  }, [id, document]);

  const handleRetry = async () => {
    if (!document) return;
    try {
      await documentService.retryDocument(document.id);
      toast.info(`Retrying processing pipeline for ${document.customTitle || document.fileName}`);
      const updated = await documentService.getDocument(document.id);
      if (updated) {
        setDocument(updated);
      }
    } catch {
      toast.error('Failed to trigger retry');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!document) return;
    setIsDeleting(true);
    try {
      await documentService.deleteDocument(document.id);
      toast.success(`Removed ${document.customTitle || document.fileName} from vault`);
      navigate('/app/documents');
    } catch {
      toast.error('Failed to remove document');
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return <LoadingState message="Loading document details and extraction history..." fullHeight />;
  }

  if (error || !document) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <Link to="/app/documents">
          <Button variant="ghost" size="sm" leftIcon={<ArrowLeft size={14} />}>
            Back to My Documents
          </Button>
        </Link>
        <ErrorState
          title="Document Not Found"
          message={error || 'The requested document does not exist or has been removed.'}
        />
      </div>
    );
  }

  const isFailed = document.status === 'FAILED';
  const typeLabel = DOCUMENT_TYPE_LABELS[document.category] || document.category;

  const allAttrs = (document.extractedAttributes || []).filter((a) => a.field !== 'currency');
  const extractedFields = allAttrs.filter(
    (a) =>
      a.status === 'EXTRACTED' &&
      a.value !== null &&
      a.value !== undefined &&
      String(a.value).trim() !== ''
  );
  const reviewFields = allAttrs.filter(
    (a) =>
      a.status === 'NEEDS_REVIEW' &&
      a.value !== null &&
      a.value !== undefined &&
      String(a.value).trim() !== ''
  );
  const missingFields = allAttrs.filter(
    (a) =>
      a.status === 'NOT_FOUND' ||
      a.value === null ||
      a.value === undefined ||
      String(a.value).trim() === ''
  );

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Navigation Breadcrumb */}
      <div>
        <Link to="/app/documents">
          <Button variant="ghost" size="sm" leftIcon={<ArrowLeft size={14} />}>
            Back to My Documents
          </Button>
        </Link>
      </div>

      {/* Header */}
      <PageHeader
        title={document.customTitle || document.fileName}
        description={`${typeLabel} • ${document.fileName} (${formatFileSize(document.fileSizeBytes)})`}
        badge={<DocumentStatusBadge status={document.status} size="md" />}
        actions={
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {document.status === 'READY' && (
              <Link to={`/app/assistant?documentId=${document.id}`} style={{ textDecoration: 'none' }}>
                <Button variant="primary" size="sm" leftIcon={<MessageSquareText size={14} />}>
                  Ask Questions About This Document
                </Button>
              </Link>
            )}
            {isFailed && (
              <Button variant="primary" size="sm" onClick={handleRetry} leftIcon={<RotateCcw size={14} />}>
                Retry Processing
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsDeleteDialogOpen(true)}
              leftIcon={<Trash2 size={14} style={{ color: 'var(--danger)' }} />}
              style={{ color: 'var(--danger)', borderColor: 'var(--danger-border)' }}
            >
              Delete
            </Button>
          </div>
        }
      />

      {/* Warnings Banner */}
      {document.warnings && document.warnings.length > 0 && (
        <div
          style={{
            padding: '12px 16px',
            backgroundColor: 'var(--warning-light, #FFFBEB)',
            border: '1px solid var(--warning-border, #FDE68A)',
            borderRadius: 'var(--radius-card)',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            fontSize: 'var(--text-xs)',
            color: 'var(--warning-dark, #92400E)',
          }}
        >
          {document.warnings.map((w, idx) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={15} style={{ flexShrink: 0 }} />
              <span>{w}</span>
            </div>
          ))}
        </div>
      )}

      {/* Two-Column Responsive Layout */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))',
          gap: '24px',
          alignItems: 'start',
        }}
      >
        {/* Left Column: Metadata & Extracted Evidence Attributes */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Metadata Card */}
          <Card>
            <CardHeader>
              <CardTitle>Document Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                  gap: '14px',
                }}
              >
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Type</span>
                  <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>
                    {typeLabel}
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Upload Date</span>
                  <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>
                    {formatDate(document.createdAt)}
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>File Format</span>
                  <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>
                    {document.mimeType.split('/').pop()?.toUpperCase() || 'PDF'} ({formatFileSize(document.fileSizeBytes)})
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Privacy</span>
                  <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--brand-primary)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Lock size={12} /> Private Document
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Extracted Fields Card */}
          <Card>
            <CardHeader>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <CardTitle>Extracted Fields ({extractedFields.length})</CardTitle>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Grounded in document clauses
                </span>
              </div>
            </CardHeader>

            <CardContent>
              {extractedFields.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {extractedFields.map((attr) => (
                    <div
                      key={attr.id}
                      style={{
                        padding: '14px 16px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: 'var(--surface-muted)',
                        border: '1px solid var(--border-subtle)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                            {attr.label || attr.field}
                          </span>
                          {renderAttributeStatus(attr.status)}
                        </div>
                        {attr.confidence !== undefined && attr.confidence > 0 && (
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            Confidence: {Math.round(attr.confidence * 100)}%
                          </span>
                        )}
                      </div>

                      <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
                        {formatAttributeDisplayValue(attr)}
                      </div>

                      {attr.evidenceSnippet && (
                        <div
                          style={{
                            fontSize: '12px',
                            color: 'var(--text-secondary)',
                            fontStyle: 'italic',
                            padding: '6px 10px',
                            backgroundColor: 'var(--surface)',
                            borderRadius: 'var(--radius-xs)',
                            borderLeft: '3px solid var(--brand-primary)',
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
                          gap: '6px',
                          fontSize: '11px',
                          color: 'var(--brand-primary)',
                          marginTop: '4px',
                          paddingTop: '6px',
                          borderTop: '1px dashed var(--border)',
                        }}
                      >
                        <BookOpen size={12} />
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
                    padding: '24px',
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
                    : document.status === 'UPLOADED'
                      ? 'Document uploaded securely to private storage. Extraction pipeline worker is awaiting job dispatch.'
                      : 'No verified attributes extracted from this document.'}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Fields Requiring Review */}
          {reviewFields.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Fields Requiring Review ({reviewFields.length})</CardTitle>
              </CardHeader>
              <CardContent style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {reviewFields.map((attr) => (
                  <div
                    key={attr.id}
                    style={{
                      padding: '12px 14px',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'var(--warning-light, #FFFBEB)',
                      border: '1px solid var(--warning-border, #FDE68A)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase' }}>
                        {attr.label || attr.field}
                      </span>
                      {renderAttributeStatus(attr.status)}
                    </div>
                    <div style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {formatAttributeDisplayValue(attr)}
                    </div>
                    {attr.evidenceSnippet && (
                      <div style={{ fontSize: '11px', fontStyle: 'italic', color: 'var(--text-secondary)' }}>
                        "{attr.evidenceSnippet}" {attr.sourcePage ? `(Page ${attr.sourcePage})` : ''}
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Missing Expected Fields */}
          {missingFields.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Missing Expected Fields ({missingFields.length})</CardTitle>
              </CardHeader>
              <CardContent style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {missingFields.map((attr) => (
                  <div
                    key={attr.id}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 'var(--radius-xs)',
                      backgroundColor: 'var(--surface-muted)',
                      border: '1px solid var(--border-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontSize: 'var(--text-xs)',
                    }}
                  >
                    <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
                      {attr.label || attr.field}
                    </span>
                    <Badge variant="neutral" size="sm">Not Found</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column: Processing Timeline */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <Card>
            <CardHeader>
              <CardTitle>Processing Pipeline</CardTitle>
            </CardHeader>
            <CardContent>
              <DocumentProcessingTimeline
                currentStatus={document.status}
                steps={document.processingSteps}
                errorMessage={document.error}
              />
            </CardContent>
          </Card>

          {/* Privacy Footnote */}
          <div
            style={{
              padding: '12px 16px',
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-card)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              fontSize: 'var(--text-xs)',
              color: 'var(--text-secondary)',
            }}
          >
            <Shield size={16} style={{ color: 'var(--brand-primary)', flexShrink: 0 }} />
            <span>
              Your document is private. Upload only the documents you are comfortable processing.
            </span>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="Remove Document from Vault"
        message={`Are you sure you want to remove "${document.customTitle || document.fileName}"? Any extracted criteria attributes tied to this document will no longer be available for opportunity matching.`}
        confirmLabel="Remove Document"
        cancelLabel="Keep Document"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  );
};
