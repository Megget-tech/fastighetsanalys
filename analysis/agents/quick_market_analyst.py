"""
Quick Market Analyst Agent
Fast analysis of target market, housing stock, and pricing for Quick Analysis mode.
Updated to use new data export format (metrics + booli_data).
"""
import time
import json
from typing import Dict, Any
from .base_agent import BaseAgent
from graph.state import AnalysisState


class QuickMarketAnalystAgent(BaseAgent):
    """
    Quick Market Analyst for rapid market assessment.
    Answers questions 1-3:
    1. Vem är målgruppen? (demographics from metrics)
    2. Hur ser bostadsbeståndet ut idag? (housing data from metrics)
    3. Vad säger försäljningsstatistiken? (from booli_data)
    """

    def __init__(self):
        super().__init__(
            agent_id="quick_market_analyst",
            agent_name="Quick Market Analyst",
            temperature=0.1,  # Low for consistency
            max_tokens=3072,
        )

    def execute(self, state: AnalysisState) -> AnalysisState:
        """
        Execute quick market analysis.

        Args:
            state: Current workflow state

        Returns:
            Updated state with quick market analysis
        """
        start_time = time.time()

        try:
            # Extract relevant input data from new format
            input_data = state.get("input_data", {})
            project_params = state.get("project_params", {})

            # Get metrics data (demographic, housing, economic)
            metrics = input_data.get("metrics", {})

            # Get booli sales data
            booli_data = input_data.get("booli_data", {})
            sales_data = booli_data.get("sales", [])
            sales_summary = booli_data.get("summary", {})

            # Get metadata
            metadata = input_data.get("metadata", {})

            # Extract specific metrics sections
            population_data = metrics.get("population", {})
            household_data = metrics.get("household", {})
            economic_standard = metrics.get("economic_standard", {})
            income_data = metrics.get("income", {})
            education_data = metrics.get("education", {})
            housing_type = metrics.get("housing_type", {})
            tenure_form = metrics.get("tenure_form", {})
            building_age = metrics.get("building_age", {})

            # Format prompt with new data structure
            user_prompt = f"""
PROJEKTINFORMATION:
{json.dumps(project_params, indent=2, ensure_ascii=False)}

METADATA:
- Kommun: {metadata.get('kommun', 'Ej angiven')}
- Fastighetsbeteckning: {metadata.get('fastighetsbeteckning', 'Ej angiven')}

DEMOGRAFISK DATA (metrics.population):
{json.dumps(population_data, indent=2, ensure_ascii=False)}

HUSHÅLLSDATA (metrics.household):
{json.dumps(household_data, indent=2, ensure_ascii=False)}

EKONOMISK STANDARD (metrics.economic_standard):
{json.dumps(economic_standard, indent=2, ensure_ascii=False)}

INKOMSTDATA (metrics.income):
{json.dumps(income_data, indent=2, ensure_ascii=False)}

UTBILDNINGSNIVÅ (metrics.education):
{json.dumps(education_data, indent=2, ensure_ascii=False)}

BOSTADSTYPER (metrics.housing_type):
{json.dumps(housing_type, indent=2, ensure_ascii=False)}

UPPLÅTELSEFORMER (metrics.tenure_form):
{json.dumps(tenure_form, indent=2, ensure_ascii=False)}

BYGGNADSÅLDER (metrics.building_age):
{json.dumps(building_age, indent=2, ensure_ascii=False)}

FÖRSÄLJNINGSDATA (booli_data.sales) - {len(sales_data)} transaktioner:
{json.dumps(sales_data[:20], indent=2, ensure_ascii=False)}
{"..." if len(sales_data) > 20 else ""}

FÖRSÄLJNINGSSAMMANFATTNING (booli_data.summary):
{json.dumps(sales_summary, indent=2, ensure_ascii=False)}
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
            state["quick_market_output"] = output

            # Add warnings to state
            if output.get("warnings"):
                state["warnings"].extend([
                    f"Quick Market: {w}" for w in output["warnings"]
                ])

            # Log execution
            execution_time = time.time() - start_time
            self.log_execution(
                state,
                status="completed",
                execution_time=execution_time,
                message=f"Quick market analysis completed in {execution_time:.1f}s"
            )

            print(f"✓ Quick Market Analyst completed in {execution_time:.1f}s")

        except Exception as e:
            execution_time = time.time() - start_time
            error_msg = f"Quick Market analysis failed: {str(e)}"

            # Create error output
            output = self.create_output(
                status="failed",
                output_data={"error": str(e)},
                confidence_score=0.0,
                warnings=[error_msg]
            )

            state["quick_market_output"] = output
            state["errors"].append(error_msg)

            self.log_execution(
                state,
                status="failed",
                execution_time=execution_time,
                message=error_msg
            )

            print(f"✗ Quick Market Analyst failed: {str(e)}")

        return state
