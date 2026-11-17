#!/usr/bin/env python3
"""
Generate PDF report from Quick Analysis results.
"""
import json
import sys
import os
from pathlib import Path
from datetime import datetime
from fpdf import FPDF, XPos, YPos


class QuickAnalysisPDF(FPDF):
    """Custom PDF class for Quick Analysis reports."""

    def __init__(self):
        super().__init__()
        # Use built-in font that supports Swedish characters
        self.add_font('DejaVu', '', '/System/Library/Fonts/Supplemental/Arial Unicode.ttf')
        self.add_font('DejaVu', 'B', '/System/Library/Fonts/Supplemental/Arial Unicode.ttf')
        # Set margins
        self.set_left_margin(20)
        self.set_right_margin(20)
        self.set_auto_page_break(auto=True, margin=25)

    def header(self):
        self.set_font('DejaVu', 'B', 10)
        self.set_text_color(100)
        self.cell(0, 8, 'Quick Analysis Report', new_x=XPos.LMARGIN, new_y=YPos.NEXT, align='C')
        self.ln(3)

    def footer(self):
        self.set_y(-15)
        self.set_font('DejaVu', '', 8)
        self.set_text_color(128)
        self.cell(0, 10, f'Sida {self.page_no()}', new_x=XPos.LMARGIN, new_y=YPos.NEXT, align='C')

    def get_effective_width(self):
        """Get the effective page width for content."""
        return self.w - self.l_margin - self.r_margin

    def chapter_title(self, title):
        self.set_x(self.l_margin)  # Reset to left margin
        self.set_font('DejaVu', 'B', 12)
        self.set_fill_color(230, 230, 230)
        self.set_text_color(0)
        self.cell(self.get_effective_width(), 8, title, new_x=XPos.LMARGIN, new_y=YPos.NEXT, align='L', fill=True)
        self.ln(4)

    def section_title(self, title):
        self.set_x(self.l_margin)  # Reset to left margin
        self.set_font('DejaVu', 'B', 10)
        self.set_text_color(50)
        self.cell(self.get_effective_width(), 6, title, new_x=XPos.LMARGIN, new_y=YPos.NEXT, align='L')
        self.set_text_color(0)
        self.ln(1)

    def body_text(self, text):
        self.set_x(self.l_margin)  # Reset to left margin
        self.set_font('DejaVu', '', 9)
        self.multi_cell(self.get_effective_width(), 5, text)
        self.ln(1)

    def key_value_line(self, key, value):
        """Simple key-value on same line using multi_cell."""
        self.set_x(self.l_margin)  # Reset to left margin
        self.set_font('DejaVu', '', 9)
        text = f"{key}: {value}"
        self.multi_cell(self.get_effective_width(), 5, text)

    def recommendation_box(self, recommendation, confidence, rationale):
        # Background color based on recommendation
        if recommendation == "GO":
            self.set_fill_color(200, 240, 200)  # Green
        elif recommendation == "NO-GO":
            self.set_fill_color(255, 200, 200)  # Red
        else:
            self.set_fill_color(255, 240, 200)  # Yellow

        w = self.get_effective_width()

        self.set_font('DejaVu', 'B', 14)
        self.set_text_color(0)
        self.cell(w, 12, f'REKOMMENDATION: {recommendation}', new_x=XPos.LMARGIN, new_y=YPos.NEXT, align='C', fill=True, border=1)

        self.set_font('DejaVu', '', 9)
        self.cell(w, 6, f'Konfidensgrad: {confidence.upper()}', new_x=XPos.LMARGIN, new_y=YPos.NEXT, align='C')
        self.ln(3)

        self.set_x(self.l_margin)  # Reset to left margin
        self.set_font('DejaVu', '', 9)
        self.multi_cell(w, 5, f'Motivering: {rationale}')
        self.ln(4)

    def add_map_image(self, map_path):
        """Add map image to PDF."""
        if not map_path or not os.path.exists(map_path):
            return False

        self.add_page()
        self.chapter_title('OMRÅDESKARTA')

        # Calculate image width (height will be automatic to preserve aspect ratio)
        page_width = self.get_effective_width()

        try:
            # Place image - only set width, height is automatic to preserve aspect ratio
            y_before = self.get_y()
            self.image(map_path, x=self.l_margin, w=page_width)
            # Move cursor below image (fpdf2 should handle this, but add small margin)
            self.ln(3)

            # Add legend directly under map
            self.section_title('Teckenförklaring')
            self.set_x(self.l_margin)  # Reset to left margin
            self.set_font('DejaVu', '', 8)
            legend_text = "P (röd) = Fastigheten | B (blå) = Busshållplatser | S (grön) = Skolor | M (orange) = Mataffärer | R (röd) = Restauranger | G (lila) = Gym"
            self.multi_cell(self.get_effective_width(), 4, legend_text)

            return True
        except Exception as e:
            print(f"Warning: Could not add map image: {e}")
            return False


def generate_pdf(json_path: str, output_path: str = None):
    """Generate PDF report from Quick Analysis JSON."""

    # Load JSON data
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # Extract data
    project_params = data.get('project_params', {})
    quick_market = data.get('quick_market_output', {})
    quick_location = data.get('quick_location_output', {})
    quick_synthesis = data.get('quick_synthesis_output', {})
    warnings = data.get('warnings', [])
    map_path = data.get('map_path')

    # Create PDF
    pdf = QuickAnalysisPDF()
    pdf.add_page()

    # Title
    pdf.set_font('DejaVu', 'B', 18)
    pdf.cell(0, 12, 'QUICK ANALYSIS', new_x=XPos.LMARGIN, new_y=YPos.NEXT, align='C')

    pdf.set_font('DejaVu', 'B', 14)
    pdf.cell(0, 10, project_params.get('project_name', 'Okänt projekt'), new_x=XPos.LMARGIN, new_y=YPos.NEXT, align='C')

    pdf.set_font('DejaVu', '', 9)
    pdf.cell(0, 6, f'Analyserat: {project_params.get("analysis_date", datetime.now().strftime("%Y-%m-%d"))}', new_x=XPos.LMARGIN, new_y=YPos.NEXT, align='C')
    pdf.ln(8)

    # GO/NO-GO Decision box
    if quick_synthesis and 'output' in quick_synthesis:
        synthesis_output = quick_synthesis['output']
        decision = synthesis_output.get('go_no_go_decision', {})
        pdf.recommendation_box(
            decision.get('recommendation', 'UNKNOWN'),
            decision.get('confidence', 'unknown'),
            decision.get('rationale', 'Ingen motivering tillgänglig')
        )

    # Market Analysis
    pdf.chapter_title('MARKNADSANALYS')
    if quick_market and 'output' in quick_market:
        market_output = quick_market['output']

        # Target demographic
        target = market_output.get('target_demographic', {})
        if target:
            pdf.section_title('Målgrupp')
            pdf.key_value_line('Primär målgrupp', target.get('primary_segment', 'N/A'))
            pdf.key_value_line('Match Score', f"{target.get('match_score', 0):.2f}")
            if target.get('description'):
                pdf.ln(1)
                pdf.body_text(target.get('description', ''))

            chars = target.get('characteristics', [])
            if chars:
                pdf.ln(2)
                pdf.section_title('Karaktaristik')
                for char in chars[:4]:
                    pdf.body_text(f'  - {char}')

        # Pricing
        pricing = market_output.get('pricing_analysis', {})
        if pricing:
            pdf.ln(2)
            pdf.section_title('Prisanalys')
            current = pricing.get('current_price_level', {})
            if current.get('average_sqm_price'):
                pdf.key_value_line('Genomsnitt kr/kvm', f"{current.get('average_sqm_price', 0):,}")
            if current.get('median_sqm_price'):
                pdf.key_value_line('Median kr/kvm', f"{current.get('median_sqm_price', 0):,}")
            if current.get('trend'):
                pdf.key_value_line('Trend', current.get('trend', 'N/A').upper())

            recommended = pricing.get('recommended_price_range', {})
            if recommended and recommended.get('low'):
                pdf.key_value_line('Rekommenderat intervall',
                    f"{recommended.get('low', 0):,} - {recommended.get('high', 0):,} kr/kvm")
    pdf.ln(4)

    # Location Analysis
    pdf.chapter_title('LÄGESANALYS')
    if quick_location and 'output' in quick_location:
        location_output = quick_location['output']

        # Location assessment
        loc = location_output.get('location_assessment', {})
        if loc:
            pdf.key_value_line('Betyg', loc.get('overall_rating', 'N/A').upper())
            if loc.get('description'):
                pdf.ln(1)
                pdf.body_text(loc.get('description', ''))

        # Competition
        comp = location_output.get('competition_analysis', {})
        if comp and comp.get('data_available'):
            details = comp.get('if_available', {})
            pdf.ln(2)
            pdf.section_title('Konkurrensanalys')
            if details.get('total_competing_units'):
                pdf.key_value_line('Konkurrerande lägenheter', f"{details.get('total_competing_units', 0)} st")
            if details.get('market_saturation'):
                pdf.key_value_line('Marknadsmättnad', details.get('market_saturation', 'N/A').upper())
            if details.get('average_sales_rate'):
                pdf.key_value_line('Genomsnittlig försäljningsgrad', f"{details.get('average_sales_rate', 0):.1f}%")
    pdf.ln(4)

    # Synthesis & Recommendations
    pdf.chapter_title('REKOMMENDATIONER')
    if quick_synthesis and 'output' in quick_synthesis:
        synthesis_output = quick_synthesis['output']

        # Pricing guidance
        pricing_guidance = synthesis_output.get('pricing_guidance', {})
        if pricing_guidance:
            pdf.section_title('Prisrekommendation')
            price_range = pricing_guidance.get('recommended_range_per_sqm', {})
            if price_range and price_range.get('low'):
                pdf.key_value_line('Intervall', f"{price_range.get('low', 0):,} - {price_range.get('high', 0):,} kr/kvm")
            if pricing_guidance.get('positioning'):
                pdf.key_value_line('Positionering', pricing_guidance.get('positioning', 'N/A'))
            if pricing_guidance.get('rationale'):
                pdf.ln(1)
                pdf.body_text(pricing_guidance.get('rationale', ''))

        # Product mix
        product_mix = synthesis_output.get('product_mix_guidance', {})
        if product_mix:
            pdf.ln(2)
            pdf.section_title('Produktmix')
            if product_mix.get('recommended_focus'):
                pdf.body_text(f"Fokus: {product_mix.get('recommended_focus', 'N/A')}")
            dist = product_mix.get('suggested_distribution', {})
            if dist:
                dist_text = f"Fördelning: 1 rok: {dist.get('1rok', 'N/A')} | 2 rok: {dist.get('2rok', 'N/A')} | 3 rok: {dist.get('3rok', 'N/A')} | 4+ rok: {dist.get('4rok+', 'N/A')}"
                pdf.body_text(dist_text)

        # Next steps
        next_steps = synthesis_output.get('next_steps', [])
        if next_steps:
            pdf.ln(2)
            pdf.section_title('Nästa steg')
            for i, step in enumerate(next_steps[:5], 1):
                priority = step.get('priority', 'medium').upper()
                action = step.get('action', 'N/A')
                pdf.body_text(f'{i}. [{priority}] {action}')

        # Executive summary
        summary = synthesis_output.get('executive_summary', '')
        if summary:
            pdf.ln(3)
            pdf.section_title('Sammanfattning')
            pdf.body_text(summary)

    # Add map if available
    if map_path:
        pdf.add_map_image(map_path)

    # Warnings
    if warnings:
        pdf.add_page()
        pdf.chapter_title('VARNINGAR')
        for warning in warnings:
            pdf.body_text(f'- {warning}')

    # Output path
    if output_path is None:
        output_path = json_path.replace('.json', '.pdf')

    pdf.output(output_path)
    return output_path


if __name__ == "__main__":
    # Find most recent analysis file
    output_dir = Path(__file__).parent / "data/quick_output"
    json_files = sorted(output_dir.glob("quick_analysis_*.json"), reverse=True)

    if not json_files:
        print("Ingen analysresultatfil hittades")
        sys.exit(1)

    json_path = json_files[0]
    print(f"Genererar PDF fran: {json_path.name}")

    output_path = generate_pdf(str(json_path))
    print(f"PDF sparad till: {output_path}")
