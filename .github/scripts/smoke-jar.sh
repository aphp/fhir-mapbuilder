#!/usr/bin/env bash
# Smoke-test du jar de validation : le lance depuis un dossier dont le nom contient
# un espace et un accent (le cas des chemins utilisateurs Windows, `C:\Users\Prénom Nom\…`),
# puis attend `GET /health` -> 200.
#
# Usage : bash .github/scripts/smoke-jar.sh <chemin-du-jar>
#
# Partagé par le job `build` (Linux) et le job `os-smoke` (Windows, macOS) de ci.yml : il doit
# tourner à l'identique sous bash (Linux, macOS) et sous Git Bash (Windows).
set -eu

jar="${1:?usage: smoke-jar.sh <chemin-du-jar>}"

dir="$(mktemp -d)/smoke é dir"
mkdir -p "$dir"
cp "$jar" "$dir/fhir-mapbuilder-validation.jar"

java -jar "$dir/fhir-mapbuilder-validation.jar" &
SERVER_PID=$!
trap 'kill "$SERVER_PID" 2>/dev/null || true' EXIT

# L'init du moteur Matchbox charge les paquets FHIR depuis le classpath
# (pas de réseau) ; observé ~40 s en local, 120 s laisse de la marge sur
# les runners CI plus lents.
for i in $(seq 1 60); do
  code="$(curl -s -o /dev/null -w '%{http_code}' http://localhost:9031/health || true)"
  if [ "$code" = "200" ]; then
    echo "jar healthy after ~$((i * 2))s"
    exit 0
  fi
  sleep 2
done

echo "::error::validation jar never returned 200 on /health within 120s"
exit 1
