"""
Quality Controller Agent
Performs comprehensive quality assurance and can trigger review loops.
"""
import time
import json
from typing import Dict, Any
from .base_agent import BaseAgent
from graph.state import AnalysisState


class QualityControllerAgent(BaseAgent):
    """
    Quality Controller agent that validates all analyses and can request revisions.
    """

    def __init__(self):
        super().__init__(
            agent_id="quality_controller",
            agent_name="Quality Controller",
            temperature=0.1,  # Very low temperature for consistent quality checks
            max_tokens=6000,
        )

    def execute(self, state: AnalysisState) -> AnalysisState:
        """
        Execute quality control and validation.

        Args:
            state: Current workflow state

        Returns:
            Updated state with QA results and potential review triggers
        """
        start_time = time.time()

        try:
            # Collect ALL agent outputs for review
            all_agent_outputs = {
                "orchestrator": {
                    "validated": state.get("orchestrator_validated", False),
                    "quality_score": state.get("data_quality_score", 0.0)
                },
                "demographics": state.get("demographics_output", {}),
                "market_data": state.get("market_data_output", {}),
                "competition": state.get("competition_output", {}),
                "migration": state.get("migration_output", {}),
                "market_intelligence": state.get("market_intelligence_output", {}),
                "pricing": state.get("pricing_output", {}),
                "product_mix": state.get("product_mix_output", {}),
                "synthesis": state.get("synthesis_output", {})
            }

            # Also include input data and project params for validation
            input_data = state.get("input_data", {})
            project_params = state.get("project_params", {})

            # Format comprehensive prompt
            user_prompt = f"""
INPUT DATA (för verifiering av dataexakthet):
{json.dumps(input_data, indent=2, ensure_ascii=False)}

PROJEKTPARAMETRAR:
{json.dumps(project_params, indent=2, ensure_ascii=False)}

ALLA AGENTOUTPUTS ATT GRANSKA:
{json.dumps(all_agent_outputs, indent=2, ensure_ascii=False)}

TIDIGARE REVIEW LOOPS:
Review loop count: {state.get('review_loop_count', 0)}
Max allowed loops: 2

TIDIGARE ERRORS OCH WARNINGS:
Errors: {json.dumps(state.get('errors', []), ensure_ascii=False)}
Warnings: {json.dumps(state.get('warnings', []), ensure_ascii=False)}
"""

            # Load system prompt from template
            system_prompt = self.prompt_template

            # Invoke LLM
            result = self.invoke_llm(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                return_json=True
            )

            # Extract key decision
            overall_decision = result.get("overall_decision", "REJECTED_MAJOR_REVISION_NEEDED")
            overall_quality_score = result.get("overall_quality_score", 0.0)

            # Create standardized output
            output = self.create_output(
                status="completed",
                output_data=result,
                confidence_score=overall_quality_score,
                warnings=[w.get("description", "") for w in result.get("warnings", [])]
            )

            # Update state with QA results
            state["qa_output"] = output
            state["qa_decision"] = overall_decision
            state["qa_quality_score"] = overall_quality_score

            # If there are critical issues, add to errors
            critical_issues = [
                issue for issue in result.get("critical_issues", [])
                if issue.get("severity") == "critical"
            ]
            if critical_issues:
                for issue in critical_issues:
                    state["errors"].append(
                        f"QA CRITICAL: {issue.get('description', 'Unknown issue')}"
                    )

            # Add warnings
            if output.get("warnings"):
                state["warnings"].extend([
                    f"QA: {w}" for w in output["warnings"]
                ])

            # Determine if agents need revision
            agents_requiring_revision = result.get("agents_requiring_revision", [])
            if agents_requiring_revision and overall_decision.startswith("REJECTED"):
                state["agents_to_rerun"] = [
                    agent.get("agent_id") for agent in agents_requiring_revision
                ]
                # Increment review loop count when rejecting
                state["review_loop_count"] = state.get("review_loop_count", 0) + 1
            else:
                state["agents_to_rerun"] = []

            # Log execution
            execution_time = time.time() - start_time
            self.log_execution(
                state,
                status="completed",
                execution_time=execution_time,
                message=f"Quality control completed: {overall_decision} (score: {overall_quality_score:.2f})"
            )

            return state

        except Exception as e:
            execution_time = time.time() - start_time
            error_msg = f"Quality control failed: {str(e)}"
            state["errors"].append(error_msg)

            # Create failed output - default to rejection for safety
            state["qa_output"] = self.create_output(
                status="failed",
                output_data={"error": str(e)},
                confidence_score=0.0,
                warnings=[error_msg]
            )
            state["qa_decision"] = "REJECTED_MAJOR_REVISION_NEEDED"
            state["qa_quality_score"] = 0.0
            state["agents_to_rerun"] = []

            self.log_execution(
                state,
                status="failed",
                execution_time=execution_time,
                message=error_msg
            )

            return state
