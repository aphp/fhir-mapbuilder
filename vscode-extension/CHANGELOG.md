# Change Log

## [1.7.1](https://github.com/aphp/fhir-mapbuilder/compare/v1.7.0...v1.7.1) (2026-09-03)


### Build System

* force a 1.7.1 release to exercise the pipeline ([8cf60e2](https://github.com/aphp/fhir-mapbuilder/commit/8cf60e241105939f8757e81670648d84245bab03))

## [1.7.0](https://github.com/aphp/fhir-mapbuilder/compare/v1.6.0...v1.7.0) (2026-09-02)


### Documentation

* **ext:** record the bundled Matchbox 4.1.14 validation engine ([8b2836b](https://github.com/aphp/fhir-mapbuilder/commit/8b2836b9f17f995bcf2223fcabe00ef734f91666))

## 1.6.0 (2026-08-24)

Added

* `FhirMapBuilder.javaVmArgs` setting to pass extra JVM arguments (e.g. `-Xmx4g`) to the matchbox java process, to configure heap memory without patching the extension
* `vsce package` step in the test workflow, catching packaging issues (e.g. `@types/vscode`/`engines.vscode` mismatches) on every PR

Fixed

* Pinned `@types/vscode` back to `engines.vscode`'s minimum (1.91.0), fixing a `vsce package` failure introduced by an automated dependency bump

## 1.5.0 (2026-08-21)

Changed

* Bumped Matchbox dependency to 4.1.13 version
* Bumped hapi-fhir-core (org.hl7.fhir.r4/r5) to 6.10.0, resolving two security advisories (GHSA-7cmj-v6x8-frvv, GHSA-3653-68v6-rq57 — ReDoS in FHIRPath matches()/replaceMatches())
* Bumped commons-io to 2.22.0

Added

* Java build and test workflow in CI (previously only the VS Code extension was built/tested)
* Dependabot version-update configuration for the Maven and npm dependency ecosystems

## 1.4.0 (2026-04-05)

Changed

* Bumped Matchbox dependency to 4.1.1 version


## 1.3.0 (2026-03-31)

Changed

* Bumped Matchbox dependency to 4.0.20 version
* Bumped the Spring Boot dependency to 3.5.13 version to reduce technical debt


## 1.2.0 (2025-12-10)

Changed

* Bumped Matchbox dependency to latest version to improved FHIR mapping capabilities
* Bumped the Spring Boot dependency to the latest version to reduce technical debt

## 1.1.0 (2025-09-01)

Added

* Support for configurable Java executable path to improve compatibility across different Java installations

Changed

* Bumped Matchbox dependency to latest version for improved FHIR mapping capabilities
* Updated FHIR validator to latest version for better validation accuracy and performance

## 1.0.4 (2025-06-04)

* Fix [issue-17](https://github.com/aphp/fhir-mapbuilder/issues/17): cross-platform fix

## 1.0.3 (2025-04-24)

* Fix publish git workflow

## 1.0.2 (2025-04-24)

* Fix publish git workflow
* Fix broken URLs in the documentation.

## 1.0.1 (2025-04-23)

* VSCode extension documentation changes
* Fix broken URLs in the documentation.

## 1.0.0 (2025-04-07)

* Parse .fml files and/or load the IG package when an add or change event occurs.
* Refactoring: call fhir-mapbuilder-validation via REST requests and optimized.
* Added a new command to validate the StructureMap and edit test parameters.
* Added a command to reset and load the Matchbox engine and load the current IG package.

## 0.1.0 (2024-07-24)

* Update syntax color, add snippets and update package to detect fml file

## 0.0.1 (2024-05-31)

* Color the syntax of .fml files, based on [healexsystems/MappingLanguageExtension](https://github.com/healexsystems/MappingLanguageExtension).
