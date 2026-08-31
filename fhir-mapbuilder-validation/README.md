# Validation for FHIR MapBuilder

The goal of this project is to implement a REST API base on [The MatchBox Engine](https://github.com/ahdis/matchbox), from agile health data
information systems, that allows the FHIR MapBuilder extension to perform compilation, validation, and transformation of an
FML (FHIR Mapping Language) file provided by MatchBox through REST calls.

This application helps the alignment designer use FML without errors by ensuring syntactic validation.

## MatchBox Engine Dependency

The project use the MatchBox Engine dependency, specifically version 3.9.12.

## API Endpoints

### Validate FML Mapping

#### Endpoint: GET /api/matchbox/validate

**Parameters:**

- ```source``` (String) - The path of the source FML file.

- ```data``` (String) - The path of the data to be transformed.

- ```output``` (String) - The output path for the transformed data.

**Response:**

- ```200 OK``` - Validation and transformation successful.

- ```500 Internal Server Error``` - Error during validation, transformation, or an unexpected issue.

**Example Request:**

```shell
curl -X GET "http://localhost:8080/api/matchbox/validate?source=path.example.fml&data=path.input.json&output=path.output"
```
### Reset and Reload MatchBox Engine

#### Endpoint: GET /api/matchbox/resetAndLoadEngine

**Parameters:**

- ```path``` (String) - The path of the IG package.

**Response:**

- ```200 OK``` - Engine successfully reloaded.

- ```500 Internal Server Error``` - Failed to reload engine.

**Example Request:**

```shell
curl -X GET "http://localhost:8080/api/matchbox/resetAndLoadEngine?path=path.ig.package"
```

### Health Check

#### Endpoint: GET /health

**Response:**

- ```200 OK``` - Application is fully initialized.

- ```503 Service Unavailable``` - Application is still initializing.

**Example Request:**

```shell
curl -X GET "http://localhost:8080/health"
```

### Shutdown Application

#### Endpoint: GET /shutdown

**Response:**

- ```200 OK ```- Application is shutting down.

**Example Request:**

```shell
curl -X GET "http://localhost:8080/shutdown"
```

## Packaging the Project

To package the project, Maven is required:

- Use the command mvn clean to remove an old package.

- Use the command mvn package to create a new package.
