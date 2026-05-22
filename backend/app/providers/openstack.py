import asyncio
import base64
import ssl
import threading
from typing import Any

import openstack
import requests
import structlog
import urllib3
from keystoneauth1 import exceptions as ks_exc
from keystoneauth1 import session as ks_session
from keystoneauth1.identity import v3 as ks_v3
from openstack import connection as os_connection
from openstack import exceptions as os_exc
from requests.adapters import HTTPAdapter
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)
from urllib3.util.ssl_ import create_urllib3_context

from app.config import get_settings
from app.core.exceptions import CloudProviderError
from app.providers.base import CloudProvider
from app.providers.types import (
    CloudFlavor,
    CloudImage,
    CloudNetwork,
    ClusterUtilization,
    DeployedServer,
    KeyPair,
    KiDomain,
    KiProject,
    ResourceUsage,
    ServerStatus,
)

logger = structlog.get_logger(__name__)

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)


class _LegacyTLSAdapter(HTTPAdapter):
    def init_poolmanager(self, *args: Any, **kwargs: Any) -> Any:
        ctx = create_urllib3_context(ciphers="DEFAULT@SECLEVEL=0")
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        kwargs["ssl_context"] = ctx
        return super().init_poolmanager(*args, **kwargs)

    def proxy_manager_for(self, *args: Any, **kwargs: Any) -> Any:
        ctx = create_urllib3_context(ciphers="DEFAULT@SECLEVEL=0")
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        kwargs["ssl_context"] = ctx
        return super().proxy_manager_for(*args, **kwargs)


def _legacy_requests_session() -> requests.Session:
    sess = requests.Session()
    sess.mount("https://", _LegacyTLSAdapter())
    return sess


_TRANSIENT = (
    os_exc.HttpException,
    os_exc.SDKException,
    ks_exc.Unauthorized,
    ks_exc.ConnectFailure,
    ks_exc.DiscoveryFailure,
    ConnectionError,
    TimeoutError,
)


def _retry():
    return retry(
        retry=retry_if_exception_type(_TRANSIENT),
        wait=wait_exponential(multiplier=0.5, min=0.5, max=4),
        stop=stop_after_attempt(3),
        reraise=True,
    )


def _warm_up_auth(sess: ks_session.Session, *, project_id: str | None) -> None:
    @retry(
        retry=retry_if_exception_type(
            (ks_exc.Unauthorized, ks_exc.ConnectFailure, ConnectionError, TimeoutError)
        ),
        wait=wait_exponential(multiplier=1.0, min=1.0, max=8.0),
        stop=stop_after_attempt(5),
        reraise=True,
    )
    def _do() -> None:
        sess.invalidate()
        sess.get_token()

    try:
        _do()
        logger.info(
            "openstack_auth_warmed_up",
            project_id=project_id,
            attempts_until_success="<=5",
        )
    except Exception as exc:
        logger.warning(
            "openstack_auth_warmup_failed",
            project_id=project_id,
            error=str(exc)[:200],
        )
        raise


class OpenStackProvider(CloudProvider):
    def __init__(self) -> None:
        self._settings = get_settings()
        self._system_conn: openstack.connection.Connection | None = None
        self._project_conns: dict[str, openstack.connection.Connection] = {}
        self._build_lock = threading.Lock()

    def _build_connection(self, *, project_id: str | None) -> openstack.connection.Connection:
        settings = self._settings
        auth_kwargs: dict[str, Any] = {
            "auth_url": settings.os_auth_url,
            "username": settings.os_username,
            "password": settings.os_password.get_secret_value(),
            "user_domain_name": settings.os_user_domain_name,
        }
        if project_id is not None:
            auth_kwargs["project_id"] = project_id
        elif settings.os_project_id:
            auth_kwargs["project_id"] = settings.os_project_id
        else:
            auth_kwargs["project_name"] = settings.os_username
            auth_kwargs["project_domain_name"] = settings.os_project_domain_name

        logger.info(
            "build_connection",
            auth_url=auth_kwargs["auth_url"],
            username=auth_kwargs["username"],
            user_domain_name=auth_kwargs["user_domain_name"],
            project_id=auth_kwargs.get("project_id"),
            password_len=len(auth_kwargs["password"]),
        )

        try:
            auth = ks_v3.Password(**auth_kwargs)
            sess = ks_session.Session(
                auth=auth,
                verify=False,
                session=_legacy_requests_session(),
            )
            _warm_up_auth(sess, project_id=auth_kwargs.get("project_id"))
            return os_connection.Connection(
                session=sess,
                region_name=settings.os_region_name,
                interface=settings.os_interface,
                identity_api_version=settings.os_identity_api_version,
            )
        except (os_exc.SDKException, ks_exc.Unauthorized) as exc:
            raise CloudProviderError(
                "Failed to authenticate against KI Keystone",
                details={"project_id": project_id},
            ) from exc

    async def _system(self) -> openstack.connection.Connection:
        if self._system_conn is None:
            self._system_conn = await asyncio.to_thread(self._build_or_get_system_sync)
        return self._system_conn

    def _build_or_get_system_sync(self) -> openstack.connection.Connection:
        with self._build_lock:
            if self._system_conn is None:
                self._system_conn = self._build_connection(project_id=None)
            return self._system_conn

    async def _project(self, project_id: str) -> openstack.connection.Connection:
        conn = self._project_conns.get(project_id)
        if conn is not None:
            return conn
        return await asyncio.to_thread(self._build_or_get_project_sync, project_id)

    def _build_or_get_project_sync(self, project_id: str) -> openstack.connection.Connection:
        with self._build_lock:
            conn = self._project_conns.get(project_id)
            if conn is None:
                conn = self._build_connection(project_id=project_id)
                self._project_conns[project_id] = conn
            return conn

    async def get_cluster_utilization(self) -> ClusterUtilization:
        try:
            conn = await self._system()
            stats = await asyncio.to_thread(self._fetch_hypervisor_statistics, conn)
            return ClusterUtilization(
                vcpus=ResourceUsage(
                    used=float(stats.get("vcpus_used", 0)),
                    total=float(stats.get("vcpus", 0)),
                ),
                memory_mb=ResourceUsage(
                    used=float(stats.get("memory_mb_used", 0)),
                    total=float(stats.get("memory_mb", 0)),
                ),
                local_gb=ResourceUsage(
                    used=float(stats.get("local_gb_used", 0)),
                    total=float(stats.get("local_gb", 0)),
                ),
                running_vms=int(stats.get("running_vms", 0)),
            )
        except (ks_exc.Unauthorized, ks_exc.Forbidden, os_exc.HttpException) as exc:
            status = getattr(exc, "http_status", None) or getattr(exc, "status_code", None)
            logger.info(
                "system_stats_unavailable_using_quotas",
                status=status,
                error=str(exc),
            )
        except _TRANSIENT as exc:
            raise CloudProviderError(
                "Failed to query KI hypervisor statistics",
            ) from exc

        return await self._quota_based_utilization()

    async def _quota_based_utilization(self) -> ClusterUtilization:
        try:
            conn = await self._system()
            project_id = await asyncio.to_thread(lambda: conn.session.get_project_id())
            quota = await asyncio.to_thread(
                lambda: conn.compute.get(f"/os-quota-sets/{project_id}/detail").json()
            )
        except (ks_exc.Unauthorized, ks_exc.Forbidden) as exc:
            raise CloudProviderError(
                "KI Keystone rejected the orchestrator credentials",
                details={"status": getattr(exc, "http_status", 401)},
            ) from exc
        except _TRANSIENT as exc:
            raise CloudProviderError("Failed to query project quota") from exc

        qs = quota.get("quota_set", {})

        def _usage(entry: dict | None) -> ResourceUsage:
            entry = entry or {}
            used = float(entry.get("in_use", 0))
            limit = float(entry.get("limit", 0))
            if limit < 0:
                limit = max(used * 2, 1.0)
            return ResourceUsage(used=used, total=limit)

        disk_entry: dict | None = None
        try:
            conn_for_disk = await self._system()
            disk_quota = await asyncio.to_thread(
                lambda: conn_for_disk.block_storage.get(
                    f"/os-quota-sets/{project_id}?usage=true"
                ).json()
            )
            qs_disk = disk_quota.get("quota_set") or {}
            default = qs_disk.get("gigabytes_default") or {}
            if default and float(default.get("limit", -1)) >= 0:
                disk_entry = default
            else:
                disk_entry = qs_disk.get("gigabytes")
        except Exception as exc:
            logger.info("cinder_quota_unavailable", error=str(exc))

        return ClusterUtilization(
            vcpus=_usage(qs.get("cores")),
            memory_mb=_usage(qs.get("ram")),
            local_gb=_usage(disk_entry),
            running_vms=int((qs.get("instances") or {}).get("in_use", 0)),
        )

    @_retry()
    def _fetch_hypervisor_statistics(self, conn: openstack.connection.Connection) -> dict[str, Any]:
        try:
            resp = conn.compute.get("/os-hypervisors/statistics")
            if resp.status_code >= 400:
                raise os_exc.HttpException(
                    f"hypervisor statistics returned HTTP {resp.status_code}",
                    response=resp,
                    http_status=resp.status_code,
                )
            stats_obj = resp.json()
            return stats_obj.get("hypervisor_statistics", stats_obj)
        except AttributeError:
            agg = {
                "vcpus": 0,
                "vcpus_used": 0,
                "memory_mb": 0,
                "memory_mb_used": 0,
                "local_gb": 0,
                "local_gb_used": 0,
                "running_vms": 0,
            }
            for h in conn.compute.hypervisors(details=True):
                agg["vcpus"] += int(h.vcpus or 0)
                agg["vcpus_used"] += int(getattr(h, "vcpus_used", 0) or 0)
                agg["memory_mb"] += int(getattr(h, "memory_size", 0) or 0)
                agg["memory_mb_used"] += int(getattr(h, "memory_used", 0) or 0)
                agg["local_gb"] += int(getattr(h, "local_disk_size", 0) or 0)
                agg["local_gb_used"] += int(getattr(h, "local_disk_used", 0) or 0)
                agg["running_vms"] += int(getattr(h, "running_vms", 0) or 0)
            return agg

    async def create_keypair(self, project_id: str, name: str) -> KeyPair:
        conn = await self._project(project_id)
        try:
            kp = await asyncio.to_thread(self._create_keypair, conn, name)
        except _TRANSIENT as exc:
            raise CloudProviderError(
                "Failed to create SSH keypair in KI",
                details={"project_id": project_id, "keypair": name},
            ) from exc

        return KeyPair(
            name=kp.name,
            fingerprint=kp.fingerprint,
            public_key=kp.public_key,
            private_key=kp.private_key,
        )

    @_retry()
    def _create_keypair(self, conn: openstack.connection.Connection, name: str):
        return conn.compute.create_keypair(name=name)

    async def delete_keypair(self, project_id: str, name: str) -> None:
        conn = await self._project(project_id)
        try:
            await asyncio.to_thread(conn.compute.delete_keypair, name, ignore_missing=True)
        except _TRANSIENT as exc:
            raise CloudProviderError(
                "Failed to delete SSH keypair",
                details={"project_id": project_id, "keypair": name},
            ) from exc

    async def create_server(
        self,
        *,
        project_id: str,
        name: str,
        image_id: str,
        flavor_id: str,
        network_id: str,
        keypair_name: str,
        user_data: str | None = None,
        metadata: dict[str, str] | None = None,
    ) -> DeployedServer:
        conn = await self._project(project_id)
        try:
            srv = await asyncio.to_thread(
                self._create_server,
                conn,
                name=name,
                image_id=image_id,
                flavor_id=flavor_id,
                network_id=network_id,
                keypair_name=keypair_name,
                user_data=user_data,
                metadata=metadata or {},
            )
        except _TRANSIENT as exc:
            raise CloudProviderError(
                "Failed to create server in KI",
                details={"project_id": project_id, "image_id": image_id},
            ) from exc

        return _project_server(srv)

    def _create_server(
        self,
        conn: openstack.connection.Connection,
        *,
        name: str,
        image_id: str,
        flavor_id: str,
        network_id: str,
        keypair_name: str,
        user_data: str | None,
        metadata: dict[str, str],
    ):
        encoded_user_data = (
            base64.b64encode(user_data.encode("utf-8")).decode("ascii") if user_data else None
        )

        volume_size = self._settings.stand_boot_volume_gb
        try:
            image = conn.image.get_image(image_id)
            min_disk = int(getattr(image, "min_disk", 0) or 0)
            if min_disk > volume_size:
                volume_size = min_disk
        except _TRANSIENT as exc:
            logger.warning(
                "image_min_disk_lookup_failed",
                image_id=image_id,
                error=str(exc),
            )

        block_device_mapping = [
            {
                "boot_index": "0",
                "uuid": image_id,
                "source_type": "image",
                "destination_type": "volume",
                "volume_size": volume_size,
                "delete_on_termination": True,
            }
        ]
        return conn.compute.create_server(
            name=name,
            flavor_id=flavor_id,
            networks=[{"uuid": network_id}],
            key_name=keypair_name,
            user_data=encoded_user_data,
            metadata=metadata,
            block_device_mapping_v2=block_device_mapping,
        )

    async def get_server(self, project_id: str, server_id: str) -> DeployedServer:
        conn = await self._project(project_id)
        try:
            srv = await asyncio.to_thread(conn.compute.get_server, server_id)
        except os_exc.ResourceNotFound as exc:
            raise CloudProviderError(
                "Server not found in KI",
                details={"server_id": server_id},
            ) from exc
        except _TRANSIENT as exc:
            raise CloudProviderError("Failed to fetch server") from exc
        return _project_server(srv)

    async def delete_server(self, project_id: str, server_id: str) -> None:
        conn = await self._project(project_id)
        try:
            await asyncio.to_thread(conn.compute.delete_server, server_id, ignore_missing=True)
        except _TRANSIENT as exc:
            raise CloudProviderError("Failed to delete server") from exc

    async def attach_floating_ip(
        self,
        *,
        project_id: str,
        server_id: str,
        external_network_id: str | None = None,
    ) -> str:
        conn = await self._project(project_id)
        try:
            ip = await asyncio.to_thread(
                self._attach_floating_ip,
                conn,
                server_id=server_id,
                external_network_id=external_network_id,
            )
        except CloudProviderError:
            raise
        except Exception as exc:
            raise CloudProviderError(
                "Failed to attach floating IP",
                details={
                    "server_id": server_id,
                    "exc_type": type(exc).__name__,
                    "error": str(exc)[:500],
                },
            ) from exc
        return ip

    async def get_vnc_console_url(self, project_id: str, server_id: str) -> str:
        conn = await self._project(project_id)
        try:
            url = await asyncio.to_thread(self._get_vnc_console_url, conn, server_id)
        except Exception as exc:
            raise CloudProviderError(
                "Failed to obtain VNC console URL",
                details={"server_id": server_id, "error": str(exc)[:200]},
            ) from exc
        return url

    def _get_vnc_console_url(self, conn: openstack.connection.Connection, server_id: str) -> str:
        try:
            resp = conn.compute.post(
                f"/servers/{server_id}/remote-consoles",
                json={"remote_console": {"protocol": "vnc", "type": "novnc"}},
                headers={"OpenStack-API-Version": "compute 2.6"},
            )
            body = resp.json() if hasattr(resp, "json") else {}
            url = (body.get("remote_console") or {}).get("url")
            if url:
                return url
        except Exception as exc:
            logger.info("remote_consoles_failed_falling_back", error=str(exc)[:200])

        resp = conn.compute.post(
            f"/servers/{server_id}/action",
            json={"os-getVNCConsole": {"type": "novnc"}},
        )
        body = resp.json() if hasattr(resp, "json") else {}
        url = (body.get("console") or {}).get("url")
        if not url:
            raise CloudProviderError(
                "OpenStack did not return a console URL",
                details={"server_id": server_id, "response": str(body)[:200]},
            )
        return url

    @_retry()
    def _attach_floating_ip(
        self,
        conn: openstack.connection.Connection,
        *,
        server_id: str,
        external_network_id: str | None,
    ) -> str:
        ext_net_id = external_network_id
        if not ext_net_id:
            for net in conn.network.networks():
                if getattr(net, "is_router_external", False):
                    ext_net_id = net.id
                    break
        if not ext_net_id:
            raise CloudProviderError("No external network available for floating IP")

        ports = list(conn.network.ports(device_id=server_id))
        if not ports:
            raise CloudProviderError("Server has no Neutron port, floating IP cannot be attached")
        port = ports[0]

        free_fip = None
        for fip in conn.network.ips():
            if getattr(fip, "port_id", None) in (None, ""):
                free_fip = fip
                break
        if free_fip is not None:
            conn.network.update_ip(free_fip, port_id=port.id)
            return free_fip.floating_ip_address

        fip = conn.network.create_ip(floating_network_id=ext_net_id, port_id=port.id)
        return fip.floating_ip_address

    async def list_networks(self, project_id: str | None = None) -> list[CloudNetwork]:
        conn = await self._project(project_id) if project_id is not None else await self._system()
        try:
            nets = await asyncio.to_thread(lambda: list(conn.network.networks()))
        except _TRANSIENT as exc:
            raise CloudProviderError("Failed to list networks") from exc
        out: list[CloudNetwork] = []
        for n in nets:
            cidr = None
            try:
                subnets = await asyncio.to_thread(
                    lambda nid=n.id: list(conn.network.subnets(network_id=nid))
                )
                if subnets:
                    cidr = getattr(subnets[0], "cidr", None)
            except _TRANSIENT:
                pass
            out.append(
                CloudNetwork(
                    id=n.id,
                    name=getattr(n, "name", "") or n.id,
                    cidr=cidr,
                    is_external=bool(getattr(n, "is_router_external", False)),
                )
            )
        return out

    async def list_images(self) -> list[CloudImage]:
        conn = await self._system()
        try:
            images = await asyncio.to_thread(lambda: list(conn.image.images()))
        except _TRANSIENT as exc:
            raise CloudProviderError("Failed to list images") from exc
        out = []
        for img in images:
            size = getattr(img, "size", None)
            out.append(
                CloudImage(
                    id=img.id,
                    name=getattr(img, "name", "") or img.id,
                    os_type=getattr(img, "os_distro", None),
                    size_mb=int(size / 1024 / 1024) if size else None,
                )
            )
        return out

    async def list_flavors(self) -> list[CloudFlavor]:
        conn = await self._system()
        try:
            flavors = await asyncio.to_thread(lambda: list(conn.compute.flavors()))
        except _TRANSIENT as exc:
            raise CloudProviderError("Failed to list flavors") from exc
        return [
            CloudFlavor(
                id=f.id,
                name=getattr(f, "name", "") or f.id,
                vcpus=int(getattr(f, "vcpus", 0) or 0),
                ram_mb=int(getattr(f, "ram", 0) or 0),
                disk_gb=int(getattr(f, "disk", 0) or 0),
            )
            for f in flavors
        ]

    async def get_flavor(self, flavor_id: str) -> CloudFlavor:
        conn = await self._system()
        try:
            f = await asyncio.to_thread(lambda: conn.compute.get_flavor(flavor_id))
        except os_exc.ResourceNotFound as exc:
            raise CloudProviderError(
                f"Flavor not found: {flavor_id}",
                details={"flavor_id": flavor_id, "status": 404},
            ) from exc
        except _TRANSIENT as exc:
            raise CloudProviderError(
                "Failed to fetch flavor",
                details={"flavor_id": flavor_id},
            ) from exc
        return CloudFlavor(
            id=f.id,
            name=getattr(f, "name", "") or f.id,
            vcpus=int(getattr(f, "vcpus", 0) or 0),
            ram_mb=int(getattr(f, "ram", 0) or 0),
            disk_gb=int(getattr(f, "disk", 0) or 0),
        )

    async def list_domains(self) -> list[KiDomain]:
        conn = await self._system()
        try:
            domains = await asyncio.to_thread(lambda: list(conn.identity.domains()))
        except (ks_exc.Unauthorized, ks_exc.Forbidden) as exc:
            logger.info("list_domains_forbidden", error=str(exc))
            return []
        except _TRANSIENT as exc:
            raise CloudProviderError("Failed to list KI domains") from exc

        out: list[KiDomain] = []
        for d in domains:
            if not getattr(d, "is_enabled", True):
                continue
            out.append(KiDomain(id=d.id, name=getattr(d, "name", "") or d.id))
        return out

    async def list_ki_projects(
        self,
        *,
        domain_id: str | None = None,
    ) -> list[KiProject]:
        conn = await self._system()
        try:
            projects = await asyncio.to_thread(self._fetch_projects, conn, domain_id=domain_id)
        except (ks_exc.Unauthorized, ks_exc.Forbidden) as exc:
            logger.info("list_ki_projects_forbidden", error=str(exc))
            return []
        except _TRANSIENT as exc:
            raise CloudProviderError("Failed to list KI projects") from exc

        domain_names: dict[str, str] = {}
        try:
            doms = await asyncio.to_thread(lambda: list(conn.identity.domains()))
            domain_names = {d.id: getattr(d, "name", "") or d.id for d in doms}
        except (ks_exc.Unauthorized, ks_exc.Forbidden):
            pass
        except _TRANSIENT as exc:
            logger.warning("domain_resolve_failed", error=str(exc))

        out: list[KiProject] = []
        for p in projects:
            if not getattr(p, "is_enabled", True):
                continue
            pid = p.id
            pname = getattr(p, "name", "") or pid
            d_id = getattr(p, "domain_id", "") or ""
            d_name = domain_names.get(d_id, d_id)
            net_id, router_id = await self._resolve_network_and_router(pid)
            out.append(
                KiProject(
                    id=pid,
                    name=pname,
                    domain_id=d_id,
                    domain_name=d_name,
                    network_id=net_id,
                    router_id=router_id,
                )
            )
        return out

    @_retry()
    def _fetch_projects(
        self,
        conn: openstack.connection.Connection,
        *,
        domain_id: str | None,
    ) -> list[Any]:
        kwargs: dict[str, Any] = {}
        if domain_id:
            kwargs["domain_id"] = domain_id
        return list(conn.identity.projects(**kwargs))

    async def _resolve_network_and_router(self, project_id: str) -> tuple[str | None, str | None]:
        conn = await self._system()
        try:
            nets = await asyncio.to_thread(
                lambda: list(conn.network.networks(project_id=project_id))
            )
        except (ks_exc.Unauthorized, ks_exc.Forbidden, os_exc.HttpException):
            return None, None
        except _TRANSIENT:
            return None, None

        internal = [n for n in nets if not getattr(n, "is_router_external", False)]
        net_id = internal[0].id if internal else None

        router_id: str | None = None
        try:
            routers = await asyncio.to_thread(
                lambda: list(conn.network.routers(project_id=project_id))
            )
            if routers:
                router_id = routers[0].id
        except (ks_exc.Unauthorized, ks_exc.Forbidden, os_exc.HttpException):
            pass
        except _TRANSIENT:
            pass

        return net_id, router_id


def _project_server(srv: Any) -> DeployedServer:
    fixed_ips: list[str] = []
    floating_ip: str | None = None
    for _net_name, addrs in (getattr(srv, "addresses", {}) or {}).items():
        for addr in addrs or []:
            if addr.get("OS-EXT-IPS:type") == "floating":
                floating_ip = addr.get("addr")
            else:
                ip = addr.get("addr")
                if ip:
                    fixed_ips.append(ip)

    try:
        status = ServerStatus(getattr(srv, "status", "UNKNOWN"))
    except ValueError:
        status = ServerStatus.UNKNOWN

    return DeployedServer(
        id=srv.id,
        name=srv.name,
        status=status,
        fixed_ips=fixed_ips,
        floating_ip=floating_ip,
    )
