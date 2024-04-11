import enum
import logging
from collections.abc import Callable

import pydase
from pydase.utils.decorators import frontend

logger = logging.getLogger(__name__)


class ServiceState(enum.Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    FAILED = "failed"
    ACTIVATING = "activating"
    DEACTIVATING = "deactivating"


class ManagerAction(enum.Enum):
    START = "start"
    STOP = "stop"
    RESTART = "restart"


class SystemdServiceProxy(pydase.DataService):
    def __init__(  # noqa: PLR0913
        self,
        hostname: str,
        username: str,
        unit: str,
        state: ServiceState,
        description: str,
        tags: list[str],
        systemd_unit_manager: Callable[[ManagerAction], str | None],
    ) -> None:
        super().__init__()
        self._hostname = hostname
        self._username = username
        self._unit = unit
        self._state = state
        self._description = description
        self._tags = tags
        self._systemd_unit_manager = systemd_unit_manager

    @property
    def username(self) -> str:
        return self._username

    @property
    def hostname(self) -> str:
        return self._hostname

    @property
    def unit(self) -> str:
        return self._unit

    @property
    def state(self) -> ServiceState:
        return self._state

    @property
    def description(self) -> str:
        return self._description

    @property
    def tags(self) -> list[str]:
        return self._tags

    @frontend
    def start(self) -> str | None:
        return self._systemd_unit_manager(ManagerAction.START)

    @frontend
    def stop(self) -> str | None:
        return self._systemd_unit_manager(ManagerAction.STOP)

    @frontend
    def restart(self) -> str | None:
        return self._systemd_unit_manager(ManagerAction.RESTART)
