const color = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
};

const log = {
  error: (msg) => console.log(`${color.bold}${color.red}${msg}${color.reset}`),
  success: (msg) => console.log(`${color.bold}${color.green}${msg}${color.reset}`),
  warn: (msg) => console.log(`${color.bold}${color.yellow}${msg}${color.reset}`),
};

export function konek({ update, clientstart, DisconnectReason, Boom }) {
  const { connection, lastDisconnect } = update;

  if (connection === "close") {
    const reason = new Boom(lastDisconnect?.error)?.output.statusCode;

    switch (reason) {
      case DisconnectReason.badSession:
        log.error("Bad session file, please delete session and scan again");
        process.exit();
        break;
      case DisconnectReason.connectionClosed:
        log.error("Connection closed, reconnecting...");
        clientstart();
        break;
      case DisconnectReason.connectionLost:
        log.error("Connection lost from server, reconnecting...");
        clientstart();
        break;
      case DisconnectReason.connectionReplaced:
        log.error("Connection replaced, another session opened, please restart bot");
        process.exit();
        break;
      case DisconnectReason.loggedOut:
        log.error("Device logged out, please delete session folder and scan again");
        process.exit();
        break;
      case DisconnectReason.restartRequired:
        log.warn("Restart required, restarting...");
        clientstart();
        break;
      case DisconnectReason.timedOut:
        log.warn("Connection timeout, reconnecting...");
        clientstart();
        break;
      default:
        log.error(`Unknown disconnect reason: ${reason} | ${connection}`);
        clientstart();
    }
  }

  if (connection === "open") {
    log.success("Successfully connected to bot");
  }
}