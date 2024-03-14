import IconButton from "@mui/material/IconButton";
import { Snackbar, Alert } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import React, { useEffect, useState } from "react";

type SnackbarProps = {
  connectionStatus: string;
};

export const ConnectionSnackbar = React.memo(({ connectionStatus }: SnackbarProps) => {
  const [openSnackbar, setSnackbarOpen] = useState(true);

  const handleClose = (_: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === "clickaway") {
      // Don't close when clicking somewhere other than the CloseIcon
      return;
    }

    setSnackbarOpen(false);
  };

  useEffect(() => {
    setSnackbarOpen(true);
  }, [connectionStatus]);

  const getSnackbarContent = (): {
    message: string;
    severity: "error" | "info" | "success";
    autoHideDuration: number | undefined;
  } => {
    switch (connectionStatus) {
      case "connecting":
        return {
          message: "Connecting...",
          severity: "info",
          autoHideDuration: undefined,
        };
      case "connected":
        return {
          message: "Connected",
          severity: "success",
          autoHideDuration: 1000,
        };
      case "disconnected":
        return {
          message: "Disconnected",
          severity: "error",
          autoHideDuration: undefined,
        };
      case "reconnecting":
        return {
          message: "Reconnecting...",
          severity: "info",
          autoHideDuration: undefined,
        };
      default:
        return {
          message: "Unknown connection status",
          severity: "error",
          autoHideDuration: undefined,
        };
    }
  };

  const { message, severity, autoHideDuration } = getSnackbarContent();
  const action = (
    <IconButton size="small" aria-label="close" color="inherit" onClick={handleClose}>
      <CloseIcon fontSize="small" />
    </IconButton>
  );

  return (
    <Snackbar
      open={openSnackbar}
      anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      autoHideDuration={autoHideDuration}
      onClose={(event, reason) => handleClose(event, reason)}
      action={action}>
      <Alert onClose={handleClose} severity={severity}>
        {message}
      </Alert>
    </Snackbar>
  );
});

ConnectionSnackbar.displayName = "ConnectionSnackbar";
