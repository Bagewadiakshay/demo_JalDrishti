"""
Database configuration for the watershed management backend.

BUG FIXES vs the TypeScript implementation:
- Provides a consistent SQLAlchemy session interface
- Allows SQLite fallback for quick local dev (no Postgres required)
- run_migrations_if_exists() reads from ./migrations/*.sql reliably
"""
from __future__ import annotations

import os
import re
import glob
from pathlib import Path
from typing import Generator, Optional

from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker, Session
from sqlalchemy.pool import StaticPool


POSTGRES_URL = os.getenv("POSTGRES_URL")
SQLITE_FALLBACK = os.getenv("SQLITE_FALLBACK", "1") == "1"


if POSTGRES_URL:
    engine = create_engine(
        POSTGRES_URL,
        pool_pre_ping=True,
        future=True,
    )
    DB_FLAVOR = "postgres"
elif SQLITE_FALLBACK:
    sqlite_path = Path(__file__).resolve().parent.parent / "data.db"
    engine = create_engine(
        f"sqlite:///{sqlite_path}",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        future=True,
    )
    DB_FLAVOR = "sqlite"
else:
    raise RuntimeError(
        "Neither POSTGRES_URL set nor SQLITE_FALLBACK enabled. "
        "Configure POSTGRES_URL=postgresql://user:pass@host/db or set SQLITE_FALLBACK=1."
    )


SessionLocal = sessionmaker(
    autocommit=False, autoflush=False, bind=engine, expire_on_commit=False
)


class Base(DeclarativeBase):
    """Declarative base for all ORM models."""


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency for a per-request DB session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _split_sql_statements(sql_text: str) -> list[str]:
    """Split a multi-statement SQL file so SQLite can execute one at a time."""
    statements = re.split(r";\s*(?=(?:[^']*'[^']*')*[^']*$)", sql_text)
    return [s.strip() for s in statements if s.strip()]


def run_migrations_if_needed() -> None:
    """Apply SQL migrations from the migrations directory if not yet applied."""
    migrations_dir = Path(__file__).resolve().parent.parent / "migrations"
    if not migrations_dir.exists():
        print("[DB] No migrations directory found; skipping migrations.")
        return

    if DB_FLAVOR == "sqlite":
        print("[DB] SQLite detected — skipping SQL migrations (ORM create_all will handle tables).")
        return

    with engine.begin() as conn:
        conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS schema_migrations (
                    name TEXT PRIMARY KEY,
                    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
        )
        applied = {
            row[0]
            for row in conn.execute(text("SELECT name FROM schema_migrations")).fetchall()
        }

        for path in sorted(glob.glob(str(migrations_dir / "*.sql"))):
            name = Path(path).name
            if name in applied:
                print(f"[DB] Migration {name} already applied. Skipping.")
                continue
            print(f"[DB] Applying migration {name}...")
            sql = Path(path).read_text(encoding="utf-8")
            stmts = _split_sql_statements(sql)
            for stmt in stmts:
                try:
                    conn.execute(text(stmt))
                except Exception as exc:  # pragma: no cover - defensive
                    if DB_FLAVOR == "sqlite" and (
                        "ALTER TABLE" in stmt or "ADD CONSTRAINT" in stmt
                    ):
                        print(f"[DB][SQLite] Skipping unsupported statement: {stmt[:60]}...")
                        continue
                    raise
            conn.execute(
                text("INSERT INTO schema_migrations (name) VALUES (:name)"),
                {"name": name},
            )
            print(f"[DB] Applied migration {name}.")
