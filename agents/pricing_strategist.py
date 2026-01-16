"""
Pricing Strategist Agent
Recommends optimal pricing strategy based on all market analyses.
"""
import time
import json
from typing import Dict, Any
from .base_agent import BaseAgent
from graph.state import AnalysisState


class PricingStrategistAgent(BaseAgent):
    """
    Pricing Strategist agent that recommends pricing levels and differentiation.
    """

    def __init__(self):
        super().__init__(
            agent_id="pricing_strategist",
            agent_name="Pricing Strategist",
            temperature=0.2,
            max_tokens=4096,
        )

    def execute(self, state: AnalysisState) -> AnalysisState:
        """
        Execute pricing strategy analysis.

        Args:
            state: Current workflow state

        Returns:
            Updated state with pricing recommendations
        """
        start_time = time.time()

        try:
            # Get all previous outputs
            market_data_output = state.get("market_data_output", {})
            competition_output = state.get("competition_output", {})
            migration_output = state.get("migration_output", {})
            market_intelligence_output = state.get("market_intelligence_output", {})
            area_context = state.get("area_context", {})

            # Extract output data
            market_data = market_data_output.get("output", {}) if market_data_output else {}
            competition_data = competition_output.get("output", {}) if competition_output else {}
            migration_data = migration_output.get("output", {}) if migration_output else {}
            market_intelligence_data = market_intelligence_output.get("output", {}) if market_intelligence_output else {}

            # Get project params
            project_params = state.get("project_params", {})

            # Format prompt
            user_prompt = f"""
MARKNADSDATA:
{json.dumps(market_data, indent=2, ensure_ascii=False)}

KONKURRENSANALYS:
{json.dumps(competition_data, indent=2, ensure_ascii=False)}

MÅLGRUPPSANALYS:
{json.dumps(migration_data, indent=2, ensure_ascii=False)}

MARKNADSINSIKTER:
{json.dumps(market_intelligence_data, indent=2, ensure_ascii=False)}

PROJEKTSPECIFIKATIONER:
{json.dumps(project_params, indent=2, ensure_ascii=False)}

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
                confidence_score=result.get("confidence_score", 0.85),
                warnings=result.get("warnings", [])
            )

            # Update state
            state["pricing_output"] = output

            # Add warnings to state
            if output.get("warnings"):
                state["warnings"].extend([
                    f"Pricing: {w}" for w in output["warnings"]
                ])

            # Log execution
            execution_time = time.time() - start_time
            self.log_execution(
                state,
                status="completed",
                execution_time=execution_time,
                message=f"Pricing strategy completed with confidence {output['confidence_score']:.2f}"
            )

            return state

        except Exception as e:
            execution_time = time.time() - start_time
            error_msg = f"Pricing strategy failed: {str(e)}"
            state["errors"].append(error_msg)

            # Create failed output
            state["pricing_output"] = self.create_output(
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
