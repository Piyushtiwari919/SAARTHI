import React from 'react';
import type { DocumentStatus } from '../../types/document.ts';
import { Badge, type BadgeVariant } from '../ui/Badge.tsx';
import { Loader2, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import { formatStatusLabel } from '../../utils/formatters.ts';

export interface DocumentStatusBadgeProps {
  status: DocumentStatus;
  customLabel?: string;
  size?: 'sm' | 'md';
}

export const DocumentStatusBadge: React.FC<DocumentStatusBadgeProps> = ({
  status,
  customLabel,
  size = 'sm',
}) => {
  const getBadgeConfig = (): { variant: BadgeVariant; icon: React.ReactNode; label: string } => {
    switch (status) {
      case 'UPLOADED':
        return {
          variant: 'neutral',
          icon: <Clock size={size === 'sm' ? 12 : 14} />,
          label: 'Uploaded',
        };
      case 'QUEUED':
        return {
          variant: 'neutral',
          icon: <Clock size={size === 'sm' ? 12 : 14} />,
          label: 'Ingest Queue',
        };
      case 'PROCESSING':
        return {
          variant: 'brand',
          icon: <Loader2 size={size === 'sm' ? 12 : 14} style={{ animation: 'spin 1s linear infinite' }} />,
          label: 'Processing',
        };
      case 'OCR_COMPLETE':
        return {
          variant: 'brand',
          icon: <CheckCircle2 size={size === 'sm' ? 12 : 14} />,
          label: 'OCR Complete',
        };
      case 'ANALYZING':
        return {
          variant: 'warm',
          icon: <Loader2 size={size === 'sm' ? 12 : 14} style={{ animation: 'spin 1s linear infinite' }} />,
          label: 'Analyzing Rules',
        };
      case 'INDEXING':
        return {
          variant: 'brand',
          icon: <Loader2 size={size === 'sm' ? 12 : 14} style={{ animation: 'spin 1s linear infinite' }} />,
          label: 'RAG Indexing',
        };
      case 'READY':
        return {
          variant: 'success',
          icon: <CheckCircle2 size={size === 'sm' ? 12 : 14} />,
          label: 'Processed & Ready',
        };
      case 'FAILED':
        return {
          variant: 'danger',
          icon: <AlertCircle size={size === 'sm' ? 12 : 14} />,
          label: 'Failed',
        };
      default:
        return {
          variant: 'neutral',
          icon: null,
          label: formatStatusLabel(status),
        };
    }
  };

  const config = getBadgeConfig();

  return (
    <Badge variant={config.variant} size={size} icon={config.icon}>
      {customLabel || config.label}
    </Badge>
  );
};
