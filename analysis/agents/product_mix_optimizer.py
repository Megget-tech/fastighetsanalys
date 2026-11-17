"""
Product Mix Optimizer Agent
Recommends optimal distribution of apartment types.
"""
import time
import json
from typing import Dict, Any
from .base_agent import BaseAgent
from graph.state import AnalysisState


class ProductMixOptimizerAgent(BaseAgent):
    """
    Product Mix Optimizer agent that recommends apartment type distribution.
    """

    def __init__(self):
        super().__init__(
            agent_id="product_mix_optimizer",
            agent_name="Product Mix Optimizer",
            temperature=0.2,
            max_tokens=4096,
        )

    def execute(self, state: AnalysisState) -> AnalysisState:
        """
        Execute product mix optimization.

        Args:
            state: Current workflow state

        Returns:
            Updated state with product mix recommendations
        """
        start_time = time.time()

        try:
            # Get all previous outputs (combining all insights)
            demographics_output = state.get("demographics_output", {})
            market_data_output = state.get("market_data_output", {})
            competition_output = state.get("competition_output", {})
            migration_output = state.get("migration_output", {})
            market_intelligence_output = state.get("market_intelligence_output", {})
            pricing_output = state.get("pricing_output", {})
            area_context = state.get("area_context", {})

            # Extract output data
            all_previous = {
                "demographics": demographics_output.get("output", {}) if demographics_output else {},
                "market_data": market_data_output.get("output", {}) if market_data_output else {},
                "competition": competition_output.get("output", {}) if competition_output else {},
                "migration": migration_output.get("output", {}) if migration_output else {},
                "market_intelligence": market_intelligence_output.get("output", {}) if market_intelligence_output else {},
            }

            pricing_data = pricing_output.get("output", {}) if pricing_output else {}

            # Get project params
            project_params = state.get("project_params", {})

            # Format prompt
            user_prompt = f"""
ALLA TIDIGARE ANALYSER:
{json.dumps(all_previous, indent=2, ensure_ascii=False)}

PRISSÄTTNINGSSTRATEGI:
{json.dumps(pricing_data, indent=2, ensure_ascii=False)}

PROJEKTPARAMETRAR:
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
            state["product_mix_output"] = output

            # Add warnings to state
            if output.get("warnings"):
                state["warnings"].extend([
                    f"Product Mix: {w}" for w in output["warnings"]
                ])

            # Log execution
            execution_time = time.time() - start_time
            self.log_execution(
                state,
                status="completed",
                execution_time=execution_time,
                message=f"Product mix optimization completed with confidence {output['confidence_score']:.2f}"
            )

            return state

        except Exception as e:
            execution_time = time.time() - start_time
            error_msg = f"Product mix optimization failed: {str(e)}"
            state["errors"].append(error_msg)

            # Create failed output
            state["product_mix_output"] = self.create_output(
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
