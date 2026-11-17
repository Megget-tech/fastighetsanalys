#!/usr/bin/env python3
"""
Generate PDF report from Full Analysis results.
Supports both full report (12 sections) and executive report (5 sections).
"""
import json
import sys
import os
from pathlib import Path
from datetime import datetime
from fpdf import FPDF, XPos, YPos

sys.path.insert(0, str(Path(__file__).parent))
from utils.fonts import add_unicode_fonts


class FullAnalysisPDF(FPDF):
    """Custom PDF class for Full Analysis reports."""

    def __init__(self, report_type="full"):
        super().__init__()
        self.report_type = report_type
        # Use built-in font that supports Swedish characters
        # Typsnitt med svenska tecken: DejaVu i Docker/Linux, Arial Unicode på macOS
        add_unicode_fonts(self, 'DejaVu')
        # Set margins
        self.set_left_margin(20)
        self.set_right_margin(20)
        self.set_auto_page_break(auto=True, margin=25)

    def header(self):
        self.set_font('DejaVu', 'B', 10)
        self.set_text_color(100)
        title = 'Full Analysis Report' if self.report_type == 'full' else 'Executive Report'
        self.cell(0, 8, title, new_x=XPos.LMARGIN, new_y=YPos.NEXT, align='C')
        self.ln(3)

    def footer(self):
        self.set_y(-15)
        self.set_font('DejaVu', '', 8)
        self.set_text_color(128)
        self.cell(0, 10, f'Sida {self.page_no()}', new_x=XPos.LMARGIN, new_y=YPos.NEXT, align='C')

    def get_effective_width(self):
        """Get the effective page width for content."""
        return self.w - self.l_margin - self.r_margin

    def chapter_title(self, title, number=None):
        self.add_page()
        self.set_x(self.l_margin)
        self.set_font('DejaVu', 'B', 14)
        self.set_fill_color(41, 128, 185)  # Blue
        self.set_text_color(255)
        display_title = f"{number}. {title}" if number else title
        self.cell(self.get_effective_width(), 10, display_title, new_x=XPos.LMARGIN, new_y=YPos.NEXT, align='L', fill=True)
        self.set_text_color(0)
        self.ln(6)

    def section_title(self, title):
        self.set_x(self.l_margin)
        self.set_font('DejaVu', 'B', 11)
        self.set_text_color(41, 128, 185)
        self.cell(self.get_effective_width(), 7, title, new_x=XPos.LMARGIN, new_y=YPos.NEXT, align='L')
        self.set_text_color(0)
        self.ln(2)

    def subsection_title(self, title):
        self.set_x(self.l_margin)
        self.set_font('DejaVu', 'B', 10)
        self.set_text_color(80)
        self.cell(self.get_effective_width(), 6, title, new_x=XPos.LMARGIN, new_y=YPos.NEXT, align='L')
        self.set_text_color(0)
        self.ln(1)

    def body_text(self, text):
        self.set_x(self.l_margin)
        self.set_font('DejaVu', '', 9)
        self.multi_cell(self.get_effective_width(), 5, text)
        self.ln(2)

    def bullet_point(self, text):
        self.set_x(self.l_margin + 5)
        self.set_font('DejaVu', '', 9)
        self.multi_cell(self.get_effective_width() - 5, 5, f"- {text}")

    def key_value_line(self, key, value):
        self.set_x(self.l_margin)
        self.set_font('DejaVu', '', 9)
        text = f"{key}: {value}"
        self.multi_cell(self.get_effective_width(), 5, text)

    def recommendation_box(self, title, content, color=(200, 240, 200)):
        self.set_x(self.l_margin)
        self.set_fill_color(*color)
        self.set_font('DejaVu', 'B', 10)
        self.cell(self.get_effective_width(), 7, title, new_x=XPos.LMARGIN, new_y=YPos.NEXT, align='L', fill=True, border=1)
        self.set_x(self.l_margin)
        self.set_font('DejaVu', '', 9)
        self.multi_cell(self.get_effective_width(), 5, content, border=1)
        self.ln(3)

    def add_table(self, headers, rows, col_widths=None):
        """Add a simple table."""
        w = self.get_effective_width()
        if col_widths is None:
            col_widths = [w / len(headers)] * len(headers)

        # Header row
        self.set_x(self.l_margin)
        self.set_font('DejaVu', 'B', 9)
        self.set_fill_color(230, 230, 230)
        for i, header in enumerate(headers):
            self.cell(col_widths[i], 7, str(header), border=1, fill=True)
        self.ln()

        # Data rows
        self.set_font('DejaVu', '', 9)
        for row in rows:
            self.set_x(self.l_margin)
            for i, cell in enumerate(row):
                self.cell(col_widths[i], 6, str(cell), border=1)
            self.ln()
        self.ln(3)

    def add_map_image(self, map_path):
        """Add map image to PDF."""
        if not map_path or not os.path.exists(map_path):
            return False

        self.add_page()
        self.chapter_title('OMRÅDESKARTA')

        page_width = self.get_effective_width()

        try:
            self.image(map_path, x=self.l_margin, w=page_width)
            self.ln(3)

            self.section_title('Teckenförklaring')
            self.set_x(self.l_margin)
            self.set_font('DejaVu', '', 8)
            legend_text = "P (röd) = Fastigheten | B (blå) = Busshållplatser | S (grön) = Skolor | M (orange) = Mataffärer | R (röd) = Restauranger | G (lila) = Gym"
            self.multi_cell(self.get_effective_width(), 4, legend_text)

            return True
        except Exception as e:
            print(f"Warning: Could not add map image: {e}")
            return False


def generate_full_pdf(json_path: str, output_path: str = None, report_type: str = "full"):
    """
    Generate PDF report from Full Analysis JSON.

    Args:
        json_path: Path to the JSON result file
        output_path: Output PDF path (default: same as json with .pdf)
        report_type: "full" for 12-section report, "executive" for 5-section report
    """

    # Load JSON data
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # Extract data
    project_params = data.get('project_params', {})
    report_output = data.get('report_output', {}).get('output', {})
    warnings = data.get('warnings', [])
    errors = data.get('errors', [])
    map_path = data.get('map_path')
    qa_decision = data.get('qa_decision')
    qa_quality_score = data.get('qa_quality_score')

    # Select report sections based on type
    if report_type == "executive":
        report_data = report_output.get('executive_report', {})
    else:
        report_data = report_output.get('full_report', {})

    sections = report_data.get('sections', [])

    # Create PDF
    pdf = FullAnalysisPDF(report_type=report_type)
    pdf.add_page()

    # Title page
    pdf.set_font('DejaVu', 'B', 24)
    pdf.ln(30)
    if report_type == "executive":
        pdf.cell(0, 15, 'EXECUTIVE REPORT', new_x=XPos.LMARGIN, new_y=YPos.NEXT, align='C')
    else:
        pdf.cell(0, 15, 'MARKNADSANALYS', new_x=XPos.LMARGIN, new_y=YPos.NEXT, align='C')

    pdf.set_font('DejaVu', 'B', 18)
    pdf.cell(0, 12, project_params.get('project_name', 'Okänt projekt'), new_x=XPos.LMARGIN, new_y=YPos.NEXT, align='C')

    pdf.set_font('DejaVu', '', 11)
    pdf.ln(5)
    pdf.cell(0, 8, project_params.get('location', ''), new_x=XPos.LMARGIN, new_y=YPos.NEXT, align='C')
    pdf.cell(0, 8, f'Analyserat: {project_params.get("analysis_date", datetime.now().strftime("%Y-%m-%d"))}', new_x=XPos.LMARGIN, new_y=YPos.NEXT, align='C')

    # QA Status
    if qa_decision:
        pdf.ln(10)
        pdf.set_font('DejaVu', 'B', 12)
        if qa_decision == "APPROVED":
            pdf.set_text_color(0, 128, 0)
            status_text = "GODKÄND"
        elif qa_decision == "APPROVED_WITH_WARNINGS":
            pdf.set_text_color(200, 150, 0)
            status_text = "GODKÄND MED VARNINGAR"
        else:
            pdf.set_text_color(200, 0, 0)
            status_text = "AVVISAD"
        pdf.cell(0, 8, f'Kvalitetskontroll: {status_text}', new_x=XPos.LMARGIN, new_y=YPos.NEXT, align='C')
        if qa_quality_score:
            pdf.set_text_color(0)
            pdf.set_font('DejaVu', '', 10)
            pdf.cell(0, 6, f'Kvalitetspoäng: {qa_quality_score:.2f}', new_x=XPos.LMARGIN, new_y=YPos.NEXT, align='C')
        pdf.set_text_color(0)

    # Report metadata
    report_meta = report_output.get('report_metadata', {})
    if report_meta:
        pdf.ln(15)
        pdf.set_font('DejaVu', '', 9)
        pdf.set_text_color(100)
        if report_meta.get('authors'):
            pdf.cell(0, 5, f'Framtagen av: {report_meta.get("authors")}', new_x=XPos.LMARGIN, new_y=YPos.NEXT, align='C')
        pdf.set_text_color(0)

    # Key recommendations on title page
    key_recs = report_output.get('key_recommendations', [])
    if key_recs:
        pdf.ln(10)
        pdf.set_font('DejaVu', 'B', 11)
        pdf.cell(0, 8, 'Huvudrekommendationer:', new_x=XPos.LMARGIN, new_y=YPos.NEXT, align='C')
        pdf.set_font('DejaVu', '', 9)
        for i, rec in enumerate(key_recs[:5], 1):
            pdf.set_x(pdf.l_margin + 20)
            pdf.multi_cell(pdf.get_effective_width() - 40, 5, f"{i}. {rec}", align='L')

    # Table of contents
    if sections:
        pdf.add_page()
        pdf.set_font('DejaVu', 'B', 14)
        pdf.cell(0, 10, 'INNEHÅLLSFÖRTECKNING', new_x=XPos.LMARGIN, new_y=YPos.NEXT, align='C')
        pdf.ln(8)

        pdf.set_font('DejaVu', '', 10)
        for i, section in enumerate(sections, 1):
            title = section.get('title', f'Sektion {i}')
            pdf.set_x(pdf.l_margin)
            pdf.cell(0, 6, f'{i}. {title}', new_x=XPos.LMARGIN, new_y=YPos.NEXT, align='L')

    # Render sections
    for i, section in enumerate(sections, 1):
        title = section.get('title', f'Sektion {i}')
        content = section.get('content', '')

        pdf.chapter_title(title, number=i)

        # Handle different content formats
        if isinstance(content, str):
            # Simple text content
            paragraphs = content.split('\n\n')
            for para in paragraphs:
                if para.strip():
                    pdf.body_text(para.strip())

        elif isinstance(content, dict):
            # Structured content
            for key, value in content.items():
                if isinstance(value, str):
                    pdf.section_title(key)
                    pdf.body_text(value)
                elif isinstance(value, list):
                    pdf.section_title(key)
                    for item in value:
                        if isinstance(item, str):
                            pdf.bullet_point(item)
                        elif isinstance(item, dict):
                            for k, v in item.items():
                                pdf.key_value_line(k, str(v))
                elif isinstance(value, dict):
                    pdf.section_title(key)
                    for k, v in value.items():
                        pdf.key_value_line(k, str(v))

        elif isinstance(content, list):
            # List content
            for item in content:
                if isinstance(item, str):
                    pdf.bullet_point(item)
                elif isinstance(item, dict):
                    for key, value in item.items():
                        pdf.key_value_line(key, str(value))

        # Handle subsections if present
        subsections = section.get('subsections', [])
        for subsection in subsections:
            sub_title = subsection.get('title', '')
            sub_content = subsection.get('content', '')

            if sub_title:
                pdf.section_title(sub_title)
            if sub_content:
                if isinstance(sub_content, str):
                    pdf.body_text(sub_content)
                elif isinstance(sub_content, list):
                    for item in sub_content:
                        pdf.bullet_point(str(item))

        # Handle tables if present
        tables = section.get('tables', [])
        for table in tables:
            table_title = table.get('title', '')
            headers = table.get('headers', [])
            rows = table.get('rows', [])

            if table_title:
                pdf.subsection_title(table_title)
            if headers and rows:
                pdf.add_table(headers, rows)

        # Handle recommendations if present
        recommendations = section.get('recommendations', [])
        if recommendations:
            pdf.section_title('Rekommendationer')
            for rec in recommendations:
                if isinstance(rec, str):
                    pdf.bullet_point(rec)
                elif isinstance(rec, dict):
                    priority = rec.get('priority', 'medium')
                    action = rec.get('action', rec.get('recommendation', ''))
                    pdf.bullet_point(f"[{priority.upper()}] {action}")

    # Add map if available
    if map_path:
        pdf.add_map_image(map_path)

    # Warnings and errors
    if warnings or errors:
        pdf.add_page()
        pdf.set_font('DejaVu', 'B', 14)
        pdf.cell(0, 10, 'VARNINGAR OCH FEL', new_x=XPos.LMARGIN, new_y=YPos.NEXT, align='C')
        pdf.ln(5)

        if errors:
            pdf.section_title('Fel')
            for error in errors:
                pdf.bullet_point(error)
            pdf.ln(3)

        if warnings:
            pdf.section_title('Varningar')
            for warning in warnings:
                pdf.bullet_point(warning)

    # Appendix: Execution summary
    execution_times = data.get('agent_execution_times', {})
    if execution_times:
        pdf.add_page()
        pdf.set_font('DejaVu', 'B', 14)
        pdf.cell(0, 10, 'BILAGA: ANALYSÖVERSIKT', new_x=XPos.LMARGIN, new_y=YPos.NEXT, align='C')
        pdf.ln(5)

        pdf.section_title('Exekveringstider per agent')
        headers = ['Agent', 'Tid (sekunder)']
        rows = [[agent, f"{time:.1f}"] for agent, time in execution_times.items()]
        total_time = sum(execution_times.values())
        rows.append(['TOTALT', f"{total_time:.1f}"])

        col_widths = [pdf.get_effective_width() * 0.6, pdf.get_effective_width() * 0.4]
        pdf.add_table(headers, rows, col_widths)

    # Output path
    if output_path is None:
        suffix = '_executive' if report_type == 'executive' else '_full'
        output_path = json_path.replace('.json', f'{suffix}.pdf')

    pdf.output(output_path)
    return output_path


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description='Generate PDF from Full Analysis results')
    parser.add_argument('json_file', help='JSON result file')
    parser.add_argument('--output', '-o', help='Output PDF path')
    parser.add_argument('--type', '-t', choices=['full', 'executive'], default='full',
                        help='Report type: full (12 sections) or executive (5 sections)')

    args = parser.parse_args()

    if not Path(args.json_file).exists():
        print(f"Error: File not found: {args.json_file}")
        sys.exit(1)

    output_path = generate_full_pdf(args.json_file, args.output, args.type)
    print(f"PDF saved to: {output_path}")
