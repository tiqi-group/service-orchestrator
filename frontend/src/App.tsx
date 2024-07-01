import { useEffect, useReducer, useState } from "react";
import "./App.css";
import { socket, hostname, port } from "./utils/socket";
import ServicesTable, { SystemdUnitState } from "./components/ServicesTableComponent";
import { ConnectionSnackbar } from "./components/ConnectionSnackbar";
import { RefreshControl } from "./components/RefreshControl";
import { SerializedValue, setNestedValueByPath } from "./utils/stateUtils";

export type ServiceProxy = {
  fullAccessPath: string;
  value: {
    hostname: { value: string };
    username: { value: string };
    description: { value: string };
    state: SystemdUnitState;
    tags: { value: { value: string }[] };
    unit: { value: string };
  };
};

type UpdateMessage = {
  data: { full_access_path: string; value: SerializedValue };
};

type ServiceHost = {
  value: {
    connected: { value: boolean };
    hostname: { value: string };
    username: { value: string };
    service_proxy_list: { value: ServiceProxy[] };
  };
};
export type State = {
  type: string;
  value: {
    service_hosts: {
      value: ServiceHost[];
      readonly: false;
      type: "DataService";
    };
    update_wait_time: {
      value: number | null;
      readonly: false;
      type: "DataService";
    };
  };
  readonly: boolean;
  doc: string | null;
};

export type Action =
  | { type: "SET_DATA"; data: State }
  | {
      type: "UPDATE_ATTRIBUTE";
      fullAccessPath: string;
      newValue: SerializedValue;
    };

const reducer = (state: State | null, action: Action): State | null => {
  switch (action.type) {
    case "SET_DATA":
      return action.data;
    case "UPDATE_ATTRIBUTE": {
      if (state === null) {
        return null;
      }
      return {
        ...state,
        /* @ts-expect-error setNestedValueByPath is very generic - but we know the exact structure */
        value: setNestedValueByPath(
          /* @ts-expect-error I left out some parts of the state type */
          state.value,
          action.fullAccessPath,
          action.newValue,
        ),
      };
    }
    default:
      throw new Error();
  }
};

const App = () => {
  const [state, dispatch] = useReducer(reducer, null);
  const [selectedService, setSelectedService] = useState<ServiceProxy | null>(null);
  const [connectionStatus, setConnectionStatus] = useState("connecting");

  function onNotify(value: UpdateMessage) {
    // Extracting data from the notification
    const { full_access_path: fullAccessPath, value: newValue } = value.data;

    // Dispatching the update to the reducer
    dispatch({
      type: "UPDATE_ATTRIBUTE",
      fullAccessPath,
      newValue,
    });
  }
  useEffect(() => {
    socket.on("connect", () => {
      setConnectionStatus("connected");
      // Fetch data from the API when the client connects
      fetch(`http://${hostname}:${port}/service-properties`)
        .then((response) => response.json())
        .then((data: State) => dispatch({ type: "SET_DATA", data }));
      setConnectionStatus("connected");
    });
    socket.on("disconnect", () => {
      setConnectionStatus("disconnected");
      setTimeout(() => {
        // Only set "reconnecting" is the state is still "disconnected"
        // E.g. when the client has already reconnected
        setConnectionStatus((currentState) =>
          currentState === "disconnected" ? "reconnecting" : currentState,
        );
      }, 2000);
    });

    socket.on("notify", onNotify);

    return () => {
      socket.off("notify", onNotify);
    };
  }, []);

  return (
    <div className="App">
      <header className="App-header">
        <h1>Service Orchestrator</h1>
        {state !== null ? (
          <RefreshControl refreshInterval={state.value.update_wait_time.value} />
        ) : (
          <RefreshControl refreshInterval={null} />
        )}
      </header>
      {state && (
        <ServicesTable
          state={state}
          selectedService={selectedService}
          onSelectService={(service: ServiceProxy | null) =>
            setSelectedService(service)
          }
        />
      )}
      <ConnectionSnackbar connectionStatus={connectionStatus} />
    </div>
  );
};

export default App;
