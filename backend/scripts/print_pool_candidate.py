import asyncio
import sys

import openstack
from keystoneauth1.identity import v3 as ks_v3
from keystoneauth1 import session as ks_session

from app.config import get_settings
from app.providers.openstack import _legacy_requests_session


def _connect_system() -> openstack.connection.Connection:
    s = get_settings()
    auth = ks_v3.Password(
        auth_url=s.os_auth_url,
        username=s.os_username,
        password=s.os_password.get_secret_value(),
        user_domain_name=s.os_user_domain_name,
        project_id=s.os_project_id or None,
        project_domain_name=s.os_project_domain_name if not s.os_project_id else None,
    )
    sess = ks_session.Session(
        auth=auth, verify=False, session=_legacy_requests_session()
    )
    return openstack.connection.Connection(
        session=sess,
        region_name=s.os_region_name,
        interface=s.os_interface,
        identity_api_version=s.os_identity_api_version,
    )


async def run() -> None:
    settings = get_settings()
    conn = _connect_system()

    project = conn.identity.get_project(settings.os_project_id) if settings.os_project_id else None
    if project is None:
        projects = list(conn.identity.projects())
        if not projects:
            sys.exit("Не найдено ни одного проекта в КИ для текущих OS_* кредов")
        project = projects[0]

    domain = conn.identity.get_domain(project.domain_id)
    networks = list(conn.network.networks(project_id=project.id))

    print(f"# Сгенерировано scripts/print_pool_candidate.py")
    print(f"# Проект: {project.name} ({project.id})")
    print(f"# Домен:  {domain.name} ({domain.id})")
    if not networks:
        print(f"# WARNING: в проекте нет сетей создайте сеть в КИ перед seed")
    print()

    for net in networks:
        print(f'- ki_project_id:   "{project.id}"')
        print(f'  ki_project_name: {project.name}')
        print(f'  ki_domain_id:    "{domain.id}"')
        print(f'  ki_domain_name:  {domain.name}')
        print(f'  ki_network_id:   "{net.id}"  # network {net.name}')
        print(f'  # ki_router_id: <опционально>')
        print()

    if not networks:
        print(f'- ki_project_id:   "{project.id}"')
        print(f'  ki_project_name: {project.name}')
        print(f'  ki_domain_id:    "{domain.id}"')
        print(f'  ki_domain_name:  {domain.name}')
        print(f'  ki_network_id:   "REPLACE-WITH-NETWORK-UUID"')


def main() -> None:
    asyncio.run(run())


if __name__ == "__main__":
    main()
