"""Page-preserving document text chunker.

Guarantees:
1. Chunks never span across multiple pages; each chunk is strictly contained within its source page.
2. Exact 1-based page numbers are preserved directly from DocumentLoader PageContent.
3. Whitespace and non-printable artifacts are normalized.
4. Deterministic content hashing and chunk IDs ensure idempotent indexing.
"""

import hashlib
import re
from typing import List

from app.rag.models import DocumentChunk
from app.services.document_loader import PageContent


class PagePreservingChunker:
    """Splits page content into bounded passages with modest overlap while maintaining strict page provenance."""

    def __init__(
        self,
        chunk_size: int = 600,
        chunk_overlap: int = 100,
        min_chunk_length: int = 40,
        indexing_version: str = "v1",
    ):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.min_chunk_length = min_chunk_length
        self.indexing_version = indexing_version

    def clean_text(self, text: str) -> str:
        """Normalize line breaks, multi-spaces, and strip control characters."""
        if not text:
            return ""
        # Remove control characters except standard whitespace
        text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", text)
        # Normalize multiple spaces and tabs to single spaces
        text = re.sub(r"[ \t]+", " ", text)
        # Normalize multiple newlines to double newlines (paragraphs)
        text = re.sub(r"\n\s*\n+", "\n\n", text)
        return text.strip()

    def chunk_pages(
        self,
        document_id: str,
        document_title: str,
        pages: List[PageContent],
    ) -> List[DocumentChunk]:
        """
        Chunk pages preserving 1-based page numbers strictly.
        Never concatenates separate pages together.
        """
        all_chunks: List[DocumentChunk] = []

        for page in pages:
            # Skip pages that have no usable extracted text or failed OCR
            if not page.text or page.status == "NO_USABLE_TEXT":
                continue

            cleaned = self.clean_text(page.text)
            if len(cleaned) < self.min_chunk_length:
                # If page text is very short, keep it as a single chunk if meaningful
                if len(cleaned.strip()) > 10:
                    content_hash = hashlib.sha256(
                        f"{document_id}_{page.page_number}_0_{cleaned}".encode("utf-8")
                    ).hexdigest()[:16]
                    chunk_id = f"{document_id}_p{page.page_number}_c0"
                    all_chunks.append(
                        DocumentChunk(
                            chunk_id=chunk_id,
                            document_id=document_id,
                            document_title=document_title,
                            page_number=page.page_number,
                            chunk_text=cleaned,
                            content_hash=content_hash,
                            indexing_version=self.indexing_version,
                        )
                    )
                continue

            # Split text on paragraph boundaries first, then sentence boundaries
            page_chunks = self._split_page_into_chunks(cleaned)

            for idx, chunk_text in enumerate(page_chunks):
                content_hash = hashlib.sha256(
                    f"{document_id}_{page.page_number}_{idx}_{chunk_text}".encode("utf-8")
                ).hexdigest()[:16]
                chunk_id = f"{document_id}_p{page.page_number}_c{idx}"
                all_chunks.append(
                    DocumentChunk(
                        chunk_id=chunk_id,
                        document_id=document_id,
                        document_title=document_title,
                        page_number=page.page_number,
                        chunk_text=chunk_text,
                        content_hash=content_hash,
                        indexing_version=self.indexing_version,
                    )
                )

        return all_chunks

    def _split_page_into_chunks(self, text: str) -> List[str]:
        """Split text of a single page using sliding window with paragraph/sentence awareness."""
        if len(text) <= self.chunk_size:
            return [text]

        chunks: List[str] = []
        paragraphs = text.split("\n\n")
        current_chunk = ""

        for para in paragraphs:
            para = para.strip()
            if not para:
                continue

            if not current_chunk:
                current_chunk = para
            elif len(current_chunk) + len(para) + 2 <= self.chunk_size:
                current_chunk += "\n\n" + para
            else:
                # current_chunk is full; flush it
                chunks.append(current_chunk.strip())

                # If current paragraph itself exceeds chunk_size, split by sentences
                if len(para) > self.chunk_size:
                    sub_chunks = self._split_sentences(para)
                    chunks.extend(sub_chunks[:-1])
                    current_chunk = sub_chunks[-1] if sub_chunks else ""
                else:
                    # Apply overlap from end of previous chunk if useful
                    overlap_seed = current_chunk[-self.chunk_overlap :] if len(current_chunk) > self.chunk_overlap else ""
                    current_chunk = f"{overlap_seed} {para}".strip()

        if current_chunk and current_chunk.strip():
            chunks.append(current_chunk.strip())

        return [c for c in chunks if len(c) >= self.min_chunk_length]

    def _split_sentences(self, text: str) -> List[str]:
        """Split long paragraph into smaller sentence-based units."""
        sentences = re.split(r"(?<=[.!?])\s+", text)
        result: List[str] = []
        curr = ""

        for s in sentences:
            if not curr:
                curr = s
            elif len(curr) + len(s) + 1 <= self.chunk_size:
                curr += " " + s
            else:
                result.append(curr.strip())
                curr = s

        if curr:
            result.append(curr.strip())

        return result

