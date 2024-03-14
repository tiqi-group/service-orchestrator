import asyncio
import enum
import logging
from collections.abc import Callable, Coroutine
from typing import Any

import paramiko

logger = logging.getLogger(__name__)


class CommandChannelEvent(enum.Enum):
    PTY_OUTPUT = "pty-output"
    CLOSED = "closed"
    COMMAND_FINISHED = "command-finished"


class CommandChannel:
    def __init__(  # noqa: PLR0913
        self,
        ssh_client: paramiko.SSHClient,
        command: str,
        command_args: str,
        callback: Callable[
            [CommandChannelEvent, dict[str, Any]], Coroutine[Any, Any, Any]
        ],
        terminal_rows: int,
        terminal_cols: int,
    ) -> None:
        self.ssh_client = ssh_client
        self.command = command
        self.command_args = command_args
        self.callback = callback
        self.terminal_rows = terminal_rows
        self.terminal_cols = terminal_cols
        self.channel = self.ssh_client.invoke_shell(
            width=self.terminal_cols, height=self.terminal_rows
        )
        self.cmd_task: asyncio.Task[None] | None = None
        asyncio.create_task(self._async_execute_command())

    async def _async_execute_command(self) -> None:
        logger.debug("[Channel %s] Starting command.", self.channel.remote_chanid)
        # empty initial buffer
        await asyncio.sleep(0.1)
        self.channel.recv(4096).decode(errors="ignore")

        if not self.channel.closed:  # Channel might have been closed already
            # Send the command to the shell session
            self.channel.sendall(
                f"trap 'exit' INT; {self.command} {self.command_args}; exit\n".encode()
            )

            # Start reading from the session in a background task
            self.cmd_task = asyncio.create_task(self._read_and_forward_ssh_output())

    async def _read_and_forward_ssh_output(self) -> None:
        reason = ""
        logger.debug(
            "[Channel %s] Reading and forwarding ssh output.",
            self.channel.remote_chanid,
        )
        try:
            while True:
                await asyncio.sleep(0.1)
                # Check if there's output to read and forward it
                if self.channel.recv_ready():
                    output = self.channel.recv(4096).decode(errors="ignore")
                    # Send the output back to the client

                    await self.callback(
                        CommandChannelEvent.PTY_OUTPUT, {"output": output}
                    )

                # Check if the command on the remote has finished
                if self.channel.exit_status_ready():
                    break
        except asyncio.CancelledError:
            reason = "Task was cancelled."
        except Exception as e:
            reason = f"An error occured: {e}"

        logger.debug("[Channel %s] Command finished.", self.channel.remote_chanid)
        await self.callback(CommandChannelEvent.COMMAND_FINISHED, {"reason": reason})

    async def send_input_to_channel(self, input_data: dict[str, str]) -> None:
        """Used to pass keyboard presses to the terminal (e.g. h,j,k,l for scrolling)"""
        if self.channel and not self.channel.closed and self.channel.send_ready():
            # Send input to the SSH session
            self.channel.sendall(input_data["input"].encode())

    async def resize_channel_pty(
        self, rows: int | None = None, cols: int | None = None
    ) -> None:
        if rows is not None:
            self.terminal_rows = rows
        if cols is not None:
            self.terminal_cols = cols

        if self.channel and not self.channel.closed:
            # Resize the SSH terminal
            self.channel.resize_pty(width=self.terminal_cols, height=self.terminal_rows)

    async def _close_channel(self) -> None:
        # Close SSH channel
        if not self.channel.closed:
            logger.debug("[Channel %s] Closing channel.", self.channel.remote_chanid)
            self.channel.close()
            await self.callback(CommandChannelEvent.CLOSED, {})

    async def _cancel_running_task(self) -> None:
        if self.cmd_task and not self.cmd_task.cancelled():
            logger.debug("[Channel %s] Cancelling task...", self.channel.remote_chanid)
            self.cmd_task.cancel()
            await self.cmd_task

    async def close(self) -> None:
        logger.debug("[Channel %s] Close requested.", self.channel.remote_chanid)
        await self._cancel_running_task()
        await self._close_channel()


class CommandChannelManager:
    def __init__(
        self,
        callback: Callable[
            [CommandChannelEvent, dict[str, Any]], Coroutine[Any, Any, Any]
        ],
    ) -> None:
        self.channel: CommandChannel | None = None
        self.terminal_rows = 24
        self.terminal_cols = 80
        self.callback = callback

    async def open_channel_with_command(
        self,
        ssh_client: paramiko.SSHClient,
        command: str,
        command_args: str,
    ) -> None:
        if self.channel is not None:
            await self.channel.close()

        self.channel = CommandChannel(
            ssh_client=ssh_client,
            command=command,
            command_args=command_args,
            callback=self.callback,
            terminal_rows=self.terminal_rows,
            terminal_cols=self.terminal_cols,
        )

    async def resize_channel_pty(
        self, rows: int | None = None, cols: int | None = None
    ) -> None:
        if rows is not None:
            self.terminal_rows = rows
        if cols is not None:
            self.terminal_cols = cols
        if self.channel is not None:
            await self.channel.resize_channel_pty(rows, cols)

    async def send_input_to_channel(self, input_data: dict[str, str]) -> None:
        """Used to pass keyboard presses to the terminal (e.g. h,j,k,l for scrolling)"""
        if self.channel is not None:
            await self.channel.send_input_to_channel(input_data)

    async def close(self) -> None:
        if self.channel is not None:
            await self.channel.close()
            self.channel = None
