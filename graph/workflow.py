"""
LangGraph workflow construction for Real Estate Analysis.
"""
from typing import Dict, Any
from langgraph.graph import StateGraph, END
from graph.state import AnalysisState
from agents.orchestrator import OrchestratorAgent
from agents.demographics_analyst import DemographicsAnalystAgent
from agents.market_data_analyst import MarketDataAnalystAgent
from agents.competition_analyst import CompetitionAnalystAgent
from agents.migration_analyst import MigrationAnalystAgent
from agents.market_intelligence_synthesizer import MarketIntelligenceSynthesizerAgent
from agents.pricing_strategist import PricingStrategistAgent
from agents.product_mix_optimizer import ProductMixOptimizerAgent
from agents.synthesis_analyst import SynthesisAnalystAgent
from agents.quality_controller import QualityControllerAgent
from agents.report_writer import ReportWriterAgent


def create_workflow() -> StateGraph:
    """
    Create the complete LangGraph workflow for real estate analysis.
    Includes all 11 agents across 6 phases:
    - Phase 1: Orchestrator (validation)
    - Phase 2: Demographics, Market Data, Competition (parallel analysis)
    - Phase 3: Migration, Market Intelligence (synthesis)
    - Phase 4: Pricing, Product Mix (strategic recommendations)
    - Phase 5: Synthesis, Quality Controller (QA with review loops)
    - Phase 6: Report Writer (final report generation)

    Returns:
        Compiled StateGraph workflow
    """
    # Initialize workflow
    workflow = StateGraph(AnalysisState)

    # Initialize agents
    orchestrator = OrchestratorAgent()
    demographics = DemographicsAnalystAgent()
    market_data = MarketDataAnalystAgent()
    competition = CompetitionAnalystAgent()
    migration = MigrationAnalystAgent()
    market_intelligence = MarketIntelligenceSynthesizerAgent()
    pricing = PricingStrategistAgent()
    product_mix = ProductMixOptimizerAgent()
    synthesis = SynthesisAnalystAgent()
    quality_controller = QualityControllerAgent()
    report_writer = ReportWriterAgent()

    # Define node functions
    def orchestrator_node(state: AnalysisState) -> AnalysisState:
        """Orchestrator validation node."""
        return orchestrator.execute(state)

    def demographics_node(state: AnalysisState) -> AnalysisState:
        """Demographics analysis node."""
        return demographics.execute(state)

    def market_data_node(state: AnalysisState) -> AnalysisState:
        """Market data analysis node."""
        return market_data.execute(state)

    def competition_node(state: AnalysisState) -> AnalysisState:
        """Competition analysis node."""
        return competition.execute(state)

    def migration_node(state: AnalysisState) -> AnalysisState:
        """Migration analysis node."""
        return migration.execute(state)

    def market_intelligence_node(state: AnalysisState) -> AnalysisState:
        """Market intelligence synthesis node."""
        return market_intelligence.execute(state)

    def pricing_node(state: AnalysisState) -> AnalysisState:
        """Pricing strategy node."""
        return pricing.execute(state)

    def product_mix_node(state: AnalysisState) -> AnalysisState:
        """Product mix optimization node."""
        return product_mix.execute(state)

    def synthesis_node(state: AnalysisState) -> AnalysisState:
        """Synthesis analyst node."""
        return synthesis.execute(state)

    def quality_controller_node(state: AnalysisState) -> AnalysisState:
        """Quality controller node."""
        return quality_controller.execute(state)

    def report_writer_node(state: AnalysisState) -> AnalysisState:
        """Report writer node."""
        return report_writer.execute(state)

    # Add nodes to workflow
    workflow.add_node("orchestrator", orchestrator_node)
    workflow.add_node("demographics", demographics_node)
    workflow.add_node("market_data", market_data_node)
    workflow.add_node("competition", competition_node)
    workflow.add_node("migration", migration_node)
    workflow.add_node("market_intelligence", market_intelligence_node)
    workflow.add_node("pricing", pricing_node)
    workflow.add_node("product_mix", product_mix_node)
    workflow.add_node("synthesis", synthesis_node)
    workflow.add_node("quality_controller", quality_controller_node)
    workflow.add_node("report_writer", report_writer_node)

    # Define conditional edge from orchestrator
    def should_continue_after_orchestrator(state: AnalysisState) -> str:
        """
        Decide whether to continue to Phase 2 analysis or end.

        Args:
            state: Current state

        Returns:
            Next node name or END
        """
        if state.get("orchestrator_validated"):
            return "continue"
        else:
            return "end"

    # Add edges
    workflow.set_entry_point("orchestrator")

    # Conditional routing from orchestrator
    workflow.add_conditional_edges(
        "orchestrator",
        should_continue_after_orchestrator,
        {
            "continue": "demographics",
            "end": END
        }
    )

    # Phase 2: Sequential execution (will be made parallel in future)
    # demographics -> market_data -> competition
    workflow.add_edge("demographics", "market_data")
    workflow.add_edge("market_data", "competition")

    # Phase 3: Sequential execution
    # competition -> migration -> market_intelligence
    workflow.add_edge("competition", "migration")
    workflow.add_edge("migration", "market_intelligence")

    # Phase 4: Strategic Recommendations
    # market_intelligence -> pricing -> product_mix
    workflow.add_edge("market_intelligence", "pricing")
    workflow.add_edge("pricing", "product_mix")

    # Phase 5: Quality & Synthesis
    # product_mix -> synthesis -> quality_controller
    workflow.add_edge("product_mix", "synthesis")
    workflow.add_edge("synthesis", "quality_controller")

    # Conditional routing after QA
    def should_continue_after_qa(state: AnalysisState) -> str:
        """
        Decide whether to approve, reject, or trigger review loop.

        Args:
            state: Current state

        Returns:
            Next node name or END
        """
        qa_decision = state.get("qa_decision", "REJECTED_MAJOR_REVISION_NEEDED")
        review_loop_count = state.get("review_loop_count", 0)
        max_loops = 2

        # If approved (with or without warnings), proceed to report generation
        if qa_decision in ["APPROVED", "APPROVED_WITH_WARNINGS"]:
            return "approved"

        # If rejected but we've already done max loops, stop
        if review_loop_count >= max_loops:
            return "max_loops_reached"

        # If rejected and can still loop, trigger review
        if qa_decision.startswith("REJECTED"):
            return "rejected_review"

        # Default: approve
        return "approved"

    workflow.add_conditional_edges(
        "quality_controller",
        should_continue_after_qa,
        {
            "approved": "report_writer",  # Generate report when approved
            "max_loops_reached": END,  # Stop if max loops reached
            "rejected_review": "synthesis"  # Loop back to synthesis for revision
        }
    )

    # Phase 6: Report Generation
    # report_writer -> END
    workflow.add_edge("report_writer", END)

    # Compile workflow
    return workflow.compile()


def create_full_workflow() -> StateGraph:
    """
    Create the full workflow with all agents.
    This is a placeholder for future expansion.

    Returns:
        Compiled StateGraph workflow
    """
    # For now, return the simple workflow
    # Will be expanded to include all 11 agents
    return create_workflow()
