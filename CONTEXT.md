# FHIR MapBuilder

A VS Code extension for authoring FHIR Mapping Language (FML) files, backed by a local service that compiles, validates and transforms them with the Matchbox engine.

## Language

**Validation server**:
The local service bundled with the extension that compiles, validates and transforms a StructureMap on the extension's behalf.
_Avoid_: Backend, API server, Matchbox

**API token**:
The secret that proves a request to the validation server comes from whoever started it: the extension, or the operator of a standalone jar.
_Avoid_: API key, password, session

**Mismatched server**:
A validation server that answers `/health` but rejects the extension's API token, because whoever started it used a different one.
_Avoid_: Stale server, foreign server

**Output folder**:
The per-run folder that receives the parameters log, the transformation result and the quality report.
_Avoid_: Results directory, generated folder
