import React, { useEffect, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TextField,
  Tabs,
  Tab,
  Autocomplete,
  Box,
  Select,
  MenuItem,
  IconButton,
  Tooltip,
} from "@mui/material";
import { TabContext, TabPanel } from "@mui/lab";
import PtyTerminal from "./PtyTerminal";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import StopIcon from "@mui/icons-material/Stop";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import { runMethod } from "../utils/socket";
import { ServiceProxy, State } from "../App";

export type SystemdUnitState = {
  value: "ACTIVE" | "INACTIVE" | "FAILED" | "DEACTIVATING";
  enum: {
    ACTIVE: "active";
    INACTIVE: "inactive";
    FAILED: "failed";
    DEACTIVATING: "deactivating";
  };
};

type ServicesTableProps = {
  state: State;
  selectedService: ServiceProxy | null;
  onSelectService: (service: ServiceProxy | null) => void;
};

const ServicesTable = React.memo((props: ServicesTableProps) => {
  const { state, selectedService, onSelectService } = props;
  const [serviceProxyList, setServiceProxyList] = useState<ServiceProxy[]>([]);
  const [displayedServices, setDisplayedServices] = useState<ServiceProxy[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [allHostnames, setAllHostnames] = useState<string[]>([]);
  const [selectedHostnames, setSelectedHostnames] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [key, setKey] = useState("journalctl");
  const [higherLevelKey, setHigherLevelKey] = useState("description");
  const [terminalKey, setTerminalKey] = useState(Date.now()); // used to rerender the Terminal by changing the key

  const executeAction = (
    event: React.MouseEvent<HTMLButtonElement, MouseEvent>,
    action: string,
    fullAccessPath: string,
  ) => {
    event.stopPropagation(); // This will stop the event from reaching the parent TableRow

    runMethod(`${fullAccessPath}.${action}`);
  };

  useEffect(() => {
    // Update serviceProxyList based on the `state`
    const newList = state.value.service_hosts.value.flatMap((host, hostIndex) =>
      host.value.service_proxy_list.value.map((serviceProxy, serviceIndex) => ({
        ...serviceProxy,
        fullAccessPath: `service_hosts[${hostIndex}].service_proxy_list[${serviceIndex}]`,
      })),
    );
    setServiceProxyList(newList);

    // Update allHostnames based on the `state`
    setAllHostnames(
      Array.from(
        new Set(
          state.value.service_hosts.value.map((host) => host.value.hostname.value),
        ),
      ),
    );

    // Update allTags based on the `state`
    setAllTags(
      Array.from(
        new Set(
          newList.flatMap((serviceProxy) =>
            serviceProxy.value.tags.value.map((tag) => tag.value),
          ),
        ),
      ),
    );
  }, [state]);

  useEffect(() => {
    // Contains all the ServiceProxy elements that are on the selected hostname and has
    // at least on of the selcted tags.
    setDisplayedServices(
      serviceProxyList.filter(
        (serviceProxy) =>
          (selectedTags.length === 0 ||
            serviceProxy.value.tags.value.some((tag) =>
              selectedTags.includes(tag.value),
            )) &&
          (selectedHostnames.length === 0 ||
            selectedHostnames.includes(serviceProxy.value.hostname.value)),
      ),
    );
  }, [serviceProxyList, selectedTags, selectedHostnames]);

  return (
    <>
      <div style={{ float: "right" }}>
        <div
          style={{
            display: "inline-block",
            marginRight: "10px",
            minWidth: "200px",
          }}>
          <Autocomplete
            multiple
            id="hostnames-autocomplete"
            options={allHostnames}
            onChange={(_, value) => setSelectedHostnames(value)}
            renderInput={(params) => (
              <TextField
                {...params}
                variant="standard"
                label="Hostnames"
                placeholder="Select hostnames"
              />
            )}
          />
        </div>
        <div style={{ display: "inline-block", minWidth: "200px" }}>
          <Autocomplete
            multiple
            id="tags-autocomplete"
            options={allTags}
            onChange={(_, value) => setSelectedTags(value)}
            renderInput={(params) => (
              <TextField
                {...params}
                variant="standard"
                label="Tags"
                placeholder="Filter tags"
              />
            )}
          />
        </div>
      </div>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Service</TableCell>
              <TableCell>Tags</TableCell>
              <TableCell>Hostname</TableCell>
              <TableCell>State</TableCell>
              <TableCell></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {displayedServices.map((serviceProxy) => (
              <React.Fragment
                key={serviceProxy.value.hostname.value + serviceProxy.value.unit.value}>
                <TableRow
                  style={{
                    cursor: "pointer",
                    backgroundColor:
                      selectedService?.fullAccessPath === serviceProxy.fullAccessPath
                        ? "#e0e0e0"
                        : "transparent",
                  }}
                  onClick={() => {
                    if (
                      selectedService?.fullAccessPath === serviceProxy.fullAccessPath
                    ) {
                      onSelectService(null); // set to null to collapse
                    } else {
                      onSelectService(serviceProxy); // set to the current service to expand
                    }
                  }}>
                  <TableCell>
                    {serviceProxy.value.unit.value.slice("container-".length)}
                  </TableCell>
                  <TableCell>
                    {serviceProxy.value.tags.value
                      .flatMap((tag) => tag.value)
                      .join(", ")}
                  </TableCell>
                  <TableCell>{serviceProxy.value.hostname.value}</TableCell>
                  <TableCell
                    style={{
                      backgroundColor:
                        serviceProxy.value.state.value === "ACTIVE"
                          ? "green"
                          : serviceProxy.value.state.value === "FAILED"
                            ? "red"
                            : "orange",
                      color: "white",
                    }}>
                    {serviceProxy.value.state.value === "INACTIVE"
                      ? "stopped"
                      : serviceProxy.value.state.enum[serviceProxy.value.state.value]}
                  </TableCell>
                  <TableCell>
                    <Tooltip title="Start Service">
                      <IconButton
                        aria-label="play"
                        size="small"
                        onClick={(event) =>
                          executeAction(event, "start", serviceProxy.fullAccessPath)
                        }>
                        <PlayArrowIcon color="success" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Stop Service">
                      <IconButton
                        aria-label="stop"
                        size="small"
                        onClick={(event) =>
                          executeAction(event, "stop", serviceProxy.fullAccessPath)
                        }>
                        <StopIcon color="error" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Restart Service">
                      <IconButton
                        aria-label="restart"
                        size="small"
                        onClick={(event) =>
                          executeAction(event, "restart", serviceProxy.fullAccessPath)
                        }>
                        <RestartAltIcon color="primary" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
                {selectedService?.fullAccessPath === serviceProxy.fullAccessPath && (
                  <TableRow>
                    <TableCell colSpan={7}>
                      <TabContext value={higherLevelKey}>
                        <Box id="row-content">
                          <Tabs
                            value={higherLevelKey}
                            sx={{ borderRight: 1, borderColor: "divider" }}
                            onChange={(_, newValue) => setHigherLevelKey(newValue)}>
                            <Tab label="Description" value="description" />
                            <Tab label="Logs" value="logs" />
                          </Tabs>

                          <TabPanel value="description">
                            <p>{serviceProxy.value.description.value}</p>
                            <b>Hostname</b>: {serviceProxy.value.hostname.value}{" "}
                            <br></br>
                            <br></br>
                            <b>Systemd Unit Name</b>: {serviceProxy.value.unit.value}{" "}
                            <br></br>
                            <b>State</b>:{" "}
                            {
                              serviceProxy.value.state.enum[
                                serviceProxy.value.state.value
                              ]
                            }{" "}
                            <br></br>
                            <b>Tags</b>:
                            <ul>
                              {serviceProxy.value.tags.value
                                .flatMap((tag) => tag.value)
                                .map((tag, index) => (
                                  <li key={index}>{tag}</li>
                                ))}
                            </ul>{" "}
                            <br></br>
                          </TabPanel>

                          <TabPanel value="logs">
                            <div
                              style={{
                                textAlign: "right",
                                marginBottom: "10px",
                              }}>
                              <IconButton
                                aria-label="restart"
                                size="medium"
                                onClick={() => {
                                  setTerminalKey(Date.now()); // Update the terminalKey state to force a re-render
                                }}>
                                <RestartAltIcon color="primary" />
                              </IconButton>

                              <Select
                                value={key}
                                onChange={(event) => {
                                  setKey(event.target.value);
                                  setTerminalKey(Date.now()); // Update the terminalKey state to force a re-render
                                }}>
                                <MenuItem value="journalctl">journalctl</MenuItem>
                                <MenuItem value="systemctl">systemctl</MenuItem>
                                <MenuItem value="podman">podman</MenuItem>
                              </Select>
                            </div>

                            {key === "journalctl" && (
                              <PtyTerminal
                                key={terminalKey}
                                hostname={serviceProxy.value.hostname.value}
                                username={serviceProxy.value.username.value}
                                cmd="journalctl"
                                cmdArgs={
                                  "--user --unit='" +
                                  serviceProxy.value.unit.value +
                                  "' -n 300 -f"
                                }
                                scrollback={9999}
                              />
                            )}

                            {key === "systemctl" && (
                              <PtyTerminal
                                key={terminalKey}
                                hostname={serviceProxy.value.hostname.value}
                                username={serviceProxy.value.username.value}
                                cmd="systemctl"
                                cmdArgs={
                                  "--user status " + serviceProxy.value.unit.value
                                }
                                scrollback={0}
                              />
                            )}

                            {key === "podman" && (
                              <PtyTerminal
                                key={terminalKey}
                                hostname={serviceProxy.value.hostname.value}
                                username={serviceProxy.value.username.value}
                                cmd="podman"
                                cmdArgs={
                                  "logs -f " +
                                  serviceProxy.value.unit.value.slice(
                                    "container-".length,
                                  )
                                }
                                scrollback={9999}
                              />
                            )}
                          </TabPanel>
                        </Box>
                      </TabContext>
                    </TableCell>
                  </TableRow>
                )}
              </React.Fragment>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </>
  );
});

ServicesTable.displayName = "ServicesTable";
export default ServicesTable;
