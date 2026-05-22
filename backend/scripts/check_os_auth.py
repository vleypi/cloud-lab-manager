import json
import os
import ssl
import urllib.error
import urllib.request


def main() -> None:
    auth_url = os.environ["OS_AUTH_URL"].rstrip("/")
    body = json.dumps(
        {
            "auth": {
                "identity": {
                    "methods": ["password"],
                    "password": {
                        "user": {
                            "name": os.environ["OS_USERNAME"],
                            "domain": {"name": os.environ["OS_USER_DOMAIN_NAME"]},
                            "password": os.environ["OS_PASSWORD"],
                        }
                    },
                },
                "scope": {"project": {"id": os.environ["OS_PROJECT_ID"]}},
            }
        }
    ).encode()

    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    req = urllib.request.Request(
        f"{auth_url}/auth/tokens",
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    print(f"AUTH_URL  = {auth_url}/auth/tokens")
    print(f"USERNAME  = {os.environ['OS_USERNAME']!r}")
    print(f"USER_DOM  = {os.environ['OS_USER_DOMAIN_NAME']!r}")
    print(f"PROJECT   = {os.environ['OS_PROJECT_ID']!r}")
    print(f"PWD chars = {len(os.environ['OS_PASSWORD'])}")
    print("-" * 60)

    try:
        resp = urllib.request.urlopen(req, context=ctx, timeout=20)
        print(f"HTTP {resp.status} {resp.reason}")
        print(f"X-Subject-Token present: {bool(resp.headers.get('X-Subject-Token'))}")
        data = json.loads(resp.read().decode())
        token_info = data.get("token", {})
        print(f"Roles: {[r.get('name') for r in token_info.get('roles', [])]}")
        project = token_info.get("project") or {}
        print(f"Scoped project: id={project.get('id')} name={project.get('name')}")
    except urllib.error.HTTPError as e:
        print(f"HTTP {e.code} {e.reason}")
        try:
            print(e.read().decode()[:1000])
        except Exception:
            pass
    except Exception as e:  # noqa: BLE001
        print(f"ERROR: {e!r}")


if __name__ == "__main__":
    main()
