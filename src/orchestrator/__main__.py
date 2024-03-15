import logging
from pathlib import Path

import pydase

import orchestrator.web_server.setup_sio_events
from orchestrator import SystemdServiceOrchestrator

logging.getLogger("paramiko.transport").setLevel(logging.INFO)

orchestrator.web_server.setup_sio_events.main()

service = SystemdServiceOrchestrator()
pydase.Server(
    service,
    frontend_src=Path(__file__).parent / "frontend",
).run()
