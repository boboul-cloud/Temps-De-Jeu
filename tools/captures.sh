#!/bin/bash
#
# Refait toutes les captures d'écran de la fiche App Store.
#
#   ./tools/captures.sh                  # iPhone 6,9 pouces + iPad 13 pouces
#   SERIES=iphone ./tools/captures.sh    # iPhone seulement
#   GARDER=1 ./tools/captures.sh         # sans supprimer les simulateurs à la fin
#
# Chaque série tourne sur un simulateur créé pour elle : ceux de l'utilisateur
# ne sont pas touchés. Le test TempsDeJeuUITests/CaptureTests.swift relance
# l'app sur chaque écran avec l'argument -demo (Temps De Jeu/Demo.swift, Debug
# seulement) : catégorie U13 fictive, effectif aux noms inventés, match en cours.
#
# Résultat : soumission/captures/iphone-6.9/ (1320 × 2868)
#            soumission/captures/ipad-13/    (2064 × 2752)

set -euo pipefail
cd "$(dirname "$0")/.."

TRAVAIL="build/captures"
DERIVE="build/captures-derived"
SERIES="${SERIES:-iphone ipad}"

prendre() {
  local modele="$1" nom="$2" dossier="$3"
  local udid
  udid=$(xcrun simctl list devices available | grep -F "$nom (" | head -1 |
         sed -E 's/.*\(([0-9A-F-]{36})\).*/\1/' || true)
  if [ -z "$udid" ]; then
    udid=$(xcrun simctl create "$nom" "$modele")
  fi
  echo "== $nom ($udid)"

  xcrun simctl boot "$udid" 2>/dev/null || true
  xcrun simctl bootstatus "$udid" -b >/dev/null
  xcrun simctl ui "$udid" appearance light
  xcrun simctl status_bar "$udid" override --time 9:41 --batteryState charged --batteryLevel 100 \
    --wifiBars 3 --cellularBars 4

  rm -rf "$TRAVAIL/$dossier.xcresult" "$TRAVAIL/$dossier-brut"
  mkdir -p "$TRAVAIL"
  xcodebuild test -project "Temps De Jeu.xcodeproj" -scheme Captures \
    -destination "id=$udid" -derivedDataPath "$DERIVE" \
    -only-testing:TempsDeJeuUITests/CaptureTests \
    -resultBundlePath "$TRAVAIL/$dossier.xcresult" >/dev/null

  xcrun xcresulttool export attachments \
    --path "$TRAVAIL/$dossier.xcresult" --output-path "$TRAVAIL/$dossier-brut" >/dev/null
  rm -rf "soumission/captures/$dossier"
  mkdir -p "soumission/captures/$dossier"
  python3 - "$TRAVAIL/$dossier-brut" "soumission/captures/$dossier" <<'PY'
import json, shutil, sys
brut, sortie = sys.argv[1], sys.argv[2]
for test in json.load(open(f"{brut}/manifest.json")):
    for piece in test.get("attachments", []):
        nom = piece["suggestedHumanReadableName"].split("_")[0]
        shutil.copy(f"{brut}/{piece['exportedFileName']}", f"{sortie}/{nom}.png")
PY
  echo "   $(ls "soumission/captures/$dossier" | wc -l | tr -d ' ') captures"
  sips -g pixelWidth -g pixelHeight "soumission/captures/$dossier"/*.png | grep pixel | sort | uniq -c

  if [ "${GARDER:-0}" != "1" ]; then
    xcrun simctl shutdown "$udid" 2>/dev/null || true
    xcrun simctl delete "$udid"
  fi
}

for serie in $SERIES; do
  case "$serie" in
    iphone) prendre "iPhone 17 Pro Max" "TDJ-Captures-iPhone" iphone-6.9 ;;
    ipad)   prendre "iPad Pro 13-inch (M5)" "TDJ-Captures-iPad" ipad-13 ;;
  esac
done

echo "Captures dans soumission/captures/"
