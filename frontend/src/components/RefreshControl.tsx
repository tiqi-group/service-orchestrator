import React, { useEffect, useRef, useState } from "react";
import {
  ButtonGroup,
  Tooltip,
  Button,
  Popper,
  Grow,
  Paper,
  ClickAwayListener,
  MenuList,
  MenuItem,
} from "@mui/material";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import { runMethod, updateValue } from "../utils/socket";

const options: Record<string, number | null> = {
  Off: null,
  "10s": 10,
  "30s": 30,
  "1m": 60,
  "5m": 300,
  "10m": 600,
};

const getKeyByValue = (value: number | null) => {
  return Object.keys(options).find((key) => options[key] === value);
};

type OptionKeys = keyof typeof options;
type RefreshControlProps = {
  refreshInterval: number | null;
};

export const RefreshControl = React.memo((props: RefreshControlProps) => {
  const { refreshInterval } = props;
  const [selectedKey, setSelectedKey] = useState<OptionKeys | undefined>(undefined);
  const [menuOpen, setMenuOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);

  const refreshDashboard = () => {
    runMethod("update");
  };

  const handleToggle = () => {
    setMenuOpen((prevOpen) => !prevOpen);
  };

  const handleClose = (event: Event) => {
    if (anchorRef.current && anchorRef.current.contains(event.target as HTMLElement)) {
      return;
    }
    setMenuOpen(false);
  };

  const handleMenuItemClick = (key: OptionKeys) => {
    setSelectedKey(key);
    setMenuOpen(false);

    updateValue({
      type: "int",
      full_access_path: "update_wait_time",
      readonly: false,
      value: options[key],
    });
    runMethod("stop_update_hosts");
    // Need to wait until the task has been stopped..
    setTimeout(() => runMethod("start_update_hosts"), 100);
  };

  useEffect(() => {
    setSelectedKey(() => getKeyByValue(refreshInterval));
  }, [props]);
  return (
    <>
      <ButtonGroup
        variant="contained"
        ref={anchorRef}
        aria-label="split button"
        color="inherit">
        <Tooltip title="Refresh Dashboard">
          <Button
            size="small"
            aria-label="restart"
            color="inherit"
            onClick={refreshDashboard}>
            <RestartAltIcon />
          </Button>
        </Tooltip>
        <Tooltip title="Set auto refresh interval">
          <Button
            size="small"
            onClick={handleToggle}
            endIcon={<ArrowDropDownIcon />}
            style={{ textTransform: "initial" }}>
            {refreshInterval !== null && selectedKey}
          </Button>
        </Tooltip>
      </ButtonGroup>

      {/* Copied from https://mui.com/material-ui/react-button-group/#split-button */}
      <Popper open={menuOpen} anchorEl={anchorRef.current} transition>
        {({ TransitionProps, placement }) => (
          <Grow
            {...TransitionProps}
            style={{
              transformOrigin: placement === "bottom" ? "center top" : "center bottom",
            }}>
            <Paper>
              <ClickAwayListener onClickAway={handleClose}>
                <MenuList id="split-button-menu">
                  {Object.keys(options).map((key) => (
                    <MenuItem
                      key={key}
                      selected={key === selectedKey}
                      onClick={() => handleMenuItemClick(key)}>
                      {key}
                    </MenuItem>
                  ))}
                </MenuList>
              </ClickAwayListener>
            </Paper>
          </Grow>
        )}
      </Popper>
    </>
  );
});

RefreshControl.displayName = "RefreshControl";
