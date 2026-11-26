#!/usr/bin/env bash
# Tools of the task-batch skill; launchers such as nightly-claude use them too. Runs with the bash 3.2 of macOS.
#
#   task-batch.sh config                            the configuration, after checking NOTION_API_TOKEN and NOTION_USER_ID
#   task-batch.sh tracker DIR                       reads the Tasks Tracker into DIR/candidates.json and DIR/in-progress.json;
#                                                   1 if no task is eligible, 2 if ntn fails
#   task-batch.sh batch DIR ID...                   the longest prefix of the IDs that keeps the rules of the batch
#   task-batch.sh reviewers [AGENT...]              the agents that can review (claude, codex, agy): models, efforts, usage
#   task-batch.sh check-reviewer AGENT MODEL EFFORT 1 and why, if AGENT cannot review with MODEL at EFFORT
#   task-batch.sh review AGENT MODEL EFFORT WORKTREE PROMPT OUT
#                                                   starts a reviewer outside the session, in the background
#   task-batch.sh review-wait OUT                   its verdict {clean, issues}; 3 and "running" if it is still at work
#                                                   after REVIEW_WAIT seconds, 1 if it failed
set -uo pipefail

BATCH_POINTS=${BATCH_POINTS:-5}   # the most story points (Effort) in a batch, that is in a pull request
MAX_TASKS=${MAX_TASKS:-3}         # the most tasks in a batch
REVIEW_ROUNDS=${REVIEW_ROUNDS:-3} # the most review rounds; 0: no review
REVIEW_WAIT=${REVIEW_WAIT:-540}   # seconds review-wait waits: a foreground command of Claude Code lasts 10 minutes at most
# The main checkout of the repository, even from one of its worktrees
REPO=${GOTION_REPO:-$(git rev-parse --path-format=absolute --git-common-dir 2>/dev/null)}
REPO=${REPO%/.git}
TRACKER=30cf720c-4b16-8292-af30-07ac9991dc17
SCHEMA=$(cd "$(dirname "$0")" && pwd -P)/review-schema.json
EFFORTS='low medium high xhigh max ultra' # every effort, in order

need() { [[ -n ${!1:-} ]] || { echo "missing $1: export it in your shell profile (Prerequisites in SKILL.md)" >&2; exit 1; }; }

# Rows of the tracker → the Not started Vibecodabile tasks that are free or assigned to $me, in timeline order (Due
# date, then Priority), with the titles of the blockers not yet Done.
read -r -d '' CANDIDATES_JQ <<'EOF'
def title: .properties["Task name"].title | map(.plain_text) | join("");
(map({key: .id, value: {s: .properties.Status.status.name, t: title}}) | from_entries) as $all
| [ .[]
    | select(.properties.Status.status.name == "Not started" and .properties.Vibecodabile.checkbox)
    | select((.properties.Assignee.people | length) == 0 or any(.properties.Assignee.people[]; .id == $me))
    | { id, url, title: title,
        due: .properties["Due date"].date.start,
        priority: .properties.Priority.select.name,
        estimate: .properties.Effort.number,
        target: .properties.Target.select.name,
        open_blockers: [ .properties["Blocked by"].relation[].id
                         | select($all[.].s != "Done") | ($all[.].t // "(task not visible: \(.))") ],
        truncated: .properties["Blocked by"].has_more }
    | .eligible = (.open_blockers == [] and (.truncated | not)) | del(.truncated) ]
| sort_by(.due // "9999-12-31", ({"High": 0, "Medium": 1, "Low": 2}[.priority // ""] // 3))
EOF

# Selection → its longest prefix that keeps the rules of the batch: the Target of the first task, at most $max points
# of Effort and $maxn tasks. The first task always stays; one without Effort or Target goes alone.
read -r -d '' BATCH_JQ <<'EOF'
($c[0] | map({key: .id, value: .}) | from_entries) as $by
| reduce .[] as $id ({tasks: [], points: null, target: null, closed: false};
    $by[$id] as $x
    | if .closed then .
      elif .tasks == [] then .tasks = [$id] | .points = $x.estimate | .target = (if $x.estimate then $x.target else null end)
      elif .target != null and $x.target == .target and $x.estimate != null and .points + $x.estimate <= $max
           and (.tasks | length) < $maxn
        then .tasks += [$id] | .points += $x.estimate
      else .closed = true end)
| {tasks, points}
EOF

tracker() {
  local dir=$1 cursor="" page=$1/page.json n m
  need NOTION_API_TOKEN; need NOTION_USER_ID; export NOTION_API_TOKEN
  : >"$dir/tracker.jsonl"
  while :; do
    ntn datasources query "$TRACKER" --limit 100 ${cursor:+--start-cursor "$cursor"} --json </dev/null >"$page" \
      || { echo "reading the tracker with ntn failed"; return 2; }
    cat "$page" >>"$dir/tracker.jsonl"
    [[ $(jq -r .has_more "$page") == true ]] || break
    cursor=$(jq -r .next_cursor "$page")
  done
  jq -s '[.[].results[]]' "$dir/tracker.jsonl" | jq --arg me "$NOTION_USER_ID" "$CANDIDATES_JQ" >"$dir/candidates.json"
  jq -s -c '[.[].results[] | select(.properties.Status.status.name == "In progress")
    | {id, title: (.properties["Task name"].title | map(.plain_text) | join("")), assignees: [.properties.Assignee.people[].id]}]' \
    "$dir/tracker.jsonl" >"$dir/in-progress.json"
  read -r n m < <(jq -r '[.[] | select(.eligible)] | "\(length) \(map(select(.estimate == null)) | length)"' "$dir/candidates.json")
  echo "tracker: $(jq length "$dir/candidates.json") tasks flagged and free, $n eligible ($m without Effort)"
  (( n > 0 )) && return 0
  echo "no eligible task. Open blockers of the first 10 tasks of the timeline:"
  jq -r '[.[0:10][].open_blockers[]] | group_by(.) | sort_by(-length) | .[] | "  \(length)× \(.[0])"' "$dir/candidates.json"
  return 1
}

batch() {
  local dir=$1 bad; shift
  bad=$(jq -nr --slurpfile c "$dir/candidates.json" '[$c[0][].id] as $ok | $ARGS.positional[] | select(IN($ok[]) | not)' --args "$@")
  [[ -z $bad ]] || { echo "not among the candidates: $bad" >&2; return 1; }
  jq -nc '$ARGS.positional' --args "$@" \
    | jq -c --slurpfile c "$dir/candidates.json" --argjson max "$BATCH_POINTS" --argjson maxn "$MAX_TASKS" "$BATCH_JQ"
}

# Claude is logged in if a minimal call to Haiku succeeds; the call also reports the usage of the subscription.
claude_entry() {
  command -v claude >/dev/null || return 0
  local d; d=$(mktemp -d)
  (cd "$d" && claude -p --model haiku --strict-mcp-config --output-format stream-json --verbose "Reply only: ok" >probe.jsonl 2>/dev/null)
  jq -Rn --arg efforts 'low medium high xhigh max' '[inputs | fromjson?] as $e
    | if any($e[]; .type == "result" and .subtype == "success" and (.is_error | not)) | not then empty else
      ($e | map(select(.type == "rate_limit_event")) | last | .rate_limit_info.unifiedWindows // {}) as $w
      | { provider: "claude",
          usage: (if $w.five_hour then {five_hour: ($w.five_hour.utilization * 100 | floor),
                    seven_day: (($w.seven_day.utilization // 0) * 100 | floor), resets_at: $w.five_hour.resetsAt,
                    status: $w.five_hour.status, as_of: null} else null end),
          models: [{id: "opus", name: "Opus 5.5"}, {id: "sonnet", name: "Sonnet 5.5"}] | map(. + {efforts: ($efforts | split(" "))}),
          suggested: {model: "opus", effort: "xhigh"} } end' "$d/probe.jsonl"
  rm -rf "$d"
}

# Codex keeps its models in models_cache.json and the usage of each session in the session's log; the newest log of the
# last week that recorded the usage gives it, with its time.
codex_entry() {
  command -v codex >/dev/null && codex login status >/dev/null 2>&1 || return 0
  local home=${CODEX_HOME:-$HOME/.codex} f usage=null
  while IFS= read -r f; do
    usage=$(grep '"rate_limits"' "$f" | tail -n 1 | jq -c '.timestamp as $t | .payload.rate_limits
      | [.primary, .secondary] | map(select(. != null)) as $w
      | def win(m): ($w | map(select(.window_minutes == m))[0]) // {};
        def pct: if . == null then null else floor end;
        {five_hour: (win(300).used_percent | pct), seven_day: (win(10080).used_percent | pct),
         resets_at: win(300).resets_at, status: null, as_of: $t}') && break
    usage=null
  done < <(find "$home/sessions" -name '*.jsonl' -mtime -7 -exec ls -t {} + 2>/dev/null)
  jq -c --argjson usage "$usage" '(.models // .) as $all
    | [["gpt-6.2-sol", "gpt-6.2-astra"][] as $s | $all[] | select(.slug == $s)
       | {id: .slug, name: .display_name, efforts: [.supported_reasoning_levels[] | .effort // .]}] as $models
    | if $models == [] then empty
      else {provider: "codex", usage: $usage, models: $models, suggested: {model: "gpt-6.2-sol", effort: "high"}} end' \
    "$home/models_cache.json" 2>/dev/null
}

# agy lists its models with the effort in the ID, as gemini-4-neon-high; it reports no usage.
agy_entry() {
  command -v agy >/dev/null || return 0
  local list; list=$(agy models 2>/dev/null) || return 0
  printf '%s\n' "$list" | jq -Rn --arg efforts "$EFFORTS" '($efforts | split(" ")) as $order
    | [inputs | split("\t") | select(length == 2)] as $rows
    | [ ["gemini-4-neon", "gemini-4-carbon"][] as $m
        | [$order[] as $e | select(any($rows[]; .[0] == "\($m)-\($e)")) | $e] as $efforts
        | select($efforts != [])
        | {id: $m, name: ($rows | map(select(.[0] | startswith("\($m)-")))[0][1] | sub(" \\([^)]*\\)$"; "")), efforts: $efforts} ]
    | if . == [] then empty
      else {provider: "agy", usage: null, models: ., suggested: {model: "gemini-4-neon", effort: "high"}} end'
}

reviewers() {
  local a
  (( $# )) || set -- claude codex agy
  for a in "$@"; do
    case $a in
      claude) claude_entry ;; codex) codex_entry ;; agy) agy_entry ;;
      *) echo "unknown agent: $a (claude, codex or agy)" >&2; return 2 ;;
    esac
  done | jq -sc .
}

check_reviewer() {
  local list why
  list=$(reviewers "$1") || return 2
  why=$(jq -r --arg a "$1" --arg m "$2" --arg e "$3" '(.[0] // null) as $x
    | if $x == null then "\($a) is not installed or not logged in"
      else ($x.models | map(select(.id == $m))[0]) as $model
      | if $model == null then "\($a) has no model \($m): \($x.models | map(.id) | join(", "))"
        elif ($model.efforts | any(. == $e)) | not then "\($m) has no effort \($e): \($model.efforts | join(", "))"
        else empty end end' <<<"$list")
  [[ -z $why ]] || { echo "$why" >&2; return 1; }
}

# The reviewer runs detached from the caller and writes into OUT: result.json with {clean, issues}, its log, and exit
# with its status once it ends. Codex and agy get the instructions of the reviewer agent at the top of the prompt;
# Claude loads the agent itself.
review() {
  local agent=$1 model=$2 effort=$3 wt=$4 prompt=$5 out=$6 rules
  case $agent in claude | codex | agy) ;; *) echo "unknown agent: $agent (claude, codex or agy)" >&2; return 2 ;; esac
  mkdir -p "$out" && rm -f "$out/exit" "$out/result.json"
  rules=$(awk 'f > 1; /^---$/ { f++ }' "$wt/.claude/agents/reviewer.md") # the body, after the front matter
  (
    cd "$wt" || exit 1
    case $agent in
      codex)
        { printf '%s\n\n' "$rules"; cat "$prompt"; } \
          | codex exec -C "$wt" -s read-only -m "$model" -c "model_reasoning_effort=\"$effort\"" \
            --output-schema "$SCHEMA" -o "$out/last.json" >"$out/log" 2>&1 \
          && cp "$out/last.json" "$out/result.json" ;;
      agy)
        agy --model "$model-$effort" --mode plan --output-format json --json-schema "$SCHEMA" \
          -p "$rules"$'\n\n'"$(cat "$prompt")" >"$out/raw.json" 2>"$out/log" \
          && jq -e .structured_output "$out/raw.json" >"$out/result.json" ;;
      claude)
        claude -p --agent reviewer --model "$model" --effort "$effort" --permission-mode auto --output-format json \
          --json-schema "$(cat "$SCHEMA")" <"$prompt" >"$out/raw.json" 2>"$out/log" \
          && jq -e .structured_output "$out/raw.json" >"$out/result.json" ;;
    esac
    echo $? >"$out/exit"
  ) </dev/null >/dev/null 2>&1 &
}

review_wait() {
  local out=$1 waited=0
  while [[ ! -f $out/exit ]] && (( waited < REVIEW_WAIT )); do sleep 1; waited=$((waited + 1)); done
  [[ -f $out/exit ]] || { echo running; return 3; }
  if [[ $(cat "$out/exit") == 0 && -s $out/result.json ]]; then
    jq -c . "$out/result.json"
  else
    echo "the reviewer failed:" >&2
    tail -n 20 "$out/log" >&2
    return 1
  fi
}

case ${1:-} in
  config)
    need NOTION_API_TOKEN; need NOTION_USER_ID
    printf '%s\n' "NOTION_USER_ID=$NOTION_USER_ID" "GOTION_REPO=$REPO" "BATCH_POINTS=$BATCH_POINTS" \
      "MAX_TASKS=$MAX_TASKS" "REVIEW_ROUNDS=$REVIEW_ROUNDS" ;;
  tracker) tracker "${2:?the folder}" ;;
  batch) shift; batch "$@" ;;
  reviewers) shift; reviewers "$@" ;;
  check-reviewer) check_reviewer "${2:?the agent}" "${3:?the model}" "${4:?the effort}" ;;
  review) review "${2:?the agent}" "${3:?the model}" "${4:?the effort}" "${5:?the worktree}" "${6:?the prompt}" "${7:?the output folder}" ;;
  review-wait) review_wait "${2:?the output folder}" ;;
  *) sed -n '3,13s/^# \{0,1\}//p' "$0" >&2; exit 2 ;;
esac
