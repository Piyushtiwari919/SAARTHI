import React, { useEffect, useState, useCallback } from 'react';
import { PageHeader } from '../../components/layout/PageHeader.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { Input } from '../../components/ui/Input.tsx';
import { DocumentCard } from '../../components/documents/DocumentCard.tsx';
import { DocumentUploadModal } from '../../components/documents/DocumentUploadModal.tsx';
import { DocumentDetailDrawer } from '../../components/documents/DocumentDetailDrawer.tsx';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog.tsx';
import { LoadingState } from '../../components/ui/LoadingState.tsx';
import { EmptyState } from '../../components/ui/EmptyState.tsx';
import { Upload, Lock, Search, FileText } from 'lucide-react';
import { documentService } from '../../services/document.service.ts';
import { useToast } from '../../hooks/useToast.ts';
import type { Document, DocumentUploadPayload } from '../../types/document.ts';

type FilterTab = 'ALL' | 'PROCESSING' | 'READY' | 'FAILED';

export const DocumentsPage: React.FC = () => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [allDocsCount, setAllDocsCount] = useState<Document[]>([]);
  const [activeFilter, setActiveFilter] = useState<FilterTab>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Modal / Drawer state
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [docToDelete, setDocToDelete] = useState<Document | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const toast = useToast();

  const loadDocuments = useCallback(async () => {
    try {
      const [filtered, all] = await Promise.all([
        documentService.listDocuments(activeFilter, searchQuery),
        documentService.listDocuments('ALL'),
      ]);
      setDocuments(filtered);
      setAllDocsCount(all);
    } finally {
      setIsLoading(false);
    }
  }, [activeFilter, searchQuery]);

  // Initial load and filter change
  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  // Subscribe to background pipeline transitions
  useEffect(() => {
    const unsubscribe = documentService.subscribe(() => {
      loadDocuments();
      // If a document is currently open in detail drawer, update it
      if (selectedDoc) {
        documentService.getDocument(selectedDoc.id).then((updated) => {
          if (updated) setSelectedDoc(updated);
        });
      }
    });

    return () => {
      unsubscribe();
    };
  }, [loadDocuments, selectedDoc]);

  // Filter counts
  const counts = {
    ALL: allDocsCount.length,
    PROCESSING: allDocsCount.filter(
      (d) =>
        d.status === 'UPLOADED' ||
        d.status === 'QUEUED' ||
        d.status === 'PROCESSING' ||
        d.status === 'OCR_COMPLETE' ||
        d.status === 'ANALYZING' ||
        d.status === 'INDEXING'
    ).length,
    READY: allDocsCount.filter((d) => d.status === 'READY').length,
    FAILED: allDocsCount.filter((d) => d.status === 'FAILED').length,
  };

  const handleUploadSubmit = async (payload: DocumentUploadPayload) => {
    const doc = await documentService.uploadDocument(payload);
    toast.success(`Document enqueued for processing (${doc.customTitle || doc.fileName})`, 'Upload Received');
    await loadDocuments();
  };

  const handleRetry = async (doc: Document) => {
    try {
      await documentService.retryDocument(doc.id);
      toast.info(`Retrying background processing for ${doc.customTitle || doc.fileName}`);
      await loadDocuments();
    } catch {
      toast.error('Could not retry document processing');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!docToDelete) return;
    setIsDeleting(true);
    try {
      await documentService.deleteDocument(docToDelete.id);
      toast.success(`Removed ${docToDelete.customTitle || docToDelete.fileName} from vault`);
      setDocToDelete(null);
      if (selectedDoc?.id === docToDelete.id) {
        setIsDetailOpen(false);
        setSelectedDoc(null);
      }
      await loadDocuments();
    } catch {
      toast.error('Failed to remove document');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleViewDetails = (doc: Document) => {
    setSelectedDoc(doc);
    setIsDetailOpen(true);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* 1. Page Header */}
      <PageHeader
        title="My Documents"
        description="Manage the documents you've added to Saarthi."
        actions={
          <Button
            variant="primary"
            leftIcon={<Upload size={16} />}
            onClick={() => setIsUploadOpen(true)}
          >
            Upload Document
          </Button>
        }
      />

      {/* 2. Privacy Messaging Banner */}
      <div
        style={{
          padding: '12px 16px',
          backgroundColor: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-card)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <Lock size={16} style={{ color: 'var(--brand-primary)', flexShrink: 0 }} />
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
          <strong>Your document is private.</strong> Upload only the documents you are comfortable processing. Extracted text is used solely for checking scholarship eligibility criteria.
        </span>
      </div>

      {/* 3. Search and Filter Controls */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '14px',
        }}
      >
        {/* Status Filter Tabs */}
        <div
          role="tablist"
          aria-label="Filter documents by status"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            backgroundColor: 'var(--surface-muted)',
            padding: '4px',
            borderRadius: 'var(--radius-btn)',
            border: '1px solid var(--border-subtle)',
            gap: '2px',
            maxWidth: '100%',
            overflowX: 'auto',
          }}
        >
          {(
            [
              { key: 'ALL', label: 'All', count: counts.ALL },
              { key: 'PROCESSING', label: 'Processing', count: counts.PROCESSING },
              { key: 'READY', label: 'Ready', count: counts.READY },
              { key: 'FAILED', label: 'Failed', count: counts.FAILED },
            ] as const
          ).map((tab) => {
            const isActive = activeFilter === tab.key;
            return (
              <button
                key={tab.key}
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveFilter(tab.key)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 'var(--radius-xs)',
                  fontSize: 'var(--text-xs)',
                  fontWeight: isActive ? 600 : 500,
                  backgroundColor: isActive ? 'var(--surface)' : 'transparent',
                  color: isActive ? 'var(--brand-primary)' : 'var(--text-secondary)',
                  boxShadow: isActive ? 'var(--shadow-sm)' : 'none',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  whiteSpace: 'nowrap',
                  transition: 'all var(--transition-fast)',
                }}
              >
                <span>{tab.label}</span>
                <span
                  style={{
                    fontSize: '10px',
                    padding: '1px 6px',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: isActive ? 'var(--brand-light)' : 'var(--border-subtle)',
                    color: isActive ? 'var(--brand-primary)' : 'var(--text-muted)',
                  }}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Quick Search */}
        <div style={{ width: '100%', maxWidth: '280px' }}>
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search documents by name..."
            leftIcon={<Search size={15} />}
            style={{ padding: '6px 12px 6px 34px', fontSize: 'var(--text-xs)' }}
          />
        </div>
      </div>

      {/* 4. Document Grid / List or Empty State */}
      {isLoading ? (
        <LoadingState message="Loading documents from private vault..." fullHeight />
      ) : documents.length === 0 ? (
        activeFilter === 'ALL' && !searchQuery ? (
          <EmptyState
            icon={<FileText size={24} />}
            title="No documents yet"
            description="Upload a scholarship notice or your supporting documents to start building your Saarthi profile."
            action={
              <Button
                variant="primary"
                leftIcon={<Upload size={16} />}
                onClick={() => setIsUploadOpen(true)}
              >
                Upload Document
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={<Search size={24} />}
            title={`No ${activeFilter.toLowerCase()} documents found`}
            description={
              searchQuery
                ? `No documents matched "${searchQuery}". Try clearing your search.`
                : `You currently have zero documents in the ${activeFilter.toLowerCase()} stage.`
            }
            action={
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setActiveFilter('ALL');
                  setSearchQuery('');
                }}
              >
                Reset Filters
              </Button>
            }
          />
        )
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))',
            gap: '16px',
          }}
        >
          {documents.map((doc) => (
            <DocumentCard
              key={doc.id}
              document={doc}
              onView={handleViewDetails}
              onDelete={(d) => setDocToDelete(d)}
              onRetry={handleRetry}
            />
          ))}
        </div>
      )}

      {/* Upload Modal */}
      <DocumentUploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onUpload={handleUploadSubmit}
      />

      {/* Document Details Drawer / Modal */}
      <DocumentDetailDrawer
        document={selectedDoc}
        isOpen={isDetailOpen}
        onClose={() => {
          setIsDetailOpen(false);
          setSelectedDoc(null);
        }}
        onDelete={(d) => setDocToDelete(d)}
        onRetry={handleRetry}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!docToDelete}
        onClose={() => setDocToDelete(null)}
        onConfirm={handleDeleteConfirm}
        title="Remove Document from Vault"
        message={`Are you sure you want to remove "${docToDelete?.customTitle || docToDelete?.fileName}"? Any extracted criteria attributes tied to this document will no longer be available for opportunity matching.`}
        confirmLabel="Remove Document"
        cancelLabel="Keep Document"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  );
};
