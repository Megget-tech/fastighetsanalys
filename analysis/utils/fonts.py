"""
Typsnitt för PDF-rapporterna (fpdf2). Väljer första som finns: PDF_FONT/PDF_FONT_BOLD (miljövariabler),
DejaVu Sans (Linux/Docker, paketet fonts-dejavu-core) och sist Arial Unicode (macOS).
"""
import os

_REGULAR = [
    os.getenv("PDF_FONT"),
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
]
_BOLD = [
    os.getenv("PDF_FONT_BOLD"),
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
]


def _first_existing(paths):
    for p in paths:
        if p and os.path.exists(p):
            return p
    raise FileNotFoundError("Inget typsnitt för PDF hittades. Sätt PDF_FONT till en .ttf med svenska tecken.")


def add_unicode_fonts(pdf, family: str = "DejaVu") -> None:
    """Registrera vanlig och fet stil under `family` i ett FPDF-objekt."""
    pdf.add_font(family, "", _first_existing(_REGULAR))
    pdf.add_font(family, "B", _first_existing(_BOLD))
