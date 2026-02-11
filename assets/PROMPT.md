You are ChatGPT Codex acting as a senior full-stack engineer. Build a complete MVP web app: “Bangladesh Map Voting”.

GOAL
- Users vote by clicking a Bangladesh parliamentary constituency on an interactive map.
- After selecting a constituency, show the candidate list for that constituency (BNP candidate, Jatiya Party (Ershad) candidate, 11 Party Alliance candidate) and allow the user to cast ONE vote for one candidate.
- Show live vote totals and a “stats dashboard” including “seats leading” (who is currently leading in each constituency).

TECH STACK
- Frontend: Node.js + Express to serve a SPA (Vite + React recommended) + static assets.
- Backend: Flask REST API.
- DB: MongoDB Atlas (use pymongo).
- Local dev: docker-compose (frontend + backend). Use Atlas via env vars.

DATA SOURCE
- Use CSV file: bd_elections_2026_candidates.csv
- Create a backend import script to parse CSV and import into MongoDB.
- Store “notes” (e.g., Election postponed) and DISABLE voting for those constituencies.

MAP REQUIREMENTS
- Use Bangladesh constituencies map:
  - Prefer GeoJSON with constituency identifiers.
  - If only SVG is used, implement click handling and a mapping table to constituency_no.
- Clicking a region selects the constituency_no.
- Hover highlight + tooltip (seat name).
- Mobile friendly: pan/zoom on map.
- Optional (nice): color each constituency by current leader’s alliance_key (gray=no votes, striped=tied).

NO SIGNUP ANTI-DUPLICATE (PUBLIC DEMO MODE)
Important: MAC address cannot be collected from browsers. DO NOT attempt MAC address collection. Use best-effort deterrence only.
Mechanism (deterrence):
1) Issue anonymous device_id cookie:
   - On first visit, backend sets HttpOnly cookie “vid” = random UUID.
   - SameSite=Lax, Secure only in prod, expires ~180 days.
2) Require CAPTCHA on voting:
   - Prefer Cloudflare Turnstile (better UX) with server-side verify.
   - Env toggles: CAPTCHA_PROVIDER=turnstile|recaptcha|none; CAPTCHA_SECRET_KEY, CAPTCHA_SITE_KEY.
   - In dev allow CAPTCHA_PROVIDER=none.
3) Record request heuristics:
   - IP address => store ip_prefix (/24 for IPv4, /64 for IPv6)
   - User-Agent hash = sha256(ua)
   - Accept-Language hash = sha256(lang) (optional)
4) Enforce uniqueness:
   - MVP rule: ONE vote per device (vid) overall (GLOBAL).
   - voter_vid_hash = sha256(vid + SERVER_SALT)
   - If voter_vid_hash already exists => reject 409 “Already voted”.
5) Rate limiting:
   - Use Flask-Limiter:
     - POST /vote: e.g. 5 per hour per IP and 20 per day per IP.
     - Also add a per-vid limiter if desired (optional).
6) README must state:
   - Without identity verification, duplicates cannot be fully prevented; this only deters.

MVP USER FLOW
1) Landing page shows interactive Bangladesh constituency map.
2) User clicks constituency.
3) Side panel shows:
   - Division, seat name, constituency number
   - Notes (if any) and “Voting disabled” if postponed/disabled
   - Candidate list as radio options (party + candidate name)
   - Current vote counts (live fetch)
   - Vote button (disabled if postponed/disabled)
4) On successful vote:
   - Show toast “Vote recorded”
   - Lock the UI client-side
   - Refresh tallies + leader
5) Stats page/dashboard:
   - Total votes overall
   - Votes by party and by alliance_key
   - Seats leading by party and by alliance_key (leader per constituency)
   - Counts: tied constituencies, no-vote constituencies, disabled constituencies
   - Top constituencies by votes (optional)

DEFINITIONS FOR STATS
- Votes: raw totals.
- Seats leading: for each constituency, candidate with max votes is “leader”.
- Tie: if multiple candidates share max votes => mark as TIED; do not count as seat for any party/alliance; count in tied.
- No votes: no tallies for constituency => count as no_votes.
- Disabled constituencies: exclude from seats_leading/tie/no_votes calculations and count separately as disabled_count.

API DESIGN (Flask) base: /api
- GET /health
- GET /constituencies?division=&q=
  -> list constituencies: { constituency_no, division, seat, notes, is_disabled }
- GET /constituencies/<constituency_no>
  -> constituency details:
  {
    constituency_no, division, seat, notes, is_disabled,
    candidates:[{candidate_id, alliance_key, party, name}],
    totals:{candidate_id:int,...},
    leader:{candidate_id,name,party,alliance_key,votes} | null,
    is_tied: bool
  }
- POST /vote
  Body: { constituency_no:int, candidate_id:string, captcha_token:string }
  Requirements:
    - Include credentials so cookie vid is sent.
  Behavior:
    - Reject if constituency disabled (postponed/disabled).
    - Verify CAPTCHA server-side (unless CAPTCHA_PROVIDER=none).
    - Validate candidate_id belongs to constituency.
    - Enforce one-vote-per-device: insert into voters unique index; if dup => 409.
    - Write vote record and increment tallies atomically.
  Response: { ok:true, message, new_tallies, leader, is_tied }
- GET /results/overall
  Returns:
  {
    total_votes:int,
    // vote totals
    votes_by_alliance:{...},
    votes_by_party:{...},
    // seats leading (leader per constituency)
    seats_leading_by_alliance:{..., tied:int, no_votes:int},
    seats_leading_by_party:{..., TIED:int, NO_VOTES:int},
    constituencies_count:int,
    disabled_count:int,
    updated_at: iso_datetime
  }
- GET /results/constituency/<constituency_no>
  Similar to /constituencies/<id> but focused on totals/leader.

MONGO SCHEMA
- constituencies:
  {
    constituency_no:int unique,
    division:string,
    seat:string,
    notes:string,
    is_disabled:bool,
    candidates:[
      { candidate_id:string, alliance_key:string, party:string, name:string }
    ]
  }
- voters:
  {
    voter_vid_hash:string unique,
    first_seen_at,
    last_seen_at,
    ip_prefix,
    ua_hash,
    lang_hash
  }
- votes:
  {
    _id,
    constituency_no:int,
    candidate_id:string,
    alliance_key:string,
    party:string,
    voted_at,
    voter_vid_hash,
    ip_prefix,
    ua_hash
  }
- tallies:
  {
    constituency_no:int unique,
    totals:{ "<candidate_id>": int },
    updated_at
  }

INDEXES
- constituencies.constituency_no unique
- voters.voter_vid_hash unique
- tallies.constituency_no unique
- votes.constituency_no
- votes.voter_vid_hash (optional)

IMPORT SCRIPT
- backend/import_candidates.py
  - Reads bd_elections_2026_candidates.csv
  - For each row:
    - constituency_no (int), division, seat, notes
    - Build candidates array from bnp_party/bnp_candidate, jp_party/jp_candidate, alliance_party/alliance_candidate
    - Generate stable candidate_id values (e.g., sha1(constituency_no + alliance_key + party + name))
    - is_disabled if notes contains “Election postponed” or similar
  - Upsert into constituencies.
  - Create/ensure indexes.
  - Do not create tallies initially.

VOTING WRITE LOGIC (ATOMIC, MVP)
- On POST /vote:
  1) Read cookie vid. If missing, set it and ask client to retry OR create on first GET route; best: create cookie on any GET /health or /constituencies call.
  2) Compute voter_vid_hash = sha256(vid + SERVER_SALT)
  3) Attempt insert into voters:
     - if duplicate key => return 409 Already voted
  4) Insert vote doc (include party + alliance_key from constituency candidate).
  5) Update tallies with:
     - findOneAndUpdate({constituency_no}, {$inc: {"totals.<candidate_id>":1}, $set:{updated_at:now}}, upsert=true)
  6) Compute leader for that constituency (from updated totals) and return.

SEATS LEADING COMPUTATION (ON DEMAND, OK FOR 300)
- In GET /results/overall:
  - Query constituencies (exclude is_disabled=true; count disabled separately)
  - Query tallies for all constituencies
  - For each constituency:
    - if no tallies => no_votes++
    - else find max votes; if tie => tied++
    - else increment seats_leading_by_alliance[leader.alliance_key] and seats_leading_by_party[leader.party]
  - Also aggregate votes_by_party and votes_by_alliance from tallies or votes:
    - For MVP, easiest: iterate tallies totals and map candidate_id -> party/alliance via constituencies candidates table.

FRONTEND REQUIREMENTS (React SPA)
- Pages:
  - MapVotePage (default)
  - StatsPage
- MapVotePage:
  - Interactive map component
  - Side panel with constituency info + candidates + current totals
  - Vote button triggers POST /api/vote with credentials included
  - Handle errors:
    - 409 => show “You already voted from this device/browser.”
    - 400/403 => show message
- StatsPage:
  - Calls GET /api/results/overall every X seconds (e.g., 10s) for live stats
  - Show:
    - total votes
    - votes_by_party and votes_by_alliance
    - seats_leading_by_party and seats_leading_by_alliance
    - tied/no_votes/disabled_count
- Use fetch with:
  - credentials: "include"

CAPTCHA INTEGRATION
- Provide a frontend widget for Turnstile or reCAPTCHA based on env.
- Backend verifies captcha_token:
  - Turnstile verify endpoint
  - reCAPTCHA verify endpoint
- In dev, allow CAPTCHA_PROVIDER=none and skip verification.

CORS + COOKIES
- Enable CORS on Flask:
  - allow frontend origin from env FRONTEND_ORIGIN
  - supports_credentials=True
- Ensure cookies are set with correct domain/path for local dev.

RATE LIMITING
- Implement Flask-Limiter with memory storage for dev; document using Redis for prod (optional).
- Apply limits:
  - /vote: “5 per hour” and “20 per day” per IP
  - (optional) also per endpoint or per route.

REPO STRUCTURE
/backend
  app.py
  config.py
  db.py
  captcha.py
  import_candidates.py
  requirements.txt
/frontend
  package.json
  vite.config.js
  src/
    main.jsx
    api.js
    pages/MapVotePage.jsx
    pages/StatsPage.jsx
    components/Map.jsx
    components/ConstituencyPanel.jsx
    components/CaptchaWidget.jsx
docker-compose.yml
README.md
.env.example (frontend + backend)

DELIVERABLES
- Full code for backend + frontend with instructions to run locally.
- Working import script for the CSV.
- Working map selection, voting, results display, and stats dashboard.
- README explaining limitations (no MAC, deterrence only) and how “seats leading” is calculated.

START NOW
1) Output the folder structure.
2) Generate all code files with complete implementations.
3) Provide step-by-step run instructions:
   - setup MongoDB Atlas URI
   - set env
   - run import script
   - run backend
   - run frontend
   - open app and test vote + stats
