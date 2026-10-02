#!/bin/sh
# Regenerates context-map.svg from gotion.cml. Needs the Context Mapper CLI (cm) and Graphviz (dot).
# Context Mapper writes the Graphviz source, which is then touched up before rendering:
# - the relations leaving Membership, and Account's one to Editing, get their own side of the ellipse,
#   otherwise their U/D labels overlap;
# - each context is filled with the type of the subdomains it implements, as declared in gotion.cml,
#   and a legend explains the colours. Account implements a generic and a supporting subdomain;
# - the U and D boxes at the two ends of a relation get a colour of their own.
set -e
cd "$(dirname "$0")"
CORE='#fbd38d' SUPPORTING='#bee3f8' GENERIC='#e5e7eb' UPSTREAM='#9ae6b4' DOWNSTREAM='#d6bcfa'
cm generate -i gotion.cml -g context-map -o . >/dev/null
fill() { echo "s/^\(\"$1\" \[.*\)\]\$/\1,\"style\"=\"bold,filled\",\"fillcolor\"=\"$2\",\"gradientangle\"=\"0\"]/"; }
{
	sed -e 's/^"Account" -> "Editing" \[/&"tailport"="e",/' \
	    -e 's/^"Membership" -> "Account" \[/&"tailport"="nw",/' \
	    -e 's/^"Membership" -> "Editing" \[/&"tailport"="e",/' \
	    -e 's/^"Membership" -> "Discussion" \[/&"tailport"="s",/' \
	    -e 's/^"Membership" -> "Notification" \[/&"tailport"="w",/' \
	    -e "$(fill Account "$GENERIC;0.5:$SUPPORTING")" \
	    -e "$(fill Membership "$SUPPORTING")" \
	    -e "$(fill Editing "$CORE")" \
	    -e "$(fill Discussion "$SUPPORTING")" \
	    -e "$(fill Notification "$GENERIC")" \
	    -e "s/<td bgcolor=\"white\" sides=\"r\">U</<td bgcolor=\"$UPSTREAM\" sides=\"trbl\">U</" \
	    -e "s/<td bgcolor=\"white\" sides=\"r\">D</<td bgcolor=\"$DOWNSTREAM\" sides=\"trbl\">D</" \
	    -e '$d' gotion_ContextMap.gv
	cat <<EOF
"Legend" ["shape"="plaintext","fontname"="sans-serif","fontsize"="12","label"=<<table border="0" cellborder="1" cellspacing="0" cellpadding="6">
<tr><td colspan="3"><b>Subdomain type</b></td></tr>
<tr><td bgcolor="$CORE">Core</td><td bgcolor="$SUPPORTING">Supporting</td><td bgcolor="$GENERIC">Generic</td></tr>
<tr><td colspan="3"><b>Relation end</b></td></tr>
<tr><td bgcolor="$UPSTREAM">U: upstream</td><td colspan="2" bgcolor="$DOWNSTREAM">D: downstream</td></tr>
</table>>]
{ "rank"="sink"; "Legend" }
}
EOF
} | dot -Tsvg -o context-map.svg
rm gotion_ContextMap.gv gotion_ContextMap.png gotion_ContextMap.svg
