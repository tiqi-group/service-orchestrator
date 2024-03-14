import { useEffect, useRef } from "react";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import { SearchAddon } from "xterm-addon-search";
import { terminalSocket } from "../utils/socket";
import "xterm/css/xterm.css";

interface PtyTerminalProps {
  key: number; // key for rerendering.
  hostname: string;
  username: string;
  cmd: string;
  cmdArgs: string;
  scrollback: number;
}

const PtyTerminal = (props: PtyTerminalProps) => {
  const terminalDiv = useRef<HTMLDivElement>(null); // Reference to div where xterm is rendered
  const term = useRef<Terminal | null>(null);
  const fitAddon = useRef(new FitAddon()); // Reference to the fit addon
  const { cmd, cmdArgs, scrollback } = props;

  useEffect(() => {
    // This effect runs once on component mount
    term.current = new Terminal({
      cursorBlink: true,
      macOptionIsMeta: true,
      scrollback: scrollback,
    });

    // The event parameter is typed as WheelEvent

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
    };
    // Load xterm addons
    term.current.loadAddon(fitAddon.current);
    term.current.loadAddon(new SearchAddon());

    // Open the terminal
    if (terminalDiv.current) {
      term.current.open(terminalDiv.current);
    }

    // // Terminal initial messages
    // term.current.writeln('You can navigate using j, k and the arrow keys.');
    // term.current.writeln('Press "h" to show a help page.');
    // term.current.writeln('');

    // Set up event listeners and handlers
    if (terminalDiv.current) {
      // prevent scrolling on the parent window when interacting with the terminal
      terminalDiv.current.addEventListener("wheel", handleWheel);
    }
    term.current.onData((data) => {
      terminalSocket.emit("pty_input", { input: data });
    });

    terminalSocket.off("pty-output");
    terminalSocket.on("pty-output", (data) => {
      // console.log('new output received from server:', data.output);
      if (term.current) {
        term.current.write(data.output);
      }
    });

    terminalSocket.off("task_finished");
    terminalSocket.on("task_finished", (data) => {
      console.log("Task finished", data);
    });

    terminalSocket.off("channel_closed");
    terminalSocket.on("channel_closed", (data) => {
      console.log("Channel closed", data);
    });

    fitAddon.current.fit(); // Adjust terminal size
    const dims = { cols: term.current.cols, rows: term.current.rows };
    terminalSocket.emit("resize", dims);
    console.log("sending new dimensions to server's pty", dims);
    terminalSocket.emit("start_command", {
      hostname: props.hostname,
      username: props.username,
      cmd: cmd,
      cmd_args: cmdArgs,
    });

    // Clean up and close connection when component unmounts
    return () => {
      console.log("Signing off");
      terminalSocket.off("task_finished");
      terminalSocket.off("channel_closed");
      terminalSocket.off("pty-output");
      if (term.current) {
        term.current.dispose();
      }
      if (terminalDiv.current) {
        terminalDiv.current.removeEventListener("wheel", handleWheel);
      }
    };
  }, []); // Empty dependency array means this useEffect runs once when component mounts

  return <div id="terminal" ref={terminalDiv}></div>;
};

export default PtyTerminal;
