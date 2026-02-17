#!/usr/bin/env python3
"""Analyze Flash Recall logging exports and generate summary charts.

Accepted input formats: .csv, .json, .jsonl, .ndjson
Expected fields (best-effort):
- sessions: session_id, player_id, total_playtime_seconds, quit_inferred, game_version
- attempts: level_number, passed, stars, time_seconds, session_id, game_version
- events: event_type, level_number, client_timestamp_ms, session_id, game_version
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Optional

import matplotlib.pyplot as plt
import pandas as pd


def load_table(path: Optional[Path]) -> pd.DataFrame:
    if path is None:
        return pd.DataFrame()

    suffix = path.suffix.lower()
    if suffix == ".csv":
        return pd.read_csv(path)

    if suffix in {".jsonl", ".ndjson"}:
        return pd.read_json(path, lines=True)

    if suffix == ".json":
        with path.open("r", encoding="utf-8") as f:
            obj = json.load(f)
        if isinstance(obj, list):
            return pd.DataFrame(obj)
        if isinstance(obj, dict):
            if "documents" in obj and isinstance(obj["documents"], list):
                return pd.DataFrame(obj["documents"])
            return pd.json_normalize(obj)

    raise ValueError(f"Unsupported file type for {path}")


def normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty:
        return df

    out = df.copy()
    out.columns = [str(c).strip().lower() for c in out.columns]
    return out


def ensure_numeric(df: pd.DataFrame, columns: list[str]) -> pd.DataFrame:
    out = df.copy()
    for col in columns:
        if col in out.columns:
            out[col] = pd.to_numeric(out[col], errors="coerce")
    return out


def write_summary(summary_path: Path, lines: list[str]) -> None:
    summary_path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def plot_session_duration_hist(sessions: pd.DataFrame, outdir: Path) -> None:
    if sessions.empty or "total_playtime_seconds" not in sessions.columns:
        return

    values = pd.to_numeric(sessions["total_playtime_seconds"], errors="coerce").dropna()
    if values.empty:
        return

    plt.figure(figsize=(8, 5))
    (values / 60.0).hist(bins=20)
    plt.title("Session Duration Distribution")
    plt.xlabel("Session Duration (minutes)")
    plt.ylabel("Session Count")
    plt.tight_layout()
    plt.savefig(outdir / "session_duration_hist.png", dpi=120)
    plt.close()


def plot_level_completion(attempts: pd.DataFrame, outdir: Path) -> None:
    if attempts.empty or "level_number" not in attempts.columns or "passed" not in attempts.columns:
        return

    data = attempts.copy()
    data["level_number"] = pd.to_numeric(data["level_number"], errors="coerce")
    data["passed_flag"] = data["passed"].astype(str).str.lower().isin(["true", "1", "yes"])
    grouped = data.dropna(subset=["level_number"]).groupby("level_number")["passed_flag"].mean()

    if grouped.empty:
        return

    plt.figure(figsize=(9, 5))
    grouped.sort_index().mul(100).plot(kind="bar")
    plt.title("Level Completion Rate")
    plt.xlabel("Level")
    plt.ylabel("Completion Rate (%)")
    plt.ylim(0, 100)
    plt.tight_layout()
    plt.savefig(outdir / "completion_by_level.png", dpi=120)
    plt.close()


def plot_level_dropoff(events: pd.DataFrame, outdir: Path) -> None:
    if events.empty or "event_type" not in events.columns or "level_number" not in events.columns:
        return

    starts = events[events["event_type"] == "level_start"].copy()
    ends = events[events["event_type"] == "level_end"].copy()

    if starts.empty:
        return

    starts["level_number"] = pd.to_numeric(starts["level_number"], errors="coerce")
    ends["level_number"] = pd.to_numeric(ends["level_number"], errors="coerce")

    start_counts = starts.dropna(subset=["level_number"]).groupby("level_number").size()
    end_counts = ends.dropna(subset=["level_number"]).groupby("level_number").size()

    levels = sorted(set(start_counts.index.tolist()) | set(end_counts.index.tolist()))
    if not levels:
        return

    dropoff = []
    for level in levels:
        s_count = float(start_counts.get(level, 0))
        e_count = float(end_counts.get(level, 0))
        if s_count <= 0:
            dropoff.append(0.0)
        else:
            dropoff.append(max(0.0, (s_count - e_count) / s_count * 100.0))

    plt.figure(figsize=(9, 5))
    plt.bar([str(int(l)) for l in levels], dropoff)
    plt.title("Level Drop-off Rate (Starts without Ends)")
    plt.xlabel("Level")
    plt.ylabel("Drop-off Rate (%)")
    plt.ylim(0, 100)
    plt.tight_layout()
    plt.savefig(outdir / "dropoff_by_level.png", dpi=120)
    plt.close()


def plot_event_volume(events: pd.DataFrame, outdir: Path) -> None:
    if events.empty or "event_type" not in events.columns:
        return

    counts = events["event_type"].astype(str).value_counts().head(20)
    if counts.empty:
        return

    plt.figure(figsize=(10, 6))
    counts.sort_values().plot(kind="barh")
    plt.title("Top Event Types")
    plt.xlabel("Count")
    plt.ylabel("Event Type")
    plt.tight_layout()
    plt.savefig(outdir / "event_volume_by_type.png", dpi=120)
    plt.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Analyze Flash Recall logging data exports")
    parser.add_argument("--sessions", type=Path, help="Path to sessions table export")
    parser.add_argument("--attempts", type=Path, help="Path to attempts table export")
    parser.add_argument("--events", type=Path, help="Path to events table export")
    parser.add_argument("--outdir", type=Path, default=Path("analysis_output"), help="Output directory")
    args = parser.parse_args()

    args.outdir.mkdir(parents=True, exist_ok=True)

    sessions = normalize_columns(load_table(args.sessions))
    attempts = normalize_columns(load_table(args.attempts))
    events = normalize_columns(load_table(args.events))

    sessions = ensure_numeric(sessions, ["total_playtime_seconds", "last_level_completed"])
    attempts = ensure_numeric(attempts, ["level_number", "stars", "time_seconds"])
    events = ensure_numeric(events, ["level_number", "client_timestamp_ms", "hidden_duration_ms"])

    summary_lines: list[str] = []
    summary_lines.append("Flash Recall Logging Analysis")
    summary_lines.append("=" * 32)

    if not sessions.empty:
        session_count = len(sessions)
        unique_players = sessions["player_id"].nunique() if "player_id" in sessions.columns else None
        avg_minutes = (
            sessions["total_playtime_seconds"].dropna().mean() / 60.0
            if "total_playtime_seconds" in sessions.columns
            else None
        )

        summary_lines.append(f"sessions: {session_count}")
        if unique_players is not None:
            summary_lines.append(f"unique_players: {unique_players}")
        if avg_minutes is not None and pd.notna(avg_minutes):
            summary_lines.append(f"avg_session_minutes: {avg_minutes:.2f}")

        if "quit_inferred" in sessions.columns:
            quit_rate = (
                sessions["quit_inferred"].astype(str).str.lower().isin(["true", "1", "yes"]).mean() * 100.0
            )
            summary_lines.append(f"quit_inferred_rate_percent: {quit_rate:.2f}")

        if "game_version" in sessions.columns:
            versions = sessions["game_version"].astype(str).value_counts()
            summary_lines.append("sessions_by_version:")
            for version, count in versions.items():
                summary_lines.append(f"  {version}: {count}")

    if not attempts.empty and "level_number" in attempts.columns:
        attempts = attempts.copy()
        attempts["passed_flag"] = attempts["passed"].astype(str).str.lower().isin(["true", "1", "yes"])
        completion = attempts.groupby("level_number")["passed_flag"].mean().sort_index()
        summary_lines.append("level_completion_rate:")
        for level, rate in completion.items():
            summary_lines.append(f"  level_{int(level)}: {rate * 100.0:.2f}%")

    if not events.empty and "event_type" in events.columns:
        event_counts = events["event_type"].astype(str).value_counts()
        summary_lines.append("top_events:")
        for event_name, count in event_counts.head(15).items():
            summary_lines.append(f"  {event_name}: {count}")

    write_summary(args.outdir / "summary.txt", summary_lines)

    plot_session_duration_hist(sessions, args.outdir)
    plot_level_completion(attempts, args.outdir)
    plot_level_dropoff(events, args.outdir)
    plot_event_volume(events, args.outdir)

    if not sessions.empty:
        sessions.to_csv(args.outdir / "sessions.normalized.csv", index=False)
    if not attempts.empty:
        attempts.to_csv(args.outdir / "attempts.normalized.csv", index=False)
    if not events.empty:
        events.to_csv(args.outdir / "events.normalized.csv", index=False)

    print(f"Analysis complete. Outputs written to: {args.outdir}")


if __name__ == "__main__":
    main()
