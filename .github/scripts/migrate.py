#!/usr/bin/env python3
"""
Apply pending Supabase migrations using the Management API.
No DB password needed — only SUPABASE_ACCESS_TOKEN + SUPABASE_PROJECT_REF.
"""

import os, sys, re, json
from pathlib import Path
import urllib.request
import urllib.error

ACCESS_TOKEN = os.environ["SUPABASE_ACCESS_TOKEN"]
PROJECT_REF  = os.environ["SUPABASE_PROJECT_REF"]

BASE_URL = f"https://api.supabase.com/v1/projects/{PROJECT_REF}/database/query"


def sql(query: str) -> list[dict]:
    """Run a SQL query via the Management API and return rows."""
    payload = json.dumps({"query": query}).encode()
    req = urllib.request.Request(
        BASE_URL,
        data=payload,
        headers={
            "Authorization": f"Bearer {ACCESS_TOKEN}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print(f"[error] HTTP {e.code}: {body}", file=sys.stderr)
        raise


def ensure_tracking_table():
    sql("""
        CREATE TABLE IF NOT EXISTS _goalbet_applied_migrations (
            version TEXT PRIMARY KEY,
            applied_at TIMESTAMPTZ DEFAULT now()
        );
    """)


def seed_existing_versions():
    """Mark migrations 001-011 as already applied (they were run manually)."""
    versions = [f"{i:03d}" for i in range(1, 12)]
    values = ", ".join(f"('{v}')" for v in versions)
    sql(f"""
        INSERT INTO _goalbet_applied_migrations (version)
        VALUES {values}
        ON CONFLICT (version) DO NOTHING;
    """)


def get_applied_versions() -> set[str]:
    rows = sql("SELECT version FROM _goalbet_applied_migrations ORDER BY version;")
    return {r["version"] for r in rows}


def get_migration_files(migrations_dir: Path) -> list[tuple[str, Path]]:
    """Return (version, path) pairs sorted by version."""
    pattern = re.compile(r"^(\d{3})_.*\.sql$")
    files = []
    for f in sorted(migrations_dir.iterdir()):
        m = pattern.match(f.name)
        if m:
            files.append((m.group(1), f))
    return files


def main():
    migrations_dir = Path(__file__).parents[2] / "supabase" / "migrations"
    if not migrations_dir.is_dir():
        print(f"[error] Migrations directory not found: {migrations_dir}", file=sys.stderr)
        sys.exit(1)

    print("→ Ensuring migration tracking table exists...")
    ensure_tracking_table()

    print("→ Seeding existing migrations (001-011) as applied...")
    seed_existing_versions()

    applied = get_applied_versions()
    print(f"→ Already applied: {sorted(applied)}")

    migration_files = get_migration_files(migrations_dir)
    pending = [(v, p) for v, p in migration_files if v not in applied]

    if not pending:
        print("✅ No new migrations to apply.")
        return

    print(f"→ {len(pending)} pending migration(s) to apply:")
    for v, p in pending:
        print(f"   {p.name}")

    for version, path in pending:
        print(f"\n→ Applying {path.name}...")
        content = path.read_text(encoding="utf-8")
        try:
            sql(content)
            sql(f"INSERT INTO _goalbet_applied_migrations (version) VALUES ('{version}') ON CONFLICT DO NOTHING;")
            print(f"   ✅ {path.name} applied.")
        except Exception as e:
            print(f"   ❌ Failed to apply {path.name}: {e}", file=sys.stderr)
            sys.exit(1)

    print("\n✅ All migrations applied successfully.")


if __name__ == "__main__":
    main()
