"""
Synthesis Analyst Agent
Creates executive summary and strategic synthesis from all analyses.
"""
import time
import json
from typing import Dict, Any
from .base_agent import BaseAgent
from graph.state import AnalysisState


class SynthesisAnalystAgent(BaseAgent):
    """
    Synthesis Analyst agent that integrates all analyses into coherent whole.
    """

    def __init__(self):
        super().__init__(
            agent_id="synthesis_analyst",
            agent_name="Synthesis Analyst",
            temperature=0.3,
            max_tokens=6000,
        )

    def execute(self, state: AnalysisState) -> AnalysisState:
        """
        Execute synthesis and create executive summary.

        Args:
            state: Current workflow state

        Returns:
            Updated state with synthesis output
        """
        start_time = time.time()

        try:
            # Collect ALL agent outputs for synthesis
            all_agent_outputs = {
                "demographics": state.get("demographics_output", {}),
                "market_data": state.get("market_data_output", {}),
                "competition": state.get("competition_output", {}),
                "migration": state.get("migration_output", {}),
                "market_intelligence": state.get("market_intelligence_output", {}),
                "pricing": state.get("pricing_output", {}),
                "product_mix": state.get("product_mix_output", {})
            }

            # Extract just the output data (not status/confidence)
            extracted_outputs = {}
            for agent_name, agent_output in all_agent_outputs.items():
                if agent_output and isinstance(agent_output, dict):
                    extracted_outputs[agent_name] = agent_output.get("output", {})
                else:
                    extracted_outputs[agent_name] = {}

            # Get project params
            project_params = state.get("project_params", {})

            # Format prompt
            user_prompt = f"""
ALLA AGENTANALYSER:

DEMOGRAPHICS:
{json.dumps(extracted_outputs.get("demographics", {}), indent=2, ensure_ascii=False)}

MARKET DATA:
{json.dumps(extracted_outputs.get("market_data", {}), indent=2, ensure_ascii=False)}

COMPETITION:
{json.dumps(extracted_outputs.get("competition", {}), indent=2, ensure_ascii=False)}

MIGRATION & TARGET GROUPS:
{json.dumps(extracted_outputs.get("migration", {}), indent=2, ensure_ascii=False)}

MARKET INTELLIGENCE:
{json.dumps(extracted_outputs.get("market_intelligence", {}), indent=2, ensure_ascii=False)}

PRICING STRATEGY:
{json.dumps(extracted_outputs.get("pricing", {}), indent=2, ensure_ascii=False)}

PRODUCT MIX:
{json.dumps(extracted_outputs.get("product_mix", {}), indent=2, ensure_ascii=False)}

PROJEKTPARAMETRAR:
{json.dumps(project_params, indent=2, ensure_ascii=False)}
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
                confidence_score=result.get("confidence_assessment", {}).get("overall_confidence_numeric", 0.85),
                warnings=result.get("confidence_assessment", {}).get("key_uncertainties", [])
            )

            # Update state
            state["synthesis_output"] = output

            # Add warnings to state if any
            if output.get("warnings"):
                state["warnings"].extend([
                    f"Synthesis: {w}" for w in output["warnings"]
                ])

            # Log execution
            execution_time = time.time() - start_time
            self.log_execution(
                state,
                status="completed",
                execution_time=execution_time,
                message=f"Synthesis completed with confidence {output['confidence_score']:.2f}"
            )

            return state

        except Exception as e:
            execution_time = time.time() - start_time
            error_msg = f"Synthesis failed: {str(e)}"
            state["errors"].append(error_msg)

            # Create failed output
            state["synthesis_output"] = self.create_output(
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
