import { randomBytes } from "node:crypto";
import { SecretStorage } from "vscode";

export const API_TOKEN_HEADER = "X-MapBuilder-Token";
export const API_TOKEN_ENV_VAR = "MAPBUILDER_API_TOKEN";

const SECRET_KEY = "fhirMapBuilder.apiToken";
const TOKEN_BYTES = 32;

// The token lives in SecretStorage so every VS Code window of the user shares it: a window that reuses a server
// started by another window still holds the token that server was launched with.
export async function loadOrCreateApiToken(secrets: SecretStorage): Promise<string> {
    const existing = await secrets.get(SECRET_KEY);
    if (existing) {
        return existing;
    }
    const token = randomBytes(TOKEN_BYTES).toString("hex");
    await secrets.store(SECRET_KEY, token);
    return token;
}
