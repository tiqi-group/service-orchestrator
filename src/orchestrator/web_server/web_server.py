import asyncio
import logging
from typing import Any, TypedDict, cast

import click
import socketio  # type: ignore
import uvicorn
from fastapi import FastAPI
from pydase.data_service.data_service_observer import DataServiceObserver

from orchestrator.orchestrator import SystemdServiceOrchestrator
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


class WebServer:
    __sio_app: socketio.ASGIApp
    __fastapi_app: FastAPI

    def __init__(
        self,
        data_service_observer: DataServiceObserver,
        host: str = "0.0.0.0",
        port: int = 9001,
        **kwargs: Any,
    ) -> None:
        self.data_service_observer = data_service_observer
        self.service = cast(
            SystemdServiceOrchestrator, self.data_service_observer.state_manager.service
        )
        self.host = host
        self.port = port

    async def serve(self) -> None:
        self._loop = asyncio.get_running_loop()
        self._setup_socketio()
        self._setup_fastapi_app()
        self.web_server = uvicorn.Server(
            uvicorn.Config(self.__fastapi_app, host=self.host, port=self.port)
        )
        # overwrite uvicorn's signal handlers, otherwise it will bogart SIGINT and
        # SIGTERM, which makes it impossible to escape out of
        self.web_server.install_signal_handlers = lambda: None  # type: ignore[method-assign]
        await self.web_server.serve()

    def _setup_socketio(self) -> None:  # noqa: C901
        sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins="*")

        @sio.event  # type: ignore
        async def connect(sid: str, environ: Any) -> None:
            logging.debug("Client [%s] connected", click.style(str(sid), fg="cyan"))

            async def callback(
                action: CommandChannelEvent, payload: dict[str, Any]
            ) -> Any:
                if action == CommandChannelEvent.PTY_OUTPUT:
                    await sio.emit("pty-output", payload, to=sid)  # type: ignore
                elif action == CommandChannelEvent.COMMAND_FINISHED:
                    logger.info("Command finished %s", payload)
                    await sio.emit(  # type: ignore
                        "task_finished",
                        payload,
                        to=sid,
                    )
                elif action == CommandChannelEvent.CLOSED:
                    logger.info("Channel closed %s", payload)
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
                        for host in self.service.service_hosts
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
            logger.debug(
                "Client [%s] - resize: %s", click.style(str(sid), fg="cyan"), data
            )
            async with sio.session(sid) as session:  # type: ignore
                command_channel_manager = cast(
                    CommandChannelManager, session["command_channel_manager"]
                )
                await command_channel_manager.resize_channel_pty(
                    data["rows"], data["cols"]
                )

        self.__sio = sio
        self.__sio_app = socketio.ASGIApp(self.__sio)

    def _setup_fastapi_app(self) -> None:
        app = FastAPI()

        app.mount("/", self.__sio_app)

        self.__fastapi_app = app
