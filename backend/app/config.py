from functools import lru_cache
from typing import Literal

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    app_env: Literal["development", "staging", "production"] = "development"
    app_debug: bool = False
    app_host: str = "0.0.0.0" 
    app_port: int = 8000
    app_secret_key: SecretStr = Field(default=SecretStr("change-me"))

    database_url: str = "postgresql+asyncpg://ki_user:ki_password@localhost:5432/cloud_lab_manager"

    os_auth_url: str = ""
    os_region_name: str = "RegionOne"
    os_interface: Literal["public", "internal", "admin"] = "public"
    os_identity_api_version: str = "3"
    os_username: str = ""
    os_password: SecretStr = Field(default=SecretStr(""))
    os_user_domain_name: str = "Default"
    os_project_domain_name: str = "Default"
    os_project_id: str = ""
    os_system_scope: str = "all"

    capacity_threshold_percent: float = 90.0
    capacity_cache_ttl_seconds: int = 15

    stand_default_ttl_seconds: int = 7200
    stand_freeze_ttl_seconds: int = 86400

    redis_url: str = "redis://localhost:6379/0"
    celery_broker_url: str = "redis://localhost:6379/1"
    celery_result_backend: str = "redis://localhost:6379/2"
    celery_task_always_eager: bool = False

    credentials_ttl_seconds: int = 48 * 3600
    sweep_interval_seconds: int = 60
    provision_stall_seconds: int = 900

    stand_boot_volume_gb: int = 20

    inspector_ssh_private_key_path: str = "./secrets/inspector_ed25519"
    inspector_ssh_public_key_path: str = "./secrets/inspector_ed25519.pub"
    inspector_ssh_username: str = "inspector"
    inspector_ssh_port: int = 22
    inspector_ssh_connect_timeout_seconds: int = 15
    inspector_command_timeout_seconds: int = 30
    check_templates_dir: str = "./check_templates"

    lti_frontend_launch_url: str = "http://localhost:8080/lti/launching/{stand_id}"
    lti_tool_private_key_path: str = "./secrets/lti_tool_rsa.pem"
    lti_tool_public_key_path: str = "./secrets/lti_tool_rsa.pub"
    lti_tool_kid: str = "cloud-lab-manager-key-1"
    lti_launch_state_ttl_seconds: int = 300
    lti_tool_base_url: str = "http://localhost:8000"
    lti_embed_frame_ancestors: str = ""

    jwt_access_secret: SecretStr = Field(default=SecretStr("dev-access-secret-change-me"))
    jwt_refresh_secret: SecretStr = Field(default=SecretStr("dev-refresh-secret-change-me"))
    jwt_access_ttl_seconds: int = 900
    jwt_refresh_ttl_seconds: int = 604_800

    super_admin_email: str = ""
    super_admin_password_hash: SecretStr = Field(default=SecretStr(""))
    super_admin_display_name: str = "System Administrator"

    cookie_domain: str = ""
    cookie_secure: bool = False
    cookie_samesite: Literal["lax", "none", "strict"] = "lax"
    cookie_access_name: str = "ki_access"
    cookie_refresh_name: str = "ki_refresh"
    cookie_csrf_name: str = "ki_csrf"

    csrf_header_name: str = "X-CSRF-Token"
    csrf_ttl_seconds: int = 28_800


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
