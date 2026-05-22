import os
import ssl

import requests
import urllib3
from keystoneauth1 import session as ks_session
from keystoneauth1.identity import v3 as ks_v3
from openstack import connection as os_connection
from requests.adapters import HTTPAdapter
from urllib3.util.ssl_ import create_urllib3_context

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)


class _LegacyTLSAdapter(HTTPAdapter):
    def init_poolmanager(self, *args, **kwargs):
        ctx = create_urllib3_context(ciphers="DEFAULT@SECLEVEL=0")
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        kwargs["ssl_context"] = ctx
        return super().init_poolmanager(*args, **kwargs)


def _legacy_session() -> requests.Session:
    s = requests.Session()
    s.mount("https://", _LegacyTLSAdapter())
    return s


def main() -> None:
    auth_url = os.environ["OS_AUTH_URL"]
    username = os.environ["OS_USERNAME"]
    password = os.environ["OS_PASSWORD"]
    user_domain = os.environ["OS_USER_DOMAIN_NAME"]
    project_id = os.environ["OS_PROJECT_ID"]
    region = os.environ.get("OS_REGION_NAME", "RegionOne")

    print(f"AUTH_URL    = {auth_url}")
    print(f"USERNAME    = {username!r}")
    print(f"USER_DOMAIN = {user_domain!r}")
    print(f"PROJECT     = {project_id!r}")
    print(f"PWD chars   = {len(password)}")
    print("=" * 70)

    auth = ks_v3.Password(
        auth_url=auth_url,
        username=username,
        password=password,
        user_domain_name=user_domain,
        project_id=project_id,
    )
    sess = ks_session.Session(auth=auth, verify=False, session=_legacy_session())

    print("[1] direct keystoneauth get_token()...")
    try:
        token = sess.get_token()
        print(f"    token ok, len={len(token) if token else 0}")
    except Exception as e:  # noqa: BLE001
        print(f"    FAILED: {type(e).__name__}: {e}")
        return

    print("[2] openstack.connection.Connection(...).compute.create_keypair flow")
    conn = os_connection.Connection(
        session=sess,
        region_name=region,
        interface="public",
        identity_api_version="3",
    )
    try:
        adapter = conn.compute
        print(f"    conn.compute proxy created: {type(adapter).__name__}")
    except Exception as e:  # noqa: BLE001
        print(f"    conn.compute access FAILED: {type(e).__name__}: {e}")
        return

    print("[3] list_keypairs (read-only test)")
    try:
        kps = list(conn.compute.keypairs())
        print(f"    keypairs ok, count={len(kps)}")
    except Exception as e:  # noqa: BLE001
        print(f"    list_keypairs FAILED: {type(e).__name__}: {e}")
        return

    print("[4] create_keypair (the call that fails in worker)")
    try:
        kp = conn.compute.create_keypair(name="diagnostic-test-keypair")
        print(f"    create_keypair ok: name={kp.name} fp={kp.fingerprint[:20]}")
        conn.compute.delete_keypair(kp.name, ignore_missing=True)
        print("    cleaned up")
    except Exception as e:  # noqa: BLE001
        print(f"    create_keypair FAILED: {type(e).__name__}: {e}")


if __name__ == "__main__":
    main()
