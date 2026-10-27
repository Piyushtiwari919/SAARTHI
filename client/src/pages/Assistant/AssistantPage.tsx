import React, { useEffect, useState, useCallback } from 'react';
import { PageHeader } from '../../components/layout/PageHeader.tsx';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { Input } from '../../components/ui/Input.tsx';
import { Select } from '../../components/ui/Select.tsx';
import { Badge } from '../../components/ui/Badge.tsx';
import { LoadingState } from '../../components/ui/LoadingState.tsx';
import { EmptyState } from '../../components/ui/EmptyState.tsx';
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
} from 'lucide-react';
import { assistantService } from '../../services/assistant.service.ts';
import { useToast } from '../../hooks/useToast.ts';
import type {
  AssistantMessage,
  ScholarshipNoticeItem,
} from '../../types/assistant.ts';

const SUGGESTED_QUESTIONS = [
  'What is the minimum required percentage or score?',
  'What is the application deadline?',
  'Which documents are required for application?',
  'What is the family income limit?',
  'Who is eligible to apply for this scholarship?',
];

export const AssistantPage: React.FC = () => {
  const [notices, setNotices] = useState<ScholarshipNoticeItem[]>([]);
  const [selectedNoticeId, setSelectedNoticeId] = useState<string>('');
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [inputQuestion, setInputQuestion] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const [isIndexing, setIsIndexing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const toast = useToast();

  const loadNotices = useCallback(async () => {
    try {
      const list = await assistantService.getAvailableNotices();
      setNotices(list);
      if (list.length > 0 && !selectedNoticeId) {
        setSelectedNoticeId(list[0].id);
      }
    } catch (err: any) {
      console.error('Failed to load scholarship notices for RAG:', err);
      toast.error('Could not load scholarship notices');
    } finally {
      setIsLoading(false);
    }
  }, [selectedNoticeId, toast]);

  useEffect(() => {
    loadNotices();
  }, [loadNotices]);

  const selectedNotice = notices.find((n) => n.id === selectedNoticeId);

  const handleIndexNotice = async () => {
    if (!selectedNoticeId || isIndexing) return;
    setIsIndexing(true);
    try {
      const res = await assistantService.indexNotice(selectedNoticeId);
      toast.success(`Successfully indexed ${res.chunkCount || 0} passages from the document.`);
      // Refresh notices to show updated INDEXED status
      await loadNotices();
    } catch (err: any) {
      console.error('Indexing failed:', err);
      toast.error(err?.message || 'Failed to index scholarship notice');
    } finally {
      setIsIndexing(false);
    }
  };

  const handleAsk = async (questionText?: string) => {
    const q = (questionText || inputQuestion).trim();
    if (!q || isAsking) return;

    if (!selectedNoticeId) {
      toast.warning('Please select a scholarship notice first.');
      return;
    }

    const userMsg: AssistantMessage = {
      id: 'usr_' + Math.random().toString(36).slice(2, 9),
      role: 'user',
      content: q,
      timestamp: new Date().toISOString(),
      documentContextId: selectedNoticeId,
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!questionText) {
      setInputQuestion('');
    }
    setIsAsking(true);

    try {
      const response = await assistantService.sendQuery({
        documentId: selectedNoticeId,
        question: q,
      });

      const botMsg: AssistantMessage = {
        id: 'ast_' + Math.random().toString(36).slice(2, 9),
        role: 'assistant',
        content: response.answer,
        status: response.status,
        timestamp: new Date().toISOString(),
        citations: response.sources,
        documentContextId: selectedNoticeId,
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (err: any) {
      console.error('RAG query error:', err);
      const errorMsg: AssistantMessage = {
        id: 'ast_err_' + Math.random().toString(36).slice(2, 9),
        role: 'assistant',
        content:
          err?.message ||
          'Could not retrieve an answer from the document service. Please verify your connection or try again.',
        status: 'INSUFFICIENT_EVIDENCE',
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsAsking(false);
    }
  };

  const renderIndexingBadge = (status: string) => {
    switch (status) {
      case 'INDEXED':
        return (
          <Badge variant="success" icon={<CheckCircle2 size={12} />}>
            Vector Indexed
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
        title="Document RAG Assistant"
        description="Query original government guidelines and scholarship circulars with verified citations and exact page references."
        badge={<Badge variant="brand" icon={<Sparkles size={12} />}>RAG Grounded</Badge>}
      />

      {isLoading ? (
        <LoadingState message="Loading scholarship notices..." fullHeight />
      ) : notices.length === 0 ? (
        <EmptyState
          icon={<FileText size={40} />}
          title="No Scholarship Notices Available"
          description="Upload an official scholarship circular, guidelines PDF, or opportunity notice in your Document Vault to begin asking source-grounded questions."
          action={
            <Button variant="primary" onClick={() => (window.location.href = '/documents')}>
              Go to Document Vault
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: '1 1 300px' }}>
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
                    Active Document Context
                  </label>
                  <Select
                    options={notices.map((n) => ({
                      value: n.id,
                      label: `${n.customTitle || n.fileName} (${n.pageCount} ${
                        n.pageCount === 1 ? 'page' : 'pages'
                      })`,
                    }))}
                    value={selectedNoticeId}
                    onChange={(e) => setSelectedNoticeId(e.target.value)}
                  />
                </div>
              </div>

              {/* Status and Index Action */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                {selectedNotice && renderIndexingBadge(selectedNotice.indexingStatus)}

                {selectedNotice && selectedNotice.indexingStatus !== 'INDEXED' && (
                  <Button
                    variant="secondary"
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

          {/* Main Q&A Card */}
          <Card style={{ minHeight: '520px', display: 'flex', flexDirection: 'column' }}>
            <CardHeader style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
                      Source-grounded retrieval strictly isolated to the selected notice
                    </span>
                  </div>
                </div>
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
              {messages.length === 0 ? (
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
                      Ask anything about this scholarship notice
                    </h4>
                    <p style={{ fontSize: 'var(--text-sm)', maxWidth: '480px' }}>
                      Questions are answered strictly using retrieved passages from the official notice. Every answer
                      is grounded with exact page citations.
                    </p>
                  </div>

                  {/* Suggested Question Pills */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center', marginTop: '12px' }}>
                    {SUGGESTED_QUESTIONS.map((q, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleAsk(q)}
                        disabled={isAsking}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '16px',
                          border: '1px solid var(--border-subtle)',
                          backgroundColor: 'var(--surface)',
                          fontSize: 'var(--text-xs)',
                          color: 'var(--text-secondary)',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = 'var(--brand-primary)';
                          e.currentTarget.style.color = 'var(--brand-primary)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = 'var(--border-subtle)';
                          e.currentTarget.style.color = 'var(--text-secondary)';
                        }}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((msg) => (
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
                            : msg.status === 'INSUFFICIENT_EVIDENCE'
                            ? 'var(--warning-light, #FFFBEB)'
                            : 'var(--surface-muted)',
                        color:
                          msg.role === 'user'
                            ? 'var(--text-inverse)'
                            : msg.status === 'INSUFFICIENT_EVIDENCE'
                            ? 'var(--warning-dark, #92400E)'
                            : 'var(--text-primary)',
                        border:
                          msg.role === 'user'
                            ? 'none'
                            : msg.status === 'INSUFFICIENT_EVIDENCE'
                            ? '1px solid var(--warning-border, #FDE68A)'
                            : '1px solid var(--border-subtle)',
                        fontSize: 'var(--text-sm)',
                        lineHeight: 1.5,
                      }}
                    >
                      {msg.status === 'INSUFFICIENT_EVIDENCE' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, marginBottom: '4px' }}>
                          <AlertTriangle size={14} />
                          <span>Insufficient Document Evidence</span>
                        </div>
                      )}
                      {msg.content}
                    </div>

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
                          Verified Grounding Citations ({msg.citations.length})
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
                                gap: '6px',
                                color: 'var(--brand-primary)',
                                fontWeight: 600,
                              }}
                            >
                              <BookOpen size={13} />
                              <span>{cit.sourceDocument}</span>
                              <span style={{ color: 'var(--border)' }}>•</span>
                              <Badge variant="brand" size="sm">
                                Page {cit.page}
                              </Badge>
                              {cit.relevanceScore && (
                                <span style={{ marginLeft: 'auto', fontSize: '10px', color: 'var(--text-muted)' }}>
                                  Score: {Math.round(cit.relevanceScore * 100)}%
                                </span>
                              )}
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
                ))
              )}

              {isAsking && (
                <div style={{ alignSelf: 'flex-start' }}>
                  <LoadingState message="FastAPI vector retrieval & LLM synthesis in progress..." size="sm" />
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
                placeholder="Ask about percentages, deadlines, income limits, or required documents..."
                disabled={isAsking}
                style={{ flex: 1 }}
              />
              <Button
                type="submit"
                variant="primary"
                disabled={!inputQuestion.trim() || isAsking}
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
