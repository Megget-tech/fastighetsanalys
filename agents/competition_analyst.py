"""
Competition Analyst Agent
Analyzes competing new construction projects and market dynamics.
"""
import time
import json
from typing import Dict, Any
from .base_agent import BaseAgent
from graph.state import AnalysisState


class CompetitionAnalystAgent(BaseAgent):
    """
    Competition Analyst agent that analyzes new construction competition.
    """

    def __init__(self):
        super().__init__(
            agent_id="competition_analyst",
            agent_name="Competition Intelligence Analyst",
            temperature=0.2,
            max_tokens=4096,
        )

    def execute(self, state: AnalysisState) -> AnalysisState:
        """
        Execute competition analysis.

        Args:
            state: Current workflow state

        Returns:
            Updated state with competition analysis
        """
        start_time = time.time()

        try:
            # Extract relevant input data
            input_data = state.get("input_data", {})

            new_construction_data = input_data.get("new_construction_data", [])

            # Check if there's pipeline data
            pipeline_data = input_data.get("pipeline_projects", [])

            # Format prompt
            user_prompt = f"""
NYPRODUKTIONSPROJEKT:
{json.dumps(new_construction_data, indent=2, ensure_ascii=False)}

PIPELINE-PROJEKT (planerade):
{json.dumps(pipeline_data, indent=2, ensure_ascii=False)}
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
                confidence_score=result.get("confidence_score", 0.80),
                warnings=result.get("warnings", [])
            )

            # Update state
            state["competition_output"] = output

            # Add warnings to state
            if output.get("warnings"):
                state["warnings"].extend([
                    f"Competition: {w}" for w in output["warnings"]
                ])

            # Log execution
            execution_time = time.time() - start_time
            self.log_execution(
                state,
                status="completed",
                execution_time=execution_time,
                message=f"Competition analysis completed with confidence {output['confidence_score']:.2f}"
            )

            return state

        except Exception as e:
            execution_time = time.time() - start_time
            error_msg = f"Competition analysis failed: {str(e)}"
            state["errors"].append(error_msg)

            # Create failed output
            state["competition_output"] = self.create_output(
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
