#!/usr/bin/env python3
"""Analyze Flash Recall logging exports and generate summary charts."""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path
from typing import Any, Optional

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

TRUE_VALUES = {"true", "1", "yes", "y", "t"}


def load_table(path: Optional[Path]) -> pd.DataFrame:
    if path is None:
        return pd.DataFrame()
    suf = path.suffix.lower()
    if suf == ".csv":
        return pd.read_csv(path)
    if suf in {".jsonl", ".ndjson"}:
        return pd.read_json(path, lines=True)
    if suf == ".json":
        with path.open("r", encoding="utf-8") as f:
            obj = json.load(f)
        if isinstance(obj, list):
            return pd.DataFrame(obj)
        if isinstance(obj, dict):
            if isinstance(obj.get("documents"), list):
                return pd.DataFrame(obj["documents"])
            return pd.json_normalize(obj)
    raise ValueError(f"Unsupported file type for {path}")


def normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    out.columns = [str(c).strip().lower() for c in out.columns]
    return out


def bool_series(s: pd.Series) -> pd.Series:
    return s.astype(str).str.strip().str.lower().isin(TRUE_VALUES)


def maybe_json(v: Any) -> Any:
    if isinstance(v, (dict, list)):
        return v
    if not isinstance(v, str):
        return None
    t = v.strip()
    if not t or (not t.startswith("{") and not t.startswith("[")):
        return None
    try:
        return json.loads(t)
    except Exception:
        return None


def infer_card_type_from_failed(card: dict[str, Any]) -> str:
    raw_type = str(card.get("card_type") or "").strip().lower()
    if raw_type and raw_type != "unknown":
        return raw_type

    expected = str(card.get("expected") or "").strip().lower()
    prompt_target = str(card.get("prompt_target") or "").strip().lower()
    hint_type = str(card.get("hint_type") or "").strip().lower()
    token = hint_type or prompt_target or expected

    if token in {"number", "numbers"} or expected.isdigit():
        return "numbers"
    if token in {"letter", "letters"} or (len(expected) == 1 and expected.isalpha()):
        return "letters"
    if token in {"color", "colors", "background color"}:
        return "colors"
    if token in {"direction", "directions", "arrow", "up", "down", "left", "right"}:
        return "directions"
    if token in {"shape", "shapes", "triangle", "circle", "square"}:
        return "shapes"
    return "unknown"


def add_session_key(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    key = pd.Series(index=out.index, dtype="object")
    for col in ["session_id", "session_doc_id", "id", "doc_id", "name"]:
        if col in out.columns:
            vals = out[col].astype(str).replace("nan", "")
            mask = key.isna() | (key == "")
            key = key.where(~mask, vals)
    out["session_key"] = key.astype(str).replace({"nan": "", "none": "", "null": ""})
    out.loc[out["session_key"] == "", "session_key"] = pd.NA
    return out


def save_bar(series: pd.Series, path: Path, title: str, xlabel: str, ylabel: str, ylim: Optional[tuple[float, float]] = None) -> None:
    if series.empty:
        return
    plt.figure(figsize=(9, 5))
    series.plot(kind="bar")
    plt.title(title)
    plt.xlabel(xlabel)
    plt.ylabel(ylabel)
    if ylim is not None:
        plt.ylim(*ylim)
    plt.tight_layout()
    plt.savefig(path, dpi=120)
    plt.close()


def save_line(series: pd.Series, path: Path, title: str, xlabel: str, ylabel: str, ylim: Optional[tuple[float, float]] = None) -> None:
    if series.empty:
        return
    plt.figure(figsize=(9, 5))
    x = series.index.to_numpy()
    y = series.to_numpy()
    plt.plot(x, y, marker="o")
    plt.title(title)
    plt.xlabel(xlabel)
    plt.ylabel(ylabel)
    if ylim is not None:
        plt.ylim(*ylim)
    plt.tight_layout()
    plt.savefig(path, dpi=120)
    plt.close()


def pick_player_column(df: pd.DataFrame) -> Optional[str]:
    for c in ["player_id", "user_id"]:
        if c in df.columns:
            return c
    return None


def add_player_id_to_attempts(attempts: pd.DataFrame, sessions: pd.DataFrame) -> pd.DataFrame:
    out = attempts.copy()
    out["player_id_norm"] = pd.NA
    a_player_col = pick_player_column(out)
    if a_player_col is not None:
        out["player_id_norm"] = out[a_player_col].astype(str)
    if out["player_id_norm"].isna().all():
        s_player_col = pick_player_column(sessions)
        if s_player_col is not None and not sessions.empty:
            s_map = add_session_key(sessions.copy())
            s_map = s_map.dropna(subset=["session_key", s_player_col]).drop_duplicates(subset=["session_key"])
            lookup = s_map.set_index("session_key")[s_player_col].astype(str)
            a_with_key = add_session_key(out)
            out["player_id_norm"] = a_with_key["session_key"].map(lookup)
    out["player_id_norm"] = out["player_id_norm"].replace({"nan": pd.NA, "none": pd.NA, "null": pd.NA, "": pd.NA})
    return out


def infer_currently_playing_players(sessions: pd.DataFrame, stale_minutes: int = 30) -> pd.Series:
    """Infer players likely still in-progress from their latest session row."""
    pcol = pick_player_column(sessions)
    if pcol is None or sessions.empty:
        return pd.Series(dtype=bool)

    s = sessions.copy()
    s = s.dropna(subset=[pcol]).copy()
    if s.empty:
        return pd.Series(dtype=bool)

    s["_player"] = s[pcol].astype(str)
    for col in ["updated_at", "last_activity_at", "started_at", "ended_at"]:
        if col in s.columns:
            s[f"{col}_ts"] = pd.to_datetime(s[col], utc=True, errors="coerce")
    activity = pd.Series(pd.NaT, index=s.index, dtype="datetime64[ns, UTC]")
    for col in ["last_activity_at_ts", "updated_at_ts", "started_at_ts"]:
        if col in s.columns:
            activity = activity.combine_first(s[col])
    s["_activity_ts"] = activity
    s = s.sort_values(["_activity_ts"], na_position="last")
    latest = s.groupby("_player", as_index=False).tail(1).set_index("_player")
    if latest.empty:
        return pd.Series(dtype=bool)

    dataset_latest = latest["_activity_ts"].dropna().max()
    recent = pd.Series(False, index=latest.index)
    if pd.notna(dataset_latest):
        recent = latest["_activity_ts"] >= (dataset_latest - pd.Timedelta(minutes=stale_minutes))

    state_active = pd.Series(False, index=latest.index)
    if "session_state" in latest.columns:
        state_active = latest["session_state"].astype(str).str.lower().eq("active")

    ended = pd.Series(False, index=latest.index)
    if "ended_at_ts" in latest.columns:
        ended = latest["ended_at_ts"].notna()

    in_level = pd.Series(False, index=latest.index)
    if {"current_level_number", "last_level_completed"} <= set(latest.columns):
        current_level = pd.to_numeric(latest["current_level_number"], errors="coerce")
        last_completed = pd.to_numeric(latest["last_level_completed"], errors="coerce").fillna(0)
        in_level = (current_level > last_completed)

    return (state_active & ~ended & recent) | (in_level & recent)


def infer_quit_summary(events: pd.DataFrame, attempts: pd.DataFrame) -> pd.DataFrame:
    if events.empty or "event_type" not in events.columns:
        return pd.DataFrame()
    e = add_session_key(events.copy())
    e["_i"] = np.arange(len(e))
    e["event_time"] = pd.to_numeric(e.get("client_timestamp_ms"), errors="coerce")
    e["level_number"] = pd.to_numeric(e.get("level_number"), errors="coerce")
    e = e.dropna(subset=["session_key"])
    if e.empty:
        return pd.DataFrame()

    a = add_session_key(attempts.copy()) if not attempts.empty else pd.DataFrame()
    if not a.empty:
        a["level_number"] = pd.to_numeric(a.get("level_number"), errors="coerce")
        a["passed_flag"] = bool_series(a["passed"]) if "passed" in a.columns else False
        a["time_seconds"] = pd.to_numeric(a.get("time_seconds"), errors="coerce")
        prev = a.groupby(["session_key", "level_number"]).agg(prev_pass=("passed_flag", "max"), prev_time=("time_seconds", "last")).reset_index()
    else:
        prev = pd.DataFrame()

    rows: list[dict[str, Any]] = []
    for sk, g in e.groupby("session_key"):
        g = g.sort_values(["event_time", "_i"], na_position="last")
        started: list[int] = []
        stack: list[int] = []
        for _, r in g.iterrows():
            et = str(r.get("event_type") or "")
            lvl_raw = r.get("level_number")
            lvl = int(lvl_raw) if np.isfinite(lvl_raw) else None
            if et == "level_start" and lvl is not None:
                started.append(lvl)
                stack.append(lvl)
            elif et == "level_end" and lvl is not None:
                for i in range(len(stack) - 1, -1, -1):
                    if stack[i] == lvl:
                        stack.pop(i)
                        break
        if not started:
            continue
        mid = len(stack) > 0
        qlvl = stack[-1] if mid else started[-1]
        rows.append({"session_key": sk, "quit_level": qlvl, "quit_mid_level": mid, "previous_level": qlvl - 1 if qlvl > 1 else np.nan})
    q = pd.DataFrame(rows)
    if q.empty or prev.empty:
        return q
    prev = prev.rename(columns={"level_number": "previous_level"})
    return q.merge(prev, on=["session_key", "previous_level"], how="left")


def save_hist_minutes(values_seconds: pd.Series, path: Path, title: str, ylabel: str = "Player Count") -> None:
    clean = pd.to_numeric(values_seconds, errors="coerce").dropna()
    if clean.empty:
        return
    plt.figure(figsize=(8, 5))
    (clean / 60.0).hist(bins=20)
    plt.title(title)
    plt.xlabel("Duration (minutes)")
    plt.ylabel(ylabel)
    plt.tight_layout()
    plt.savefig(path, dpi=120)
    plt.close()


def save_hist_values(values: pd.Series, path: Path, title: str, xlabel: str, bins: int = 20) -> None:
    clean = pd.to_numeric(values, errors="coerce").dropna()
    if clean.empty:
        return
    plt.figure(figsize=(8, 5))
    clean.hist(bins=bins)
    plt.title(title)
    plt.xlabel(xlabel)
    plt.ylabel("Player Count")
    plt.tight_layout()
    plt.savefig(path, dpi=120)
    plt.close()


def attempts_before_first_pass(passed_series: pd.Series) -> int:
    vals = passed_series.astype(bool).tolist()
    for i, ok in enumerate(vals):
        if ok:
            return i
    return len(vals)


def sanitize_version_name(version: str) -> str:
    return re.sub(r"[^A-Za-z0-9._-]+", "_", str(version)).strip("_") or "unknown"


def parse_version_key(version: str) -> tuple:
    tokens = re.findall(r"\d+|[A-Za-z]+", str(version))
    key: list[Any] = []
    for t in tokens:
        if t.isdigit():
            key.append((0, int(t)))
        else:
            key.append((1, t.lower()))
    return tuple(key) if key else ((1, str(version).lower()),)


def main() -> None:
    p = argparse.ArgumentParser(description="Analyze Flash Recall logs")
    p.add_argument("--sessions", type=Path)
    p.add_argument("--attempts", type=Path)
    p.add_argument("--events", type=Path)
    p.add_argument("--outdir", type=Path, default=Path("analysis_output"))
    p.add_argument("--version-filter", type=str, default=None, help="Analyze only one game_version value")
    p.add_argument("--extra-version", action="append", default=[], help="Additional game versions to analyze (separate output folders)")
    args = p.parse_args()
    args.outdir.mkdir(parents=True, exist_ok=True)

    sessions = normalize_columns(load_table(args.sessions)) if args.sessions else pd.DataFrame()
    attempts = normalize_columns(load_table(args.attempts)) if args.attempts else pd.DataFrame()
    events = normalize_columns(load_table(args.events)) if args.events else pd.DataFrame()

    if "total_playtime_seconds" in sessions.columns:
        sessions["total_playtime_seconds"] = pd.to_numeric(sessions["total_playtime_seconds"], errors="coerce")
    if "last_level_completed" in sessions.columns:
        sessions["last_level_completed"] = pd.to_numeric(sessions["last_level_completed"], errors="coerce")
    if "level_number" in attempts.columns:
        attempts["level_number"] = pd.to_numeric(attempts["level_number"], errors="coerce")
    if "stars" in attempts.columns:
        attempts["stars"] = pd.to_numeric(attempts["stars"], errors="coerce")
    if "time_seconds" in attempts.columns:
        attempts["time_seconds"] = pd.to_numeric(attempts["time_seconds"], errors="coerce")
    if "rounds" in attempts.columns:
        attempts["rounds"] = attempts["rounds"].map(maybe_json)
    if "cards_failed" in attempts.columns:
        attempts["cards_failed"] = attempts["cards_failed"].map(maybe_json)
    if "level_number" in events.columns:
        events["level_number"] = pd.to_numeric(events["level_number"], errors="coerce")

    # Version orchestration: default analyzes latest version only; --extra-version adds more folders.
    if args.version_filter is None:
        available_versions: set[str] = set()
        for df in [sessions, attempts, events]:
            if not df.empty and "game_version" in df.columns:
                available_versions.update(df["game_version"].dropna().astype(str).tolist())
        if available_versions:
            latest = sorted(available_versions, key=parse_version_key)[-1]
            requested = [latest] + [v for v in args.extra_version if v]
            seen: set[str] = set()
            ordered_versions: list[str] = []
            for v in requested:
                if v not in seen:
                    seen.add(v)
                    ordered_versions.append(v)
            for version in ordered_versions:
                subdir = args.outdir / f"version_{sanitize_version_name(version)}"
                cmd = [
                    sys.executable,
                    str(Path(__file__).resolve()),
                    "--outdir",
                    str(subdir),
                    "--version-filter",
                    str(version),
                ]
                if args.sessions:
                    cmd.extend(["--sessions", str(args.sessions)])
                if args.attempts:
                    cmd.extend(["--attempts", str(args.attempts)])
                if args.events:
                    cmd.extend(["--events", str(args.events)])
                subprocess.run(cmd, check=True)
            return

    if args.version_filter:
        vf = str(args.version_filter)
        if "game_version" in sessions.columns:
            sessions = sessions[sessions["game_version"].astype(str) == vf].copy()
        if "game_version" in attempts.columns:
            attempts = attempts[attempts["game_version"].astype(str) == vf].copy()
        if "game_version" in events.columns:
            events = events[events["game_version"].astype(str) == vf].copy()

    summary: list[str] = ["Flash Recall Logging Analysis", "=" * 32]
    if args.version_filter:
        summary.append(f"version_filter: {args.version_filter}")
    if not sessions.empty:
        summary.append(f"sessions: {len(sessions)}")
        if "player_id" in sessions.columns:
            summary.append(f"unique_players: {sessions['player_id'].nunique()}")
    summary.append("retention_metric: attempts.time_seconds sum per player (strict gameplay-only)")
    attempts_with_player = add_player_id_to_attempts(attempts, sessions)

    # Player-level baseline: highest completed level per player, with 0 for players with no completed levels.
    player_highest_completed = pd.Series(dtype=float)
    sessions_player_col = pick_player_column(sessions) if not sessions.empty else None
    all_players: set[str] = set()
    if sessions_player_col is not None:
        all_players.update(sessions[sessions_player_col].dropna().astype(str).tolist())
    if "player_id_norm" in attempts_with_player.columns:
        all_players.update(attempts_with_player["player_id_norm"].dropna().astype(str).tolist())
    events_player_col = pick_player_column(events) if not events.empty else None
    if events_player_col is not None:
        all_players.update(events[events_player_col].dropna().astype(str).tolist())
    if sessions_player_col is not None and "last_level_completed" in sessions.columns:
        player_highest_completed = (
            sessions.dropna(subset=[sessions_player_col])
            .groupby(sessions[sessions_player_col].astype(str))["last_level_completed"]
            .max()
            .fillna(0)
            .clip(lower=0)
            .astype(float)
        )
    if player_highest_completed.empty and {"player_id_norm", "level_number", "passed"} <= set(attempts_with_player.columns):
        attempts_with_player["passed_flag"] = bool_series(attempts_with_player["passed"])
        completed_levels = (
            attempts_with_player[
                attempts_with_player["passed_flag"] & attempts_with_player["player_id_norm"].notna() & attempts_with_player["level_number"].notna()
            ]
            .groupby("player_id_norm")["level_number"]
            .max()
            .astype(float)
        )
        player_highest_completed = completed_levels
    if all_players:
        player_highest_completed = player_highest_completed.reindex(sorted(all_players)).fillna(0.0)
    currently_playing = infer_currently_playing_players(sessions)
    currently_playing = currently_playing.reindex(player_highest_completed.index).fillna(False).astype(bool)
    settled_players = player_highest_completed[~currently_playing]

    max_completed_level = int(player_highest_completed.max()) if not player_highest_completed.empty else 0
    level_index = pd.Index(range(1, max(1, max_completed_level) + 1), dtype=int)
    summary.append(f"players_currently_playing_inferred: {int(currently_playing.sum())}")
    summary.append(f"players_settled_for_quit_metrics: {int(settled_players.shape[0])}")

    # New retention by level: player-based and completion-based.
    if not player_highest_completed.empty and max_completed_level >= 1:
        retention_by_level_percent = pd.Series(
            {level: (player_highest_completed >= level).mean() * 100.0 for level in level_index},
            index=level_index,
        )
        save_line(
            retention_by_level_percent,
            args.outdir / "retention_percent_by_level.png",
            "Player Retention by Highest Level Completed",
            "Level",
            "Retention (%)",
            (0, 100),
        )
        summary.append("retention_by_level_percent_player_completed:")
        for level, rate in retention_by_level_percent.items():
            summary.append(f"  level_{int(level)}: {rate:.2f}")

    # New retention by time: player-based denominator.
    player_retention_seconds = pd.Series(dtype=float)
    if {"player_id_norm", "time_seconds"} <= set(attempts_with_player.columns):
        attempts_with_player["time_seconds"] = pd.to_numeric(attempts_with_player["time_seconds"], errors="coerce")
        player_retention_seconds = (
            attempts_with_player.dropna(subset=["player_id_norm", "time_seconds"])
            .groupby("player_id_norm")["time_seconds"]
            .sum()
            .astype(float)
        )
    if not player_highest_completed.empty:
        player_retention_seconds = player_retention_seconds.reindex(player_highest_completed.index).fillna(0.0)
    if not player_retention_seconds.empty:
        max_minutes = int(np.ceil(player_retention_seconds.max() / 60.0))
        minute_index = pd.Index(range(0, max(1, max_minutes) + 1), dtype=int)
        retention_by_time_percent = pd.Series(
            {
                minute: (player_retention_seconds >= (minute * 60.0)).mean() * 100.0
                for minute in minute_index
            },
            index=minute_index,
        )
        save_line(
            retention_by_time_percent,
            args.outdir / "retention_percent_by_time_played.png",
            "Player Retention by Gameplay Time",
            "Gameplay Time (minutes)",
            "Retention (%)",
            (0, 100),
        )
        summary.append("retention_by_time_played_percent_player:")
        summary.append(f"  max_minutes: {max_minutes}")

    if not player_retention_seconds.empty:
        save_hist_minutes(player_retention_seconds, args.outdir / "session_duration_hist.png", "Total Retention Time Per Unique Player (Inactivity-Excluded)")
        summary.append(f"unique_players_for_duration_hist: {int(player_retention_seconds.shape[0])}")
        summary.append(f"avg_player_gameplay_minutes: {player_retention_seconds.mean() / 60.0:.2f}")

    # Standardized completion chart: player % with highest completed >= level.
    if not player_highest_completed.empty and max_completed_level >= 1:
        comp = pd.Series(
            {level: (player_highest_completed >= level).mean() for level in level_index},
            index=level_index,
        )
        save_bar(comp * 100.0, args.outdir / "completion_by_level.png", "Players Completing Each Level", "Level", "Completion Rate (%)", (0, 100))
        summary.append("level_completion_rate_percent_player_completed:")
        for level, rate in comp.items():
            summary.append(f"  level_{int(level)}: {rate * 100.0:.2f}")

    if not player_highest_completed.empty:
        max_level = int(player_highest_completed.max()) if pd.notna(player_highest_completed.max()) else 10
        save_hist_values(
            player_highest_completed,
            args.outdir / "highest_level_reached_hist.png",
            "Highest Level Completed Per Unique Player",
            "Highest Level Completed",
            bins=max(10, max_level + 1),
        )
        summary.append(f"unique_players_for_level_hist: {int(player_highest_completed.shape[0])}")

    # Standardized quit distribution:
    # For settled players, not reaching L+1 is treated as quitting at L+1.
    if not settled_players.empty:
        quit_level_by_player = (settled_players + 1.0).astype(int)
        quit_counts = quit_level_by_player.value_counts().sort_index()
        save_bar(
            quit_counts,
            args.outdir / "quit_level_bar.png",
            "Quit Level by Player (Derived from Highest Completed)",
            "Level Quit On",
            "Player Count",
        )

        if {"player_id_norm", "level_number", "passed"} <= set(attempts_with_player.columns):
            attempts_with_player["passed_flag"] = bool_series(attempts_with_player["passed"])
            player_level_pass = (
                attempts_with_player[
                    attempts_with_player["player_id_norm"].notna() & attempts_with_player["level_number"].notna()
                ]
                .groupby(["player_id_norm", "level_number"])["passed_flag"]
                .max()
            )
            qdf = pd.DataFrame({
                "player_id_norm": quit_level_by_player.index.astype(str),
                "quit_level": quit_level_by_player.values.astype(int),
            })
            qdf["previous_level"] = qdf["quit_level"] - 1
            qdf = qdf[qdf["previous_level"] >= 1].copy()
            if not qdf.empty:
                qdf["prev_pass"] = [
                    bool(player_level_pass.get((pid, float(prev)), False))
                    or bool(player_level_pass.get((pid, int(prev)), False))
                    for pid, prev in zip(qdf["player_id_norm"], qdf["previous_level"])
                ]
                pp = qdf.groupby("previous_level")["prev_pass"].mean().sort_index()
                save_bar(
                    pp * 100.0,
                    args.outdir / "previous_level_pass_rate_when_quit.png",
                    "Previous-Level Pass Rate When Players Quit",
                    "Previous Level",
                    "Pass Rate (%)",
                    (0, 100),
                )

    if {"player_id_norm", "level_number", "time_seconds"} <= set(attempts_with_player.columns) and not player_highest_completed.empty and max_completed_level >= 1:
        a_time = attempts_with_player.dropna(subset=["player_id_norm", "level_number", "time_seconds"]).copy()
        player_level_time = a_time.groupby(["player_id_norm", "level_number"])["time_seconds"].sum()
        avg_time_rows: dict[int, float] = {}
        for level in level_index:
            eligible = player_highest_completed[player_highest_completed >= level].index
            if len(eligible) == 0:
                continue
            vals = player_level_time.xs(level, level="level_number", drop_level=True) if level in player_level_time.index.get_level_values("level_number") else pd.Series(dtype=float)
            vals = vals.reindex(eligible).fillna(0.0)
            avg_time_rows[int(level)] = float(vals.mean())
        if avg_time_rows:
            save_bar(pd.Series(avg_time_rows), args.outdir / "avg_time_per_level.png", "Average Player Time on Completed Levels", "Level", "Average Time (seconds)")

    if {"player_id_norm", "level_number", "stars", "passed"} <= set(attempts_with_player.columns) and not player_highest_completed.empty and max_completed_level >= 1:
        attempts_with_player["passed_flag"] = bool_series(attempts_with_player["passed"])
        a_stars = attempts_with_player[
            attempts_with_player["passed_flag"] & attempts_with_player["player_id_norm"].notna() & attempts_with_player["level_number"].notna()
        ].dropna(subset=["stars"]).copy()
        if not a_stars.empty:
            player_level_best_stars = a_stars.groupby(["player_id_norm", "level_number"])["stars"].max()
            avg_rows: dict[int, float] = {}
            max_rows: dict[int, float] = {}
            for level in level_index:
                eligible = player_highest_completed[player_highest_completed >= level].index
                if len(eligible) == 0:
                    continue
                vals = player_level_best_stars.xs(level, level="level_number", drop_level=True) if level in player_level_best_stars.index.get_level_values("level_number") else pd.Series(dtype=float)
                vals = vals.reindex(eligible).fillna(0.0)
                avg_rows[int(level)] = float(vals.mean())
                max_rows[int(level)] = float(vals.max())
            if avg_rows:
                save_bar(pd.Series(avg_rows), args.outdir / "avg_stars_per_level.png", "Average Stars Per Completed Level (Players)", "Level", "Average Stars")
            if max_rows:
                save_bar(pd.Series(max_rows), args.outdir / "max_stars_per_level.png", "Max Stars Per Completed Level (Players)", "Level", "Max Stars")

    if {"player_id_norm", "level_number", "passed"} <= set(attempts_with_player.columns) and not player_highest_completed.empty and max_completed_level >= 1:
        attempts_with_player["passed_flag"] = bool_series(attempts_with_player["passed"])
        a_retry = attempts_with_player.dropna(subset=["player_id_norm", "level_number"]).copy()
        g_retry = a_retry.groupby(["player_id_norm", "level_number"])["passed_flag"].apply(attempts_before_first_pass)
        retries_rows: dict[int, float] = {}
        for level in level_index:
            eligible = player_highest_completed[player_highest_completed >= level].index
            if len(eligible) == 0:
                continue
            vals = g_retry.xs(level, level="level_number", drop_level=True) if level in g_retry.index.get_level_values("level_number") else pd.Series(dtype=float)
            vals = vals.reindex(eligible).fillna(0.0)
            retries_rows[int(level)] = float(vals.mean())
        if retries_rows:
            save_bar(
                pd.Series(retries_rows),
                args.outdir / "retries_by_level_completed_split.png",
                "Average Retries Before Completion Per Level (Players)",
                "Level",
                "Average Retries",
            )

    if "cards_failed" in attempts.columns:
        fr = []
        raw_unknown_count = 0
        inferred_from_unknown_count = 0
        for _, row in attempts.iterrows():
            lvl = pd.to_numeric(row.get("level_number"), errors="coerce")
            for c in row.get("cards_failed") or []:
                if isinstance(c, dict):
                    raw = str(c.get("card_type") or "").strip().lower()
                    if not raw or raw == "unknown":
                        raw_unknown_count += 1
                    inferred = infer_card_type_from_failed(c)
                    if (not raw or raw == "unknown") and inferred != "unknown":
                        inferred_from_unknown_count += 1
                    fr.append({
                        "level_number": int(lvl) if np.isfinite(lvl) else np.nan,
                        "card_type": inferred,
                    })
        fc = pd.DataFrame(fr)
        if not fc.empty:
            by = fc["card_type"].value_counts()
            plt.figure(figsize=(7, 7))
            by.plot(kind="pie", autopct="%1.1f%%")
            plt.title("Failed Cards by Card Type")
            plt.ylabel("")
            plt.tight_layout()
            plt.savefig(args.outdir / "failed_cards_type_pie.png", dpi=120)
            plt.close()
            fc.groupby(["level_number", "card_type"]).size().reset_index(name="count").to_csv(args.outdir / "failed_cards_by_level_type.csv", index=False)
            summary.append(f"failed_cards_raw_unknown_count: {raw_unknown_count}")
            summary.append(f"failed_cards_unknown_recovered_by_inference: {inferred_from_unknown_count}")

    if not settled_players.empty and int(settled_players.max()) >= 1:
        max_settled_level = int(settled_players.max())
        drop_rows: dict[int, float] = {}
        for level in range(1, max_settled_level + 1):
            at_level = int((settled_players >= level).sum())
            at_next = int((settled_players >= (level + 1)).sum())
            if at_level <= 0:
                continue
            drop_rows[level] = ((at_level - at_next) / at_level) * 100.0
        if drop_rows:
            save_bar(
                pd.Series(drop_rows),
                args.outdir / "dropoff_by_level.png",
                "Player Drop-off Rate by Highest Level Completed (Settled Players)",
                "Level",
                "Drop-off Rate (%)",
                (0, 100),
            )

    sandbox_modes = {"sandbox", "practice"}
    sandbox_player_ids: set[str] = set()
    total_player_ids: set[str] = set()
    sandbox_time_seconds = 0.0
    sandbox_dir = args.outdir / "sandbox_statistics"
    sandbox_dir.mkdir(parents=True, exist_ok=True)
    sandbox_time_by_player: dict[str, float] = {}
    if not player_highest_completed.empty:
        total_player_ids = set(player_highest_completed.index.astype(str).tolist())
    if not attempts_with_player.empty and {"mode", "player_id_norm", "time_seconds"} <= set(attempts_with_player.columns):
        a_sb = attempts_with_player[
            attempts_with_player["mode"].astype(str).str.lower().isin(sandbox_modes)
        ].copy()
        sandbox_player_ids.update(a_sb["player_id_norm"].dropna().astype(str).tolist())
        a_sb["time_seconds"] = pd.to_numeric(a_sb["time_seconds"], errors="coerce")
        vals = a_sb["time_seconds"].dropna()
        sandbox_time_seconds = float(vals.sum()) if not vals.empty else 0.0
        by_player = (
            a_sb.dropna(subset=["player_id_norm", "time_seconds"])
            .groupby("player_id_norm")["time_seconds"]
            .sum()
        )
        for pid, secs in by_player.items():
            sandbox_time_by_player[str(pid)] = float(secs)
    if total_player_ids:
        sandbox_percent = (len(sandbox_player_ids) / len(total_player_ids)) * 100.0
        summary.append(f"sandbox_players_percent: {sandbox_percent:.2f}")
        summary.append(f"sandbox_players_count: {len(sandbox_player_ids)}")
        non_sandbox = max(0, len(total_player_ids) - len(sandbox_player_ids))
        plt.figure(figsize=(6, 5))
        plt.bar(["Played Sandbox", "Did Not Play Sandbox"], [len(sandbox_player_ids), non_sandbox])
        plt.title("Sandbox Participation by Unique Players")
        plt.ylabel("Unique Player Count")
        plt.tight_layout()
        plt.savefig(sandbox_dir / "sandbox_participation_unique_players.png", dpi=120)
        plt.close()
    else:
        summary.append("sandbox_players_percent: n/a")
    if sandbox_time_seconds > 0:
        summary.append(f"sandbox_time_seconds_observed: {sandbox_time_seconds:.2f}")
        if sandbox_time_by_player:
            player_time_series = pd.Series(sandbox_time_by_player)
            save_hist_minutes(
                player_time_series,
                sandbox_dir / "sandbox_playtime_per_player_hist.png",
                "Sandbox Playtime Per Unique Player"
            )
            top = (player_time_series / 60.0).sort_values(ascending=False).head(20)
            save_bar(
                top,
                sandbox_dir / "sandbox_top20_players_by_playtime.png",
                "Top 20 Players by Sandbox Playtime",
                "Player (anonymized id)",
                "Sandbox Playtime (minutes)"
            )
    else:
        summary.append("sandbox_time_seconds_observed: n/a")

    (args.outdir / "summary.txt").write_text("\n".join(summary) + "\n", encoding="utf-8")
    if not sessions.empty:
        sessions.to_csv(args.outdir / "sessions.normalized.csv", index=False)
    if not attempts.empty:
        attempts.to_csv(args.outdir / "attempts.normalized.csv", index=False)
    if not events.empty:
        events.to_csv(args.outdir / "events.normalized.csv", index=False)
    print(f"Analysis complete. Outputs written to: {args.outdir}")


if __name__ == "__main__":
    main()
