"""
FastAPI application entry point.

BUG FIXES vs TypeScript backend (which never had an index.ts despite
package.json referencing it):
- FastAPI app, CORS middleware, migrations runner, deterministic seed,
  health/liveness endpoints are ALL wired up here.
- The TS backend had `cors` in dependencies but no app to enable it — fixed.
"""
from __future__ import annotations

import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from .db import Base, engine, get_db, run_migrations_if_needed
from .models import Intervention
from .routes.interventions import router as interventions_router
from .routes.imagery import router as imagery_router
from .services.seed import generate_seed_interventions


load_dotenv()


def _run_sqlite_autoseed_if_empty(db: Session) -> None:
    count = db.query(Intervention).count()
    if count > 0:
        return
    payloads = generate_seed_interventions(12)
    # Insert using the route's create_intervention — import locally to avoid loops
    from .routes.interventions import create_intervention
    for p in payloads:
        try:
            create_intervention(p, db)
        except Exception as exc:  # pragma: no cover - defensive
            print(f"[seed] Failed inserting {p.id}: {exc}")
            db.rollback()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: run migrations, create ORM tables (SQLite), auto-seed."""
    print("[app] Startup — applying migrations...")
    run_migrations_if_needed()
    # For SQLite fallback (no real migrations) also create all ORM tables
    from .db import DB_FLAVOR
    if DB_FLAVOR == "sqlite":
        Base.metadata.create_all(bind=engine)
    # Auto-seed empty DBs so the frontend has demo data on first launch.
    from .db import SessionLocal
    with SessionLocal() as db:
        _run_sqlite_autoseed_if_empty(db)
    print("[app] Ready.")
    yield
    print("[app] Shutting down.")


app = FastAPI(
    title="Watershed Management API (Kasari River Basin)",
    version="1.0.0",
    description=(
        "Watershed intervention management. Deterministic Kasari River Basin "
        "seed data + CRUD + impact scoring + AI-style recommendations."
    ),
    lifespan=lifespan,
)


# CORS — TS backend had 'cors' dep but never instantiated it.
FRONTEND_ORIGINS = os.getenv(
    "FRONTEND_ORIGINS",
    "http://localhost:5173,http://localhost:4173,http://127.0.0.1:5173,http://127.0.0.1:4173",
).split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in FRONTEND_ORIGINS if o.strip()] or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health", tags=["meta"])
def health(db: Session = Depends(get_db)):
    """Simple health check — also verifies DB connectivity."""
    count = db.query(Intervention).count()
    return {
        "ok": True,
        "interventions": count,
        "db": "postgres" if os.getenv("POSTGRES_URL") else "sqlite (fallback)",
    }


@app.get("/api/summary", tags=["meta"])
def summary(db: Session = Depends(get_db)):
    """Summary stats consumed by the Dashboard overview cards."""
    rows = db.query(
        Intervention.type,
        Intervention.condition,
        Intervention.impact_score,
        Intervention.risk_level,
    ).all()
    n = len(rows)

    def bucket(lo: int, hi: int) -> int:
        return sum(1 for r in rows if lo <= (r.impact_score or 0) < hi)

    return {
        "totalWatersheds": 1,
        "totalInterventions": n,
        "highImpact": sum(1 for r in rows if (r.impact_score or 0) >= 75),
        "moderateImpact": bucket(50, 75),
        "atRisk": bucket(0, 35),
        "needsReview": bucket(35, 50),
        "avgImpactScore": round(sum(r.impact_score or 0 for r in rows) / n, 1) if n else 0,
        "byType": {
            t: sum(1 for r in rows if r.type == t)
            for t in ("Check Dam", "Farm Pond", "Plantation", "Contour Trench")
        },
        "byRiskLevel": {
            lbl: sum(1 for r in rows if r.risk_level == lbl)
            for lbl in ("High Impact", "Moderate Impact", "Needs Review", "At Risk")
        },
    }


app.include_router(interventions_router)
app.include_router(imagery_router)
