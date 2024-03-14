from pathlib import Path

import pydase

from orchestrator import SystemdServiceOrchestrator

service = SystemdServiceOrchestrator()
pydase.Server(
    service,
    frontend_src=Path(__file__).parent / "frontend",
    # additional_servers=[
    #     {
    #         "server": WebServer,
    #         "port": 8002,  # adapt the port to your needs
    #         "kwargs": {},
    #     }
    # ],
).run()
