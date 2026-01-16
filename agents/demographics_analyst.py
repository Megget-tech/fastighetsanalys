"""
Demographics Analyst Agent
Analyzes population structure and demographic patterns.
"""
import time
import json
from typing import Dict, Any
from .base_agent import BaseAgent
from graph.state import AnalysisState


class DemographicsAnalystAgent(BaseAgent):
    """
    Demographics Analyst agent that analyzes population and household data.
    """

    def __init__(self):
        super().__init__(
            agent_id="demographics_analyst",
            agent_name="Demographics Analyst",
            temperature=0.2,
            max_tokens=4096,
        )

    def execute(self, state: AnalysisState) -> AnalysisState:
        """
        Execute demographics analysis.

        Args:
            state: Current workflow state

        Returns:
            Updated state with demographics analysis
        """
        start_time = time.time()

        try:
            # Extract relevant input data
            input_data = state.get("input_data", {})
            demographic_data = input_data.get("demographic_data", {})
            project_params = state.get("project_params", {})

            # Get DeSO area info
            deso_area = {
                "code": project_params.get("area_deso_code", ""),
                "name": project_params.get("location", ""),
                "total_population": demographic_data.get("total_population", 0),
                "total_households": demographic_data.get("total_households", 0),
            }

            # Get comparison data (municipal level)
            comparison_data = input_data.get("comparison_data", {}).get("municipal", {})

            # Format prompt
            user_prompt = f"""
DESO OMRÅDE:
{json.dumps(deso_area, indent=2, ensure_ascii=False)}

DEMOGRAFISK DATA:
{json.dumps(demographic_data, indent=2, ensure_ascii=False)}

JÄMFÖRELSEDATA (KOMMUN):
{json.dumps(comparison_data, indent=2, ensure_ascii=False)}
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
            state["demographics_output"] = output

            # Add warnings to state
            if output.get("warnings"):
                state["warnings"].extend([
                    f"Demographics: {w}" for w in output["warnings"]
                ])

            # Log execution
            execution_time = time.time() - start_time
            self.log_execution(
                state,
                status="completed",
                execution_time=execution_time,
                message=f"Demographics analysis completed with confidence {output['confidence_score']:.2f}"
            )

            return state

        except Exception as e:
            execution_time = time.time() - start_time
            error_msg = f"Demographics analysis failed: {str(e)}"
            state["errors"].append(error_msg)

            # Create failed output
            state["demographics_output"] = self.create_output(
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

    def _calculate_demographic_metrics(
        self,
        area_data: Dict[str, Any],
        municipal_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Calculate demographic metrics and comparisons.
        This is a helper method for future enhancements.

        Args:
            area_data: Area demographic data
            municipal_data: Municipal demographic data

        Returns:
            Calculated metrics
        """
        # This could be expanded to pre-calculate metrics
        # before sending to LLM, reducing token usage
        metrics = {
            "calculated": True,
            # Add metric calculations here
        }
        return metrics
