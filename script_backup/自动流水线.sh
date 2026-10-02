#!/data/data/com.termux/files/usr/bin/bash
# =====================================================================
# 灵感雷达 · 全自动流水线（看门狗 + ccode 自动修复闭环）
# 安装位置：/storage/emulated/0/脚本/自动流水线.sh
# 启动方式（Termux 内）：bash /storage/emulated/0/脚本/自动流水线.sh
# 首次使用：先在 AutoJs6 里手动运行一次「灵感雷达轮流调度.js」，再启动本流水线。
#           之后调度器死了流水线会通过 intent 自动重启。
# 停止整套系统：直接停掉本流水线进程（kill 或关 Termux）。
# =====================================================================
export PATH="/data/data/com.termux/files/usr/bin:$PATH"
export NODE_OPTIONS="--max-old-space-size=6144"   # 12G 设备的安全堆上限（ccode 是 node 程序，启动前必须设好）

DIR="/storage/emulated/0/脚本"
PROGRESS="$DIR/PROGRESS.md"
CC_SESSION="ccode_auto"
CC_DIR="/data/data/com.termux/files/home/jc_tool"
SCHED_JS="$DIR/灵感雷达轮流调度.js"
PATROL_JS="$DIR/灵感雷达产品巡检.js"
MAIN_JS="$DIR/灵感雷达推送企微.js"
SCHED_LOG="$DIR/调度_日志.log"
MAIN_LOG="$DIR/主脚本_日志.log"
PATROL_LOG="$DIR/巡检_日志.log"
STOP_FLAG="$DIR/调度停止.txt"
RESTART_TS="$DIR/.ccode_restart_ts"   # ccode 重启时间戳（防同一崩法反复重试）
COOLDOWN=600     # 通知 ccode 后的冷却秒数（防同一错误反复轰炸）
WATCH_MIN=12     # 调度器日志超过此分钟数无更新 → 判定已停止（调度器待机/等子脚本心跳 5 分钟一次）

# 触发修复的错误模式（精确措辞，避免把可容忍的失败当事故）
ERR_PAT='密钥配置文件读取失败|提炼失败|所有 Key/模型均不可用|部署异常|部署失败|issue 提交失败|TypeError|ReferenceError|SyntaxError|Exception'
# 已知可容忍、不触发修复的噪音（单路信源失败 / V2EX 超时 / 常亮失败等老问题 / GLM 调用 SocketTimeout——已加同模型重试+冷却切换自愈，2026-10-02）
IGNORE_PAT='推送第|知乎 失败|微博 失败|V2EX|屏幕常亮开启失败|读取失败，跳过|页脚迁移失败|SocketTimeoutException'

log() { echo "[$(date '+%F %T')] $*" >> "$PROGRESS"; }

# ---------- ccode 会话管理：崩溃自动重开（带 6G 堆）；10 分钟内崩 3 次就停手记录，不反复撞同一崩法 ----------
start_ccode() {
    if tmux has-session -t "$CC_SESSION" 2>/dev/null; then return 0; fi
    local now cnt=0 ts
    now=$(date +%s)
    if [ -f "$RESTART_TS" ]; then
        while read -r ts; do
            [ -n "$ts" ] && [ $((now - ts)) -le 600 ] && cnt=$((cnt+1))
        done < "$RESTART_TS"
    fi
    if [ "$cnt" -ge 3 ]; then
        log "⚠️ ccode 10 分钟内已崩 $cnt 次（疑似同一崩法），暂停重开 30 分钟；最近重开时间戳：$(tail -5 "$RESTART_TS" | tr '\n' ' ')"
        sleep 1800
        return 1
    fi
    echo "$now" >> "$RESTART_TS"
    log "🚀 启动 ccode（NODE_OPTIONS=--max-old-space-size=6144，tmux 会话 $CC_SESSION）"
    tmux new-session -d -s "$CC_SESSION" -e NODE_OPTIONS="--max-old-space-size=6144"
    tmux send-keys -t "$CC_SESSION" "cd $CC_DIR && ccode" C-m
    sleep 15
}

# ---------- 通知 ccode ----------
notify_ccode() {
    local msg="$1"
    # ccode 的 PromptInput 有 50ms IME 守卫：回车与最后一个按键同 chunk 到达会被吞掉（实测）。
    # 分两步：先只灌文本，间隔 300ms 再独立发回车，回车就不在守卫窗口内。
    tmux send-keys -t "$CC_SESSION" "$msg"
    sleep 0.3
    tmux send-keys -t "$CC_SESSION" Enter
    # 发送成功检测：消息固定结尾「无需重启。」若仍挂在 pane 最后两行（输入框区域）= 没发出去，
    # 补发回车（最多 2 次）。发送成功后该字样只出现在对话区（pane 上方），不会误判。
    local tries=0
    while [ "$tries" -lt 2 ]; do
        sleep 1.5
        if tmux capture-pane -t "$CC_SESSION" -p 2>/dev/null | tail -2 | grep -q "无需重启"; then
            tmux send-keys -t "$CC_SESSION" Enter
            log "⚠️ 任务疑似未发送，已补发回车（第 $((tries+1)) 次）"
            tries=$((tries+1))
        else
            break
        fi
    done
    log "📨 已通知 ccode：$msg"
}

# ---------- 冷却窗口内的自动确认兜底：ccode TUI 若弹确认框，自动回车 ----------
auto_confirm_once() {
    local end=$(( $(date +%s) + COOLDOWN ))
    while [ "$(date +%s)" -lt "$end" ]; do
        if tmux capture-pane -t "$CC_SESSION" -p 2>/dev/null | tail -4 | grep -qE "Approve|Refine|Apply|应用"; then
            tmux send-keys -t "$CC_SESSION" Enter
            log "⌨️ 检测到确认框，已自动回车"
        fi
        sleep 45
    done
}

# ---------- 调度器看门狗：日志超时无更新 → 先停后启（防双开烧 token） ----------
ensure_scheduler() {
    # Termux 没有 /tmp，临时文件统一放 $HOME/tmp（main 里已 mkdir -p，这里再保险一次）
    local ref="$HOME/tmp/.pipe_ref"
    mkdir -p "$HOME/tmp"
    touch -d "$WATCH_MIN minutes ago" "$ref" 2>/dev/null || touch "$ref"
    if [ -f "$SCHED_LOG" ] && [ -f "$ref" ] && [ "$SCHED_LOG" -nt "$ref" ]; then
        return 0   # 日志新鲜 = 调度器活着
    fi
    if [ ! -f "$SCHED_LOG" ]; then
        # 日志文件都不存在：首次启动需手动跑一次调度器；不自动 intent，防双开
        log "⏳ 尚未见到调度器日志：请先在 AutoJs6 里手动运行一次 灵感雷达轮流调度.js"
        return 0
    fi
    # 重启冷却：5 分钟内已重启过一次就跳过，防止 am 失败/误判时每 60 秒循环轰炸
    local rt="$HOME/tmp/.sched_restart_ts"
    if [ -f "$rt" ] && [ $(( $(date +%s) - $(cat "$rt" 2>/dev/null || echo 0) )) -lt 300 ]; then
        return 0
    fi
    # 孤儿保护（2026-10-02 事故复盘）：调度器被停止标志逼退时可能留下仍在跑的子脚本（实测本机 forceStop 无效），
    # 此时直接重启调度器会双开烧 token。判据：完成标记不存在 且 主/巡检日志 8 分钟内有更新 → 推迟重启，5 分钟后再查
    local done="$DIR/调度子脚本完成.txt" mref="$HOME/tmp/.mainref" childAlive=0
    touch -d "8 minutes ago" "$mref" 2>/dev/null || touch "$mref"
    if [ -f "$MAIN_LOG" ] && [ "$MAIN_LOG" -nt "$mref" ]; then childAlive=1; fi
    if [ -f "$PATROL_LOG" ] && [ "$PATROL_LOG" -nt "$mref" ]; then childAlive=1; fi
    if [ "$childAlive" -eq 1 ] && [ ! -f "$done" ]; then
        log "⏳ 子脚本仍在运行（日志 8 分钟内有更新且无完成标记），暂缓重启调度器防双开，5 分钟后复查"
        date +%s > "$rt"
        return 0
    fi
    log "🕐 调度器日志 $WATCH_MIN 分钟无更新，判定已停止；先停后启防双开"
    date +%s > "$rt"
    touch "$STOP_FLAG"      # 若旧实例还活着，30 秒内自行退出（exit 回调会停掉子脚本）
    sleep 40
    rm -f "$STOP_FLAG"
    local ok=0 out
    # 实测结论（2026-10-02 ccode 拆包+逐条命令验证）：本机两个 AutoJs 都不存在 RUN_SCRIPT 隐式 action，
    # 唯一可被 Termux 直接拉起的通道是官方包 org.autojs.autojs6 的 RunIntentActivity（实测 Starting OK）。
    out=$(am start -n org.autojs.autojs6/org.autojs.autojs.external.open.RunIntentActivity -a android.intent.action.VIEW -d "file://$SCHED_JS" -t application/x-javascript 2>&1) && ok=1
    if [ "$ok" -eq 0 ]; then
        out=$(am start -n org.autojs.autojs6/org.autojs.autojs.external.open.RunIntentActivity --es path "$SCHED_JS" 2>&1) && ok=1
    fi
    if [ "$ok" -eq 0 ]; then
        log "❌ intent 重启调度器失败：$out"
        notify_ccode "【自动流水线】调度器疑似停止（$SCHED_LOG 超过 $WATCH_MIN 分钟无更新），intent 重启失败：$out。请想办法重启调度器（或提示用户手动运行一次 灵感雷达轮流调度.js），结论写入 $PROGRESS。"
    else
        log "✅ 已通过 intent 重启调度器"
    fi
}

# ---------- 日志扫描：命中错误模式且不在白名单 → 输出「文件名|错误行」 ----------
scan_logs() {
    local f hit name
    for name in 调度_日志 巡检_日志 主脚本_日志; do
        f="$DIR/$name.log"
        [ -f "$f" ] || continue
        hit=$(tail -80 "$f" | grep -E "$ERR_PAT" | grep -vE "$IGNORE_PAT" | head -1)
        if [ -n "$hit" ]; then
            echo "$name.log|$hit"
            return
        fi
    done
}

# ---------- 每天给三个脚本做一次带日期备份（回滚点） ----------
backup_scripts_once() {
    local d f b
    d=$(date +%Y%m%d)
    for f in "$SCHED_JS" "$MAIN_JS" "$PATROL_JS"; do
        b="$f.bak.$d"
        if [ ! -f "$b" ]; then
            cp "$f" "$b" && log "📦 已备份 $f → $b"
        fi
    done
}

# ---------- 主循环 ----------
main() {
    mkdir -p "$HOME/tmp"   # Termux 没有 /tmp：流水线所有临时文件统一放这里
    [ -f "$PROGRESS" ] || echo "# 灵感雷达全自动流水线进度（自动写入）" > "$PROGRESS"
    log "========== 流水线启动 =========="
    backup_scripts_once
    while true; do
        start_ccode
        ensure_scheduler
        local found fname errline
        found=$(scan_logs)
        if [ -n "$found" ]; then
            fname="${found%%|*}"
            errline="${found#*|}"
            log "🚨 检测到错误：$fname → $errline"
            notify_ccode "【自动流水线】$DIR/$fname 出现错误：$errline 。请：1)读 $DIR/$fname 全文及另两个日志定位根因 2)改文件前先 cp 一份 .bak 3)修复后推 GitHub（推前先备份线上旧版本或记下 commit sha）4)推送失败或被拒就停止重试并记录 5)在 $PROGRESS 追加一行含 FIXED 的说明 6)全程自动执行，无需等确认（已获用户全权授权）。调度器下轮循环自动加载新代码，无需重启。"
            auto_confirm_once   # 冷却期内自动确认兜底 + 防重复轰炸
        fi
        sleep 60
    done
}

main
