console.show();
// ========== 文件日志：log() 同时写文件（实时落盘）+ 打日志窗 ==========
// 本机魔改版 Rhino 静默忽略 console.log 的赋值（实测），无法重定义双写。
// 方案：定义全局 log()，脚本内所有 log( 已由 sed 批量替换为 log(。
var LOG_FILE = "/storage/emulated/0/脚本/调度_日志.log";
// 清空（覆盖模式，写测试.js 验证过的写法）
try {
    var f0 = new java.io.FileOutputStream(LOG_FILE, false);
    f0.close();
} catch (e) {}
// 自定义 log()：写文件（每次 open→write→flush→close 实时落盘）+ 打日志窗
function log() {
    var line = "";
    for (var i = 0; i < arguments.length; i++) {
        if (i > 0) line += " ";
        var a = arguments[i];
        try { line += (typeof a === "object" && a !== null) ? JSON.stringify(a) : String(a); } catch (e) { line += String(a); }
    }
    try {
        var fa = new java.io.FileOutputStream(LOG_FILE, true);
        fa.write(new java.lang.String("[" + new Date().toLocaleString() + "] " + line + "\n").getBytes("UTF-8"));
        fa.flush();
        fa.close();
    } catch (e) {}
    try { console.log.apply(console, arguments); } catch (e) {}
}
log("✅ 文件日志已启用 → " + LOG_FILE);
// 启动即清扫其它脚本引擎：上次会话的旧调度器/孤儿主巡检实例可能还在跑，不清掉会和新调度器并行烧 token
// （主/巡检脚本不受影响，本调度器随后会重新拉起它们）
// 注意：本机魔改版 stopAllAndToast 会把自身引擎的 isDestroyed 也标记成 true（引擎其实还活着），
// 导致后续引擎自检秒退、可能影响启动子脚本——默认关闭，运行前请在 AutoJs 里手动「停止所有脚本」。
let AUTO_STOP_OTHERS = false;
if (AUTO_STOP_OTHERS) {
    try {
        engines.stopAllAndToast(); // AutoJs6 保留 Pro 语义：停掉除自身外的所有脚本引擎
        log("🧹 已尝试停止其它运行中的脚本引擎（清理上次残留实例）");
    } catch (e) {
        log("⚠️ stopAllAndToast 不可用，请手动在 AutoJs 里「停止所有脚本」后再运行本调度器：" + e);
    }
} else {
    log("ℹ️ 未自动停止其它脚本（本机魔改版 stopAllAndToast 有副作用）：运行前请先手动「停止所有脚本」");
}
// ========== 灵感雷达 · 双脚本轮流调度器 ==========
// 在每日时间窗口内无限循环：主脚本 → 巡检脚本 → 主脚本 → …；到停止时间自动待机，次日开始时间自动恢复。
// 只有两种方式会退出：① 在 AutoJs 里手动停止本脚本；② 创建停止标志文件（见 STOP_FLAG）。
// 时间自由设置：悬浮面板直接点几下就行，或建 CFG_PATH 配置文件（JSON），每轮循环后自动重读，改完不用重启调度器。
// 配置示例：{"start":"09:00","stop":"21:00","gapMin":30}
const MAIN_SCRIPT = "/storage/emulated/0/脚本/灵感雷达推送企微.js";
const PATROL_SCRIPT = "/storage/emulated/0/脚本/灵感雷达产品巡检.js";
const CFG_PATH = "/storage/emulated/0/脚本/调度时间.json";
const STOP_FLAG = "/storage/emulated/0/脚本/调度停止.txt"; // 建此文件即停（下次循环或 30 秒内生效）
const CHILD_DONE_MARK = "/storage/emulated/0/脚本/调度子脚本完成.txt"; // 子脚本跑完后写的完成标记（调度器检测用）
const D_START = "09:00"; // 默认每日开始时间（24 小时制 HH:MM）
const D_STOP = "21:00";  // 默认每日停止时间（小于开始时间 = 跨夜窗口；两者相同 = 全天）
const D_GAP = 30;        // 默认每轮（主+巡）完成后的休息分钟数（防预算用尽后空转刷企微/GitHub，可设 0）
const D_KEEP_AWAKE = true; // 默认屏幕常亮（息屏后部分 ROM 限速/杀后台，常亮最稳）

function loadCfg() {
    try {
        let j = JSON.parse(files.read(CFG_PATH));
        return {
            start: j && j.start ? String(j.start) : D_START,
            stop: j && j.stop ? String(j.stop) : D_STOP,
            gapMin: j && typeof j.gapMin === "number" ? Math.max(0, j.gapMin) : D_GAP,
            keepAwake: j && typeof j.keepAwake === "boolean" ? j.keepAwake : D_KEEP_AWAKE
        };
    } catch (e) {}
    return {start: D_START, stop: D_STOP, gapMin: D_GAP, keepAwake: D_KEEP_AWAKE};
}
let CFG = loadCfg();
function writeCfg() {
    try { files.write(CFG_PATH, JSON.stringify(CFG)); } catch (e) {}
}
// 启动时清理上次残留的停止标志（手动停过之后重启，不会被旧标志立刻杀死）
try { if (files.exists(STOP_FLAG)) { files.remove(STOP_FLAG); log("🧹 已清理上次的停止标志"); } } catch (e) {}

function parseHM(s) {
    let p = String(s).split(":");
    return (parseInt(p[0], 10) || 0) * 60 + (parseInt(p[1], 10) || 0);
}
function nowMin() {
    let d = new Date();
    return d.getHours() * 60 + d.getMinutes();
}
function inWindow(m) {
    let s = parseHM(CFG.start), e = parseHM(CFG.stop);
    if (s === e) return true;            // 开始=停止 → 全天
    if (s < e) return m >= s && m < e;
    return m >= s || m < e;              // 跨夜窗口
}
function minToStart() {
    let s = parseHM(CFG.start);
    let m = nowMin();
    return m < s ? s - m : 1440 - m + s;
}
// （待机改用 sleepUntilStart 每 30 秒重算，minToNextStart 已废弃）

// 手动停止本脚本时，把正在跑的子脚本一并停掉（AutoJs 停止是强制的，此回调是兜底）
let curEngine = null;
try {
    events.on("exit", function() {
        if (curEngine) {
            try { curEngine.forceStop(); } catch (e) {}
        }
        try { device.cancelKeepingAwake(); } catch (e) {} // 退出时恢复系统息屏策略
        try { if (typeof keepWakeLock !== "undefined" && keepWakeLock) keepWakeLock.release(); } catch (e) {}
    });
} catch (e) {}

function runOne(path, tag, maxWaitMs) {
    log("▶️ 启动 " + tag + "：" + new Date().toLocaleString());
    let eng = null;
    try { if (files.exists(CHILD_DONE_MARK)) files.remove(CHILD_DONE_MARK); } catch (e) {} // 清旧标记，确保检测到的是本轮结束
    try {
        eng = engines.execScriptFile(path);
        curEngine = eng;
    } catch (e) {
        log("⚠️ " + tag + " 启动失败：" + e);
        curEngine = null;
        return;
    }
    if (eng && eng.waitFor) {
        try {
            eng.waitFor(); // 阻塞等子脚本自然结束（手动停止子脚本也算结束）
            log("⏹️ " + tag + " 结束（waitFor）：" + new Date().toLocaleString());
            curEngine = null;
            return;
        } catch (e) {}
    }
    // 完成检测只认「完成标记文件」：子脚本跑完必写标记，这是硬证据。
    // 实测本机 waitFor 不存在、engines.all() 对象比对恒为假——按引擎状态判断会 30 秒就误判「已结束」，
    // 导致主/巡检并行叠跑、重复提 issue、重复建产品。标记文件是唯一可靠信号；超时兑底强制结束。
    log("⏳ " + tag + "：等待完成标记（最多 " + Math.round(maxWaitMs / 60000) + " 分钟）…");
    let deadline = Date.now() + maxWaitMs;
    let beat = 0; // 心跳节拍：每 30 次 10 秒循环 = 5 分钟写一条日志（实测 12 分钟无日志会被流水线看门狗误判“已停止”而误杀）
    while (Date.now() < deadline) {
        if (stopRequested()) {
            if (curEngine) { try { curEngine.forceStop(); } catch (e) {} }
            curEngine = null;
            return;
        }
        sleep(10000);
        beat++;
        if (beat % 30 === 0) {
            log("⏳ " + tag + "仍在运行…（已等待 " + Math.round(beat / 6) + " 分钟，继续等完成标记）");
        }
        let marked = false;
        try { marked = files.exists(CHILD_DONE_MARK); } catch (e) {}
        if (marked) break;
    }
    if (!files.exists(CHILD_DONE_MARK)) {
        log("⚠️ " + tag + " 超过 " + Math.round(maxWaitMs / 60000) + " 分钟未写完成标记（可能卡死/崩溃），强制结束并继续轮换");
        if (curEngine) { try { curEngine.forceStop(); } catch (e) {} }
        curEngine = null;
        return;
    }
    log("⏹️ " + tag + " 结束（完成标记确认）：" + new Date().toLocaleString());
    curEngine = null;
}

function gapSleep(min) {
    if (min <= 0) return;
    log("💤 轮间休息 " + min + " 分钟…");
    let until = Date.now() + min * 60 * 1000;
    while (Date.now() < until) {
        sleep(30000); // 每 30 秒醒一次查停止标志，手动停止随时生效
        updateStatus();
    }
}
function sleepUntilStart() {
    let tick = 0;
    while (!inWindow(nowMin())) {
        if (stopRequested()) return false;
        sleep(30000);
        tick++;
        CFG = loadCfg(); // 待机中每 30 秒重读配置：面板改时间立刻反映到待机
        let remain = minToStart();
        if (tick % 10 === 0 || remain <= 2) {
            log("⏸ 待机中（距开始约 " + remain + " 分钟）…"); // 心跳日志（5 分钟一次）：确认调度器还活着且在倒计时，防看门狗误杀
        }
        updateStatus();
    }
    return true;
}

function stopRequested() {
    try {
        if (files.exists(STOP_FLAG)) {
            log("🛑 检测到停止标志 " + STOP_FLAG + "，调度器退出");
            return true;
        }
    } catch (e) {}
    return false;
}

// ========== 悬浮设置面板：改开始/停止时间与轮间休息不用改代码 ==========
// 面板初始化分步执行、每步独立成败：任何一步失败都不影响拖动/停止等其它功能（旧版一步抛错整个面板作废）
let nextIsMain = true; // 交替：先主脚本，再巡检，再主脚本…（提前声明：面板初始化完成时要立即刷一次状态文本）
let UI = null;
let UI_READY = false; // 面板全部监听挂载完成后才置 true；updateStatus 等 UI 操作只认这个标志
let winPos = {x: 24, y: 200};
let drag = {on: false, ox: 0, oy: 0};
const UI_DIAG_LOG = "/storage/emulated/0/脚本/调度ui诊断.log";
try { files.write(UI_DIAG_LOG, ""); } catch (e) {} // 每次启动清空旧诊断日志
function uiLog(msg) {
    let line = "[" + new Date().toLocaleString() + "] " + msg;
    log(line);
    try { files.append(UI_DIAG_LOG, line + "\n"); } catch (e) {}
}

// 面板在独立线程创建：实测 AutoJs6 的 floaty.window 会卡死不返回（窗口已显示但函数不返回，
// 把拖动/停止挂载和调度主循环全堵在后面）。挪到子线程后：卡死只损失面板，调度照常运行。
function buildPanel() {
    uiLog("🔧 面板线程启动");
    let perm = "?";
    try { perm = String(floaty.checkPermission()); } catch (e) { perm = "err:" + e; }
    uiLog("🔍 floaty.checkPermission = " + perm);

// 第 0 步：创建窗口。优先 rawWindow（绕开本机 floaty.window 卡死点），失败再退回 window
function panelXml() {
    return (
        <vertical padding="8" bg="#202124">
            <text id="title" text="⚙️ 灵感雷达·调度（按住标题拖动）" textColor="#ffffff" textSize="12sp"/>
            <text id="status" text="加载中…" textColor="#8bc34a" textSize="11sp"/>
            <horizontal marginTop="4">
                <text text="开始时间" textColor="#cccccc" textSize="12sp" layout_weight="1"/>
                <button id="btnStartMinus" text="-" textColor="#ffffff" textSize="15sp" w="34" bg="#3c4043"/>
                <text id="txtStart" text="09:00" textColor="#ffffff" textSize="14sp" gravity="center" w="64"/>
                <button id="btnStartPlus" text="+" textColor="#ffffff" textSize="15sp" w="34" bg="#3c4043"/>
            </horizontal>
            <horizontal marginTop="4">
                <text text="停止时间" textColor="#cccccc" textSize="12sp" layout_weight="1"/>
                <button id="btnStopMinus" text="-" textColor="#ffffff" textSize="15sp" w="34" bg="#3c4043"/>
                <text id="txtStop" text="21:00" textColor="#ffffff" textSize="14sp" gravity="center" w="64"/>
                <button id="btnStopPlus" text="+" textColor="#ffffff" textSize="15sp" w="34" bg="#3c4043"/>
            </horizontal>
            <horizontal marginTop="4">
                <text text="轮间休息(分)" textColor="#cccccc" textSize="12sp" layout_weight="1"/>
                <button id="btnGapMinus" text="-" textColor="#ffffff" textSize="15sp" w="34" bg="#3c4043"/>
                <text id="txtGap" text="30" textColor="#ffffff" textSize="14sp" gravity="center" w="64"/>
                <button id="btnGapPlus" text="+" textColor="#ffffff" textSize="15sp" w="34" bg="#3c4043"/>
            </horizontal>
            <horizontal marginTop="4">
                <text text="屏幕常亮" textColor="#cccccc" textSize="12sp" layout_weight="1"/>
                <Switch id="swKeepAwake" checked="false"/>
            </horizontal>
            <horizontal marginTop="6">
                <button id="btnStop" text="🛑 停止调度" textColor="#ffffff" textSize="12sp" layout_weight="1"/>
            </horizontal>
            <text text="每次 ±1 分钟，长按快速加减；改动立即生效；停止=退出调度器" textColor="#888888" textSize="10sp"/>
        </vertical>
    );
}
UI = null;
try {
    uiLog("⏳ 尝试 floaty.rawWindow…");
    UI = floaty.rawWindow(panelXml());
    uiLog("✅ floaty.rawWindow 已返回");
} catch (e) {
    uiLog("⚠️ rawWindow 异常：" + e + "，改试 floaty.window…");
    try {
        UI = floaty.window(panelXml());
        uiLog("✅ floaty.window 已返回");
    } catch (e2) {
        UI = null;
        uiLog("❌ floaty.window 也异常（悬浮窗权限？），面板不可用：" + e2);
    }
}

if (UI) {
    // 第 0.5 步：rawWindow 需手动开触摸；控件引用兼容 id 直访与 findViewById 两种方式
    try { UI.setTouchable(true); uiLog("✅ setTouchable(true)"); } catch (e) { uiLog("⚠️ setTouchable 失败：" + e); }
    try {
        if (!UI.title) UI.title = UI.findViewById("title");
        if (!UI.status) UI.status = UI.findViewById("status");
        if (!UI.txtStart) UI.txtStart = UI.findViewById("txtStart");
        if (!UI.txtStop) UI.txtStop = UI.findViewById("txtStop");
        if (!UI.txtGap) UI.txtGap = UI.findViewById("txtGap");
        if (!UI.btnStartMinus) UI.btnStartMinus = UI.findViewById("btnStartMinus");
        if (!UI.btnStartPlus) UI.btnStartPlus = UI.findViewById("btnStartPlus");
        if (!UI.btnStopMinus) UI.btnStopMinus = UI.findViewById("btnStopMinus");
        if (!UI.btnStopPlus) UI.btnStopPlus = UI.findViewById("btnStopPlus");
        if (!UI.btnGapMinus) UI.btnGapMinus = UI.findViewById("btnGapMinus");
        if (!UI.btnGapPlus) UI.btnGapPlus = UI.findViewById("btnGapPlus");
        if (!UI.swKeepAwake) UI.swKeepAwake = UI.findViewById("swKeepAwake");
        if (!UI.btnStop) UI.btnStop = UI.findViewById("btnStop");
        uiLog("✅ 控件引用已就绪");
    } catch (e) {
        uiLog("⚠️ 控件引用初始化失败：" + e);
    }

    // 第 1 步：按住标题拖动（救命功能，最先挂载）
    try {
        UI.title.setOnTouchListener(function(v, e) {
            let a = e.getAction(); // 0=按下 1=抬起 2=移动 3=取消
            if (a === 0) {
                drag.on = true;
                drag.ox = e.getRawX() - winPos.x;
                drag.oy = e.getRawY() - winPos.y;
                return true;
            } else if (a === 2 && drag.on) {
                try {
                    winPos.x = e.getRawX() - drag.ox;
                    winPos.y = e.getRawY() - drag.oy;
                    UI.setPosition(winPos.x, winPos.y);
                } catch (e2) { uiLog("⚠️ 拖动定位失败：" + e2); }
                return true;
            } else if (a === 1 || a === 3) {
                drag.on = false;
                return true;
            }
            return true;
        });
        try { UI.setPosition(winPos.x, winPos.y); } catch (e) {}
        uiLog("✅ 拖动监听已挂载");
    } catch (e) {
        uiLog("❌ 拖动监听挂载失败（面板将无法拖动）：" + e);
    }

    // 第 2 步：停止按钮（救命功能）
    try {
        UI.btnStop.click(function() {
            toast("🛑 调度器退出");
            exit();
        });
        uiLog("✅ 停止按钮已挂载");
    } catch (e) {
        uiLog("❌ 停止按钮挂载失败：" + e);
    }

    // 第 3 步：时间文本初始化
    try {
        UI.txtStart.setText(CFG.start);
        UI.txtStop.setText(CFG.stop);
        UI.txtGap.setText(String(CFG.gapMin));
        uiLog("✅ 时间文本已初始化");
    } catch (e) {
        uiLog("❌ 时间文本初始化失败：" + e);
    }

    // 第 4 步：时间步进器（每次 ±1 分钟，长按快速连加/连减）
    try {
        attachStepper(UI.btnStartMinus, function() { stepTime("start", -1); });
        attachStepper(UI.btnStartPlus, function() { stepTime("start", 1); });
        attachStepper(UI.btnStopMinus, function() { stepTime("stop", -1); });
        attachStepper(UI.btnStopPlus, function() { stepTime("stop", 1); });
        attachStepper(UI.btnGapMinus, function() { stepGap(-1); });
        attachStepper(UI.btnGapPlus, function() { stepGap(1); });
        uiLog("✅ 时间步进器已挂载");
    } catch (e) {
        uiLog("❌ 时间步进器挂载失败：" + e);
    }

    // 第 5 步：常亮开关（先设状态再挂监听避免启动误触发；两种监听方法名都兼容，防不同 AutoJs 版本差异）
    try {
        UI.swKeepAwake.setChecked(CFG.keepAwake);
        uiLog("✅ 常亮开关初始状态已设置");
    } catch (e) {
        uiLog("⚠️ 常亮开关初始状态设置失败：" + e);
    }
    try {
        let onChecked = function(v, checked) {
            let on = !!checked;
            CFG.keepAwake = on;
            writeCfg();
            applyKeepAwake(on, true); // 用户手动拨开关：失败时自动弹系统设置页
            updateStatus();
        };
        if (typeof UI.swKeepAwake.setCheckedChangeListener === "function") {
            UI.swKeepAwake.setCheckedChangeListener(onChecked);
        } else {
            UI.swKeepAwake.setOnCheckedChangeListener(onChecked);
        }
        uiLog("✅ 常亮开关监听已挂载");
    } catch (e) {
        uiLog("❌ 常亮开关监听挂载失败：" + e);
    }

    UI_READY = true; // 全部监听挂载完成后才对外宣布就绪
    updateStatus(); // 立刻把「加载中…」刷成真实状态，不再依赖主循环第一轮
    uiLog("✅ 面板初始化完成");
    log("🪟 悬浮设置面板已显示（按住标题可拖动）");
    }
}
let USE_FLOAT_PANEL = false; // 本机 AutoJs6（魔改版）floaty 卡死：浮窗面板废弃。换正常 AutoJs6 后可改回 true 恢复面板
let USE_START_DIALOG = false; // 本机魔改版连弹窗都会被系统秒拒（实测 dialogs.select 3ms 内返回取消值）：启动对话框也废弃
if (USE_FLOAT_PANEL) {
    threads.start(buildPanel); // 不等待：调度主循环立即往下走，面板卡死也不影响调度
} else {
    uiLog("ℹ️ 浮窗面板已禁用（本机 floaty 卡死），改用启动对话框配置");
}

function updateStatus() {
    if (!UI_READY) return;
    let w = inWindow(nowMin()) ? "🟢 窗口内运行中" : "⏸ 窗口外待机";
    let aw = CFG.keepAwake ? "☀️常亮" : "🌙息屏";
    try { UI.status.setText(w + " · " + aw + " · 下一轮:" + (nextIsMain ? "主" : "巡")); } catch (e) {}
}

// ========== 时间步进器（±1 分钟，长按连发）：不依赖输入法 ==========
function fmtHM(mins) {
    return ("0" + Math.floor(mins / 60)).slice(-2) + ":" + ("0" + (mins % 60)).slice(-2);
}
function refreshTimeLabels() {
    if (!UI_READY) return;
    try {
        UI.txtStart.setText(CFG.start);
        UI.txtStop.setText(CFG.stop);
        UI.txtGap.setText(String(CFG.gapMin));
    } catch (e) {}
}
function stepTime(which, delta) {
    let m = ((parseHM(CFG[which]) + delta) % 1440 + 1440) % 1440;
    CFG[which] = fmtHM(m);
    if (CFG.start === CFG.stop) {
        // 开始=停止会被当作「全天」：再补一步保持时间窗口非退化，避免误开成 24 小时连跑
        m = ((m + delta) % 1440 + 1440) % 1440;
        CFG[which] = fmtHM(m);
        log("⏰ 两端重合，已自动再调 " + delta + " 分钟避免变成全天窗口");
    }
    writeCfg();
    refreshTimeLabels();
    updateStatus();
}
function stepGap(delta) {
    CFG.gapMin = Math.min(1440, Math.max(0, CFG.gapMin + delta));
    writeCfg();
    refreshTimeLabels();
    updateStatus();
}

// 长按连发：按下立即走一步；按住 300ms 后每 80ms 自动再走一步，松手即停
function attachStepper(btn, fn) {
    let timer = null;
    btn.setOnTouchListener(function(v, e) {
        let a = e.getAction(); // 0=按下 1=抬起 2=移动 3=取消
        if (a === 0) {
            fn();
            timer = setTimeout(function repeat() {
                fn();
                timer = setTimeout(repeat, 80);
            }, 300);
            return true;
        } else if (a === 1 || a === 3) {
            if (timer) { clearTimeout(timer); timer = null; }
            return true;
        }
        return true;
    });
}

// ========== 屏幕常亮开关：调度器长驻循环，息屏后进程虽能靠前台服务继续跑，但部分 ROM 息屏后限速/杀后台，常亮最稳 ==========
let keepAwakeOk = false;
let keepWakeLock = null;
function applyKeepAwake(on, fromUser) {
    if (on) {
        let ok = false;
        try { ok = !!device.keepScreenOn(); } catch (e) {}
        if (!ok) {
            // 后台脚本没有 Activity 时 keepScreenOn 会失败：退而直接用 PowerManager WakeLock 持锁
            // （SCREEN_BRIGHT_WAKE_LOCK=10 | ACQUIRE_CAUSES_WAKEUP=0x10000000，AutoJs 自带 WAKE_LOCK 权限）
            try {
                let pm = context.getSystemService(context.POWER_SERVICE);
                keepWakeLock = pm.newWakeLock(10 | 0x10000000, "灵感雷达调度常亮");
                keepWakeLock.acquire();
                ok = true;
            } catch (e) {}
        }
        keepAwakeOk = ok;
        if (ok) {
            log("☀️ 屏幕常亮已开启");
        } else {
            log("⚠️ 屏幕常亮开启失败（两种方式都失败）");
            if (fromUser) {
                openBatteryWhitelistSettings(); // 自动弹系统设置页让用户放行
                if (UI_READY) { try { UI.swKeepAwake.setChecked(false); } catch (e) {} } // 开不动就把开关拨回去，反映真实状态
            }
        }
    } else {
        keepAwakeOk = false;
        try { device.cancelKeepingAwake(); } catch (e) {}
        if (keepWakeLock) { try { keepWakeLock.release(); } catch (e) {} keepWakeLock = null; }
        log("🌙 屏幕常亮已关闭，恢复系统息屏（息屏后请确保 AutoJs 已加入省电白名单）");
    }
}
applyKeepAwake(CFG.keepAwake, false); // 启动时按配置生效，不弹设置页

// 常亮失败时自动弹出省电白名单设置页（一次会话只弹一次，避免反复跳设置）
let batteryPageOpened = false;
function openBatteryWhitelistSettings() {
    if (batteryPageOpened) return;
    batteryPageOpened = true;
    toast("常亮没开成功，帮你打开省电白名单设置：把 AutoJs 设为「不限制」");
    try {
        app.startActivity({action: "android.settings.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS", data: "package:" + context.getPackageName()});
        return;
    } catch (e) {}
    try {
        app.startActivity({action: "android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS"});
    } catch (e) {
        toast("没能自动打开设置页，请手动去：设置 → 电池 → 省电策略 → AutoJs 设为不限制");
    }
    toast("另外建议把 AutoJs 的「自启动」「后台运行」权限也一并放行");
}

log("🔄 灵感雷达双脚本轮流调度器启动");
log("⏰ 时间窗口 " + CFG.start + " → " + CFG.stop + "；每轮（主+巡）后休息 " + CFG.gapMin + " 分钟");
log("🛑 手动停止：AutoJs 停止本脚本 / 创建文件 " + STOP_FLAG);

let prevIn = null; // 窗口进出状态记忆：只在切换时打日志，方便排查「到点没跑」
// ========== 启动配置对话框（替代浮窗面板：dialogs 走 Activity，不受 floaty 卡死影响）==========
function validHM(s) {
    return /^([01]?\d|2[0-3]):[0-5]\d$/.test(String(s));
}
function showConfigDialog() {
    while (true) {
        let aw = CFG.keepAwake ? "开" : "关";
        let choices = [
            "▶ 开始调度",
            "改开始时间（当前 " + CFG.start + "）",
            "改停止时间（当前 " + CFG.stop + "）",
            "改轮间休息（当前 " + CFG.gapMin + " 分）",
            "屏幕常亮：" + aw,
            "🛑 停止退出"
        ];
        let sel = dialogs.select("⚙️ 灵感雷达调度器\n时间窗 " + CFG.start + " → " + CFG.stop + "，每轮后休息 " + CFG.gapMin + " 分", choices);
        if (sel < 0) { // 用户取消/关掉对话框 = 不跑
            toast("已取消，调度器退出");
            exit();
            return;
        }
        if (sel === 0) return; // 开始调度
        if (sel === 5) { toast("🛑 调度器退出"); exit(); }
        if (sel === 1 || sel === 2) {
            let cur = sel === 1 ? CFG.start : CFG.stop;
            let v = dialogs.rawInput("输入" + (sel === 1 ? "开始" : "停止") + "时间（24 小时制 HH:MM）", cur);
            if (v === null) continue;
            v = String(v).trim();
            if (validHM(v)) {
                CFG[sel === 1 ? "start" : "stop"] = v;
                writeCfg();
                toast("已保存：" + v);
            } else {
                toast("格式不对，应为 HH:MM，如 09:30");
            }
        } else if (sel === 3) {
            let v = dialogs.rawInput("每轮（主+巡）后的休息分钟数（0-1440）", String(CFG.gapMin));
            if (v === null) continue;
            let n = parseInt(v, 10);
            if (!isNaN(n) && n >= 0 && n <= 1440) {
                CFG.gapMin = n;
                writeCfg();
                toast("已保存：" + n + " 分");
            } else {
                toast("应为 0-1440 的整数");
            }
        } else if (sel === 4) {
            CFG.keepAwake = !CFG.keepAwake;
            writeCfg();
            applyKeepAwake(CFG.keepAwake, false);
            toast(CFG.keepAwake ? "☀️ 屏幕常亮已开" : "🌙 屏幕常亮已关");
        }
    }
}

if (USE_START_DIALOG) {
    showConfigDialog(); // 弹配置对话框（仅正常 AutoJs 环境可用）
} else {
    log("📝 改时间/休息：用文件管理器编辑 " + CFG_PATH + "（每轮循环自动重读，无需重启）");
    log("   格式示例：{\"start\":\"09:00\",\"stop\":\"21:00\",\"gapMin\":30}");
}
uiLog("🚀 调度主循环启动：" + CFG.start + " → " + CFG.stop + "（面板" + (UI_READY ? "已就绪" : "已禁用或创建中，不影响调度") + "）");
while (true) {
    if (stopRequested()) break;
    CFG = loadCfg(); // 重读配置：面板/文件改的开始、停止时间立即生效
    updateStatus();
    let inW = inWindow(nowMin());
    if (prevIn !== inW) {
        prevIn = inW;
        log(inW
            ? "🕙 " + new Date().toLocaleString() + " 进入时间窗口 " + CFG.start + "→" + CFG.stop + "，开始轮换运行"
            : "🌙 " + new Date().toLocaleString() + " 离开时间窗口，待机至 " + CFG.start);
    }
    if (!inW) {
        if (!sleepUntilStart()) break;
        continue;
    }
    if (nextIsMain) runOne(MAIN_SCRIPT, "主脚本", 120 * 60 * 1000);
    else runOne(PATROL_SCRIPT, "巡检脚本", 90 * 60 * 1000);
    nextIsMain = !nextIsMain;
    if (nextIsMain) gapSleep(CFG.gapMin); // 一轮（主+巡）结束后休息
}
