"""
main.py
-------
FastAPI application entry point.
Initialises the database, registers middleware, and mounts all routers.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import Base, engine, check_connection
from routers.feedback import router as feedback_router
from routers.etl import router as etl_router
from etl.etl_pipeline import ensure_etl_tables

# ─── Create tables (if not already present) ──────────────────
Base.metadata.create_all(bind=engine)
ensure_etl_tables()   # create ETL tables so analytics endpoint never crashes on first load

# ─── Application instance ─────────────────────────────────────
app = FastAPI(
    title="Feedback Management System",
    description=(
        "A centralized platform to submit, view, search, filter, "
        "and manage feedback from participants, employees, or customers."
    ),
    version="1.0.0",
    contact={
        "name": "Sanjana — AFDE Jul 2025",
    },
    docs_url="/docs",
    redoc_url="/redoc",
)

# ─── CORS ─────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",   # React CRA default
        "http://localhost:5173",   # Vite default
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Routers ──────────────────────────────────────────────────
app.include_router(feedback_router, prefix="/api")
app.include_router(etl_router, prefix="/api")


# ─── Root & Health endpoints ──────────────────────────────────
@app.get("/", tags=["Health"])
def root():
    return {
        "project": "Feedback Management System",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs",
    }


@app.get("/health", tags=["Health"])
def health_check():
    db_ok = check_connection()
    return {
        "status": "healthy" if db_ok else "degraded",
        "database": "connected" if db_ok else "unreachable",
    }
