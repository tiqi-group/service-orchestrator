import logging

import pydase

from orchestrator.config import SystemdServiceOrchestratorConfig

logger = logging.getLogger(__name__)


class SystemdServiceOrchestrator(pydase.DataService):
    def __init__(self) -> None:
        super().__init__()
        logger.info(SystemdServiceOrchestratorConfig().service_hosts)
