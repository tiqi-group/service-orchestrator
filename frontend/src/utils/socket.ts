import { io } from "socket.io-client";

export const serviceHostname =
  process.env.NODE_ENV === "development" ? `localhost` : window.location.hostname;
export const servicePort =
  process.env.NODE_ENV === "development" ? 8001 : window.location.port;
const SERVICE_URL = `ws://${serviceHostname}:${servicePort}/`;
console.debug("Websocket: ", SERVICE_URL);

export const serviceSocket = io(SERVICE_URL, {
  path: "/ws/socket.io",
  transports: ["websocket"],
});

export const terminalSocketioHostname =
  process.env.NODE_ENV === "development" ? `localhost` : window.location.hostname;
export const terminalPort = 9001;
const TERMINAL_SOCKETIO_URL = `ws://${terminalSocketioHostname}:${terminalPort}/`;
export const terminalSocket = io(TERMINAL_SOCKETIO_URL, {
  transports: ["websocket"],
});

export const setAttribute = (
  name: string,
  parentPath: string,
  value: unknown,
  callback?: (ack: unknown) => void,
) => {
  if (callback) {
    serviceSocket.emit(
      "set_attribute",
      { name, parent_path: parentPath, value },
      callback,
    );
  } else {
    serviceSocket.emit("set_attribute", {
      name,
      parent_path: parentPath,
      value,
    });
  }
};

export const runMethod = (
  name: string,
  parentPath: string,
  kwargs: Record<string, unknown>,
  callback?: (ack: unknown) => void,
) => {
  if (callback) {
    serviceSocket.emit(
      "run_method",
      { name, parent_path: parentPath, kwargs },
      callback,
    );
  } else {
    serviceSocket.emit("run_method", {
      name,
      parent_path: parentPath,
      kwargs,
    });
  }
};
