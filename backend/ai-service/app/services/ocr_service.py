"""OCR service wrapping pytesseract with availability detection and safe error handling."""

import io
import logging
from typing import Optional
from PIL import Image
import pytesseract

from app.core.config import Settings
from app.utils.file_validation import DocumentServiceException

logger = logging.getLogger(__name__)


class OCRService:
    """Service handling optical character recognition for scanned pages and images."""

    def __init__(self, settings: Settings):
        self.settings = settings
        if self.settings.TESSERACT_CMD:
            pytesseract.pytesseract.tesseract_cmd = self.settings.TESSERACT_CMD

    def is_available(self) -> bool:
        """Check if Tesseract binary is accessible and executable."""
        if not self.settings.OCR_ENABLED:
            return False
        try:
            pytesseract.get_tesseract_version()
            return True
        except Exception:
            return False

    def extract_text_from_image(self, image: Image.Image) -> str:
        """
        Extract text from a PIL Image.

        Raises:
            DocumentServiceException with OCR_ENGINE_UNAVAILABLE if Tesseract is missing.
        """
        if not self.settings.OCR_ENABLED:
            raise DocumentServiceException(
                error_code="OCR_ENGINE_UNAVAILABLE",
                message="OCR processing is disabled in configuration",
                status_code=503,
            )

        if not self.is_available():
            raise DocumentServiceException(
                error_code="OCR_ENGINE_UNAVAILABLE",
                message=(
                    "OCR engine (Tesseract) is unavailable on this server. "
                    "Please install Tesseract OCR and configure its path."
                ),
                status_code=503,
            )

        try:
            text = pytesseract.image_to_string(image)
            return text.strip()
        except DocumentServiceException:
            raise
        except Exception as exc:
            logger.error("OCR execution failed: %s", type(exc).__name__)
            raise DocumentServiceException(
                error_code="EXTRACTION_FAILED",
                message="Optical character recognition failed during execution",
                status_code=422,
            ) from exc

    def extract_text_from_image_bytes(self, image_bytes: bytes) -> str:
        """Extract text from raw image bytes (JPEG / PNG)."""
        try:
            with Image.open(io.BytesIO(image_bytes)) as img:
                return self.extract_text_from_image(img)
        except DocumentServiceException:
            raise
        except Exception as exc:
            raise DocumentServiceException(
                error_code="INVALID_DOCUMENT",
                message="Uploaded image could not be decoded",
                status_code=422,
            ) from exc

