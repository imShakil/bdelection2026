import csv
import hashlib
import os
from config import load_config
from db import get_db, ensure_indexes


CSV_PATH = os.environ.get("CANDIDATES_CSV", "/data/bd_elections_2026_candidates.csv")
BN_CSV_PATH = os.environ.get("CANDIDATES_BN_CSV", "/data/bd_candidates_bn.csv")


def sha1_hex(text: str) -> str:
    return hashlib.sha1(text.encode("utf-8")).hexdigest()


def candidate_id(constituency_no: int, alliance_key: str, party: str, name: str) -> str:
    return sha1_hex(f"{constituency_no}|{alliance_key}|{party}|{name}")


BN_PARTY_KEYS = {
    "BNP": "বিএনপি",
    "JP(E)": "জাপা",
    "Jatiya Party (Ershad)": "জাপা",
    "Jamaat": "জামাত",
    "NCP": "এনসিপি",
}


def load_bn_map(path: str) -> dict[int, dict]:
    if not os.path.exists(path):
        return {}
    bn_map = {}
    known_parties = {"বিএনপি", "জামাত", "জাপা", "এনসিপি", "আইএবি"}
    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            try:
                constituency_no = int(row.get("constituency_no") or 0)
            except ValueError:
                continue
            division_bn = (row.get("division_bn") or "").strip()
            seat_bn = (row.get("seat_bn") or "").strip()
            party_map = {}

            for i in range(1, 5):
                p = (row.get(f"slot{i}_party") or "").strip()
                c = (row.get(f"slot{i}_candidate") or "").strip()
                if not p and c in known_parties:
                    p, c = c, ""
                if p:
                    party_map[p] = c

            notes = (row.get("notes") or "").strip()
            if "|" in notes:
                parts = [p.strip() for p in notes.split("|")]
                if len(parts) >= 2 and parts[0] and parts[1]:
                    party_map.setdefault(parts[0], parts[1])

            bn_map[constituency_no] = {
                "division_bn": division_bn,
                "seat_bn": seat_bn,
                "party_map": party_map,
            }
    return bn_map


def main():
    cfg = load_config()
    if not cfg.mongo_uri:
        raise RuntimeError("MONGODB_URI is required")

    db = get_db(cfg.mongo_uri, cfg.db_name)
    ensure_indexes(db)
    bn_map = load_bn_map(BN_CSV_PATH)

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

            bn_info = bn_map.get(constituency_no, {})
            division_bn = bn_info.get("division_bn", "")
            seat_bn = bn_info.get("seat_bn", "")
            party_map = bn_info.get("party_map", {})

            for cand in candidates:
                party_bn = BN_PARTY_KEYS.get(cand.get("party"), cand.get("party"))
                cand["party_bn"] = party_bn
                cand["name_bn"] = party_map.get(party_bn, "")

            doc = {
                "constituency_no": constituency_no,
                "division": division,
                "seat": seat,
                "division_bn": division_bn,
                "seat_bn": seat_bn,
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
