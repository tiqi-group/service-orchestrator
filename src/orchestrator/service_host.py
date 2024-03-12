import logging
import re
from pathlib import Path
from typing import TypedDict

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


class SystemdRecord(TypedDict):
    unit: str
    load_state: str
    active_state: str
    sub_state: str
    description: str
    tags: list[str]
    hostname: str


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
        service_proxy_list: list[SystemdServiceProxy] = []

        systemd_record_list = self._get_systemd_service_records()

        for systemd_record in systemd_record_list:

            def change_unit_state(
                action: ManagerAction, *, systemd_unit: str = systemd_record["unit"]
            ) -> None:
                self._manage_systemd_unit(action, systemd_unit)
                self.service_proxy_list = self.get_service_proxy_list()

            service_proxy = SystemdServiceProxy(
                unit=systemd_record["unit"],
                state=ServiceState(systemd_record["active_state"]),
                description=systemd_record["description"],
                tags=[Tag(tag) for tag in systemd_record["tags"]],
                systemd_unit_manager=change_unit_state,
            )
            service_proxy_list.append(service_proxy)

        return service_proxy_list

    def _manage_systemd_unit(self, action: ManagerAction, unit: str) -> str | None:
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
            self._connected = False
            return None

    def _get_systemd_service_records(self) -> list[SystemdRecord]:
        cmd = (
            r'systemctl list-units --user --all --full --no-pager | grep "Tags \[.*\]"'
        )
        result_list: list[SystemdRecord] = []

        systemd_unit_pattern = (
            r"[^\w]+([\w-]+\.service)\s+(\w+)\s+(\w+)\s+(\w+)\s+(.+?)\s+Tags \[(.+?)\]"
        )

        try:
            _, stdout, _ = self._ssh_client.exec_command(cmd)
            lines = stdout.readlines()

            for line in lines:
                match = re.match(systemd_unit_pattern, line)
                if match is not None:
                    (
                        unit,
                        load_state,
                        active_state,
                        sub_state,
                        description,
                        tags,
                    ) = match.groups()
                    if unit.endswith(".service"):
                        unit = unit[:-8]

                result: SystemdRecord = {
                    "hostname": self.hostname,
                    "unit": unit,
                    "load_state": load_state,
                    "active_state": active_state,
                    "sub_state": sub_state,
                    "description": description,
                    "tags": tags.split(", "),
                }
                result_list.append(result)

        except Exception as e:
            logger.error("An error occurred on host %a: %s", self._hostname, e)
            self._connected = False

        return result_list
