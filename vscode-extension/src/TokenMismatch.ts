import { OutputChannel, commands, window } from "vscode";
import { UiConstants } from "./constants/UiConstants";
import { logData } from "./utils";

const SHOW_LOG = "Show log";
const OPEN_PORT_SETTING = "Open port setting";
const PORT_SETTING = `${UiConstants.configName}.port`;

// Tell the user that the server on our port belongs to a run started with another API token. The extension cannot
// stop it (/shutdown needs the token), so the message points at what the user can do.
export async function notifyTokenMismatch(logger: OutputChannel, port: unknown): Promise<void> {
    logData(`The server on port ${port} rejected the API token: it was started with a different one.`, logger);
    logData(
        `Stop the java process that listens on port ${port} (Task Manager, or "netstat -ano"), then reload the window.`,
        logger,
    );
    logData(`Or set "${PORT_SETTING}" to a free port and reload the window.`, logger);

    const choice = await window.showErrorMessage(
        `FHIR MapBuilder: the validation server on port ${port} was started with a different API token, so every request is rejected.`,
        SHOW_LOG,
        OPEN_PORT_SETTING,
    );
    if (choice === SHOW_LOG) {
        logger.show();
    } else if (choice === OPEN_PORT_SETTING) {
        await commands.executeCommand("workbench.action.openSettings", PORT_SETTING);
    }
}
