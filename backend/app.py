import hashlib
import os
import uuid
from datetime import datetime, timedelta, timezone
from flask import Flask, jsonify, request, make_response
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError
import json
import redis
import feedparser

from config import load_config
from db import get_db, ensure_indexes
from captcha import verify_captcha


def sha256_hex(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def get_ip_prefix(ip: str) -> str:
    if not ip:
        return ""
    if ":" in ip:
        parts = ip.split(":")
        return ":".join(parts[:4])
    parts = ip.split(".")
    return ".".join(parts[:3]) if len(parts) >= 3 else ip


def now_utc():
    return datetime.now(timezone(timedelta(hours=6)))


def feed_published_dhaka(entry):
    parsed = entry.get("published_parsed")
    if parsed:
        dt_utc = datetime(
            parsed.tm_year,
            parsed.tm_mon,
            parsed.tm_mday,
            parsed.tm_hour,
            parsed.tm_min,
            parsed.tm_sec,
            tzinfo=timezone.utc,
        )
        return dt_utc.astimezone(timezone(timedelta(hours=6))).isoformat()
    return entry.get("published")


def create_app():
    cfg = load_config()
    if not cfg.mongo_uri:
        raise RuntimeError("MONGODB_URI is required")

    app = Flask(__name__)
    app.config["JSON_SORT_KEYS"] = False

    CORS(app, origins=[cfg.frontend_origin], supports_credentials=True)
    limiter = Limiter(
        get_remote_address,
        app=app,
        default_limits=[],
        storage_uri=cfg.limiter_storage_uri,
    )

    db = get_db(cfg.mongo_uri, cfg.db_name)
    ensure_indexes(db)
    cache = None
    try:
        cache = redis.Redis.from_url(cfg.redis_cache_url, decode_responses=True)
        cache.ping()
    except Exception:
        cache = None

    def ensure_vid_cookie(resp):
        vid = request.cookies.get("vid")
        if not vid:
            vid = str(uuid.uuid4())
            expires = now_utc() + timedelta(days=180)
            resp.set_cookie(
                "vid",
                vid,
                httponly=True,
                samesite="Lax",
                secure=cfg.secure_cookies,
                expires=expires,
            )
        return resp

    @app.get("/api/health")
    def health():
        resp = make_response(jsonify({"ok": True}))
        return ensure_vid_cookie(resp)

    @app.get("/api/config")
    def client_config():
        resp = make_response(
            jsonify({
                "captcha_provider": cfg.captcha_provider,
                "captcha_site_key": cfg.captcha_site_key,
            })
        )
        return ensure_vid_cookie(resp)

    @app.get("/api/constituencies")
    def list_constituencies():
        division = request.args.get("division")
        q = request.args.get("q", "")
        filters = {}
        if division:
            filters["division"] = division
        if q:
            filters["seat"] = {"$regex": q, "$options": "i"}
        cursor = db.constituencies.find(filters, {
            "_id": 0,
            "constituency_no": 1,
            "division": 1,
            "division_bn": 1,
            "seat": 1,
            "seat_bn": 1,
            "notes": 1,
            "is_disabled": 1,
        }).sort("constituency_no", 1)
        items = list(cursor)
        resp = make_response(jsonify(items))
        return ensure_vid_cookie(resp)

    def constituency_payload(constituency_no: int):
        doc = db.constituencies.find_one({"constituency_no": constituency_no}, {"_id": 0})
        if not doc:
            return None
        tallies = db.tallies.find_one({"constituency_no": constituency_no}, {"_id": 0})
        totals = tallies.get("totals", {}) if tallies else {}
        leader = None
        is_tied = False
        if totals:
            max_votes = max(totals.values())
            leaders = [cid for cid, v in totals.items() if v == max_votes]
            if len(leaders) > 1:
                is_tied = True
            else:
                cid = leaders[0]
                cand = next((c for c in doc.get("candidates", []) if c.get("candidate_id") == cid), None)
                if cand:
                    leader = {
                        "candidate_id": cid,
                        "name": cand.get("name"),
                        "party": cand.get("party"),
                        "alliance_key": cand.get("alliance_key"),
                        "votes": max_votes,
                    }
        return {
            "constituency_no": doc.get("constituency_no"),
            "division": doc.get("division"),
            "seat": doc.get("seat"),
            "notes": doc.get("notes", ""),
            "is_disabled": bool(doc.get("is_disabled")),
            "candidates": doc.get("candidates", []),
            "totals": totals,
            "leader": leader,
            "is_tied": is_tied,
        }

    @app.get("/api/constituencies/<int:constituency_no>")
    def get_constituency(constituency_no: int):
        payload = constituency_payload(constituency_no)
        if not payload:
            return jsonify({"error": "Not found"}), 404
        resp = make_response(jsonify(payload))
        return ensure_vid_cookie(resp)

    @app.get("/api/results/constituency/<int:constituency_no>")
    def constituency_results(constituency_no: int):
        payload = constituency_payload(constituency_no)
        if not payload:
            return jsonify({"error": "Not found"}), 404
        resp = make_response(jsonify(payload))
        return ensure_vid_cookie(resp)

    @app.post("/api/vote")
    @limiter.limit("50 per hour")
    @limiter.limit("100 per day")
    def vote():
        data = request.get_json(force=True) or {}
        constituency_no = data.get("constituency_no")
        candidate_id = data.get("candidate_id")
        captcha_token = data.get("captcha_token", "")

        if not isinstance(constituency_no, int) or not candidate_id:
            return jsonify({"error": "Invalid payload"}), 400

        doc = db.constituencies.find_one({"constituency_no": constituency_no})
        if not doc:
            return jsonify({"error": "Invalid constituency"}), 400
        candidate = next((c for c in doc.get("candidates", []) if c.get("candidate_id") == candidate_id), None)
        if not candidate:
            return jsonify({"error": "Invalid candidate"}), 400

        if not verify_captcha(cfg.captcha_provider, cfg.captcha_secret_key, captcha_token, request.remote_addr):
            return jsonify({"error": "Captcha failed"}), 403

        vid = request.cookies.get("vid")
        if not vid:
            return jsonify({"error": "Missing device id cookie"}), 400

        voter_vid_hash = sha256_hex(vid + cfg.server_salt)
        ip_prefix = get_ip_prefix(request.remote_addr or "")
        ua_hash = sha256_hex(request.headers.get("User-Agent", ""))
        lang_hash = sha256_hex(request.headers.get("Accept-Language", ""))

        try:
            db.voters.insert_one({
                "voter_vid_hash": voter_vid_hash,
                "first_seen_at": now_utc(),
                "last_seen_at": now_utc(),
                "ip_prefix": ip_prefix,
                "ua_hash": ua_hash,
                "lang_hash": lang_hash,
            })
        except DuplicateKeyError:
            return jsonify({"error": "Already voted"}), 409

        db.votes.insert_one({
            "constituency_no": constituency_no,
            "candidate_id": candidate_id,
            "alliance_key": candidate.get("alliance_key"),
            "party": candidate.get("party"),
            "voted_at": now_utc(),
            "voter_vid_hash": voter_vid_hash,
            "ip_prefix": ip_prefix,
            "ua_hash": ua_hash,
        })

        updated = db.tallies.find_one_and_update(
            {"constituency_no": constituency_no},
            {"$inc": {f"totals.{candidate_id}": 1}, "$set": {"updated_at": now_utc()}},
            upsert=True,
            return_document=ReturnDocument.AFTER,
        )
        if cache:
            try:
                cache.delete("results_overall")
            except Exception:
                pass

        payload = constituency_payload(constituency_no)
        resp = make_response(jsonify({
            "ok": True,
            "message": "Vote recorded",
            "new_tallies": updated.get("totals", {}) if updated else {},
            "leader": payload.get("leader") if payload else None,
            "is_tied": payload.get("is_tied") if payload else False,
        }))
        return ensure_vid_cookie(resp)

    @app.get("/api/results/overall")
    def results_overall():
        if cache:
            try:
                cached = cache.get("results_overall")
                if cached:
                    resp = make_response(cached)
                    resp.mimetype = "application/json"
                    return ensure_vid_cookie(resp)
            except Exception:
                pass
        constituencies = list(db.constituencies.find({}, {"_id": 0}))
        tallies = list(db.tallies.find({}, {"_id": 0}))

        tally_map = {t.get("constituency_no"): t.get("totals", {}) for t in tallies}
        candidate_lookup = {}
        disabled_count = 0
        for c in constituencies:
            if c.get("is_disabled"):
                disabled_count += 1
            for cand in c.get("candidates", []):
                candidate_lookup[cand.get("candidate_id")] = cand

        votes_by_alliance = {}
        votes_by_party = {}
        for totals in tally_map.values():
            for cid, votes in totals.items():
                cand = candidate_lookup.get(cid)
                if not cand:
                    continue
                votes_by_alliance[cand.get("alliance_key")] = votes_by_alliance.get(cand.get("alliance_key"), 0) + votes
                votes_by_party[cand.get("party")] = votes_by_party.get(cand.get("party"), 0) + votes

        seats_leading_by_alliance = {}
        seats_leading_by_party = {}
        leaders_by_constituency = {}
        tied = 0
        no_votes = 0
        for c in constituencies:
            if c.get("is_disabled"):
                continue
            totals = tally_map.get(c.get("constituency_no"), {})
            if not totals:
                no_votes += 1
                leaders_by_constituency[c.get("constituency_no")] = {
                    "leader": None,
                    "is_tied": False,
                }
                continue
            max_votes = max(totals.values())
            leaders = [cid for cid, v in totals.items() if v == max_votes]
            if len(leaders) > 1:
                tied += 1
                leaders_by_constituency[c.get("constituency_no")] = {
                    "leader": None,
                    "is_tied": True,
                }
                continue
            leader = candidate_lookup.get(leaders[0])
            if not leader:
                continue
            seats_leading_by_alliance[leader.get("alliance_key")] = seats_leading_by_alliance.get(leader.get("alliance_key"), 0) + 1
            seats_leading_by_party[leader.get("party")] = seats_leading_by_party.get(leader.get("party"), 0) + 1
            leaders_by_constituency[c.get("constituency_no")] = {
                "leader": leader,
                "is_tied": False,
            }

        top_seats = []
        for c in constituencies:
            totals = tally_map.get(c.get("constituency_no"), {})
            total_votes = sum(totals.values()) if totals else 0
            top_seats.append({
                "constituency_no": c.get("constituency_no"),
                "seat": c.get("seat"),
                "division": c.get("division"),
                "total_votes": total_votes,
            })
        top_seats.sort(key=lambda x: x.get("total_votes", 0), reverse=True)
        top_seats = top_seats[:10]

        total_votes = sum(votes_by_party.values())
        # Projection: allocate remaining seats by vote share (largest remainder)
        seats_total = len(constituencies) - disabled_count
        seats_current = sum(seats_leading_by_party.values())
        remaining = max(0, seats_total - seats_current - tied - no_votes)
        party_vote_entries = {k: v for k, v in votes_by_party.items() if v > 0}
        projection = {}
        if remaining > 0 and party_vote_entries:
            total_party_votes = sum(party_vote_entries.values())
            quotas = {}
            remainders = []
            for party, votes in party_vote_entries.items():
                exact = (votes / total_party_votes) * remaining
                base = int(exact)
                quotas[party] = base
                remainders.append((exact - base, party))
            seats_allocated = sum(quotas.values())
            remainders.sort(reverse=True)
            for i in range(remaining - seats_allocated):
                _, party = remainders[i]
                quotas[party] += 1
            projection = quotas

        payload = {
            "total_votes": total_votes,
            "votes_by_alliance": votes_by_alliance,
            "votes_by_party": votes_by_party,
            "seats_leading_by_alliance": {
                **seats_leading_by_alliance,
                "tied": tied,
                "no_votes": no_votes,
            },
            "seats_leading_by_party": {
                **seats_leading_by_party,
                "TIED": tied,
                "NO_VOTES": no_votes,
            },
            "constituencies_count": len(constituencies),
            "disabled_count": disabled_count,
            "leaders_by_constituency": leaders_by_constituency,
            "top_seats_by_votes": top_seats,
            "projection_by_party": projection,
            "projection_meta": {
                "seats_total": seats_total,
                "seats_current": seats_current,
                "remaining": remaining,
                "method": "vote_share_remaining_seats",
            },
            "updated_at": now_utc().isoformat(),
        }
        if cache:
            try:
                cache.setex("results_overall", cfg.results_cache_ttl, json.dumps(payload))
            except Exception:
                pass
        resp = make_response(json.dumps(payload))
        resp.mimetype = "application/json"
        return ensure_vid_cookie(resp)

    @app.get("/api/news")
    def news():
        if cache:
            try:
                cached = cache.get("news_feed")
                if cached:
                    resp = make_response(cached)
                    resp.mimetype = "application/json"
                    return ensure_vid_cookie(resp)
            except Exception:
                pass

        feeds = [
            {"source": "BBC Bangla", "url": "https://feeds.bbci.co.uk/bengali/rss.xml"},
            {"source": "Prothom Alo", "url": "https://www.prothomalo.com/feed/"},
            {"source": "BanglaNews24", "url": "https://www.banglanews24.com/feed/"},
            {"source": "Dhaka Tribune", "url": "https://www.dhakatribune.com/feed"},
            {"source": "Jagonews24", "url": "https://www.jagonews24.com/rss/rss.xml"},
            {"source": "BD24Live", "url": "https://www.bd24live.com/bangla/feed"},
        ]

        items = []
        for f in feeds:
            parsed = feedparser.parse(f["url"])
            for entry in parsed.entries[:6]:
                items.append({
                    "title": entry.get("title"),
                    "link": entry.get("link"),
                    "published": feed_published_dhaka(entry),
                    "source": f["source"],
                })

        payload = {"items": items[:24], "updated_at": now_utc().isoformat()}
        if cache:
            try:
                cache.setex("news_feed", cfg.news_cache_ttl, json.dumps(payload))
            except Exception:
                pass
        resp = make_response(json.dumps(payload))
        resp.mimetype = "application/json"
        return ensure_vid_cookie(resp)


    return app


if __name__ == "__main__":
    create_app().run(host="0.0.0.0", port=int(os.environ.get("PORT", 8000)), debug=True)
