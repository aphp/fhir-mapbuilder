# Change Log

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
