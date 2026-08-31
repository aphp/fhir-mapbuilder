import { workspace } from "vscode";
import { UiConstants } from "./UiConstants";

export class ApiConstants {
    private static config = workspace.getConfiguration(UiConstants.configName);
    public static apiServerPort = this.config?.get("port") !== "" ? this.config?.get("port") : "9031";
    public static readonly healthCheckUrl: string = `http://localhost:${ApiConstants.apiServerPort}/health`;
    public static readonly validateUrl: string = `http://localhost:${ApiConstants.apiServerPort}/api/matchbox/validate`;
    public static readonly parseUrl: string = `http://localhost:${ApiConstants.apiServerPort}/api/matchbox/parse`;
    public static readonly resetAndLoadEngineUrl: string = `http://localhost:${ApiConstants.apiServerPort}/api/matchbox/resetAndLoadEngine`;
    public static readonly shutDownUrl: string = `http://localhost:${ApiConstants.apiServerPort}/shutdown`;
}
