"""
ETL Pipeline for Feedback Management System — Phase 2
======================================================
Stages:
  1. Extract  — Read CSV/Excel from datasets/ folder
  2. Transform — Validate, clean, deduplicate, standardize
  3. Load     — Insert cleaned records into etl_feedback_clean table
                and aggregated summaries into etl_summary table
"""

import os
import sys
import logging
import pandas as pd
from datetime import datetime, date
from sqlalchemy import text
from pathlib import Path

# Add backend root to path so we can import database
sys.path.insert(0, str(Path(__file__).parent.parent))
from database import engine

# ─── Logging ────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("etl")

# ─── Constants ───────────────────────────────────────────────────────────────
CREATE_CLEAN_TABLE = """
    CREATE TABLE IF NOT EXISTS etl_feedback_clean (
        id               INT AUTO_INCREMENT PRIMARY KEY,
        participant_name VARCHAR(255) NOT NULL,
        email            VARCHAR(255),
        department       VARCHAR(255),
        program_name     VARCHAR(255) NOT NULL,
        category         ENUM('Training','Product','Event','Service','Other') DEFAULT 'Other',
        trainer_name     VARCHAR(255),
        session_date     DATE,
        rating           TINYINT NOT NULL,
        comments         TEXT,
        would_recommend  TINYINT(1) DEFAULT 1,
        submitted_at     DATE,
        source_file      VARCHAR(255),
        etl_loaded_at    DATETIME
    )
"""

CREATE_SUMMARY_TABLE = """
    CREATE TABLE IF NOT EXISTS etl_summary (
        id                     INT AUTO_INCREMENT PRIMARY KEY,
        run_at                 DATETIME NOT NULL,
        source_file            VARCHAR(255),
        total_raw              INT,
        total_clean            INT,
        dropped_missing        INT,
        dropped_invalid_rating INT,
        dropped_duplicates     INT,
        avg_rating             DECIMAL(4,2),
        total_recommend        INT,
        recommend_pct          DECIMAL(5,2),
        top_program            VARCHAR(255),
        top_trainer            VARCHAR(255),
        rating_1               INT,
        rating_2               INT,
        rating_3               INT,
        rating_4               INT,
        rating_5               INT
    )
"""


def ensure_etl_tables():
    """Create ETL tables if they don't exist. Safe to call on every startup."""
    with engine.connect() as conn:
        conn.execute(text(CREATE_CLEAN_TABLE))
        conn.execute(text(CREATE_SUMMARY_TABLE))
        conn.commit()
    log.info("[INIT] ETL tables ready.")


DATASETS_DIR = Path(__file__).parent.parent.parent / "datasets"
VALID_CATEGORIES = {"Training", "Product", "Event", "Service", "Other"}


# ─── Stage 1: EXTRACT ────────────────────────────────────────────────────────

def extract(filename: str) -> pd.DataFrame:
    """Read a CSV or Excel file from the datasets/ folder."""
    filepath = DATASETS_DIR / filename
    if not filepath.exists():
        raise FileNotFoundError(f"Dataset not found: {filepath}")

    ext = filepath.suffix.lower()
    if ext == ".csv":
        df = pd.read_csv(filepath, dtype=str)
    elif ext in (".xlsx", ".xls"):
        df = pd.read_excel(filepath, dtype=str)
    else:
        raise ValueError(f"Unsupported file type: {ext}")

    log.info(f"[EXTRACT] Read {len(df)} rows from '{filename}'")
    return df


# ─── Stage 2: TRANSFORM ──────────────────────────────────────────────────────

def transform(df: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
    """
    Clean and validate the raw DataFrame.
    Returns: (cleaned_df, report_dict)
    """
    report = {
        "total_raw": len(df),
        "dropped_missing_required": 0,
        "dropped_invalid_rating": 0,
        "dropped_duplicates": 0,
        "fixed_casing": 0,
        "fixed_category": 0,
        "total_clean": 0,
    }

    original_count = len(df)

    # ── 1. Normalize column names ────────────────────────────────────────────
    df.columns = df.columns.str.strip().str.lower().str.replace(" ", "_")

    # ── 2. Drop rows missing required fields ────────────────────────────────
    required = ["participant_name", "program_name", "rating"]
    before = len(df)
    df = df.dropna(subset=required)
    df = df[df["participant_name"].str.strip() != ""]
    df = df[df["program_name"].str.strip() != ""]
    report["dropped_missing_required"] = before - len(df)

    # ── 3. Validate and coerce rating ────────────────────────────────────────
    before = len(df)
    df["rating"] = pd.to_numeric(df["rating"], errors="coerce")
    df = df.dropna(subset=["rating"])
    df["rating"] = df["rating"].astype(int)
    df = df[df["rating"].between(1, 5)]
    report["dropped_invalid_rating"] = before - len(df)

    # ── 4. Standardize text casing ───────────────────────────────────────────
    casing_cols = ["participant_name", "department", "program_name", "trainer_name"]
    casing_fixed = 0
    for col in casing_cols:
        if col in df.columns:
            original = df[col].copy()
            df[col] = df[col].str.strip().str.title()
            casing_fixed += (df[col] != original).sum()
    report["fixed_casing"] = int(casing_fixed)

    # ── 5. Standardize category ──────────────────────────────────────────────
    if "category" in df.columns:
        before_cats = df["category"].copy()
        df["category"] = df["category"].str.strip().str.title()
        df["category"] = df["category"].where(
            df["category"].isin(VALID_CATEGORIES), other="Other"
        )
        report["fixed_category"] = int((df["category"] != before_cats).sum())

    # ── 6. Standardize would_recommend ──────────────────────────────────────
    if "would_recommend" in df.columns:
        df["would_recommend"] = df["would_recommend"].str.strip().str.lower()
        df["would_recommend"] = df["would_recommend"].map(
            lambda v: True if v in ("yes", "true", "1") else False
        )
    else:
        df["would_recommend"] = True

    # ── 7. Parse dates ───────────────────────────────────────────────────────
    for date_col in ["session_date", "submitted_at"]:
        if date_col in df.columns:
            df[date_col] = pd.to_datetime(df[date_col], errors="coerce").dt.date
        else:
            df[date_col] = None

    # ── 8. Remove duplicates (same participant + program + session_date) ─────
    before = len(df)
    df = df.drop_duplicates(
        subset=["participant_name", "program_name", "session_date"], keep="first"
    )
    report["dropped_duplicates"] = before - len(df)

    # ── 9. Fill optional nulls ───────────────────────────────────────────────
    df["email"] = df.get("email", pd.Series(dtype=str)).fillna("").str.strip()
    df["department"] = df.get("department", pd.Series(dtype=str)).fillna("Unknown").str.strip()
    df["trainer_name"] = df.get("trainer_name", pd.Series(dtype=str)).fillna("").str.strip()
    df["comments"] = df.get("comments", pd.Series(dtype=str)).fillna("").str.strip()
    df["category"] = df.get("category", pd.Series(dtype=str)).fillna("Other")

    # ── 10. Add ETL metadata ─────────────────────────────────────────────────
    df["etl_loaded_at"] = datetime.utcnow()

    report["total_clean"] = len(df)

    log.info(
        f"[TRANSFORM] Raw={report['total_raw']} | "
        f"Dropped missing={report['dropped_missing_required']} | "
        f"Dropped invalid rating={report['dropped_invalid_rating']} | "
        f"Dropped duplicates={report['dropped_duplicates']} | "
        f"Clean={report['total_clean']}"
    )
    return df, report


# ─── Stage 3: LOAD ───────────────────────────────────────────────────────────

def load(df: pd.DataFrame, report: dict, filename: str) -> dict:
    """
    Insert cleaned records into etl_feedback_clean and
    aggregated summary into etl_summary.
    Returns the full ETL run report.
    """
    with engine.connect() as conn:

        log.info("[LOAD] Inserting records…")

        # ── Clear previous data from this source file ────────────────────────
        conn.execute(
            text("DELETE FROM etl_feedback_clean WHERE source_file = :f"),
            {"f": filename}
        )
        conn.commit()

        # ── Insert cleaned records ───────────────────────────────────────────
        records = []
        for _, row in df.iterrows():
            records.append({
                "participant_name": row["participant_name"],
                "email": row.get("email", ""),
                "department": row.get("department", "Unknown"),
                "program_name": row["program_name"],
                "category": row.get("category", "Other"),
                "trainer_name": row.get("trainer_name", ""),
                "session_date": row.get("session_date") if pd.notna(row.get("session_date")) else None,
                "rating": int(row["rating"]),
                "comments": row.get("comments", ""),
                "would_recommend": bool(row.get("would_recommend", True)),
                "submitted_at": row.get("submitted_at") if pd.notna(row.get("submitted_at")) else None,
                "source_file": filename,
                "etl_loaded_at": row["etl_loaded_at"],
            })

        if records:
            conn.execute(text("""
                INSERT INTO etl_feedback_clean
                  (participant_name, email, department, program_name, category,
                   trainer_name, session_date, rating, comments, would_recommend,
                   submitted_at, source_file, etl_loaded_at)
                VALUES
                  (:participant_name, :email, :department, :program_name, :category,
                   :trainer_name, :session_date, :rating, :comments, :would_recommend,
                   :submitted_at, :source_file, :etl_loaded_at)
            """), records)
            conn.commit()
            log.info(f"[LOAD] Inserted {len(records)} clean records into etl_feedback_clean.")

        # ── Compute analytics for summary ────────────────────────────────────
        avg_rating = float(df["rating"].mean())
        total_recommend = int(df["would_recommend"].sum())
        recommend_pct = round(total_recommend / len(df) * 100, 2) if len(df) > 0 else 0.0

        top_program = (
            df.groupby("program_name")["rating"].mean().idxmax()
            if not df.empty else ""
        )
        top_trainer_series = df[df["trainer_name"] != ""].groupby("trainer_name")["rating"].mean()
        top_trainer = top_trainer_series.idxmax() if not top_trainer_series.empty else ""

        rating_dist = df["rating"].value_counts().reindex([1,2,3,4,5], fill_value=0)

        # ── Insert summary row ───────────────────────────────────────────────
        conn.execute(text("""
            INSERT INTO etl_summary
              (run_at, source_file, total_raw, total_clean, dropped_missing,
               dropped_invalid_rating, dropped_duplicates, avg_rating,
               total_recommend, recommend_pct, top_program, top_trainer,
               rating_1, rating_2, rating_3, rating_4, rating_5)
            VALUES
              (:run_at, :source_file, :total_raw, :total_clean, :dropped_missing,
               :dropped_invalid_rating, :dropped_duplicates, :avg_rating,
               :total_recommend, :recommend_pct, :top_program, :top_trainer,
               :rating_1, :rating_2, :rating_3, :rating_4, :rating_5)
        """), {
            "run_at": datetime.utcnow(),
            "source_file": filename,
            "total_raw": report["total_raw"],
            "total_clean": report["total_clean"],
            "dropped_missing": report["dropped_missing_required"],
            "dropped_invalid_rating": report["dropped_invalid_rating"],
            "dropped_duplicates": report["dropped_duplicates"],
            "avg_rating": round(avg_rating, 2),
            "total_recommend": total_recommend,
            "recommend_pct": recommend_pct,
            "top_program": top_program,
            "top_trainer": top_trainer,
            "rating_1": int(rating_dist[1]),
            "rating_2": int(rating_dist[2]),
            "rating_3": int(rating_dist[3]),
            "rating_4": int(rating_dist[4]),
            "rating_5": int(rating_dist[5]),
        })
        conn.commit()
        log.info("[LOAD] ETL summary row inserted into etl_summary.")

    run_report = {
        **report,
        "source_file": filename,
        "avg_rating": round(avg_rating, 2),
        "total_recommend": total_recommend,
        "recommend_pct": recommend_pct,
        "top_program": top_program,
        "top_trainer": top_trainer,
        "rating_distribution": {str(k): int(v) for k, v in rating_dist.items()},
    }
    return run_report


# ─── Main runner ─────────────────────────────────────────────────────────────

def run_etl(filename: str = "feedback_dataset.csv") -> dict:
    """Run the full ETL pipeline for a given dataset file."""
    log.info(f"=== ETL Pipeline START — {filename} ===")
    df_raw = extract(filename)
    df_clean, report = transform(df_raw)
    result = load(df_clean, report, filename)
    log.info(f"=== ETL Pipeline COMPLETE — {result['total_clean']} clean records loaded ===")
    return result


if __name__ == "__main__":
    fname = sys.argv[1] if len(sys.argv) > 1 else "feedback_dataset.csv"
    result = run_etl(fname)
    print("\n── ETL Run Report ──────────────────────────────")
    for k, v in result.items():
        print(f"  {k}: {v}")
