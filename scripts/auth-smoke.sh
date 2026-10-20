#!/bin/bash
# Sign-in and session checks, end to end, against a LOCAL production build.
#
#   npm run build && npm start      # in one terminal (npm run dev 404s on some machines)
#   bash scripts/auth-smoke.sh      # in another
#
# Covers: forged, stale and wrong-type tokens; role and deactivation taking effect
# at once; all three ways a password changes (own, admin-set, emailed reset) and
# the sessions each one ends; reset tokens stored hashed; account lockout; equal
# timing for unknown addresses; the per-address limit ignoring a spoofed
# X-Forwarded-For; and the Google OAuth state guards.
#
# It rewrites two fixture accounts, smoke@test.local (ADMIN) and other@test.local
# (MEMBER), creating them if missing, with random passwords it never prints. It
# refuses to run against anything but localhost.
#
# Each login sends its own X-Real-IP so the per-address limit (tested on its own
# at the end) doesn't interfere. That only works locally: on prod nginx sets the
# header itself. JSON bodies go through js() because macOS's bash 3.2 mangles
# escaped quotes inside "$(...)" — a body with a comma silently became two args.
set -u
cd "$(dirname "$0")/.."
B=http://localhost:3000
DB="${DATABASE_URL:-postgresql://work@localhost:5432/outlanderos}"
case "$DB" in *@localhost:*|*@127.0.0.1:*) ;; *) echo "Refusing: DATABASE_URL is not local." >&2; exit 2 ;; esac
SECRET=$(grep '^NEXTAUTH_SECRET=' .env.local 2>/dev/null | cut -d= -f2-)
[ -n "$SECRET" ] || { echo "No NEXTAUTH_SECRET in .env.local — the running server's secret is needed to mint test tokens." >&2; exit 2; }
curl -s -o /dev/null --max-time 5 $B/login || { echo "Nothing listening on $B." >&2; exit 2; }
PW=$(openssl rand -hex 12)        # test passwords, never printed
PW2=$(openssl rand -hex 12)
J=$(mktemp -d)
for who in smoke other; do
  psql "$DB" -q -c "insert into \"User\" (id, email, password, name, \"updatedAt\") values ('fixture-$who', '$who@test.local', 'x', 'Fixture $who', now()) on conflict (email) do nothing;"
done
pass=0; fail=0
ok()   { echo "  PASS  $1"; pass=$((pass+1)); }
bad()  { echo "  FAIL  $1  (got $2)"; fail=$((fail+1)); }
want() { [ "$2" = "$3" ] && ok "$1" || bad "$1" "$2"; }
js(){ python3 -c 'import sys,json;a=sys.argv[1:];print(json.dumps(dict(zip(a[::2],a[1::2]))))' "$@"; }
ip(){ echo "10.$((RANDOM%250)).$((RANDOM%250)).$((RANDOM%250))"; }
login(){ curl -s -o "$J/body" -c "$2" -w '%{http_code}' -X POST $B/api/auth/login -H "X-Real-IP: $(ip)" -H 'Content-Type: application/json' -d "$(js email "$1" password "$3")"; }
get()  { curl -s -o /dev/null -b "$2" -w '%{http_code}' "$B$1"; }

# Fresh known state for both fixtures.
HASH=$(node -e "console.log(require('bcryptjs').hashSync(process.argv[1],10))" "$PW")
psql "$DB" -q -c "update \"User\" set password='$HASH', \"isActive\"=true, \"sessionVersion\"=0, \"mustChangePassword\"=false, \"failedLoginCount\"=0, \"lockedUntil\"=null, role=case when email='smoke@test.local' then 'ADMIN'::\"Role\" else 'MEMBER'::\"Role\" end where email in ('smoke@test.local','other@test.local');"

echo "── sign in"
want "correct password signs in"            "$(login smoke@test.local $J/a "$PW")" 200
want "session reaches an admin API"         "$(get /api/admin/users $J/a)" 200
grep -q '"sv"' <(cut -f7 $J/a | tail -1 | cut -d. -f2 | base64 -d 2>/dev/null) && ok "token carries a session version" || bad "token carries a session version" "no sv claim"
want "wrong password is refused"            "$(login smoke@test.local $J/x wrong-password-123)" 401

echo "── forged and stale sessions"
GHOST=$(SECRET="$SECRET" node -e 'const j=require("jsonwebtoken");console.log(j.sign({userId:"ghost",role:"ADMIN",email:"g@x",name:"G"},process.env.SECRET,{expiresIn:"5m"}))')
want "token for a non-existent user refused" "$(curl -s -o /dev/null -w '%{http_code}' -b "auth_token=$GHOST" $B/api/admin/users)" 401
LEGACY=$(SECRET="$SECRET" UID_=$(psql "$DB" -t -A -c "select id from \"User\" where email='smoke@test.local'") node -e 'const j=require("jsonwebtoken");console.log(j.sign({userId:process.env.UID_,role:"ADMIN",email:"smoke@test.local",name:"S"},process.env.SECRET,{expiresIn:"5m"}))')
want "pre-change token (no sv) still works" "$(curl -s -o /dev/null -w '%{http_code}' -b "auth_token=$LEGACY" $B/api/admin/users)" 200

echo "── role comes from the database, not the token"
want "member signs in"                     "$(login other@test.local $J/m "$PW")" 200
want "member is refused the admin API"      "$(get /api/admin/users $J/m)" 403
psql "$DB" -q -c "update \"User\" set role='ADMIN' where email='other@test.local';"
want "promoted member is let in at once"    "$(get /api/admin/users $J/m)" 200
psql "$DB" -q -c "update \"User\" set role='MEMBER' where email='other@test.local';"
want "demoted member is refused at once"    "$(get /api/admin/users $J/m)" 403

echo "── switching someone off"
OTHER=$(psql "$DB" -t -A -c "select id from \"User\" where email='other@test.local'")
want "member signs in again"               "$(login other@test.local $J/m "$PW")" 200
want "member's session works"               "$(get /api/me $J/m)" 200
curl -s -o /dev/null -b $J/a -X PATCH "$B/api/admin/users/$OTHER" -H 'Content-Type: application/json' -d '{"isActive":false}'
want "deactivated member is out at once"    "$(get /api/me $J/m)" 401
want "and cannot sign back in"              "$(login other@test.local $J/m2 "$PW")" 403
curl -s -o /dev/null -b $J/a -X PATCH "$B/api/admin/users/$OTHER" -H 'Content-Type: application/json' -d '{"isActive":true}'

echo "── admin sets a password"
want "member signs in"                     "$(login other@test.local $J/m "$PW")" 200
want "short admin-set password refused"     "$(curl -s -o /dev/null -w '%{http_code}' -b $J/a -X PATCH "$B/api/admin/users/$OTHER" -H 'Content-Type: application/json' -d '{"password":"short"}')" 400
want "admin sets a temporary password"      "$(curl -s -o /dev/null -w '%{http_code}' -b $J/a -X PATCH "$B/api/admin/users/$OTHER" -H 'Content-Type: application/json' -d "$(js password "$PW2")")" 200
want "member's old session is ended"        "$(get /api/me $J/m)" 401
want "member must choose their own"         "$(psql "$DB" -t -A -c "select \"mustChangePassword\" from \"User\" where id='$OTHER'")" t
want "temporary password signs in"         "$(login other@test.local $J/m "$PW2")" 200
grep -q "must_change_pw.*1" $J/m && ok "login sets the change-password lock" || bad "login sets the change-password lock" "cookie missing"

echo "── changing your own password"
want "a second device signs in"            "$(login smoke@test.local $J/a2 "$PW")" 200
NEWPW=$(openssl rand -hex 12)
want "change own password"                  "$(curl -s -o /dev/null -c $J/a -b $J/a -w '%{http_code}' -X PUT $B/api/me/password -H 'Content-Type: application/json' -d "$(js currentPassword "$PW" newPassword "$NEWPW")")" 200
want "this device stays signed in"          "$(get /api/admin/users $J/a)" 200
want "the other device is signed out"       "$(get /api/admin/users $J/a2)" 401
want "9-character password refused"         "$(curl -s -o /dev/null -b $J/a -w '%{http_code}' -X PUT $B/api/me/password -H 'Content-Type: application/json' -d "$(js currentPassword "$NEWPW" newPassword "ninechars")")" 400

echo "── reset by email"
RESP=$(curl -s -b $J/a -X POST $B/api/auth/forgot-password -H 'Content-Type: application/json' -d '{"email":"smoke@test.local"}')
RAW=$(echo "$RESP" | python3 -c 'import sys,json,urllib.parse as u;l=json.load(sys.stdin).get("link","");print(u.parse_qs(u.urlparse(l).query).get("token",[""])[0])')
STORED=$(psql "$DB" -t -A -c "select \"resetToken\" from \"User\" where email='smoke@test.local'")
[ -n "$RAW" ] && [ "$STORED" != "$RAW" ] && [ ${#STORED} = 64 ] && ok "only a hash of the reset token is stored" || bad "only a hash of the reset token is stored" "raw=${#RAW} stored=${#STORED}"
want "another device signs in"            "$(login smoke@test.local $J/a3 "$NEWPW")" 200
RPW=$(openssl rand -hex 12)
want "reset with the emailed token"         "$(curl -s -o /dev/null -w '%{http_code}' -X POST $B/api/auth/reset-password -H 'Content-Type: application/json' -d "$(js token "$RAW" newPassword "$RPW")")" 200
want "reset signs out other sessions"       "$(get /api/admin/users $J/a3)" 401
want "the token cannot be used twice"       "$(curl -s -o /dev/null -w '%{http_code}' -X POST $B/api/auth/reset-password -H 'Content-Type: application/json' -d "$(js token "$RAW" newPassword "$(openssl rand -hex 12)")")" 400
want "new password signs in"                "$(login smoke@test.local $J/a "$RPW")" 200

echo "── other tokens signed with the same secret"
SUID=$(psql "$DB" -t -A -c "select id from \"User\" where email='smoke@test.local'")
mint(){ SECRET="$SECRET" CLAIMS="$1" node -e 'const j=require("jsonwebtoken");console.log(j.sign(JSON.parse(process.env.CLAIMS),process.env.SECRET,{expiresIn:"5m"}))'; }
OLD_STATE=$(mint "$(js userId "$SUID")"); NEW_STATE=$(mint "$(js typ oauth-state userId "$SUID")")
want "old-style OAuth state is not a session"  "$(curl -s -o /dev/null -w '%{http_code}' -b "auth_token=$OLD_STATE" $B/api/admin/users)" 401
want "new OAuth state is not a session"        "$(curl -s -o /dev/null -w '%{http_code}' -b "auth_token=$NEW_STATE" $B/api/admin/users)" 401
claim(){ node -e 'const p=(process.argv[1]||"").split(".")[1]||"";try{console.log(JSON.parse(Buffer.from(p,"base64url"))[process.argv[2]])}catch{console.log("none")}' "$1" "$2"; }
[ "$(claim "$(awk '$6=="auth_token"{print $7}' $J/a | tail -1)" typ)" = session ] && ok "new sessions say they are sessions" || bad "new sessions say they are sessions" "no typ"

echo "── Google connect and callback"
loc(){ curl -s -o /dev/null -w '%{http_code} %{redirect_url}' "$@"; }
r=$(loc "$B/api/google/callback?code=x&state=primary");                       echo "    anonymous, bare label: $r"
[[ "$r" == 307*bad_state* ]] && ok "anonymous callback refused before Google is called" || bad "anonymous callback refused before Google is called" "$r"
STATE=$(mint "$(js typ oauth-state userId "$SUID" account primary)")
r=$(loc "$B/api/google/callback?code=x&state=$STATE");                         echo "    anonymous, valid state: $r"
[[ "$r" == 307*error=auth_failed* ]] && ok "valid state without its session refused" || bad "valid state without its session refused" "$r"
want "member cannot start a shared connect"   "$(curl -s -o /dev/null -w '%{http_code}' -b $J/m $B/api/google/connect?label=primary)" 403
want "unknown shared account refused"         "$(curl -s -o /dev/null -w '%{http_code}' -b $J/a "$B/api/google/connect?label=../../x")" 400
r=$(curl -s -o /dev/null -w '%{redirect_url}' -b $J/a "$B/api/google/connect?label=primary")
st=$(python3 -c 'import sys,urllib.parse as u;print(u.parse_qs(u.urlparse(sys.argv[1]).query).get("state",[""])[0])' "$r")
typ=$(node -e 'const p=process.argv[1].split(".")[1]||"";try{console.log(JSON.parse(Buffer.from(p,"base64url")).typ)}catch{console.log("none")}' "$st")
[[ "$r" == https://accounts.google.com/* ]] && [ "$typ" = "oauth-state" ] && ok "admin connect sends a signed, typed state to Google" || bad "admin connect sends a signed, typed state to Google" "${r:0:40} typ=$typ"

echo "── locking out guessing"
psql "$DB" -q -c "update \"User\" set \"failedLoginCount\"=0, \"lockedUntil\"=null where email='other@test.local';"
codes=""; for i in $(seq 1 9); do codes="$codes $(login other@test.local $J/g wrong-guess-$i)"; done
echo "    9 wrong guesses, each from a different address:$codes"
[ "$codes" = " 401 401 401 401 401 401 401 429 429" ] && ok "account locks after 8 wrong guesses" || bad "account locks after 8 wrong guesses" "$codes"
want "correct password refused while locked" "$(login other@test.local $J/g "$PW2")" 429

echo "── unknown addresses look the same"
t_known=$( { /usr/bin/time -p curl -s -o /dev/null -X POST $B/api/auth/login -H "X-Real-IP: $(ip)" -H 'Content-Type: application/json' -d '{"email":"smoke@test.local","password":"nope-nope-nope"}'; } 2>&1 | awk '/real/{print $2}')
t_unknown=$( { /usr/bin/time -p curl -s -o /dev/null -X POST $B/api/auth/login -H "X-Real-IP: $(ip)" -H 'Content-Type: application/json' -d '{"email":"nobody-at-all@test.local","password":"nope-nope-nope"}'; } 2>&1 | awk '/real/{print $2}')
echo "    known address ${t_known}s, unknown address ${t_unknown}s"
python3 -c "import sys; k,u=float('$t_known'),float('$t_unknown'); sys.exit(0 if u > 0.6*k else 1)" && ok "unknown address takes as long as a known one" || bad "unknown address takes as long as a known one" "$t_unknown vs $t_known"

echo "── per-address limit"
FIXED=$(ip); codes=""
for i in $(seq 1 7); do codes="$codes $(curl -s -o /dev/null -w '%{http_code}' -X POST $B/api/auth/login -H "X-Real-IP: $FIXED" -H "X-Forwarded-For: 203.0.113.$i" -H 'Content-Type: application/json' -d '{"email":"nobody@test.local","password":"x"}')"; done
echo "    7 attempts from one address, each claiming a different X-Forwarded-For:$codes"
[ "$codes" = " 401 401 401 401 401 429 429" ] && ok "spoofed X-Forwarded-For no longer resets the limit" || bad "spoofed X-Forwarded-For no longer resets the limit" "$codes"

echo
echo "$pass passed, $fail failed"
rm -rf "$J"
[ "$fail" = 0 ]
