# Spring Boot 4.1.0 Migration Research — `fhir-mapbuilder-validation`

Research for [issue #49](https://github.com/aphp/fhir-mapbuilder/issues/49), part of wayfinder map
[#48](https://github.com/aphp/fhir-mapbuilder/issues/48) ("Decide on Spring Boot 4 migration (PR #35)").

Scope: what does bumping `fhir-mapbuilder-validation/pom.xml`'s `spring-boot-starter-parent` from
`3.5.13` to `4.1.0` (Dependabot PR #35) actually involve, beyond the one known compile error in
`MatchboxEngineConfig.java`?

Sources consulted are all primary: the official Spring Boot GitHub wiki migration/release-note
pages, the live Spring Boot 4.1.1 Javadoc on docs.spring.io, and the Spring Framework 7.0 wiki
release notes. Each claim below is cited inline.

---

## 1. `TomcatServletWebServerFactory` / `WebServerFactoryCustomizer` relocation

As part of a Boot-4.0 modularization effort tracked in
[spring-boot#44067](https://github.com/spring-projects/spring-boot/issues/44067) ("Relocate
WebServer-specific WebServerFactoryCustomizer implementations"), server-specific classes were
moved out of the generic `org.springframework.boot.web.embedded.*` / `org.springframework.boot.
autoconfigure.web.*` packages into per-server packages.

Confirmed via the live Spring Boot 4.1.1 Javadoc
(https://docs.spring.io/spring-boot/api/java/org/springframework/boot/tomcat/servlet/TomcatServletWebServerFactory.html):

- **Old (Boot 3.x):** `org.springframework.boot.web.embedded.tomcat.TomcatServletWebServerFactory`
- **New (Boot 4.1.x):** `org.springframework.boot.tomcat.servlet.TomcatServletWebServerFactory`

`WebServerFactoryCustomizer` itself **did not move** — confirmed at
https://docs.spring.io/spring-boot/api/java/org/springframework/boot/web/server/WebServerFactoryCustomizer.html,
still `org.springframework.boot.web.server.WebServerFactoryCustomizer` in Boot 4.1.1.

### Concrete fix for `MatchboxEngineConfig.java`

Only the Tomcat-specific import needs to change; the customizer interface, the bean shape, and
`setPort(int)` are unchanged:

```java
package fr.aphp.mapbuilder.config;

import ch.ahdis.matchbox.engine.MatchboxEngine;
import org.springframework.boot.tomcat.servlet.TomcatServletWebServerFactory; // <-- new package
import org.springframework.boot.web.server.WebServerFactoryCustomizer;       // unchanged
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class MatchboxEngineConfig {

    @Bean("matchboxEngineR4")
    public MatchboxEngine matchboxEngine() {
        return new MatchboxEngine.MatchboxEngineBuilder().getEngineR4();
    }

    @Bean
    public WebServerFactoryCustomizer<TomcatServletWebServerFactory> serverPortCustomizer() {
        return factory -> {
            String port = System.getProperty("server.port", "9031");
            factory.setPort(Integer.parseInt(port));
        };
    }
}
```

This is a one-line import change — no behavioral change to the bean.

---

## 2. Minimum Java version

Confirmed on the official Spring Boot system requirements page for 4.1.1
(https://docs.spring.io/spring-boot/system-requirements.html):

> "requires at least Java 17 and is compatible with versions up to and including Java 26."

Also confirmed independently in the Spring Boot 4.0 migration guide wiki
(https://github.com/spring-projects/spring-boot/wiki/Spring-Boot-4.0-Migration-Guide):

> "Spring Boot 4.0 requires Java 17 or later. Using the latest LTS release of Java is encouraged."

And Spring Framework 7.0 (which Boot 4 rides on) release notes confirm the same floor:
"Spring Framework 7.0 retains a JDK 17 baseline."

**This repo's `maven.compiler.release` is 21**, which is above the Java 17 floor. **No Java
version change required** — fully compatible.

(Note: some third-party blog summaries turned up during this research incorrectly claimed Boot 4
requires Java 21 as a minimum. That is not what the primary Spring sources say — Java 17 is the
documented floor, Java 21 is merely a supported/encouraged LTS. Flagging this because it's an
easy thing to get wrong from secondary sources.)

---

## 3. Jakarta EE version change

Confirmed on the same system-requirements/migration-guide sources: Spring Boot 4 moves to a
**Jakarta EE 11** baseline (Servlet 6.1), up from Jakarta EE 9/10 on Boot 3.x. Spring Framework
7.0 release notes: "Spring Framework 7.x uses an EE 11 baseline (Servlet 6.1, JPA 3.2, BV 3.1)."

**This module has zero exposure to this change.** A repo-wide grep of
`fhir-mapbuilder-validation/src` for `import javax\.` returned **no matches** — the module
already has no `javax.*` imports at all (it doesn't even directly import `jakarta.servlet.*`; the
only servlet-container coupling is the Tomcat customizer bean covered in §1, which is handled by
the framework, not by this code). Since Boot 3.5 was already on a Jakarta baseline and this module
made no direct servlet/EE API calls, the EE 9/10 → EE 11 bump is a **non-issue for this module**,
confirmed rather than assumed.

---

## 4. Other breaking changes vs. this module's actual API surface

Files read: `MatchBoxApplication.java`, `ShutdownController.java`, `MatchBoxService.java`,
`MatchBoxController.java`, `HealthController.java`.

| API used | Where | Boot 4 / Framework 7 change found? |
|---|---|---|
| `SpringApplication.run(...)` | `MatchBoxApplication` | None found in Boot 4.0 migration guide or Framework 7.0 release notes. |
| `@SpringBootApplication` | `MatchBoxApplication` | Unchanged. |
| `@EnableConfigurationProperties` | `MatchBoxApplication` | Unchanged. |
| `ContextRefreshedEvent` + `@EventListener` | `MatchBoxApplication` | No breaking change documented for either in the Framework 7.0 release notes. |
| `ConfigurableApplicationContext` | `ShutdownController` | Unchanged. |
| `FileSystemResource` (`org.springframework.core.io`) | `MatchBoxService` | No change documented. |
| `@RestController`, `@RequestMapping`, `@GetMapping`, `@RequestParam`, `ResponseEntity` | `HealthController`, `ShutdownController`, `MatchBoxController` | No changes documented in Boot 4.0 migration guide or Framework 7.0 release notes; `spring-boot-starter-web`'s core MVC annotation surface is unchanged. |
| `@Autowired`, `@Qualifier` | `MatchBoxApplication`, `MatchBoxService` | No breaking change documented. |

The one relevant framework-wide change surfaced during research: Spring Framework 7 deprecates
JSR-305-style `org.springframework.lang.Nullable`/`@NonNull` in favor of JSpecify annotations
(`org.jspecify.annotations.Nullable`). This module doesn't use `org.springframework.lang.Nullable`
anywhere, so it's not applicable here — noted for completeness since it's the most-cited Framework
7 breaking change.

**Conclusion: no other code changes needed** beyond the one import in §1. The module's actual
API surface (plain `@RestController` MVC, `SpringApplication`, core events, `FileSystemResource`)
is untouched by the Boot 4 / Framework 7 breaking-change set.

---

## 5. Spring Boot Actuator changes

`fhir-mapbuilder-validation/src/main/java/fr/aphp/mapbuilder/controller/HealthController.java`
is a **plain custom `@RestController`** exposing `GET /health`, built entirely from
`MatchBoxApplication.isInitializationComplete()` and `ResponseEntity`/`HttpStatus`. It does not
import or depend on anything from `org.springframework.boot.actuate.*`, and the module's `pom.xml`
does not declare `spring-boot-starter-actuator` as a dependency.

Boot 4.0 does make Actuator changes (e.g., liveness/readiness probes enabled by default, and
Actuator endpoint parameter nullability annotations moving to JSpecify — per the migration guide
wiki), but **these are irrelevant to this module** since it uses no Actuator infrastructure at
all — confirmed, not assumed.

---

## 6. `spring-boot-maven-plugin` `repackage` goal

This module's `pom.xml` `<build><plugins>` block only configures:

```xml
<plugin>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-maven-plugin</artifactId>
    <configuration>
        <mainClass>fr.aphp.mapbuilder.MatchBoxApplication</mainClass>
    </configuration>
</plugin>
```

The one confirmed breaking change to the plugin in Boot 4.0 (per the official migration guide
wiki) is removal of the **classic uber-jar loader**:

> "The classic uber-jar loader has been removed from this release. You should remove any loader
> implementation configuration from your build file... For maven this means removing the
> following: `<loaderImplementation>CLASSIC</loaderImplementation>`."

There's also a war-deployment-specific change (`spring-boot-starter-tomcat` →
`spring-boot-starter-tomcat-runtime`) that only applies to WAR packaging.

**Neither applies here**: this module's plugin config has no `<loaderImplementation>` setting (so
it already uses the current default loader) and it isn't packaged as a WAR (default `jar`
packaging, executable jar via `repackage`). `<mainClass>` configuration is unchanged in Boot 4.
**No pom.xml build-plugin changes needed.**

---

## 7. Effort estimate

**Small — same-session fix.**

The only breaking change that touches this module's actual code is the Tomcat customizer package
relocation (§1), which is a one-line import change in a single file
(`MatchboxEngineConfig.java`), with no behavioral change to the bean itself. Every other axis
checked — Java version (§2), Jakarta EE (§3), core Spring/MVC API surface (§4), Actuator (§5), and
the Maven plugin's `repackage` goal (§6) — comes back either already compatible or simply not
applicable to what this module actually uses.

Recommended path: fix the one import in PR #35 (or a follow-up commit on top of it), then let CI
confirm — no other exploratory changes are expected to be needed. The usual caveats apply: verify
transitive dependency compatibility (e.g. `health.matchbox:matchbox-engine:4.1.13`,
`ca.uhn.hapi.fhir:*:6.10.0`) against Boot 4.1.0's Spring Framework 7 baseline when running the
actual build, since those weren't audited here (out of scope: they're third-party libraries, not
Spring Boot itself).

---

### Sources

- https://github.com/spring-projects/spring-boot/wiki/Spring-Boot-4.0-Migration-Guide
- https://github.com/spring-projects/spring-boot/issues/44067
- https://docs.spring.io/spring-boot/api/java/org/springframework/boot/tomcat/servlet/TomcatServletWebServerFactory.html
- https://docs.spring.io/spring-boot/api/java/org/springframework/boot/web/server/WebServerFactoryCustomizer.html
- https://docs.spring.io/spring-boot/system-requirements.html
- https://github.com/spring-projects/spring-framework/wiki/Spring-Framework-7.0-Release-Notes
- https://docs.spring.io/spring-boot/maven-plugin/api/java/org/springframework/boot/maven/RepackageMojo.html
