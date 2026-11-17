"""
Quick Analysis PDF Generator
Generates visually appealing 1-2 page PDF reports for quick analysis.
Focus on key metrics, clear decision, and visual presentation.
"""
import os
from typing import Dict, Any, List
from datetime import datetime

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm, mm
from reportlab.lib.enums import TA_JUSTIFY, TA_LEFT, TA_CENTER, TA_RIGHT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak,
    Table, TableStyle, KeepTogether, Frame, PageTemplate, Image
)
from reportlab.pdfgen import canvas

from .map_generator import MapGenerator


class QuickPDFGenerator:
    """Generates visually appealing quick analysis PDF reports."""

    def __init__(self):
        """Initialize PDF generator with custom styling."""
        # Color scheme - must be defined before _setup_custom_styles()
        self.color_go = colors.HexColor('#27ae60')  # Green
        self.color_no_go = colors.HexColor('#e74c3c')  # Red
        self.color_maybe = colors.HexColor('#f39c12')  # Orange
        self.color_primary = colors.HexColor('#2c3e50')  # Dark blue
        self.color_secondary = colors.HexColor('#3498db')  # Light blue
        self.color_light = colors.HexColor('#ecf0f1')  # Light gray
        self.color_text = colors.HexColor('#34495e')  # Dark gray

        self.styles = getSampleStyleSheet()
        self._setup_custom_styles()
        self.page_width, self.page_height = A4

    def _setup_custom_styles(self):
        """Set up custom paragraph styles."""
        # Main title
        self.styles.add(ParagraphStyle(
            name='QuickTitle',
            parent=self.styles['Heading1'],
            fontSize=28,
            textColor=colors.HexColor('#1a1a1a'),
            spaceAfter=10,
            alignment=TA_CENTER,
            fontName='Helvetica-Bold'
        ))

        # Subtitle
        self.styles.add(ParagraphStyle(
            name='QuickSubtitle',
            parent=self.styles['Normal'],
            fontSize=14,
            textColor=colors.HexColor('#7f8c8d'),
            spaceAfter=20,
            alignment=TA_CENTER,
            fontName='Helvetica'
        ))

        # Decision box large text
        self.styles.add(ParagraphStyle(
            name='DecisionLarge',
            parent=self.styles['Heading1'],
            fontSize=36,
            fontName='Helvetica-Bold',
            alignment=TA_CENTER,
            spaceAfter=10
        ))

        # Decision rationale
        self.styles.add(ParagraphStyle(
            name='DecisionRationale',
            parent=self.styles['Normal'],
            fontSize=11,
            leading=16,
            alignment=TA_CENTER,
            spaceAfter=15
        ))

        # Section header
        self.styles.add(ParagraphStyle(
            name='QuickSection',
            parent=self.styles['Heading2'],
            fontSize=16,
            textColor=self.color_primary,
            spaceAfter=12,
            spaceBefore=18,
            fontName='Helvetica-Bold',
            borderWidth=1,
            borderColor=self.color_secondary,
            borderPadding=8,
            backColor=self.color_light
        ))

        # Metric label
        self.styles.add(ParagraphStyle(
            name='MetricLabel',
            parent=self.styles['Normal'],
            fontSize=9,
            textColor=colors.HexColor('#95a5a6'),
            spaceAfter=2,
            fontName='Helvetica'
        ))

        # Metric value
        self.styles.add(ParagraphStyle(
            name='MetricValue',
            parent=self.styles['Normal'],
            fontSize=18,
            fontName='Helvetica-Bold',
            spaceAfter=8
        ))

        # Body text
        self.styles.add(ParagraphStyle(
            name='QuickBody',
            parent=self.styles['BodyText'],
            fontSize=10,
            leading=14,
            spaceAfter=8
        ))

        # Bullet point
        self.styles.add(ParagraphStyle(
            name='BulletPoint',
            parent=self.styles['Normal'],
            fontSize=10,
            leading=14,
            leftIndent=15,
            spaceAfter=6
        ))

    def generate_quick_report(
        self,
        state: Dict[str, Any],
        output_dir: str
    ) -> str:
        """
        Generate quick analysis PDF report.

        Args:
            state: Workflow state containing analysis outputs
            output_dir: Directory to save PDF

        Returns:
            Path to generated PDF, or None if failed
        """
        try:
            # Create output directory
            os.makedirs(output_dir, exist_ok=True)

            # Generate filename
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            output_path = os.path.join(output_dir, f"quick_report_{timestamp}.pdf")

            # Extract data
            project_params = state.get("project_params", {})
            quick_market = state.get("quick_market_output", {}).get("output", {})
            quick_location = state.get("quick_location_output", {}).get("output", {})
            quick_synthesis = state.get("quick_synthesis_output", {}).get("output", {})
            area_context = state.get("area_context", {})

            # Generate map image (if coordinates available)
            map_path = None
            location_data = area_context.get("location", {})
            coords = location_data.get("coordinates")

            if coords and len(coords) == 2:
                map_generator = MapGenerator()
                if map_generator.is_available():
                    map_filename = f"map_{timestamp}.png"
                    map_path = os.path.join(output_dir, map_filename)
                    map_path = map_generator.generate_area_map(
                        center_coords=(coords[0], coords[1]),
                        area_context=area_context,
                        output_path=map_path,
                        width=600,
                        height=400,
                        zoom=14
                    )

            # Create PDF document
            doc = SimpleDocTemplate(
                output_path,
                pagesize=A4,
                rightMargin=1.5*cm,
                leftMargin=1.5*cm,
                topMargin=1.5*cm,
                bottomMargin=1.5*cm,
                title="Quick Analysis Report"
            )

            # Build content
            story = []

            # Page 1: Title, Decision, Key Metrics
            story.extend(self._build_title_section(project_params))
            story.extend(self._build_decision_box(quick_synthesis))
            story.extend(self._build_key_metrics(quick_market, quick_location, quick_synthesis))

            # Page 2: Map, Details, Insights, Next Steps
            story.append(PageBreak())

            # Add map if available
            if map_path and os.path.exists(map_path):
                story.extend(self._build_map_section(map_path, area_context))

            story.extend(self._build_market_summary(quick_market))
            story.extend(self._build_location_summary(quick_location, area_context))
            story.extend(self._build_insights_and_risks(quick_synthesis))
            story.extend(self._build_next_steps(quick_synthesis))

            # Build PDF
            doc.build(story)

            print(f"✓ Quick PDF report generated: {output_path}")
            return output_path

        except Exception as e:
            print(f"✗ Error generating quick PDF: {str(e)}")
            import traceback
            traceback.print_exc()
            return None

    def _build_title_section(self, project_params: Dict) -> List:
        """Build title section."""
        elements = []

        # Title
        project_name = project_params.get("project_name", "Real Estate Project")
        elements.append(Paragraph(project_name, self.styles['QuickTitle']))

        # Subtitle
        location = project_params.get("location", "")
        date = datetime.now().strftime("%Y-%m-%d")
        subtitle = f"{location}<br/>Quick Analysis Report | {date}"
        elements.append(Paragraph(subtitle, self.styles['QuickSubtitle']))

        elements.append(Spacer(1, 10*mm))

        return elements

    def _build_decision_box(self, synthesis: Dict) -> List:
        """Build prominent go/no-go decision box."""
        elements = []

        decision_data = synthesis.get("go_no_go_decision", {})
        recommendation = decision_data.get("recommendation", "UNKNOWN")
        confidence = decision_data.get("confidence", "unknown")
        rationale = decision_data.get("rationale", "")

        # Choose color based on decision
        if recommendation == "GO":
            box_color = self.color_go
        elif recommendation == "NO-GO":
            box_color = self.color_no_go
        else:
            box_color = self.color_maybe

        # Create decision box table
        decision_text = Paragraph(
            f"<font color='white'>{recommendation}</font>",
            self.styles['DecisionLarge']
        )

        confidence_text = Paragraph(
            f"<font color='white' size='12'>Confidence: {confidence.upper()}</font>",
            self.styles['DecisionRationale']
        )

        table_data = [[decision_text], [confidence_text]]
        decision_table = Table(table_data, colWidths=[16*cm])
        decision_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), box_color),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 15),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 15),
            ('LEFTPADDING', (0, 0), (-1, -1), 10),
            ('RIGHTPADDING', (0, 0), (-1, -1), 10),
        ]))

        elements.append(decision_table)
        elements.append(Spacer(1, 5*mm))

        # Rationale
        if rationale:
            elements.append(Paragraph(
                f"<b>Rationale:</b> {rationale}",
                self.styles['QuickBody']
            ))
            elements.append(Spacer(1, 8*mm))

        return elements

    def _build_key_metrics(self, market: Dict, location: Dict, synthesis: Dict) -> List:
        """Build key metrics boxes."""
        elements = []

        elements.append(Paragraph("KEY METRICS", self.styles['QuickSection']))

        # Extract metrics
        pricing = market.get("pricing_analysis", {})
        current_price = pricing.get("current_price_level", {})
        avg_price = current_price.get("average_sqm_price", 0)
        trend = current_price.get("trend", "unknown")

        target = market.get("target_demographic", {})
        primary_segment = target.get("primary_segment", "N/A")
        match_score = target.get("match_score", 0)

        location_assessment = location.get("location_assessment", {})
        overall_rating = location_assessment.get("overall_rating", "N/A")

        amenities = location.get("amenities_analysis", {})
        amenity_score = amenities.get("amenity_score", 0)

        transit = amenities.get("transit_access", {})
        transit_quality = transit.get("quality", "N/A")

        competition = location.get("competition_analysis", {})
        competing_units = competition.get("total_competing_units", 0)

        # Create metrics table (2x3 grid)
        metrics_data = [
            [
                self._create_metric_cell("Current Price", f"{avg_price:,} kr/kvm", trend.upper()),
                self._create_metric_cell("Target Match", f"{match_score:.0%}", primary_segment[:30]),
                self._create_metric_cell("Location Rating", overall_rating.upper(), f"Amenity: {amenity_score:.0%}")
            ],
            [
                self._create_metric_cell("Transit Access", transit_quality.upper(), transit.get("closest_stop_name", "")[:30]),
                self._create_metric_cell("Competition", f"{competing_units} units", competition.get("market_saturation", "N/A").upper()),
                self._create_metric_cell("Market Activity", market.get("key_metrics", {}).get("demand_level", "N/A").upper(), "")
            ]
        ]

        metrics_table = Table(metrics_data, colWidths=[5.3*cm, 5.3*cm, 5.3*cm])
        metrics_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), self.color_light),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.white),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('LEFTPADDING', (0, 0), (-1, -1), 8),
            ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ]))

        elements.append(metrics_table)
        elements.append(Spacer(1, 5*mm))

        return elements

    def _create_metric_cell(self, label: str, value: str, subtitle: str = "") -> Paragraph:
        """Create a formatted metric cell."""
        cell_content = f"""
        <font size='9' color='#95a5a6'>{label}</font><br/>
        <font size='16' color='#2c3e50'><b>{value}</b></font>
        """
        if subtitle:
            cell_content += f"<br/><font size='8' color='#7f8c8d'>{subtitle}</font>"

        return Paragraph(cell_content, self.styles['Normal'])

    def _build_market_summary(self, market: Dict) -> List:
        """Build market analysis summary."""
        elements = []

        elements.append(Paragraph("MARKET ANALYSIS", self.styles['QuickSection']))

        # Target demographic
        target = market.get("target_demographic", {})
        elements.append(Paragraph(
            f"<b>Target Demographic:</b> {target.get('primary_segment', 'N/A')}",
            self.styles['QuickBody']
        ))
        elements.append(Paragraph(
            target.get('description', ''),
            self.styles['QuickBody']
        ))

        # Housing stock gap
        housing = market.get("housing_stock_analysis", {})
        elements.append(Paragraph(
            f"<b>Market Gap:</b> {housing.get('market_gap', 'N/A')}",
            self.styles['QuickBody']
        ))

        # Pricing recommendation
        pricing = market.get("pricing_analysis", {})
        rec_price = pricing.get("recommended_price_range", {})
        if rec_price:
            elements.append(Paragraph(
                f"<b>Recommended Price:</b> {rec_price.get('low', 0):,} - {rec_price.get('high', 0):,} kr/kvm",
                self.styles['QuickBody']
            ))

        elements.append(Spacer(1, 5*mm))

        return elements

    def _build_location_summary(self, location: Dict, area_context: Dict) -> List:
        """Build location analysis summary."""
        elements = []

        elements.append(Paragraph("LOCATION & AMENITIES", self.styles['QuickSection']))

        # Location description
        loc_assess = location.get("location_assessment", {})
        elements.append(Paragraph(
            loc_assess.get('description', ''),
            self.styles['QuickBody']
        ))

        # Area context summary
        if area_context and "summary" in area_context:
            elements.append(Paragraph(
                f"<b>Area Summary:</b> {area_context['summary']}",
                self.styles['QuickBody']
            ))

        # Strengths and weaknesses
        strengths = location.get("location_strengths", [])
        if strengths:
            elements.append(Paragraph("<b>Key Strengths:</b>", self.styles['QuickBody']))
            for strength in strengths[:3]:
                elements.append(Paragraph(
                    f"• {strength.get('description', '')}",
                    self.styles['BulletPoint']
                ))

        weaknesses = location.get("location_weaknesses", [])
        if weaknesses:
            elements.append(Paragraph("<b>Key Weaknesses:</b>", self.styles['QuickBody']))
            for weakness in weaknesses[:3]:
                elements.append(Paragraph(
                    f"• {weakness.get('description', '')}",
                    self.styles['BulletPoint']
                ))

        elements.append(Spacer(1, 5*mm))

        return elements

    def _build_map_section(self, map_path: str, area_context: Dict) -> List:
        """Build map section with area overview."""
        elements = []

        elements.append(Paragraph("AREA OVERVIEW", self.styles['QuickSection']))

        # Add description
        location_name = area_context.get("location", {}).get("name", "Area")
        elements.append(Paragraph(
            f"Map showing {location_name} with key points of interest:",
            self.styles['QuickBody']
        ))

        # Legend
        legend_items = [
            "🔴 P = Property location",
            "🔵 B = Bus stops",
            "🟢 S = Schools",
            "🟠 M = Supermarkets"
        ]
        for item in legend_items:
            elements.append(Paragraph(
                f"• {item}",
                self.styles['BulletPoint']
            ))

        elements.append(Spacer(1, 3*mm))

        # Add map image
        try:
            # Calculate width to fit page (A4 width - margins)
            available_width = self.page_width - 3*cm  # 1.5cm margins on each side
            map_width = min(available_width, 16*cm)  # Max 16cm width
            map_height = map_width * (2/3)  # Maintain 3:2 aspect ratio

            img = Image(map_path, width=map_width, height=map_height)
            elements.append(img)
        except Exception as e:
            print(f"⚠️  Failed to add map to PDF: {str(e)}")
            elements.append(Paragraph(
                "⚠ Map could not be displayed",
                self.styles['QuickBody']
            ))

        elements.append(Spacer(1, 5*mm))

        return elements

    def _build_insights_and_risks(self, synthesis: Dict) -> List:
        """Build insights and risks section."""
        elements = []

        # Key insights
        insights = synthesis.get("key_insights", [])
        if insights:
            elements.append(Paragraph("KEY INSIGHTS", self.styles['QuickSection']))
            for insight in insights[:4]:
                category = insight.get('category', 'General')
                importance = insight.get('importance', 'medium')
                text = insight.get('insight', '')
                impact_icon = "✓" if insight.get('impact') == 'positive' else "⚠" if insight.get('impact') == 'negative' else "•"

                elements.append(Paragraph(
                    f"{impact_icon} <b>[{category}]</b> {text}",
                    self.styles['BulletPoint']
                ))

            elements.append(Spacer(1, 3*mm))

        # Key risks
        risks = synthesis.get("key_risks", [])
        if risks:
            elements.append(Paragraph("KEY RISKS & MITIGATION", self.styles['QuickSection']))
            for risk in risks[:3]:
                risk_text = risk.get('risk', '')
                severity = risk.get('severity', 'medium')
                mitigation = risk.get('mitigation', '')

                elements.append(Paragraph(
                    f"<b>{severity.upper()}:</b> {risk_text}",
                    self.styles['QuickBody']
                ))
                if mitigation:
                    elements.append(Paragraph(
                        f"<i>Mitigation:</i> {mitigation}",
                        self.styles['BulletPoint']
                    ))

            elements.append(Spacer(1, 3*mm))

        return elements

    def _build_next_steps(self, synthesis: Dict) -> List:
        """Build next steps section."""
        elements = []

        next_steps = synthesis.get("next_steps", [])
        if next_steps:
            elements.append(Paragraph("RECOMMENDED NEXT STEPS", self.styles['QuickSection']))

            for i, step in enumerate(next_steps[:5], 1):
                action = step.get('action', '')
                priority = step.get('priority', 'medium')

                priority_marker = "🔴" if priority == "immediate" else "🟠" if priority == "high" else "🟢"

                elements.append(Paragraph(
                    f"{priority_marker} <b>{i}.</b> {action}",
                    self.styles['BulletPoint']
                ))

        # Executive summary
        exec_summary = synthesis.get("executive_summary", "")
        if exec_summary:
            elements.append(Spacer(1, 5*mm))
            elements.append(Paragraph("EXECUTIVE SUMMARY", self.styles['QuickSection']))
            elements.append(Paragraph(exec_summary, self.styles['QuickBody']))

        return elements


def generate_quick_report(state: Dict[str, Any], output_dir: str) -> str:
    """
    Convenience function to generate quick analysis PDF.

    Args:
        state: Workflow state
        output_dir: Output directory

    Returns:
        Path to generated PDF
    """
    generator = QuickPDFGenerator()
    return generator.generate_quick_report(state, output_dir)
