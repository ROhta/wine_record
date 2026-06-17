#!/usr/bin/env bash

set -e

# コマンドライン引数を解析する
JSON_MODE=false
ARGS=()

for arg in "$@"; do
    case "$arg" in
        --json) 
            JSON_MODE=true 
            ;;
        --help|-h) 
            echo "使い方: $0 [--json]"
            echo "  --json    結果を JSON 形式で出力する"
            echo "  --help    このヘルプメッセージを表示する"
            exit 0
            ;;
        *) 
            ARGS+=("$arg") 
            ;;
    esac
done

# スクリプトのディレクトリを取得し、共通関数を読み込む
SCRIPT_DIR="$(CDPATH="" cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

# 共通関数からすべてのパスと変数を取得する
_paths_output=$(get_feature_paths) || { echo "エラー: フィーチャーのパスを解決できませんでした" >&2; exit 1; }
eval "$_paths_output"
unset _paths_output

# フィーチャーディレクトリが存在することを保証する
mkdir -p "$FEATURE_DIR"

# プランがまだ存在しない場合はプランテンプレートをコピーする
if [[ -f "$IMPL_PLAN" ]]; then
    if $JSON_MODE; then
        echo "$IMPL_PLAN にプランが既に存在するため、テンプレートのコピーをスキップします" >&2
    else
        echo "$IMPL_PLAN にプランが既に存在するため、テンプレートのコピーをスキップします"
    fi
else
    TEMPLATE=$(resolve_template "plan-template" "$REPO_ROOT") || true
    if [[ -n "$TEMPLATE" ]] && [[ -f "$TEMPLATE" ]]; then
        cp "$TEMPLATE" "$IMPL_PLAN"
        if $JSON_MODE; then
            echo "プランテンプレートを $IMPL_PLAN にコピーしました" >&2
        else
            echo "プランテンプレートを $IMPL_PLAN にコピーしました"
        fi
    else
        if $JSON_MODE; then
            echo "警告: プランテンプレートが見つかりません" >&2
        else
            echo "警告: プランテンプレートが見つかりません"
        fi
        # テンプレートが存在しない場合は基本的なプランファイルを作成する
        touch "$IMPL_PLAN"
    fi
fi

# 結果を出力する
if $JSON_MODE; then
    if has_jq; then
        jq -cn \
            --arg feature_spec "$FEATURE_SPEC" \
            --arg impl_plan "$IMPL_PLAN" \
            --arg specs_dir "$FEATURE_DIR" \
            --arg branch "$CURRENT_BRANCH" \
            '{FEATURE_SPEC:$feature_spec,IMPL_PLAN:$impl_plan,SPECS_DIR:$specs_dir,BRANCH:$branch}'
    else
        printf '{"FEATURE_SPEC":"%s","IMPL_PLAN":"%s","SPECS_DIR":"%s","BRANCH":"%s"}\n' \
            "$(json_escape "$FEATURE_SPEC")" "$(json_escape "$IMPL_PLAN")" "$(json_escape "$FEATURE_DIR")" "$(json_escape "$CURRENT_BRANCH")"
    fi
else
    echo "FEATURE_SPEC: $FEATURE_SPEC"
    echo "IMPL_PLAN: $IMPL_PLAN" 
    echo "SPECS_DIR: $FEATURE_DIR"
    echo "BRANCH: $CURRENT_BRANCH"
fi

