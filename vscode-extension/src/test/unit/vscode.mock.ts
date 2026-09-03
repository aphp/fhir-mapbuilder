/**
 * Hand-written stub of the slice of the `vscode` API that the extension's source
 * files import at load time or exercise in logic (wayfinder #136 / spec #143).
 *
 * `_setup.ts` swaps this in for the real `vscode` module so the unit suites run
 * in plain Node, with no `@vscode/test-cli` host. Only the surface actually used
 * by `src/*.ts` is modelled. Mutable pieces — workspace folders, active editor,
 * configuration values, the installed extension — are reset by
 * `resetVscodeMock()`, which every suite should call in `teardown`.
 */

// --- Enums -----------------------------------------------------------------

export enum FileType {
    Unknown = 0,
    File = 1,
    Directory = 2,
    SymbolicLink = 64,
}

export enum ProgressLocation {
    SourceControl = 1,
    Window = 10,
    Notification = 15,
}

export enum ConfigurationTarget {
    Global = 1,
    Workspace = 2,
    WorkspaceFolder = 3,
}

// --- Value classes -------------------------------------------------------------

export class CompletionItem {
    label: unknown;
    kind?: unknown;
    detail?: string;
    insertText?: unknown;
    // `Models.EnhancedCompletionItem` widens CompletionItem with these.
    elements?: unknown;
    type?: string;

    constructor(label: unknown, kind?: unknown) {
        this.label = label;
        this.kind = kind;
    }
}

export class Uri {
    private constructor(public readonly fsPath: string) {}

    static file(path: string): Uri {
        return new Uri(path);
    }
}

// --- Shaped helpers ----------------------------------------------------------

export interface OutputChannelLike {
    name: string;
    append(value: string): void;
    appendLine(value: string): void;
    replace(value: string): void;
    clear(): void;
    show(): void;
    hide(): void;
    dispose(): void;
}

function makeOutputChannel(name: string): OutputChannelLike {
    return {
        name,
        append: () => {},
        appendLine: () => {},
        replace: () => {},
        clear: () => {},
        show: () => {},
        hide: () => {},
        dispose: () => {},
    };
}

type WatcherListener = (...args: unknown[]) => unknown;

export interface DisposableLike {
    dispose(): void;
}

export interface FileSystemWatcherLike {
    onDidChange(listener: WatcherListener, thisArg?: unknown): DisposableLike;
    onDidCreate(listener: WatcherListener, thisArg?: unknown): DisposableLike;
    onDidDelete(listener: WatcherListener, thisArg?: unknown): DisposableLike;
    dispose(): void;
}

function makeFileSystemWatcher(): FileSystemWatcherLike {
    const disposable: DisposableLike = { dispose: () => {} };
    return {
        onDidChange: () => disposable,
        onDidCreate: () => disposable,
        onDidDelete: () => disposable,
        dispose: () => {},
    };
}

export interface FileStatLike {
    type: FileType;
    ctime: number;
    mtime: number;
    size: number;
}

export interface FileSystemLike {
    stat(uri: Uri): Promise<FileStatLike>;
    readFile(uri: Uri): Promise<Uint8Array>;
    readDirectory(uri: Uri): Promise<Array<[string, FileType]>>;
}

function makeFileSystem(): FileSystemLike {
    return {
        stat: () => Promise.resolve({ type: FileType.File, ctime: 0, mtime: 0, size: 0 }),
        readFile: () => Promise.resolve(new Uint8Array()),
        readDirectory: () => Promise.resolve([]),
    };
}

export interface WorkspaceConfigurationLike {
    get<T = unknown>(section: string): T | undefined;
    get<T = unknown>(section: string, defaultValue: T): T;
    has(section: string): boolean;
    update(section: string, value: unknown, target?: ConfigurationTarget): Promise<void>;
}

const configStore = new Map<string, unknown>();

const configuration: WorkspaceConfigurationLike = {
    get<T = unknown>(section: string, defaultValue?: T): T | undefined {
        return configStore.has(section) ? (configStore.get(section) as T) : defaultValue;
    },
    has(section: string): boolean {
        return configStore.has(section);
    },
    update(section: string, value: unknown): Promise<void> {
        configStore.set(section, value);
        return Promise.resolve();
    },
};

export interface WorkspaceFolderLike {
    uri: { fsPath: string };
    name?: string;
    index?: number;
}

export interface ActiveTextEditorLike {
    document: {
        uri: { fsPath: string };
        fileName?: string;
        getText?: () => string;
        lineAt?: (positionOrLine: unknown) => { text: string };
    };
}

export interface ExtensionLike {
    id: string;
    extensionPath: string;
    isActive: boolean;
    activate(): Promise<void>;
}

// --- Mutable state -----------------------------------------------------------

let installedExtension: ExtensionLike | undefined;

// --- Namespaces -----------------------------------------------------------------

export const workspace = {
    workspaceFolders: undefined as WorkspaceFolderLike[] | undefined,
    fs: makeFileSystem(),

    getConfiguration(_section?: string): WorkspaceConfigurationLike {
        return configuration;
    },

    createFileSystemWatcher(_glob: string): FileSystemWatcherLike {
        return makeFileSystemWatcher();
    },

    findFiles(_include: string, ..._rest: unknown[]): Promise<Uri[]> {
        return Promise.resolve([]);
    },
};

export const window = {
    activeTextEditor: undefined as ActiveTextEditorLike | undefined,

    createOutputChannel(name: string): OutputChannelLike {
        return makeOutputChannel(name);
    },

    showInformationMessage(..._args: unknown[]): Promise<string | undefined> {
        return Promise.resolve(undefined);
    },

    showErrorMessage(..._args: unknown[]): Promise<string | undefined> {
        return Promise.resolve(undefined);
    },

    showWarningMessage(..._args: unknown[]): Promise<string | undefined> {
        return Promise.resolve(undefined);
    },

    showOpenDialog(..._args: unknown[]): Promise<Uri[] | undefined> {
        return Promise.resolve(undefined);
    },

    async withProgress<R>(
        _options: unknown,
        task: (
            progress: { report(value: unknown): void },
            token: { isCancellationRequested: boolean },
        ) => Promise<R> | R,
    ): Promise<R> {
        return task({ report: () => {} }, { isCancellationRequested: false });
    },
};

export const extensions = {
    getExtension(_extensionId: string): ExtensionLike | undefined {
        return installedExtension;
    },
};

// --- Test helpers ------------------------------------------------------------

/** Register (or clear) the extension returned by `extensions.getExtension`. */
export function setInstalledExtension(extension: Partial<ExtensionLike> | undefined): void {
    installedExtension = extension
        ? {
              id: "aphp.fhir-mapbuilder",
              extensionPath: "/ext",
              isActive: true,
              activate: () => Promise.resolve(),
              ...extension,
          }
        : undefined;
}

/** Set a `FhirMapBuilder.*` configuration value the SUT will read back. */
export function setConfig(section: string, value: unknown): void {
    configStore.set(section, value);
}

/** Point the mock workspace at one or more folder paths. */
export function setWorkspaceFolders(fsPaths: string[] | undefined): void {
    workspace.workspaceFolders = fsPaths?.map((fsPath, index) => ({
        uri: { fsPath },
        name: `folder-${index}`,
        index,
    }));
}

/** Reset every mutable piece of the mock. Call in `teardown`. */
export function resetVscodeMock(): void {
    workspace.workspaceFolders = undefined;
    workspace.fs = makeFileSystem();
    window.activeTextEditor = undefined;
    installedExtension = undefined;
    configStore.clear();
}
