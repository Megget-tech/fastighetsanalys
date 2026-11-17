"""
PDF Report Generator using ReportLab
Converts JSON report output to professional PDF documents.
"""
import os
from typing import Dict, Any, List, Tuple
from datetime import datetime
import re

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib.enums import TA_JUSTIFY, TA_LEFT, TA_CENTER
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak,
    Table, TableStyle, KeepTogether
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont


class PDFReportGenerator:
    """
    Generates professional PDF reports from JSON report data using ReportLab.
    """

    def __init__(self):
        """Initialize PDF generator with styling."""
        self.styles = getSampleStyleSheet()
        self._setup_custom_styles()
        self.page_width, self.page_height = A4

    def _setup_custom_styles(self):
        """Set up custom paragraph styles."""
        # Title style
        self.styles.add(ParagraphStyle(
            name='CustomTitle',
            parent=self.styles['Heading1'],
            fontSize=24,
            textColor=colors.HexColor('#1a1a1a'),
            spaceAfter=30,
            alignment=TA_CENTER,
            fontName='Helvetica-Bold'
        ))

        # Section heading
        self.styles.add(ParagraphStyle(
            name='SectionHeading',
            parent=self.styles['Heading1'],
            fontSize=18,
            textColor=colors.HexColor('#2c3e50'),
            spaceAfter=12,
            spaceBefore=24,
            fontName='Helvetica-Bold',
            borderWidth=2,
            borderColor=colors.HexColor('#3498db'),
            borderPadding=6
        ))

        # Subsection heading
        self.styles.add(ParagraphStyle(
            name='SubsectionHeading',
            parent=self.styles['Heading2'],
            fontSize=14,
            textColor=colors.HexColor('#34495e'),
            spaceAfter=10,
            spaceBefore=18,
            fontName='Helvetica-Bold'
        ))

        # Body text
        self.styles.add(ParagraphStyle(
            name='CustomBody',
            parent=self.styles['BodyText'],
            fontSize=11,
            leading=16,
            alignment=TA_JUSTIFY,
            spaceAfter=12
        ))

        # Metadata box
        self.styles.add(ParagraphStyle(
            name='Metadata',
            parent=self.styles['Normal'],
            fontSize=10,
            leading=14,
            leftIndent=12,
            spaceAfter=6
        ))

    def generate_pdf(
        self,
        report_data: Dict[str, Any],
        output_path: str,
        report_type: str = "full"
    ) -> bool:
        """
        Generate PDF from report JSON data.

        Args:
            report_data: Report output from report_writer agent
            output_path: Path where PDF should be saved
            report_type: "full" or "executive"

        Returns:
            True if successful, False otherwise
        """
        try:
            # Get metadata
            metadata = report_data.get("report_metadata", {})
            project_name = metadata.get("project_name", "Real Estate Analysis")

            # Get appropriate report sections
            if report_type == "executive":
                report_content = report_data.get("executive_report", {})
                report_title = f"{project_name} - Koncentrerad Rapport"
            else:
                report_content = report_data.get("full_report", {})
                report_title = f"{project_name} - Fullständig Marknadsanalys"

            # Create PDF
            doc = SimpleDocTemplate(
                output_path,
                pagesize=A4,
                rightMargin=2*cm,
                leftMargin=2*cm,
                topMargin=2.5*cm,
                bottomMargin=2.5*cm,
                title=report_title
            )

            # Build content
            story = self._build_content(
                report_title=report_title,
                metadata=metadata,
                report_content=report_content,
                report_type=report_type
            )

            # Generate PDF
            doc.build(story)

            return True

        except Exception as e:
            print(f"Error generating PDF: {str(e)}")
            import traceback
            traceback.print_exc()
            return False

    def _build_content(
        self,
        report_title: str,
        metadata: Dict[str, Any],
        report_content: Dict[str, Any],
        report_type: str
    ) -> List:
        """Build PDF content from report data."""
        story = []

        # Title
        story.append(Paragraph(report_title, self.styles['CustomTitle']))
        story.append(Spacer(1, 0.5*cm))

        # Metadata box
        metadata_data = [
            ['<b>Projekt:</b>', metadata.get('project_name', 'N/A')],
            ['<b>Plats:</b>', metadata.get('location', 'N/A')],
            ['<b>Analysdatum:</b>', metadata.get('analysis_date', 'N/A')],
            ['<b>Version:</b>', metadata.get('report_version', '1.0')],
            ['<b>Författare:</b>', metadata.get('authors', 'Svensk Nyproduktion & Prognoscentret')]
        ]

        metadata_table = Table(metadata_data, colWidths=[4*cm, 12*cm])
        metadata_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#ecf0f1')),
            ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('LEFTPADDING', (0, 0), (-1, -1), 12),
            ('RIGHTPADDING', (0, 0), (-1, -1), 12),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#bdc3c7'))
        ]))

        story.append(metadata_table)
        story.append(Spacer(1, 1*cm))

        # Add sections
        sections = report_content.get("sections", [])
        for i, section in enumerate(sections):
            # Page break before each major section (except first)
            if i > 0:
                story.append(PageBreak())

            # Section title
            section_title = section.get("section_title", f"Section {i+1}")
            story.append(Paragraph(section_title, self.styles['SectionHeading']))
            story.append(Spacer(1, 0.3*cm))

            # Section content
            content = section.get("content", "")
            if content:
                # Process markdown-like content
                paragraphs = self._process_content(content)
                for para in paragraphs:
                    story.append(para)

            # Add tables
            tables = section.get("tables", [])
            for table_data in tables:
                table_elements = self._render_table(table_data)
                story.extend(table_elements)

            # Add visualization placeholders
            visualizations = section.get("visualizations", [])
            for viz in visualizations:
                viz_elements = self._render_visualization_placeholder(viz)
                story.extend(viz_elements)

        return story

    def _process_content(self, content: str) -> List:
        """Process markdown-like content into ReportLab elements."""
        elements = []

        # Split by newlines and process
        lines = content.split('\n')
        current_paragraph = []

        for line in lines:
            line = line.strip()

            if not line:
                # Empty line - flush current paragraph
                if current_paragraph:
                    text = ' '.join(current_paragraph)
                    elements.append(Paragraph(text, self.styles['CustomBody']))
                    elements.append(Spacer(1, 0.2*cm))
                    current_paragraph = []
                continue

            # Check for headings
            if line.startswith('# '):
                if current_paragraph:
                    text = ' '.join(current_paragraph)
                    elements.append(Paragraph(text, self.styles['CustomBody']))
                    current_paragraph = []
                # Already handled as section title, skip
                continue
            elif line.startswith('## '):
                if current_paragraph:
                    text = ' '.join(current_paragraph)
                    elements.append(Paragraph(text, self.styles['CustomBody']))
                    current_paragraph = []
                heading = line[3:].strip()
                elements.append(Paragraph(heading, self.styles['SubsectionHeading']))
                continue
            elif line.startswith('### '):
                if current_paragraph:
                    text = ' '.join(current_paragraph)
                    elements.append(Paragraph(text, self.styles['CustomBody']))
                    current_paragraph = []
                heading = line[4:].strip()
                elements.append(Paragraph(f"<b>{heading}</b>", self.styles['CustomBody']))
                elements.append(Spacer(1, 0.1*cm))
                continue

            # Check for list items
            if line.startswith('- ') or line.startswith('* '):
                if current_paragraph:
                    text = ' '.join(current_paragraph)
                    elements.append(Paragraph(text, self.styles['CustomBody']))
                    current_paragraph = []
                list_item = line[2:].strip()
                elements.append(Paragraph(f"• {list_item}", self.styles['CustomBody']))
                continue

            # Regular text - add to current paragraph
            current_paragraph.append(line)

        # Flush remaining paragraph
        if current_paragraph:
            text = ' '.join(current_paragraph)
            elements.append(Paragraph(text, self.styles['CustomBody']))

        return elements

    def _render_table(self, table_data: Dict[str, Any]) -> List:
        """Render table from structured data."""
        elements = []

        table_title = table_data.get("title", "")
        headers = table_data.get("headers", [])
        rows = table_data.get("rows", [])

        if table_title:
            elements.append(Spacer(1, 0.3*cm))
            elements.append(Paragraph(f"<b>{table_title}</b>", self.styles['SubsectionHeading']))

        if headers and rows:
            # Build table data
            data = [headers] + rows

            # Calculate column widths
            num_cols = len(headers)
            col_width = (self.page_width - 4*cm) / num_cols

            table = Table(data, colWidths=[col_width] * num_cols)
            table.setStyle(TableStyle([
                # Header
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#3498db')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('ALIGN', (0, 0), (-1, 0), 'LEFT'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 10),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
                ('TOPPADDING', (0, 0), (-1, 0), 10),

                # Data rows
                ('ALIGN', (0, 1), (-1, -1), 'LEFT'),
                ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
                ('FONTSIZE', (0, 1), (-1, -1), 9),
                ('TOPPADDING', (0, 1), (-1, -1), 8),
                ('BOTTOMPADDING', (0, 1), (-1, -1), 8),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),

                # Alternating row colors
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f9f9f9')])
            ]))

            keep_together = KeepTogether([table])
            elements.append(keep_together)
            elements.append(Spacer(1, 0.5*cm))

        return elements

    def _render_visualization_placeholder(self, viz_data: Dict[str, Any]) -> List:
        """Render placeholder for visualization."""
        elements = []

        viz_title = viz_data.get("title", "Visualization")
        viz_type = viz_data.get("type", "chart")

        # Create placeholder box
        placeholder_data = [[
            f"<b>{viz_title}</b><br/><br/>"
            f"<i>({viz_type.replace('_', ' ').title()})</i><br/>"
            f"Visualiseringsdata finns i JSON-output"
        ]]

        placeholder_table = Table(placeholder_data, colWidths=[self.page_width - 4*cm])
        placeholder_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f5f5f5')),
            ('TEXTCOLOR', (0, 0), (-1, -1), colors.HexColor('#666666')),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('TOPPADDING', (0, 0), (-1, -1), 24),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 24),
            ('GRID', (0, 0), (-1, -1), 2, colors.HexColor('#cccccc')),
            ('LINESTYLE', (0, 0), (-1, -1), 'DASHED')
        ]))

        elements.append(Spacer(1, 0.3*cm))
        elements.append(placeholder_table)
        elements.append(Spacer(1, 0.3*cm))

        return elements


def generate_reports_from_state(state: Dict[str, Any], output_dir: str) -> Dict[str, str]:
    """
    Generate PDF reports from workflow state.

    Args:
        state: Final workflow state with report_output
        output_dir: Directory to save PDFs

    Returns:
        Dictionary with paths to generated PDFs
    """
    os.makedirs(output_dir, exist_ok=True)

    report_output = state.get("report_output", {})
    if not report_output or report_output.get("status") != "completed":
        print("⚠ Cannot generate PDFs: Report not completed")
        return {}

    output_data = report_output.get("output", {})
    if not output_data:
        print("⚠ Cannot generate PDFs: No output data")
        return {}

    generator = PDFReportGenerator()

    # Generate timestamp for filenames
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    project_name = output_data.get("report_metadata", {}).get("project_name", "project")
    safe_name = "".join(c if c.isalnum() else "_" for c in project_name)

    generated_pdfs = {}

    # Generate full report PDF
    if "full_report" in output_data:
        full_pdf_path = os.path.join(
            output_dir,
            f"{safe_name}_full_report_{timestamp}.pdf"
        )
        print(f"📄 Generating full report PDF...")
        if generator.generate_pdf(output_data, full_pdf_path, report_type="full"):
            generated_pdfs["full_report"] = full_pdf_path
            print(f"   ✓ Full report saved: {full_pdf_path}")
        else:
            print(f"   ✗ Failed to generate full report PDF")

    # Generate executive report PDF
    if "executive_report" in output_data:
        exec_pdf_path = os.path.join(
            output_dir,
            f"{safe_name}_executive_report_{timestamp}.pdf"
        )
        print(f"📋 Generating executive report PDF...")
        if generator.generate_pdf(output_data, exec_pdf_path, report_type="executive"):
            generated_pdfs["executive_report"] = exec_pdf_path
            print(f"   ✓ Executive report saved: {exec_pdf_path}")
        else:
            print(f"   ✗ Failed to generate executive report PDF")

    return generated_pdfs
