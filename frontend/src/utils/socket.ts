import { io } from "socket.io-client";

export const serviceHostname =
  process.env.NODE_ENV === "development" ? `localhost` : window.location.hostname;
export const servicePort =
  process.env.NODE_ENV === "development" ? 8001 : window.location.port;
const SERVICE_URL = `ws://${serviceHostname}:${servicePort}/`;
console.debug("Websocket: ", SERVICE_URL);

export const socket = io(SERVICE_URL, {
  path: "/ws/socket.io",
  transports: ["websocket"],
});

export const setAttribute = (
  name: string,
  parentPath: string,
  value: unknown,
  callback?: (ack: unknown) => void,
) => {
  if (callback) {
    socket.emit("set_attribute", { name, parent_path: parentPath, value }, callback);
  } else {
    socket.emit("set_attribute", {
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
    socket.emit("run_method", { name, parent_path: parentPath, kwargs }, callback);
  } else {
    socket.emit("run_method", {
      name,
      parent_path: parentPath,
      kwargs,
    });
  }
};
