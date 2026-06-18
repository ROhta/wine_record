#!/usr/bin/env bash

set -e

# コマンドライン引数を解析する
JSON_MODE=false

for arg in "$@"; do
    case "$arg" in
        --json) JSON_MODE=true ;;
        --help|-h)
            echo "使い方: $0 [--json]"
            echo "  --json    結果を JSON 形式で出力する"
            echo "  --help    このヘルプメッセージを表示する"
            exit 0
            ;;
        *) echo "エラー: 不明なオプション '$arg' です" >&2; exit 1 ;;
    esac
done

# 共通関数を読み込む
SCRIPT_DIR="$(CDPATH="" cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

# フィーチャーのパスを取得する
_paths_output=$(get_feature_paths) || { echo "エラー: フィーチャーのパスを解決できませんでした" >&2; exit 1; }
eval "$_paths_output"
unset _paths_output

# 必須のファイルを検証する
if [[ ! -f "$IMPL_PLAN" ]]; then
    echo "エラー: $FEATURE_DIR に plan.md が見つかりません" >&2
    echo "まず /speckit-plan を実行して実装プランを作成してください。" >&2
    exit 1
fi

if [[ ! -f "$FEATURE_SPEC" ]]; then
    echo "エラー: $FEATURE_DIR に spec.md が見つかりません" >&2
    echo "まず /speckit-specify を実行してフィーチャー構造を作成してください。" >&2
    exit 1
fi

# 利用可能なドキュメントのリストを構築する
docs=()
[[ -f "$RESEARCH" ]] && docs+=("research.md")
[[ -f "$DATA_MODEL" ]] && docs+=("data-model.md")
if [[ -d "$CONTRACTS_DIR" ]] && [[ -n "$(ls -A "$CONTRACTS_DIR" 2>/dev/null)" ]]; then
    docs+=("contracts/")
fi
[[ -f "$QUICKSTART" ]] && docs+=("quickstart.md")

# オーバーライドスタックを通じて tasks テンプレートを解決する
TASKS_TEMPLATE=$(resolve_template "tasks-template" "$REPO_ROOT") || true
if [[ -z "$TASKS_TEMPLATE" ]] || [[ ! -f "$TASKS_TEMPLATE" ]]; then
    echo "エラー: $REPO_ROOT のテンプレートオーバーライドスタックから必須の tasks-template を解決できませんでした" >&2
    echo "テンプレート 'tasks-template' は、サポートされているどの場所（overrides、presets、extensions、または共有コア）にも見つかりませんでした。.specify/templates/overrides/tasks-template.md にオーバーライドを追加するか、'specify init' を実行 / 共有インフラを再インストールしてコアの .specify/templates/tasks-template.md テンプレートを復元してください。" >&2
    exit 1
fi

# 結果を出力する
if $JSON_MODE; then
    if has_jq; then
        if [[ ${#docs[@]} -eq 0 ]]; then
            json_docs="[]"
        else
            json_docs=$(printf '%s\n' "${docs[@]}" | jq -R . | jq -s .)
        fi
        jq -cn \
            --arg feature_dir "$FEATURE_DIR" \
            --argjson docs "$json_docs" \
            --arg tasks_template "${TASKS_TEMPLATE:-}" \
            '{FEATURE_DIR:$feature_dir,AVAILABLE_DOCS:$docs,TASKS_TEMPLATE:$tasks_template}'
    else
        if [[ ${#docs[@]} -eq 0 ]]; then
            json_docs="[]"
        else
            json_docs=$(for d in "${docs[@]}"; do printf '"%s",' "$(json_escape "$d")"; done)
            json_docs="[${json_docs%,}]"
        fi
        printf '{"FEATURE_DIR":"%s","AVAILABLE_DOCS":%s,"TASKS_TEMPLATE":"%s"}\n' \
            "$(json_escape "$FEATURE_DIR")" "$json_docs" "$(json_escape "${TASKS_TEMPLATE:-}")"
    fi
else
    echo "フィーチャーディレクトリ: $FEATURE_DIR"
    echo "タスクテンプレート: ${TASKS_TEMPLATE:-見つかりません}"
    echo "利用可能なドキュメント:"
    check_file "$RESEARCH" "research.md"
    check_file "$DATA_MODEL" "data-model.md"
    check_dir "$CONTRACTS_DIR" "contracts/"
    check_file "$QUICKSTART" "quickstart.md"
fi
