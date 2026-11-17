"""
Quick Analysis Workflow
Simplified 3-agent workflow for rapid go/no-go assessments.
Updated to use new data export format (metrics + booli_data).
"""
from typing import Dict, Any
from langgraph.graph import StateGraph, END

from graph.state import AnalysisState
from agents.quick_market_analyst import QuickMarketAnalystAgent
from agents.quick_location_analyst import QuickLocationAnalystAgent
from agents.quick_synthesizer import QuickSynthesizerAgent


def create_quick_workflow() -> StateGraph:
    """
    Create the quick analysis workflow graph.

    Simplified workflow:
    1. Quick Market Analyst (demographics, housing stock, pricing from metrics + booli_data)
    2. Quick Location Analyst (location, amenities, competition)
    3. Quick Synthesizer (synthesis, go/no-go decision, preliminary pricing/product mix)

    Returns:
        Compiled StateGraph workflow
    """
    # Initialize agents
    quick_market = QuickMarketAnalystAgent()
    quick_location = QuickLocationAnalystAgent()
    quick_synthesizer = QuickSynthesizerAgent()

    # Create workflow graph
    workflow = StateGraph(AnalysisState)

    # Add nodes
    workflow.add_node("quick_market", quick_market.execute)
    workflow.add_node("quick_location", quick_location.execute)
    workflow.add_node("quick_synthesizer", quick_synthesizer.execute)

    # Define edges (linear flow)
    workflow.set_entry_point("quick_market")
    workflow.add_edge("quick_market", "quick_location")
    workflow.add_edge("quick_location", "quick_synthesizer")
    workflow.add_edge("quick_synthesizer", END)

    # Compile and return
    return workflow.compile()


def print_quick_workflow_diagram():
    """Print ASCII diagram of quick workflow."""
    print("""
Quick Analysis Workflow (v2.0)
==============================

Input: JSON from data collection
  - metadata (kommun, fastighetsbeteckning, coordinates)
  - metrics (population, household, economic_standard, housing_type, etc.)
  - booli_data (sales, summary)
  - new_construction (optional)
  - area_context (optional)

    START
      |
      v
+-------------------------+
| Quick Market            |
| Analyst                 |
|                         |
| Input:                  |
| - metrics.*             |
| - booli_data.*          |
|                         |
| Output:                 |
| - Target demographic    |
| - Housing stock analysis|
| - Pricing analysis      |
+-------------------------+
      |
      v
+-------------------------+
| Quick Location          |
| Analyst                 |
|                         |
| Input:                  |
| - metrics.housing_type  |
| - metrics.building_age  |
| - new_construction      |
| - area_context          |
|                         |
| Output:                 |
| - Location assessment   |
| - Area characteristics  |
| - Competition analysis  |
+-------------------------+
      |
      v
+-------------------------+
| Quick                   |
| Synthesizer             |
|                         |
| Input:                  |
| - quick_market_output   |
| - quick_location_output |
|                         |
| Output:                 |
| - GO/NO-GO decision     |
| - Key insights          |
| - Pricing guidance      |
| - Product mix guidance  |
| - Next steps            |
+-------------------------+
      |
      v
     END

Estimated time: ~2-3 minutes
Output: JSON with go/no-go recommendation + preliminary guidance
""")
