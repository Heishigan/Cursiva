"""Pass-rate and cost report from generation_runs.

Usage (read-only):  DATABASE_URL=... python scripts/run_report.py [days]
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text  # noqa: E402

from database import engine  # noqa: E402

days = int(sys.argv[1]) if len(sys.argv) > 1 else 30
q = text("""
SELECT status, COUNT(*) AS runs, AVG(revision_count) AS avg_revisions,
       SUM(CASE WHEN cap_hit THEN 1 ELSE 0 END) AS cap_hits,
       SUM(CASE WHEN refunded THEN 1 ELSE 0 END) AS refunded,
       AVG(cost_usd) AS avg_cost_usd, SUM(cost_usd) AS total_cost_usd
FROM generation_runs
WHERE created_at >= CURRENT_TIMESTAMP - (:days * INTERVAL '1 day')
GROUP BY status ORDER BY runs DESC
""" if engine.dialect.name == "postgresql" else """
SELECT status, COUNT(*), AVG(revision_count), SUM(cap_hit), SUM(refunded), AVG(cost_usd), SUM(cost_usd)
FROM generation_runs WHERE created_at >= datetime('now', '-' || :days || ' days')
GROUP BY status ORDER BY 2 DESC
""")
with engine.connect() as c:
    rows = c.execute(q, {"days": days}).fetchall()
total = sum(r[1] for r in rows) or 1
print(f"Last {days} days, {total if rows else 0} runs")
print(f"{'status':<14}{'runs':>6}{'share':>8}{'avg rev':>9}{'cap':>6}{'refund':>8}{'avg $':>9}{'total $':>10}")
for s, n, rev, cap, ref, avg, tot in rows:
    print(f"{s:<14}{n:>6}{n / total:>8.0%}{(rev or 0):>9.2f}{(cap or 0):>6}{(ref or 0):>8}{(avg or 0):>9.4f}{(tot or 0):>10.2f}")
