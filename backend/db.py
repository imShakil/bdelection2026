from pymongo import MongoClient, ASCENDING


def get_db(mongo_uri: str, db_name: str):
    client = MongoClient(mongo_uri)
    return client[db_name]


def ensure_indexes(db):
    db.constituencies.create_index([("constituency_no", ASCENDING)], unique=True)
    db.voters.create_index([("voter_vid_hash", ASCENDING)], unique=True)
    db.tallies.create_index([("constituency_no", ASCENDING)], unique=True)
    db.votes.create_index([("constituency_no", ASCENDING)])
    db.votes.create_index([("voter_vid_hash", ASCENDING)])
