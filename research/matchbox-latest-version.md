# Matchbox / hapi-fhir-core version research (issue #29)

Research for wayfinder ticket [aphp/fhir-mapbuilder#29](https://github.com/aphp/fhir-mapbuilder/issues/29),
part of map #28 ("Matchbox version bump + Java/Maven security MCO").

Current pins in `fhir-mapbuilder-validation/pom.xml`:

- `health.matchbox.version` = `4.1.1`
- `fhir.core.version` = `6.9.4` (shared by `ca.uhn.hapi.fhir:org.hl7.fhir.r4` and `org.hl7.fhir.r5`)
- `commons-io` = `2.17.0`
- Parent `spring-boot-starter-parent` = `3.5.13`

Hard constraint from the repo owner: `fhir.core.version` must never be pinned independently of
what the target Matchbox version itself depends on — Matchbox's own declared hapi-fhir-core
version is authoritative.

## 1. Latest `health.matchbox:matchbox-engine` version

**4.1.13**, published 2026-08-14.

- Maven Central metadata: `<release>4.1.13</release>` / `<latest>4.1.13</latest>` —
  https://repo1.maven.org/maven2/health/matchbox/matchbox-engine/maven-metadata.xml
- GitHub release: https://github.com/ahdis/matchbox/releases/tag/v4.1.13
  (published_at 2026-08-14T15:42:30Z, author oliveregger)

Note: `gh api repos/ahdis/matchbox/tags` also lists tags `v5.5.0`, `v5.4.1`, `v5.3.0` ahead of
`v4.1.13` in the API's raw tag ordering, but these are stale artifacts inherited from the
repo's original fork point (`hapi-fhir-jpaserver-starter`) — confirmed via
`gh api repos/ahdis/matchbox/commits/<sha>` showing a commit date of `2021-08-27` for one of
those tags ("Merge pull request #267 from hapifhir/rel_5_5_0"). They predate Matchbox's own
versioning scheme and are not current releases. `v4.1.13` is the top of the GitHub Releases
list (sorted newest-first) and is unambiguously the latest active release.

## 2. Target `fhir.core.version` (hapi-fhir-core / org.hl7.fhir.core)

**`fhir.core.version` = `6.10.0`** — this is the authoritative value to set in this repo's
`pom.xml`, moving up from `6.9.4`.

Source: root `pom.xml` at tag `v4.1.13` —
https://raw.githubusercontent.com/ahdis/matchbox/v4.1.13/pom.xml

```xml
<fhir.core.version>6.10.0</fhir.core.version>
<hapi.fhir.version>8.10.1</hapi.fhir.version>
```

The `matchbox-engine` module's own POM (both
https://raw.githubusercontent.com/ahdis/matchbox/v4.1.13/matchbox-engine/pom.xml and the
published https://repo1.maven.org/maven2/health/matchbox/matchbox-engine/4.1.13/matchbox-engine-4.1.13.pom)
inherits from the `health.matchbox:matchbox` parent (v4.1.13) and depends on
`ca.uhn.hapi.fhir:org.hl7.fhir.r5`, `org.hl7.fhir.r4`, `org.hl7.fhir.convertors`,
`org.hl7.fhir.validation`, `org.hl7.fhir.utilities` — all version-managed by the parent's
`${fhir.core.version}` = `6.10.0`.

**Action:** bump `fhir.core.version` from `6.9.4` to `6.10.0` alongside the Matchbox bump.

## 3. GHSA fix status

Both advisories are **fixed** by hapi-fhir-core `6.10.0` (well above both patched floors).

**GHSA-7cmj-v6x8-frvv** (CVE-2026-49485) — https://github.com/advisories/GHSA-7cmj-v6x8-frvv
(`gh api advisories/GHSA-7cmj-v6x8-frvv`)
- Vulnerable range: `>= 6.9.5, < 6.9.9`
- `first_patched_version`: `6.9.9`
- `6.10.0` ≥ `6.9.9` → **patched**. (The repo's *current* pin `6.9.4` is technically below this
  advisory's vulnerable-range floor of `6.9.5`, so it was never in-range for this specific CVE —
  Dependabot likely flags it as "update available" rather than "vulnerable" for this one.)

**GHSA-3653-68v6-rq57** (CVE-2026-45367) — https://github.com/advisories/GHSA-3653-68v6-rq57
(`gh api advisories/GHSA-3653-68v6-rq57`)
- Vulnerable range: `<= 6.9.6`
- `first_patched_version`: `6.9.7`
- The repo's **current** pin `6.9.4` *is* inside this vulnerable range — currently exposed.
- `6.10.0` ≥ `6.9.7` → **patched**.

## 4. Spring Boot version requirement

**No hard requirement to move off `3.5.13`.** `matchbox-engine`'s own POM
(https://raw.githubusercontent.com/ahdis/matchbox/v4.1.13/matchbox-engine/pom.xml) has zero
direct Spring dependencies — only hapi-fhir-core artifacts, `ucum`, `commonmark`(+gfm-tables),
Jackson, `logback-classic`, `log4j-to-slf4j`, `lombok`, `okhttp`, `poi-ooxml`(+full).

The root `matchbox` reactor POM does pin `<spring_boot_version>3.5.16</spring_boot_version>`
(vs. this repo's `3.5.13`) to force `spring-boot-autoconfigure`,
`spring-boot-starter-actuator`, `spring-boot-starter-undertow`, `spring-boot-starter-web`,
`spring-boot-starter-test`, plus `spring-data-commons/jpa/envers` and `spring-retry` — but per
the root POM's own comments and the v4.1.13 release notes
(https://github.com/ahdis/matchbox/releases/tag/v4.1.13), these forced versions exist
specifically because `hapi-fhir-jpaserver-base` (used only by the sibling `matchbox-server`
module, a standalone Spring Boot REST app) still transitively pulls an older Spring Data line
(fixing CVE-2026-41716/41711/41721, CVE-2026-41838, CVE-2026-41848, CVE-2026-41710).
`matchbox-server` is **not** a dependency of this repo — only `matchbox-engine` is.

**Conclusion:** No forced bump of `spring-boot-starter-parent` from the `matchbox-engine`
dependency edge. Optionally worth adopting `3.5.16` anyway for its own CVE fixes if this repo
uses `spring-data-jpa`/`spring-websocket`/`spring-retry` elsewhere, but that is independent of
Matchbox compatibility.

## 5. `commons-io` version

Matchbox's root reactor POM pins `commons_io_version = 2.22.0` (vs. this repo's `2.17.0`) via
`<dependencyManagement>`:

```xml
<commons_io_version>2.22.0</commons_io_version>
...
<dependency>
    <groupId>commons-io</groupId>
    <artifactId>commons-io</artifactId>
    <version>${commons_io_version}</version>
</dependency>
```

However, `matchbox-engine` itself does **not** directly declare a `commons-io` dependency (it's
absent from `matchbox-engine/pom.xml`'s `<dependencies>` block) — it's pulled in transitively
(likely via hapi-fhir-core / `org.hl7.fhir.utilities` or Apache POI). Since this repo manages
`commons-io` itself as an explicit property, it is **recommended to bump `commons-io` to at
least `2.22.0`** to match what Matchbox 4.1.13 was built/tested against, though it's not a hard
compile-time requirement enforced by the `matchbox-engine` jar's own POM metadata.

## 6. Breaking `MatchboxEngine` API changes (4.1.1 → 4.1.13)

**None found for any call site used in this repo.** Compared `MatchboxEngine.java` and
`VersionUtil.java` directly at tags `v4.1.1` vs `v4.1.13` in ahdis/matchbox.

Call sites checked, all in
`fhir-mapbuilder-validation/src/main/java/fr/aphp/mapbuilder/service/MatchBoxService.java`:

| Call site | API | Status |
|---|---|---|
| `MatchBoxService.java:38` (ctor param) / `:169` | `new MatchboxEngine.MatchboxEngineBuilder().getEngineR4()` | Unchanged: `public MatchboxEngine getEngineR4() throws MatchboxEngineCreationException` |
| `MatchBoxService.java:84` | `engine.parseMap(content)` | Unchanged: `public org.hl7.fhir.r4.model.StructureMap parseMap(String content) throws IOException, FHIRException` |
| `MatchBoxService.java:101` | `engine.getValidator(Manager.FhirFormat.JSON)` | Unchanged signature |
| `MatchBoxService.java:102` | `engine.filterValidationMessages(messages)` | Unchanged |
| `MatchBoxService.java:122` | `engine.transform(stringData, true, structureMap.getUrl(), true)` | The 4-arg overload `transform(String input, boolean inputJson, String mapUri, boolean outputJson)` is byte-identical in both versions (delegates to the 5-arg overload with a `null` trace param) |
| `MatchBoxService.java:187` | `engine.loadPackage(inputStream)` | Unchanged: `public void loadPackage(final @NonNull InputStream inputStream) throws IOException` |
| `MatchBoxService.java:198-203` | `engine.getContext().hasResource/dropResource/fetchResource`, `engine.addCanonicalResource(sm)` | Unchanged in `MatchboxEngine.java`. Note: Matchbox's *internal* code migrated some `fetchResource(Class, String)` calls to a newer 3-arg overload with `VersionResolutionRules`, but the 2-arg overload used at line 200 still exists in `org.hl7.fhir.core`'s `IWorkerContext` at both `6.9.4` and `6.10.0` — it's `@Deprecated(since="2026-03-10")` but present and delegates to the 3-arg form, so it compiles and behaves identically. |
| `MatchBoxService.java:162` | `ch.ahdis.matchbox.engine.cli.VersionUtil.getMemory()` | Unchanged: `public static String getMemory()`; zero diff in `VersionUtil.java` between the two tags |

The full diff of `MatchboxEngine.java` between the two tags (~344 diff lines of ~1290 total)
consists almost entirely of bumped bundled IG/terminology package version constants (e.g.
`hl7.terminology.r4#7.0.1` → `7.3.0`, `hl7.fhir.uv.extensions.r4#5.2.0` → `5.3.0`), a new
`PACKAGE_UV_XVER54` constant, and the internal `fetchResource` overload migration noted above.
No method was removed, no signature changed, no new checked exception added, for any of the 8
call sites above.

**Conclusion: safe to upgrade from an API-compatibility standpoint for this repo's usage of
`MatchboxEngine`.**

## Summary / recommended pin changes

| Property | Current | Target |
|---|---|---|
| `health.matchbox.version` | `4.1.1` | `4.1.13` |
| `fhir.core.version` | `6.9.4` | `6.10.0` |
| `commons.io.version` | `2.17.0` | `2.22.0` (recommended, not strictly required) |
| `spring-boot-starter-parent` | `3.5.13` | no change required by Matchbox; `3.5.16` optional |

GHSA-7cmj-v6x8-frvv and GHSA-3653-68v6-rq57 are both resolved at `fhir.core.version = 6.10.0`.
No breaking `MatchboxEngine` API changes affect this repo's usage between `4.1.1` and `4.1.13`.
