import logging
from pathlib import Path

import pydase

from orchestrator import SystemdServiceOrchestrator
from orchestrator.web_server import WebServer

logging.getLogger("paramiko.transport").setLevel(logging.INFO)

service = SystemdServiceOrchestrator()
pydase.Server(
    service,
    frontend_src=Path(__file__).parent / "frontend",
    additional_servers=[
        {
            "server": WebServer,
            "port": 9001,
            "kwargs": {},
        }
    ],
).run()
