import React, { useState, useRef } from 'react';
import { Modal } from '../ui/Modal.tsx';
import { Button } from '../ui/Button.tsx';
import { Select } from '../ui/Select.tsx';
import { Input } from '../ui/Input.tsx';
import { UploadCloud, FileText, X, AlertCircle, Lock } from 'lucide-react';
import type { DocumentType, DocumentUploadPayload } from '../../types/document.ts';
import { DOCUMENT_TYPE_LABELS } from '../../types/document.ts';
import { formatFileSize } from '../../utils/formatters.ts';

export interface DocumentUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (payload: DocumentUploadPayload) => Promise<void>;
}

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png'];
const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

export function inferCategoryFromFilename(fileName: string): DocumentType {
  const lower = fileName.toLowerCase();
  if (/income/i.test(lower)) return 'INCOME_CERTIFICATE';
  if (/scholarship|notice|circular|guideline/i.test(lower)) return 'SCHOLARSHIP_NOTICE';
  if (/marksheet|mark_sheet|grade_card|transcript/i.test(lower)) return 'MARKSHEET';
  if (/bonafide/i.test(lower)) return 'BONAFIDE_CERTIFICATE';
  if (/domicile|residence/i.test(lower)) return 'DOMICILE_CERTIFICATE';
  if (/caste|category_cert/i.test(lower)) return 'CASTE_CERTIFICATE';
  if (/fee_receipt|receipt/i.test(lower)) return 'FEE_RECEIPT';
  if (/admission|allotment/i.test(lower)) return 'ADMISSION_LETTER';
  if (/aadhaar|aadhar|identity|pan_card/i.test(lower)) return 'IDENTITY_PROOF';
  if (/bank|passbook/i.test(lower)) return 'BANK_DOCUMENT';
  return 'OTHER';
}

export const DocumentUploadModal: React.FC<DocumentUploadModalProps> = ({
  isOpen,
  onClose,
  onUpload,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [category, setCategory] = useState<DocumentType>('OTHER');
  const [hasManuallySelectedCategory, setHasManuallySelectedCategory] = useState(false);
  const [customTitle, setCustomTitle] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setSelectedFile(null);
    setCategory('OTHER');
    setHasManuallySelectedCategory(false);
    setCustomTitle('');
    setValidationError(null);
    setIsDragging(false);
    setIsSubmitting(false);
  };

  const handleClose = () => {
    if (isSubmitting) return;
    resetForm();
    onClose();
  };

  const validateAndSetFile = (file: File) => {
    setValidationError(null);

    // Extension and MIME validation
    const fileExt = '.' + file.name.split('.').pop()?.toLowerCase();
    const isExtensionValid = ALLOWED_EXTENSIONS.includes(fileExt);
    const isMimeValid = ALLOWED_MIME_TYPES.includes(file.type) || !file.type; // Fallback if OS doesn't set mime

    if (!isExtensionValid && !isMimeValid) {
      setValidationError('Unsupported file format. Please upload a PDF, JPG, or PNG document.');
      return;
    }

    // Size validation
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setValidationError(`File size exceeds 10 MB limit (${formatFileSize(file.size)}). Please compress or choose a smaller file.`);
      return;
    }

    setSelectedFile(file);
    if (!hasManuallySelectedCategory) {
      setCategory(inferCategoryFromFilename(file.name));
    }
    if (!customTitle) {
      // Auto-populate human title from file name
      setCustomTitle(file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '));
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setValidationError('Please select a document file to upload.');
      return;
    }

    if (!category) {
      setValidationError('Please specify the document type.');
      return;
    }

    setIsSubmitting(true);
    setValidationError(null);

    try {
      await onUpload({
        file: selectedFile,
        category,
        customTitle: customTitle.trim() || undefined,
        isSensitive: true,
      });
      resetForm();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed. Please try again.';
      setValidationError(msg);
      setIsSubmitting(false);
    }
  };

  const categoryOptions = (Object.keys(DOCUMENT_TYPE_LABELS) as DocumentType[]).map((key) => ({
    value: key,
    label: DOCUMENT_TYPE_LABELS[key],
  }));

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Upload Document to Vault"
      description="Add an academic certificate, registration form, or scholarship notice for extraction and Q&A."
      maxWidth="540px"
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
        {/* Document Category Selection */}
        <Select
          label="Document Type"
          options={categoryOptions}
          value={category}
          onChange={(e) => {
            setCategory(e.target.value as DocumentType);
            setHasManuallySelectedCategory(true);
          }}
          required
        />

        {/* Custom Title Input */}
        <Input
          label="Document Label / Title (Optional)"
          placeholder="e.g. AKTU Exam Form, Semester 4 Marksheet, Income Certificate"
          value={customTitle}
          onChange={(e) => setCustomTitle(e.target.value)}
          helperText="A recognizable label to identify this document in your vault"
        />

        {/* Drag & Drop File Zone */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text-primary)' }}>
            Document File <span style={{ color: 'var(--danger)' }}>*</span>
          </label>

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={handleFileInputChange}
            style={{ display: 'none' }}
          />

          {!selectedFile ? (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `2px dashed ${isDragging ? 'var(--brand-primary)' : 'var(--border)'}`,
                borderRadius: 'var(--radius-card)',
                backgroundColor: isDragging ? 'var(--brand-light)' : 'var(--surface-subtle)',
                padding: '32px 20px',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
              }}
            >
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--surface)',
                  color: isDragging ? 'var(--brand-primary)' : 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <UploadCloud size={22} />
              </div>

              <div>
                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Drag & drop your document here, or <span style={{ color: 'var(--brand-primary)' }}>browse</span>
                </div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Supports PDF, JPG, or PNG files (up to 10 MB)
                </div>
              </div>
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                backgroundColor: 'var(--surface-muted)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-input)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                <div style={{ color: 'var(--brand-primary)', flexShrink: 0 }}>
                  <FileText size={20} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 'var(--text-sm)',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {selectedFile.name}
                  </div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                    {formatFileSize(selectedFile.size)}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                aria-label="Remove selected file"
                style={{
                  color: 'var(--text-muted)',
                  padding: '4px',
                  borderRadius: 'var(--radius-xs)',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <X size={16} />
              </button>
            </div>
          )}
        </div>

        {/* Validation Error Banner */}
        {validationError && (
          <div
            style={{
              padding: '10px 14px',
              backgroundColor: 'var(--danger-light)',
              border: '1px solid var(--danger-border)',
              borderRadius: 'var(--radius-xs)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: 'var(--text-xs)',
              color: 'var(--danger)',
            }}
          >
            <AlertCircle size={15} style={{ flexShrink: 0 }} />
            <span>{validationError}</span>
          </div>
        )}

        {/* Calm Privacy Notice */}
        <div
          style={{
            padding: '12px 14px',
            backgroundColor: 'var(--surface-muted)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-xs)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px',
            fontSize: 'var(--text-xs)',
            color: 'var(--text-secondary)',
            lineHeight: 1.45,
          }}
        >
          <Lock size={15} style={{ color: 'var(--brand-primary)', flexShrink: 0, marginTop: '2px' }} />
          <span>
            <strong>Your document is private.</strong> Upload only the documents you are comfortable processing. Extracted text is used solely for checking scholarship eligibility criteria and answering your questions.
          </span>
        </div>

        {/* Action Buttons */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '12px',
            marginTop: '8px',
            paddingTop: '16px',
            borderTop: '1px solid var(--border-subtle)',
          }}
        >
          <Button type="button" variant="secondary" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            isLoading={isSubmitting}
            disabled={!selectedFile || isSubmitting}
          >
            Upload Document
          </Button>
        </div>
      </form>
    </Modal>
  );
};
