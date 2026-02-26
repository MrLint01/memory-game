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


def retries_before_after_first_pass(passed_series: pd.Series) -> tuple[int, int]:
    vals = passed_series.astype(bool).tolist()
    if not vals:
        return 0, 0
    for i, ok in enumerate(vals):
        if ok:
            return i, max(0, len(vals) - i - 1)
    return max(0, len(vals) - 1), 0


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

def analyze_level_dropoff_metrics(
    attempts_with_player: pd.DataFrame,
    player_highest_completed: pd.Series,
    outdir: Path
) -> None:
    """Generate playtime and retry graphs for players who dropped off between levels."""
    if attempts_with_player.empty or player_highest_completed.empty:
        return
    
    if not {"player_id_norm", "level_number", "time_seconds", "passed"} <= set(attempts_with_player.columns):
        return
    
    dropoff_dir = outdir / "level_dropoff_analysis"
    dropoff_dir.mkdir(parents=True, exist_ok=True)
    
    attempts_with_player["passed_flag"] = bool_series(attempts_with_player["passed"])
    attempts_with_player["time_seconds"] = pd.to_numeric(attempts_with_player["time_seconds"], errors="coerce")
    
    # Helper to get players who completed level X but not level Y
    def get_dropoff_players(completed_level: int, not_completed_level: int) -> set[str]:
        # Players whose highest completed level is exactly completed_level
        return set(
            player_highest_completed[player_highest_completed == completed_level]
            .index.astype(str)
            .tolist()
        )
    
    # 1. Playtime: Completed L1, did not complete L2
    l1_dropoff = get_dropoff_players(1, 2)
    if l1_dropoff:
        playtime_l1 = (
            attempts_with_player[
                attempts_with_player["player_id_norm"].isin(l1_dropoff)
                & (attempts_with_player["level_number"] == 1)
            ]
            .groupby("player_id_norm")["time_seconds"]
            .first()  # Changed from .sum() to .first()
        )
        save_hist_values(
            playtime_l1,
            dropoff_dir / "playtime_level1_dropoff_before_level2.png",
            "First Attempt Playtime on Level 1 (Players Who Completed L1 But Not L2)",
            "Time (seconds)",
            bins=20,
        )

    # 2. Playtime: Completed L2, did not complete L3
    l2_dropoff = get_dropoff_players(2, 3)
    if l2_dropoff:
        playtime_l2 = (
            attempts_with_player[
                attempts_with_player["player_id_norm"].isin(l2_dropoff)
                & (attempts_with_player["level_number"] == 2)
            ]
            .groupby("player_id_norm")["time_seconds"]
            .first()  # Changed from .sum() to .first()
        )
        save_hist_values(
            playtime_l2,
            dropoff_dir / "playtime_level2_dropoff_before_level3.png",
            "First Attempt Playtime on Level 2 (Players Who Completed L2 But Not L3)",
            "Time (seconds)",
            bins=20,
        )
    
    # 3. Retries: Completed L1, did not complete L2
    if l1_dropoff:
        l1_attempts = attempts_with_player[
            attempts_with_player["player_id_norm"].isin(l1_dropoff)
            & (attempts_with_player["level_number"] == 1)
        ]
        retries_split = (
            l1_attempts.groupby("player_id_norm")["passed_flag"]
            .apply(retries_before_after_first_pass)
            .apply(pd.Series)
        )
        retries_split.columns = ["before_completion", "after_completion"]
        retries_split.index = [str(pid)[:6] for pid in retries_split.index]
        
        plt.figure(figsize=(10, 5))
        retries_split.plot(kind="bar", color=["#1f77b4", "#ff7f0e"])
        plt.title("Retries on Level 1 (Players Who Completed L1 But Not L2)")
        plt.xlabel("Player")
        plt.ylabel("Number of Retries")
        plt.legend(["Before Completion", "After Completion"])
        plt.tight_layout()
        plt.savefig(dropoff_dir / "retries_level1_dropoff_before_level2.png", dpi=120)
        plt.close()

    # 4. Retries: Completed L2, did not complete L3
    if l2_dropoff:
        l2_attempts = attempts_with_player[
            attempts_with_player["player_id_norm"].isin(l2_dropoff)
            & (attempts_with_player["level_number"] == 2)
        ]
        retries_split = (
            l2_attempts.groupby("player_id_norm")["passed_flag"]
            .apply(retries_before_after_first_pass)
            .apply(pd.Series)
        )
        retries_split.columns = ["before_completion", "after_completion"]
        retries_split.index = [str(pid)[:6] for pid in retries_split.index]
        
        plt.figure(figsize=(10, 5))
        retries_split.plot(kind="bar", color=["#1f77b4", "#ff7f0e"])
        plt.title("Retries on Level 2 (Players Who Completed L2 But Not L3)")
        plt.xlabel("Player")
        plt.ylabel("Number of Retries")
        plt.legend(["Before Completion", "After Completion"])
        plt.tight_layout()
        plt.savefig(dropoff_dir / "retries_level2_dropoff_before_level3.png", dpi=120)
        plt.close()
    
    # Graphs for players who DID complete the next level
    l1_continued = set(player_highest_completed[player_highest_completed >= 2].index.astype(str).tolist())
    l2_continued = set(player_highest_completed[player_highest_completed >= 3].index.astype(str).tolist())

    # 5. First attempt playtime L1 (players who completed L2+)
    if l1_continued:
        playtime_l1_cont = (
            attempts_with_player[
                attempts_with_player["player_id_norm"].isin(l1_continued)
                & (attempts_with_player["level_number"] == 1)
            ]
            .groupby("player_id_norm")["time_seconds"]
            .first()
        )
        save_hist_values(
            playtime_l1_cont,
            dropoff_dir / "playtime_level1_continued_to_level2.png",
            "First Attempt Playtime on Level 1 (Players Who Completed L2+)",
            "Time (seconds)",
            bins=20,
        )

    # 6. First attempt playtime L2 (players who completed L3+)
    if l2_continued:
        playtime_l2_cont = (
            attempts_with_player[
                attempts_with_player["player_id_norm"].isin(l2_continued)
                & (attempts_with_player["level_number"] == 2)
            ]
            .groupby("player_id_norm")["time_seconds"]
            .first()
        )
        save_hist_values(
            playtime_l2_cont,
            dropoff_dir / "playtime_level2_continued_to_level3.png",
            "First Attempt Playtime on Level 2 (Players Who Completed L3+)",
            "Time (seconds)",
            bins=20,
        )

    # 7. Retries L1 (players who completed L2+)
    if l1_continued:
        l1_cont_attempts = attempts_with_player[
            attempts_with_player["player_id_norm"].isin(l1_continued)
            & (attempts_with_player["level_number"] == 1)
        ]
        retries_split = (
            l1_cont_attempts.groupby("player_id_norm")["passed_flag"]
            .apply(retries_before_after_first_pass)
            .apply(pd.Series)
        )
        retries_split.columns = ["before_completion", "after_completion"]
        retries_split.index = [str(pid)[:6] for pid in retries_split.index]
        
        plt.figure(figsize=(10, 5))
        retries_split.plot(kind="bar", color=["#1f77b4", "#ff7f0e"])
        plt.title("Retries on Level 1 (Players Who Completed L2+)")
        plt.xlabel("Player")
        plt.ylabel("Number of Retries")
        plt.legend(["Before Completion", "After Completion"])
        plt.tight_layout()
        plt.savefig(dropoff_dir / "retries_level1_continued_to_level2.png", dpi=120)
        plt.close()

    # 8. Retries L2 (players who completed L3+)
    if l2_continued:
        l2_cont_attempts = attempts_with_player[
            attempts_with_player["player_id_norm"].isin(l2_continued)
            & (attempts_with_player["level_number"] == 2)
        ]
        retries_split = (
            l2_cont_attempts.groupby("player_id_norm")["passed_flag"]
            .apply(retries_before_after_first_pass)
            .apply(pd.Series)
        )
        retries_split.columns = ["before_completion", "after_completion"]
        retries_split.index = [str(pid)[:6] for pid in retries_split.index]
        
        plt.figure(figsize=(10, 5))
        retries_split.plot(kind="bar", color=["#1f77b4", "#ff7f0e"])
        plt.title("Retries on Level 2 (Players Who Completed L3+)")
        plt.xlabel("Player")
        plt.ylabel("Number of Retries")
        plt.legend(["Before Completion", "After Completion"])
        plt.tight_layout()
        plt.savefig(dropoff_dir / "retries_level2_continued_to_level3.png", dpi=120)
        plt.close()

        # Check if dropoff players attempted the next level
    l1_dropoff_attempted_l2 = set(
        attempts_with_player[
            attempts_with_player["player_id_norm"].isin(l1_dropoff)
            & (attempts_with_player["level_number"] == 2)
        ]["player_id_norm"].unique()
    )
    l1_dropoff_not_attempted_l2 = l1_dropoff - l1_dropoff_attempted_l2

    plt.figure(figsize=(7, 5))
    plt.bar(
        ["Attempted L2", "Did Not Attempt L2"],
        [len(l1_dropoff_attempted_l2), len(l1_dropoff_not_attempted_l2)],
        color=["#2ecc71", "#e74c3c"]
    )
    plt.title("L2 Attempt Rate (Players Who Completed L1 But Not L2)")
    plt.ylabel("Player Count")
    plt.tight_layout()
    plt.savefig(dropoff_dir / "level2_attempt_rate_by_l1_dropoff.png", dpi=120)
    plt.close()

    l2_dropoff_attempted_l3 = set(
        attempts_with_player[
            attempts_with_player["player_id_norm"].isin(l2_dropoff)
            & (attempts_with_player["level_number"] == 3)
        ]["player_id_norm"].unique()
    )
    l2_dropoff_not_attempted_l3 = l2_dropoff - l2_dropoff_attempted_l3

    plt.figure(figsize=(7, 5))
    plt.bar(
        ["Attempted L3", "Did Not Attempt L3"],
        [len(l2_dropoff_attempted_l3), len(l2_dropoff_not_attempted_l3)],
        color=["#2ecc71", "#e74c3c"]
    )
    plt.title("L3 Attempt Rate (Players Who Completed L2 But Not L3)")
    plt.ylabel("Player Count")
    plt.tight_layout()
    plt.savefig(dropoff_dir / "level3_attempt_rate_by_l2_dropoff.png", dpi=120)
    plt.close()

    # Add summary statistics
    summary_lines = [
        f"Players who completed L1 but not L2: {len(l1_dropoff)}",
        f"Players who completed L2 but not L3: {len(l2_dropoff)}",
    ]
    (dropoff_dir / "dropoff_summary.txt").write_text("\n".join(summary_lines), encoding="utf-8")

def sort_attempts_for_sequence(attempts_df: pd.DataFrame) -> pd.DataFrame:
    """Sort attempts in likely chronological order for sequence-derived metrics."""
    out = attempts_df.copy()
    out["_row_order"] = np.arange(len(out))
    if "created_at" in out.columns:
        out["_created_at_ts"] = pd.to_datetime(out["created_at"], utc=True, errors="coerce")
        return out.sort_values(["_created_at_ts", "_row_order"], na_position="last")
    return out.sort_values(["_row_order"])


def level_attempt_mask(feat_df: pd.DataFrame, level: int) -> pd.Series:
    """Mask of players who attempted a given level at least once."""
    candidate_cols = [
        f"l{level}_first_attempt_succeeded",
        f"l{level}_failed_first_attempt",
        f"l{level}_first_attempt_time",
    ]
    available = [c for c in candidate_cols if c in feat_df.columns]
    if not available:
        return pd.Series(False, index=feat_df.index)
    mask = pd.Series(False, index=feat_df.index)
    for c in available:
        mask = mask | feat_df[c].notna()
    return mask


def pearson_with_bootstrap_ci(
    x: pd.Series,
    y: pd.Series,
    n_boot: int = 1000,
    ci: float = 0.95,
    seed: int = 42,
) -> tuple[float, float, float]:
    """Return Pearson r and bootstrap CI bounds."""
    d = pd.DataFrame({"x": pd.to_numeric(x, errors="coerce"), "y": pd.to_numeric(y, errors="coerce")}).dropna()
    if len(d) < 3:
        return np.nan, np.nan, np.nan
    xv = d["x"].to_numpy(dtype=float)
    yv = d["y"].to_numpy(dtype=float)
    if np.std(xv) == 0 or np.std(yv) == 0:
        return np.nan, np.nan, np.nan

    r = float(np.corrcoef(xv, yv)[0, 1])
    rng = np.random.default_rng(seed)
    boot_vals: list[float] = []
    n = len(xv)
    for _ in range(n_boot):
        idx = rng.integers(0, n, size=n)
        xb = xv[idx]
        yb = yv[idx]
        if np.std(xb) == 0 or np.std(yb) == 0:
            continue
        rb = float(np.corrcoef(xb, yb)[0, 1])
        if np.isfinite(rb):
            boot_vals.append(rb)
    if not boot_vals:
        return r, np.nan, np.nan

    alpha = 1.0 - ci
    lo = float(np.percentile(boot_vals, 100.0 * (alpha / 2.0)))
    hi = float(np.percentile(boot_vals, 100.0 * (1.0 - alpha / 2.0)))
    return r, lo, hi


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
    if not player_highest_completed.empty:
        retention_levels = pd.Index(range(0, max(1, max_completed_level) + 1), dtype=int)
        retention_by_level_percent = pd.Series(
            {level: (player_highest_completed >= level).mean() * 100.0 for level in retention_levels},
            index=retention_levels,
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
            qdf = pd.DataFrame({
                "player_id_norm": quit_level_by_player.index.astype(str),
                "quit_level": quit_level_by_player.values.astype(int),
            })
            qdf["previous_level"] = qdf["quit_level"] - 1
            qdf = qdf[qdf["previous_level"] >= 1].copy()
            if not qdf.empty:
                quit_prev_levels = sorted(qdf["previous_level"].astype(int).unique().tolist())
                # Event-based quit outcome:
                # At each quit event (per session), was the last attempt before quit a success or failure?
                quit_outcomes = pd.DataFrame()
                if not events.empty and "event_type" in events.columns and not attempts.empty:
                    e_quit = add_session_key(events.copy())
                    e_quit["event_type_norm"] = e_quit["event_type"].astype(str).str.strip().str.lower()
                    quit_event_types = {"quit_reason", "quit_inferred_inactivity", "before_unload"}
                    e_quit = e_quit[e_quit["event_type_norm"].isin(quit_event_types)].copy()
                    e_quit["quit_time"] = pd.to_numeric(e_quit.get("client_timestamp_ms"), errors="coerce")
                    fallback_ts = pd.to_datetime(e_quit.get("event_timestamp"), utc=True, errors="coerce")
                    fallback_ms = (fallback_ts.astype("int64") / 1_000_000).where(fallback_ts.notna(), np.nan)
                    e_quit["quit_time"] = e_quit["quit_time"].fillna(fallback_ms)
                    e_quit = e_quit.dropna(subset=["session_key", "quit_time"])
                    if not e_quit.empty:
                        quit_latest = (
                            e_quit.sort_values("quit_time")
                            .groupby("session_key", as_index=False)
                            .tail(1)[["session_key", "quit_time"]]
                        )
                        a_quit = add_session_key(attempts.copy())
                        if "passed_flag" not in a_quit.columns:
                            a_quit["passed_flag"] = bool_series(a_quit["passed"]) if "passed" in a_quit.columns else False
                        a_quit["attempt_time"] = pd.to_datetime(a_quit.get("created_at"), utc=True, errors="coerce")
                        a_quit["attempt_time_ms"] = (a_quit["attempt_time"].astype("int64") / 1_000_000).where(a_quit["attempt_time"].notna(), np.nan)
                        rows: list[dict[str, Any]] = []
                        for _, qr in quit_latest.iterrows():
                            sk = qr["session_key"]
                            qt = float(qr["quit_time"])
                            aa = a_quit[a_quit["session_key"] == sk].copy()
                            if aa.empty:
                                continue
                            aa_valid = aa.dropna(subset=["attempt_time_ms"]).sort_values("attempt_time_ms")
                            if not aa_valid.empty:
                                aa_valid = aa_valid[aa_valid["attempt_time_ms"] <= qt]
                            if aa_valid.empty:
                                # If attempt timestamps are missing/no match, use last attempt in session as fallback.
                                aa_valid = aa.sort_index()
                            if aa_valid.empty:
                                continue
                            last_attempt = aa_valid.iloc[-1]
                            rows.append(
                                {
                                    "session_key": sk,
                                    "last_attempt_passed": bool(last_attempt.get("passed_flag", False)),
                                }
                            )
                        quit_outcomes = pd.DataFrame(rows)

                if not quit_outcomes.empty:
                    pass_pct = float(quit_outcomes["last_attempt_passed"].mean() * 100.0)
                    fail_pct = 100.0 - pass_pct
                    plt.figure(figsize=(7, 5))
                    plt.bar(
                        ["Last Attempt Succeeded", "Last Attempt Failed"],
                        [pass_pct, fail_pct],
                        color=["#1f77b4", "#1f77b4"],
                    )
                    plt.title("Last Attempt Outcome at Quit Event")
                    plt.xlabel("Outcome")
                    plt.ylabel("Percent of Quits (%)")
                    plt.ylim(0, 100)
                    plt.tight_layout()
                    plt.savefig(args.outdir / "previous_level_pass_rate_when_quit.png", dpi=120)
                    plt.close()
                    summary.append(f"quit_events_with_last_attempt: {int(quit_outcomes.shape[0])}")
                    summary.append(f"quit_events_last_attempt_failed_percent: {fail_pct:.2f}")
                else:
                    summary.append("quit_events_with_last_attempt: 0")

                # Use the exact same quit rows and level index for previous-level time.
                attempts_with_player["time_seconds"] = pd.to_numeric(attempts_with_player.get("time_seconds"), errors="coerce")
                player_level_pass = (
                    attempts_with_player[
                        attempts_with_player["player_id_norm"].notna() & attempts_with_player["level_number"].notna()
                    ]
                    .groupby(["player_id_norm", "level_number"])["passed_flag"]
                    .max()
                )
                qdf["prev_pass"] = [
                    bool(player_level_pass.get((pid, float(prev)), False))
                    or bool(player_level_pass.get((pid, int(prev)), False))
                    for pid, prev in zip(qdf["player_id_norm"], qdf["previous_level"])
                ]
                player_level_passed_time = (
                    attempts_with_player[
                        attempts_with_player["passed_flag"]
                        & attempts_with_player["player_id_norm"].notna()
                        & attempts_with_player["level_number"].notna()
                        & attempts_with_player["time_seconds"].notna()
                    ]
                    .groupby(["player_id_norm", "level_number"])["time_seconds"]
                    .mean()
                )
                qdf["prev_level_time_seconds"] = [
                    float(player_level_passed_time.get((pid, float(prev)), np.nan))
                    if pd.notna(player_level_passed_time.get((pid, float(prev)), np.nan))
                    else float(player_level_passed_time.get((pid, int(prev)), 0.0))
                    for pid, prev in zip(qdf["player_id_norm"], qdf["previous_level"])
                ]
                pt = qdf.groupby("previous_level")["prev_level_time_seconds"].mean().sort_index().reindex(quit_prev_levels, fill_value=0.0)
                save_bar(
                    pt,
                    args.outdir / "previous_level_time_before_quit.png",
                    "Previous-Level Completion Time When Players Quit",
                    "Previous Level",
                    "Average Time (seconds)",
                )

    if {"player_id_norm", "level_number", "time_seconds", "passed"} <= set(attempts_with_player.columns) and not player_highest_completed.empty and max_completed_level >= 1:
        attempts_with_player["passed_flag"] = bool_series(attempts_with_player["passed"])
        a_time = attempts_with_player[
            attempts_with_player["passed_flag"]
            & attempts_with_player["player_id_norm"].notna()
            & attempts_with_player["level_number"].notna()
            & attempts_with_player["time_seconds"].notna()
        ].copy()
        avg_time_rows: dict[int, float] = {}
        if not a_time.empty:
            # Player-based average completion time per level:
            # First average each player's passed attempts at the level, then average across players.
            player_level_mean_time = a_time.groupby(["player_id_norm", "level_number"])["time_seconds"].mean()
            for level in level_index:
                eligible = player_highest_completed[player_highest_completed >= level].index
                if len(eligible) == 0:
                    continue
                vals = (
                    player_level_mean_time.xs(level, level="level_number", drop_level=True)
                    if level in player_level_mean_time.index.get_level_values("level_number")
                    else pd.Series(dtype=float)
                )
                vals = vals.reindex(eligible).dropna()
                if vals.empty:
                    continue
                avg_time_rows[int(level)] = float(vals.mean())
        if avg_time_rows:
            save_bar(
                pd.Series(avg_time_rows),
                args.outdir / "avg_time_per_level.png",
                "Average Completion Attempt Time Per Level (Players)",
                "Level",
                "Average Time (seconds)",
            )

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
        a_retry = sort_attempts_for_sequence(a_retry)
        g_retry = a_retry.groupby(["player_id_norm", "level_number"])["passed_flag"].apply(retries_before_after_first_pass)
        g_retry_df = g_retry.apply(pd.Series)
        g_retry_df.columns = ["before_completion", "after_completion"]
        retries_before_rows: dict[int, float] = {}
        retries_after_rows: dict[int, float] = {}
        for level in level_index:
            eligible = player_highest_completed[player_highest_completed >= level].index
            if len(eligible) == 0:
                continue
            if level in g_retry_df.index.get_level_values("level_number"):
                vals_df = g_retry_df.xs(level, level="level_number", drop_level=True)
            else:
                vals_df = pd.DataFrame(index=pd.Index([], dtype=object), columns=["before_completion", "after_completion"])
            vals_df = vals_df.reindex(eligible).fillna(0.0)
            retries_before_rows[int(level)] = float(vals_df["before_completion"].mean())
            retries_after_rows[int(level)] = float(vals_df["after_completion"].mean())
        if retries_before_rows:
            plot_df = pd.DataFrame(
                {
                    "Before Completion": pd.Series(retries_before_rows),
                    "After Completion": pd.Series(retries_after_rows),
                }
            )
            ax = plot_df.plot(kind="bar", figsize=(10, 5), color=["#1f77b4", "#ff7f0e"])
            ax.set_title("Average Retries Per Level (Before vs After Completion)")
            ax.set_xlabel("Level")
            ax.set_ylabel("Average Retries")
            plt.tight_layout()
            plt.savefig(args.outdir / "retries_by_level_completed_split.png", dpi=120)
            plt.close()

    # Round-time histograms per level (successful rounds only).
    if "rounds" in attempts.columns and "level_number" in attempts.columns:
        rows: list[dict[str, float]] = []
        for _, row in attempts.iterrows():
            lvl = pd.to_numeric(row.get("level_number"), errors="coerce")
            rounds = row.get("rounds")
            if not np.isfinite(lvl) or not isinstance(rounds, list):
                continue
            for rr in rounds:
                if not isinstance(rr, dict):
                    continue
                passed_round = str(rr.get("passed")).strip().lower() in TRUE_VALUES
                if not passed_round:
                    continue
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
                plt.title(f"Round Time Distribution (Successful Rounds) - Level {lvl}")
                plt.xlabel("Round Time (seconds)")
                plt.ylabel("Count")
                plt.tight_layout()
                plt.savefig(per_level_dir / f"level_{int(lvl):02d}_round_time_hist.png", dpi=120)
                plt.close()
            summary.append(f"round_time_per_level_graphs_success_only: {int(rt['level_number'].nunique())}")

    # Early-level correlation features (player-level).
    # Requested feature set excludes retries and total_time for L1-L3.
    if (
        {"player_id_norm", "level_number", "passed"} <= set(attempts_with_player.columns)
        and not player_retention_seconds.empty
    ):
        corr_dir = args.outdir / "early_round_correlations"
        corr_dir.mkdir(parents=True, exist_ok=True)

        attempts_with_player["passed_flag"] = bool_series(attempts_with_player["passed"])
        attempts_with_player["time_seconds"] = pd.to_numeric(attempts_with_player.get("time_seconds"), errors="coerce")
        a_early = attempts_with_player.dropna(subset=["player_id_norm", "level_number"]).copy()
        a_early = sort_attempts_for_sequence(a_early)
        g_early = a_early.groupby(["player_id_norm", "level_number"]).agg(
            attempts_before_first_completion=("passed_flag", attempts_before_first_pass),
            failed_first_attempt=("passed_flag", lambda x: (len(x) > 0) and (not bool(x.iloc[0]))),
            first_attempt_succeeded=("passed_flag", lambda x: bool(x.iloc[0]) if len(x) > 0 else np.nan),
            first_attempt_time=("time_seconds", "first"),
        ).reset_index()

        feat = pd.DataFrame(index=player_retention_seconds.index.astype(str))
        feat.index.name = "player_id_norm"
        feat["retention_seconds"] = player_retention_seconds.reindex(feat.index).fillna(0.0).astype(float)

        for lvl in [1, 2, 3]:
            li = g_early[g_early["level_number"] == lvl].rename(
                columns={
                    "attempts_before_first_completion": f"l{lvl}_attempts_before_first_completion",
                    "failed_first_attempt": f"l{lvl}_failed_first_attempt",
                    "first_attempt_succeeded": f"l{lvl}_first_attempt_succeeded",
                    "first_attempt_time": f"l{lvl}_first_attempt_time",
                }
            ).set_index("player_id_norm")

            for col in [
                f"l{lvl}_attempts_before_first_completion",
                f"l{lvl}_failed_first_attempt",
                f"l{lvl}_first_attempt_succeeded",
                f"l{lvl}_first_attempt_time",
            ]:
                if col in li.columns:
                    feat[col] = li[col].reindex(feat.index)
            # Preserve NaN for first-attempt outcome fields so they represent "did not attempt".
            for bcol in [f"l{lvl}_failed_first_attempt", f"l{lvl}_first_attempt_succeeded"]:
                if bcol in feat.columns:
                    feat[bcol] = feat[bcol].map(
                        lambda v: True if str(v).strip().lower() == "true" else (False if str(v).strip().lower() == "false" else np.nan)
                    )
            # Missing counts are zero attempts before first completion.
            acol = f"l{lvl}_attempts_before_first_completion"
            if acol in feat.columns:
                feat[acol] = pd.to_numeric(feat[acol], errors="coerce").fillna(0.0)

        feat.reset_index().to_csv(corr_dir / "early_retention_features.csv", index=False)

        corr_rows = []
        f2 = feat.copy()
        for i, c in enumerate(f2.columns):
            if c == "retention_seconds":
                continue
            raw = f2[c]
            # First, try numeric coercion (handles numeric-looking object columns).
            series_num = pd.to_numeric(raw, errors="coerce")
            if series_num.notna().sum() >= max(1, int(0.5 * raw.notna().sum())):
                series = series_num
            else:
                # Fallback for bool-like/object features (e.g., failed_first_attempt).
                series = raw.map(
                    lambda v: (
                        1 if str(v).strip().lower() in {"true", "1", "yes", "y", "t"} else
                        0 if str(v).strip().lower() in {"false", "0", "no", "n", "f"} else
                        np.nan
                    )
                )
            d = pd.DataFrame({"x": series, "retention_seconds": f2["retention_seconds"]})
            m = re.match(r"^l([123])_", str(c))
            if m:
                lvl = int(m.group(1))
                d = d[level_attempt_mask(f2, lvl)]
            d = d.dropna()
            if len(d) >= 5:
                r, ci_low, ci_high = pearson_with_bootstrap_ci(
                    d["x"], d["retention_seconds"], n_boot=1000, ci=0.95, seed=42 + i
                )
                corr_rows.append(
                    {
                        "feature": c,
                        "pearson_corr_with_retention": r,
                        "pearson_ci_low_95": ci_low,
                        "pearson_ci_high_95": ci_high,
                        "n": len(d),
                    }
                )

        if corr_rows:
            cdf = pd.DataFrame(corr_rows).sort_values(
                "pearson_corr_with_retention",
                key=lambda s: s.abs(),
                ascending=False,
            )
            cdf.to_csv(corr_dir / "early_feature_correlations.csv", index=False)
            plt.figure(figsize=(10, 6))
            plot_cdf = cdf[~cdf["feature"].astype(str).str.endswith("_completed")].copy()
            top_df = plot_cdf.head(12).set_index("feature")[
                ["pearson_corr_with_retention", "pearson_ci_low_95", "pearson_ci_high_95"]
            ].sort_values("pearson_corr_with_retention")
            vals = top_df["pearson_corr_with_retention"]
            err_left = (vals - top_df["pearson_ci_low_95"]).clip(lower=0).fillna(0.0)
            err_right = (top_df["pearson_ci_high_95"] - vals).clip(lower=0).fillna(0.0)
            xerr = np.vstack([err_left.to_numpy(), err_right.to_numpy()])
            plt.barh(vals.index, vals.to_numpy(), xerr=xerr, color="#4C72B0", ecolor="#333333", capsize=3)
            plt.title("Feature vs Retention Correlation")
            plt.xlabel("Correlation (r)")
            plt.ylabel("Feature")
            plt.tight_layout()
            plt.savefig(corr_dir / "top_early_feature_correlations_bar.png", dpi=120)
            plt.close()

            # Secondary chart: same features, with retention outliers removed.
            # Outliers-removed view: explicitly exclude the known high-retention outlier player.
            excluded_outlier_player_id = "21f368e9-852a-47d9-9df1-bf1ee65d6992"
            feat_trim = feat[feat.index.astype(str) != excluded_outlier_player_id].copy()
            summary.append(f"early_corr_outlier_excluded_player_id: {excluded_outlier_player_id}")
            summary.append(f"early_corr_rows_removed_as_outliers: {int(max(0, len(feat) - len(feat_trim)))}")

            corr_rows_trim = []
            for i, c in enumerate(feat_trim.columns):
                if c == "retention_seconds":
                    continue
                raw_t = feat_trim[c]
                series_num_t = pd.to_numeric(raw_t, errors="coerce")
                if series_num_t.notna().sum() >= max(1, int(0.5 * raw_t.notna().sum())):
                    series_t = series_num_t
                else:
                    series_t = raw_t.map(
                        lambda v: (
                            1 if str(v).strip().lower() in {"true", "1", "yes", "y", "t"} else
                            0 if str(v).strip().lower() in {"false", "0", "no", "n", "f"} else
                            np.nan
                        )
                    )
                d_t = pd.DataFrame({"x": series_t, "retention_seconds": feat_trim["retention_seconds"]})
                m_t = re.match(r"^l([123])_", str(c))
                if m_t:
                    lvl_t = int(m_t.group(1))
                    d_t = d_t[level_attempt_mask(feat_trim, lvl_t)]
                d_t = d_t.dropna()
                if len(d_t) >= 5:
                    r_t, ci_low_t, ci_high_t = pearson_with_bootstrap_ci(
                        d_t["x"], d_t["retention_seconds"], n_boot=1000, ci=0.95, seed=1042 + i
                    )
                    corr_rows_trim.append(
                        {
                            "feature": c,
                            "pearson_corr_with_retention": r_t,
                            "pearson_ci_low_95": ci_low_t,
                            "pearson_ci_high_95": ci_high_t,
                            "n": len(d_t),
                        }
                    )

            if corr_rows_trim:
                cdf_trim = pd.DataFrame(corr_rows_trim).sort_values(
                    "pearson_corr_with_retention",
                    key=lambda s: s.abs(),
                    ascending=False,
                )
                cdf_trim.to_csv(corr_dir / "early_feature_correlations_outliers_removed.csv", index=False)
                plt.figure(figsize=(10, 6))
                plot_cdf_trim = cdf_trim[~cdf_trim["feature"].astype(str).str.endswith("_completed")].copy()
                top_df_trim = plot_cdf_trim.head(12).set_index("feature")[
                    ["pearson_corr_with_retention", "pearson_ci_low_95", "pearson_ci_high_95"]
                ].sort_values("pearson_corr_with_retention")
                vals_t = top_df_trim["pearson_corr_with_retention"]
                err_left_t = (vals_t - top_df_trim["pearson_ci_low_95"]).clip(lower=0).fillna(0.0)
                err_right_t = (top_df_trim["pearson_ci_high_95"] - vals_t).clip(lower=0).fillna(0.0)
                xerr_t = np.vstack([err_left_t.to_numpy(), err_right_t.to_numpy()])
                plt.barh(vals_t.index, vals_t.to_numpy(), xerr=xerr_t, color="#4C72B0", ecolor="#333333", capsize=3)
                plt.title("Feature vs Retention Correlation (Outliers Removed)")
                plt.xlabel("Correlation (r)")
                plt.ylabel("Feature")
                plt.tight_layout()
                plt.savefig(corr_dir / "top_early_feature_correlations_bar_outliers_removed.png", dpi=120)
                plt.close()

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

    sandbox_modes = {"sandbox", "practice"}
    sandbox_player_ids: set[str] = set()
    total_player_ids: set[str] = set()
    sandbox_time_seconds = 0.0
    sandbox_dir = args.outdir / "sandbox_statistics"
    sandbox_dir.mkdir(parents=True, exist_ok=True)
    # Prevent stale sandbox charts from prior runs from persisting in output.
    for stale_name in [
        "sandbox_participation_unique_players.png",
        "sandbox_avg_playtime_per_player.png",
        "sandbox_playtime_per_player_hist.png",
        "sandbox_top20_players_by_playtime.png",
    ]:
        stale_path = sandbox_dir / stale_name
        if stale_path.exists():
            stale_path.unlink()
    sandbox_time_by_player: dict[str, float] = {}
    if not player_highest_completed.empty:
        total_player_ids = set(player_highest_completed.index.astype(str).tolist())
    if not attempts_with_player.empty and {"player_id_norm"} <= set(attempts_with_player.columns):
        a_sb = attempts_with_player.copy()
        a_sb["time_seconds"] = pd.to_numeric(a_sb.get("time_seconds"), errors="coerce")

        # 1) Round-level sandbox/practice timing (preferred when available).
        for _, row in a_sb.iterrows():
            pid = row.get("player_id_norm")
            if pd.isna(pid):
                continue
            rounds = row.get("rounds")
            if not isinstance(rounds, list):
                continue
            round_secs = 0.0
            for rr in rounds:
                if not isinstance(rr, dict):
                    continue
                rr_mode = str(rr.get("mode") or "").strip().lower()
                if rr_mode not in sandbox_modes:
                    continue
                ts = pd.to_numeric(rr.get("time_spent"), errors="coerce")
                if np.isfinite(ts):
                    round_secs += float(ts)
            if round_secs > 0:
                pid_str = str(pid)
                sandbox_player_ids.add(pid_str)
                sandbox_time_by_player[pid_str] = sandbox_time_by_player.get(pid_str, 0.0) + round_secs

        # 2) Attempt-level fallback where the attempt itself is sandbox/practice
        # and round-level sandbox time is not present.
        if "mode" in a_sb.columns:
            for _, row in a_sb.iterrows():
                pid = row.get("player_id_norm")
                if pd.isna(pid):
                    continue
                mode = str(row.get("mode") or "").strip().lower()
                if mode not in sandbox_modes:
                    continue
                pid_str = str(pid)
                sandbox_player_ids.add(pid_str)
                rounds = row.get("rounds")
                has_sandbox_round = False
                if isinstance(rounds, list):
                    for rr in rounds:
                        if isinstance(rr, dict) and str(rr.get("mode") or "").strip().lower() in sandbox_modes:
                            has_sandbox_round = True
                            break
                if has_sandbox_round:
                    continue
                ts = row.get("time_seconds")
                if np.isfinite(ts):
                    sandbox_time_by_player[pid_str] = sandbox_time_by_player.get(pid_str, 0.0) + float(ts)

    # Events still contribute sandbox participation even when attempts are missing.
    if not events.empty and "mode" in events.columns:
        e_player_col = pick_player_column(events)
        if e_player_col is not None:
            e_sb_players = (
                events[events["mode"].astype(str).str.lower().isin(sandbox_modes)][e_player_col]
                .dropna()
                .astype(str)
                .tolist()
            )
            sandbox_player_ids.update(e_sb_players)

    sandbox_time_seconds = float(sum(sandbox_time_by_player.values())) if sandbox_time_by_player else 0.0
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
            avg_minutes = float(player_time_series.mean() / 60.0)
            summary.append(f"sandbox_avg_playtime_minutes_per_player: {avg_minutes:.2f}")
            save_bar(
                pd.Series({"Average Sandbox Playtime": avg_minutes}),
                sandbox_dir / "sandbox_avg_playtime_per_player.png",
                "Average Sandbox Playtime Per Player",
                "Metric",
                "Sandbox Playtime (minutes)",
            )
    else:
        summary.append("sandbox_time_seconds_observed: n/a")
    # Add after the sandbox analysis and before the final summary write
    analyze_level_dropoff_metrics(attempts_with_player, player_highest_completed, args.outdir)

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
