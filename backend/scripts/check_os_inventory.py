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


def _legacy_session():
    s = requests.Session()
    s.mount("https://", _LegacyTLSAdapter())
    return s


def main() -> None:
    auth = ks_v3.Password(
        auth_url=os.environ["OS_AUTH_URL"],
        username=os.environ["OS_USERNAME"],
        password=os.environ["OS_PASSWORD"],
        user_domain_name=os.environ["OS_USER_DOMAIN_NAME"],
        project_id=os.environ["OS_PROJECT_ID"],
    )
    sess = ks_session.Session(auth=auth, verify=False, session=_legacy_session())
    conn = os_connection.Connection(
        session=sess, region_name="RegionOne", interface="public", identity_api_version="3"
    )

    print("=== KEYPAIRS ===")
    for kp in conn.compute.keypairs():
        print(f"  {kp.name}  fp={kp.fingerprint}")

    print("\n=== SERVERS ===")
    for s in conn.compute.servers():
        print(f"  {s.name}  id={s.id}  status={s.status}")

    print("\n=== NETWORKS (project + external) ===")
    for n in conn.network.networks():
        kind = "EXT" if getattr(n, "is_router_external", False) else "int"
        print(f"  [{kind}] {n.name}  id={n.id}")

    print("\n=== FLOATING IPS ===")
    for fip in conn.network.ips():
        print(f"  {fip.floating_ip_address}  port_id={fip.port_id}  status={fip.status}")

    print("\n=== QUOTAS ===")
    project_id = os.environ["OS_PROJECT_ID"]
    try:
        q = conn.compute.get(f"/os-quota-sets/{project_id}/detail").json()
        for k, v in (q.get("quota_set") or {}).items():
            if isinstance(v, dict):
                print(f"  {k}: in_use={v.get('in_use')} limit={v.get('limit')}")
    except Exception as e:  # noqa: BLE001
        print(f"  quota query failed: {e}")


if __name__ == "__main__":
    main()
