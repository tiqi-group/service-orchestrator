import enum
from collections.abc import Callable

import pydase
from pydase.utils.decorators import frontend


class ServiceState(enum.Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    FAILED = "failed"


class ManagerAction(enum.Enum):
    START = "start"
    STOP = "stop"
    RESTART = "restart"


class Tag(pydase.DataService):
    def __init__(self, name: str) -> None:
        super().__init__()
        self._name = name

    @property
    def name(self) -> str:
        return self._name


class SystemdServiceProxy(pydase.DataService):
    def __init__(  # noqa: PLR0913
        self,
        unit: str,
        state: ServiceState,
        description: str,
        tags: list[Tag],
        systemd_unit_manager: Callable[[ManagerAction], str | None],
    ) -> None:
        super().__init__()
        self._unit = unit
        self._state = state
        self._description = description
        self._tags = tags
        self._systemd_unit_manager = systemd_unit_manager

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
    def tags(self) -> list[Tag]:
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
