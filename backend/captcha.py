import os
import requests


def verify_captcha(provider: str, secret_key: str, token: str, remoteip: str | None = None) -> bool:
    if provider == "none":
        return True
    if not token:
        return False

    if provider == "turnstile":
        url = "https://challenges.cloudflare.com/turnstile/v0/siteverify"
        data = {"secret": secret_key, "response": token}
        if remoteip:
            data["remoteip"] = remoteip
        try:
            resp = requests.post(url, data=data, timeout=10)
            return resp.ok and resp.json().get("success") is True
        except Exception:
            return False

    if provider == "recaptcha":
        url = "https://www.google.com/recaptcha/api/siteverify"
        data = {"secret": secret_key, "response": token}
        if remoteip:
            data["remoteip"] = remoteip
        try:
            resp = requests.post(url, data=data, timeout=10)
            return resp.ok and resp.json().get("success") is True
        except Exception:
            return False

    return False
