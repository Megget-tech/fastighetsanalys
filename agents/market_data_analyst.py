"""
Market Data Analyst Agent
Analyzes housing stock, price development, and sales data.
"""
import time
import json
from typing import Dict, Any
from .base_agent import BaseAgent
from graph.state import AnalysisState


class MarketDataAnalystAgent(BaseAgent):
    """
    Market Data Analyst agent that analyzes housing stock and price trends.
    """

    def __init__(self):
        super().__init__(
            agent_id="market_data_analyst",
            agent_name="Market Data Analyst",
            temperature=0.2,
            max_tokens=4096,
        )

    def execute(self, state: AnalysisState) -> AnalysisState:
        """
        Execute market data analysis.

        Args:
            state: Current workflow state

        Returns:
            Updated state with market data analysis
        """
        start_time = time.time()

        try:
            # Extract relevant input data
            input_data = state.get("input_data", {})

            housing_stock_data = input_data.get("housing_stock_data", {})
            sales_data = input_data.get("sales_data", [])
            price_history = input_data.get("price_history", {})
            geographic_data = input_data.get("geographic_data", {})

            # Format prompt
            user_prompt = f"""
BOSTADSBESTÅND:
{json.dumps(housing_stock_data, indent=2, ensure_ascii=False)}

FÖRSÄLJNINGSDATA (senaste 12 mån):
{json.dumps(sales_data, indent=2, ensure_ascii=False)}

PRISHISTORIK:
{json.dumps(price_history, indent=2, ensure_ascii=False)}

GEOGRAFISK DATA:
{json.dumps(geographic_data, indent=2, ensure_ascii=False)}
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
            state["market_data_output"] = output

            # Add warnings to state
            if output.get("warnings"):
                state["warnings"].extend([
                    f"Market Data: {w}" for w in output["warnings"]
                ])

            # Log execution
            execution_time = time.time() - start_time
            self.log_execution(
                state,
                status="completed",
                execution_time=execution_time,
                message=f"Market data analysis completed with confidence {output['confidence_score']:.2f}"
            )

            return state

        except Exception as e:
            execution_time = time.time() - start_time
            error_msg = f"Market data analysis failed: {str(e)}"
            state["errors"].append(error_msg)

            # Create failed output
            state["market_data_output"] = self.create_output(
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
