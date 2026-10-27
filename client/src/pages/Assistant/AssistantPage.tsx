import React, { useEffect, useState } from 'react';
import { PageHeader } from '../../components/layout/PageHeader.tsx';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { Input } from '../../components/ui/Input.tsx';
import { Badge } from '../../components/ui/Badge.tsx';
import { LoadingState } from '../../components/ui/LoadingState.tsx';
import { MessageSquareText, Send, BookOpen, Quote, Sparkles } from 'lucide-react';
import { assistantService } from '../../services/assistant.service.ts';
import type { AssistantConversation, AssistantMessage } from '../../types/assistant.ts';

export const AssistantPage: React.FC = () => {
  const [conversations, setConversations] = useState<AssistantConversation[]>([]);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [inputQuestion, setInputQuestion] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    assistantService.getConversations().then((convs) => {
      setConversations(convs);
      if (convs.length > 0) {
        setMessages(convs[0].messages);
      }
      setIsLoading(false);
    });
  }, []);

  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputQuestion.trim() || isAsking) return;

    const userMsg: AssistantMessage = {
      id: `usr_${Date.now()}`,
      role: 'user',
      content: inputQuestion,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    const currentQ = inputQuestion;
    setInputQuestion('');
    setIsAsking(true);

    try {
      const response = await assistantService.sendQuery({ question: currentQ });
      const botMsg: AssistantMessage = {
        id: `ast_${Date.now()}`,
        role: 'assistant',
        content: response.answer,
        timestamp: new Date().toISOString(),
        citations: response.sources,
      };
      setMessages((prev) => [...prev, botMsg]);
    } finally {
      setIsAsking(false);
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
        <LoadingState message="Loading conversational context..." fullHeight />
      ) : (
        <Card style={{ minHeight: '520px', display: 'flex', flexDirection: 'column' }}>
          <CardHeader style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '14px' }}>
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
                  {conversations[0]?.title || 'Opportunity Document Inquiries'}
                </CardTitle>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                  Grounded in official Central Sector Scheme circulars
                </span>
              </div>
            </div>
          </CardHeader>

          {/* Messages Stream */}
          <CardContent style={{ flex: 1, padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto' }}>
            {messages.map((msg) => (
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
                    backgroundColor: msg.role === 'user' ? 'var(--brand-primary)' : 'var(--surface-muted)',
                    color: msg.role === 'user' ? 'var(--text-inverse)' : 'var(--text-primary)',
                    border: msg.role === 'user' ? 'none' : '1px solid var(--border-subtle)',
                    fontSize: 'var(--text-sm)',
                    lineHeight: 1.5,
                  }}
                >
                  {msg.content}
                </div>

                {/* Citations / Source Snippets */}
                {msg.citations && msg.citations.length > 0 && (
                  <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Grounding Sources ({msg.citations.length})
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--brand-primary)', fontWeight: 600 }}>
                          <BookOpen size={13} />
                          <span>{cit.sourceDocument}</span>
                          <span style={{ color: 'var(--border)' }}>•</span>
                          <span>Page {cit.page}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '6px', color: 'var(--text-secondary)', fontStyle: 'italic', lineHeight: 1.4 }}>
                          <Quote size={12} style={{ flexShrink: 0, marginTop: '2px', color: 'var(--text-muted)' }} />
                          <span>"{cit.snippet}"</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {isAsking && (
              <div style={{ alignSelf: 'flex-start' }}>
                <LoadingState message="FastAPI worker querying document vector index..." size="sm" />
              </div>
            )}
          </CardContent>

          {/* Question Input Footer */}
          <form
            onSubmit={handleAsk}
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
              placeholder="Ask a question about renewal rules, documents, or eligibility clauses..."
              disabled={isAsking}
              style={{ flex: 1 }}
            />
            <Button
              type="submit"
              variant="primary"
              disabled={!inputQuestion.trim() || isAsking}
              rightIcon={<Send size={15} />}
            >
              Ask AI
            </Button>
          </form>
        </Card>
      )}
    </div>
  );
};
