import logging
from typing import Any, TypedDict, cast

import click
import pydase
import pydase.server.web_server.sio_setup
import socketio  # type: ignore
from pydase.data_service.state_manager import StateManager

from orchestrator.web_server.command_channel_manager import (
    CommandChannelEvent,
    CommandChannelManager,
)

logger = logging.getLogger(__name__)


class StartCommand(TypedDict):
    hostname: str
    username: str
    cmd: str
    cmd_args: str


class ResizeChannelDict(TypedDict):
    rows: int | None
    cols: int | None


pydase_setup_sio_events = pydase.server.web_server.sio_setup.setup_sio_events


def setup_sio_events(sio: socketio.AsyncServer, state_manager: StateManager) -> None:  # noqa: C901
    @sio.event  # type: ignore
    async def connect(sid: str, environ: Any) -> None:
        logging.debug("Client [%s] connected", click.style(str(sid), fg="cyan"))

        async def callback(action: CommandChannelEvent, payload: dict[str, Any]) -> Any:
            if action == CommandChannelEvent.PTY_OUTPUT:
                await sio.emit("pty-output", payload, to=sid)  # type: ignore
            elif action == CommandChannelEvent.COMMAND_FINISHED:
                logger.debug("Command finished %s", payload)
                await sio.emit(  # type: ignore
                    "task_finished",
                    payload,
                    to=sid,
                )
            elif action == CommandChannelEvent.CLOSED:
                logger.debug("Channel closed %s", payload)
                await sio.emit(  # type: ignore
                    "channel_closed",
                    payload,
                    to=sid,
                )

        command_channel_manager = CommandChannelManager(callback=callback)
        async with sio.session(sid) as session:  # type: ignore
            session["command_channel_manager"] = command_channel_manager

    @sio.event  # type: ignore
    async def start_command(sid: str, data: StartCommand) -> None:
        logger.debug(
            "Client [%s] - start_command: %s",
            click.style(str(sid), fg="cyan"),
            data,
        )
        async with sio.session(sid) as session:  # type: ignore
            if "command_channel_manager" in session:
                command_channel_manager = cast(
                    CommandChannelManager, session["command_channel_manager"]
                )
                service_host = next(
                    host
                    for host in state_manager.service.service_hosts
                    if host.hostname == data["hostname"]
                )

                sio.start_background_task(  # type: ignore
                    command_channel_manager.open_channel_with_command,
                    service_host._ssh_client,
                    data["cmd"],
                    data["cmd_args"],
                )

    @sio.event  # type: ignore
    async def disconnect(sid: str) -> None:
        logging.debug("Client [%s] disconnected", click.style(str(sid), fg="cyan"))

        # If you stored any information in the Socket.IO session, you can remove it.
        async with sio.session(sid) as session:  # type: ignore
            if "command_channel_manager" in session:
                command_channel_manager = cast(
                    CommandChannelManager, session["command_channel_manager"]
                )

                # Close file descriptor and end the subprocess
                await command_channel_manager.close()

                # Remove the terminal from the session
                del session["command_channel_manager"]
                await sio.save_session(sid, session)  # type: ignore

    @sio.event  # type: ignore
    async def pty_input(sid: str, data: dict[str, str]) -> None:
        logger.debug(
            "Client [%s]- pty_input: %s", click.style(str(sid), fg="cyan"), data
        )
        async with sio.session(sid) as session:  # type: ignore
            command_channel_manager = cast(
                CommandChannelManager, session["command_channel_manager"]
            )
            await command_channel_manager.send_input_to_channel(data)

    @sio.event  # type: ignore
    async def resize(sid: str, data: ResizeChannelDict):
        logger.debug("Client [%s] - resize: %s", click.style(str(sid), fg="cyan"), data)
        async with sio.session(sid) as session:  # type: ignore
            command_channel_manager = cast(
                CommandChannelManager, session["command_channel_manager"]
            )
            await command_channel_manager.resize_channel_pty(data["rows"], data["cols"])

    pydase_setup_sio_events(sio, state_manager)


def main() -> None:
    pydase.server.web_server.sio_setup.setup_sio_events = setup_sio_events
