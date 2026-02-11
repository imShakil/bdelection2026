import csv
import hashlib
import os
from config import load_config
from db import get_db, ensure_indexes


CSV_PATH = os.environ.get("CANDIDATES_CSV", "/data/bd_elections_2026_candidates.csv")


def sha1_hex(text: str) -> str:
    return hashlib.sha1(text.encode("utf-8")).hexdigest()


def candidate_id(constituency_no: int, alliance_key: str, party: str, name: str) -> str:
    return sha1_hex(f"{constituency_no}|{alliance_key}|{party}|{name}")


def main():
    cfg = load_config()
    if not cfg.mongo_uri:
        raise RuntimeError("MONGODB_URI is required")

    db = get_db(cfg.mongo_uri, cfg.db_name)
    ensure_indexes(db)

    with open(CSV_PATH, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        count = 0
        for row in reader:
            constituency_no = int(row.get("constituency_no"))
            division = (row.get("division") or row.get("\ufeffdivision") or "").strip()
            seat = row.get("seat", "").strip()
            notes = row.get("notes", "").strip()

            candidates = []
            bnp_party = row.get("bnp_party", "BNP").strip() or "BNP"
            bnp_candidate = row.get("bnp_candidate", "").strip()
            if bnp_candidate:
                candidates.append({
                    "candidate_id": candidate_id(constituency_no, "BNP", bnp_party, bnp_candidate),
                    "alliance_key": "BNP",
                    "party": bnp_party,
                    "name": bnp_candidate,
                })

            jp_party = row.get("jp_party", "Jatiya Party (Ershad)").strip() or "Jatiya Party (Ershad)"
            jp_candidate = row.get("jp_candidate", "").strip()
            if jp_candidate:
                candidates.append({
                    "candidate_id": candidate_id(constituency_no, "JP", jp_party, jp_candidate),
                    "alliance_key": "JP",
                    "party": jp_party,
                    "name": jp_candidate,
                })

            alliance_party = row.get("alliance_party", "11 Party Alliance").strip() or "11 Party Alliance"
            alliance_candidate = row.get("alliance_candidate", "").strip()
            if alliance_candidate:
                candidates.append({
                    "candidate_id": candidate_id(constituency_no, "11PA", alliance_party, alliance_candidate),
                    "alliance_key": "11PA",
                    "party": alliance_party,
                    "name": alliance_candidate,
                })

            doc = {
                "constituency_no": constituency_no,
                "division": division,
                "seat": seat,
                "notes": notes,
                "is_disabled": False,
                "candidates": candidates,
            }

            db.constituencies.update_one(
                {"constituency_no": constituency_no},
                {"$set": doc},
                upsert=True,
            )
            count += 1

    print(f"Imported {count} constituencies")


if __name__ == "__main__":
    main()
