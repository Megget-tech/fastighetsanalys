"""
Quick Synthesizer Agent
Synthesizes insights from quick market and location analysis into go/no-go recommendation.
Updated to include pricing and product mix guidance.
"""
import time
import json
from typing import Dict, Any
from .base_agent import BaseAgent
from graph.state import AnalysisState


class QuickSynthesizerAgent(BaseAgent):
    """
    Quick Synthesizer for rapid go/no-go decision.
    Provides:
    - GO/NO-GO/MAYBE recommendation
    - Key insights synthesis
    - Preliminary pricing guidance
    - Preliminary product mix guidance
    - Next steps
    """

    def __init__(self):
        super().__init__(
            agent_id="quick_synthesizer",
            agent_name="Quick Synthesizer",
            temperature=0.4,
            max_tokens=3072,
        )

    def execute(self, state: AnalysisState) -> AnalysisState:
        """
        Execute quick synthesis and generate go/no-go recommendation.

        Args:
            state: Current workflow state

        Returns:
            Updated state with quick synthesis
        """
        start_time = time.time()

        try:
            # Extract inputs from previous agents
            project_params = state.get("project_params", {})
            quick_market_output = state.get("quick_market_output", {})
            quick_location_output = state.get("quick_location_output", {})

            # Get input data for context
            input_data = state.get("input_data", {})
            metadata = input_data.get("metadata", {})

            # Get area context for summary
            area_context = state.get("area_context", {})

            # Format prompt
            user_prompt = f"""
PROJEKTINFORMATION:
{json.dumps(project_params, indent=2, ensure_ascii=False)}

METADATA:
- Kommun: {metadata.get('kommun', 'Ej angiven')}
- Fastighetsbeteckning: {metadata.get('fastighetsbeteckning', 'Ej angiven')}

QUICK MARKET ANALYSIS OUTPUT:
{json.dumps(quick_market_output.get('output', {}), indent=2, ensure_ascii=False)}

QUICK LOCATION ANALYSIS OUTPUT:
{json.dumps(quick_location_output.get('output', {}), indent=2, ensure_ascii=False)}

AREA CONTEXT SAMMANFATTNING:
{area_context.get('summary', 'Ej tillgänglig') if area_context else 'Ej tillgänglig'}
"""

            # Load system prompt
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
            state["quick_synthesis_output"] = output

            # Add warnings to state
            if output.get("warnings"):
                state["warnings"].extend([
                    f"Quick Synthesis: {w}" for w in output["warnings"]
                ])

            # Log execution
            execution_time = time.time() - start_time
            self.log_execution(
                state,
                status="completed",
                execution_time=execution_time,
                message=f"Quick synthesis completed in {execution_time:.1f}s"
            )

            print(f"✓ Quick Synthesizer completed in {execution_time:.1f}s")

            # Print go/no-go decision
            decision = result.get("go_no_go_decision", {})
            print(f"\n{'='*60}")
            print(f"GO/NO-GO DECISION: {decision.get('recommendation', 'UNKNOWN').upper()}")
            print(f"Confidence: {decision.get('confidence', 'unknown')}")
            print(f"{'='*60}\n")

        except Exception as e:
            execution_time = time.time() - start_time
            error_msg = f"Quick Synthesis failed: {str(e)}"

            # Create error output
            output = self.create_output(
                status="failed",
                output_data={"error": str(e)},
                confidence_score=0.0,
                warnings=[error_msg]
            )

            state["quick_synthesis_output"] = output
            state["errors"].append(error_msg)

            self.log_execution(
                state,
                status="failed",
                execution_time=execution_time,
                message=error_msg
            )

            print(f"✗ Quick Synthesizer failed: {str(e)}")

        return state
