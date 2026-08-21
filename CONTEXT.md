# FHIR MapBuilder

A VS Code extension for authoring FHIR StructureMap resources using FHIR Mapping Language (FML), backed by a local Matchbox validation engine.

## Language

**FML**:
FHIR Mapping Language — the source format (`.fml` files) this extension provides authoring support for (syntax highlighting, completion, validation).

**StructureMap**:
The FHIR resource type that FML source compiles to. The artifact MapBuilderBackend parses, validates, and transforms.

**Matchbox**:
The third-party FHIR StructureMap engine that MapBuilderBackend wraps and runs against.

**MapBuilderBackend**:
The local Matchbox validation backend the extension talks to — encompasses both the spawned Java process and the HTTP calls made to it once it's running. One seam for "is it up, and can I ask it to validate/parse/reset/shut down."
_Avoid_: the Java process, the validation API, the matchbox java process — three names used for this one thing before it was named.

**Package** (IG package):
A FHIR Implementation Guide tarball (conventionally `output/package.tgz` in the workspace) that MapBuilderBackend loads into the Matchbox engine before validation.
_Avoid_: IG, guide (alone, without "package").

**Reset and load engine**:
The operation that discards MapBuilderBackend's in-memory Matchbox engine and reloads it from the current Package.
