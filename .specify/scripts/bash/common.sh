#!/usr/bin/env bash
# 全スクリプト共通の関数と変数

# .specify ディレクトリを上方向に探索してリポジトリルートを見つける
# これは spec-kit プロジェクトの主要なマーカーである
find_specify_root() {
    local dir="${1:-$(pwd)}"
    # 相対パスによる無限ループを防ぐため絶対パスに正規化する
    # - で始まるパス（例: -P, -L）を扱うために -- を使う
    dir="$(cd -- "$dir" 2>/dev/null && pwd)" || return 1
    local prev_dir=""
    while true; do
        if [ -d "$dir/.specify" ]; then
            echo "$dir"
            return 0
        fi
        # ファイルシステムのルートに達するか dirname が変化しなくなったら停止する
        if [ "$dir" = "/" ] || [ "$dir" = "$prev_dir" ]; then
            break
        fi
        prev_dir="$dir"
        dir="$(dirname "$dir")"
    done
    return 1
}

# .specify ディレクトリを優先してリポジトリルートを取得する
# spec-kit がサブディレクトリで初期化された場合に親リポジトリを使うのを防ぐ
get_repo_root() {
    # まず .specify ディレクトリ（spec-kit 自身のマーカー）を探す
    local specify_root
    if specify_root=$(find_specify_root); then
        echo "$specify_root"
        return
    fi

    # 最終的なフォールバックとしてスクリプトの場所を使う
    local script_dir="$(CDPATH="" cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    (cd "$script_dir/../../.." && pwd)
}

# 明示的に設定された状態のみから現在のフィーチャー名を取得する。
# フィーチャー識別子、または何も設定されていなければ空文字列を返す。
# フィーチャー状態は SPECIFY_FEATURE（create-new-feature や
# git 拡張から）、または暗黙的に .specify/feature.json で設定される。
get_current_branch() {
    if [[ -n "${SPECIFY_FEATURE:-}" ]]; then
        echo "$SPECIFY_FEATURE"
        return
    fi

    # 明示的なフィーチャーが未設定 — 呼び出し側が get_feature_paths() 内の
    # feature.json で処理する必要がある。「不明」を示すため空を返す。
    echo ""
}

# .specify/feature.json の "feature_directory" 値を安全に読み取る。
# 生の値（相対パスの場合あり）を stdout に出力する。ファイルが存在しない、
# パースできない、またはキーを含まない場合は空文字列を出力する。`set -e` 配下の
# 呼び出し側がパーサー失敗で中断されないよう、常に 0 を返す。
# パーサーの順序は従来の get_feature_paths の挙動に倣う: jq -> python3 -> grep/sed。
read_feature_json_feature_directory() {
    local repo_root="$1"
    local fj="$repo_root/.specify/feature.json"
    [[ -f "$fj" ]] || { printf '%s' ''; return 0; }

    local _fd=''
    if command -v jq >/dev/null 2>&1; then
        if ! _fd=$(jq -r '.feature_directory // empty' "$fj" 2>/dev/null); then
            _fd=''
        fi
    elif command -v python3 >/dev/null 2>&1; then
        # 整形済み/複数行の JSON でも正しくパースできるよう Python を使う。
        if ! _fd=$(python3 -c "import json,sys; d=json.load(open(sys.argv[1])); v=d.get('feature_directory'); print(v if v else '')" "$fj" 2>/dev/null); then
            _fd=''
        fi
    else
        # 最終手段としての単一行 grep/sed フォールバック。`|| true` は grep が
        # 1（マッチなし）を返したときに `set -e` / `pipefail` 配下で中断するのを防ぐ。
        _fd=$( { grep -E '"feature_directory"[[:space:]]*:' "$fj" 2>/dev/null || true; } \
            | head -n 1 \
            | sed -E 's/^[^:]*:[[:space:]]*"([^"]*)".*$/\1/' )
    fi

    printf '%s' "$_fd"
    return 0
}

# feature_directory 値を .specify/feature.json に永続化する。
# ファイルが存在しない、または値が保存済みと異なる場合のみ書き込む。
# 生の（相対の場合あり）パスを受け取る — 呼び出し側は正規化した絶対パスではなく、
# ユーザーが指定した元の値を渡すべきである。
_persist_feature_json() {
    local repo_root="$1"
    local feature_dir_value="$2"
    local fj="$repo_root/.specify/feature.json"

    # 値が絶対パスかつ repo_root 配下なら repo_root プレフィックスを除去する
    if [[ "$feature_dir_value" == "$repo_root/"* ]]; then
        feature_dir_value="${feature_dir_value#"$repo_root/"}"
    fi

    # 現在の値（あれば）を読み取り、変更がなければ書き込みをスキップする
    local current_val
    current_val=$(read_feature_json_feature_directory "$repo_root")
    if [[ "$current_val" == "$feature_dir_value" ]]; then
        return 0
    fi

    # .specify/ ディレクトリが存在することを保証する
    mkdir -p "$repo_root/.specify"

    # feature.json を書き込む — 安全な JSON のため jq を優先し、なければ printf にフォールバック
    if command -v jq >/dev/null 2>&1; then
        jq -cn --arg fd "$feature_dir_value" '{feature_directory:$fd}' > "$fj"
    else
        printf '{"feature_directory":"%s"}\n' "$(json_escape "$feature_dir_value")" > "$fj"
    fi
}

get_feature_paths() {
    local repo_root=$(get_repo_root)
    local current_branch=$(get_current_branch)

    # フィーチャーディレクトリを解決する。優先順位:
    #   1. SPECIFY_FEATURE_DIRECTORY 環境変数（明示的なオーバーライド）
    #   2. .specify/feature.json の "feature_directory" キー（specify コマンドが永続化）
    #   3. エラー — 利用可能なフィーチャーコンテキストがない
    local feature_dir
    if [[ -n "${SPECIFY_FEATURE_DIRECTORY:-}" ]]; then
        feature_dir="$SPECIFY_FEATURE_DIRECTORY"
        # 相対パスをリポジトリルート配下の絶対パスに正規化する
        [[ "$feature_dir" != /* ]] && feature_dir="$repo_root/$feature_dir"
        # 環境変数なしの今後のセッションでも動くよう feature.json に永続化する
        _persist_feature_json "$repo_root" "$SPECIFY_FEATURE_DIRECTORY"
    elif [[ -f "$repo_root/.specify/feature.json" ]]; then
        local _fd
        _fd=$(read_feature_json_feature_directory "$repo_root")
        if [[ -n "$_fd" ]]; then
            feature_dir="$_fd"
            # 相対パスをリポジトリルート配下の絶対パスに正規化する
            [[ "$feature_dir" != /* ]] && feature_dir="$repo_root/$feature_dir"
        else
            echo "ERROR: Feature directory not found. Set SPECIFY_FEATURE_DIRECTORY or ensure .specify/feature.json contains feature_directory." >&2
            return 1
        fi
    else
        echo "ERROR: Feature directory not found. Set SPECIFY_FEATURE_DIRECTORY or run the specify command to create .specify/feature.json." >&2
        return 1
    fi

    # printf '%q' で値を安全にクオートし、細工されたブランチ名や特殊文字を含む
    # パスによるシェルインジェクションを防ぐ
    printf 'REPO_ROOT=%q\n' "$repo_root"
    printf 'CURRENT_BRANCH=%q\n' "$current_branch"
    printf 'FEATURE_DIR=%q\n' "$feature_dir"
    printf 'FEATURE_SPEC=%q\n' "$feature_dir/spec.md"
    printf 'IMPL_PLAN=%q\n' "$feature_dir/plan.md"
    printf 'TASKS=%q\n' "$feature_dir/tasks.md"
    printf 'RESEARCH=%q\n' "$feature_dir/research.md"
    printf 'DATA_MODEL=%q\n' "$feature_dir/data-model.md"
    printf 'QUICKSTART=%q\n' "$feature_dir/quickstart.md"
    printf 'CONTRACTS_DIR=%q\n' "$feature_dir/contracts"
}

# 安全な JSON 構築のために jq が利用可能か確認する
has_jq() {
    command -v jq >/dev/null 2>&1
}

get_invoke_separator() {
    local repo_root="${1:-$(get_repo_root)}"
    if [[ "${_SPECIFY_INVOKE_SEPARATOR_CACHE_REPO_ROOT:-}" == "$repo_root" && -n "${_SPECIFY_INVOKE_SEPARATOR_CACHE_VALUE:-}" ]]; then
        printf '%s\n' "$_SPECIFY_INVOKE_SEPARATOR_CACHE_VALUE"
        return 0
    fi

    local integration_json="$repo_root/.specify/integration.json"
    local separator="."
    local parsed_with_jq=0

    if [[ -f "$integration_json" ]]; then
        if command -v jq >/dev/null 2>&1; then
            local jq_separator
            if jq_separator=$(jq -r '(.default_integration // .integration // "") as $k | if $k == "" then "." else (.integration_settings[$k].invoke_separator // ".") end' "$integration_json" 2>/dev/null); then
                parsed_with_jq=1
                case "$jq_separator" in
                    "."|"-") separator="$jq_separator" ;;
                esac
            fi
        fi

        if [[ "$parsed_with_jq" -eq 0 ]] && command -v python3 >/dev/null 2>&1; then
            if separator=$(python3 - "$integration_json" <<'PY' 2>/dev/null
import json
import sys

try:
    with open(sys.argv[1], encoding="utf-8") as fh:
        state = json.load(fh)
    key = state.get("default_integration") or state.get("integration") or ""
    settings = state.get("integration_settings")
    separator = "."
    if isinstance(key, str) and isinstance(settings, dict):
        entry = settings.get(key)
        if isinstance(entry, dict) and entry.get("invoke_separator") in {".", "-"}:
            separator = entry["invoke_separator"]
    print(separator)
except Exception:
    print(".")
PY
); then
                case "$separator" in
                    "."|"-") ;;
                    *) separator="." ;;
                esac
            else
                separator="."
            fi
        fi
    fi

    _SPECIFY_INVOKE_SEPARATOR_CACHE_REPO_ROOT="$repo_root"
    _SPECIFY_INVOKE_SEPARATOR_CACHE_VALUE="$separator"
    printf '%s\n' "$separator"
}

format_speckit_command() {
    local command_name="$1"
    local repo_root="${2:-$(get_repo_root)}"
    local separator
    if [[ "${_SPECIFY_INVOKE_SEPARATOR_CACHE_REPO_ROOT:-}" == "$repo_root" && -n "${_SPECIFY_INVOKE_SEPARATOR_CACHE_VALUE:-}" ]]; then
        separator="$_SPECIFY_INVOKE_SEPARATOR_CACHE_VALUE"
    else
        separator=$(get_invoke_separator "$repo_root")
        _SPECIFY_INVOKE_SEPARATOR_CACHE_REPO_ROOT="$repo_root"
        _SPECIFY_INVOKE_SEPARATOR_CACHE_VALUE="$separator"
    fi

    command_name="${command_name#/}"
    command_name="${command_name#speckit.}"
    command_name="${command_name#speckit-}"
    command_name="${command_name//./$separator}"

    printf '/speckit%s%s\n' "$separator" "$command_name"
}

# 文字列を JSON 値に安全に埋め込めるようエスケープする（jq が使えないときのフォールバック）。
# バックスラッシュ、ダブルクオート、および JSON で必須の制御文字エスケープ（RFC 8259）を処理する。
json_escape() {
    local s="$1"
    s="${s//\\/\\\\}"
    s="${s//\"/\\\"}"
    s="${s//$'\n'/\\n}"
    s="${s//$'\t'/\\t}"
    s="${s//$'\r'/\\r}"
    s="${s//$'\b'/\\b}"
    s="${s//$'\f'/\\f}"
    # 残った U+0001-U+001F の制御文字を \uXXXX としてエスケープする。
    # （U+0000/NUL は bash 文字列に現れないため除外している。）
    # LC_ALL=C により ${#s} はバイト数を数え ${s:$i:1} は単一バイトを返すので、
    # マルチバイト UTF-8 シーケンス（先頭バイト >= 0xC0）はそのまま通過する。
    local LC_ALL=C
    local i char code
    for (( i=0; i<${#s}; i++ )); do
        char="${s:$i:1}"
        printf -v code '%d' "'$char" 2>/dev/null || code=256
        if (( code >= 1 && code <= 31 )); then
            printf '\\u%04x' "$code"
        else
            printf '%s' "$char"
        fi
    done
}

check_file() { [[ -f "$1" ]] && echo "  ✓ $2" || echo "  ✗ $2"; }
check_dir() { [[ -d "$1" && -n $(ls -A "$1" 2>/dev/null) ]] && echo "  ✓ $2" || echo "  ✗ $2"; }

# 優先順位スタックを使ってテンプレート名をファイルパスに解決する:
#   1. .specify/templates/overrides/
#   2. .specify/presets/<preset-id>/templates/ (.registry の優先度でソート)
#   3. .specify/extensions/<ext-id>/templates/
#   4. .specify/templates/ (コア)
resolve_template() {
    local template_name="$1"
    local repo_root="$2"
    local base="$repo_root/.specify/templates"

    # 優先順位 1: プロジェクトのオーバーライド
    local override="$base/overrides/${template_name}.md"
    [ -f "$override" ] && echo "$override" && return 0

    # 優先順位 2: インストール済みのプリセット（.registry の優先度でソート）
    local presets_dir="$repo_root/.specify/presets"
    if [ -d "$presets_dir" ]; then
        local registry_file="$presets_dir/.registry"
        if [ -f "$registry_file" ] && command -v python3 >/dev/null 2>&1; then
            # プリセット ID を優先度順（数値が小さいほど優先度が高い）で読み取る。
            # python3 が非ゼロで終了（例: 不正な JSON）したときに set -e が関数を
            # 中断しないよう、python3 の呼び出しを if 条件で包んでいる。
            local sorted_presets=""
            if sorted_presets=$(SPECKIT_REGISTRY="$registry_file" python3 -c "
import json, sys, os
try:
    with open(os.environ['SPECKIT_REGISTRY']) as f:
        data = json.load(f)
    presets = data.get('presets', {})
    for pid, meta in sorted(presets.items(), key=lambda x: x[1].get('priority', 10) if isinstance(x[1], dict) else 10):
        if isinstance(meta, dict) and meta.get('enabled', True) is not False:
            print(pid)
except Exception:
    sys.exit(1)
" 2>/dev/null); then
                if [ -n "$sorted_presets" ]; then
                    # python3 が成功しプリセット ID を返した — 優先順位順に探索する
                    while IFS= read -r preset_id; do
                        local candidate="$presets_dir/$preset_id/templates/${template_name}.md"
                        [ -f "$candidate" ] && echo "$candidate" && return 0
                    done <<< "$sorted_presets"
                fi
                # python3 は成功したが registry にプリセットがない — 探索対象なし
            else
                # python3 が失敗（不在、または registry のパースエラー）— 順序なしのディレクトリ走査にフォールバック
                for preset in "$presets_dir"/*/; do
                    [ -d "$preset" ] || continue
                    local candidate="$preset/templates/${template_name}.md"
                    [ -f "$candidate" ] && echo "$candidate" && return 0
                done
            fi
        else
            # フォールバック: アルファベット順のディレクトリ順（python3 が利用不可）
            for preset in "$presets_dir"/*/; do
                [ -d "$preset" ] || continue
                local candidate="$preset/templates/${template_name}.md"
                [ -f "$candidate" ] && echo "$candidate" && return 0
            done
        fi
    fi

    # 優先順位 3: 拡張が提供するテンプレート
    local ext_dir="$repo_root/.specify/extensions"
    if [ -d "$ext_dir" ]; then
        for ext in "$ext_dir"/*/; do
            [ -d "$ext" ] || continue
            # 隠しディレクトリ（例: .backup, .cache）はスキップする
            case "$(basename "$ext")" in .*) continue;; esac
            local candidate="$ext/templates/${template_name}.md"
            [ -f "$candidate" ] && echo "$candidate" && return 0
        done
    fi

    # 優先順位 4: コアテンプレート
    local core="$base/${template_name}.md"
    [ -f "$core" ] && echo "$core" && return 0

    # テンプレートがどの場所にも見つからなかった。
    # 呼び出し側が「見つからない」と「見つかった」を区別できるよう 1 を返す。
    # set -e 配下で実行する呼び出し側は次のようにすべき: TEMPLATE=$(resolve_template ...) || true
    return 1
}

# 合成ストラテジーを使ってテンプレート名を合成済みコンテンツに解決する。
# プリセットのマニフェストからストラテジーのメタデータを読み取り、
# prepend, append, wrap のストラテジーで複数レイヤーからコンテンツを合成する。
#
# 使い方: CONTENT=$(resolve_template_content "template-name" "$REPO_ROOT")
# 合成済みコンテンツ文字列を stdout に返す。見つからない場合は終了コード 1。
resolve_template_content() {
    local template_name="$1"
    local repo_root="$2"
    local base="$repo_root/.specify/templates"

    # 全レイヤーを収集する（優先度の高いものから先に）
    local -a layer_paths=()
    local -a layer_strategies=()

    # 優先順位 1: プロジェクトのオーバーライド（常に "replace"）
    local override="$base/overrides/${template_name}.md"
    if [ -f "$override" ]; then
        layer_paths+=("$override")
        layer_strategies+=("replace")
    fi

    # 優先順位 2: インストール済みのプリセット（.registry の優先度でソート）
    local presets_dir="$repo_root/.specify/presets"
    if [ -d "$presets_dir" ]; then
        local registry_file="$presets_dir/.registry"
        local sorted_presets=""
        if [ -f "$registry_file" ] && command -v python3 >/dev/null 2>&1; then
            if sorted_presets=$(SPECKIT_REGISTRY="$registry_file" python3 -c "
import json, sys, os
try:
    with open(os.environ['SPECKIT_REGISTRY']) as f:
        data = json.load(f)
    presets = data.get('presets', {})
    for pid, meta in sorted(presets.items(), key=lambda x: x[1].get('priority', 10) if isinstance(x[1], dict) else 10):
        if isinstance(meta, dict) and meta.get('enabled', True) is not False:
            print(pid)
except Exception:
    sys.exit(1)
" 2>/dev/null); then
                if [ -n "$sorted_presets" ]; then
                    local yaml_warned=false
                    while IFS= read -r preset_id; do
                        # プリセットマニフェストからストラテジーとファイルパスを読み取る
                        local strategy="replace"
                        local manifest_file=""
                        local manifest="$presets_dir/$preset_id/preset.yml"
                        if [ -f "$manifest" ] && command -v python3 >/dev/null 2>&1; then
                            # PyYAML が必要; 利用できない場合は replace/規約にフォールバックする
                            local result
                            local py_stderr
                            py_stderr=$(mktemp)
                            result=$(SPECKIT_MANIFEST="$manifest" SPECKIT_TMPL="$template_name" python3 -c "
import sys, os
try:
    import yaml
except ImportError:
    print('yaml_missing', file=sys.stderr)
    print('replace\t')
    sys.exit(0)
try:
    with open(os.environ['SPECKIT_MANIFEST']) as f:
        data = yaml.safe_load(f)
    for t in data.get('provides', {}).get('templates', []):
        if t.get('name') == os.environ['SPECKIT_TMPL'] and t.get('type', 'template') == 'template':
            print(t.get('strategy', 'replace') + '\t' + t.get('file', ''))
            sys.exit(0)
    print('replace\t')
except Exception:
    print('replace\t')
" 2>"$py_stderr")
                            local parse_status=$?
                            if [ $parse_status -eq 0 ] && [ -n "$result" ]; then
                                IFS=$'\t' read -r strategy manifest_file <<< "$result"
                                strategy=$(printf '%s' "$strategy" | tr '[:upper:]' '[:lower:]')
                            fi
                            if [ "$yaml_warned" = false ] && grep -q 'yaml_missing' "$py_stderr" 2>/dev/null; then
                                echo "Warning: PyYAML not available; composition strategies may be ignored" >&2
                                yaml_warned=true
                            fi
                            rm -f "$py_stderr"
                        fi
                        # まずマニフェストのファイルパスを試し、次に規約上のパスを試す
                        local candidate=""
                        if [ -n "$manifest_file" ]; then
                            # 絶対パスと親ディレクトリへのトラバーサルを拒否する
                            case "$manifest_file" in
                                /*|*../*|../*) manifest_file="" ;;
                            esac
                        fi
                        if [ -n "$manifest_file" ]; then
                            local mf="$presets_dir/$preset_id/$manifest_file"
                            [ -f "$mf" ] && candidate="$mf"
                        fi
                        if [ -z "$candidate" ]; then
                            local cf="$presets_dir/$preset_id/templates/${template_name}.md"
                            [ -f "$cf" ] && candidate="$cf"
                        fi
                        if [ -n "$candidate" ]; then
                            layer_paths+=("$candidate")
                            layer_strategies+=("$strategy")
                        fi
                    done <<< "$sorted_presets"
                fi
            else
                # python3 が失敗 — 順序なしのディレクトリ走査にフォールバック（replace のみ）
                for preset in "$presets_dir"/*/; do
                    [ -d "$preset" ] || continue
                    local candidate="$preset/templates/${template_name}.md"
                    if [ -f "$candidate" ]; then
                        layer_paths+=("$candidate")
                        layer_strategies+=("replace")
                    fi
                done
            fi
        else
            # python3 も registry もない — 順序なしのディレクトリ走査にフォールバック（replace のみ）
            for preset in "$presets_dir"/*/; do
                [ -d "$preset" ] || continue
                local candidate="$preset/templates/${template_name}.md"
                if [ -f "$candidate" ]; then
                    layer_paths+=("$candidate")
                    layer_strategies+=("replace")
                fi
            done
        fi
    fi

    # 優先順位 3: 拡張が提供するテンプレート（常に "replace"）
    local ext_dir="$repo_root/.specify/extensions"
    if [ -d "$ext_dir" ]; then
        for ext in "$ext_dir"/*/; do
            [ -d "$ext" ] || continue
            case "$(basename "$ext")" in .*) continue;; esac
            local candidate="$ext/templates/${template_name}.md"
            if [ -f "$candidate" ]; then
                layer_paths+=("$candidate")
                layer_strategies+=("replace")
            fi
        done
    fi

    # 優先順位 4: コアテンプレート（常に "replace"）
    local core="$base/${template_name}.md"
    if [ -f "$core" ]; then
        layer_paths+=("$core")
        layer_strategies+=("replace")
    fi

    local count=${#layer_paths[@]}
    [ "$count" -eq 0 ] && return 1

    # いずれかのレイヤーが replace 以外のストラテジーを使うか確認する
    local has_composition=false
    for s in "${layer_strategies[@]}"; do
        [ "$s" != "replace" ] && has_composition=true && break
    done

    # 最上位（最高優先度）のレイヤーが replace なら、それが完全に勝つ —
    # 下位レイヤーはそのストラテジーに関わらず無関係になる。
    if [ "${layer_strategies[0]}" = "replace" ]; then
        cat "${layer_paths[0]}"
        return 0
    fi

    if [ "$has_composition" = false ]; then
        cat "${layer_paths[0]}"
        return 0
    fi

    # 実効ベースを探す: 最高優先度（インデックス 0）から下方向に走査し、
    # 最も近い replace レイヤーを見つける。そのベースより上のレイヤーのみを合成する。
    local base_idx=-1
    local i
    for (( i=0; i<count; i++ )); do
        if [ "${layer_strategies[$i]}" = "replace" ]; then
            base_idx=$i
            break
        fi
    done

    if [ $base_idx -lt 0 ]; then
        return 1  # ベースレイヤーが見つからない
    fi

    # ベースのコンテンツを読み取り、ベースより上（高優先度）のレイヤーを合成する
    local content
    content=$(cat "${layer_paths[$base_idx]}"; printf x)
    content="${content%x}"

    for (( i=base_idx-1; i>=0; i-- )); do
        local path="${layer_paths[$i]}"
        local strat="${layer_strategies[$i]}"
        local layer_content
        # 末尾の改行を保持する
        layer_content=$(cat "$path"; printf x)
        layer_content="${layer_content%x}"

        case "$strat" in
            replace) content="$layer_content" ;;
            prepend) content="$(printf '%s\n\n%s' "$layer_content" "$content")" ;;
            append)  content="$(printf '%s\n\n%s' "$content" "$layer_content")" ;;
            wrap)
                case "$layer_content" in
                    *'{CORE_TEMPLATE}'*) ;;
                    *) echo "Error: wrap strategy missing {CORE_TEMPLATE} placeholder" >&2; return 1 ;;
                esac
                while [[ "$layer_content" == *'{CORE_TEMPLATE}'* ]]; do
                    local before="${layer_content%%\{CORE_TEMPLATE\}*}"
                    local after="${layer_content#*\{CORE_TEMPLATE\}}"
                    layer_content="${before}${content}${after}"
                done
                content="$layer_content"
                ;;
            *) echo "Error: unknown strategy '$strat'" >&2; return 1 ;;
        esac
    done

    printf '%s' "$content"
    return 0
}
