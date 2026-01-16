"""
State schema for the Real Estate Analysis workflow.
Defines the data structure that flows between agents in the LangGraph.
"""
from typing import TypedDict, Optional, List, Dict, Any
from datetime import datetime


class AnalysisState(TypedDict):
    """
    Main state object that flows through the LangGraph workflow.
    Each agent reads from and writes to this state.
    """
    # Input data
    input_data: Dict[str, Any]
    project_params: Dict[str, Any]
    area_context: Optional[Dict[str, Any]]  # Area context data from AreaContextCollector

    # Orchestrator
    orchestrator_validated: Optional[bool]
    data_quality_score: Optional[float]

    # Quick Analysis outputs (3-agent workflow)
    quick_market_output: Optional[Dict[str, Any]]
    quick_location_output: Optional[Dict[str, Any]]
    quick_synthesis_output: Optional[Dict[str, Any]]

    # Full Analysis: Phase 2 - Parallel Analysis (demographics, market_data, competition)
    demographics_output: Optional[Dict[str, Any]]
    market_data_output: Optional[Dict[str, Any]]
    competition_output: Optional[Dict[str, Any]]

    # Full Analysis: Phase 3 - Synthesis (migration, market_intelligence)
    migration_output: Optional[Dict[str, Any]]
    market_intelligence_output: Optional[Dict[str, Any]]

    # Full Analysis: Phase 4 - Strategic Recommendations (pricing, product_mix)
    pricing_output: Optional[Dict[str, Any]]
    product_mix_output: Optional[Dict[str, Any]]

    # Full Analysis: Phase 5 - Quality & Synthesis (synthesis, qa)
    synthesis_output: Optional[Dict[str, Any]]
    qa_output: Optional[Dict[str, Any]]
    qa_decision: Optional[str]  # "APPROVED", "APPROVED_WITH_WARNINGS", "REJECTED"
    qa_quality_score: Optional[float]
    agents_to_rerun: List[str]  # List of agent IDs that need revision

    # Full Analysis: Phase 6 - Report Generation
    report_output: Optional[Dict[str, Any]]

    # Workflow management
    current_phase: int
    review_loop_count: int
    review_loop_agent: Optional[str]  # Which agent to review

    # Logging and metadata
    errors: List[str]
    warnings: List[str]
    processing_log: List[Dict[str, Any]]
    start_time: Optional[str]
    end_time: Optional[str]

    # Performance metrics
    agent_execution_times: Dict[str, float]
    total_tokens_used: Optional[int]


def create_initial_state(input_data: Dict[str, Any], project_params: Dict[str, Any]) -> AnalysisState:
    """
    Create the initial state for the workflow.

    Args:
        input_data: Raw input data (demographics, market data, etc.)
        project_params: Project parameters (name, location, size, etc.)

    Returns:
        Initialized AnalysisState
    """
    return AnalysisState(
        # Input
        input_data=input_data,
        project_params=project_params,
        area_context=None,

        # Orchestrator
        orchestrator_validated=None,
        data_quality_score=None,

        # Quick Analysis outputs
        quick_market_output=None,
        quick_location_output=None,
        quick_synthesis_output=None,

        # Full Analysis agent outputs (all None initially)
        demographics_output=None,
        market_data_output=None,
        competition_output=None,
        migration_output=None,
        market_intelligence_output=None,
        pricing_output=None,
        product_mix_output=None,
        synthesis_output=None,
        qa_output=None,
        qa_decision=None,
        qa_quality_score=None,
        agents_to_rerun=[],
        report_output=None,

        # Workflow
        current_phase=1,
        review_loop_count=0,
        review_loop_agent=None,

        # Logging
        errors=[],
        warnings=[],
        processing_log=[],
        start_time=datetime.utcnow().isoformat(),
        end_time=None,

        # Metrics
        agent_execution_times={},
        total_tokens_used=None,
    )


def log_agent_execution(
    state: AnalysisState,
    agent_name: str,
    status: str,
    execution_time: float,
    message: Optional[str] = None
) -> None:
    """
    Helper to add an entry to the processing log.

    Args:
        state: Current state
        agent_name: Name of the agent
        status: "started", "completed", "failed"
        execution_time: Time in seconds
        message: Optional message
    """
    log_entry = {
        "timestamp": datetime.utcnow().isoformat(),
        "agent": agent_name,
        "status": status,
        "execution_time_seconds": execution_time,
        "message": message
    }
    state["processing_log"].append(log_entry)
    state["agent_execution_times"][agent_name] = execution_time
