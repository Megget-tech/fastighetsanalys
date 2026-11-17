#!/usr/bin/env python3
"""
Quick Analysis Entry Point
Fast go/no-go assessment for residential development projects.

Usage:
    python quick_analysis.py --property "NACKA KVARNHOLMEN 1:1"
    python quick_analysis.py --location "Kvarnholmen, Nacka" --use-mock
"""
import os
import json
import sys
import argparse
from pathlib import Path
from datetime import datetime
from typing import Dict, Any

from dotenv import load_dotenv

from graph.quick_workflow import create_quick_workflow, print_quick_workflow_diagram
from graph.state import create_initial_state
from utils.area_context_collector import AreaContextCollector

# Load environment variables
load_dotenv()


def create_minimal_mock_data(location: str = None, property_designation: str = None) -> tuple[Dict[str, Any], Dict[str, Any]]:
    """
    Create minimal mock data for quick analysis testing.

    Args:
        location: Location string
        property_designation: Property designation

    Returns:
        Tuple of (input_data, project_params)
    """
    project_params = {
        "project_name": "Quick Analysis Test Project",
        "location": location or "Kvarnholmen, Nacka",
        "property_designation": property_designation,
        "project_size_units": 100,
        "analysis_date": datetime.now().strftime("%Y-%m-%d")
    }

    input_data = {
        "demographic_data": {
            "total_population": 8450,
            "total_households": 4200,
            "population_by_age": {
                "25-29": 980,
                "30-34": 1150,
                "35-39": 1050,
            },
            "household_size_distribution": {
                "1_person": 1680,
                "2_persons": 1890,
            },
            "economic_standard": {
                "high": 1890,
                "medium_high": 1050,
            },
            "education_level": {
                "university_degree": 3360,
            },
        },
        "housing_stock_data": {
            "total_units": 4200,
            "units_by_size": {
                "1_rok": 840,
                "2_rok": 1680,
                "3_rok": 1260,
            },
            "units_by_type": {
                "apartment": 3990,
            },
        },
        "sales_data": [
            {
                "transaction_date": "2023-11-15",
                "price": 4500000,
                "size_sqm": 55,
                "rooms": 2,
            },
            {
                "transaction_date": "2023-10-22",
                "price": 6800000,
                "size_sqm": 82,
                "rooms": 3,
            },
        ],
        "price_history": {
            "2021": {"average_sqm_price": 78000},
            "2022": {"average_sqm_price": 81000},
            "2023": {"average_sqm_price": 85000}
        },
        "new_construction_data": [
            {
                "project_name": "Kvarnholmen Strand",
                "developer": "JM AB",
                "total_units": 200,
                "sales_status": "80% sold",
            },
        ],
        "geographic_data": {
            "distance_to_city_center_km": 8.5,
        },
        "future_plans": [
            "Ny tunnelbanestation planerad 2028",
            "Utbyggnad av kommersiell service pågår"
        ]
    }

    return input_data, project_params


def print_quick_summary(state: Dict[str, Any]) -> None:
    """
    Print summary of quick analysis results.

    Args:
        state: Final workflow state
    """
    print("\n" + "="*80)
    print("QUICK ANALYSIS SUMMARY")
    print("="*80)

    # Quick Market output
    if state.get("quick_market_output"):
        market = state["quick_market_output"]
        print("\n1. MARKET ANALYSIS:")
        print(f"   Status: {market.get('status', 'unknown').upper()}")
        print(f"   Confidence: {market.get('confidence_score', 0):.2f}")

        if "output" in market:
            output = market["output"]
            if "target_demographic" in output:
                target = output["target_demographic"]
                print(f"\n   Target Demographic: {target.get('primary_segment', 'N/A')}")
                print(f"   Match Score: {target.get('match_score', 0):.2f}")

            if "pricing_analysis" in output:
                pricing = output["pricing_analysis"]
                current = pricing.get("current_price_level", {})
                print(f"\n   Current Price Level: {current.get('average_sqm_price', 0):,} kr/kvm")
                print(f"   Trend: {current.get('trend', 'unknown').upper()}")

    # Quick Location output
    if state.get("quick_location_output"):
        location = state["quick_location_output"]
        print("\n2. LOCATION ANALYSIS:")
        print(f"   Status: {location.get('status', 'unknown').upper()}")
        print(f"   Confidence: {location.get('confidence_score', 0):.2f}")

        if "output" in location:
            output = location["output"]
            if "location_assessment" in output:
                loc = output["location_assessment"]
                print(f"\n   Overall Rating: {loc.get('overall_rating', 'unknown').upper()}")
                print(f"   Location: {loc.get('location_name', 'N/A')}")

            if "amenities_analysis" in output:
                amenities = output["amenities_analysis"]
                print(f"   Amenity Score: {amenities.get('amenity_score', 0):.2f}")

                transit = amenities.get("transit_access", {})
                print(f"   Transit Quality: {transit.get('quality', 'unknown').upper()}")

    # Quick Synthesis output
    if state.get("quick_synthesis_output"):
        synthesis = state["quick_synthesis_output"]
        print("\n3. GO/NO-GO DECISION:")
        print(f"   Status: {synthesis.get('status', 'unknown').upper()}")
        print(f"   Confidence: {synthesis.get('confidence_score', 0):.2f}")

        if "output" in synthesis:
            output = synthesis["output"]

            # Go/No-Go Decision
            if "go_no_go_decision" in output:
                decision = output["go_no_go_decision"]
                recommendation = decision.get("recommendation", "UNKNOWN")

                print(f"\n   {'='*76}")
                print(f"   RECOMMENDATION: {recommendation}")
                print(f"   Confidence: {decision.get('confidence', 'unknown').upper()}")
                print(f"   {'='*76}")

                print(f"\n   Rationale:")
                print(f"   {decision.get('rationale', 'N/A')}")

            # Key Insights
            if "key_insights" in output:
                insights = output["key_insights"]
                if insights:
                    print(f"\n   Top Insights:")
                    for i, insight in enumerate(insights[:3], 1):
                        category = insight.get('category', 'General')
                        importance = insight.get('importance', 'medium')
                        text = insight.get('insight', 'N/A')
                        print(f"   {i}. [{category.upper()}] ({importance}) {text}")

            # Executive Summary
            if "executive_summary" in output:
                print(f"\n   Executive Summary:")
                print(f"   {output['executive_summary']}")

    # Errors and warnings
    if state.get("errors"):
        print("\n⚠ ERRORS:")
        for error in state["errors"]:
            print(f"   - {error}")

    if state.get("warnings"):
        print("\n⚠ WARNINGS:")
        for warning in state["warnings"][:5]:
            print(f"   - {warning}")

    # Execution metrics
    if state.get("agent_execution_times"):
        print("\n4. EXECUTION METRICS:")
        total_time = sum(state["agent_execution_times"].values())
        print(f"   Total Time: {total_time:.1f}s ({total_time/60:.1f} minutes)")
        for agent, time_taken in state["agent_execution_times"].items():
            print(f"   - {agent}: {time_taken:.1f}s")

    print("\n" + "="*80)


def main():
    """Main execution function for quick analysis."""
    parser = argparse.ArgumentParser(
        description="Quick Real Estate Analysis - Fast go/no-go assessment",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s --property "NACKA KVARNHOLMEN 1:1"
  %(prog)s --location "Kvarnholmen, Nacka" --use-mock
  %(prog)s --location "Hammarby Sjöstad" --output-dir quick_reports
        """
    )

    parser.add_argument(
        "--location",
        type=str,
        help="Location name (e.g., 'Kvarnholmen, Nacka')"
    )

    parser.add_argument(
        "--property", "-p",
        dest="property_designation",
        type=str,
        help="Property designation (e.g., 'NACKA KVARNHOLMEN 1:1')"
    )

    parser.add_argument(
        "--input",
        type=str,
        help="Path to input JSON file (optional)"
    )

    parser.add_argument(
        "--output-dir",
        type=str,
        default="data/quick_output",
        help="Output directory for results (default: data/quick_output)"
    )

    parser.add_argument(
        "--use-mock",
        action="store_true",
        help="Use mock data for testing"
    )

    parser.add_argument(
        "--show-workflow",
        action="store_true",
        help="Show workflow diagram and exit"
    )

    parser.add_argument(
        "--no-pdf",
        action="store_true",
        help="Skip PDF generation"
    )

    args = parser.parse_args()

    # Show workflow diagram if requested
    if args.show_workflow:
        print_quick_workflow_diagram()
        return 0

    print("\n" + "="*80)
    print("QUICK REAL ESTATE ANALYSIS")
    print("Fast go/no-go assessment (~3 minutes)")
    print("="*80)

    # Check API key
    if not os.getenv("ANTHROPIC_API_KEY"):
        print("\n❌ Error: ANTHROPIC_API_KEY not found in environment variables")
        print("Please create a .env file with your API key")
        return 1

    # Validate inputs
    if not args.use_mock and not args.input and not args.location and not args.property_designation:
        parser.error("Either --location, --property, --input, or --use-mock must be provided")

    try:
        # Load or create input data
        if args.input:
            print(f"\n📊 Loading input data from {args.input}...")
            with open(args.input, 'r', encoding='utf-8') as f:
                data = json.load(f)
            input_data = data.get("input_data", {})
            project_params = data.get("project_params", {})
        else:
            print("\n📊 Using minimal mock data...")
            input_data, project_params = create_minimal_mock_data(
                location=args.location,
                property_designation=args.property_designation
            )

        print(f"   Project: {project_params.get('project_name', 'Unknown')}")
        print(f"   Location: {project_params.get('location', 'Unknown')}")

        # Collect area context data
        area_context = None
        property_designation = project_params.get('property_designation') or args.property_designation
        location = project_params.get('location') or args.location

        if property_designation or location:
            print("\n🗺️  Collecting area context data...")
            try:
                collector = AreaContextCollector()
                area_context = collector.collect(
                    location=location,
                    property_designation=property_designation,
                    radius_m=1000
                )

                if area_context and "error" not in area_context:
                    print(f"   ✓ Area context collected successfully")
                    if "summary" in area_context:
                        print(f"   ✓ {area_context['summary']}")
                else:
                    print(f"   ⚠️  Could not collect area context")
                    area_context = None

            except Exception as e:
                print(f"   ⚠️  Area context collection failed: {str(e)}")
                area_context = None

        # Create initial state
        print("\n⚙️  Initializing quick analysis workflow...")
        initial_state = create_initial_state(input_data, project_params)
        initial_state["area_context"] = area_context

        # Create workflow
        print("⚙️  Building workflow...")
        workflow = create_quick_workflow()

        # Execute workflow
        print("\n🚀 Executing quick analysis...")
        print("-" * 80)

        final_state = workflow.invoke(initial_state)

        # Print summary
        print_quick_summary(final_state)

        # Save output
        os.makedirs(args.output_dir, exist_ok=True)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_path = os.path.join(args.output_dir, f"quick_analysis_{timestamp}.json")

        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(final_state, indent=2, ensure_ascii=False, fp=f)

        print(f"\n✓ Output saved to: {output_path}")

        # Generate PDF (if not skipped)
        if not args.no_pdf:
            print("\n📄 Generating PDF report...")
            try:
                from utils.quick_pdf_generator import generate_quick_report
                pdf_path = generate_quick_report(final_state, args.output_dir)
                if pdf_path:
                    print(f"✓ PDF report generated: {pdf_path}")
                else:
                    print("⚠ PDF generation failed")
            except ImportError:
                print("⚠ PDF generator not yet implemented")
            except Exception as e:
                print(f"⚠ PDF generation error: {str(e)}")

        # Check if we have errors
        if final_state.get("errors"):
            print("\n⚠ Quick analysis completed with errors")
            return 1
        else:
            print("\n✓ Quick analysis completed successfully!")
            return 0

    except Exception as e:
        print(f"\n❌ Fatal error: {str(e)}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
