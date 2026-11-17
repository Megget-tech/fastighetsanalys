#!/usr/bin/env python3
"""
CLI endpoint för fastighetanalys.
Kan anropas från Node/Express backend för att köra analyser.

Usage:
    python analyze_cli.py --job-id <uuid> --report-type <quick|full>

Förväntar:
    - Input finns i: /jobs/{job_id}/input.json

Skapar:
    - Status: /jobs/{job_id}/status.json (uppdateras kontinuerligt)
    - Rapport: /jobs/{job_id}/report.pdf
    - Data: /jobs/{job_id}/data.json
"""

import argparse
import json
import os
import sys
import traceback
from pathlib import Path
from datetime import datetime

# Import av workflow
from graph.workflow import run_quick_analysis, run_full_analysis
from utils.area_context_collector import AreaContextCollector


class JobManager:
    """Hanterar job-status och fil-operationer."""

    def __init__(self, job_id: str, jobs_dir: str = "/var/app/jobs"):
        self.job_id = job_id
        self.jobs_dir = Path(jobs_dir)
        self.job_dir = self.jobs_dir / job_id

        # Skapa job-mapp om den inte finns
        self.job_dir.mkdir(parents=True, exist_ok=True)

        self.input_file = self.job_dir / "input.json"
        self.status_file = self.job_dir / "status.json"
        self.report_file = self.job_dir / "report.pdf"
        self.data_file = self.job_dir / "data.json"

    def read_input(self) -> dict:
        """Läs input JSON."""
        if not self.input_file.exists():
            raise FileNotFoundError(f"Input file not found: {self.input_file}")

        with open(self.input_file, 'r', encoding='utf-8') as f:
            return json.load(f)

    def update_status(self, status: str, progress: int = 0, message: str = "", error: str = None):
        """Uppdatera job status."""
        status_data = {
            "job_id": self.job_id,
            "status": status,  # processing, completed, failed
            "progress": progress,  # 0-100
            "message": message,
            "updated_at": datetime.now().isoformat(),
            "error": error
        }

        with open(self.status_file, 'w', encoding='utf-8') as f:
            json.dump(status_data, f, indent=2, ensure_ascii=False)

        print(f"[{self.job_id}] {status.upper()}: {message} ({progress}%)")

    def save_report(self, pdf_path: str):
        """Kopiera rapport till job-mappen."""
        import shutil
        shutil.copy(pdf_path, self.report_file)

    def save_data(self, data: dict):
        """Spara strukturerad data."""
        with open(self.data_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)


def map_input_data(input_json: dict) -> dict:
    """
    Mappar från användarens JSON-format till detta programs förväntade format.

    Anpassar data från ditt andra program (CSV → JSON) till formatet som
    LangGraph-workflow förväntar sig.
    """

    # Extrahera grundläggande info
    kommun = input_json.get("kommun", "")
    deso_codes = input_json.get("deso_codes", [])

    # Mappa demografi-data
    demographics = {}
    if "befolkning" in input_json:
        bef = input_json["befolkning"]
        demographics["total_population"] = bef.get("total_befolkning", 0)
        demographics["growth_rate"] = bef.get("tillväxttakt", 0)

    if "åldersfördelning" in input_json:
        demographics["age_distribution"] = input_json["åldersfördelning"]

    if "inkomst" in input_json:
        ink = input_json["inkomst"]
        demographics["median_income"] = ink.get("medianinkomst_område", 0)
        demographics["mean_income"] = ink.get("medelinkomst_område", 0)

    if "utbildning" in input_json:
        demographics["education"] = input_json["utbildning"]

    if "hushåll" in input_json:
        demographics["households"] = input_json["hushåll"]

    # Mappa marknadsdata
    market_data = {}
    if "prisanalys" in input_json:
        pris = input_json["prisanalys"]
        market_data["avg_price"] = pris.get("medelpris", 0)
        market_data["avg_price_per_sqm"] = pris.get("medel_kr_m2", 0)
        market_data["recent_sales"] = pris.get("senaste_försäljningar", [])

    if "upplåtelseform" in input_json:
        market_data["tenure_types"] = input_json["upplåtelseform"]

    # Mappa flyttmönster
    migration_data = {}
    if "flyttmönster" in input_json:
        migration_data["net_migration"] = input_json["flyttmönster"].get("nettoinflyttning", 0)

    # Bygg project_params
    project_params = {
        "location": input_json.get("fastighet_adress") or kommun,
        "property_designation": input_json.get("property_designation"),
        "municipality": kommun,
        "deso_codes": deso_codes,
        "report_type": input_json.get("report_type", "full"),
        "request_date": datetime.now().isoformat()
    }

    return {
        "project_params": project_params,
        "demographics_data": demographics,
        "market_data": market_data,
        "migration_data": migration_data
    }


def run_analysis(job_manager: JobManager, report_type: str):
    """
    Kör analys baserat på report_type.

    Args:
        job_manager: JobManager instance
        report_type: 'quick' eller 'full'
    """

    try:
        # Läs input
        job_manager.update_status("processing", 5, "Läser input data...")
        input_data = job_manager.read_input()

        # Mappa till rätt format
        job_manager.update_status("processing", 10, "Mappar data...")
        mapped_data = map_input_data(input_data)

        project_params = mapped_data["project_params"]

        # Samla area context om fastighet angivits
        area_context = None
        if project_params.get("property_designation") or project_params.get("location"):
            job_manager.update_status("processing", 20, "Samlar områdesdata (API-anrop)...")

            collector = AreaContextCollector(
                google_api_key=os.getenv("GOOGLE_PLACES_API_KEY"),
                trafiklab_api_key=os.getenv("TRAFIKLAB_API_KEY"),
                lantmateriet_api_key=os.getenv("LANTMATERIET_API_KEY"),
                lantmateriet_api_secret=os.getenv("LANTMATERIET_API_SECRET")
            )

            area_context = collector.collect(
                property_designation=project_params.get("property_designation"),
                location=project_params.get("location") if not project_params.get("property_designation") else None,
                radius_m=1000
            )

            if "error" in area_context:
                job_manager.update_status("processing", 25, f"Varning: {area_context['error']}")
                area_context = None

        # Lägg till area_context i mapped_data
        if area_context:
            mapped_data["area_context"] = area_context

        # Kör analys
        if report_type == "quick":
            job_manager.update_status("processing", 30, "Kör Quick Analysis (3 agenter)...")
            result = run_quick_analysis(
                demographics_data=mapped_data.get("demographics_data", {}),
                market_data=mapped_data.get("market_data", {}),
                migration_data=mapped_data.get("migration_data", {}),
                area_context=area_context,
                project_params=project_params
            )
        else:  # full
            job_manager.update_status("processing", 30, "Kör Full Analysis (7 agenter)...")
            result = run_full_analysis(
                demographics_data=mapped_data.get("demographics_data", {}),
                market_data=mapped_data.get("market_data", {}),
                migration_data=mapped_data.get("migration_data", {}),
                competition_data={},  # Kan läggas till senare
                area_context=area_context,
                project_params=project_params
            )

        job_manager.update_status("processing", 85, "Genererar PDF-rapport...")

        # Spara rapport om den finns
        if result.get("pdf_path"):
            job_manager.save_report(result["pdf_path"])

        # Spara strukturerad data
        job_manager.update_status("processing", 95, "Sparar data...")
        job_manager.save_data({
            "analysis_result": result,
            "input_data": input_data,
            "area_context": area_context
        })

        # Klar!
        job_manager.update_status("completed", 100, "Analys slutförd!")

        return True

    except Exception as e:
        error_msg = f"{str(e)}\n{traceback.format_exc()}"
        job_manager.update_status("failed", 0, "Fel vid analys", error=error_msg)
        return False


def main():
    parser = argparse.ArgumentParser(description="Kör fastighetsanalys via CLI")
    parser.add_argument("--job-id", required=True, help="Unikt job ID")
    parser.add_argument("--report-type", required=True, choices=["quick", "full"],
                       help="Typ av rapport att generera")
    parser.add_argument("--jobs-dir", default="/var/app/jobs",
                       help="Mapp där jobs sparas (default: /var/app/jobs)")

    args = parser.parse_args()

    # Initiera job manager
    job_manager = JobManager(args.job_id, args.jobs_dir)
    job_manager.update_status("processing", 0, "Startar analys...")

    # Kör analys
    success = run_analysis(job_manager, args.report_type)

    # Exit code
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
