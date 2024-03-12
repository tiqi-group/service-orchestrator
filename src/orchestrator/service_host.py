import logging
import re
from pathlib import Path

import paramiko
import pydase.components
from paramiko.ssh_exception import NoValidConnectionsError
from pydantic import SecretStr

from orchestrator.systemd_service_proxy import (
    ManagerAction,
    ServiceState,
    SystemdServiceProxy,
    Tag,
)

logger = logging.getLogger(__name__)


class ServiceHost(pydase.components.DeviceConnection):
    def __init__(
        self,
        hostname: str,
        username: str,
        password: SecretStr | None = None,
        key_path: Path | None = None,
    ) -> None:
        super().__init__()
        self._hostname = hostname
        self._username = username
        self._password = password
        self._key_path = key_path
        self._ssh_client = paramiko.SSHClient()
        self._ssh_client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        self.service_proxy_list: list[SystemdServiceProxy] = []
        self.connect()

    @property
    def hostname(self) -> str:
        return self._hostname

    @property
    def username(self) -> str:
        return self._username

    def connect(self) -> None:
        try:
            if self._password is not None:
                self._ssh_client.connect(
                    self._hostname,
                    username=self._username,
                    password=self._password.get_secret_value(),
                )
            elif self._key_path is not None:
                self._ssh_client.connect(
                    self._hostname,
                    username=self._username,
                    key_filename=str(self._key_path),
                )
            else:
                raise Exception(
                    "Host configured with neither password not ssh key. Please add "
                    "either to the host configuration."
                )
        except (
            OSError,
            paramiko.BadHostKeyException,
            paramiko.AuthenticationException,
            NoValidConnectionsError,
            paramiko.SSHException,
        ) as e:
            self._connected = False
            logger.exception("Got error %s", e)
            return

        self._connected = True
        self.service_proxy_list = self.get_service_proxy_list()

    def get_service_proxy_list(self) -> list[SystemdServiceProxy]:
        cmd = (
            r'systemctl list-units --user --all --full --no-pager | grep "Tags \[.*\]"'
        )
        service_proxy_list: list[SystemdServiceProxy] = []

        try:
            logger.info("Getting service proxy list")
            _, stdout, _ = self._ssh_client.exec_command(cmd)
            lines = stdout.readlines()

            pattern = r"[^\w]+([\w-]+\.service)\s+(\w+)\s+(\w+)\s+(\w+)\s+(.+?)\s+Tags \[(.+?)\]"
            logger.info(lines)

            for line in lines:
                match = re.match(pattern, line)
                if match is not None:
                    (
                        unit,
                        _,
                        active_state,
                        _,
                        description,
                        tags,
                    ) = match.groups()
                    if unit.endswith(".service"):
                        unit = unit[:-8]
                    service_proxy = SystemdServiceProxy(
                        unit=unit,
                        state=ServiceState(active_state),
                        description=description,
                        tags=[Tag(tag) for tag in tags.split(", ")],
                        systemd_unit_manager=lambda action: self.manage_systemd_unit(
                            action, unit
                        ),
                    )
                    service_proxy_list.append(service_proxy)
        except Exception as e:
            logger.error("An error occurred on host %a: %s", self._hostname, e)

        return service_proxy_list

    def manage_systemd_unit(self, action: ManagerAction, unit: str) -> str | None:
        """
        Manages a given systemd unit.

        :param action: Action to perform (start, stop, restart)
        :param unit: Systemd unit name
        :param hostname: Hostname or IP address to connect to
        :param user: SSH username
        :param key_path: Path to the SSH private key (if applicable)
        :return: Response from the execution
        """

        cmd = f"systemctl --user {action.value} {unit}"

        try:
            _, stdout, _ = self._ssh_client.exec_command(cmd)
            return stdout.read().decode("utf-8")
        except Exception as e:
            logger.error("An error occurred on host %a: %s", self._hostname, e)
            return None
