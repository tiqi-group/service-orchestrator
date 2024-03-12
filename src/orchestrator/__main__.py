import pydase

from orchestrator import SystemdServiceOrchestrator

service = SystemdServiceOrchestrator()
pydase.Server(
    service,
    # additional_servers=[
    #     {
    #         "server": WebServer,
    #         "port": 8002,  # adapt the port to your needs
    #         "kwargs": {},
    #     }
    # ],
).run()
