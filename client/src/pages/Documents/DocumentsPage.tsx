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
import { USE_MOCKS } from '../../services/api.ts';
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
    } catch (err: any) {
      console.error('Failed to load documents:', err);
      toast.error(err?.message || 'Could not load documents');
    } finally {
      setIsLoading(false);
    }
  }, [activeFilter, searchQuery, toast]);

  // Initial load and filter change
  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  // Subscribe to background pipeline transitions
  useEffect(() => {
    const unsubscribe = documentService.subscribe(() => {
      loadDocuments();
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

  // Polling in real API mode for in-flight processing documents
  useEffect(() => {
    if (USE_MOCKS) return;

    const hasProcessing = documents.some(
      (d) => d.status !== 'READY' && d.status !== 'FAILED'
    );
    if (!hasProcessing) return;

    let isSubscribed = true;
    const interval = setInterval(async () => {
      if (!isSubscribed) return;
      try {
        await loadDocuments();
      } catch (err) {
        console.warn('Background document status refresh error:', err);
      }
    }, 5000);

    return () => {
      isSubscribed = false;
      clearInterval(interval);
    };
  }, [documents, loadDocuments]);

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
    try {
      const doc = await documentService.uploadDocument(payload);
      toast.success(`Document uploaded (${doc.customTitle || doc.fileName})`, 'Upload Received');
      setIsUploadOpen(false);
      await loadDocuments();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to upload document');
      throw err;
    }
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

      {/* 2. Privacy Footnote Banner */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '12px 18px',
          borderRadius: 'var(--radius-card)',
          backgroundColor: 'var(--surface)',
          border: '1px solid var(--border)',
          color: 'var(--text-secondary)',
          fontSize: 'var(--text-xs)',
        }}
      >
        <Lock size={16} style={{ color: 'var(--brand-primary)', flexShrink: 0 }} />
        <span>
          <strong>Private storage:</strong> Your documents are encrypted and accessible only through your authenticated account.
        </span>
      </div>

      {/* 3. Controls Bar: Filter Tabs & Search Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        {/* Filter Pills */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            backgroundColor: 'var(--surface)',
            padding: '4px',
            borderRadius: 'var(--radius-card)',
            border: '1px solid var(--border)',
            gap: '4px',
          }}
        >
          {(['ALL', 'PROCESSING', 'READY', 'FAILED'] as FilterTab[]).map((tab) => {
            const isActive = activeFilter === tab;
            const labelMap: Record<FilterTab, string> = {
              ALL: 'All Documents',
              PROCESSING: 'Processing',
              READY: 'Ready',
              FAILED: 'Failed',
            };

            return (
              <button
                key={tab}
                onClick={() => setActiveFilter(tab)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 'var(--text-xs)',
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? 'var(--brand-primary)' : 'var(--text-secondary)',
                  backgroundColor: isActive ? 'var(--brand-primary-light)' : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'var(--transition-base)',
                }}
              >
                <span>{labelMap[tab]}</span>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '2px 6px',
                    borderRadius: '10px',
                    fontSize: '10px',
                    fontWeight: 700,
                    backgroundColor: isActive ? 'var(--brand-primary)' : 'var(--border-subtle)',
                    color: isActive ? '#FFFFFF' : 'var(--text-muted)',
                  }}
                >
                  {counts[tab]}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search Bar Input */}
        <div style={{ width: '100%', maxWidth: '280px' }}>
          <Input
            placeholder="Search by name, course, or category..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<Search size={14} />}
          />
        </div>
      </div>

      {/* 4. Main Document Content Area */}
      {isLoading ? (
        <LoadingState message="Retrieving documents from your vault..." fullHeight />
      ) : documents.length === 0 ? (
        <EmptyState
          icon={<FileText size={40} />}
          title={searchQuery ? 'No matching documents found' : 'Your vault is empty'}
          description={
            searchQuery
              ? `No documents matched "${searchQuery}". Try searching with a different term.`
              : 'Upload marksheets, certificates, or notices to analyze your eligibility.'
          }
          action={
            <Button
              variant="primary"
              onClick={searchQuery ? () => setSearchQuery('') : () => setIsUploadOpen(true)}
            >
              {searchQuery ? 'Clear Search' : 'Upload First Document'}
            </Button>
          }
        />
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 320px), 1fr))',
            gap: '16px',
          }}
        >
          {documents.map((doc) => (
            <DocumentCard
              key={doc.id}
              document={doc}
              onView={handleViewDetails}
              onRetry={handleRetry}
              onDelete={(d) => setDocToDelete(d)}
            />
          ))}
        </div>
      )}

      {/* 5. Upload Document Modal */}
      <DocumentUploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onUpload={handleUploadSubmit}
      />

      {/* 6. Document Detail Drawer */}
      <DocumentDetailDrawer
        document={selectedDoc}
        isOpen={isDetailOpen}
        onClose={() => {
          setIsDetailOpen(false);
          setSelectedDoc(null);
        }}
        onRetry={handleRetry}
        onDelete={(d) => {
          setDocToDelete(d);
        }}
      />

      {/* 7. Permanent Delete Confirmation Modal */}
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
