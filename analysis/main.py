"""
Main entry point for Real Estate Analysis System.
"""
import os
import json
import sys
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, Optional
import argparse

from dotenv import load_dotenv

from graph.workflow import create_workflow
from graph.state import create_initial_state
from utils.pdf_generator import generate_reports_from_state
from utils.area_context_collector import AreaContextCollector

# Load environment variables
load_dotenv()


def load_input_data(input_path: str) -> Dict[str, Any]:
    """
    Load input data from JSON file.

    Args:
        input_path: Path to input JSON file

    Returns:
        Input data dictionary
    """
    with open(input_path, 'r', encoding='utf-8') as f:
        return json.load(f)


def save_output(output_data: Dict[str, Any], output_dir: str, prefix: str = "analysis") -> None:
    """
    Save analysis output to JSON file.

    Args:
        output_data: Output data to save
        output_dir: Output directory
        prefix: Filename prefix
    """
    os.makedirs(output_dir, exist_ok=True)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"{prefix}_{timestamp}.json"
    filepath = os.path.join(output_dir, filename)

    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(output_data, indent=2, ensure_ascii=False, fp=f)

    print(f"\n✓ Output saved to: {filepath}")


def create_mock_input_data() -> tuple[Dict[str, Any], Dict[str, Any]]:
    """
    Create mock input data for testing.

    Returns:
        Tuple of (input_data, project_params)
    """
    project_params = {
        "project_name": "Kvarnholmen Residences",
        "location": "Kvarnholmen, Nacka",
        "property_designation": "NACKA KVARNHOLMEN 1:1",
        "area_deso_code": "0182C1010",
        "project_size_units": 150,
        "analysis_date": "2024-01-15"
    }

    input_data = {
        "demographic_data": {
            "total_population": 8450,
            "total_households": 4200,
            "population_by_age": {
                "0-4": 450,
                "5-9": 380,
                "10-14": 320,
                "15-19": 280,
                "20-24": 520,
                "25-29": 980,
                "30-34": 1150,
                "35-39": 1050,
                "40-44": 850,
                "45-49": 620,
                "50-54": 540,
                "55-59": 480,
                "60-64": 420,
                "65-69": 310,
                "70-74": 210,
                "75+": 390
            },
            "household_size_distribution": {
                "1_person": 1680,
                "2_persons": 1890,
                "3_persons": 420,
                "4_persons": 168,
                "5_plus_persons": 42
            },
            "economic_standard": {
                "low": 420,
                "medium_low": 840,
                "medium_high": 1050,
                "high": 1890
            },
            "education_level": {
                "university_degree": 3360,
                "other": 840
            },
            "car_ownership": 0.52
        },
        "housing_stock_data": {
            "total_units": 4200,
            "units_by_size": {
                "1_rok": 840,
                "2_rok": 1680,
                "3_rok": 1260,
                "4_rok": 336,
                "5_rok_plus": 84
            },
            "units_by_type": {
                "apartment": 3990,
                "townhouse": 210
            },
            "construction_year": {
                "before_1990": 420,
                "1990_2000": 840,
                "2000_2010": 1680,
                "2010_2020": 1260
            },
            "ownership_type": {
                "bostadsrätt": 3780,
                "hyresrätt": 420
            }
        },
        "sales_data": [
            {
                "transaction_date": "2023-11-15",
                "price": 4500000,
                "size_sqm": 55,
                "rooms": 2,
                "monthly_fee": 3200,
                "location_coordinates": {"lat": 59.3045, "lon": 18.1527}
            },
            {
                "transaction_date": "2023-10-22",
                "price": 6800000,
                "size_sqm": 82,
                "rooms": 3,
                "monthly_fee": 4100,
                "location_coordinates": {"lat": 59.3048, "lon": 18.1530}
            },
            {
                "transaction_date": "2023-09-10",
                "price": 3900000,
                "size_sqm": 48,
                "rooms": 2,
                "monthly_fee": 2900,
                "location_coordinates": {"lat": 59.3042, "lon": 18.1525}
            }
        ],
        "price_history": {
            "2020": {"average_sqm_price": 72000, "transactions": 95},
            "2021": {"average_sqm_price": 78000, "transactions": 112},
            "2022": {"average_sqm_price": 81000, "transactions": 128},
            "2023": {"average_sqm_price": 85000, "transactions": 142}
        },
        "new_construction_data": [
            {
                "project_name": "Kvarnholmen Strand",
                "developer": "JM AB",
                "total_units": 200,
                "unit_distribution": {
                    "1_rok": 40,
                    "2_rok": 80,
                    "3_rok": 60,
                    "4_rok": 20
                },
                "pricing": {
                    "1_rok": "3500000-4200000",
                    "2_rok": "4800000-5900000",
                    "3_rok": "6500000-8200000",
                    "4_rok": "8500000-11000000"
                },
                "sales_status": "80% sold",
                "start_date": "2023-03-01"
            },
            {
                "project_name": "Nya Kvarnholmen",
                "developer": "Veidekke",
                "total_units": 120,
                "unit_distribution": {
                    "2_rok": 50,
                    "3_rok": 50,
                    "4_rok": 20
                },
                "pricing": {
                    "2_rok": "5200000-6100000",
                    "3_rok": "7000000-8500000",
                    "4_rok": "9200000-12500000"
                },
                "sales_status": "planning",
                "start_date": "2024-06-01"
            }
        ],
        "migration_data": {
            "net_migration_rate": 0.025,
            "in_migration": 320,
            "out_migration": 110,
            "time_period": "2023"
        },
        "geographic_data": {
            "distance_to_city_center_km": 8.5,
            "transit_accessibility": "high",
            "coordinates": {"lat": 59.3045, "lon": 18.1528}
        },
        "comparison_data": {
            "municipal": {
                "population_by_age": {
                    "0-4": 5.2,
                    "5-9": 4.8,
                    "10-14": 4.5,
                    "15-19": 4.2,
                    "20-24": 5.8,
                    "25-29": 7.5,
                    "30-34": 8.2,
                    "35-39": 7.8,
                    "40-44": 6.9,
                    "45-49": 6.2,
                    "50-54": 5.8,
                    "55-59": 5.4,
                    "60-64": 5.0,
                    "65-69": 4.2,
                    "70-74": 3.5,
                    "75+": 5.0
                },
                "economic_standard": {
                    "high": 44.0
                },
                "car_ownership": 0.68,
                "university_degree_percentage": 62.0
            }
        }
    }

    return input_data, project_params


def print_summary(state: Dict[str, Any]) -> None:
    """
    Print a summary of the analysis results.

    Args:
        state: Final workflow state
    """
    print("\n" + "="*80)
    print("ANALYSIS SUMMARY")
    print("="*80)

    # Orchestrator results
    print("\n1. ORCHESTRATOR VALIDATION:")
    validated = state.get("orchestrator_validated", False)
    quality_score = state.get("data_quality_score")
    print(f"   Status: {'✓ PASSED' if validated else '✗ FAILED'}")
    if quality_score is not None:
        print(f"   Data Quality Score: {quality_score:.2f}")

    # Demographics results
    if state.get("demographics_output"):
        demo = state["demographics_output"]
        print("\n2. DEMOGRAPHICS ANALYSIS:")
        print(f"   Status: {demo.get('status', 'unknown').upper()}")
        print(f"   Confidence: {demo.get('confidence_score', 0):.2f}")

        if "output" in demo and "summary" in demo["output"]:
            print(f"\n   Summary: {demo['output']['summary']}")

        if "output" in demo and "key_insights" in demo["output"]:
            print("\n   Key Insights:")
            for i, insight in enumerate(demo["output"]["key_insights"][:3], 1):
                print(f"   {i}. {insight}")

    # Market data results
    if state.get("market_data_output"):
        market = state["market_data_output"]
        print("\n3. MARKET DATA ANALYSIS:")
        print(f"   Status: {market.get('status', 'unknown').upper()}")
        print(f"   Confidence: {market.get('confidence_score', 0):.2f}")

        if "output" in market and "summary" in market["output"]:
            print(f"\n   Summary: {market['output']['summary']}")

        if "output" in market and "key_insights" in market["output"]:
            print("\n   Key Insights:")
            for i, insight in enumerate(market["output"]["key_insights"][:3], 1):
                print(f"   {i}. {insight}")

    # Competition results
    if state.get("competition_output"):
        comp = state["competition_output"]
        print("\n4. COMPETITION ANALYSIS:")
        print(f"   Status: {comp.get('status', 'unknown').upper()}")
        print(f"   Confidence: {comp.get('confidence_score', 0):.2f}")

        if "output" in comp and "summary" in comp["output"]:
            print(f"\n   Summary: {comp['output']['summary']}")

        if "output" in comp and "key_insights" in comp["output"]:
            print("\n   Key Insights:")
            for i, insight in enumerate(comp["output"]["key_insights"][:3], 1):
                print(f"   {i}. {insight}")

    # Migration results
    if state.get("migration_output"):
        mig = state["migration_output"]
        print("\n5. MIGRATION ANALYSIS:")
        print(f"   Status: {mig.get('status', 'unknown').upper()}")
        print(f"   Confidence: {mig.get('confidence_score', 0):.2f}")

        if "output" in mig and "summary" in mig["output"]:
            print(f"\n   Summary: {mig['output']['summary']}")

        if "output" in mig and "key_insights" in mig["output"]:
            print("\n   Key Insights:")
            for i, insight in enumerate(mig["output"]["key_insights"][:3], 1):
                print(f"   {i}. {insight}")

    # Market Intelligence results
    if state.get("market_intelligence_output"):
        mi = state["market_intelligence_output"]
        print("\n6. MARKET INTELLIGENCE:")
        print(f"   Status: {mi.get('status', 'unknown').upper()}")
        print(f"   Confidence: {mi.get('confidence_score', 0):.2f}")

        if "output" in mi and "summary" in mi["output"]:
            print(f"\n   Summary: {mi['output']['summary']}")

        if "output" in mi and "key_insights" in mi["output"]:
            print("\n   Key Insights:")
            for i, insight in enumerate(mi["output"]["key_insights"][:3], 1):
                print(f"   {i}. {insight}")

    # Pricing results
    if state.get("pricing_output"):
        pricing = state["pricing_output"]
        print("\n7. PRICING STRATEGY:")
        print(f"   Status: {pricing.get('status', 'unknown').upper()}")
        print(f"   Confidence: {pricing.get('confidence_score', 0):.2f}")

        if "output" in pricing and "summary" in pricing["output"]:
            print(f"\n   Summary: {pricing['output']['summary']}")

        if "output" in pricing and "key_insights" in pricing["output"]:
            print("\n   Key Insights:")
            for i, insight in enumerate(pricing["output"]["key_insights"][:3], 1):
                print(f"   {i}. {insight}")

    # Product Mix results
    if state.get("product_mix_output"):
        pm = state["product_mix_output"]
        print("\n8. PRODUCT MIX OPTIMIZATION:")
        print(f"   Status: {pm.get('status', 'unknown').upper()}")
        print(f"   Confidence: {pm.get('confidence_score', 0):.2f}")

        if "output" in pm and "summary" in pm["output"]:
            print(f"\n   Summary: {pm['output']['summary']}")

        if "output" in pm and "key_insights" in pm["output"]:
            print("\n   Key Insights:")
            for i, insight in enumerate(pm["output"]["key_insights"][:3], 1):
                print(f"   {i}. {insight}")

    # Synthesis results
    if state.get("synthesis_output"):
        syn = state["synthesis_output"]
        print("\n9. STRATEGIC SYNTHESIS:")
        print(f"   Status: {syn.get('status', 'unknown').upper()}")
        print(f"   Confidence: {syn.get('confidence_score', 0):.2f}")

        if "output" in syn and "executive_summary" in syn["output"]:
            exec_summary = syn["output"]["executive_summary"]
            if "project_context" in exec_summary:
                print(f"\n   Project Context: {exec_summary['project_context']}")
            if "core_recommendations" in exec_summary:
                print("\n   Core Recommendations:")
                for i, rec in enumerate(exec_summary["core_recommendations"][:3], 1):
                    print(f"   {i}. {rec}")

    # Quality Control results
    if state.get("qa_output"):
        qa = state["qa_output"]
        qa_decision = state.get("qa_decision", "UNKNOWN")
        qa_score = state.get("qa_quality_score", 0.0)

        print("\n10. QUALITY CONTROL:")
        print(f"   Status: {qa.get('status', 'unknown').upper()}")
        print(f"   Decision: {qa_decision}")
        print(f"   Quality Score: {qa_score:.2f}")

        if "output" in qa and "dimension_scores" in qa["output"]:
            print("\n   Quality Dimensions:")
            dims = qa["output"]["dimension_scores"]
            for dim, score in dims.items():
                print(f"   - {dim}: {score:.2f}")

        if "output" in qa and "critical_issues" in qa["output"]:
            critical = qa["output"]["critical_issues"]
            if critical:
                print("\n   ⚠ Critical Issues Found:")
                for issue in critical[:3]:
                    print(f"   - [{issue.get('severity', 'unknown').upper()}] {issue.get('description', 'No description')}")

        if state.get("review_loop_count", 0) > 0:
            print(f"\n   Review Loops Executed: {state['review_loop_count']}")

    # Report Writer results
    if state.get("report_output"):
        report = state["report_output"]
        print("\n11. FINAL REPORTS:")
        print(f"   Status: {report.get('status', 'unknown').upper()}")
        print(f"   Confidence: {report.get('confidence_score', 0):.2f}")

        if "output" in report:
            output = report["output"]
            if "report_metadata" in output:
                metadata = output["report_metadata"]
                print(f"\n   Project: {metadata.get('project_name', 'N/A')}")
                print(f"   Report Version: {metadata.get('report_version', 'N/A')}")

            # Full Report
            if "full_report" in output:
                full = output["full_report"]
                print(f"\n   📊 FULLÄNGDSRAPPORT:")
                print(f"   - Word Count: {full.get('word_count', 0):,}")
                print(f"   - Estimated Pages: {full.get('page_estimate', 0)}")
                if "sections" in full:
                    print(f"   - Sections: {len(full['sections'])}/12")

            # Executive Report
            if "executive_report" in output:
                exec_rep = output["executive_report"]
                print(f"\n   📋 KONCENTRERAD RAPPORT (Executive):")
                print(f"   - Word Count: {exec_rep.get('word_count', 0):,}")
                print(f"   - Estimated Pages: {exec_rep.get('page_estimate', 0)}")
                if "sections" in exec_rep:
                    print(f"   - Sections: {len(exec_rep['sections'])}/5")

            # Legacy format support (if only "sections" without full_report/executive_report)
            if "sections" in output and "full_report" not in output:
                sections = output["sections"]
                print(f"\n   📊 RAPPORT:")
                if "word_count" in output:
                    print(f"   - Word Count: {output.get('word_count', 0):,}")
                    print(f"   - Estimated Pages: {output.get('page_estimate', 0)}")
                print(f"   - Sections Generated: {len(sections)}")

            if "key_recommendations" in output:
                print("\n   Top Recommendations:")
                for i, rec in enumerate(output["key_recommendations"][:3], 1):
                    print(f"   {i}. {rec}")

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
        print("\n12. EXECUTION METRICS:")
        total_time = sum(state["agent_execution_times"].values())
        print(f"   Total Execution Time: {total_time:.2f}s ({total_time/60:.1f} minutes)")
        for agent, time_taken in state["agent_execution_times"].items():
            print(f"   - {agent}: {time_taken:.2f}s")

    print("\n" + "="*80)


def main():
    """Main execution function."""
    parser = argparse.ArgumentParser(
        description="Real Estate Analysis System - Multi-Agent Market Analysis"
    )
    parser.add_argument(
        "--input",
        type=str,
        help="Path to input JSON file"
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        default="data/output",
        help="Output directory for results"
    )
    parser.add_argument(
        "--use-mock",
        action="store_true",
        help="Use mock data for testing"
    )

    args = parser.parse_args()

    print("\n" + "="*80)
    print("REAL ESTATE ANALYSIS SYSTEM")
    print("Multi-Agent Market Analysis with Claude Sonnet 4")
    print("="*80)

    # Check API key
    if not os.getenv("ANTHROPIC_API_KEY"):
        print("\n❌ Error: ANTHROPIC_API_KEY not found in environment variables")
        print("Please create a .env file with your API key")
        sys.exit(1)

    try:
        # Load input data
        if args.use_mock or not args.input:
            print("\n📊 Using mock data for testing...")
            input_data, project_params = create_mock_input_data()
        else:
            print(f"\n📊 Loading input data from {args.input}...")
            data = load_input_data(args.input)
            input_data = data.get("input_data", {})
            project_params = data.get("project_params", {})

        print(f"   Project: {project_params.get('project_name', 'Unknown')}")
        print(f"   Location: {project_params.get('location', 'Unknown')}")

        # Collect area context data
        area_context = None
        property_designation = project_params.get('property_designation')
        location = project_params.get('location')

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
                    print(f"   ⚠️  Could not collect area context: {area_context.get('error', 'Unknown error')}")
                    area_context = None

            except Exception as e:
                print(f"   ⚠️  Area context collection failed: {str(e)}")
                area_context = None

        # Create initial state
        print("\n⚙️  Initializing workflow state...")
        initial_state = create_initial_state(input_data, project_params)
        initial_state["area_context"] = area_context

        # Create workflow
        print("⚙️  Building LangGraph workflow...")
        workflow = create_workflow()

        # Execute workflow
        print("\n🚀 Executing analysis workflow...")
        print("-" * 80)

        final_state = workflow.invoke(initial_state)

        # Print summary
        print_summary(final_state)

        # Save output
        save_output(final_state, args.output_dir)

        # Generate PDF reports
        print("\n📄 Generating PDF reports...")
        pdf_paths = generate_reports_from_state(final_state, args.output_dir)
        if pdf_paths:
            print(f"\n✓ Generated {len(pdf_paths)} PDF report(s)")
        else:
            print("\n⚠ No PDF reports generated")

        # Exit code based on success
        if final_state.get("orchestrator_validated") and not final_state.get("errors"):
            print("\n✓ Analysis completed successfully!")
            sys.exit(0)
        else:
            print("\n⚠ Analysis completed with errors/warnings")
            sys.exit(1)

    except Exception as e:
        print(f"\n❌ Fatal error: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
