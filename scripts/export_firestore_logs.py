#!/usr/bin/env python3
"""Export Flash Recall Firestore logs to a combined JSON file.

Exports the `game_sessions` collection and nested subcollections:
- attempts
- events

Usage example:
  python scripts/export_firestore_logs.py \
    --service-account serviceAccountKey.json \
    --out data_combined.json
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

from google.cloud import firestore


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Export Firestore game session logs to JSON")
    parser.add_argument(
        "--service-account",
        type=Path,
        required=True,
        help="Path to Firebase service account JSON key",
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=Path("data_combined.json"),
        help="Output JSON file path",
    )
    parser.add_argument(
        "--collection",
        type=str,
        default="game_sessions",
        help="Top-level collection to export",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=0,
        help="Optional max number of session docs to export (0 = no limit)",
    )
    return parser.parse_args()


def to_jsonable(value: Any) -> Any:
    if isinstance(value, dict):
        return {k: to_jsonable(v) for k, v in value.items()}
    if isinstance(value, list):
        return [to_jsonable(v) for v in value]
    if isinstance(value, tuple):
        return [to_jsonable(v) for v in value]
    # Firestore timestamp/datetime and similar objects -> string
    if hasattr(value, "isoformat"):
        try:
            return value.isoformat()
        except Exception:
            return str(value)
    return value


def export_data(db: firestore.Client, collection_name: str, limit: int) -> list[dict[str, Any]]:
    sessions_ref = db.collection(collection_name)
    query = sessions_ref.limit(limit) if limit and limit > 0 else sessions_ref

    output: list[dict[str, Any]] = []

    for session_doc in query.stream():
        session_data = session_doc.to_dict() or {}
        session_payload = to_jsonable(session_data)
        session_payload["id"] = session_doc.id
        session_payload["attempts"] = []
        session_payload["events"] = []

        for attempt_doc in session_doc.reference.collection("attempts").stream():
            attempt_data = attempt_doc.to_dict() or {}
            attempt_payload = to_jsonable(attempt_data)
            attempt_payload["id"] = attempt_doc.id
            session_payload["attempts"].append(attempt_payload)

        for event_doc in session_doc.reference.collection("events").stream():
            event_data = event_doc.to_dict() or {}
            event_payload = to_jsonable(event_data)
            event_payload["id"] = event_doc.id
            session_payload["events"].append(event_payload)

        output.append(session_payload)

    return output


def main() -> None:
    args = parse_args()

    if not args.service_account.exists():
        raise FileNotFoundError(f"Service account key not found: {args.service_account}")

    db = firestore.Client.from_service_account_json(str(args.service_account))
    data = export_data(db, args.collection, args.limit)

    args.out.parent.mkdir(parents=True, exist_ok=True)
    with args.out.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"Exported {len(data)} session documents to {args.out}")


if __name__ == "__main__":
    main()
