"""
Orchestrator Agent - System Coordinator
Validates input data and coordinates workflow between agents.
"""
import time
import json
from typing import Dict, Any
from .base_agent import BaseAgent
from graph.state import AnalysisState


class OrchestratorAgent(BaseAgent):
    """
    Orchestrator agent that validates input data and coordinates the workflow.
    """

    def __init__(self):
        super().__init__(
            agent_id="orchestrator",
            agent_name="Project Coordinator",
            temperature=0.1,  # Low temperature for consistent validation
            max_tokens=2048,
        )

        # Define required data categories and their fields
        self.required_categories = {
            "demographic_data": [
                "population_by_age",
                "household_size_distribution",
                "economic_standard",
                "education_level",
                "car_ownership"
            ],
            "housing_stock_data": [
                "total_units",
                "units_by_size",
                "units_by_type",
                "construction_year",
                "ownership_type"
            ],
            "sales_data": [
                "transaction_date",
                "price",
                "size_sqm",
                "rooms",
                "monthly_fee",
                "location_coordinates"
            ],
            "new_construction_data": [
                "project_name",
                "developer",
                "total_units",
                "unit_distribution",
                "pricing",
                "sales_status",
                "start_date"
            ]
        }

    def execute(self, state: AnalysisState) -> AnalysisState:
        """
        Execute orchestrator validation.

        Args:
            state: Current workflow state

        Returns:
            Updated state with validation results
        """
        start_time = time.time()

        try:
            # Extract input data
            input_data = state.get("input_data", {})
            project_params = state.get("project_params", {})

            # Create data summary for prompt
            input_data_summary = self._create_data_summary(input_data)

            # Format prompt
            user_prompt = f"""
PROJECT PARAMETERS:
{json.dumps(project_params, indent=2, ensure_ascii=False)}

INPUT DATA CATEGORIES:
{input_data_summary}

FULL INPUT DATA (for detailed validation):
{json.dumps(input_data, indent=2, ensure_ascii=False)}
"""

            # Load system prompt from template
            system_prompt = self.prompt_template

            # Invoke LLM
            result = self.invoke_llm(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                return_json=True
            )

            # Update state
            state["orchestrator_validated"] = result.get("validation_result") == "PASSED"
            state["data_quality_score"] = result.get("data_quality_score", 0.0)

            # Add warnings and errors
            if result.get("warnings"):
                state["warnings"].extend(result["warnings"])

            if result.get("quality_issues"):
                critical_issues = [
                    issue for issue in result["quality_issues"]
                    if issue.get("severity") in ["critical", "high"]
                ]
                if critical_issues:
                    state["errors"].extend([issue["issue"] for issue in critical_issues])

            # Log execution
            execution_time = time.time() - start_time
            self.log_execution(
                state,
                status="completed" if state["orchestrator_validated"] else "failed",
                execution_time=execution_time,
                message=result.get("recommendation", "Validation completed")
            )

            # Move to next phase if validated
            if state["orchestrator_validated"]:
                state["current_phase"] = 2

            return state

        except Exception as e:
            execution_time = time.time() - start_time
            error_msg = f"Orchestrator validation failed: {str(e)}"
            state["errors"].append(error_msg)
            state["orchestrator_validated"] = False

            self.log_execution(
                state,
                status="failed",
                execution_time=execution_time,
                message=error_msg
            )

            return state

    def _create_data_summary(self, input_data: Dict[str, Any]) -> str:
        """
        Create a summary of available data categories.

        Args:
            input_data: Input data dictionary

        Returns:
            Formatted summary string
        """
        summary_parts = []

        for category in self.required_categories.keys():
            if category in input_data:
                data = input_data[category]
                if isinstance(data, dict):
                    fields = list(data.keys())
                elif isinstance(data, list):
                    fields = [f"Array with {len(data)} items"]
                else:
                    fields = [f"Type: {type(data).__name__}"]

                summary_parts.append(f"  ✓ {category}: {', '.join(fields[:5])}" +
                                    ("..." if len(fields) > 5 else ""))
            else:
                summary_parts.append(f"  ✗ {category}: MISSING")

        return "\n".join(summary_parts)
