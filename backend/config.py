import os
from dataclasses import dataclass


@dataclass
class Config:
    mongo_uri: str
    db_name: str
    frontend_origin: str
    server_salt: str
    captcha_provider: str
    captcha_secret_key: str
    captcha_site_key: str
    secure_cookies: bool


def load_config() -> Config:
    return Config(
        mongo_uri=os.environ.get("MONGODB_URI", ""),
        db_name=os.environ.get("MONGODB_DB", "bd_elections_2026"),
        frontend_origin=os.environ.get("FRONTEND_ORIGIN", "http://localhost:5173"),
        server_salt=os.environ.get("SERVER_SALT", "change-me"),
        captcha_provider=os.environ.get("CAPTCHA_PROVIDER", "none"),
        captcha_secret_key=os.environ.get("CAPTCHA_SECRET_KEY", ""),
        captcha_site_key=os.environ.get("CAPTCHA_SITE_KEY", ""),
        secure_cookies=os.environ.get("SECURE_COOKIES", "false").lower() == "true",
    )
