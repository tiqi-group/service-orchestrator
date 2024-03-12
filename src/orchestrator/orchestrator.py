import logging

import pydase

from orchestrator.config import SystemdServiceOrchestratorConfig
from orchestrator.service_host import ServiceHost

logger = logging.getLogger(__name__)


class SystemdServiceOrchestrator(pydase.DataService):
    def __init__(self) -> None:
        super().__init__()
        self.service_hosts = [
            ServiceHost(
                hostname=host.hostname,
                username=host.username,
                password=host.password,
                key_path=host.ssh_key_path,
            )
            for host in SystemdServiceOrchestratorConfig().service_hosts
        ]
