# ============================================================================
# 灵感雷达流水线 · 大退自愈自启动（2026-10-03 由 ccode 添加）
# ----------------------------------------------------------------------------
# 背景：流水线（含 ccode 看门狗）整个跑在 Termux 里，被系统大退/杀死时全灭、无人拉起。
#       2026-10-03 实测栽过两次：上午断 30 分钟、下午断 2 小时 18 分（12:35→14:53）。
#       分工：AutoJs6 侧的调度器发现心跳停摆 → 尝试拉起 Termux（pipeWatchdog）；
#             本块负责「Termux 一回来就把流水线接上」。
# 落点说明：本机原本没有 ~/.bashrc。Termux 的 /etc/profile 里有专门补丁块
#          （`if shopt -q login_shell && [ -f ~/.bashrc ]; then . ~/.bashrc; fi`），
#          所以登录 shell 会执行到这里。下面的 [ -z "$TMUX" ] 守卫确保不在 tmux 子 shell 里递归触发。
# 暂停开关：创建 /storage/emulated/0/脚本/流水线自启暂停.txt
# 手工验证：bash -lic 'true'   → 应打印「已自动拉起」或静默无输出（两种都正常）
# 维护副本：/data/data/com.termux/files/home/jc_tool/_流水线看门狗/bashrc片段.sh
# ============================================================================
if [ -n "${PS1:-}" ] && [ -z "${TMUX:-}" ] && command -v tmux > /dev/null 2>&1; then
    _pj="/storage/emulated/0/脚本/自动流水线.sh"
    _hb="/storage/emulated/0/脚本/.流水线心跳"
    _off="/storage/emulated/0/脚本/流水线自启暂停.txt"
    if [ -f "$_pj" ] && [ ! -f "$_off" ]; then
        _need=0
        if ! tmux has-session -t pipe 2> /dev/null; then
            _need=1                                   # 会话不在 = 流水线已死
        elif [ -f "$_hb" ]; then
            _hbv=$(cat "$_hb" 2> /dev/null | tr -cd "0-9")
            [ -n "$_hbv" ] || _hbv=0
            [ $(( $(date +%s) - _hbv )) -gt 900 ] && _need=1   # 会话在但心跳超 15 分钟 = 卡死
        fi
        if [ "$_need" = "1" ]; then
            _st="$HOME/tmp/.pipe_autostart_ts"
            mkdir -p "$HOME/tmp" 2> /dev/null
            _last=$(cat "$_st" 2> /dev/null | tr -cd "0-9")
            [ -n "$_last" ] || _last=0
            if [ $(( $(date +%s) - _last )) -gt 120 ]; then     # 冷却，防连环重开
                date +%s > "$_st" 2> /dev/null
                tmux kill-session -t pipe 2> /dev/null
                tmux new-session -d -s pipe "bash $_pj"
                echo "🛡️ 灵感雷达流水线未在运行，已自动拉起（tmux 会话 pipe）"
            fi
        fi
    fi
    unset _pj _hb _off _need _hbv _st _last
fi
