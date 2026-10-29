import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { PageHeader } from '../../components/layout/PageHeader.tsx';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { Input } from '../../components/ui/Input.tsx';
import { Select } from '../../components/ui/Select.tsx';
import { Badge } from '../../components/ui/Badge.tsx';
import { LoadingState } from '../../components/ui/LoadingState.tsx';
import { EmptyState } from '../../components/ui/EmptyState.tsx';
import { ErrorState } from '../../components/ui/ErrorState.tsx';
import {
  MessageSquareText,
  Send,
  BookOpen,
  Quote,
  Sparkles,
  AlertTriangle,
  Database,
  CheckCircle2,
  FileText,
  HelpCircle,
  ExternalLink,
  AlertCircle,
} from 'lucide-react';
import { assistantService } from '../../services/assistant.service.ts';
import { DOCUMENT_TYPE_LABELS } from '../../types/document.ts';
import { useToast } from '../../hooks/useToast.ts';
import type {
  AssistantMessage,
  ScholarshipNoticeItem,
} from '../../types/assistant.ts';

const NOTICE_SUGGESTED_QUESTIONS = [
  'What is the minimum required percentage or score?',
  'What is the application deadline?',
  'Which documents are required?',
  'What is the family income limit?',
  'Who is eligible to apply?',
];

const PERSONAL_DOC_SUGGESTED_QUESTIONS = [
  'What is the full name of the applicant?',
  'What is the form or registration number?',
  'What is the Class XII percentage?',
  'Which course or programme was applied for?',
  'What is the payment or submission date?',
];

export const AssistantPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialDocId = searchParams.get('documentId') || '';

  const [notices, setNotices] = useState<ScholarshipNoticeItem[]>([]);
  const [selectedNoticeId, setSelectedNoticeId] = useState<string>(initialDocId);
  // Store conversations separated strictly by document ID so switching documents never contaminates answers
  const [messagesByDocId, setMessagesByDocId] = useState<Record<string, AssistantMessage[]>>({});
  const [inputQuestion, setInputQuestion] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const [isIndexing, setIsIndexing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [invalidDeepLinkId, setInvalidDeepLinkId] = useState<string | null>(null);

  const toast = useToast();
  const navigate = useNavigate();

  const getNoticeStateExplanation = (notice?: ScholarshipNoticeItem) => {
    if (!notice) return '';
    if (notice.status === 'FAILED') {
      return 'The document could not be processed.';
    }
    if (notice.status !== 'READY') {
      return 'The document is still being processed.';
    }
    switch (notice.indexingStatus) {
      case 'INDEXED':
        return 'Ready to answer questions grounded in this document';
      case 'INDEXING':
        return 'The document is currently being indexed.';
      case 'INDEX_FAILED':
        return 'Indexing failed. You can retry indexing above.';
      case 'NOT_INDEXED':
      default:
        return 'This document has not been indexed for question answering yet.';
    }
  };

  const loadNotices = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const list = await assistantService.getAvailableNotices();
      setNotices(list);
      if (list.length > 0) {
        if (initialDocId) {
          const requestedMatch = list.find((n) => n.id === initialDocId);
          if (requestedMatch) {
            setSelectedNoticeId(requestedMatch.id);
            setInvalidDeepLinkId(null);
            return;
          } else {
            setInvalidDeepLinkId(initialDocId);
          }
        }
        setSelectedNoticeId((prevId) => {
          if (prevId && list.some((n) => n.id === prevId)) {
            return prevId;
          }
          const firstIndexed = list.find((n) => n.indexingStatus === 'INDEXED');
          return firstIndexed ? firstIndexed.id : list[0].id;
        });
      }
    } catch (err: any) {
      console.error('Failed to load documents for RAG:', err);
      setLoadError(err?.message || 'Could not load documents from the server.');
    } finally {
      setIsLoading(false);
    }
  }, [initialDocId]);

  useEffect(() => {
    loadNotices();
  }, [loadNotices]);

  const handleSelectDocument = (newDocId: string) => {
    setSelectedNoticeId(newDocId);
    setInvalidDeepLinkId(null);
    setInputQuestion('');
    setSearchParams(newDocId ? { documentId: newDocId } : {}, { replace: true });
  };

  const selectedNotice = notices.find((n) => n.id === selectedNoticeId);
  const currentMessages: AssistantMessage[] = selectedNoticeId
    ? messagesByDocId[selectedNoticeId] || []
    : [];
  const isSelectedReadyForQA =
    selectedNotice?.status === 'READY' && selectedNotice?.indexingStatus === 'INDEXED';
  const isScholarshipNotice = selectedNotice?.documentType === 'SCHOLARSHIP_NOTICE';
  const suggestedQuestions = isScholarshipNotice
    ? NOTICE_SUGGESTED_QUESTIONS
    : PERSONAL_DOC_SUGGESTED_QUESTIONS;

  const handleIndexNotice = async () => {
    if (!selectedNoticeId || isIndexing) return;
    setIsIndexing(true);
    try {
      const res = await assistantService.indexNotice(selectedNoticeId);
      toast.success(`Successfully indexed ${res.chunkCount || 0} passages from the document.`);
      await loadNotices();
    } catch (err: any) {
      console.error('Indexing failed:', err);
      toast.error(err?.message || 'Failed to index document');
    } finally {
      setIsIndexing(false);
    }
  };

  const handleAsk = async (questionText?: string) => {
    const q = (questionText ?? inputQuestion).trim();
    if (!q || isAsking) return;

    if (!selectedNoticeId || !selectedNotice) {
      toast.warning('Please select a document first.');
      return;
    }

    if (!isSelectedReadyForQA) {
      toast.warning('This document is not yet indexed for question answering. Please click "Index for Q&A" first.');
      return;
    }

    const activeDocId = selectedNoticeId;

    const userMsg: AssistantMessage = {
      id: 'usr_' + crypto.randomUUID(),
      role: 'user',
      content: q,
      timestamp: new Date().toISOString(),
      documentContextId: activeDocId,
    };

    setMessagesByDocId((prev) => ({
      ...prev,
      [activeDocId]: [...(prev[activeDocId] || []), userMsg],
    }));

    if (!questionText) {
      setInputQuestion('');
    }
    setIsAsking(true);

    try {
      const response = await assistantService.sendQuery({
        documentId: activeDocId,
        question: q,
      });

      const botMsg: AssistantMessage = {
        id: 'ast_' + crypto.randomUUID(),
        role: 'assistant',
        content: response.answer,
        status: response.status,
        timestamp: new Date().toISOString(),
        citations: response.sources,
        warnings: response.warnings,
        documentContextId: activeDocId,
      };

      setMessagesByDocId((prev) => ({
        ...prev,
        [activeDocId]: [...(prev[activeDocId] || []), botMsg],
      }));
    } catch (err: any) {
      console.error('RAG query error:', err);
      const errorMsg: AssistantMessage = {
        id: 'ast_err_' + crypto.randomUUID(),
        role: 'assistant',
        content:
          err?.message ||
          'Could not retrieve an answer from the document service. Please verify your connection or try again.',
        status: 'ERROR',
        timestamp: new Date().toISOString(),
        documentContextId: activeDocId,
      };
      setMessagesByDocId((prev) => ({
        ...prev,
        [activeDocId]: [...(prev[activeDocId] || []), errorMsg],
      }));
    } finally {
      setIsAsking(false);
    }
  };

  const renderNoticeStateBadge = (notice: ScholarshipNoticeItem) => {
    if (notice.status === 'FAILED') {
      return (
        <Badge variant="danger" icon={<AlertTriangle size={12} />}>
          Processing Failed
        </Badge>
      );
    }
    if (notice.status !== 'READY') {
      return (
        <Badge variant="warning" icon={<Database size={12} />}>
          Processing ({notice.status})
        </Badge>
      );
    }

    switch (notice.indexingStatus) {
      case 'INDEXED':
        return (
          <Badge variant="success" icon={<CheckCircle2 size={12} />}>
            Indexed & Ready
          </Badge>
        );
      case 'INDEXING':
        return (
          <Badge variant="brand" icon={<Database size={12} />}>
            Indexing...
          </Badge>
        );
      case 'INDEX_FAILED':
        return (
          <Badge variant="danger" icon={<AlertTriangle size={12} />}>
            Index Failed
          </Badge>
        );
      case 'NOT_INDEXED':
      default:
        return (
          <Badge variant="neutral" icon={<HelpCircle size={12} />}>
            Not Indexed
          </Badge>
        );
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <PageHeader
        title="Document AI Assistant"
        description="Select any uploaded document or scholarship notice to ask source-grounded questions with page citations."
        badge={<Badge variant="brand" icon={<Sparkles size={12} />}>Source-Grounded Q&A</Badge>}
      />

      {invalidDeepLinkId && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: 'var(--radius-card)',
            backgroundColor: 'var(--warning-light, #FFFBEB)',
            border: '1px solid var(--warning-border, #FDE68A)',
            color: 'var(--warning-dark, #92400E)',
            fontSize: 'var(--text-xs)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          <AlertTriangle size={16} style={{ flexShrink: 0 }} />
          <span>
            The requested document ID (<code>{invalidDeepLinkId}</code>) was not found in your vault or you do not have permission to access it.
          </span>
        </div>
      )}

      {isLoading ? (
        <LoadingState message="Loading your documents for Q&A..." fullHeight />
      ) : loadError ? (
        <ErrorState
          title="Could Not Load Documents"
          message={loadError}
          onRetry={loadNotices}
        />
      ) : notices.length === 0 ? (
        <EmptyState
          icon={<FileText size={40} />}
          title="No documents available for Q&A"
          description="Upload a document or scholarship notice in My Documents to ask source-grounded questions."
          action={
            <Button variant="primary" onClick={() => navigate('/app/documents')}>
              Go to My Documents
            </Button>
          }
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Document Context Selector Card */}
          <Card style={{ padding: '16px 20px' }}>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '14px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: '1 1 320px' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--brand-light)',
                    color: 'var(--brand-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <BookOpen size={18} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <label
                    htmlFor="assistant-document-select"
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      color: 'var(--text-muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      display: 'block',
                      marginBottom: '4px',
                    }}
                  >
                    Select Document for Question Answering
                  </label>
                  <Select
                    id="assistant-document-select"
                    options={notices.map((n) => {
                      const typeName =
                        DOCUMENT_TYPE_LABELS[n.documentType as keyof typeof DOCUMENT_TYPE_LABELS] ||
                        n.documentType;
                      const stateTag =
                        n.status !== 'READY'
                          ? n.status
                          : n.indexingStatus === 'INDEXED'
                            ? 'Indexed'
                            : 'Needs Indexing';
                      return {
                        value: n.id,
                        label: `${n.customTitle || n.fileName} [${typeName}] — ${n.pageCount} ${
                          n.pageCount === 1 ? 'page' : 'pages'
                        } (${stateTag})`,
                      };
                    })}
                    value={selectedNoticeId}
                    onChange={(e) => handleSelectDocument(e.target.value)}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginTop: '6px' }}>
                    {selectedNotice && (
                      <Badge variant="neutral" size="sm">
                        {DOCUMENT_TYPE_LABELS[
                          selectedNotice.documentType as keyof typeof DOCUMENT_TYPE_LABELS
                        ] || selectedNotice.documentType}
                      </Badge>
                    )}
                    {selectedNotice?.issuer && (
                      <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--brand-primary)' }}>
                        Institution / Issuer: {selectedNotice.issuer}
                      </span>
                    )}
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {getNoticeStateExplanation(selectedNotice)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Status and Index Action */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', flexShrink: 0 }}>
                {selectedNotice && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate('/app/documents/' + selectedNotice.id)}
                    rightIcon={<ExternalLink size={13} />}
                  >
                    View Document Details
                  </Button>
                )}
                {selectedNotice && renderNoticeStateBadge(selectedNotice)}

                {selectedNotice && selectedNotice.status === 'READY' && selectedNotice.indexingStatus !== 'INDEXED' && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleIndexNotice}
                    disabled={isIndexing || selectedNotice.indexingStatus === 'INDEXING'}
                    leftIcon={<Database size={13} />}
                  >
                    {isIndexing ? 'Indexing...' : 'Index for Q&A'}
                  </Button>
                )}
              </div>
            </div>
          </Card>

          {/* Advisory banner if selected document is not ready/indexed */}
          {selectedNotice && !isSelectedReadyForQA && (
            <div
              style={{
                padding: '12px 18px',
                borderRadius: 'var(--radius-card)',
                backgroundColor: 'var(--warning-light, #FFFBEB)',
                border: '1px solid var(--warning-border, #FDE68A)',
                color: 'var(--warning-dark, #92400E)',
                fontSize: 'var(--text-sm)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <AlertTriangle size={20} style={{ flexShrink: 0 }} />
                <div>
                  {selectedNotice.status === 'FAILED' ? (
                    <>
                      <strong>Processing failed:</strong> The document could not be processed. Open{' '}
                      <Link to={`/app/documents/${selectedNotice.id}`} style={{ color: 'inherit', fontWeight: 600 }}>
                        Document Details
                      </Link>{' '}
                      to retry processing.
                    </>
                  ) : selectedNotice.status !== 'READY' ? (
                    <>
                      <strong>Processing in progress:</strong> The document is still being processed by the background extraction worker.
                    </>
                  ) : (
                    <>
                      <strong>Document not indexed:</strong> This document has not been indexed for question answering yet. Click{' '}
                      <strong>"Index for Q&A"</strong> to index its passages before submitting questions.
                    </>
                  )}
                </div>
              </div>
              {selectedNotice.status === 'READY' && selectedNotice.indexingStatus !== 'INDEXED' && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleIndexNotice}
                  disabled={isIndexing}
                  leftIcon={<Database size={13} />}
                >
                  {isIndexing ? 'Indexing...' : 'Index for Q&A'}
                </Button>
              )}
            </div>
          )}

          {/* Main Q&A Card */}
          <Card style={{ minHeight: '520px', display: 'flex', flexDirection: 'column' }}>
            <CardHeader style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'var(--brand-light)',
                      color: 'var(--brand-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <MessageSquareText size={18} />
                  </div>
                  <div>
                    <CardTitle style={{ fontSize: 'var(--text-base)' }}>
                      {selectedNotice?.customTitle || selectedNotice?.fileName || 'Document Inquiries'}
                    </CardTitle>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                      Retrieval strictly isolated to the selected document ({selectedNotice?.fileName})
                    </span>
                  </div>
                </div>
                {currentMessages.length > 0 && selectedNoticeId && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setMessagesByDocId((prev) => ({
                        ...prev,
                        [selectedNoticeId]: [],
                      }))
                    }
                  >
                    Clear Conversation
                  </Button>
                )}
              </div>
            </CardHeader>

            {/* Messages Stream */}
            <CardContent
              style={{
                flex: 1,
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '20px',
                overflowY: 'auto',
                minHeight: '360px',
              }}
            >
              {currentMessages.length === 0 ? (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '40px 20px',
                    textAlign: 'center',
                    gap: '16px',
                    color: 'var(--text-muted)',
                  }}
                >
                  <Sparkles size={36} style={{ color: 'var(--brand-primary)' }} />
                  <div>
                    <h4 style={{ fontSize: 'var(--text-base)', color: 'var(--text-primary)', marginBottom: '4px' }}>
                      Ask a question about {selectedNotice?.customTitle || selectedNotice?.fileName || 'the selected document'}
                    </h4>
                    <p style={{ fontSize: 'var(--text-sm)', maxWidth: '520px' }}>
                      Answers are generated strictly from retrieved passages in the selected document, complete with source page citations and evidence snippets.
                    </p>
                  </div>

                  {/* Suggested Question Pills */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center', marginTop: '12px' }}>
                    {suggestedQuestions.map((q, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleAsk(q)}
                        disabled={isAsking || !isSelectedReadyForQA}
                        title={!isSelectedReadyForQA ? 'Index document first to ask questions' : undefined}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '16px',
                          border: '1px solid var(--border-subtle)',
                          backgroundColor: 'var(--surface)',
                          fontSize: 'var(--text-xs)',
                          color: 'var(--text-secondary)',
                          cursor: isSelectedReadyForQA ? 'pointer' : 'not-allowed',
                          opacity: isSelectedReadyForQA ? 1 : 0.6,
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                currentMessages.map((msg) => {
                  const isError = msg.status === 'ERROR';
                  const isInsufficient = msg.status === 'INSUFFICIENT_EVIDENCE';

                  return (
                    <div
                      key={msg.id}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
                        maxWidth: '85%',
                        alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                      }}
                    >
                      <div
                        style={{
                          padding: '14px 18px',
                          borderRadius: 'var(--radius-card)',
                          backgroundColor:
                            msg.role === 'user'
                              ? 'var(--brand-primary)'
                              : isError
                                ? 'var(--danger-light, #FEF2F2)'
                                : isInsufficient
                                  ? 'var(--warning-light, #FFFBEB)'
                                  : 'var(--surface-muted)',
                          color:
                            msg.role === 'user'
                              ? 'var(--text-inverse)'
                              : isError
                                ? 'var(--danger, #DC2626)'
                                : isInsufficient
                                  ? 'var(--warning-dark, #92400E)'
                                  : 'var(--text-primary)',
                          border:
                            msg.role === 'user'
                              ? 'none'
                              : isError
                                ? '1px solid var(--danger-border, #FECACA)'
                                : isInsufficient
                                  ? '1px solid var(--warning-border, #FDE68A)'
                                  : '1px solid var(--border-subtle)',
                          fontSize: 'var(--text-sm)',
                          lineHeight: 1.5,
                        }}
                      >
                        {isError && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, marginBottom: '4px' }}>
                            <AlertCircle size={14} />
                            <span>Assistant Service Error</span>
                          </div>
                        )}
                        {isInsufficient && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, marginBottom: '4px' }}>
                            <AlertTriangle size={14} />
                            <span>Not Clearly Stated in Selected Document</span>
                          </div>
                        )}
                        {msg.content}
                      </div>

                      {/* Warnings if returned */}
                      {msg.warnings && msg.warnings.length > 0 && (
                        <div style={{ marginTop: '6px', fontSize: '11px', color: 'var(--text-muted)' }}>
                          Note: {msg.warnings.join(' • ')}
                        </div>
                      )}

                      {/* Citations / Source Snippets */}
                      {msg.citations && msg.citations.length > 0 && (
                        <div
                          style={{
                            marginTop: '10px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px',
                            width: '100%',
                          }}
                        >
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 600,
                              color: 'var(--text-muted)',
                              textTransform: 'uppercase',
                              letterSpacing: '0.04em',
                            }}
                          >
                            Retrieved Source Passages ({msg.citations.length})
                          </span>

                          {msg.citations.map((cit) => (
                            <div
                              key={cit.id}
                              style={{
                                padding: '10px 14px',
                                borderRadius: 'var(--radius-sm)',
                                backgroundColor: 'var(--surface-subtle)',
                                border: '1px solid var(--brand-border)',
                                fontSize: 'var(--text-xs)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '6px',
                              }}
                            >
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  flexWrap: 'wrap',
                                  color: 'var(--brand-primary)',
                                  fontWeight: 600,
                                }}
                              >
                                <BookOpen size={13} />
                                <span>{cit.sourceDocument}</span>
                                <Badge variant="brand" size="sm">
                                  Page {cit.page}
                                </Badge>
                                {typeof cit.relevanceScore === 'number' && (
                                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 500 }}>
                                    Relevance: {Math.round(cit.relevanceScore * 100)}%
                                  </span>
                                )}
                                <Link
                                  to={`/app/documents/${cit.documentId || selectedNoticeId}`}
                                  style={{
                                    marginLeft: 'auto',
                                    fontSize: '11px',
                                    color: 'var(--brand-primary)',
                                    textDecoration: 'none',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                  }}
                                >
                                  <span>View Document</span>
                                  <ExternalLink size={11} />
                                </Link>
                              </div>
                              <div
                                style={{
                                  display: 'flex',
                                  gap: '6px',
                                  color: 'var(--text-secondary)',
                                  fontStyle: 'italic',
                                  lineHeight: 1.4,
                                }}
                              >
                                <Quote
                                  size={12}
                                  style={{ flexShrink: 0, marginTop: '2px', color: 'var(--text-muted)' }}
                                />
                                <span>"{cit.snippet}"</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}

              {isAsking && (
                <div style={{ alignSelf: 'flex-start' }}>
                  <LoadingState message="Retrieving passages from selected document and generating answer..." size="sm" />
                </div>
              )}
            </CardContent>

            {/* Question Input Footer */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleAsk();
              }}
              style={{
                padding: '16px 24px',
                borderTop: '1px solid var(--border-subtle)',
                backgroundColor: 'var(--surface-subtle)',
                display: 'flex',
                gap: '12px',
              }}
            >
              <Input
                value={inputQuestion}
                onChange={(e) => setInputQuestion(e.target.value)}
                placeholder={
                  isSelectedReadyForQA
                    ? `Ask a question about ${selectedNotice?.customTitle || selectedNotice?.fileName || 'this document'}...`
                    : "This document must be indexed first. Click 'Index for Q&A' above to enable questions."
                }
                disabled={isAsking || !isSelectedReadyForQA}
                style={{ flex: 1 }}
              />
              <Button
                type="submit"
                variant="primary"
                disabled={!inputQuestion.trim() || isAsking || !isSelectedReadyForQA}
                rightIcon={<Send size={15} />}
              >
                Ask Assistant
              </Button>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
};
