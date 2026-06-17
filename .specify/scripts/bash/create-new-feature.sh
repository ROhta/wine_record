#!/usr/bin/env bash

set -e

JSON_MODE=false
DRY_RUN=false
ALLOW_EXISTING=false
SHORT_NAME=""
BRANCH_NUMBER=""
USE_TIMESTAMP=false
ARGS=()
i=1
while [ $i -le $# ]; do
    arg="${!i}"
    case "$arg" in
        --json)
            JSON_MODE=true
            ;;
        --dry-run)
            DRY_RUN=true
            ;;
        --allow-existing-branch)
            ALLOW_EXISTING=true
            ;;
        --short-name)
            if [ $((i + 1)) -gt $# ]; then
                echo 'エラー: --short-name には値が必要です' >&2
                exit 1
            fi
            i=$((i + 1))
            next_arg="${!i}"
            # 次の引数が別のオプション（-- で始まる）かどうかを確認する
            if [[ "$next_arg" == --* ]]; then
                echo 'エラー: --short-name には値が必要です' >&2
                exit 1
            fi
            SHORT_NAME="$next_arg"
            ;;
        --number)
            if [ $((i + 1)) -gt $# ]; then
                echo 'エラー: --number には値が必要です' >&2
                exit 1
            fi
            i=$((i + 1))
            next_arg="${!i}"
            if [[ "$next_arg" == --* ]]; then
                echo 'エラー: --number には値が必要です' >&2
                exit 1
            fi
            BRANCH_NUMBER="$next_arg"
            ;;
        --timestamp)
            USE_TIMESTAMP=true
            ;;
        --help|-h)
            echo "使い方: $0 [--json] [--dry-run] [--allow-existing-branch] [--short-name <name>] [--number N] [--timestamp] <feature_description>"
            echo ""
            echo "オプション:"
            echo "  --json              JSON 形式で出力する"
            echo "  --dry-run           ディレクトリやファイルを作成せずにフィーチャー名とパスを計算する"
            echo "  --allow-existing-branch  既存のフィーチャーディレクトリがあれば再利用する"
            echo "  --short-name <name> フィーチャーのカスタムショートネーム（2〜4語）を指定する"
            echo "  --number N          ブランチ番号を手動で指定する（自動検出を上書きする）"
            echo "  --timestamp         連番ではなくタイムスタンプのプレフィックス（YYYYMMDD-HHMMSS）を使う"
            echo "  --help, -h          このヘルプメッセージを表示する"
            echo ""
            echo "使用例:"
            echo "  $0 'Add user authentication system' --short-name 'user-auth'"
            echo "  $0 'Implement OAuth2 integration for API' --number 5"
            echo "  $0 --timestamp --short-name 'user-auth' 'Add user authentication'"
            exit 0
            ;;
        *)
            ARGS+=("$arg")
            ;;
    esac
    i=$((i + 1))
done

FEATURE_DESCRIPTION="${ARGS[*]}"
if [ -z "$FEATURE_DESCRIPTION" ]; then
    echo "使い方: $0 [--json] [--dry-run] [--allow-existing-branch] [--short-name <name>] [--number N] [--timestamp] <feature_description>" >&2
    exit 1
fi

# 空白をトリムし、説明が空でないことを検証する（例: ユーザーが空白のみを渡した場合）
FEATURE_DESCRIPTION=$(echo "$FEATURE_DESCRIPTION" | sed -E 's/^[[:space:]]+|[[:space:]]+$//g')
if [ -z "$FEATURE_DESCRIPTION" ]; then
    echo "エラー: フィーチャーの説明を空白のみにすることはできません" >&2
    exit 1
fi

# specs ディレクトリから最大の番号を取得する関数
get_highest_from_specs() {
    local specs_dir="$1"
    local highest=0
    
    if [ -d "$specs_dir" ]; then
        for dir in "$specs_dir"/*; do
            [ -d "$dir" ] || continue
            dirname=$(basename "$dir")
            # 連番プレフィックス（3桁以上）にマッチさせるが、タイムスタンプのディレクトリはスキップする。
            if echo "$dirname" | grep -Eq '^[0-9]{3,}-' && ! echo "$dirname" | grep -Eq '^[0-9]{8}-[0-9]{6}-'; then
                number=$(echo "$dirname" | grep -Eo '^[0-9]+')
                number=$((10#$number))
                if [ "$number" -gt "$highest" ]; then
                    highest=$number
                fi
            fi
        done
    fi
    
    echo "$highest"
}

# ブランチ名をクリーンアップして整形する関数
clean_branch_name() {
    local name="$1"
    echo "$name" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/-\+/-/g' | sed 's/^-//' | sed 's/-$//'
}

# .specify を優先する common.sh の関数を使ってリポジトリルートを解決する
SCRIPT_DIR="$(CDPATH="" cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

REPO_ROOT=$(get_repo_root)

cd "$REPO_ROOT"

SPECS_DIR="$REPO_ROOT/specs"
if [ "$DRY_RUN" != true ]; then
    mkdir -p "$SPECS_DIR"
fi

# ストップワードのフィルタリングと長さのフィルタリングを行ってブランチ名を生成する関数
generate_branch_name() {
    local description="$1"
    
    # フィルタリングで除外する一般的なストップワード
    local stop_words="^(i|a|an|the|to|for|of|in|on|at|by|with|from|is|are|was|were|be|been|being|have|has|had|do|does|did|will|would|should|could|can|may|might|must|shall|this|that|these|those|my|your|our|their|want|need|add|get|set)$"
    
    # 小文字に変換し、単語に分割する
    local clean_name=$(echo "$description" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/ /g')
    
    # 単語をフィルタリングする: ストップワードと3文字未満の単語を除去する（元の文中で大文字の頭字語である場合を除く）
    local meaningful_words=()
    for word in $clean_name; do
        # 空の単語をスキップする
        [ -z "$word" ] && continue
        
        # ストップワードでなく、かつ（長さが3以上、または頭字語の可能性がある）単語を残す
        if ! echo "$word" | grep -qiE "$stop_words"; then
            if [ ${#word} -ge 3 ]; then
                meaningful_words+=("$word")
            elif echo "$description" | grep -q "\b${word^^}\b"; then
                # 元の文中で大文字として現れる短い単語は残す（頭字語の可能性が高い）
                meaningful_words+=("$word")
            fi
        fi
    done
    
    # 意味のある単語があれば、その最初の3〜4個を使う
    if [ ${#meaningful_words[@]} -gt 0 ]; then
        local max_words=3
        if [ ${#meaningful_words[@]} -eq 4 ]; then max_words=4; fi
        
        local result=""
        local count=0
        for word in "${meaningful_words[@]}"; do
            if [ $count -ge $max_words ]; then break; fi
            if [ -n "$result" ]; then result="$result-"; fi
            result="$result$word"
            count=$((count + 1))
        done
        echo "$result"
    else
        # 意味のある単語が見つからない場合は元のロジックにフォールバックする
        local cleaned=$(clean_branch_name "$description")
        echo "$cleaned" | tr '-' '\n' | grep -v '^$' | head -3 | tr '\n' '-' | sed 's/-$//'
    fi
}

# ブランチ名を生成する
if [ -n "$SHORT_NAME" ]; then
    # 指定されたショートネームを使い、クリーンアップするだけにする
    BRANCH_SUFFIX=$(clean_branch_name "$SHORT_NAME")
else
    # スマートなフィルタリングで説明から生成する
    BRANCH_SUFFIX=$(generate_branch_name "$FEATURE_DESCRIPTION")
fi

# --number と --timestamp が両方指定された場合は警告する
if [ "$USE_TIMESTAMP" = true ] && [ -n "$BRANCH_NUMBER" ]; then
    >&2 echo "[specify] 警告: --timestamp の使用時は --number は無視されます"
    BRANCH_NUMBER=""
fi

# ブランチのプレフィックスを決定する
if [ "$USE_TIMESTAMP" = true ]; then
    FEATURE_NUM=$(date +%Y%m%d-%H%M%S)
    BRANCH_NAME="${FEATURE_NUM}-${BRANCH_SUFFIX}"
else
    # 既存のフィーチャーディレクトリからブランチ番号を決定する
    if [ -z "$BRANCH_NUMBER" ]; then
        HIGHEST=$(get_highest_from_specs "$SPECS_DIR")
        BRANCH_NUMBER=$((HIGHEST + 1))
    fi

    # 8進数への変換を防ぐため10進数として強制的に解釈する（例: 010 は8進数では 8 だが、10進数の 10 であるべき）
    FEATURE_NUM=$(printf "%03d" "$((10#$BRANCH_NUMBER))")
    BRANCH_NAME="${FEATURE_NUM}-${BRANCH_SUFFIX}"
fi

# GitHub はブランチ名に 244 バイトの制限を課す
# 必要に応じて検証し切り詰める
MAX_BRANCH_LENGTH=244
if [ ${#BRANCH_NAME} -gt $MAX_BRANCH_LENGTH ]; then
    # サフィックスからどれだけ削る必要があるかを計算する
    # プレフィックス長を考慮する: タイムスタンプ (15) + ハイフン (1) = 16、または連番 (3) + ハイフン (1) = 4
    PREFIX_LENGTH=$(( ${#FEATURE_NUM} + 1 ))
    MAX_SUFFIX_LENGTH=$((MAX_BRANCH_LENGTH - PREFIX_LENGTH))
    
    # 可能なら単語境界でサフィックスを切り詰める
    TRUNCATED_SUFFIX=$(echo "$BRANCH_SUFFIX" | cut -c1-$MAX_SUFFIX_LENGTH)
    # 切り詰めによって末尾にハイフンができた場合は除去する
    TRUNCATED_SUFFIX=$(echo "$TRUNCATED_SUFFIX" | sed 's/-$//')
    
    ORIGINAL_BRANCH_NAME="$BRANCH_NAME"
    BRANCH_NAME="${FEATURE_NUM}-${TRUNCATED_SUFFIX}"
    
    >&2 echo "[specify] 警告: ブランチ名が GitHub の 244 バイト制限を超えました"
    >&2 echo "[specify] 元の名前: $ORIGINAL_BRANCH_NAME (${#ORIGINAL_BRANCH_NAME} バイト)"
    >&2 echo "[specify] 切り詰め後: $BRANCH_NAME (${#BRANCH_NAME} バイト)"
fi

FEATURE_DIR="$SPECS_DIR/$BRANCH_NAME"
SPEC_FILE="$FEATURE_DIR/spec.md"

if [ "$DRY_RUN" != true ]; then
    if [ -d "$FEATURE_DIR" ] && [ "$ALLOW_EXISTING" != true ]; then
        if [ "$USE_TIMESTAMP" = true ]; then
            >&2 echo "エラー: フィーチャーディレクトリ '$FEATURE_DIR' は既に存在します。新しいタイムスタンプを得るには再実行するか、別の --short-name を指定してください。"
        else
            >&2 echo "エラー: フィーチャーディレクトリ '$FEATURE_DIR' は既に存在します。別のフィーチャー名を使うか、--number で別の番号を指定してください。"
        fi
        exit 1
    fi

    mkdir -p "$FEATURE_DIR"

    if [ ! -f "$SPEC_FILE" ]; then
        TEMPLATE=$(resolve_template "spec-template" "$REPO_ROOT") || true
        if [ -n "$TEMPLATE" ] && [ -f "$TEMPLATE" ]; then
            cp "$TEMPLATE" "$SPEC_FILE"
        else
            echo "警告: spec テンプレートが見つかりません。空の spec ファイルを作成しました" >&2
            touch "$SPEC_FILE"
        fi
    fi

    # 下流のコマンドがフィーチャーを見つけられるよう .specify/feature.json に永続化する
    _persist_feature_json "$REPO_ROOT" "$FEATURE_DIR"

    # ユーザー自身のシェルでフィーチャー状態を設定する方法を伝える
    printf '# 永続化するには: export SPECIFY_FEATURE=%q\n' "$BRANCH_NAME" >&2
    printf '#                 export SPECIFY_FEATURE_DIRECTORY=%q\n' "$FEATURE_DIR" >&2
fi

if $JSON_MODE; then
    if command -v jq >/dev/null 2>&1; then
        if [ "$DRY_RUN" = true ]; then
            jq -cn \
                --arg branch_name "$BRANCH_NAME" \
                --arg spec_file "$SPEC_FILE" \
                --arg feature_num "$FEATURE_NUM" \
                '{BRANCH_NAME:$branch_name,SPEC_FILE:$spec_file,FEATURE_NUM:$feature_num,DRY_RUN:true}'
        else
            jq -cn \
                --arg branch_name "$BRANCH_NAME" \
                --arg spec_file "$SPEC_FILE" \
                --arg feature_num "$FEATURE_NUM" \
                '{BRANCH_NAME:$branch_name,SPEC_FILE:$spec_file,FEATURE_NUM:$feature_num}'
        fi
    else
        if [ "$DRY_RUN" = true ]; then
            printf '{"BRANCH_NAME":"%s","SPEC_FILE":"%s","FEATURE_NUM":"%s","DRY_RUN":true}\n' "$(json_escape "$BRANCH_NAME")" "$(json_escape "$SPEC_FILE")" "$(json_escape "$FEATURE_NUM")"
        else
            printf '{"BRANCH_NAME":"%s","SPEC_FILE":"%s","FEATURE_NUM":"%s"}\n' "$(json_escape "$BRANCH_NAME")" "$(json_escape "$SPEC_FILE")" "$(json_escape "$FEATURE_NUM")"
        fi
    fi
else
    echo "BRANCH_NAME: $BRANCH_NAME"
    echo "SPEC_FILE: $SPEC_FILE"
    echo "FEATURE_NUM: $FEATURE_NUM"
    if [ "$DRY_RUN" != true ]; then
        printf '# シェルで永続化するには: export SPECIFY_FEATURE=%q\n' "$BRANCH_NAME"
        printf '#                         export SPECIFY_FEATURE_DIRECTORY=%q\n' "$FEATURE_DIR"
    fi
fi
