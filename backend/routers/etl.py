"""
ETL Router — Phase 2
Endpoints to trigger the ETL pipeline and fetch analytics results.
"""

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import text
from database import engine
from etl.etl_pipeline import run_etl
import os

router = APIRouter(prefix="/etl", tags=["ETL"])

DATASETS_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "datasets")


# ── List available dataset files ─────────────────────────────────────────────
@router.get("/datasets")
def list_datasets():
    """Return available CSV/Excel files in the datasets/ folder."""
    try:
        files = [
            f for f in os.listdir(DATASETS_DIR)
            if f.endswith((".csv", ".xlsx", ".xls"))
        ]
        return {"datasets": files}
    except FileNotFoundError:
        return {"datasets": []}


# ── Trigger ETL pipeline ──────────────────────────────────────────────────────
@router.post("/run")
def trigger_etl(filename: str = Query(default="feedback_dataset.csv", description="Dataset filename in datasets/ folder")):
    """
    Trigger the ETL pipeline for a given dataset file.
    Extracts, transforms, and loads data into analytics tables.
    """
    try:
        result = run_etl(filename)
        return {
            "status": "success",
            "message": f"ETL completed. {result['total_clean']} clean records loaded.",
            "report": result,
        }
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"ETL failed: {str(e)}")


# ── Fetch ETL run history ─────────────────────────────────────────────────────
@router.get("/history")
def get_etl_history():
    """Return all ETL run summaries ordered by most recent."""
    try:
        with engine.connect() as conn:
            rows = conn.execute(text(
                "SELECT * FROM etl_summary ORDER BY run_at DESC LIMIT 20"
            )).mappings().fetchall()
        return {"runs": [dict(r) for r in rows]}
    except Exception:
        return {"runs": []}


# ── Fetch latest ETL analytics ────────────────────────────────────────────────
@router.get("/analytics")
def get_etl_analytics():
    """
    Return aggregated analytics from the latest ETL run:
    - Summary stats (avg rating, recommend %, record counts)
    - Rating distribution
    - Top programs and trainers
    - Department breakdown
    - Category breakdown
    - Recent 10 clean records
    """
    with engine.connect() as conn:

        # Latest summary row
        summary = conn.execute(text(
            "SELECT * FROM etl_summary ORDER BY run_at DESC LIMIT 1"
        )).mappings().fetchone()

        if not summary:
            raise HTTPException(
                status_code=404,
                detail="No ETL run found. Please trigger /api/etl/run first."
            )

        summary = dict(summary)

        # Top programs by average rating (from clean table)
        top_programs = conn.execute(text("""
            SELECT program_name,
                   COUNT(*)            AS count,
                   ROUND(AVG(rating), 2) AS avg_rating
            FROM   etl_feedback_clean
            WHERE  source_file = :sf
            GROUP  BY program_name
            ORDER  BY avg_rating DESC, count DESC
            LIMIT  5
        """), {"sf": summary["source_file"]}).mappings().fetchall()

        # Top trainers
        top_trainers = conn.execute(text("""
            SELECT trainer_name,
                   COUNT(*)              AS count,
                   ROUND(AVG(rating), 2) AS avg_rating
            FROM   etl_feedback_clean
            WHERE  source_file = :sf AND trainer_name != ''
            GROUP  BY trainer_name
            ORDER  BY avg_rating DESC, count DESC
            LIMIT  5
        """), {"sf": summary["source_file"]}).mappings().fetchall()

        # Department distribution
        dept_dist = conn.execute(text("""
            SELECT department, COUNT(*) AS count
            FROM   etl_feedback_clean
            WHERE  source_file = :sf
            GROUP  BY department
            ORDER  BY count DESC
        """), {"sf": summary["source_file"]}).mappings().fetchall()

        # Category distribution
        cat_dist = conn.execute(text("""
            SELECT category, COUNT(*) AS count
            FROM   etl_feedback_clean
            WHERE  source_file = :sf
            GROUP  BY category
            ORDER  BY count DESC
        """), {"sf": summary["source_file"]}).mappings().fetchall()

        # Recent 10 records
        recent = conn.execute(text("""
            SELECT participant_name, department, program_name, category,
                   trainer_name, session_date, rating, would_recommend
            FROM   etl_feedback_clean
            WHERE  source_file = :sf
            ORDER  BY etl_loaded_at DESC, id DESC
            LIMIT  10
        """), {"sf": summary["source_file"]}).mappings().fetchall()

    return {
        "summary": {
            "run_at": str(summary["run_at"]),
            "source_file": summary["source_file"],
            "total_raw": summary["total_raw"],
            "total_clean": summary["total_clean"],
            "dropped_missing": summary["dropped_missing"],
            "dropped_invalid_rating": summary["dropped_invalid_rating"],
            "dropped_duplicates": summary["dropped_duplicates"],
            "avg_rating": float(summary["avg_rating"]),
            "recommend_pct": float(summary["recommend_pct"]),
            "total_recommend": summary["total_recommend"],
        },
        "rating_distribution": {
            "1": summary["rating_1"],
            "2": summary["rating_2"],
            "3": summary["rating_3"],
            "4": summary["rating_4"],
            "5": summary["rating_5"],
        },
        "top_programs": [dict(r) for r in top_programs],
        "top_trainers": [dict(r) for r in top_trainers],
        "department_distribution": {r["department"]: r["count"] for r in dept_dist},
        "category_distribution": {r["category"]: r["count"] for r in cat_dist},
        "recent_records": [dict(r) for r in recent],
    }
