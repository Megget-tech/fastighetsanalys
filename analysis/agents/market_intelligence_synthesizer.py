"""
Market Intelligence Synthesizer Agent
Synthesizes market insights from all previous analyses with realtor perspective.
"""
import time
import json
from typing import Dict, Any
from .base_agent import BaseAgent
from graph.state import AnalysisState


class MarketIntelligenceSynthesizerAgent(BaseAgent):
    """
    Market Intelligence Synthesizer that acts as a synthetic realtor expert.
    """

    def __init__(self):
        super().__init__(
            agent_id="market_intelligence_synthesizer",
            agent_name="Market Intelligence Synthesizer",
            temperature=0.3,  # Slightly higher for more creative synthesis
            max_tokens=4096,
        )

    def execute(self, state: AnalysisState) -> AnalysisState:
        """
        Execute market intelligence synthesis.

        Args:
            state: Current workflow state

        Returns:
            Updated state with market intelligence
        """
        start_time = time.time()

        try:
            # Get all previous agent outputs
            demographics_output = state.get("demographics_output", {})
            market_data_output = state.get("market_data_output", {})
            competition_output = state.get("competition_output", {})
            migration_output = state.get("migration_output", {})
            area_context = state.get("area_context", {})

            # Extract just the output data (not the full agent output wrapper)
            demographics_data = demographics_output.get("output", {}) if demographics_output else {}
            market_data = market_data_output.get("output", {}) if market_data_output else {}
            competition_data = competition_output.get("output", {}) if competition_output else {}
            migration_data = migration_output.get("output", {}) if migration_output else {}

            # Format prompt
            user_prompt = f"""
DEMOGRAFISK ANALYS:
{json.dumps(demographics_data, indent=2, ensure_ascii=False)}

MARKNADSDATA:
{json.dumps(market_data, indent=2, ensure_ascii=False)}

KONKURRENSANALYS:
{json.dumps(competition_data, indent=2, ensure_ascii=False)}

FLYTTSTRÖMSANALYS:
{json.dumps(migration_data, indent=2, ensure_ascii=False)}

OMRÅDESKONTEXT (Service, Infrastruktur & Kollektivtrafik):
{json.dumps(area_context, indent=2, ensure_ascii=False)}
"""

            # Load system prompt from template
            system_prompt = self.prompt_template

            # Invoke LLM
            result = self.invoke_llm(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                return_json=True
            )

            # Create standardized output
            output = self.create_output(
                status="completed",
                output_data=result,
                confidence_score=result.get("confidence_score", 0.75),
                warnings=result.get("warnings", [])
            )

            # Update state
            state["market_intelligence_output"] = output

            # Add warnings to state
            if output.get("warnings"):
                state["warnings"].extend([
                    f"Market Intelligence: {w}" for w in output["warnings"]
                ])

            # Log execution
            execution_time = time.time() - start_time
            self.log_execution(
                state,
                status="completed",
                execution_time=execution_time,
                message=f"Market intelligence synthesis completed with confidence {output['confidence_score']:.2f}"
            )

            return state

        except Exception as e:
            execution_time = time.time() - start_time
            error_msg = f"Market intelligence synthesis failed: {str(e)}"
            state["errors"].append(error_msg)

            # Create failed output
            state["market_intelligence_output"] = self.create_output(
                status="failed",
                output_data={"error": str(e)},
                confidence_score=0.0,
                warnings=[error_msg]
            )

            self.log_execution(
                state,
                status="failed",
                execution_time=execution_time,
                message=error_msg
            )

            return state
