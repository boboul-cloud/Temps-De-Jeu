#!/bin/zsh
#
# Construit la version Mac (Mac Catalyst) de Temps De Jeu et la range dans un .dmg
#
#   ./tools/creer-dmg-mac.sh
#
# Version DMG sans limite (drapeau DMG_SANS_LIMITE : Premium débloqué, pas d'achat).
# Signature locale (« ad hoc ») : rien n'est créé ni envoyé chez Apple.
# L'app s'ouvre directement sur ce Mac ; sur un autre Mac, il faut l'autoriser
# une fois (Réglages Système › Confidentialité et sécurité › « Ouvrir quand même »).
# Pour une diffusion sans avertissement : signature « Developer ID » + notarisation.
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

BUILD_DIR="${BUILD_DIR:-$ROOT/build/mac}"
OUT_DIR="${OUT_DIR:-$(cd "$ROOT/.." && pwd)/Version Mac}"
APP_NAME="Temps De Jeu"
DATE_TAG="$(date +%Y-%m-%d)"

VERSION="$(xcodebuild -project "$APP_NAME.xcodeproj" -scheme "$APP_NAME" -showBuildSettings 2>/dev/null \
  | awk -F' = ' '/ MARKETING_VERSION = / {print $2; exit}')"
DMG_NAME="Temps-De-Jeu-Mac-${VERSION:-x}-${DATE_TAG}.dmg"

echo "▶︎ Compilation Mac Catalyst (Release, arm64 + x86_64)…"
xcodebuild \
  -project "$APP_NAME.xcodeproj" \
  -scheme "$APP_NAME" \
  -configuration Release \
  -destination "generic/platform=macOS,variant=Mac Catalyst" \
  -derivedDataPath "$BUILD_DIR/dd" \
  CODE_SIGN_IDENTITY="-" \
  CODE_SIGN_STYLE=Manual \
  DEVELOPMENT_TEAM="" \
  PROVISIONING_PROFILE_SPECIFIER="" \
  CODE_SIGN_ENTITLEMENTS="" \
  'SWIFT_ACTIVE_COMPILATION_CONDITIONS=$(inherited) DMG_SANS_LIMITE' \
  build | grep -E "error:|BUILD (SUCCEEDED|FAILED)" || true

APP="$BUILD_DIR/dd/Build/Products/Release-maccatalyst/$APP_NAME.app"
[[ -d "$APP" ]] || { echo "✗ Build introuvable : $APP"; exit 1; }

echo "▶︎ Vérification de la signature…"
codesign --verify --deep --strict "$APP"
lipo -archs "$APP/Contents/MacOS/$APP_NAME"

echo "▶︎ Préparation du DMG…"
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT
ditto "$APP" "$STAGE/$APP_NAME.app"
ln -s /Applications "$STAGE/Applications"
cat > "$STAGE/Lisez-moi.txt" <<'TXT'
Temps De Jeu pour Mac
=====================

Installation : glissez « Temps De Jeu » sur le dossier Applications.

Premier lancement sur un autre Mac que celui du développeur :
macOS peut indiquer que l'app ne peut pas être vérifiée (elle n'est pas
encore distribuée par l'App Store). Dans ce cas :
  1. Ouvrez Réglages Système › Confidentialité et sécurité ;
  2. En bas, cliquez sur « Ouvrir quand même » à côté de Temps De Jeu ;
  3. Confirmez. L'app s'ouvrira normalement ensuite.

Nouveautés : Placement en 3D, bibliothèque d'exercices animés pas à pas,
séquences tactiques personnelles et fichiers .tdjt (Match › Placement,
ou onglet Présences › Tactiques 3D).

Version Mac complète : toutes les fonctionnalités sont débloquées,
matchs illimités, sans achat. (Le widget n'existe que sur iPhone / iPad.)
TXT

mkdir -p "$OUT_DIR"
hdiutil create -volname "$APP_NAME" -srcfolder "$STAGE" -ov -format UDZO "$OUT_DIR/$DMG_NAME" >/dev/null
hdiutil verify "$OUT_DIR/$DMG_NAME" >/dev/null

echo "✓ DMG prêt : $OUT_DIR/$DMG_NAME"
