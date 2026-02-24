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


def save_hist_minutes(values_seconds: pd.Series, path: Path, title: str) -> None:
    clean = pd.to_numeric(values_seconds, errors="coerce").dropna()
    if clean.empty:
        return
    plt.figure(figsize=(8, 5))
    (clean / 60.0).hist(bins=20)
    plt.title(title)
    plt.xlabel("Duration (minutes)")
    plt.ylabel("Session Count")
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


def build_retention_seconds_by_session(
    sessions: pd.DataFrame, attempts: pd.DataFrame, events: pd.DataFrame
) -> pd.Series:
    """Strict gameplay retention seconds per session.

    Uses only summed attempt `time_seconds` (no visibility/session fallback).
    """
    if sessions.empty or attempts.empty or "time_seconds" not in attempts.columns:
        return pd.Series(dtype=float)

    a = add_session_key(attempts.copy())
    a["time_seconds"] = pd.to_numeric(a["time_seconds"], errors="coerce")
    return (
        a.dropna(subset=["session_key", "time_seconds"])
        .groupby("session_key")["time_seconds"]
        .sum()
    )


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
        if "total_playtime_seconds" in sessions.columns:
            summary.append(f"avg_session_minutes: {sessions['total_playtime_seconds'].dropna().mean() / 60.0:.2f}")

    retention_by_session = build_retention_seconds_by_session(sessions, attempts, events)
    summary.append("retention_metric: attempts.time_seconds sum per session (strict gameplay-only)")

    # Retention curves:
    # 1) By level: % of sessions that reached each level at least once.
    # 2) By gameplay time: % of sessions with >= X minutes of gameplay retention.
    if not attempts.empty and "level_number" in attempts.columns:
        a_ret = add_session_key(attempts.copy()).dropna(subset=["session_key", "level_number"])
        if not a_ret.empty:
            session_highest_level = a_ret.groupby("session_key")["level_number"].max().dropna()
            if not session_highest_level.empty:
                max_level = int(session_highest_level.max())
                level_index = pd.Index(range(1, max_level + 1), dtype=int)
                retention_by_level_percent = pd.Series(
                    {
                        level: (session_highest_level >= level).mean() * 100.0
                        for level in level_index
                    },
                    index=level_index,
                )
                save_line(
                    retention_by_level_percent,
                    args.outdir / "retention_percent_by_level.png",
                    "Total Retention by Level",
                    "Level",
                    "Retention (%)",
                    (0, 100),
                )
                summary.append("retention_by_level_percent:")
                for level, rate in retention_by_level_percent.items():
                    summary.append(f"  level_{int(level)}: {rate:.2f}")

    if not sessions.empty:
        s_keys = add_session_key(sessions.copy()).dropna(subset=["session_key"])
        session_keys = pd.Index(s_keys["session_key"].astype(str).unique())
        if len(session_keys) > 0:
            session_retention_seconds = (
                retention_by_session.reindex(session_keys).fillna(0.0).astype(float)
            )
            max_minutes = int(np.ceil(session_retention_seconds.max() / 60.0))
            if max_minutes >= 1:
                minute_index = pd.Index(range(1, max_minutes + 1), dtype=int)
                retention_by_time_percent = pd.Series(
                    {
                        minute: (session_retention_seconds >= (minute * 60.0)).mean() * 100.0
                        for minute in minute_index
                    },
                    index=minute_index,
                )
                save_line(
                    retention_by_time_percent,
                    args.outdir / "retention_percent_by_time_played.png",
                    "Total Retention by Gameplay Time",
                    "Gameplay Time (minutes)",
                    "Retention (%)",
                    (0, 100),
                )
                summary.append("retention_by_time_played_percent:")
                summary.append(f"  max_minutes: {max_minutes}")

    if {"player_id"} <= set(sessions.columns):
        s_ret = add_session_key(sessions.copy())
        s_ret["retention_seconds"] = s_ret["session_key"].map(retention_by_session)
        player_time = s_ret.dropna(subset=["player_id", "retention_seconds"]).groupby("player_id")["retention_seconds"].sum().dropna()
        if not player_time.empty:
            save_hist_minutes(player_time, args.outdir / "session_duration_hist.png", "Total Retention Time Per Unique Player (Inactivity-Excluded)")
            summary.append(f"unique_players_for_duration_hist: {int(player_time.shape[0])}")

    if {"level_number", "passed"} <= set(attempts.columns):
        attempts["passed_flag"] = bool_series(attempts["passed"])
        comp = attempts.dropna(subset=["level_number"]).groupby("level_number")["passed_flag"].mean().sort_index()
        save_bar(comp * 100.0, args.outdir / "completion_by_level.png", "Success Rate Per Level", "Level", "Success Rate (%)", (0, 100))
        summary.append("level_success_rate_percent:")
        for level, rate in comp.items():
            summary.append(f"  level_{int(level)}: {rate * 100.0:.2f}")

    if {"player_id", "last_level_completed"} <= set(sessions.columns):
        per_player_high = sessions.dropna(subset=["player_id"]).groupby("player_id")["last_level_completed"].max()
        if not per_player_high.empty:
            max_level = int(per_player_high.max()) if pd.notna(per_player_high.max()) else 10
            save_hist_values(
                per_player_high,
                args.outdir / "highest_level_reached_hist.png",
                "Highest Level Reached Per Unique Player",
                "Highest Level Reached",
                bins=max(10, max_level)
            )
            summary.append(f"unique_players_for_level_hist: {int(per_player_high.shape[0])}")

    if {"level_number", "time_seconds"} <= set(attempts.columns):
        t = attempts.dropna(subset=["level_number", "time_seconds"]).groupby("level_number")["time_seconds"].mean().sort_index()
        save_bar(t, args.outdir / "avg_time_per_level.png", "Average Play Time Per Level", "Level", "Average Time (seconds)")

    if {"level_number", "stars"} <= set(attempts.columns):
        s = attempts.dropna(subset=["level_number", "stars"]).groupby("level_number")["stars"].mean().sort_index()
        save_bar(s, args.outdir / "avg_stars_per_level.png", "Average Stars Per Level", "Level", "Average Stars")
        smax = attempts.dropna(subset=["level_number", "stars"]).groupby("level_number")["stars"].max().sort_index()
        save_bar(smax, args.outdir / "max_stars_per_level.png", "Max Stars Per Level", "Level", "Max Stars")

    if {"session_key", "level_number", "passed_flag"} <= set(add_session_key(attempts.assign(passed_flag=attempts.get("passed_flag", False))).columns):
        a = add_session_key(attempts)
        if "passed_flag" not in a.columns and "passed" in a.columns:
            a["passed_flag"] = bool_series(a["passed"])
        g = a.dropna(subset=["session_key", "level_number"]).groupby(["session_key", "level_number"]).agg(n=("passed_flag", "size"), completed=("passed_flag", "max")).reset_index()
        if not g.empty:
            g["retries"] = (g["n"] - 1).clip(lower=0)
            r = g.groupby(["level_number", "completed"])["retries"].mean().unstack(fill_value=0).sort_index()
            r = r.rename(columns={False: "Not Completed", True: "Completed"})
            if not r.empty:
                ax = r.plot(kind="bar", figsize=(10, 5))
                ax.set_title("Average Retries Per Level (Completed vs Not Completed)")
                ax.set_xlabel("Level")
                ax.set_ylabel("Average Retries")
                plt.tight_layout()
                plt.savefig(args.outdir / "retries_by_level_completed_split.png", dpi=120)
                plt.close()

    if "rounds" in attempts.columns and "level_number" in attempts.columns:
        rows = []
        for _, row in attempts.iterrows():
            lvl = row.get("level_number")
            rounds = row.get("rounds")
            if not np.isfinite(lvl) or not isinstance(rounds, list):
                continue
            for rr in rounds:
                if isinstance(rr, dict):
                    ts = pd.to_numeric(rr.get("time_spent"), errors="coerce")
                    if np.isfinite(ts):
                        rows.append({"level_number": int(lvl), "time_spent": float(ts)})
        rt = pd.DataFrame(rows)
        if not rt.empty:
            per_level_dir = args.outdir / "round_time_per_level"
            per_level_dir.mkdir(parents=True, exist_ok=True)
            for lvl in sorted(rt["level_number"].unique().tolist()):
                vals = rt[rt["level_number"] == lvl]["time_spent"].dropna()
                if vals.empty:
                    continue
                plt.figure(figsize=(8, 5))
                vals.hist(bins=14)
                plt.title(f"Round Time Distribution - Level {lvl}")
                plt.xlabel("Round Time (seconds)")
                plt.ylabel("Count")
                plt.tight_layout()
                plt.savefig(per_level_dir / f"level_{int(lvl):02d}_round_time_hist.png", dpi=120)
                plt.close()

            summary.append(f"round_time_per_level_graphs: {int(rt['level_number'].nunique())}")

    quit_summary = infer_quit_summary(events, attempts)
    if not quit_summary.empty:
        q = quit_summary["quit_level"].dropna().astype(int).value_counts().sort_index()
        save_bar(q, args.outdir / "quit_level_bar.png", "Which Level Players Quit On", "Level", "Session Count")
        summary.append("quit_level_definition: inferred last active level (level started but not ended if mid-level, otherwise last level started)")
        mid = quit_summary["quit_mid_level"].astype(bool).value_counts()
        plt.figure(figsize=(6, 5))
        plt.bar(["Mid-level", "Between levels"], [int(mid.get(True, 0)), int(mid.get(False, 0))])
        plt.title("Whether Players Quit Mid-Level")
        plt.ylabel("Session Count")
        plt.tight_layout()
        plt.savefig(args.outdir / "quit_mid_level_bar.png", dpi=120)
        plt.close()
        if {"previous_level", "prev_pass"} <= set(quit_summary.columns):
            pp = quit_summary.dropna(subset=["previous_level", "prev_pass"]).groupby("previous_level")["prev_pass"].mean().sort_index()
            save_bar(pp * 100.0, args.outdir / "previous_level_pass_rate_when_quit.png", "Pass Rate of Previous Level When Quit", "Previous Level", "Pass Rate (%)", (0, 100))
        if {"previous_level", "prev_time"} <= set(quit_summary.columns):
            pt = quit_summary.dropna(subset=["previous_level", "prev_time"]).groupby("previous_level")["prev_time"].mean().sort_index()
            save_bar(pt, args.outdir / "previous_level_time_before_quit.png", "Time Spent On Previous Level Before Quit", "Previous Level", "Average Time (seconds)")

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

    if not sessions.empty and not attempts.empty and {"level_number", "passed"} <= set(attempts.columns):
        corr_dir = args.outdir / "early_round_correlations"
        corr_dir.mkdir(parents=True, exist_ok=True)
        a = add_session_key(attempts.copy())
        s = add_session_key(sessions.copy())
        a["passed_flag"] = bool_series(a["passed"])
        a["time_seconds"] = pd.to_numeric(a.get("time_seconds"), errors="coerce")
        g = a.dropna(subset=["session_key", "level_number"]).groupby(["session_key", "level_number"]).agg(
            attempts=("passed_flag", attempts_before_first_pass),
            retries=("passed_flag", lambda x: max(0, len(x) - 1)),
            first_attempt_failed=("passed_flag", lambda x: not bool(x.iloc[0]) if len(x) else np.nan),
            completed=("passed_flag", "max"),
            level_time=("time_seconds", "sum"),
            first_attempt_total_time=("time_seconds", "first"),
        ).reset_index()
        feat = s[["session_key"]].dropna(subset=["session_key"]).drop_duplicates(subset=["session_key"])
        feat["retention_seconds"] = feat["session_key"].map(retention_by_session)
        for lvl in [1, 2, 3]:
            li = g[g["level_number"] == lvl].rename(columns={
                "attempts": f"l{lvl}_attempts_before_first_completion",
                "retries": f"l{lvl}_retries",
                "first_attempt_failed": f"l{lvl}_first_attempt_failed",
                "completed": f"l{lvl}_completed",
                "level_time": f"l{lvl}_total_time",
                "first_attempt_total_time": f"l{lvl}_first_attempt_total_time",
            })
            feat = feat.merge(
                li[
                    [
                        "session_key",
                        f"l{lvl}_attempts_before_first_completion",
                        f"l{lvl}_retries",
                        f"l{lvl}_first_attempt_failed",
                        f"l{lvl}_completed",
                        f"l{lvl}_total_time",
                        f"l{lvl}_first_attempt_total_time",
                    ]
                ],
                on="session_key",
                how="left",
            )
        feat.to_csv(corr_dir / "early_retention_features.csv", index=False)

        corr_rows = []
        f2 = feat.copy()
        for c in f2.columns:
            if c == "session_key":
                continue
            if f2[c].dtype == bool:
                f2[c] = f2[c].astype(int)
            if not pd.api.types.is_numeric_dtype(f2[c]) or c == "retention_seconds":
                continue
            d = f2[[c, "retention_seconds"]].dropna()
            if len(d) >= 5:
                corr_rows.append({"feature": c, "pearson_corr_with_retention": d[c].corr(d["retention_seconds"]), "n": len(d)})
        if corr_rows:
            cdf = pd.DataFrame(corr_rows).sort_values("pearson_corr_with_retention", key=lambda s: s.abs(), ascending=False)
            cdf.to_csv(corr_dir / "early_feature_correlations.csv", index=False)
            plt.figure(figsize=(10, 6))
            top_corr = cdf.head(12).set_index("feature")["pearson_corr_with_retention"]
            top_corr.sort_values().plot(kind="barh")
            plt.title("Top Early Feature Correlations With Retention (Inactivity-Excluded)")
            plt.xlabel("Pearson Correlation")
            plt.ylabel("Feature")
            plt.tight_layout()
            plt.savefig(corr_dir / "top_early_feature_correlations_bar.png", dpi=120)
            plt.close()
            summary.append("top_early_feature_correlations_with_retention:")
            for _, r in cdf.head(10).iterrows():
                summary.append(f"  {r['feature']}: corr={r['pearson_corr_with_retention']:.3f}, n={int(r['n'])}")

    if {"event_type", "level_number"} <= set(events.columns):
        st = events[events["event_type"] == "level_start"].dropna(subset=["level_number"]).groupby("level_number").size()
        en = events[events["event_type"] == "level_end"].dropna(subset=["level_number"]).groupby("level_number").size()
        lv = sorted(set(st.index.tolist()) | set(en.index.tolist()))
        if lv:
            dr = pd.Series({x: max(0.0, (float(st.get(x, 0)) - float(en.get(x, 0))) / float(st.get(x, 1)) * 100.0) for x in lv})
            save_bar(dr, args.outdir / "dropoff_by_level.png", "Level Drop-off Rate (Starts without Ends)", "Level", "Drop-off Rate (%)", (0, 100))

    sandbox_modes = {"sandbox", "practice"}
    sandbox_player_ids: set[str] = set()
    total_player_ids: set[str] = set()
    sandbox_time_seconds = 0.0
    sandbox_time_count = 0
    sandbox_dir = args.outdir / "sandbox_statistics"
    sandbox_dir.mkdir(parents=True, exist_ok=True)
    sandbox_time_by_player: dict[str, float] = {}
    if "player_id" in sessions.columns:
        total_player_ids = set(sessions["player_id"].dropna().astype(str).tolist())
    if not attempts.empty and {"mode", "player_id"} <= set(attempts.columns):
        a_sb = attempts[attempts["mode"].astype(str).str.lower().isin(sandbox_modes)]
        sandbox_player_ids.update(a_sb["player_id"].dropna().astype(str).tolist())
        if "time_seconds" in a_sb.columns:
            vals = pd.to_numeric(a_sb["time_seconds"], errors="coerce").dropna()
            sandbox_time_seconds += float(vals.sum())
            sandbox_time_count += int(vals.shape[0])
            by_player = (
                a_sb.assign(time_seconds_num=pd.to_numeric(a_sb["time_seconds"], errors="coerce"))
                .dropna(subset=["player_id", "time_seconds_num"])
                .groupby(a_sb["player_id"].astype(str))["time_seconds_num"]
                .sum()
            )
            for pid, secs in by_player.items():
                sandbox_time_by_player[str(pid)] = sandbox_time_by_player.get(str(pid), 0.0) + float(secs)
    if not events.empty and {"mode", "player_id"} <= set(events.columns):
        e_sb = events[events["mode"].astype(str).str.lower().isin(sandbox_modes)]
        sandbox_player_ids.update(e_sb["player_id"].dropna().astype(str).tolist())
        if "time_spent_seconds" in e_sb.columns:
            vals = pd.to_numeric(e_sb["time_spent_seconds"], errors="coerce").dropna()
            sandbox_time_seconds += float(vals.sum())
            sandbox_time_count += int(vals.shape[0])
            # Fallback time source if attempts-based sandbox timing is sparse.
            if not sandbox_time_by_player:
                by_player = (
                    e_sb.assign(time_spent_num=pd.to_numeric(e_sb["time_spent_seconds"], errors="coerce"))
                    .dropna(subset=["player_id", "time_spent_num"])
                    .groupby(e_sb["player_id"].astype(str))["time_spent_num"]
                    .sum()
                )
                for pid, secs in by_player.items():
                    sandbox_time_by_player[str(pid)] = sandbox_time_by_player.get(str(pid), 0.0) + float(secs)
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
    if sandbox_time_count > 0:
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
