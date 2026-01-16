"""
Migration Analyst Agent
Analyzes migration patterns and defines target groups.
"""
import time
import json
from typing import Dict, Any
from .base_agent import BaseAgent
from graph.state import AnalysisState


class MigrationAnalystAgent(BaseAgent):
    """
    Migration Analyst agent that analyzes migration patterns and creates target group profiles.
    """

    def __init__(self):
        super().__init__(
            agent_id="migration_analyst",
            agent_name="Migration Pattern Analyst",
            temperature=0.2,
            max_tokens=4096,
        )

    def execute(self, state: AnalysisState) -> AnalysisState:
        """
        Execute migration analysis.

        Args:
            state: Current workflow state

        Returns:
            Updated state with migration analysis
        """
        start_time = time.time()

        try:
            # Extract relevant input data
            input_data = state.get("input_data", {})
            migration_data = input_data.get("migration_data", {})

            # Get previous agent outputs for context
            demographics_output = state.get("demographics_output", {})
            market_data_output = state.get("market_data_output", {})

            # Extract just the output data (not the full agent output wrapper)
            demographics_data = demographics_output.get("output", {}) if demographics_output else {}
            market_data = market_data_output.get("output", {}) if market_data_output else {}

            # Format prompt
            user_prompt = f"""
FLYTTDATA (senaste 5 åren):
{json.dumps(migration_data, indent=2, ensure_ascii=False)}

DEMOGRAFISK ANALYS (från tidigare agent):
{json.dumps(demographics_data, indent=2, ensure_ascii=False)}

MARKNADSDATA (för kontext):
{json.dumps(market_data, indent=2, ensure_ascii=False)}
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
            state["migration_output"] = output

            # Add warnings to state
            if output.get("warnings"):
                state["warnings"].extend([
                    f"Migration: {w}" for w in output["warnings"]
                ])

            # Log execution
            execution_time = time.time() - start_time
            self.log_execution(
                state,
                status="completed",
                execution_time=execution_time,
                message=f"Migration analysis completed with confidence {output['confidence_score']:.2f}"
            )

            return state

        except Exception as e:
            execution_time = time.time() - start_time
            error_msg = f"Migration analysis failed: {str(e)}"
            state["errors"].append(error_msg)

            # Create failed output
            state["migration_output"] = self.create_output(
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
