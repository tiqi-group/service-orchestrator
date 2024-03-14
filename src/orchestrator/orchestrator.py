import asyncio
import logging

import pydase

from orchestrator.config import SystemdServiceOrchestratorConfig
from orchestrator.service_host import ServiceHost

logger = logging.getLogger(__name__)


class SystemdServiceOrchestrator(pydase.DataService):
    def __init__(self) -> None:
        super().__init__()
        self.update_wait_time: int | None = 10
        self.service_hosts = [
            ServiceHost(
                hostname=host.hostname,
                username=host.username,
                password=host.password,
                key_path=host.ssh_key_path,
            )
            for host in SystemdServiceOrchestratorConfig().service_hosts
        ]
        self._autostart_tasks["update_hosts"] = ()  # type: ignore

    def update(self) -> None:
        for host in self.service_hosts:
            host.service_proxy_list = host.get_service_proxy_list()

    async def update_hosts(self) -> None:
        while True:
            self.update()

            if self.update_wait_time is None:
                break
            await asyncio.sleep(self.update_wait_time)
