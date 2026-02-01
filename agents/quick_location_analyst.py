"""
Quick Location Analyst Agent
Fast analysis of location, amenities, and competition using area context data.
Updated to use new data export format.
"""
import time
import json
from typing import Dict, Any
from .base_agent import BaseAgent
from graph.state import AnalysisState


class QuickLocationAnalystAgent(BaseAgent):
    """
    Quick Location Analyst for rapid location assessment.
    Answers questions:
    1. Hur ser konkurrensen ut? (from new_construction if available)
    2. Hur är läget och områdets karaktär? (from metrics + area_context)

    This agent uses area_context data when available.
    """

    def __init__(self):
        super().__init__(
            agent_id="quick_location_analyst",
            agent_name="Quick Location Analyst",
            temperature=0.1,  # Low for consistency
            max_tokens=3072,
        )

    def execute(self, state: AnalysisState) -> AnalysisState:
        """
        Execute quick location analysis.

        Args:
            state: Current workflow state

        Returns:
            Updated state with quick location analysis
        """
        start_time = time.time()

        try:
            # Extract relevant input data from new format
            input_data = state.get("input_data", {})
            project_params = state.get("project_params", {})
            area_context = state.get("area_context")

            # Get metadata
            metadata = input_data.get("metadata", {})

            # Get metrics for area characteristics
            metrics = input_data.get("metrics", {})
            housing_type = metrics.get("housing_type", {})
            building_age = metrics.get("building_age", {})
            tenure_form = metrics.get("tenure_form", {})

            # Get competition data (optional)
            new_construction = input_data.get("new_construction", [])

            # Check if area context is available
            area_context_available = area_context is not None and "error" not in area_context

            # Check if new construction data is available
            new_construction_available = len(new_construction) > 0 if new_construction else False

            # Format prompt with new data structure
            user_prompt = f"""
PROJEKTINFORMATION:
{json.dumps(project_params, indent=2, ensure_ascii=False)}

METADATA:
- Kommun: {metadata.get('kommun', 'Ej angiven')}
- Fastighetsbeteckning: {metadata.get('fastighetsbeteckning', 'Ej angiven')}
- Koordinater: {json.dumps(metadata.get('coordinates', {}), ensure_ascii=False)}

BOSTADSTYPER I OMRÅDET (metrics.housing_type):
{json.dumps(housing_type, indent=2, ensure_ascii=False)}

UPPLÅTELSEFORMER (metrics.tenure_form):
{json.dumps(tenure_form, indent=2, ensure_ascii=False)}

BYGGNADSÅLDER (metrics.building_age):
{json.dumps(building_age, indent=2, ensure_ascii=False)}

AREA CONTEXT DATA (automatiskt insamlad):
Tillgänglig: {'JA' if area_context_available else 'NEJ'}
{json.dumps(area_context, indent=2, ensure_ascii=False) if area_context_available else 'Area context ej tillgänglig - begränsad lägesbedömning möjlig'}

KONKURRERANDE NYPRODUKTION:
Tillgänglig: {'JA' if new_construction_available else 'NEJ'}
{json.dumps(new_construction, indent=2, ensure_ascii=False) if new_construction_available else 'Nyproduktionsdata ej tillgänglig - konkurrensanalys ej möjlig'}
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
                confidence_score=result.get("confidence_score", 0.80),
                warnings=result.get("warnings", [])
            )

            # Update state
            state["quick_location_output"] = output

            # Add warnings to state
            if output.get("warnings"):
                state["warnings"].extend([
                    f"Quick Location: {w}" for w in output["warnings"]
                ])

            # Log execution
            execution_time = time.time() - start_time
            self.log_execution(
                state,
                status="completed",
                execution_time=execution_time,
                message=f"Quick location analysis completed in {execution_time:.1f}s"
            )

            print(f"✓ Quick Location Analyst completed in {execution_time:.1f}s")

        except Exception as e:
            execution_time = time.time() - start_time
            error_msg = f"Quick Location analysis failed: {str(e)}"

            # Create error output
            output = self.create_output(
                status="failed",
                output_data={"error": str(e)},
                confidence_score=0.0,
                warnings=[error_msg]
            )

            state["quick_location_output"] = output
            state["errors"].append(error_msg)

            self.log_execution(
                state,
                status="failed",
                execution_time=execution_time,
                message=error_msg
            )

            print(f"✗ Quick Location Analyst failed: {str(e)}")

        return state
