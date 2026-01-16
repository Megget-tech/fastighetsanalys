"""
Report Writer Agent
Creates comprehensive market analysis report from all analyses.
"""
import time
import json
from typing import Dict, Any
from .base_agent import BaseAgent
from graph.state import AnalysisState


class ReportWriterAgent(BaseAgent):
    """
    Report Writer agent that generates final comprehensive report.
    """

    def __init__(self):
        super().__init__(
            agent_id="report_writer",
            agent_name="Report Writer",
            temperature=0.3,
            max_tokens=16000,  # Very large token budget for comprehensive 12-section report
            timeout=600,  # 10 minutes timeout for comprehensive report generation
        )

    def execute(self, state: AnalysisState) -> AnalysisState:
        """
        Execute report generation in THREE separate calls to avoid token limits.

        Call 1: Generate full report part 1 (sections 1-6)
        Call 2: Generate full report part 2 (sections 7-12)
        Call 3: Generate executive report (5 sections)

        Args:
            state: Current workflow state

        Returns:
            Updated state with final report
        """
        start_time = time.time()

        try:
            # Collect ALL agent outputs for report
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
                "synthesis": state.get("synthesis_output", {}),
                "qa": state.get("qa_output", {})
            }

            # Get project params
            project_params = state.get("project_params", {})

            # ========== FIRST CALL: Generate full report part 1 (sections 1-6) ==========
            print("   📝 Generating full report part 1 (sections 1-6)...")

            full_report_part1_prompt = f"""
ALLA AGENTOUTPUTS:
{json.dumps(all_agent_outputs, indent=2, ensure_ascii=False)}

PROJEKTPARAMETRAR:
{json.dumps(project_params, indent=2, ensure_ascii=False)}

Skapa nu FÖRSTA DELEN av fullängdsrapporten med sektioner 1-6:
1. Sammanfattning
2. Beskrivning av området
3. Demografi och bostadsbestånd
4. Flyttströmsanalys
5. Målgruppsresonemang
6. Prisutveckling

RETURNERA ENDAST följande JSON-format:
{{
  "report_metadata": {{
    "project_name": "<projektnamn>",
    "location": "<plats>",
    "analysis_date": "<datum>",
    "report_version": "1.0",
    "authors": "Svensk Nyproduktion & Prognoscentret"
  }},
  "sections": [
    // Sektioner 1-6 här
  ],
  "summary": "<2-3 meningar om vad rapporten visar>",
  "key_recommendations": ["<top 3-5 rekommendationer>"]
}}
"""

            full_report_part1 = self.invoke_llm(
                system_prompt=self.prompt_template,
                user_prompt=full_report_part1_prompt,
                return_json=True
            )

            # ========== SECOND CALL: Generate full report part 2 (sections 7-12) ==========
            print("   📝 Generating full report part 2 (sections 7-12)...")

            full_report_part2_prompt = f"""
ALLA AGENTOUTPUTS:
{json.dumps(all_agent_outputs, indent=2, ensure_ascii=False)}

PROJEKTPARAMETRAR:
{json.dumps(project_params, indent=2, ensure_ascii=False)}

Skapa nu ANDRA DELEN av fullängdsrapporten med sektioner 7-12:
7. Successionsmarknaden
8. Nyproduktionsmarknaden
9. Mäklarperspektiv
10. Resonemang kring prisnivå och lägenhetsstorlekar
11. Rekommendationer prisnivå och lägenhetsstorlekar
12. Sammanfattning

RETURNERA ENDAST följande JSON-format:
{{
  "sections": [
    // Sektioner 7-12 här
  ]
}}
"""

            full_report_part2 = self.invoke_llm(
                system_prompt=self.prompt_template,
                user_prompt=full_report_part2_prompt,
                return_json=True
            )

            # Combine full report parts
            all_full_sections = full_report_part1.get("sections", []) + full_report_part2.get("sections", [])

            # Calculate word count and page estimate
            total_words = sum(len(s.get("content", "").split()) for s in all_full_sections)
            page_estimate = max(1, total_words // 300)  # ~300 words per page

            full_report_result = {
                "report_metadata": full_report_part1.get("report_metadata", {}),
                "sections": all_full_sections,
                "word_count": total_words,
                "page_estimate": page_estimate,
                "summary": full_report_part1.get("summary", ""),
                "key_recommendations": full_report_part1.get("key_recommendations", [])
            }

            # ========== THIRD CALL: Generate executive report ==========
            print("   📋 Generating executive report (5 sections)...")

            exec_report_prompt = f"""
ALLA AGENTOUTPUTS:
{json.dumps(all_agent_outputs, indent=2, ensure_ascii=False)}

PROJEKTPARAMETRAR:
{json.dumps(project_params, indent=2, ensure_ascii=False)}

Skapa nu en KONCENTRERAD/EXECUTIVE rapport för snabb läsning (~5-7 sidor).

KONCENTRERAD RAPPORT SKA INNEHÅLLA:
- Sektion 1: Sammanfattning (max 1 sida)
- Sektion 2: Kombinerad demografi/marknad (1-2 sidor) - destillera viktigaste från område, demografi och prisutveckling
- Sektion 3: Konkurrens & målgrupp (1 sida) - sammanfatta konkurrensläge och målgrupper
- Sektion 4: Rekommendationer (1-2 sidor) - konkreta priser och produktmix med tabeller
- Sektion 5: Strategisk sammanfattning (1 sida) - framåtblick och kritiska beslutspunkter

RETURNERA ENDAST följande JSON-format (ingen annan text):
{{
  "sections": [
    // 5 koncentrerade sektioner här
  ],
  "word_count": <antal ord>,
  "page_estimate": <uppskattad sidlängd (5-7)>
}}
"""

            exec_report_result = self.invoke_llm(
                system_prompt=self.prompt_template,
                user_prompt=exec_report_prompt,
                return_json=True
            )

            # ========== Combine results ==========
            combined_result = {
                "report_metadata": full_report_result.get("report_metadata", {}),
                "full_report": {
                    "sections": full_report_result.get("sections", []),
                    "word_count": full_report_result.get("word_count", 0),
                    "page_estimate": full_report_result.get("page_estimate", 0)
                },
                "executive_report": {
                    "sections": exec_report_result.get("sections", []),
                    "word_count": exec_report_result.get("word_count", 0),
                    "page_estimate": exec_report_result.get("page_estimate", 0)
                },
                "summary": full_report_result.get("summary", ""),
                "key_recommendations": full_report_result.get("key_recommendations", [])
            }

            # Create standardized output
            output = self.create_output(
                status="completed",
                output_data=combined_result,
                confidence_score=0.95,  # Report is final output
                warnings=[]
            )

            # Update state
            state["report_output"] = output

            # Mark end time
            from datetime import datetime
            state["end_time"] = datetime.utcnow().isoformat()

            # Log execution
            execution_time = time.time() - start_time
            full_words = combined_result["full_report"]["word_count"]
            exec_words = combined_result["executive_report"]["word_count"]
            self.log_execution(
                state,
                status="completed",
                execution_time=execution_time,
                message=f"Report generation completed (Full: {full_words} words, Executive: {exec_words} words)"
            )

            return state

        except Exception as e:
            execution_time = time.time() - start_time
            error_msg = f"Report generation failed: {str(e)}"
            state["errors"].append(error_msg)

            # Create failed output
            state["report_output"] = self.create_output(
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
