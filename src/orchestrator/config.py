"""
This file contains the configuration for the orchestrator service which is taken
from `ServiceConfig().config_dir / "config.yaml"` which can be configured using the
`SERVICE_CONFIG_DIR` env variable.
"""

from pathlib import Path

import confz
from pydantic import SecretStr
from pydase.config import ServiceConfig


class ServiceHostConfig(confz.BaseConfig):  # type: ignore[misc]
    hostname: str
    username: str
    password: SecretStr | None = None
    ssh_key_path: Path | None = None


class SystemdServiceOrchestratorConfig(confz.BaseConfig):  # type: ignore[misc]
    service_hosts: list[ServiceHostConfig]

    CONFIG_SOURCES = confz.FileSource(file=ServiceConfig().config_dir / "config.yaml")
