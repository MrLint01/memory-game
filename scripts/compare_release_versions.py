#!/usr/bin/env python3
"""Compare two Flash Recall releases with superimposed retention curves.

This script intentionally mirrors analyze_logs.py retention denominator logic:
- Player population = union of player ids seen in sessions/attempts/events.
- Highest level completed uses sessions.last_level_completed when available,
  with fallback to attempts passed levels if sessions data is unavailable.
- Retention by time uses attempts.time_seconds sum per player.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd


def bool_series(s: pd.Series) -> pd.Series:
    if s is None or len(s) == 0:
        return pd.Series(dtype=bool)
    if s.dtype == bool:
        return s.fillna(False)
    if pd.api.types.is_numeric_dtype(s):
        return s.fillna(0).astype(float) != 0
    vals = s.astype(str).str.strip().str.lower()
    return vals.isin({"1", "true", "t", "yes", "y"})


def normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty:
        return df
    out = df.copy()
    out.columns = [str(c).strip().lower() for c in out.columns]
    return out


def pick_player_column(df: pd.DataFrame) -> str | None:
    for c in ["player_id_norm", "player_id", "playerid", "user_id", "userid"]:
        if c in df.columns:
            return c
    return None


def load_from_combined(path: Path) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    data = json.loads(path.read_text(encoding="utf-8"))
    sessions_rows: list[dict[str, Any]] = []
    attempts_rows: list[dict[str, Any]] = []
    events_rows: list[dict[str, Any]] = []
    for s in data:
        if not isinstance(s, dict):
            continue
        sessions_rows.append(dict(s))
        sess_version = s.get("game_version")
        sess_player = s.get("player_id")
        sess_id = s.get("session_id")
        for a in (s.get("attempts") or []):
            if not isinstance(a, dict):
                continue
            row = dict(a)
            if row.get("game_version") is None:
                row["game_version"] = sess_version
            if row.get("player_id") is None:
                row["player_id"] = sess_player
            if row.get("session_id") is None:
                row["session_id"] = sess_id
            attempts_rows.append(row)
        for e in (s.get("events") or []):
            if not isinstance(e, dict):
                continue
            row = dict(e)
            if row.get("game_version") is None:
                row["game_version"] = sess_version
            if row.get("player_id") is None:
                row["player_id"] = sess_player
            if row.get("session_id") is None:
                row["session_id"] = sess_id
            events_rows.append(row)
    return normalize_columns(pd.DataFrame(sessions_rows)), normalize_columns(pd.DataFrame(attempts_rows)), normalize_columns(pd.DataFrame(events_rows))


def load_tables(args: argparse.Namespace) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    if args.combined is not None:
        return load_from_combined(args.combined)
    sessions = normalize_columns(pd.read_csv(args.sessions)) if args.sessions and args.sessions.exists() else pd.DataFrame()
    attempts = normalize_columns(pd.read_csv(args.attempts)) if args.attempts and args.attempts.exists() else pd.DataFrame()
    events = normalize_columns(pd.read_csv(args.events)) if args.events and args.events.exists() else pd.DataFrame()
    return sessions, attempts, events


def get_player_metrics_from_tables(
    s: pd.DataFrame, a: pd.DataFrame, e: pd.DataFrame
) -> pd.DataFrame:

    all_players: set[str] = set()
    s_player_col = pick_player_column(s)
    a_player_col = pick_player_column(a)
    e_player_col = pick_player_column(e)

    if s_player_col is not None:
        all_players.update(s[s_player_col].dropna().astype(str).tolist())
    if a_player_col is not None:
        all_players.update(a[a_player_col].dropna().astype(str).tolist())
    if e_player_col is not None:
        all_players.update(e[e_player_col].dropna().astype(str).tolist())

    player_highest_completed = pd.Series(dtype=float)
    if s_player_col is not None and "last_level_completed" in s.columns:
        player_highest_completed = (
            s.dropna(subset=[s_player_col])
            .groupby(s[s_player_col].astype(str))["last_level_completed"]
            .max()
            .fillna(0)
            .clip(lower=0)
            .astype(float)
        )

    if a_player_col is not None and {"level_number", "passed"} <= set(a.columns):
        a["level_number"] = pd.to_numeric(a["level_number"], errors="coerce")
        a["passed_flag"] = bool_series(a["passed"])
        passed = a[a["passed_flag"] & a[a_player_col].notna() & a["level_number"].notna()]
        if not passed.empty:
            fallback_highest = passed.groupby(passed[a_player_col].astype(str))["level_number"].max().astype(float)
            if player_highest_completed.empty:
                player_highest_completed = fallback_highest

    if all_players:
        player_highest_completed = player_highest_completed.reindex(sorted(all_players)).fillna(0.0)

    player_levels_completed_count = pd.Series(0.0, index=player_highest_completed.index, dtype=float)
    if a_player_col is not None and {"level_number", "passed"} <= set(a.columns):
        passed = a[a["passed_flag"] & a[a_player_col].notna() & a["level_number"].notna()]
        if not passed.empty:
            cnt = passed.groupby(passed[a_player_col].astype(str))["level_number"].nunique().astype(float)
            player_levels_completed_count = cnt.reindex(player_highest_completed.index).fillna(0.0)

    player_retention_seconds = pd.Series(0.0, index=player_highest_completed.index, dtype=float)
    if a_player_col is not None and "time_seconds" in a.columns:
        a["time_seconds"] = pd.to_numeric(a["time_seconds"], errors="coerce")
        t = (
            a.dropna(subset=[a_player_col, "time_seconds"])
            .groupby(a[a_player_col].astype(str))["time_seconds"]
            .sum()
            .astype(float)
        )
        player_retention_seconds = t.reindex(player_highest_completed.index).fillna(0.0)

    out = pd.DataFrame(
        {
            "player_id": player_highest_completed.index.astype(str),
            "highest_level_completed": player_highest_completed.astype(float).astype(int).values,
            "levels_completed_count": player_levels_completed_count.astype(float).astype(int).values,
            "total_playtime_seconds": player_retention_seconds.astype(float).values,
        }
    )
    return out


def get_player_metrics_for_version(
    sessions: pd.DataFrame, attempts: pd.DataFrame, events: pd.DataFrame, version: str
) -> pd.DataFrame:
    s = sessions[sessions["game_version"].astype(str) == version].copy() if not sessions.empty and "game_version" in sessions.columns else pd.DataFrame()
    a = attempts[attempts["game_version"].astype(str) == version].copy() if not attempts.empty and "game_version" in attempts.columns else pd.DataFrame()
    e = events[events["game_version"].astype(str) == version].copy() if not events.empty and "game_version" in events.columns else pd.DataFrame()
    return get_player_metrics_from_tables(s, a, e)


def load_version_tables_from_dir(version_dir: Path) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    s_path = version_dir / "sessions.normalized.csv"
    a_path = version_dir / "attempts.normalized.csv"
    e_path = version_dir / "events.normalized.csv"
    s = normalize_columns(pd.read_csv(s_path)) if s_path.exists() else pd.DataFrame()
    a = normalize_columns(pd.read_csv(a_path)) if a_path.exists() else pd.DataFrame()
    e = normalize_columns(pd.read_csv(e_path)) if e_path.exists() else pd.DataFrame()
    return s, a, e


def retention_curve(series: pd.Series) -> pd.Series:
    if series is None or series.empty:
        return pd.Series(dtype=float)
    max_val = int(series.max()) if pd.notna(series.max()) else 0
    idx = pd.Index(range(0, max(1, max_val) + 1), dtype=int)
    return pd.Series({k: (series >= k).mean() * 100.0 for k in idx}, index=idx)


def retention_curve_time(seconds: pd.Series) -> pd.Series:
    if seconds is None or seconds.empty:
        return pd.Series(dtype=float)
    max_minutes = int(np.ceil(seconds.max() / 60.0)) if pd.notna(seconds.max()) else 0
    idx = pd.Index(range(0, max(1, max_minutes) + 1), dtype=int)
    return pd.Series({m: (seconds >= (m * 60.0)).mean() * 100.0 for m in idx}, index=idx)


def plot_two_lines(out_png: Path, title: str, xlabel: str, old_label: str, new_label: str, old_s: pd.Series, new_s: pd.Series) -> None:
    idx = sorted(set(old_s.index.tolist()) | set(new_s.index.tolist()))
    old_p = old_s.reindex(idx).ffill().fillna(100.0)
    new_p = new_s.reindex(idx).ffill().fillna(100.0)
    plt.figure(figsize=(10, 5))
    plt.plot(old_p.index, old_p.values, marker="o", color="#5b8ff9", label=old_label)
    plt.plot(new_p.index, new_p.values, marker="o", color="#5ad8a6", label=new_label)
    plt.ylim(0, 100)
    plt.xlabel(xlabel)
    plt.ylabel("Retention (%)")
    plt.title(title)
    plt.legend()
    plt.grid(True, alpha=0.25)
    plt.tight_layout()
    plt.savefig(out_png, dpi=130)
    plt.close()


def main() -> None:
    p = argparse.ArgumentParser(description="Compare release versions with retention curves")
    p.add_argument("--combined", type=Path, default=None, help="Optional combined export JSON (fallback to csv inputs if omitted)")
    p.add_argument("--sessions", type=Path, default=Path("prepared_data/sessions.csv"))
    p.add_argument("--attempts", type=Path, default=Path("prepared_data/attempts.csv"))
    p.add_argument("--events", type=Path, default=Path("prepared_data/events.csv"))
    p.add_argument("--old-version", type=str, default="2026.02.21")
    p.add_argument("--new-version", type=str, default="2026.03.0")
    p.add_argument("--old-dir", type=Path, default=None, help="Directory containing old version normalized CSVs")
    p.add_argument("--new-dir", type=Path, default=None, help="Directory containing new version normalized CSVs")
    p.add_argument("--outdir", type=Path, default=None)
    args = p.parse_args()

    outdir = args.outdir or Path("analysis_output") / f"version_comparison_{args.old_version}_vs_{args.new_version}"
    outdir.mkdir(parents=True, exist_ok=True)

    old_dir = args.old_dir or Path("analysis_output") / f"version_{args.old_version}"
    new_dir = args.new_dir or Path("analysis_output") / f"version_{args.new_version}"

    if old_dir.exists() and new_dir.exists():
        old_s, old_a, old_e = load_version_tables_from_dir(old_dir)
        new_s, new_a, new_e = load_version_tables_from_dir(new_dir)
        old_stats = get_player_metrics_from_tables(old_s, old_a, old_e)
        new_stats = get_player_metrics_from_tables(new_s, new_a, new_e)
    else:
        sessions, attempts, events = load_tables(args)
        old_stats = get_player_metrics_for_version(sessions, attempts, events, args.old_version)
        new_stats = get_player_metrics_for_version(sessions, attempts, events, args.new_version)

    # Keep only superimposed retention curve visuals.
    for old_png in outdir.glob("*.png"):
        old_png.unlink(missing_ok=True)

    plot_two_lines(
        outdir / "retention_curve_highest_level_completed.png",
        "Retention Curve by Highest Level Completed",
        "Highest level completed (threshold)",
        args.old_version,
        args.new_version,
        retention_curve(old_stats["highest_level_completed"]),
        retention_curve(new_stats["highest_level_completed"]),
    )
    plot_two_lines(
        outdir / "retention_curve_levels_completed_count.png",
        "Retention Curve by Number of Levels Completed",
        "Levels completed count (threshold)",
        args.old_version,
        args.new_version,
        retention_curve(old_stats["levels_completed_count"]),
        retention_curve(new_stats["levels_completed_count"]),
    )
    plot_two_lines(
        outdir / "retention_curve_time_played_minutes.png",
        "Retention Curve by Time Played",
        "Gameplay time (minutes threshold)",
        args.old_version,
        args.new_version,
        retention_curve_time(old_stats["total_playtime_seconds"]),
        retention_curve_time(new_stats["total_playtime_seconds"]),
    )

    def retention_pct(stats: pd.DataFrame, min_completed_levels: int = 2) -> float:
        if stats.empty:
            return 0.0
        return float((stats["levels_completed_count"] >= min_completed_levels).mean() * 100.0)

    summary = [
        "Flash Recall Release Comparison",
        "==============================",
        f"old_version: {args.old_version}",
        f"new_version: {args.new_version}",
        "",
        "Comparison output: superimposed retention curves (highest level, levels completed count, time played)",
        f"old_players: {len(old_stats)}",
        f"new_players: {len(new_stats)}",
        f"old_retention_levels_completed_2plus_pct: {retention_pct(old_stats, 2):.2f}",
        f"new_retention_levels_completed_2plus_pct: {retention_pct(new_stats, 2):.2f}",
        f"old_avg_playtime_minutes: {(old_stats['total_playtime_seconds'].mean() / 60.0) if len(old_stats) else 0:.2f}",
        f"new_avg_playtime_minutes: {(new_stats['total_playtime_seconds'].mean() / 60.0) if len(new_stats) else 0:.2f}",
        f"old_median_highest_level: {old_stats['highest_level_completed'].median() if len(old_stats) else 0}",
        f"new_median_highest_level: {new_stats['highest_level_completed'].median() if len(new_stats) else 0}",
        f"old_median_levels_completed_count: {old_stats['levels_completed_count'].median() if len(old_stats) else 0}",
        f"new_median_levels_completed_count: {new_stats['levels_completed_count'].median() if len(new_stats) else 0}",
    ]
    (outdir / "summary.txt").write_text("\n".join(map(str, summary)) + "\n", encoding="utf-8")
    old_stats.to_csv(outdir / "old_version_player_stats.csv", index=False)
    new_stats.to_csv(outdir / "new_version_player_stats.csv", index=False)

    print(f"Comparison complete. Outputs written to: {outdir}")


if __name__ == "__main__":
    main()
