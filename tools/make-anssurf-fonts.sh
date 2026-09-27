#!/bin/sh
# Подмножества шрифтов приложения для встраивания в AnsSurf
#
# Построитель карт живёт в WebView и до шрифтов приложения не дотягивается:
# там своё окружение, и Manrope с JetBrains Mono ему взять неоткуда. Поэтому
# начертания встраиваются прямо в страницу data-адресами.
#
# Полные файлы — по 95–112 КБ каждый, это почти полмегабайта на страницу.
# Подмножество «латиница + кириллица + знаки» ужимает их до 74 КБ на все
# четыре начертания, и этого набора хватает обоим языкам модуля.
#
# Результат — tools/anssurf-fonts.css — лежит в репозитории, поэтому обычная
# пересборка (tools/build-anssurf.js) шрифты не трогает и pyftsubset не
# требует. Гонять этот скрипт нужно только при смене гарнитур приложения:
#
#   pip3 install fonttools && sh tools/make-anssurf-fonts.sh
set -e
cd "$(dirname "$0")/.."

FONTS="node_modules/@expo-google-fonts"
OUT="tools/anssurf-fonts.css"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# Латиница, кириллица, типографские знаки, степени и индексы: последние нужны
# подписям вроде «м³/сут» и «H₂O», без них они посыпались бы на запасной шрифт
RANGE="U+0020-007E,U+00A0-00FF,U+0400-045F,U+2010-2027,U+2030-205E,U+20BD,U+2116,U+2212,U+00B0,U+00B2,U+00B3,U+00B7,U+2080-2089,U+00D7"

emit() {
  src="$1"; family="$2"; weight="$3"
  pyftsubset "$src" --output-file="$TMP/f.woff" --flavor=woff \
    --unicodes="$RANGE" --layout-features="kern,liga,tnum" >/dev/null
  printf '@font-face{font-family:"%s";font-style:normal;font-weight:%s;font-display:block;src:url(data:font/woff;base64,%s) format("woff")}\n' \
    "$family" "$weight" "$(base64 < "$TMP/f.woff" | tr -d '\n')" >> "$OUT"
}

printf '/* Создано tools/make-anssurf-fonts.sh — править вручную нечего */\n' > "$OUT"
emit "$FONTS/manrope/400Regular/Manrope_400Regular.ttf"            "Manrope"       400
emit "$FONTS/manrope/600SemiBold/Manrope_600SemiBold.ttf"          "Manrope"       600
emit "$FONTS/manrope/700Bold/Manrope_700Bold.ttf"                  "Manrope"       700
emit "$FONTS/jetbrains-mono/400Regular/JetBrainsMono_400Regular.ttf" "JetBrains Mono" 400

echo "$OUT: $(( $(wc -c < "$OUT") / 1024 )) КБ"
