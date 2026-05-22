import abc
from functools import lru_cache

from app.providers.types import (
    CloudFlavor,
    CloudImage,
    CloudNetwork,
    ClusterUtilization,
    DeployedServer,
    KeyPair,
    KiDomain,
    KiProject,
)


class CloudProvider(abc.ABC):
    # суммарная утилизация кластера для capacity guard
    @abc.abstractmethod
    async def get_cluster_utilization(self) -> ClusterUtilization: ...

    # запросить Nova сгенерировать SSH-ключ внутри проекта
    @abc.abstractmethod
    async def create_keypair(self, project_id: str, name: str) -> KeyPair: ...

    @abc.abstractmethod
    async def delete_keypair(self, project_id: str, name: str) -> None: ...

    # развернуть VM из Glance-образа
    @abc.abstractmethod
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
    ) -> DeployedServer: ...

    @abc.abstractmethod
    async def get_server(self, project_id: str, server_id: str) -> DeployedServer: ...

    @abc.abstractmethod
    async def delete_server(self, project_id: str, server_id: str) -> None: ...

    @abc.abstractmethod
    async def attach_floating_ip(
        self,
        *,
        project_id: str,
        server_id: str,
        external_network_id: str | None = None,
    ) -> str: ...

    @abc.abstractmethod
    async def get_vnc_console_url(self, project_id: str, server_id: str) -> str: ...

    # видимые в проекте сети для выпадающего списка
    @abc.abstractmethod
    async def list_networks(self, project_id: str | None = None) -> list[CloudNetwork]: ...

    # доступные Glance-образы
    @abc.abstractmethod
    async def list_images(self) -> list[CloudImage]: ...

    # доступные Nova-flavor'ы
    @abc.abstractmethod
    async def list_flavors(self) -> list[CloudFlavor]: ...

    # один flavor по id для предиктивного capacity-check
    @abc.abstractmethod
    async def get_flavor(self, flavor_id: str) -> CloudFlavor: ...

    @abc.abstractmethod
    async def list_domains(self) -> list[KiDomain]: ...

    @abc.abstractmethod
    async def list_ki_projects(
        self,
        *,
        domain_id: str | None = None,
    ) -> list[KiProject]: ...


@lru_cache(maxsize=1)
def get_cloud_provider() -> CloudProvider:
    from app.providers.openstack import OpenStackProvider

    return OpenStackProvider()
