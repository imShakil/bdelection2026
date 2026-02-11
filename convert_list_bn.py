import re
import csv

BN_DIGITS = str.maketrans("০১২৩৪৫৬৭৮৯", "0123456789")

def bn_to_int(s: str):
    s = s.translate(BN_DIGITS)
    return int(s)

def clean(x: str) -> str:
    x = re.sub(r"\s+", " ", x or "").strip()
    # Normalize dash-ish values
    if x in {"—", "-", "— ", " - ", "N/A", "n/a", "না", "নাই", "ন/a"}:
        return ""
    return x

def split_fields(line: str):
    # Prefer tabs; fallback to multi-space split
    if "\t" in line:
        parts = [p for p in line.split("\t") if p.strip() != ""]
    else:
        parts = [p for p in re.split(r"\s{2,}", line) if p.strip() != ""]
    return [clean(p) for p in parts]

def is_division_header(parts):
    # e.g. "রংপুর বিভাগ", "চট্টগ্রাম  বিভাগ"
    return len(parts) >= 1 and "বিভাগ" in parts[0] and not re.match(r"^[০-৯0-9]+$", parts[0])

def looks_like_row_start(parts):
    # row starts with Bengali number like "১" or "২৯৮"
    return len(parts) >= 2 and re.match(r"^[০-৯]+$", parts[0])

def normalize_division_name(s: str) -> str:
    return re.sub(r"\s+", " ", s).strip()

def parse_row(parts, current_division):
    # Expected rough pattern:
    # [no, seat, party1, cand1, party2, cand2, party3, cand3, party4, cand4]
    # But sometimes extra notes like "নির্বাচন স্থগিত"
    # We'll be defensive.

    row = {
        "division_bn": current_division,
        "constituency_no": "",
        "seat_bn": "",
        "slot1_party": "", "slot1_candidate": "",
        "slot2_party": "", "slot2_candidate": "",
        "slot3_party": "", "slot3_candidate": "",
        "slot4_party": "", "slot4_candidate": "",
        "notes": "",
    }

    # Constituency no
    try:
        row["constituency_no"] = bn_to_int(parts[0])
    except Exception:
        row["notes"] = "could_not_parse_constituency_no"
        return row

    # Handle postponed line style: e.g. ["১৪৫", "শেরপুর-৩", "নির্বাচন স্থগিত"]
    if len(parts) >= 3 and "স্থগিত" in " ".join(parts[2:]):
        row["seat_bn"] = parts[1]
        row["notes"] = "নির্বাচন স্থগিত"
        return row

    # seat
    if len(parts) >= 2:
        row["seat_bn"] = parts[1]

    # Remaining tokens after [no, seat]
    rest = parts[2:]

    # Some rows contain inline note like "ইসলামী আন্দোলনের প্রার্থীকে সমর্থন[১]"
    # We'll keep anything containing "সমর্থন" or bracket ref as notes if it breaks pairing.
    # Pair parse: party, candidate repeated.
    pairs = []
    i = 0
    while i < len(rest):
        party = rest[i] if i < len(rest) else ""
        cand = rest[i+1] if i+1 < len(rest) else ""
        # If party looks like a long note and candidate missing, treat as note
        if cand == "" and party:
            # note-ish
            row["notes"] = (row["notes"] + " | " if row["notes"] else "") + party
            i += 1
            continue
        pairs.append((party, cand))
        i += 2

    # Fill up to 4 slots
    for idx in range(4):
        if idx < len(pairs):
            row[f"slot{idx+1}_party"] = pairs[idx][0]
            row[f"slot{idx+1}_candidate"] = pairs[idx][1]

    return row

def main():
    input_path = "input.txt"
    output_path = "bd_candidates_bn.csv"

    rows = []
    current_division = ""

    with open(input_path, "r", encoding="utf-8") as f:
        for raw_line in f:
            line = raw_line.strip()
            if not line:
                continue

            parts = split_fields(line)

            # Detect division header
            if is_division_header(parts):
                current_division = normalize_division_name(parts[0])
                continue

            # Some lines begin with division + number in same line
            # Example: "রংপুর বিভাগ ১ পঞ্চগড়-১ ..."
            if len(parts) >= 3 and "বিভাগ" in parts[0] and re.match(r"^[০-৯]+$", parts[1]):
                current_division = normalize_division_name(parts[0])
                # convert into a row by shifting
                parts = [parts[1]] + parts[2:]

            if looks_like_row_start(parts):
                rows.append(parse_row(parts, current_division))

    fieldnames = [
        "division_bn","constituency_no","seat_bn",
        "slot1_party","slot1_candidate",
        "slot2_party","slot2_candidate",
        "slot3_party","slot3_candidate",
        "slot4_party","slot4_candidate",
        "notes"
    ]

    with open(output_path, "w", encoding="utf-8", newline="") as out:
        w = csv.DictWriter(out, fieldnames=fieldnames)
        w.writeheader()
        for r in rows:
            w.writerow(r)

    print(f"✅ Wrote {len(rows)} rows to {output_path}")

if __name__ == "__main__":
    main()
