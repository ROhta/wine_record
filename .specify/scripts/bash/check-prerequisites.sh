#!/usr/bin/env bash

# 統合された前提条件チェックスクリプト
#
# このスクリプトは Spec-Driven Development ワークフローのための統一された前提条件チェックを提供する。
# 以前は複数のスクリプトに分散していた機能を置き換える。
#
# 使い方: ./check-prerequisites.sh [OPTIONS]
#
# オプション:
#   --json              JSON 形式で出力する
#   --require-tasks     tasks.md の存在を必須にする（実装フェーズ向け）
#   --include-tasks     AVAILABLE_DOCS リストに tasks.md を含める
#   --paths-only        パス変数のみを出力する（検証なし）
#   --help, -h          ヘルプメッセージを表示する
#
# 出力:
#   JSON モード: {"FEATURE_DIR":"...", "AVAILABLE_DOCS":["..."]}
#   テキストモード: FEATURE_DIR:... \n AVAILABLE_DOCS: \n ✓/✗ file.md
#   パスのみ: REPO_ROOT: ... \n BRANCH: ... \n FEATURE_DIR: ... など

set -e

# コマンドライン引数を解析する
JSON_MODE=false
REQUIRE_TASKS=false
INCLUDE_TASKS=false
PATHS_ONLY=false

for arg in "$@"; do
    case "$arg" in
        --json)
            JSON_MODE=true
            ;;
        --require-tasks)
            REQUIRE_TASKS=true
            ;;
        --include-tasks)
            INCLUDE_TASKS=true
            ;;
        --paths-only)
            PATHS_ONLY=true
            ;;
        --help|-h)
            cat << 'EOF'
使い方: check-prerequisites.sh [OPTIONS]

Spec-Driven Development ワークフローのための統合された前提条件チェック。

オプション:
  --json              JSON 形式で出力する
  --require-tasks     tasks.md の存在を必須にする（実装フェーズ向け）
  --include-tasks     AVAILABLE_DOCS リストに tasks.md を含める
  --paths-only        パス変数のみを出力する（前提条件の検証なし）
  --help, -h          このヘルプメッセージを表示する

使用例:
  # タスクの前提条件をチェックする（plan.md が必須）
  ./check-prerequisites.sh --json
  
  # 実装の前提条件をチェックする（plan.md + tasks.md が必須）
  ./check-prerequisites.sh --json --require-tasks --include-tasks
  
  # フィーチャーのパスのみを取得する（検証なし）
  ./check-prerequisites.sh --paths-only
  
EOF
            exit 0
            ;;
        *)
            echo "エラー: 不明なオプション '$arg' です。使い方は --help を参照してください。" >&2
            exit 1
            ;;
    esac
done

# 共通関数を読み込む
SCRIPT_DIR="$(CDPATH="" cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

# フィーチャーのパスを取得する
_paths_output=$(get_feature_paths) || { echo "エラー: フィーチャーのパスを解決できませんでした" >&2; exit 1; }
eval "$_paths_output"
unset _paths_output

# paths-only モードの場合、パスを出力して終了する（検証なし）
if $PATHS_ONLY; then
    if $JSON_MODE; then
        # 最小限の JSON パスペイロード（検証は行わない）
        if has_jq; then
            jq -cn \
                --arg repo_root "$REPO_ROOT" \
                --arg branch "$CURRENT_BRANCH" \
                --arg feature_dir "$FEATURE_DIR" \
                --arg feature_spec "$FEATURE_SPEC" \
                --arg impl_plan "$IMPL_PLAN" \
                --arg tasks "$TASKS" \
                '{REPO_ROOT:$repo_root,BRANCH:$branch,FEATURE_DIR:$feature_dir,FEATURE_SPEC:$feature_spec,IMPL_PLAN:$impl_plan,TASKS:$tasks}'
        else
            printf '{"REPO_ROOT":"%s","BRANCH":"%s","FEATURE_DIR":"%s","FEATURE_SPEC":"%s","IMPL_PLAN":"%s","TASKS":"%s"}\n' \
                "$(json_escape "$REPO_ROOT")" "$(json_escape "$CURRENT_BRANCH")" "$(json_escape "$FEATURE_DIR")" "$(json_escape "$FEATURE_SPEC")" "$(json_escape "$IMPL_PLAN")" "$(json_escape "$TASKS")"
        fi
    else
        echo "リポジトリルート: $REPO_ROOT"
        echo "ブランチ: $CURRENT_BRANCH"
        echo "フィーチャーディレクトリ: $FEATURE_DIR"
        echo "フィーチャー仕様: $FEATURE_SPEC"
        echo "実装プラン: $IMPL_PLAN"
        echo "タスク: $TASKS"
    fi
    exit 0
fi

# 必須のディレクトリとファイルを検証する
if [[ ! -d "$FEATURE_DIR" ]]; then
    echo "エラー: フィーチャーディレクトリが見つかりません: $FEATURE_DIR" >&2
    echo "まず /speckit-specify を実行してフィーチャー構造を作成してください。" >&2
    exit 1
fi

if [[ ! -f "$IMPL_PLAN" ]]; then
    echo "エラー: $FEATURE_DIR に plan.md が見つかりません" >&2
    echo "まず /speckit-plan を実行して実装プランを作成してください。" >&2
    exit 1
fi

# 必要であれば tasks.md の存在を確認する
if $REQUIRE_TASKS && [[ ! -f "$TASKS" ]]; then
    echo "エラー: $FEATURE_DIR に tasks.md が見つかりません" >&2
    echo "まず /speckit-tasks を実行してタスクリストを作成してください。" >&2
    exit 1
fi

# 利用可能なドキュメントのリストを構築する
docs=()

# これらの任意ドキュメントは常に確認する
[[ -f "$RESEARCH" ]] && docs+=("research.md")
[[ -f "$DATA_MODEL" ]] && docs+=("data-model.md")

# contracts ディレクトリを確認する（存在しファイルがある場合のみ）
if [[ -d "$CONTRACTS_DIR" ]] && [[ -n "$(ls -A "$CONTRACTS_DIR" 2>/dev/null)" ]]; then
    docs+=("contracts/")
fi

[[ -f "$QUICKSTART" ]] && docs+=("quickstart.md")

# 要求され、かつ存在する場合は tasks.md を含める
if $INCLUDE_TASKS && [[ -f "$TASKS" ]]; then
    docs+=("tasks.md")
fi

# 結果を出力する
if $JSON_MODE; then
    # ドキュメントの JSON 配列を構築する
    if has_jq; then
        if [[ ${#docs[@]} -eq 0 ]]; then
            json_docs="[]"
        else
            json_docs=$(printf '%s\n' "${docs[@]}" | jq -R . | jq -s .)
        fi
        jq -cn \
            --arg feature_dir "$FEATURE_DIR" \
            --argjson docs "$json_docs" \
            '{FEATURE_DIR:$feature_dir,AVAILABLE_DOCS:$docs}'
    else
        if [[ ${#docs[@]} -eq 0 ]]; then
            json_docs="[]"
        else
            json_docs=$(for d in "${docs[@]}"; do printf '"%s",' "$(json_escape "$d")"; done)
            json_docs="[${json_docs%,}]"
        fi
        printf '{"FEATURE_DIR":"%s","AVAILABLE_DOCS":%s}\n' "$(json_escape "$FEATURE_DIR")" "$json_docs"
    fi
else
    # テキスト出力
    echo "フィーチャーディレクトリ:$FEATURE_DIR"
    echo "利用可能なドキュメント:"
    
    # 対象となる各ドキュメントの状態を表示する
    check_file "$RESEARCH" "research.md"
    check_file "$DATA_MODEL" "data-model.md"
    check_dir "$CONTRACTS_DIR" "contracts/"
    check_file "$QUICKSTART" "quickstart.md"
    
    if $INCLUDE_TASKS; then
        check_file "$TASKS" "tasks.md"
    fi
fi
