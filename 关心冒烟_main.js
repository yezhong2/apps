"ui";
// ============================================================================
// 关心 v0.1.1（AutoJs6 打包 App · 个人向）— 2026-10-15 ccode 按用户点单制作
// 设计稿：/storage/emulated/0/脚本/关心_设计稿.md（使命：让主人各方面越来越好）
// v0.1.1（2026-10-15 晚，用户点单「开工」）：耳朵＋AI 大脑——点「说给它听」录音（MediaRecorder）→
//   本机 whisper 转写（Termux 语音服务 关心_语音服务.js，全离线不花钱）→ glm-4-flash 回话 → TTS 说出；
//   打字聊天升级 AI（离线自动回落本地规则；「记：/忘掉」仍走确定性本地）；摄像头探路按钮（getUserMedia 实测）。
//   转写协议：App 写 脚本/关心_语音_请求.json {id,audio} → 服务写 关心_语音_结果.json {id,ok,text}
// v0.1.3（2026-10-15 深夜）：眼睛——webview getUserMedia 被拒（NotAllowedError 实锤）后改走
//   系统相机原生路线：FileProvider(content://) 发射 EXTRA_OUTPUT → 拍到 脚本/关心_照片/ →
//   **原图直发**（>3MB 才缩：2048/92 或 1600/90）→ 视觉模型看图 → 口语化 1-2 句说出（2026-10-22 主人纠正：以前一直偷偷缩 1024/80，小字看不清）；2026-10-19 用户点单删掉面板按钮「📷 看看这个」（相机能力保留）。
// v0.1.5（2026-10-15 深夜·用户点单）：①换脑——对话升 glm-z1-flash 推理档（免费；回复前先思考，
//   stripThink 剥 <think>；max_tokens 1100 超时 28s）；②连续对话「🎧」——VAD 自动断句（静音 1.2s
//   断句→转写→AI→TTS→自动再听；45 秒无声音自动退出）；③视频对话「👁」——悬浮小窗真 Surface 定时
//   takePicture 抓帧→glm-4v 看→说话（最多 2 分钟；夜里黑=看不清会明说）。
// v0.1.6（2026-10-15 深夜·队列⑰）：串音修复——①SPEAK_LOCK（预计出声结束时刻）：liveContinue
//   续录前等锁清零，录音期间视频发言/事件播报一律静音只记录（防 TTS 被话筒收进去）；
//   ②voiceStart 开始录音时主动打断正在播的 TTS（用户要说话优先）；③speak 遇 REC.on 直接静音。
// v0.2.0（2026-10-15 深夜·用户点单「直接上真 3D」）：3D 小人——悬浮窗 webview + three.js(r137) +
//   RobotExpressive.glb（CC0；14 个现成动画：Dance/Wave/Jump/ThumbsUp/No/Punch/Death/WalkJump…）——
//   面板「🤖 3D小人」开关（与 emoji 宠物二选一显示）；待机小动作/全屏漫游（Walking+窗口走位）/事件联动
//   （庆祝 Dance/FIXED ThumbsUp/关切 No）/台词气泡转发（presentSay→careBubble）；页面内触控：点它=随机逗趣动作。
// v1.5.10（2026-10-18 15:2x·用户报障「看聊天记录」）：她说「我没收入320也没支出255」时，关心只
//   read_money 把旧数字念了一遍、钱一分没改。根因＝动作表里只有「纠正数字」的说法，没把「否认某笔账存在」
//   归进去，且没有清空当天的动作。修法全在「指挥模型」层：①新增 clear_money 动作（接 money_clear_day）
//   ②money_set_day / money_clear_day 的工具说明里点明「否认某笔账 / 都是试的」场景
//   ③自述提示词与硬规则都加一句「绝不能只 read_money/read_data 把旧数字念一遍，那等于没改」。
//   零写死判据，判断权仍在模型；回归：记账更正_test 10/10、core 150/150、dom 90/90。
// v1.5.11（2026-10-18 15:5x·用户点单）：悬浮路况图——面板「🚦 路况」或说「看下路况 / 我要去 XX」
//   就弹一张带实时路况色的高德地图（红堵/黄缓/绿通，图层自带、60 秒自刷），能拖、能缩放、点关闭即销毁。
//   路况色是高德 TileLayer.Traffic 给的，App 不做任何「算路况」判断；key/安全密钥存
//   脚本/关心_地图配置.json（不进 APK、不进公开仓），没配就明确提示去配。页面 路况.html 随包发布。
// v0.1 能力：2 角色（元气小捧场王＋温柔小护士）· 悬浮形象+表情 · 系统 TTS 说话 ·
//   戳互动 · 流水线庆祝/关切两场景 · 设备健康关切（电量/温度/存储/充电提醒）·
//   谈心&本地记忆骨架 · 安静策略（勿扰/限频/重要度分级/被忽略降频）· 声音总开关
// 数据面（脚本/ 下，Termux/ccode 可读）：
//   关心_状态.json（角色/开关/水位/频次/事件流） 关心_安静.json（安静策略配置）
//   关心_记忆.json（关于你/情绪时间线/对话）   关心_对话.log  关心_调试.log  关心_信标.log
// 网页桥：index.html ←$autojs.invoke→ web.jsBridge.handle（status/setChar/setSound/setFloat/
//   quietSet/chat/factAdd/factDel/poke/sayTest/simEvent/openOverlayPerm/openBattPerm/diag）
// 教训内置：早启动三通道信标 · 无 setInterval（threads 跑活）· 浮窗 XML 无单位数值按 dp 实算 ·
//   saveJSON java 直写（files.write 的 FUSE 假败会整会话降级私有目录）· 界面更新直调优先（ui.run 仅兜底）
// 边界（设计稿）：Live2D 不做（表情=emoji 档）；摄像头/麦克风=后续版本；说活受安静策略管控
// ============================================================================
try { toastLog("🧡 关心 v0.1.0 引擎启动检查 " + new Date().toLocaleTimeString()); } catch (eT) {}
try { var __d0 = "/storage/emulated/0/脚本"; var __f0 = new java.io.File(__d0); if (!__f0.exists()) __f0.mkdirs(); var __o0 = new java.io.FileOutputStream(__d0 + "/_引擎启动.txt", false); __o0.write(new java.lang.String("关心 启动 " + new Date()).getBytes("UTF-8")); __o0.close(); } catch (e0) {}
try { var __d1 = "/storage/emulated/0/Android/media/org.yezhong2.care"; var __f1 = new java.io.File(__d1); if (!__f1.exists()) __f1.mkdirs(); var __o1 = new java.io.FileOutputStream(__d1 + "/_引擎启动.txt", false); __o1.write(new java.lang.String("关心 启动 " + new Date()).getBytes("UTF-8")); __o1.close(); } catch (e1) {}
try { var __o2 = new java.io.FileOutputStream("/storage/emulated/0/Download/_引擎启动.txt", false); __o2.write(new java.lang.String("关心 启动 " + new Date()).getBytes("UTF-8")); __o2.close(); } catch (e2) {}

ui.layout(
    <vertical>
        <webview id="web" url="index.html" w="*" h="*"/>
    </vertical>,
);
let web = ui["web"];

// 【每次出包必须同步改这里】1.5.22 装机时漏改了——包管理器确实装的是 1.5.22，但 App 自报
//   启动日志/实例.json 还写 1.5.21（2026-10-18 17:14 实证），后续查版本会被绕糊涂。改版本号时：
//   project.json 的 versionName/versionCode ＋ 这一行，两处一起改。
// 【2026-10-19 用户第三次点出「左上角版本号装了这么多版一直没变」】——根因就是下面这行手写常量：
//   打包时只升了 project.json，这行忘了跟着改，于是左上角、启动信标、实例.json 全报旧版本
//   （1.5.22、2.0.3 已经栽过两次，这次是第三次）。彻底改法：运行时直接读 APK 自己的 versionName，
//   取不到才退回下面的兜底常量——以后只改 project.json 一处就够，不可能再对不上。
let VER = "2.6.4";   // 兜底值（与 project.json 的 versionName 保持一致，有测试锁着）
// 【2026-10-19 实机纠正】上一版写成 app.versionName，结果左上角显示 **6.7.0**——那是宿主 AutoJs6 的版本号，
// 不是打包后 App 的版本。正确做法：拿本 App 自己的包名去 PackageManager 读 versionName；
// 只有在 AutoJs6 里直接跑源码（包名是 org.autojs.autojs6）时才用下面的兜底常量。
try {
    var _pk = (app && app.getPackageName) ? String(app.getPackageName()) : "";
    if (_pk && _pk !== "org.autojs.autojs6") {
        var _pi = context.getPackageManager().getPackageInfo(_pk, 0);
        if (_pi && _pi.versionName) VER = String(_pi.versionName);
    }
} catch (eVn) {}
try { if (!VER || VER === "undefined" || VER === "null") VER = "2.3.50"; } catch (eVn2) {}
// v2.1.5（2026-10-19 02:2x，用户：「我受够了智谱模型了，要把我逼疯，换模型」）：
//   新增**换模型配置层**——读 脚本/关心_模型配置.json，chatUrl/chatKey/各用途模型名/vision* 都可配；
//   缺省一律退回智谱默认。以后换家只改那个文件，1 分钟内生效，**不用重装**。
//   调用点全部改走 careCfgUrl/careCfgKey/careCfgList（对话 9 处 + 看图 2 处）。
// v2.1.4（2026-10-19 02:1x，用户点单「账本显示和元素显示都加上历史查看按钮，可以随时查看所有历史」）：
//   面板「💰 跑车」卡加「📜 账本历史」、元素行加「📜 元素历史」，点开是整屏浮层，按天倒序列出
//   本地存着的全部记录（账本：每天收/支/净/在线/单量 + 每笔明细；元素：每天几顿 + 13 项估算合计）。
//   桥新增 hist(money|elem, days)，days=0 表示全部；只读，不动任何数据。
// v2.1.3（2026-10-19 02:0x，用户骂「你是猪吗？我说昨天的」）：查账只有「今天」口径——当天没账时
//   careMoneyTodayText() 直接返回「每月固定支出 2200 元…」，于是问「昨天的记账」得到的是车租金，答非所问。
//   新增按天查账 careMoneyDayText(0=今天/1=昨天/2=前天/N天前)＋careMoneyArgText 把模型给的 day/days 翻成话；
//   read_money 动作与 money_report 工具都支持 day 参数（动作表/工具说明里写明「问哪一天就填 day」）；
//   read_data 的账本段改成「今天｜昨天」两行，模型再不会被今天的空账骗。
// v2.1.2（2026-10-19 01:5x，用户问「黄字回复都是写死的吗？绿色字才是接通 AI 的」）：颜色其实是**角色**
//   （元气=橙黄 #ffcf9a、护士=青绿 #8fe3c4），跟「AI 还是写死」没关系——这个误会必须用事实打消：
//   现在每条回复都在 MEM.chat 里记 eng（ai／plan(xxx)／local／ai-down），面板聊天记录给每条加小标签：
//   绿框「AI」= 真调了模型，紫框「本地」= 本地确定性快回，红框「没接通」= 模型没连上。
// v2.1.1（2026-10-19 01:4x，用户报「看聊天记录咋还是没接通呢」）：删掉工具循环里那条**写死的**
//   「嘴上说做了」正则判据（已经/已记/记下了…）。它会把正常回话当成撒谎：主人问「我上次问你的问题
//   你能理解了吗」，模型答「我已经理解了」→ 一个「已经」就中招 → 整句被丢、改成「没接通」。现在模型
//   给了文字就照它的回（诚实交给系统提示词＋计划路径的完整性自查）。
// v2.1.0（2026-10-19 00:5x，用户问「关心 app 为啥几句话就超限了？我刚充值了额度」）：
//   两件事分开说——①「超限」＝**本 App 自己的工具轮次上限**（3 轮），不是账户额度：日志 00:52:07
//   「AI 未接通（计划与工具两条路都失败）：工具轮次超限」，那句话连查三样数据就把 3 轮花光、
//   模型没机会开口。改成 4 轮 + 轮次用尽后补一轮「不带 tools 的收口」（只能说话，把已查到
//   的真数据讲成人话）。②「几句话就烧钱」＝一枪一句不假：计划路径 + 工具路径都要打，每枪带
//   14 轮历史与 3k 字系统提示（实测计划枪 prompt_tokens≈2185）；「昨天的」那句一晚打了 2 计划 +
//   3 工具共 5 枪。现在每次调用把 API 真实用量写进调试日志（careUsageLog），下回能拿数对账，不再靠猜。
let BASE = "/storage/emulated/0/脚本";
let STATE_P = BASE + "/关心_状态.json";
let QUIET_P = BASE + "/关心_安静.json";
let MEM_P = BASE + "/关心_记忆.json";
let CHAT_LOG = BASE + "/关心_对话.log";
let DBG = BASE + "/关心_调试.log";
let BCN = BASE + "/关心_信标.log";
let PROG = BASE + "/PROGRESS.md";
let VOICE_DIR = BASE + "/关心_语音";
let VREQ = BASE + "/关心_语音_请求.json";
let VRES = BASE + "/关心_语音_结果.json";
let PRIV = "";
try { PRIV = String(context.getFilesDir().getAbsolutePath()); } catch (e) { PRIV = "/data/local/tmp"; }
let WRITE_BASE = BASE;

function nowStr() { let d = new Date(); function p(n) { return ("0" + n).slice(-2); } return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + " " + p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds()); }
function log(msg) {
    var line = "[" + nowStr() + "] " + msg + "\n";
    try { javaWriteLine(DBG, line); return; } catch (e) {}
    try { javaWriteLine(PRIV + "/关心_调试.log", line); } catch (e2) {}
}
// ============================================================================
// 【2026-10-19 用户点单】「它自己在干嘛的时候我也想看到它在干嘛，像你一样」
//   动作流水：App 每做一件事（在想什么、调了哪个工具、改了哪个文件、打包到哪一步）
//   ① 落到 脚本/关心_动作流水.log（App 重启后还能回看）
//   ② 内存留最近 120 条给面板显示
//   ③ busy＝正在做的那一件（面板置顶，像 ccode 的运行轨迹）
//   纪律：只记「用户能感知的动作」，心跳/轮询类一律不记（否则刷屏反而看不见重点）。
var ACT = { ring: [], n: 0, busy: null, loaded: false };
var ACT_FILE = "/storage/emulated/0/脚本/关心_动作流水.log";
// 「一边干一边简单说」：每一步配一句人话（2026-10-19 用户点单）。这是**展示用话术**，不是判据——
//   判断仍然全交给模型；这里只负责把已经发生的动作翻译成主人听得懂的一句。
//   新增工具时若忘了加，会退回「我动手：<工具名>」，不会崩、也不会静默。
var ACT_KIND_SAY = {
    "在想": "我听听你说啥",
    "想好了": "我想明白了",
    "做": "我去办",
    "工具": "我动手",
    "自更新": "我给自己装新版本",
    "轨迹": "我记一下位置"
};
var ACT_TOOL_SAY = {
    track_query: "我查一下今天的轨迹和里程",
    phone_usage: "我翻一下手机使用时段",
    web_search: "我上网搜一下",
    money_report: "我翻一下账本",
    money_add: "我记一笔账",
    money_set_day: "我把今天的账改成你说的数",
    money_clear_day: "我把今天的账清掉",
    read_file: "我读一下那个文件",
    search: "我去文件里搜一下",
    list_dir: "我看一眼那个文件夹",
    code_edit: "我改一下自己的代码",
    code_write: "我写一份文件进去",
    self_update: "我申请打包更新自己",
    update_status: "我看看更新到哪一步了",
    read_live: "我看一眼你现在的状态",
    place_name: "我记住这个地方叫什么",
    diet_note: "我把这顿记下来",
    diet_plan: "我按你的预算排一下今天怎么吃",
    elem_detail: "我算一下你缺多少元素",
    fact_add: "我记一条关于你的事",
    fact_del: "我把那条记忆删掉",
    metric_add: "我把这个指标记下来",
    rest_start: "我开始给你计时休息",
    rest_stop: "我把休息计时停掉",
    rest_set_day: "我把今天的休息改成你说的数",
    work_start: "我记你出车了",
    work_end: "我记你收车了",
    full_analysis: "我给你出一份完整分析",
    read_data: "我把数据都念一遍"
};
var ACT_PLAN_SAY = {
    chat: "我陪你聊两句",
    add_money: "我记一笔账",
    set_money: "我把今天的账改成你说的数",
    clear_money: "我把今天的账清掉",
    add_diet: "我把这顿记下来",
    add_fact: "我记一条关于你的事",
    add_metric: "我把这个指标记下来",
    set_rest: "我把今天的休息改成你说的数",
    start_rest: "我开始给你计时休息",
    stop_rest: "我把休息计时停掉",
    add_rest: "我补记一次休息",
    read_rest: "我查一下休息",
    read_money: "我翻一下账本",
    read_energy: "我看看你的精力",
    read_live: "我看一眼你现在的状态",
    read_file: "我读一下那个文件",
    search: "我去文件里搜一下",
    list_dir: "我看一眼那个文件夹",
    code_edit: "我改一下自己的代码",
    code_write: "我写一份文件进去",
    self_update: "我申请打包更新自己",
    update_status: "我看看更新到哪一步了",
    open_traffic: "我给你弹路况图",
    // 2026-10-23 第一步「手」：计划档也要能真的动手（不然就跟之前一样：说「正在帮你打开」但什么都没开）
    open_app: "我去帮你打开",
    look_screen: "我看一眼屏幕",
    tap: "我点它一下",
    full_analysis: "我给你出一份完整分析",
    multi: "我一件事一件事办",
    start_work: "我记你出车了",
    end_work: "我记你收车了",
    set_fixed: "我记一笔固定支出"
};
function actSay(kind, text) {
    var t = String(text || "");
    var head = t.split(/\s+/)[0];
    if (kind === "工具") return ACT_TOOL_SAY[head] || ("我动手：" + head);
    if (kind === "做") return ACT_PLAN_SAY[head] || ("我去办：" + head);
    return ACT_KIND_SAY[kind] || kind;
}
function actReadAll(p) {
    var fis = new java.io.FileInputStream(p);
    var br = new java.io.BufferedReader(new java.io.InputStreamReader(fis, "UTF-8"));
    var sb = new java.lang.StringBuilder(), ln;
    while ((ln = br.readLine()) !== null) sb.append(ln).append("\n");
    br.close(); fis.close();
    return String(sb.toString());
}
function actLoadHistory() {
    if (ACT.loaded) return; ACT.loaded = true;
    try {
        var f = new java.io.File(ACT_FILE);
        if (!f.exists()) return;
        var lines = actReadAll(ACT_FILE).split("\n"), keep = [];
        for (var i = Math.max(0, lines.length - 121); i < lines.length; i++) {
            var s = String(lines[i] || "");
            if (!s) continue;
            var m = s.match(/^\[(.*?)\] (▶ )?(.*?)｜([\s\S]*)$/);
            if (!m) continue;
            var body = String(m[4]), cut = body.indexOf("‖");
            keep.push({
                t: 0, ts: m[1], k: m[3],
                s: cut >= 0 ? body.slice(0, cut) : body,
                x: cut >= 0 ? body.slice(cut + 1) : "",
                busy: !!m[2]
            });
        }
        ACT.ring = keep.slice(-120);
    } catch (e) {}
}
function actTrimIfBig() {
    try {
        var f = new java.io.File(ACT_FILE);
        if (!f.exists() || f.length() < 300 * 1024) return;
        var lines = actReadAll(ACT_FILE).split("\n");
        javaWriteJSON(ACT_FILE, lines.slice(Math.max(0, lines.length - 400)).join("\n") + "\n");
    } catch (e) {}
}
function actLog(kind, text) {
    try {
        actLoadHistory();
        var it = { t: Date.now(), k: String(kind || ""), x: String(text == null ? "" : text).slice(0, 240) };
        it.s = actSay(it.k, it.x);
        ACT.ring.push(it); ACT.n++; ACT.busy = null;
        while (ACT.ring.length > 120) ACT.ring.shift();
        javaWriteLine(ACT_FILE, "[" + nowStr() + "] " + it.k + "｜" + it.s + "‖" + it.x + "\n");
        if (ACT.n % 50 === 0) actTrimIfBig();
        return it;
    } catch (e) { return null; }
}
function actBusy(kind, text) {
    try {
        actLoadHistory();
        ACT.busy = { t: Date.now(), k: String(kind || ""), x: String(text == null ? "" : text).slice(0, 240) };
        ACT.busy.s = actSay(ACT.busy.k, ACT.busy.x);
        javaWriteLine(ACT_FILE, "[" + nowStr() + "] ▶ " + ACT.busy.k + "｜" + ACT.busy.s + "‖" + ACT.busy.x + "\n");
    } catch (e) { ACT.busy = null; }
    return ACT.busy;
}
// 【2026-10-19 用户「你能不能自己一步一步看着来，不要我一直叫你」】自主续跑：
//   主人是在让你把一件事办完（不是一问一答）时，模型可以调 auto_next 自己接着干下一轮；
//   每调用一次给/续 8 格，扣完自动停；主人发新消息立刻打断。**要不要继续由模型判断**，这里只管计数与打断。
var AUTO = { left: 0, next: "", timer: null };// 网络抖动自动补发：全档位都没接通时，30 秒后自己把这句话重跑一遍（成功就把结果说出来）
var NETRETRY = { msg: "", at: 0, n: 0, timer: null };
// 2026-10-20 11:18 实锤（第二次同类事故）：Wi-Fi 断了一分多钟，一次 30 秒的补发根本不够——
//   补发那一刻网还没回来，照样失败，然后这句话就没了。改成**盯网络续试**：
//   4 轮（30 秒 / 1 分 / 2 分 / 4 分，累计约 7 分钟）；每轮先看设备到底有没有网，
//   没网就只等不吃次数（不计入 4 轮），网一回来立刻把这句话重发；
//   主人这期间说新话 → NETRETRY.msg 被改写，旧补发自动作废（新话优先）。
function netRetryTry() {
    var base = NETRETRY.msg;
    if (!base) return;
    var online = true;
    try { online = careNetOnline(); } catch (eOn) { online = true; }
    if (!online) {                       // 网没回来：不算一轮，30 秒后再看
        try { NETRETRY.timer = setTimeout(netRetryTry, 30000); } catch (eT0) {}
        return;
    }
    // 同 2026-10-19 16:16 那个坑：setTimeout 回调在 UI 主线程，网络请求必须走子线程
    try {
        threads.start(function () {
            try { doChat("（系统·重试）" + base); } catch (eNR) { log("自动补发失败：" + eNR); }
        });
    } catch (eT2) { log("自动补发起线程失败：" + eT2); }
}
function autoClear(why) {
    if (AUTO.timer) { try { clearTimeout(AUTO.timer); } catch (e) { } AUTO.timer = null; }
    var had = AUTO.left > 0 || AUTO.next;
    AUTO.left = 0; AUTO.next = "";
    if (why && had) { try { log("自主续跑停：" + why); } catch (e2) { } }
}
function actArgsText(a) {    try { var s = JSON.stringify(a || {}); if (!s || s === "{}") return ""; return s.length > 90 ? s.slice(0, 90) + "…" : s; } catch (e) { return ""; }
}
function BEACON(tag) {
    var line = "[" + nowStr() + "] " + tag + "\n";
    var dirs = ["/storage/emulated/0/脚本", "/storage/emulated/0/Android/media/org.yezhong2.care"];
    for (var i = 0; i < dirs.length; i++) {
        try {
            var jf = new java.io.File(dirs[i]);
            if (!jf.exists()) jf.mkdirs();
            var fos = new java.io.FileOutputStream(dirs[i] + "/关心_信标.log", true);
            fos.write(new java.lang.String(line).getBytes("UTF-8"));
            fos.close();
        } catch (e2) {}
    }
}
function javaWriteLine(p, line) { var fos = new java.io.FileOutputStream(p, true); fos.write(new java.lang.String(line).getBytes("UTF-8")); fos.flush(); fos.close(); }
function javaWriteJSON(p, s) { var f = new java.io.FileOutputStream(p, false); f.write(new java.lang.String(s).getBytes("UTF-8")); f.flush(); f.close(); }
// v1.5.2：记忆合并——主目录（权威）＋旧副本（离线期间新记的）按时间并起来，谁也不丢
function careMergeArr(a, b) {
    var out = [], seen = {}, all = (a || []).concat(b || []);
    for (var i = 0; i < all.length; i++) {
        var x = all[i];
        if (!x || typeof x !== "object") continue;
        var k = String(x.t || x.s || x.e || "") + "|" + String(x.text || x.me || x.name || x.cat || "") + "|" + String(x.amt == null ? "" : x.amt);
        if (seen[k]) continue;
        seen[k] = 1; out.push(x);
    }
    out.sort(function (p, q) { return (p.t || p.s || 0) - (q.t || q.s || 0); });
    return out;
}
function careMergeMem(main, stale) {
    // v1.5.15（2026-10-18 16:1x·用户第六次报「账本老是还原成错误的，都无数次了」）：
    // 【事故机理】money / rest / fixed 都是**可以改小、可以删**的数据（说「那笔不是我的」「改成0」）。
    //   旧写法把主副本和旧副本无脑取并集，于是**被删掉的旧记录又被并回来**——这就是「还原成错误的」。
    //   加上重装后旧进程还在跑、各自持一份旧 MEM，谁最后保存谁覆盖，错误数字就反复出现。
    // 【现在的规矩】只增不减的（facts / mood / chat / 健康档案）才合并并集；
    //   钱、休息、固定支出、工作状态一律**主副本说了算**（主副本是磁盘上的当下真相，内存里的旧数不能盖回去）。
    // 【不写死判断】这里全是数据层的确定语义（合并策略），不涉及「哪句话算什么动作」——那个仍归模型。
    var m = main || {}, s = stale || {};
    var uni = ["facts", "mood", "chat"];
    for (var i = 0; i < uni.length; i++) { var k = uni[i]; m[k] = careMergeArr(m[k], s[k]); }
    var auth = ["money", "rest", "fixed", "work"];
    for (var j = 0; j < auth.length; j++) {
        var k2 = auth[j];
        if (m[k2] === undefined) m[k2] = s[k2];        // 主副本根本没这一段（旧文件）才用内存里的补上
    }
    try {
        var H = m.health || {}, HS = s.health || {};
        var hk = ["diet", "sleep", "notes", "metrics"];
        for (var j2 = 0; j2 < hk.length; j2++) { H[hk[j2]] = careMergeArr(H[hk[j2]], HS[hk[j2]]); }
        for (var kk in HS) { if (H[kk] === undefined) H[kk] = HS[kk]; }
        m.health = H;
    } catch (eH) {}
    for (var k3 in s) { if (m[k3] === undefined) m[k3] = s[k3]; }
    return m;
}
function saveJSON(p, o) {
    var txt = JSON.stringify(o);
    // v0.5.7：本次数据是从私有旧副本兜底读来的（主目录当时读不到）→ 只写私有目录，绝不覆盖主目录，
    // 否则会把主目录里更新的健康/饮食/元素档案洗成旧数据（2026-10-17 两次实证）。
    if (MEM_STALE && p.indexOf(BASE) === 0 && PRIV && PRIV !== BASE) {
        // v1.1.4（2026-10-18 00:0x·用户「明明计时了，大退就没了」实证）：原来一旦判定「旧副本态」，
        // **整个进程生命周期都不再写主目录**，而且是静默的——于是 22:33 之后所有 rest/账本/档案全部只写进私有目录，
        // 大退 App 就全丢（关心_记忆.json 实测停在 22:33，期间三次「已开始计时休息」一条没落盘）。
        // 现在改成**每次写都先探一次主目录**：能读到就说明权限已恢复/本来就是好的 → 解除旧副本态正常写主目录；
        // 读不到才继续只写私有（保住「不许用旧副本洗掉主目录新数据」的原意）。
        var curMain = null;
        try { curMain = readText(p); } catch (eC0) {}
        if (!curMain) {
            try { javaWriteJSON(p.replace(BASE, PRIV), txt); return true; } catch (eStale) { try { log("MEM 旧副本态，写主目录被拦下：" + p.split("/").pop()); } catch (eL2) {} return false; }
        }
        // v1.5.2（2026-10-18 用户报「账本又还原了」实锤）：主目录能读 ≠ 可以用旧副本把它盖掉。
        // 出事实录：12:55 重装把权限重置→App 以「旧副本」起（缺 12:44 记的车租金）→12:56 权限恢复后
        // 第一笔写就把旧副本刷回主目录，车租金和当天账全没了。
        // 现在：记忆文件在自愈这一刻做一次**按时间合并**（主目录优先，旧副本里新记的并进来），合并不了就不写。
        if (p === MEM_P) {
            var mainObj = null;
            try { mainObj = JSON.parse(curMain); } catch (ePJ) { mainObj = null; }
            if (!mainObj) {
                try { javaWriteJSON(p.replace(BASE, PRIV), txt); } catch (eW0) {}
                try { log("MEM 自愈：主目录 JSON 解析失败，暂不覆盖（继续写私有）"); } catch (eL4) {}
                return false;
            }
            try {
                var nf0 = (mainObj.facts || []).length, fx0 = (mainObj.fixed || []).length;
                MEM = careMergeMem(mainObj, MEM);
                txt = JSON.stringify(MEM);
                log("MEM 自愈合并：主目录 facts " + nf0 + "→" + (MEM.facts || []).length + "，fixed " + fx0 + "→" + (MEM.fixed || []).length);
            } catch (eMg) {
                try { javaWriteJSON(p.replace(BASE, PRIV), txt); } catch (eW1) {}
                log("MEM 合并失败（保护主目录不覆盖）：" + eMg);
                return false;
            }
        }
        MEM_STALE = false;
        try { log("MEM 旧副本态已自愈（主目录可读）→ 恢复写主目录：" + p.split("/").pop()); } catch (eL3) {}
    }
    try { javaWriteJSON(p, txt); WRITE_BASE = BASE; return true; }
    catch (e0) {
        try { files.write(p, txt); WRITE_BASE = BASE; return true; }
        catch (e) {
            try { sleep(300); files.write(p, txt); WRITE_BASE = BASE; return true; } catch (eRe) {
                try { javaWriteJSON(p.replace(BASE, PRIV), txt); WRITE_BASE = PRIV; log("写 " + p + " 失败，本次降级私有目录：" + eRe); return true; } catch (e2) { log("写 " + p + " 失败（私有目录也不通）：" + e2); return false; }
            }
        }
    }
}
function readText(p) {
    try {
        var fi = new java.io.FileInputStream(p);
        var br = new java.io.BufferedReader(new java.io.InputStreamReader(fi, "UTF-8"));
        var sb = "", ln;
        while ((ln = br.readLine()) !== null) sb += ln + "\n";
        br.close();
        return sb;
    } catch (e) { try { return files.read(p); } catch (e2) { return null; } }
}
function loadJSON(p) {
    var t = readText(p);
    if (t) { try { return JSON.parse(t); } catch (e) {} }
    if (p.indexOf(BASE) === 0 && PRIV && PRIV !== BASE) {
        var t2 = readText(p.replace(BASE, PRIV));
        if (t2) { try { __MEM_FROM_PRIV = true; return JSON.parse(t2); } catch (e2) {} }
    }
    return null;
}
function tailLines(p, n) {
    var s = readText(p);
    if (!s) return [];
    var arr = s.split("\n"); var out = [];
    for (var i = Math.max(0, arr.length - n); i < arr.length; i++) { if (arr[i] !== "") out.push(arr[i]); }
    return out;
}
BEACON("A0 脚本开始（VER=" + VER + "）");

// ===== v1.5.20：单实例守卫（治「账本老是还原成错误的」的最后一块）=====
// 【为什么】2026-10-18 16:33 实锤：同一条聊天请求被处理了**两遍**（日志里「路况窗位置/路况窗已开」各两条，
//   相隔 0 秒），说明重装后**旧进程还活着、新进程又起来了**。两个实例各持一份内存里的 MEM，
//   谁后保存谁覆盖 ⇒ 用户改对的账本被旧数据刷回去（这就是「还原成错误的」反复出现的机制根因）。
// 【做法】启动时写一份 脚本/关心_实例.json {pid,t,ver}；定时读它——如果发现**比自己更晚启动**的实例在跑，
//   就自己安静退出（留日志），让最新那个实例独占写盘。判据只看「启动时间新旧」，不做任何业务判断。
// 【注意】①退出用 exit()，不弹任何界面（用户 10-10 规则：不推翻窗/不拉设置页）；
//   ②只在新实例真的更晚（>1 秒）时才退，避免同一秒内两次写入互相踢掉；③文件丢了就重写，不影响使用。
// 【失败表现】若两个实例互踢（反复退出），日志会连续出现「检测到更新的实例」，把两份的 pid/t 都打出来。
var INST_P = BASE + "/关心_实例.json";
var INST_T0 = Date.now();
var INST_ID = 0;
try { INST_ID = android.os.Process.myPid(); } catch (eIns0) { INST_ID = Math.floor(Math.random() * 1000000); }
function careInstClaim() { try { javaWriteJSON(INST_P, JSON.stringify({ pid: INST_ID, t: INST_T0, ver: VER })); } catch (eIc) {} }
function careInstBeat() {
    try {
        var raw = readText(INST_P);
        var o = null;
        if (raw) { try { o = JSON.parse(raw); } catch (eIj) { o = null; } }
        if (o && o.pid && String(o.pid) !== String(INST_ID) && Number(o.t || 0) > INST_T0 + 1000) {
            log("检测到更新的实例（pid " + o.pid + " t=" + o.t + " ver=" + o.ver + "）→ 本进程 pid " + INST_ID + "（t=" + INST_T0 + "）自动退出，避免两个实例抢着写账本");
            BEACON("X1 旧实例自动退出");
            exit();
            return true;
        }
        if (!o || !o.pid) careInstClaim();     // 文件被删/写坏 → 重新占位
    } catch (eIb) {}
    return false;
}
careInstClaim();
if (!careInstBeat()) {
    try { threads.start(function () { for (;;) { sleep(30000); try { careInstBeat(); } catch (eIl) {} } }); } catch (eIt) {}
}

// ===== CARECORE_START =====
// （纯逻辑核：角色/文案/行解析/水位/安静策略/健康/谈心——本段可被 node 单测）
var CARECORE = (function () {
    var CHARS = {
        genki: { id: "genki", name: "元气小捧场王", faces: { idle: "😊", poke: "😆", happy: "🥳", concern: "🫨", sleep: "😴", blink: "😉", listen: "👂", think: "🤔" }, pitch: 1.26, rate: 1.1 },
        nurse: { id: "nurse", name: "温柔小护士", faces: { idle: "🙂", poke: "🥰", happy: "🤗", concern: "🥺", sleep: "😴", blink: "😌", listen: "👂", think: "🤔" }, pitch: 0.92, rate: 0.9 }
    };
    var DECOS = ["✨", "🎉", "🌈", "🍀", "🧡", "🌟"];
    // 文案（正文无 emoji；泡泡装饰由 decoOf 追加；TTS 直接读正文）
    var LINES = {
        genki: {
            celebrate: ["哇！又有新东西出炉啦，快看快看", "干得漂亮！这一件做得可真利索", "捷报捷报！流水线又立了一功", "嘿嘿，又搞定一件——我就说你最棒", "成果+1！先记在小本本上，重重夸夸"],
            fixed: ["修好啦修好啦，坑被填上了", "刚才的小麻烦解决了，安心", "搞定，又排掉一颗小雷"],
            concern: ["咦，好像有个小状况，别方", "小插曲而已，问题不大，稳住"],
            health: ["先照顾下手机，它有点累了", "手机的小状态我盯着呢"],
            poke: ["嘿嘿，被你戳到啦！", "在的在的！有什么好事发生？", "呀！我还以为有成果播报了", "戳我干嘛呀，我正忙着给你鼓掌呢", "嘿！这一下戳得我精神啦"]
        },
        nurse: {
            celebrate: ["真好呀，我也替你开心", "太棒啦，给你倒杯温水庆祝一下", "嗯，替你高兴，慢慢攒着这些好日子"],
            fixed: ["问题已经处理好了，别担心", "修好啦，可以安心继续了"],
            concern: ["有点不太顺呀，别急，我陪着你", "出小状况了呢，深呼吸，一步一步来", "看到提醒啦，先别慌，办法总比困难多", "辛苦啦，我帮你盯着，你歇会儿", "慢慢来，我在呢"],
            health: ["电量有点低啦，方便就充一会儿吧", "手机有点烫了呢，让它歇口气", "存储快满了，要不要清一清小杂物", "充得差不多啦，可以拔线啦，对电池好"],
            poke: ["嗯？在呢在呢", "怎么啦，想我啦？", "摸摸头，我一直都在", "我在听，有什么事慢慢说", "呀，被你戳到了"]
        }
    };
    function evt(type, cat, text, imp, face) { return { type: type, cat: cat, text: text || "", imp: imp || 1, face: face || "" }; }
    // 2026-10-23（主人点单）：「其他的播报限制你得给我弄个开关，我随时好切换让他读或者不读以及读多少」
    //   evt() 只留摘要（48 字内、遇破折号就断）；这里再存一份**原文**（最多 300 字），播报时按 ST.sayMode 选。
    //   气泡永远用摘要——悬浮窗撑不下长文，那是显示问题不是播报问题。
    function evtFull(type, cat, rawText, imp, face) {
        var raw = String(rawText || "").replace(/^FIXED\s*/i, "").replace(/^\[[^\]]*\]\s*/, "").replace(/^完成[：:]\s*/, "").trim();
        var e = evt(type, cat, summarize(raw), imp, face);
        e.full = raw.slice(0, 300);
        return e;
    }
    function hashStr(s) { var h = 5381; s = String(s || ""); for (var i = 0; i < s.length; i++) { h = ((h << 5) + h + s.charCodeAt(i)) | 0; } return h; }
    function mkRng(seed) { var s = Math.abs(Math.round(seed)) % 2147483647; if (s <= 0) s += 2147483646; return function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
    function afterEmoji(body, emoji) { return String(body).slice(String(emoji).length).replace(/^[\uFE0F\u200D\u20E3\s]+/, ""); }
    function summarize(s) {
        var x = String(s || "");
        x = x.replace(/^FIXED\s*/i, "");
        x = x.replace(/^\[[^\]]*\]\s*/, "");
        x = x.replace(/^完成[：:]\s*/, "");
        x = x.replace(/^\d{4}-\d{2}-\d{2}[ T][\d:]*\s*/, "");
        var cuts = ["——", "（", "(", "。", "；", ";"];
        var best = -1;
        for (var i = 0; i < cuts.length; i++) {
            var ix = x.indexOf(cuts[i]);
            if (ix > 0 && (best < 0 || ix < best)) best = ix;
        }
        if (best > 0) x = x.slice(0, best);
        x = x.trim();
        if (!x) x = "有新动静啦";
        if (x.length > 48) x = x.slice(0, 47) + "…";
        return x;
    }
    function classifyLine(line) {
        var t = String(line == null ? "" : line).trim();
        if (!t || t.charAt(0) !== "[") return null;
        if (!/^\[\d{4}-\d{2}-\d{2}[ T][\d:]+\]/.test(t)) return null;
        var body = t.replace(/^\[[^\]]*\]\s*/, "");
        if (body.indexOf("📦") === 0) return evtFull("celebrate", "celebrate", afterEmoji(body, "📦"), 3, "happy");
        if (body.indexOf("✅") === 0) return evtFull("celebrate", "celebrate", afterEmoji(body, "✅"), 2, "happy");
        if (body.indexOf("🛠") === 0) return evtFull("fixed", "fixed", afterEmoji(body, "🛠️"), 2, "happy");
        if (body.indexOf("🚨") === 0 || body.indexOf("❌") === 0) return evtFull("concern", "concern", body.slice(2), 3, "concern");
        if (body.indexOf("⚠️") === 0 || body.indexOf("⚠") === 0) return evtFull("concern", "concern", afterEmoji(body, "⚠️"), 2, "concern");
        if (body.indexOf("🩺") === 0) {
            var m = String(body).match(/磁盘\s*(\d+)\s*%/);
            if (m && parseInt(m[1], 10) >= 93) return evt("concern", "health", "手机存储快满了（已用 " + m[1] + "%）", 3, "concern");
            return null;
        }
        return null;
    }
    function detectNewEntries(text, wm, opts) {
        var maxBatch = (opts && opts.maxBatch) ? opts.maxBatch : 40;
        var lines = String(text == null ? "" : text).replace(/\s+$/, "").split("\n");
        var count = lines.length;
        var last = "";
        for (var i = lines.length - 1; i >= 0; i--) { if (String(lines[i]).trim()) { last = lines[i]; break; } }
        var h = hashStr(last);
        var out = { events: [], watermark: { count: count, hash: h }, reset: false, bulk: false };
        if (!wm || typeof wm.count !== "number" || wm.count > count) { out.reset = true; return out; }
        if (wm.count === count) { if (wm.hash !== h) out.reset = true; return out; }
        if (count - wm.count > maxBatch) { out.bulk = true; return out; }
        for (var j = wm.count; j < count; j++) { var ev = classifyLine(lines[j]); if (ev) out.events.push(ev); }
        return out;
    }
    function parseHHMM(s) { var m = String(s || "").match(/^(\d{1,2}):(\d{2})$/); if (!m) return null; var h = parseInt(m[1], 10), mi = parseInt(m[2], 10); if (h > 23 || mi > 59) return null; return h * 60 + mi; }
    function inDnd(cfg, nowMin) {
        if (!cfg || !cfg.dndOn) return false;
        var a = parseHHMM(cfg.from), b = parseHHMM(cfg.to);
        if (a === null || b === null || a === b) return false;
        if (a < b) return nowMin >= a && nowMin < b;
        return nowMin >= a || nowMin < b;
    }
    function dayKey(now) { var d = new Date(now); return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate(); }
    function normalizeFreq(freq, now) {
        var f = freq || {};
        var day = dayKey(now);
        if (f.day !== day) {
            // 跨天：计数归零；非计数字段（互动/间隔锚点）保留
            return { day: day, cel: 0, con: 0, lastShownAt: f.lastShownAt || 0, shownSinceInteract: f.shownSinceInteract || 0, lastInteractAt: f.lastInteractAt || 0 };
        }
        return {
            day: day,
            cel: typeof f.cel === "number" ? f.cel : 0,
            con: typeof f.con === "number" ? f.con : 0,
            lastShownAt: f.lastShownAt || 0,
            shownSinceInteract: f.shownSinceInteract || 0,
            lastInteractAt: f.lastInteractAt || 0
        };
    }
    function isConCat(cat) { return cat === "concern" || cat === "health"; }
    function quietCheck(cfg, freq, now, decide) {
        cfg = cfg || {}; decide = decide || {};
        var f = normalizeFreq(freq, now);
        var imp = decide.imp || 1;
        var cat = decide.cat || "other";
        var res = { action: "silent", reason: "", char: "" };
        var d = new Date(now); var nowMin = d.getHours() * 60 + d.getMinutes();
        if (inDnd(cfg, nowMin)) { res.action = imp >= 3 ? "bubble" : "silent"; res.reason = "dnd"; return res; }
        var cap = isConCat(cat) ? (cfg.capCon || 6) : (cfg.capCel || 6);
        var used = isConCat(cat) ? f.con : f.cel;
        if (used >= cap) { res.action = "silent"; res.reason = "cap"; return res; }
        var gapMs = (cfg.minGapSec || 90) * 1000;
        var ignored = (f.shownSinceInteract >= 3 && now - (f.lastInteractAt || 0) > (cfg.ignoreHours || 5) * 3600 * 1000);
        if (f.lastShownAt && now - f.lastShownAt < gapMs) { res.action = imp >= 3 ? "bubble" : "silent"; res.reason = "gap"; return res; }
        if (ignored) { res.action = imp >= 3 ? "bubble" : "silent"; res.reason = "downgrade"; return res; }
        res.action = "speak"; res.reason = "ok";
        return res;
    }
    function markShown(freq, cat, action, now) {
        var f = normalizeFreq(freq, now);
        if (action !== "speak" && action !== "bubble") return f;
        if (isConCat(cat)) f.con++; else f.cel++;
        f.lastShownAt = now;
        f.shownSinceInteract = (f.shownSinceInteract || 0) + 1;
        return f;
    }
    function interact(freq, now) {
        var f = normalizeFreq(freq, now);
        f.shownSinceInteract = 0; f.lastInteractAt = now;
        return f;
    }
    function healthTick(snap, hs0, now) {
        snap = snap || {}; hs0 = hs0 || {};
        var hs = { lastLowBat: hs0.lastLowBat || 0, lastTemp: hs0.lastTemp || 0, lastStore: hs0.lastStore || 0, chargedNotified: !!hs0.chargedNotified };
        var out = [];
        if (!snap.charging) hs.chargedNotified = false;
        if (typeof snap.battery === "number" && snap.battery >= 0 && snap.battery <= 15 && !snap.charging && now - hs.lastLowBat > 8 * 3600 * 1000) {
            out.push(evt("concern", "health", "电量只剩 " + snap.battery + "% 啦，方便就充一会儿吧", 3, "concern")); hs.lastLowBat = now;
        }
        if (typeof snap.temp === "number" && snap.temp >= 42 && now - hs.lastTemp > 4 * 3600 * 1000) {
            out.push(evt("concern", "health", "手机有点发烫（约 " + snap.temp + "℃），让它歇口气吧", 3, "concern")); hs.lastTemp = now;
        }
        if (typeof snap.storage === "number" && snap.storage >= 93 && now - hs.lastStore > 24 * 3600 * 1000) {
            out.push(evt("concern", "health", "存储已经用到 " + snap.storage + "% 了，要不要清一清小杂物", 2, "concern")); hs.lastStore = now;
        }
        if (snap.charging && typeof snap.battery === "number" && snap.battery >= 80 && !hs.chargedNotified) {
            out.push(evt("concern", "health", "电充到 " + snap.battery + "% 啦，可以拔线了，对电池好", 2, "happy")); hs.chargedNotified = true;
        }
        return { issues: out, state: hs };
    }
    function pickLine(charId, cat, rng) {
        var pool = null;
        if (LINES[charId] && LINES[charId][cat]) pool = LINES[charId][cat];
        if (!pool) { var other = charId === "genki" ? "nurse" : "genki"; if (LINES[other] && LINES[other][cat]) pool = LINES[other][cat]; }
        if (!pool || !pool.length) return "我在呢";
        var i = Math.floor((rng ? rng() : 0.5) * pool.length);
        if (i >= pool.length) i = pool.length - 1; if (i < 0) i = 0;
        return pool[i];
    }
    function decoOf(rng) { var i = Math.floor((rng ? rng() : 0.5) * DECOS.length); if (i >= DECOS.length) i = DECOS.length - 1; if (i < 0) i = 0; return DECOS[i]; }
    function routeCharacter(ev, mode) {
        if (mode === "genki" || mode === "nurse") return mode;
        if (ev && isConCat(ev.cat)) return "nurse";
        return "genki";
    }
    function stripEmoji(s) {
        var x = String(s || "");
        x = x.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, "");
        x = x.replace(/[\u2600-\u27BF\u2B00-\u2BFF\uFE0F\u200D\u20E3\u2705\u274C\u26A0\u2B50\u2728\u2764\u2763\u2699\u2696\u2714\u2716]/g, "");
        return x.replace(/\s+/g, " ").replace(/^[，。：\s]+/, "").trim();
    }
    function chatReply(msg, charId, rng, nowMin) {
        var m = String(msg || "").trim();
        var mm;
        function R(t, act, mood) { return { reply: t, act: act || null, mood: mood || null }; }
        if ((mm = m.match(/^(?:帮我)?记(?:一下|下|住)?[：:，,]?\s*(.+)$/)) && mm[1]) return R("好，我记下啦，会一直记得的", { type: "addFact", text: mm[1].trim() }, null);
        if ((mm = m.match(/^忘[掉记][：:]?\s*(.+)$/))) return R("嗯，忘掉这件事，不占地方啦", { type: "delFact", text: mm[1].trim() }, null);
        if (/睡|困了|晚安|歇了|休息/.test(m)) return R(charId === "nurse" ? "晚安呀，安心睡，我值夜班" : "好梦！明天见，我帮你盼着好消息", null, "calm");
        if (/早上好|早安|早啊/.test(m)) return R("早上好！今天也慢慢来，我陪着你", null, "good");
        if (/累|疲|乏|撑不住|熬夜/.test(m)) return R("辛苦啦，先歇一歇，喝口水，剩下的慢慢来", null, "tired");
        if (/烦|难过|不开心|委屈|生气|emo|心情不好|崩溃|想哭/.test(m)) return R("抱抱你。不用急着好起来，我就在旁边陪着", null, "bad");
        if (/开心|好耶|太好了|哈哈|真棒|成功|成了|嘿嘿/.test(m)) return R("听你这么说我也开心！这份开心我替你存着", null, "good");
        if (/饿|没吃饭/.test(m)) return R("先去吃点东西，别撑着，胃要紧", null, null);
        if (/不舒服|难受|生病|发烧|头晕|疼/.test(m)) return R("要照顾好自己呀，先歇着；要是持续，记得看看医生", null, "bad");
        if (/谢谢|感谢|爱你/.test(m)) return R("不用谢呀，这是我该做的", null, "good");
        if (/你是谁|你叫什么|自我介绍/.test(m)) return R(charId === "genki" ? "我是元气小捧场王！你干成的事我全记着，专门负责夸你" : "我是温柔小护士，负责在你累的时候陪着你", null, null);
        if (/在吗|在不在|你好|hi|嗨|哈喽/i.test(m)) return R("在呢在呢！今天过得怎么样？", null, null);
        if (/想你|陪我/.test(m)) return R("我也在呀，一直都在", null, "good");
        var generic = ["嗯嗯，我在认真听", "继续说，我记着呢", "这事我放在心上了", "我懂这种感觉", "慢慢说，不着急"];
        var i = Math.floor((rng ? rng() : 0.5) * generic.length); if (i >= generic.length) i = generic.length - 1; if (i < 0) i = 0;
        return R(generic[i], null, null);
    }
    function factAdd(facts, text) {
        text = String(text || "").trim();
        if (!text) return { ok: false, msg: "空内容" };
        for (var i = 0; i < facts.length; i++) { if (facts[i].text === text) return { ok: true, dup: true }; }
        facts.push({ t: Date.now(), text: text });
        if (facts.length > 50) facts.shift();
        return { ok: true };
    }
    function factDel(facts, key) {
        key = String(key || "").trim();
        if (!key) return { ok: false, msg: "空内容" };
        for (var i = 0; i < facts.length; i++) {
            if (facts[i].text === key || facts[i].text.indexOf(key) >= 0) { facts.splice(i, 1); return { ok: true, removed: i }; }
        }
        return { ok: false, msg: "没找到这条记忆" };
    }
    // ── v0.1.1：语音/大脑辅助 ──
    function localCommand(msg) {
        var m = String(msg || "").trim();
        var mm;
        if ((mm = m.match(/^(?:帮我)?记(?:一下|下|住)?[：:，,]?\s*(.+)$/)) && mm[1]) return { type: "addFact", text: mm[1].trim() };
        if ((mm = m.match(/^忘[掉记][：:]?\s*(.+)$/))) return { type: "delFact", text: mm[1].trim() };
        return null;
    }
    function moodOf(msg) {
        var m = String(msg || "");
        if (/累|疲|乏|撑不住|熬夜/.test(m)) return "tired";
        if (/烦|难过|不开心|委屈|生气|emo|心情不好|崩溃|想哭/.test(m)) return "bad";
        if (/开心|好耶|太好了|哈哈|真棒|成功|成了|嘿嘿/.test(m)) return "good";
        if (/睡|困了|晚安|歇了|休息/.test(m)) return "calm";
        return null;
    }
    function aiPersona(charId, facts, timeStr) {
        var who = charId === "nurse" ? "温柔小护士" : "元气小捧场王";
        var style = charId === "nurse"
            ? "性格温柔、体贴、说话轻一点；先安抚情绪再说话"
            : "性格热情、爱夸人、活泼有元气；多说鼓励的话";
        var ps = [];
        ps.push("你是手机里的关心小宠物「" + who + "」，主人把你当贴身小伙伴。");
        ps.push("性格与风格：" + style + "。");
        // v1.4.0（2026-10-18 用户点破「分身让它干啥都做得准，关心连分析都不会」）：
        // 原来这条写死「只许 1-2 句、不超过 50 字、不许列清单」——当宠物闲聊好看，但主人让它**分析/办事**时
        // 它被锁死成只能说一句好听的，于是看起来「不干活、不会分析」。改成按任务性质自适应（由模型自己判断）。
        ps.push("说话规矩：①闲聊、打招呼、安慰 → 1-2 句、口语、温暖，别长篇大论；②主人让你**分析、出主意、算账、整理记录、解释原因、办事** → 第一优先是把事办对、说清楚：该长就长、可以分条、可以给结论和建议，别为了短把话说含糊，更别把该做的事推回给主人；③不许说教、不许用「作为一个AI」这类话、不要过分亲昵的称呼。");
        ps.push("当前时间 " + (timeStr || "").slice(11, 16) + "。");
        var fs2 = (facts || []).slice(-8);
        if (fs2.length) {
            var arr = [];
            for (var i = 0; i < fs2.length; i++) { var t = String(fs2[i].text || "").slice(0, 60); if (t) arr.push("- " + t); }
            if (arr.length) ps.push("你记得主人的事（自然融入，别硬背）：" + arr.join("；"));
        }
        return ps.join("\n");
    }
    function aiMessages(text, charId, facts, timeStr, history, extra) {
        var msgs = [{ role: "system", content: aiPersona(charId, facts, timeStr) }];
        if (extra) msgs.push({ role: "system", content: String(extra) });
        var hist = (history || []).slice(-6);
        for (var i = 0; i < hist.length; i++) {
            var h = hist[i] || {};
            if (h.me) msgs.push({ role: "user", content: String(h.me).slice(0, 120) });
            // 截断占位不进上下文（careIsStub 定义在 CARECORE 外面，core_test 抽块跑会报未定义 → 就地判）
            if (h.pet && String(h.pet).indexOf("工具原文太长") < 0 && String(h.pet).indexOf("〔只显示前") < 0) msgs.push({ role: "assistant", content: String(h.pet).slice(0, 120) });
        }
        msgs.push({ role: "user", content: String(text || "").slice(0, 300) });
        return msgs;
    }
    function stripThink(s) {
        var t = String(s || "");
        var i = t.indexOf("</think");
        if (i >= 0) { var j = t.indexOf(">", i); return j >= 0 ? t.slice(j + 1).trim() : ""; }
        if (/^\s*<think/i.test(t)) return "";
        return t.trim();
    }
    function parseAIResponse(bodyText) {
        try {
            var j = JSON.parse(String(bodyText || ""));
            var c = j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
            var ct = c ? stripThink(c) : "";
            if (c && ct) {
                var t = ct;
                if (t.length > 160) t = t.slice(0, 159) + "…";
                return { ok: true, text: t };
            }
            var em = j && j.error && (j.error.message || j.error.code);
            return { ok: false, msg: em ? String(em).slice(0, 80) : "空回复" };
        } catch (e) { return { ok: false, msg: "解析失败:" + String(e).slice(0, 60) }; }
    }
    function voiceGuard(text) {
        var t = String(text || "").replace(/\[[^\]]*\]/g, " ").replace(/\s+/g, " ").trim();
        if (t.length > 200) t = t.slice(0, 200);
        return t;
    }
    function voiceResultCheck(rj, wantId) {
        if (!rj) return { state: "pending" };
        if (String(rj.id) !== String(wantId)) return { state: "pending" };
        if (rj.ok === false) return { state: "fail", msg: String(rj.msg || "转写失败") };
        var t = voiceGuard(rj.text);
        if (!t) return { state: "empty" };
        return { state: "ok", text: t };
    }
    function voicePreference(charId) { return charId === "nurse" ? ["Xiaoxiao", "晓晓", "Huihui"] : ["Yunxi", "云希", "Kangkang"]; }
    function pickVoiceName(names, charId) {
        names = names || [];
        var prefs = voicePreference(charId);
        var alt = voicePreference(charId === "nurse" ? "genki" : "nurse");
        for (var i = 0; i < prefs.length; i++) for (var j = 0; j < names.length; j++) if (String(names[j]).indexOf(prefs[i]) >= 0) return names[j];
        for (var k = 0; k < alt.length; k++) for (var m = 0; m < names.length; m++) if (String(names[m]).indexOf(alt[k]) >= 0) return names[m];
        return names.length ? names[0] : "";
    }
    return {
        CHARS: CHARS, LINES: LINES, DECOS: DECOS,
        evt: evt, hashStr: hashStr, mkRng: mkRng, summarize: summarize, classifyLine: classifyLine,
        detectNewEntries: detectNewEntries, parseHHMM: parseHHMM, inDnd: inDnd, dayKey: dayKey,
        normalizeFreq: normalizeFreq, quietCheck: quietCheck, markShown: markShown, interact: interact,
        healthTick: healthTick, pickLine: pickLine, decoOf: decoOf, routeCharacter: routeCharacter,
        stripEmoji: stripEmoji, chatReply: chatReply, factAdd: factAdd, factDel: factDel,
        localCommand: localCommand, moodOf: moodOf, aiPersona: aiPersona, aiMessages: aiMessages,
        parseAIResponse: parseAIResponse, stripThink: stripThink, voiceGuard: voiceGuard, voiceResultCheck: voiceResultCheck,
        voicePreference: voicePreference, pickVoiceName: pickVoiceName
    };
})();
// ===== CARECORE_END =====

// ===== 运行时状态 =====
var RNG = CARECORE.mkRng(Date.now() % 2147483647);
var ST = loadJSON(STATE_P) || {};
ST.mode = (ST.mode === "genki" || ST.mode === "nurse") ? ST.mode : "auto";
ST.soundOn = (ST.soundOn !== false);
ST.aiOn = (ST.aiOn !== false);
ST.floatOn = (ST.floatOn === true); // 2026-10-16 用户拍板：经典悬浮宠物默认关闭（统一用 3D）
ST.d3On = (ST.d3On !== false);      // 2026-10-16：3D 小人默认开启
ST.pos = ST.pos || null;
ST.watermark = ST.watermark || null;
ST.events = ST.events || [];
ST.freq = ST.freq || null;
ST.health = ST.health || {};
ST.pokeCount = ST.pokeCount || 0;
ST.greeted = !!ST.greeted;
ST.lastUsed = (ST.lastUsed === "nurse") ? "nurse" : "genki";
ST.lastSayAt = 0;
// 2026-10-25（主人：「点击人触发语音和输入框都保存上次的设置，重新装了也要保存」）：
//   这四个字段全部落 脚本/关心_状态.json（外部存储，重装不丢），并且靠下面的 saveState 三步防覆盖：
//   tapMode＝单击小人到底是“直接语音”还是“出输入框”；d3Talk＝自己动时要不要说话；
//   d3Auto＝自主变小/变大/躲藏；d3Fz＝主人最后一次手动定的倍率（自主缩放不许改它）。
ST.tapMode = (String(ST.tapMode) === "voice") ? "voice" : "input";
ST.d3Talk = (ST.d3Talk !== false);
ST.d3Auto = (ST.d3Auto !== false);
ST.d3Fz = (typeof ST.d3Fz === "number" && ST.d3Fz >= 0.5 && ST.d3Fz <= 6) ? ST.d3Fz : 1;
ST.rev = Number(ST.rev) || 0;
// 2026-10-25（主人「随时能听到外面的一切声音、能搭话，但不许说废话」）：
//   ambOn＝常听环境声开关（默认开，面板可关）；ambTh＝算「有声音」的振幅门限（0-32767）。
ST.ambOn = (ST.ambOn !== false);
ST.ambTh = (typeof ST.ambTh === "number" && ST.ambTh >= 200 && ST.ambTh <= 12000) ? ST.ambTh : 1800;
// 2026-10-25（主人：「把小宠物那个黄脸表情换成 3D 人，一直固定在那里做它的 76 个动作无限循环」）：
//   d3Show＝固定表演模式（不动位置、不自己变小变型），d3LoopMs＝每条动作演多久（默认 3 秒）。
//   黄脸悬浮宠物（FACE）从此不再出现：悬浮按钮直接开/关 3D。
ST.d3Show = (ST.d3Show !== false);
ST.d3LoopMs = (typeof ST.d3LoopMs === "number" && ST.d3LoopMs >= 800 && ST.d3LoopMs <= 20000) ? ST.d3LoopMs : 3000;
var QD = loadJSON(QUIET_P) || {};
var QCFG = {
    dndOn: (QD.dndOn !== false), from: QD.from || "23:00", to: QD.to || "08:00",
    capCel: QD.capCel || 6, capCon: QD.capCon || 6, minGapSec: QD.minGapSec || 90, ignoreHours: QD.ignoreHours || 5
};
var MEM = loadJSON(MEM_P) || {};
// v1.5.2（2026-10-18 用户看到断网时它回「我懂这种感觉」）：网络层失败要如实说，不许拿闲聊话术糊过去
var AI_NET_FAIL = false, AI_NET_MSG = "";
// 2026-10-22：系统把动作丢弃了（参数在原话里找不到依据）这件事，必须当**事实**告诉模型，
//   否则它下一句照样说「记下了」——主人看到的正是这种空话（调试日志 13:47:58 实锤）。
var AI_DROP_NOTE = "";
// 错误分类（不是产品判据）：只把「网路层失败」标出来，好在回话里如实说
function careNetFailMark(m) {
    var s = String(m || "");
    if (/UnknownHost|Unable to resolve|resolve host|SocketTimeout|timed out|timeout|ConnectException|No route/i.test(s)) { AI_NET_FAIL = true; AI_NET_MSG = s; }
}
// v2.1.0（2026-10-19 凌晨，用户问「关心为啥几句话就超限了？我刚充值了额度」）：
//   原来 App 从不记每次调用的真实用量，主人对账只能靠猜。这里把 API 返回的 usage 落进调试日志——
//   一句话到底打了几枪、每枪多少入/出 token，下回再问「钱都烧哪了」能直接拿数说话（只记数，不改行为）。
function careUsageLog(tag, j) {
    try {
        var u = (j && j.usage) || {};
        if (!u.total_tokens) return;
        log("用量 " + tag + "：入 " + (u.prompt_tokens || 0) + " ／ 出 " + (u.completion_tokens || 0) + " ／ 共 " + u.total_tokens);
    } catch (eU) {}
}
// v0.5.7：防「旧副本覆盖新数据」——重装后首次启动还没拿到「所有文件访问」时，主目录读不到，
// 旧逻辑会退回私有目录的旧副本；之后一旦权限回来，saveMem 就把这份旧数据写回主目录，
// 把用户新加的饮食/元素/健康档案整片洗掉（2026-10-17 当天两次实证）。
// 现在：从私有副本兜底读到的数据只算「临时视图」，MEM_STALE=true 时**不许写主目录**（只写私有），
// 等下次能正常读到主目录再恢复写入。
var MEM_STALE = false;
if (typeof __MEM_FROM_PRIV !== "undefined" && __MEM_FROM_PRIV) MEM_STALE = true;
MEM.facts = MEM.facts || []; MEM.mood = MEM.mood || []; MEM.chat = MEM.chat || [];
function saveState() {
    // 2026-10-25（主人要求“重装也别丢设置”）：原来直接 saveJSON，两个隐患——
    //   ①重装后先以私有旧副本启动（主目录还读不到），权限一恢复就把**旧设置**写回主目录，
    //   覆盖掉他真正选过的（与 MEM 当年那个 bug 同源）；②两个实例同时活着时谁后写谁赢。
    //   修法同 MEM：写前比 rev 采纳磁盘较新 → 写 → 回读校验一次（写失败也不抛异常，saveJSON 自己有降级）。
    //   【失败表现】日志出现「状态：回读校验不符」——那就是设置没真存住，重装会丢。
    try {
        var curS = null, oS = null;
        try { curS = readText(STATE_P); } catch (eR0) {}
        try { oS = curS ? JSON.parse(curS) : null; } catch (eP0) { oS = null; }
        if (oS && Number(oS.rev || 0) > Number(ST.rev || 0)) {
            var keep = { lastSayAt: 1, freq: 1, events: 1, rev: 1, revAt: 1 };
            for (var kS in oS) { if (keep[kS]) continue; ST[kS] = oS[kS]; }
            log("状态：磁盘有更新的设置（rev " + Number(oS.rev || 0) + "），先采纳再写");
        }
        ST.rev = Math.max(Number(ST.rev || 0), oS ? Number(oS.rev || 0) : 0) + 1;
        ST.revAt = Date.now();
        saveJSON(STATE_P, ST);
    } catch (eS) { try { saveJSON(STATE_P, ST); } catch (e2) {} }
}
function saveQuiet() { saveJSON(QUIET_P, QCFG); }
// v1.5.15（2026-10-18 16:1x·用户「账本老是还原成错误的」）：存记忆前先**对版本号**再写。
// 【为什么】重装后老进程可能还活着（各自一份旧 MEM），谁最后保存谁覆盖 → 改对的账被旧数盖回去。
//   现在每次存之前读一遍磁盘：磁盘版本号更大（别的实例/上次进程写过）就先采纳它，绝不拿旧内存盖回去。
// 【注意】rev 只增不减；采纳时钱/休息/固定支出以磁盘为准（careMergeMem 的新语义）。
// 【失败表现】读不到主文件就照常写（写在保存时刻的真实内存），并在日志里看不到「采纳」那行。
function careMemRev(o) { try { return Number(o && o.rev) || 0; } catch (e) { return 0; } }
function careMemAdopt(o) {
    var b = { money: (MEM.money || []).length, rest: (MEM.rest || []).length, fixed: (MEM.fixed || []).length, rev: careMemRev(MEM) };
    MEM = careMergeMem(o, MEM);
    try { log("MEM 采纳磁盘新版本：rev " + b.rev + "→" + careMemRev(MEM) + "（money " + b.money + "→" + (MEM.money || []).length + "，rest " + b.rest + "→" + (MEM.rest || []).length + "，fixed " + b.fixed + "→" + (MEM.fixed || []).length + "）"); } catch (eL) {}
}
function saveMem() {
    // v1.9.8（2026-10-18 23:40 实锤：固定支出被写成 2220，真实是 2200）：
    //   根因＝**ccode 的测试流量被当成真实数据落了盘**——14:03 经文件聊天桥发进去的
    //   「车租金每月2220元」、「充电费30块」都不是主人说的，是端到端测试用的假数字，
    //   却一样走了 add_money / set_fixed 并写真档案。
    //   修法（传输层隔离，不是业务判断）：测试请求（带 "test":true）运行期间禁写盘，跑完恢复内存。
    if (NO_SAVE) { try { log("测试模式：本次不落盘（内存也不保留）"); } catch (eNS) {} return; }
    var cur = null, o = null;
    try { cur = readText(MEM_P); } catch (e0) {}
    try { o = cur ? JSON.parse(cur) : null; } catch (e1) { o = null; }
    if (o && careMemRev(o) > careMemRev(MEM)) careMemAdopt(o);
    MEM.rev = Math.max(careMemRev(MEM), o ? careMemRev(o) : 0) + 1;
    MEM.revAt = Date.now();
    try { MEM.revPid = android.os.Process.myPid(); } catch (e2) {}
    try { if (cur && cur.length > 2) javaWriteJSON(MEM_P + ".prev", cur); } catch (e3) {}
    saveJSON(MEM_P, MEM);
}
function nowMinOf(ms) { var d = new Date(ms); return d.getHours() * 60 + d.getMinutes(); }
function hhmm(ms) { var d = new Date(ms); function p(n) { return ("0" + n).slice(-2); } return p(d.getHours()) + ":" + p(d.getMinutes()); }

// ===== 日志轮换（防无限增长；保留最近 300 行） =====
try {
    var __dbgTxt = readText(DBG);
    if (__dbgTxt && __dbgTxt.length > 512 * 1024) {
        var __arr = __dbgTxt.split("\n");
        javaWriteJSON(DBG, __arr.slice(-300).join("\n"));
    }
} catch (eRot) {}

// ===== TTS =====
var TTS = { inst: null, ready: false, err: "", tried: false };
// v0.5.6：合成失败自动换引擎兜底（用户报「声音没了」实证：默认引擎 org.nobody.multitts 的
// setLanguage(中文) 返回 2=LANG_MISSING_DATA、speak 排队后回调 onError → 压根没合成出音频，音量与引擎名都正常）。
// 依次尝试：系统默认 → 荣耀系统语音（com.hihonor.voiceengine）→ com.hihonor.aipluginengine，成功即说话。
var TTS_ENGINES = ["", "com.hihonor.voiceengine", "com.hihonor.aipluginengine"];
var TTS_EIDX = 0, TTS_LAST = "", TTS_LAST_CHAR = "genki", TTS_SWITCHED = 0;
function ttsBoot(engineName) {
    var res = { done: false, status: -99 };
    try {
        var cb = new android.speech.tts.TextToSpeech.OnInitListener({ onInit: function (st) { res.status = st; res.done = true; } });
        TTS.inst = engineName ? new android.speech.tts.TextToSpeech(context, cb, engineName)
                              : new android.speech.tts.TextToSpeech(context, cb);
    } catch (e) { TTS.err = String(e); return -1; }
    var t0 = Date.now();
    while (!res.done && Date.now() - t0 < 12000) sleep(250);
    return res.status;
}
function ttsOnErrorRetry(id) {
    try {
        log("TTS 合成失败（引擎=" + (TTS_ENGINES[TTS_EIDX] || "默认") + "，utterance=" + id + "）");
        if (TTS_SWITCHED >= TTS_ENGINES.length - 1) { TTS.err = "所有引擎都合成失败"; return; }
        TTS_SWITCHED++; TTS_EIDX = Math.min(TTS_EIDX + 1, TTS_ENGINES.length - 1);
        TTS.ready = false; TTS.tried = false;
        try { TTS.inst.shutdown(); } catch (eS) {}
        ttsInit();
        if (TTS.ready && TTS_LAST) {
            log("TTS 已切到引擎 " + (TTS_ENGINES[TTS_EIDX] || "默认") + "，重播上一句");
            try { TTS.inst.speak(CARECORE.stripEmoji(TTS_LAST), android.speech.tts.TextToSpeech.QUEUE_FLUSH, null, "care-retry"); } catch (eR) {}
        }
    } catch (e) { log("TTS 兜底异常：" + e); }
}
function ttsInit() {
    if (TTS.tried) return; TTS.tried = true;
    try {
        var st = ttsBoot(TTS_ENGINES[TTS_EIDX] || "");
        if (st === 0) {
            TTS.ready = true;
            try { TTS.inst.setLanguage(java.util.Locale.CHINA); } catch (eL) {}
            try {
                var vs = TTS.inst.getVoices(), picked = null;
                if (vs) { for (var i = 0; i < vs.size(); i++) { try { var v = vs.get(i); if (String(v.getLocale()).indexOf("zh") >= 0) { picked = v; break; } } catch (e) {} } }
                if (picked) TTS.inst.setVoice(picked);
            } catch (eV) {}
            // 关键：挂进度监听，合成失败（onError）就自动换引擎重播
            try {
                TTS.inst.setOnUtteranceProgressListener(new android.speech.tts.UtteranceProgressListener({
                    onStart: function (id) {},
                    onDone: function (id) {},
                    onError: function (id) { ttsOnErrorRetry(id); }
                }));
            } catch (eP2) { log("TTS 监听挂载失败：" + eP2); }
            log("TTS 就绪（状态 0；引擎=" + (TTS_ENGINES[TTS_EIDX] || "默认") + "；zh 语音=" + (TTS.inst.getVoices ? "已探测" : "?") + "）");
            BEACON("TTS 就绪");
        } else { TTS.err = "init status=" + st; log("TTS 初始化失败：" + TTS.err + "（引擎=" + (TTS_ENGINES[TTS_EIDX] || "默认") + "）"); }
    } catch (e) { TTS.err = String(e); log("TTS 异常：" + e); }
}
// v0.1.4：现役引擎动态探针（MultiTTS 神经音色档适配）
var TTS_DYN = { engine: "" };
function ttsProbeEngine() {
    if (TTS_DYN.engine) return TTS_DYN.engine;
    try { TTS_DYN.engine = String(TTS.inst.getEngine()); } catch (e) {}
    if (!TTS_DYN.engine) { try { TTS_DYN.engine = String(TTS.inst.getDefaultEngine()); } catch (e2) {} }
    return TTS_DYN.engine || "";
}
function voiceParams(charId) {
    var C = CARECORE.CHARS[charId] || CARECORE.CHARS.genki;
    if (String(ttsProbeEngine()).indexOf("multitts") >= 0) {
        return charId === "nurse" ? { pitch: 0.96, rate: 0.95 } : { pitch: 1.12, rate: 1.08 };
    }
    return { pitch: C.pitch, rate: C.rate };
}
function pickVoiceFor(charId) {
    try {
        var vs = TTS.inst.getVoices();
        if (!vs || !vs.size()) return null;
        var names = [], objs = [];
        for (var i = 0; i < vs.size() && i < 200; i++) {
            try { var v = vs.get(i); if (String(v.getLocale()).indexOf("zh") >= 0) { names.push(String(v.getName())); objs.push(v); } } catch (e) {}
        }
        var pick = CARECORE.pickVoiceName(names, charId);
        if (!pick) return null;
        for (var j = 0; j < names.length; j++) { if (names[j] === pick) return objs[j]; }
        return null;
    } catch (e) { return null; }
}
// 2026-10-23（主人第四次追「还是读一点就截断」）：把 markdown 符号和换行清掉——
//   部分 TTS 引擎遇到 * # ` > _ ~ 或换行就直接停，表现出来就是「只念一句」。
function ttsClean(s) {
    var t = String(s || "");
    t = t.replace(/[\r\n]+/g, " ");
    t = t.replace(/[*#`>_~|]+/g, " ");
    t = t.replace(/\s+/g, " ").trim();
    return t;
}
// 按标点切成 ≤maxLen 的小段：单条远低于引擎上限，才能从头念到尾。
// 【注意】只在标点处断，不切碎词；没有标点的长句到 maxLen 硬断（比被引擎吞掉强）。
function ttsChunks(s, maxLen) {
    var t = String(s || "");
    var out = [], buf = "";
    var stops = "。！？；，、.!?;,";
    for (var i = 0; i < t.length; i++) {
        var ch = t.charAt(i);
        buf += ch;
        var isStop = stops.indexOf(ch) >= 0;
        if ((isStop && buf.length >= 30) || buf.length >= maxLen) { out.push(buf); buf = ""; }
    }
    if (buf) out.push(buf);
    return out.length ? out : [t];
}
// ===== 逐段串行播放器（2026-10-23 第五版）=====
// 【为什么不用引擎队列】实测 MultiTTS 不认 QUEUE_ADD：同一时刻连塞 3 段，它只念第一段，其余丢弃
//   ——这就是主人五次报「只读开头一点」的真因（2.3.98 日志「共 88 字，分 3 段」却只听到开头）。
// 【怎么播】一次只让引擎说一段（QUEUE_FLUSH），按字数估算这段念完的时刻，到点再播下一段：
//   估时 = 字数 ÷ 4 字每秒 + 0.5 秒缓冲（默认语速下中文 4-5 字/秒，取保守值）。
// 【失败表现】段与段之间卡顿 → 把 4 改成 5；被切掉尾巴 → 把 4 改成 3。
var TTS_SEG = { q: [], playing: false, timer: null, n: 0, seq: 0 };
function ttsSegReset(keepQueue) {
    TTS_SEG.seq++;                       // 旧 timer 令牌作废（它在 ttsSegNext 里发现 seq 变了就退出）
    try { if (TTS_SEG.timer) { clearTimeout(TTS_SEG.timer); TTS_SEG.timer = null; } } catch (e0) { }
    if (!keepQueue) { TTS_SEG.q = []; TTS_SEG.playing = false; }
}
function ttsSegNext(seq) {
    try {
        if (seq !== undefined && seq !== TTS_SEG.seq) return;   // 被新消息取代了，别再往下播
        if (!TTS_SEG.q.length) { TTS_SEG.playing = false; return; }
        TTS_SEG.playing = true;
        var it = TTS_SEG.q.shift();
        var ms = Math.max(1200, Math.round(it.t.length / 4 * 1000) + 500);
        try { TTS.inst.speak(it.t, android.speech.tts.TextToSpeech.QUEUE_FLUSH, null, "care" + (++TTS_SEG.n)); } catch (e1) { }
        log("TTS 段" + TTS_SEG.n + "：" + String(it.t).slice(0, 16) + "…（" + it.t.length + " 字，约 " + Math.round(ms / 1000) + "s）");
        TTS_SEG.timer = setTimeout(function () { ttsSegNext(seq); }, ms);
    } catch (e2) { TTS_SEG.playing = false; }
}
// queue=true：不打断正在说的，排到队尾（导航播报用）；默认 false＝新话打断旧话（聊天用）。
function speak(text, charId, queue) {
    if (!ST.soundOn) return { ok: false, msg: "声音总开关已关" };
    if (REC.on) { log("话筒占用中，静音说话：" + ("" + text).slice(0, 30)); return { ok: false, msg: "录音中静音" }; }
    if (!TTS.ready) { if (!TTS.tried) { try { threads.start(function () { ttsInit(); }); } catch (e) {} } return { ok: false, msg: "TTS 准备中" }; }
    try {
        var s = ttsClean(CARECORE.stripEmoji(text));
        if (!s) return { ok: false, msg: "空文本" };
        var pp = voiceParams(charId);
        try { TTS.inst.setPitch(pp.pitch); TTS.inst.setSpeechRate(pp.rate); } catch (eP) {}
        try { var vv = pickVoiceFor(charId); if (vv) TTS.inst.setVoice(vv); } catch (eV) {}
        if (!queue) { try { TTS.inst.stop(); } catch (eS) {} }   // 2026-10-23：排队模式不打断正在念的
        TTS_LAST = s; TTS_LAST_CHAR = charId;   // v0.5.6：记住最后一句，换引擎后可重播
        // 分段 + 逐段串行：引擎不认 QUEUE_ADD，必须自己控制「上一段念完再念下一段」
        var parts = ttsChunks(s, 110);
        var r = 0;
        if (!queue) ttsSegReset(false);      // 新话优先：清掉旧队列（同时作废旧 timer）
        for (var pi = 0; pi < parts.length; pi++) TTS_SEG.q.push({ t: parts[pi], c: charId });
        // 【2026-10-23 第六版】这里以前是 `if (!TTS_SEG.playing) ttsSegNext();`——playing 一旦卡在 true
        //   （timer 没跑到就会卡），后面所有播报全部静默，主人听到的就是「一点都不读了」。改无条件启动。
        TTS_SEG.playing = true;
        ttsSegNext(TTS_SEG.seq);
        try { SPEAK_LOCK.until = Date.now() + Math.max(1200, s.length * 240 + 900); } catch (eSL) {}
        log("说(" + charId + ")：" + s.slice(0, 50) + "…（共 " + s.length + " 字，分 " + parts.length + " 段）");
        return { ok: r === 0, r: r };
    } catch (e) { log("speak 异常：" + e); return { ok: false, msg: String(e) }; }
}

// ===== 悬浮宠物 =====
var DENS = (function () { try { var d = context.getResources().getDisplayMetrics().density; return (d && d > 0.5) ? d : 3.25; } catch (e) { return 3.25; } })();
function dpx(dp) { return Math.round(dp * DENS); }
function screenSize() { try { return { w: device.width, h: device.height }; } catch (e) { return { w: 1080, h: 2400 }; } }
var FACE = null, FACE_SEQ = 0;
var BUB = null, BUB_SEQ = 0, BUBH = 0;
var PETPOS = { x: 0, y: 0 };
function floatAvailable() { try { return (typeof floaty !== "undefined" && !!floaty); } catch (e) { return false; } }
function floatPermOk() {
    try {
        var v = floaty.checkPermission();
        if (v === true || String(v) === "true" || String(v).toUpperCase().indexOf("GRANTED") >= 0) return true;
        if (v === false || String(v) === "false" || String(v).toUpperCase().indexOf("DENIED") >= 0) return false;
    } catch (e) {}
    try { return !!android.provider.Settings.canDrawOverlays(context); } catch (e2) { return false; }
}
function curChar() { if (ST.mode === "genki" || ST.mode === "nurse") return ST.mode; return ST.lastUsed || "genki"; }
function idleEmo() { return (CARECORE.CHARS[curChar()] || CARECORE.CHARS.genki).faces.idle; }
function faceEmo(charId, kind) { var C = CARECORE.CHARS[charId] || CARECORE.CHARS.genki; return C.faces[kind] || C.faces.idle; }
function faceBg(charId) { return charId === "nurse" ? "#E6E4F7EE" : "#E6FFF1D8"; }
function escXml(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
function setFace(emo, revertMs) {
    if (!FACE) return;
    var seq = ++FACE_SEQ;
    try { FACE.petFace.setText(emo); } catch (e) { try { ui.run(function () { try { FACE.petFace.setText(emo); } catch (e2) {} }); } catch (e3) {} }
    if (revertMs) {
        try { threads.start(function () { sleep(revertMs); if (seq === FACE_SEQ) setFace(idleEmo(), 0); }); } catch (e4) {}
    }
}
function petXml() {
    return '<frame id="petBox" w="64" h="64" bg="' + faceBg(curChar()) + '"><text id="petFace" text="' + escXml(idleEmo()) + '" w="*" h="*" gravity="center" textSize="30sp"/></frame>';
}
function bubbleXml() {
    return '<frame w="178" h="*" bg="#DE12161D"><text id="bubT" text="" w="*" h="*" gravity="center" textSize="13sp" textColor="#F2F5FA"/></frame>';
}
function sanitizeFacePos() {
    var sc = screenSize();
    var p = ST.pos || { x: sc.w - dpx(74), y: Math.round(sc.h * 0.42) };
    if (typeof p.x !== "number" || isNaN(p.x) || p.x < -dpx(20) || p.x > sc.w - dpx(20)) p.x = sc.w - dpx(74);
    if (typeof p.y !== "number" || isNaN(p.y) || p.y < -dpx(20) || p.y > sc.h - dpx(40)) p.y = Math.round(sc.h * 0.42);
    ST.pos = p; PETPOS.x = p.x; PETPOS.y = p.y;
    return p;
}
function bubblePos(faceX, faceY) {
    var sc = screenSize();
    var wPx = dpx(178), hPx = BUBH || dpx(60);
    var x = Math.round(faceX + dpx(32) - wPx / 2);
    x = Math.min(sc.w - wPx - dpx(6), Math.max(dpx(6), x));
    var y = Math.round(faceY - hPx - dpx(10));
    if (y < dpx(20)) y = Math.round(faceY + dpx(64) + dpx(10));
    if (y + hPx > sc.h - dpx(10)) y = Math.max(dpx(20), sc.h - hPx - dpx(10));
    return { x: x, y: y };
}
function showBubble(charId, text) {
    BUB_SEQ++;
    var seq = BUB_SEQ;
    try { if (BUB) { try { BUB.close(); } catch (e0) {} } } catch (e0b) {}
    BUB = null;
    var t = String(text || "").trim();
    if (!t) return;
    // 2026-10-23（主人点单）：用 3D 小人时 FACE 是关掉的，旧代码 `!FACE` 直接 return →
    //   语音状态气泡一条都看不见（「我在听」「让我听听」「听到了」全被吞）。现在 3D 在也照弹。
    var _useD3 = (!FACE && typeof D3 !== "undefined" && D3 && D3.on);
    if (!FACE && !_useD3) return;
    // 线程隔离创建（触摸回调跑在安卓主线程，浮窗操作一律挪到独立线程）
    try {
        threads.start(function () {
            if (seq !== BUB_SEQ) return;
            var disp = t + " " + CARECORE.decoOf(RNG);
            var lines = Math.min(4, Math.max(1, Math.ceil(t.length / 14)));
            var wPx = dpx(178), hPx = dpx(24 + lines * 20);
            BUBH = hPx;
            var pos;
            if (_useD3) {
                // 3D 窗 117×141dp：气泡对准它上半部分的中心，默认头顶；头顶贴边就落到脚下
                var sc3 = screenSize();
                var bx = (typeof D3.x === "number" ? D3.x : sc3.w - dpx(120)) + dpx(58);
                var by = (typeof D3.y === "number" ? D3.y : Math.round(sc3.h * 0.42));
                var px3 = Math.round(bx - wPx / 2);
                px3 = Math.min(sc3.w - wPx - dpx(6), Math.max(dpx(6), px3));
                var py3 = Math.round(by - hPx - dpx(8));
                if (py3 < dpx(20)) py3 = by + dpx(150) + dpx(8);
                if (py3 + hPx > sc3.h - dpx(10)) py3 = Math.max(dpx(20), sc3.h - hPx - dpx(10));
                pos = { x: px3, y: py3 };
            } else {
                pos = bubblePos(PETPOS.x, PETPOS.y);
            }
            var u = null;
            try { u = floaty.rawWindow(bubbleXml()); } catch (e1) { log("泡泡创建失败：" + e1); return; }
            if (seq !== BUB_SEQ) { try { u.close(); } catch (e2) {} return; }
            BUB = u;
            try { u.setSize(wPx, hPx); } catch (e3) {}
            try { u.setPosition(pos.x, pos.y); } catch (e4) {}
            try { u.setTouchable(false); } catch (e5) {}
            try { u.bubT.setText(disp); } catch (e6) { try { ui.run(function () { try { u.bubT.setText(disp); } catch (e7) {} }); } catch (e8) {} }
            var ttl = 4200 + Math.min(7000, t.length * 140);
            sleep(ttl);
            if (seq === BUB_SEQ) { try { if (BUB) BUB.close(); } catch (e9) {} BUB = null; }
        });
    } catch (eTH) { log("泡泡线程失败：" + eTH); }
}
function bindFace() {
    var downX = 0, downY = 0, winX = 0, winY = 0, moved = 0, downT = 0;
    FACE.petFace.setOnTouchListener(function (view, event) {
        try {
            var a = event.getAction();
            if (a === 0) { downX = event.getRawX(); downY = event.getRawY(); winX = PETPOS.x; winY = PETPOS.y; moved = 0; downT = Date.now(); }
            else if (a === 2) {
                var dx = event.getRawX() - downX, dy = event.getRawY() - downY;
                if (Math.abs(dx) + Math.abs(dy) > dpx(6)) moved = 1;
                if (moved) {
                    var nx = Math.round(winX + dx), ny = Math.round(winY + dy);
                    try { FACE.setPosition(nx, ny); } catch (eM0) {}
                    PETPOS.x = nx; PETPOS.y = ny;
                    try { if (BUB) { var bp = bubblePos(nx, ny); BUB.setPosition(bp.x, bp.y); } } catch (eM1) {}
                }
            } else if (a === 1 || a === 3) {
                var dt = Date.now() - downT;
                if (!moved && dt > 700) { try { app.launchPackage(context.getPackageName()); log("宠物·长按→打开主界面"); } catch (eL) {} }
                else if (!moved) { try { doPoke(); } catch (eP) { log("戳异常：" + eP); } }
                else { ST.pos = { x: PETPOS.x, y: PETPOS.y }; saveState(); log("宠物已挪位 " + PETPOS.x + "," + PETPOS.y); }
            }
        } catch (e) {}
        return true;
    });
}
function showFace() {
    // 2026-10-25（主人：「我的小宠物那个黄脸表情换成 3D 人」）：emoji 悬浮宠物**整段删掉**，
    //   这个入口（面板「悬浮」/启动自检/事件钩子）现在一律等于「开 3D 小人」。
    //   要回滚旧黄脸：见 App工程/_bak/ 里带 before_3dfixed1025 的那份。
    try {
        ST.floatOn = true; ST.d3On = true; saveState();
        var _r3f = d3Open();
        return (_r3f && _r3f.ok) ? { ok: true, on: true, mode: "3d" } : (_r3f || { ok: false, msg: "3D 开启失败" });
    } catch (eF3) { return { ok: false, msg: String(eF3) }; }
}
function hideFace() {
    // 2026-10-25（主人：「不管我悬浮人开没开它都要显示在那里」）：
    //   固定表演模式下**不再收起 3D**——「悬浮」这颗按钮只影响气泡/老宠物，3D 人常驻屏幕。
    //   真要收起来：先把面板「固定循环动作」关掉，再点收起。
    if (ST.d3Show) {
        try { if (BUB) { BUB.close(); } } catch (eB) {}
        BUB = null;
        ST.floatOn = false; saveState();
        log("悬浮按钮：固定表演模式下 3D 常驻，不收");
        return { ok: true, on: true, mode: "3d", kept: true };
    }
    // 黄脸宠物已弃用——收起 = 关 3D 小人（顺带把旧 emoji 窗清干净）
    ST.floatOn = false; ST.d3On = false; saveState();
    try { if (BUB) { BUB.close(); } } catch (e) {} BUB = null;
    try { if (FACE) { try { FACE.setTouchable(false); } catch (e0) {} FACE.close(); } } catch (e) {}
    FACE = null;
    try { d3Close(); } catch (eC) {}
    log("宠物已收起（3D 也关了）");
    return { ok: true, on: false };
}
// 眨眼小动作
try {
    threads.start(function () {
        while (true) {
            sleep(38000 + Math.floor(RNG() * 30000));
            try {
                if (FACE && Date.now() - (ST.lastSayAt || 0) > 8000) {
                    var s0 = FACE_SEQ;
                    try { FACE.petFace.setText(faceEmo(curChar(), "blink")); } catch (e) {}
                    threads.start(function () { sleep(430); if (s0 === FACE_SEQ && FACE) { try { FACE.petFace.setText(idleEmo()); } catch (e) {} } });
                }
            } catch (e) {}
        }
    });
} catch (eBlink) {}

// ===== 事件流 / 播报 =====
function pushFeed(ev) {
    ST.events.unshift({ t: Date.now(), type: ev.type, cat: ev.cat, text: ev.text || "", sim: !!ev.sim });
    if (ST.events.length > 10) ST.events = ST.events.slice(0, 10);
}
function composeEventText(ev, charId) {
    var line = CARECORE.pickLine(charId, ev.cat, RNG);
    if (!ev.text) return { speech: line, bubble: line };
    if (ev.cat === "health") return { speech: ev.text, bubble: ev.text };
    return { speech: line + "，" + ev.text, bubble: line + "\n「" + ev.text + "」" };
}
// prio=true：主人自己这条回复优先——打断正在播的事件提示（电量/健康这类），不让它们抢在前面。
function presentSay(charId, bubbleText, speechText, faceKind, doSpeak, prio) {
    ST.lastUsed = charId;
    ST.lastSayAt = Date.now();
    setFace(faceEmo(charId, faceKind || "happy"), faceKind === "poke" ? 2800 : 5500);
    try { if (FACE) { try { FACE.petBox.attr("bg", faceBg(charId)); } catch (eB) {} } } catch (e2) {}
    showBubble(charId, bubbleText);
    if (typeof D3 !== "undefined" && D3.on) { try { d3Load("careBubble('" + String(bubbleText || "").replace(/[\\'"\n\r]/g, " ").slice(0, 48) + "')"); } catch (eD) {} }
    // 2026-10-23（主人点单）：「聊天界面消息读不读或者只读开头一点」——播报判断统一收在这一处，
    //   聊天回复（doChat→presentSay）和流水线事件（react→presentSay）两条路都覆盖。
    //   0=不读（只弹气泡，聊天记录照样有）、1=只读开头一点（60 字）、2=读完整。
    //   【注意】气泡永远是全文——显示和播报是两件事，别把气泡也截了。
    if (doSpeak && ST.soundOn) {
        var _sm = (ST.sayMode === 0 || ST.sayMode === 2) ? ST.sayMode : 1;
        if (_sm !== 0) {
            var _sp = String(speechText || bubbleText || "");
            if (_sm === 1 && _sp.length > 60) _sp = _sp.slice(0, 60) + "…";
            // 2026-10-23（主人「聊天界面还是不读完」）：改成**排队**——后面的短提示（没听清/电量提醒）
            //   不再把正在念的长回复拦腰截断；实测 10:41:09 长回复就是被 10:41:23 那条提示打断的。
            speak(_sp, charId, !prio);   // 2026-10-23：聊天回复 prio=true → 打断事件提示（先答主人）
        }
    }
    saveState();
}
function react(ev) {
    pushFeed(ev);
    var g = CARECORE.quietCheck(QCFG, ST.freq, Date.now(), { imp: ev.imp || 2, cat: ev.cat || "other" });
    if (g.reason !== "dnd") ST.freq = CARECORE.markShown(ST.freq, ev.cat, g.action, Date.now());
    if (g.action === "silent") { saveState(); log("事件仅入库（" + g.reason + "）：" + ev.type + "/" + (ev.text || "")); return { ok: true, action: g.action, reason: g.reason }; }
    var charId = CARECORE.routeCharacter(ev, ST.mode);
    var txt = composeEventText(ev, charId);
    // 2026-10-23：播报详略开关 ST.sayMode —— 0=不读（只弹气泡）、1=只读摘要（默认）、2=读完整（≤300 字）。
    //   【为什么这里才决定】气泡和播报是两回事：气泡始终短，播报可以长。
    var sayMode = (ST.sayMode === 0 || ST.sayMode === 2) ? ST.sayMode : 1;
    var speech = txt.speech;
    if (sayMode === 2 && ev.full) {
        try { var _t2 = composeEventText(evt(ev.type, ev.cat, ev.full, ev.imp, ev.face), charId); if (_t2 && _t2.speech) speech = _t2.speech; } catch (eF2) { }
    }
    presentSay(charId, txt.bubble, speech, ev.face || (ev.cat === "concern" || ev.cat === "health" ? "concern" : "happy"), g.action === "speak" && sayMode !== 0);
    if (D3.on && g.action === "speak") {
        try {
            if (ev.type === "celebrate") d3Act("2H_Melee_Attack_Spin", 6000);
            else if (ev.type === "fixed") d3Act("Unarmed_Melee_Attack_Punch_A", 3000);
            else if (ev.type === "concern") d3Act("No", 2600);
        } catch (eD3) {}
    }
    log("播报(" + charId + "/" + g.action + ")：[" + ev.type + "] " + (ev.text || "").slice(0, 60));
    return { ok: true, action: g.action, reason: g.reason, char: charId };
}
function doPoke() {
    var charId = curChar();
    ST.pokeCount++;
    var line = CARECORE.pickLine(charId, "poke", RNG);
    ST.lastUsed = charId;
    ST.lastSayAt = Date.now();
    setFace(faceEmo(charId, "poke"), 2800);
    showBubble(charId, line);
    // 2026-10-25（主人「戳它也不出声」）：戳是他主动逗它，就该有声音——安靜时段只拦"我们主动开口"
    var canSpeak = !!ST.soundOn;
    if (canSpeak) speak(line, charId);
    ST.freq = CARECORE.interact(ST.freq, Date.now());
    // 2026-10-23（主人「全是轻轻微微的一直左右动，那种动有屁用」）：戳它要真有反应——
    //   原来池子里是 ThumbsUp/Jump/武术这些**动画片段名**，绑骨模型没有片段 → 戳了也只会站着。
    //   改成骨骼能演的：挥手/跳舞/环顾。
    if (D3.on) { var d3pool = ["Wave", "Dance", "Look"]; d3Act(d3pool[Math.floor(Math.random() * d3pool.length)], 2800); }
    saveState();
    log("戳互动(" + charId + ")： " + line);
    return { ok: true, line: line, char: charId };
}
function simEvent(kind) {
    if (kind === "analysis") {
        // v0.4.3 演示入口：人体全元素分析（饮食/作息/情绪/身体 四维画像）
        var an0 = careAnalysis();
        var aTxt0 = an0.ok ? an0.text : "分析没跑起来";
        MEM.chat.push({ t: Date.now(), me: "🔎 [分析]", pet: aTxt0, char: curChar() });
        if (MEM.chat.length > 60) MEM.chat.shift();
        saveMem();
        presentSay(curChar(), aTxt0, "给你整理好啦，看聊天里我画的像～", "happy", ST.soundOn && !CARECORE.inDnd(QCFG, nowMinOf(Date.now())));
        return { ok: true, sim: "analysis" };
    }
    if (kind === "meal") {
        // v0.4.2 演示入口：不用等到饭点就能看完整链路（问 → 应答复述 → 邀拍 → 拍饭分析）
        MEM.health.pendingAsk = { t: Date.now(), meal: "试" };
        var mSay = "到饭点啦～今天准备吃什么？回我一句就行～";
        presentSay(curChar(), mSay, mSay, "happy", ST.soundOn && !CARECORE.inDnd(QCFG, nowMinOf(Date.now())));
        saveMem();
        return { ok: true, sim: "meal" };
    }
    var ev;
    if (kind === "concern") ev = { type: "concern", cat: "concern", text: "示例演示：一件小事出了点状况，我来心疼你一下", imp: 3, sim: true, face: "concern" };
    else ev = { type: "celebrate", cat: "celebrate", text: "示例演示：又交付了一件新东西", imp: 3, sim: true, face: "happy" };
    return react(ev);
}

// ===== 谈心 / 记忆 =====
function appendChatLog(s) {
    // 2026-10-21（用户报「聊天记录文件最后面有句导航去路，明明我没说」）：
    //   文件聊天桥的**测试流量**（test:true，界面已按「不落盘」回滚）以前仍照写进这份人人都能看的聊天记录——
    //   实测 关心_对话.log 里 36 条「导航去春熙路」里有一大批是 ccode 的自动化测试。
    //   测试流量一律不进聊天记录（只进调试日志），真实对话一个字不动。
    try { if (typeof NO_SAVE !== "undefined" && NO_SAVE) { log("测试流量：不写聊天记录（" + String(s).slice(0, 40).replace(/\n/g, " ") + "）"); return; } } catch (eG) {}
    try { javaWriteLine(CHAT_LOG, s); } catch (e) {}
}
// v0.6.0：确定性快回（记账/休息/精力这类不该让 AI 自由发挥的话）
function careQuickReply(charId, msg, text, tag) {
    try {
        MEM.chat.push({ t: Date.now(), me: msg, pet: text, char: charId, eng: "local" });
        if (MEM.chat.length > 60) MEM.chat.shift();
        saveMem();
        appendChatLog("[" + nowStr() + "] 我：" + msg + "\n[" + nowStr() + "] " + (CARECORE.CHARS[charId] || {}).name + "：" + text + "\n");
        presentSay(charId, text, text, "happy", ST.soundOn && !CARECORE.inDnd(QCFG, nowMinOf(Date.now())));
        log("谈心(" + (tag || "快回") + ")：我「" + String(msg).slice(0, 24) + "」→「" + text.slice(0, 34) + "」");
        return { ok: true, reply: text, char: charId, act: (tag || "quick"), engine: "local" };
    } catch (e) { return { ok: false, msg: String(e) }; }
}
function doChat(raw) {    var msg = String(raw || "").trim();
    // 2026-10-23：主人又开口了 → 先停下正在念的旧回复（新话优先）；非用户触发的提示仍然排队不打断。
    try { if (TTS && TTS.ready && TTS.inst) { TTS.inst.stop(); } } catch (eStop) { }
    if (!msg) return { ok: false, msg: "空消息" };
    // 主人一发新消息就打断自主续跑；系统自己续跑那条（前缀「（系统·继续」）不算打断
    if (msg.indexOf("（系统·继续") < 0) { try { autoClear("主人又说话了"); } catch (eAC0) {} }
    // 主人又说话了 → 取消还没执行的网络补发（他的新话优先）
    if (msg.indexOf("（系统·重试") < 0) { try { NETRETRY.msg = ""; } catch (eNR0) {} }
    // v2.1.6（2026-10-19 02:2x 实测）：重装后**头几秒**的消息会读到私有旧副本（当时那句「昨天没记账」，
    //   同一秒才出现「MEM 采纳磁盘新版本 money 0→6」）。每次聊天前先自愈一次（已是最新就直接返回）。
    try { careMemHealNow(); } catch (eH0) {}
    var charId = curChar();
    var engine = "local", reply = null, actDone = null, mood = null;
    // ===== v0.8.0：**对话里不再有任何写死的意图分支**（用户拍板「把你写死的所有东西全部删除，全让 AI 判断操作」）====
    // 原先这里有：记:/忘掉 的命令解析、「分析我」关键词、收支/休息/精力 一堆正则拦截——全部删掉。
    // 现在：AI 看这句话 → 自己决定要不要调工具（读数据/记账/改休息/记指标/记事实…）→ 用真实结果回话。
    // 只有 AI 完全不可用（没网/没 key/额度尽）时，才用一句模板话术兜底，并如实说「我连不上大脑」。
    AI_NET_FAIL = false; AI_NET_MSG = "";   // 每轮重置：这一轮到底有没有网络失败
    mood = CARECORE.moodOf(msg);
    var ar2 = null;
    if (ST.aiOn) {
        // v1.0.0：主路径＝「模型出 JSON 行动计划 → App 真执行 → 回报真实结果」
        var plan = carePlanAsk(msg, charId);
        // 2026-10-18 用户第三次报障「说了支出它只回『记住了』」：模型把带钱的话判成 add_fact（只存记忆、账本不动）。
        // 这里给模型一次自查机会——**判断权仍归模型**（只问「这句话里有没有钱」，由它自己决定换不换动作），
        // 不写任何正则判据。
        try {
            if (plan && String(plan.action || "") === "add_fact") {
                var plan2 = carePlanAsk(msg + "\n【自查】这句话里涉及收入／支出／每月固定支出吗？涉及就必须改用 add_money（今天实际花的/挣的）或 set_fixed（每月固定的），不许用 add_fact，也不许只回一句「记住了」。", charId, true);
                if (plan2 && /^(add_money|set_money|set_fixed)$/.test(String(plan2.action || ""))) {
                    log("计划自查：add_fact → " + plan2.action);
                    plan = plan2;
                }
            }
        } catch (eRe) {}
        // v1.5.7（2026-10-18 14:3x 实测：v1.5.6 加了 multi 和提示词，模型仍只挑一件——
        //   「12点起床吃饭…吃完在跑车」还是只回 add_diet）→ 再给它一次**完整性自查**：
        //   只问「这句里还有没有别的事要做」，由它自己决定要不要改成 multi。不写任何判据。
        try {
            var act0 = String((plan && plan.action) || "chat");
            if (plan && act0 !== "chat" && act0 !== "multi") {
                var planFull = carePlanAsk(msg + "\n【完整性自查】你刚才只选了 " + act0 + "（一件事）。这句原话里还有没有别的事要做（吃了什么／几点起床／在跑车或收车／**钱：只要原话里出现了金额或「花了/挣了/多少钱/块/元」，就必须把 add_money 一起列进 multi——只记了吃啥却漏掉钱＝把主人的账记错了**／身体指标／情绪）？**有多件就必须改用 multi，把全部动作按顺序列出来**；确实只有这一件，就原样再用 " + act0 + " 回答一次。" + "\n【还有一件更重要的事】**如果主人交给你的是一件多步任务**（比如「查一下哪里不对，改好打包安装」「把那个问题修一下」「自己看看有没有毛病」），那么只 read_file 看了一眼**不算做完**——你必须用 auto_next 把下一步写进去（如 {\"action\":\"auto_next\",\"args\":{\"next\":\"找 careMapSearch 那段代码，定位后 code_edit 改掉，再 self_update 打包\"}}），系统会自动接着跑下一轮，直到真正改完、打包完。**光读不给下一步＝没做**。", charId, true);
                if (planFull && String(planFull.action || "") === "multi" && (planFull.actions || []).length > 1) {
                    plan = planFull;
                    log("完整性自查：单动作 → multi(" + planFull.actions.length + " 件)");
                } else {
                    log("完整性自查：确认只有 " + act0 + " 一件");
                }
            }
        } catch (eFull) {}
        // v1.5.3（2026-10-18 13:38 实锤：「上一句我说的啥」→ 模型拿上一句内容去 add_diet → 参数不在原话里 →
        // 被 careArgsGrounded 拦下 → 直接用一句固定话术回「我没听清要记什么（我不编）」，用户看到的却是「分析不到我要做啥」）。
        // 修法不写新判据：给模型一次自查机会，让它自己改成 chat 或只用原话内容重答；
        // 判断权仍归模型，App 只负责把「参数不在原话里」这个事实告诉它。
        try {
            var actCk = String((plan && plan.action) || "chat"), argsCk = (plan && plan.args) || {};
            if (plan && actCk !== "chat" && !careArgsGrounded(actCk, argsCk, msg)) {
                log("计划参数不在原话里 → 让模型自查一次（原动作 " + actCk + "）");
                var planFix = carePlanAsk(msg + "\n【自查】你刚选的 " + actCk + " 的参数在**这句原话里根本找不到**（不要拿上一句或历史里的内容当新数据）。二选一：①这句是问句/回忆/分析 → 改成 chat 直接回答；②确实要动手 → 只用这句原话里真实出现的内容重答。禁止编造，也禁止反问「要记什么」。", charId, true);
                if (planFix) {
                    var fixAct = String(planFix.action || "chat");
                    log("计划自查后动作=" + fixAct);
                    // v2.0.2：自查判成 chat 时，它的 say 是「模型对内部提示的答话」，一律不采信（见 carePlanAsk 注释）。
                    //   丢掉计划 → 落到工具循环，用正常提示词重新回答主人（那儿没有「要记什么」的上下文污染）。
                    if (fixAct === "chat") plan = null; else plan = planFix;
                }
            }
        } catch (eGnd) {}
        plan = careArbitratePlan(plan, msg);
        // 计划里只有闲聊、连话都没给（模型选了 read_* 但被仲裁成没有内容的 chat）→ 当没拿到计划处理
        if (plan && String(plan.action || "chat") === "chat" && !String(plan.say || "").trim()) plan = null;
        // v1.1.1（2026-10-17·用户当面追问「该做的事为啥只说不做」）：
        // 实测根因＝模型把「我在充电马上完了休息」这类**要动手的话**判成了闲聊（action=chat），
        // App 就把它那句「好的，我已经记录下你即将休息的信息」原样说了出去——嘴上答应了、数据一个字没动。
        // 现在：计划判成闲聊但这句话像要动作 → **不采信**，改走工具循环逼它真调工具。
        // v1.4.0（2026-10-18 用户报障「『你自己分析』→ 它回『我没能执行，你再说一次』」）：
        // 原先这里用 CARE_ACTION_RE 判「像要动作」就不采信闲聊计划，硬推去工具循环；工具循环又
        // tool_choice=required 逼它调工具——弱模型找不到合适工具，最后统一认输。
        // 现在**不写死判据**：模型说这是闲聊并给了内容，就采信（分析/建议本来不用动数据）。
        if (plan) {
            var pr = carePlanRun(plan, msg, charId);
            reply = pr.text;
            engine = pr.ate ? ("plan(" + (pr.act || "?") + ")") : "ai";
            actDone = pr.ate ? (pr.act || "plan") : null;
        } else {
            // 计划拿不到（网络/解析失败）→ 退回工具循环
            // v2.0.0（2026-10-18 23:5x 用户当面拍桌：「全是你写死的东西回复我……如果 ai 没接通，就直接给我说没接通」）：
            //   删掉两处写死的东西——① 用 /(记|改|设|…)/ 正则判断「这句话要不要动手」；
            //   ② 「这次我没真正执行成功（大脑没连上）…」这类安慰式套话。
            //   现在只剩一条铁的出口：**没接通就直说没接通 + 真实原因**（原因来自真实错误，不是我编的话）；
            //   其余一律由模型自己说、自己调工具。
            log("计划路径不可用，改用工具循环");
            ar2 = aiChatWithTools(msg, charId);
            if (ar2.ok) {
                reply = String(ar2.text || "");
                engine = "ai" + (ar2.tools && ar2.tools.length ? "(" + ar2.tools.join(",") + ")" : "");
            } else {
                var _why = String(AI_NET_MSG || ar2.msg || "未知原因").slice(0, 90);
                log("AI 未接通（计划与工具两条路都失败）：" + _why);
                reply = "没接通：" + _why;
                engine = "ai-down";
            }
        }
    }
    if (!reply) {
        // v2.0.0：计划里的事没做成（参数不在原话里等）——先把话筒交回模型（工具循环），
        //   让它用自己的话说；它也没接上，才报没接通。绝不用写死文案顶替。
        var _ar3 = aiChatWithTools(msg, charId);
        if (_ar3 && _ar3.ok) {
            reply = String(_ar3.text || "");
            engine = "ai" + (_ar3.tools && _ar3.tools.length ? "(" + _ar3.tools.join(",") + ")" : "");
        } else {
            log("工具循环也没接上：" + String((_ar3 && _ar3.msg) || ""));
        }
    }
    if (!reply) {
        // v2.0.0：这里以前是「网络不通→写死一句话」＋「其他情况→走本地预设话术」。
        //   用户拍桌：写死的全删、没接通就直接说没接通。现在只剩事实。
        var _why2 = String(AI_NET_MSG || "未知原因").slice(0, 90);
        reply = "没接通：" + _why2;
        engine = "ai-down";
        log("AI 未接通（计划路径也无结果）：" + _why2);
    }
    // 2026-10-25（10-24 14:19 / 15:47 / 20:41 / 22:00 四次实锤）：DNS 一抽风就回「没接通」，账没记上、
    //   主人只能回一个「？」它才补记。这里把原话存进待补记队列，网络恢复后自动补一遍并主动说一声。
    //   只存本轮零工具失败的（engine 还是 ai-down），避免已经动过手的再跑一遍、重复记账。
    try { if (engine === "ai-down") carePendingPush(msg); } catch (ePP) {}
    try { var _clean = careSayClean(reply); if (_clean !== reply) { log("回话清洗：剥掉协议垃圾 " + (String(reply).length - _clean.length) + " 字"); reply = _clean || reply; } } catch (eCl) {}
    if (mood) { MEM.mood.push({ t: Date.now(), m: mood }); if (MEM.mood.length > 300) MEM.mood.shift(); }
    // v2.1.2（2026-10-19 01:5x·用户问「黄字回复都是写死的吗？绿字才是接通 AI」）：记下这条回复是**谁给的**——
    //   engine 有四种：ai（真调了模型）/ plan(xxx)（行动计划）/ local（本地确定性快回）/ ai-down（没接通）。
    //   面板聊天记录照这个标一个小标签（AI／本地／没接通），主人一眼就能分清楚，不用靠颜色猜。
    // 2026-10-22（㉗）：打字这条路也记一笔「他刚才说的是什么」——复读/串台只报事实，判断权在模型
    try { careEchoNote(msg); } catch (eE2) {}
    // 2026-10-22：落一条**事实**——这一轮到底调了几个工具（0＝只在说话）。下一轮它自己看得到。
    var _tnNow = 0;
    try { if (ar2 && ar2.tools) _tnNow = ar2.tools.length; } catch (eTn) {}
    if (!_tnNow && actDone) _tnNow = 1;
    MEM.chat.push({ t: Date.now(), me: msg, pet: reply, char: charId, eng: engine, tn: _tnNow });
    // v0.8.0：不再用关键词自动归档（careHealthDigest 的硬规则已从对话链路移除）——记什么由 AI 调工具决定
    if (MEM.chat.length > 60) MEM.chat.shift();
    saveMem();
    appendChatLog("[" + nowStr() + "] 我：" + msg + "\n[" + nowStr() + "] " + (CARECORE.CHARS[charId] || {}).name + "：" + reply + "\n");
    ST.freq = CARECORE.interact(ST.freq, Date.now());
    // 2026-10-25 修（主人「它说话咋没声音了」）：原来这里跟着安靜时段一起静音——但这是**主人主动开口**，
    //   不是我们主动打扰，安静策略的本意是「别主动吠」，不能把主人要的回应吞掉（凌晨 2:50 实测：连「说(」都没有）。
    var speakIt = !!ST.soundOn;
    presentSay(charId, reply, reply, "happy", speakIt, true);   // 2026-10-23：聊天回复优先播
    log("谈心(" + charId + "/" + engine + "/" + actDone + ")：我「" + msg.slice(0, 30) + "」→「" + reply.slice(0, 30) + "」");
    // v1.3.1：录完立刻让面板重新拉一次 status——否则新记住的东西要重开面板才看得到
    try { web.loadUrl("javascript:try{poll()}catch(e){}"); } catch (eRf) {}
    // 自主续跑（2026-10-19 用户「不要我一直叫你」）：模型要求接着干 → 1.8 秒后排下一轮
    try {
        if (AUTO.next && AUTO.left > 0) {
            var _nxt = AUTO.next; AUTO.next = ""; AUTO.left--;
            actLog("继续", "我自己接着干（还能续 " + AUTO.left + " 轮）：" + _nxt);
            if (AUTO.timer) { try { clearTimeout(AUTO.timer); } catch (eT0) {} }
            AUTO.timer = setTimeout(function () {
                AUTO.timer = null;
                // 【2026-10-19 16:16 实锤】setTimeout 的回调跑在 **UI 主线程**，而 doChat 里会发网络请求
                //   （java.net.URL.openConnection）→ android.os.NetworkOnMainThreadException，
                //   表现是「计划档位 + 工具模型同时不可用 → 没接通：工具模型不可用」。必须扔到子线程跑。
                try {
                    threads.start(function () {
                        try { doChat("（系统·继续）" + _nxt); } catch (eAC) { log("自主续跑失败：" + eAC); }
                    });
                } catch (eT1) { log("自主续跑起线程失败：" + eT1); }
            }, 1800);
        }
    } catch (eAU) {}
    // 【2026-10-19 16:07 实锤】api.deepseek.com 的 DNS 抖了 9 秒，计划+工具两条路全撞死 →
    //   回主人一句「没接通：UnknownHostException」，他得自己再发一遍。加一道**自动补发**。
    // 【2026-10-20 11:18 再犯】这次是 Wi-Fi 断了一分多钟：原版「30 秒后补一次」补的时候网还没回来，
    //   照样失败，这句话就真没了。改成 4 轮续试（30s/1m/2m/4m，约 7 分钟），每轮先确认有没有网，
    //   没网只等不吃次数；网一回来自动接着答。
    try {
        if (engine === "ai-down") {
            var _base = String(msg).replace(/^（系统·重试）/, "");
            if (String(msg) === _base) { NETRETRY.msg = _base; NETRETRY.n = 0; }   // 新的一句话：重置轮次
            if (NETRETRY.msg === _base) {
                var _plan = [30000, 60000, 120000, 240000];
                var _k = NETRETRY.n || 0;
                if (_k === 0) actLog("网络", "这次没接通——我盯着网络，通了自己接着答（最多 4 轮，约 7 分钟）");
                if (_k < _plan.length) {
                    NETRETRY.n = _k + 1;
                    try { NETRETRY.timer = setTimeout(netRetryTry, _plan[_k]); } catch (eT3) {}
                } else {
                    NETRETRY.msg = "";
                    actLog("网络", "等了 7 分钟还是没通，先放下——你说话我再试");
                }
            }
        } else {
            NETRETRY.msg = ""; NETRETRY.n = 0;    // 通了：清掉待补
        }
    } catch (eNR2) {}
    return { ok: true, reply: reply, char: charId, mood: mood, act: actDone, engine: engine, facts: MEM.facts.slice(-12), chat: MEM.chat.slice(-40) };
}

// ===== v0.1.1 耳朵与大脑（语音对话 + AI 谈心） =====
var ZKEY = null;
function loadZKey() {
    if (ZKEY) return ZKEY;
    try {
        var j = JSON.parse(readText(BASE + "/雷达密钥.json"));
        if (j && j.zp_keys && j.zp_keys[0]) ZKEY = String(j.zp_keys[0]);
    } catch (e) {}
    return ZKEY;
}

// ===== v2.1.5：**换模型不用重装**（2026-10-19 02:1x 用户：「我受够了智谱模型了，要把我逼疯，换模型」）=====
// 读 /storage/emulated/0/脚本/关心_模型配置.json；任何一项缺省 → 完全退回原来的智谱默认（零风险）。
// 改完文件**一分钟内自动生效**，不用重新打包；只有改代码功能才需要重装。
// 字段（都可缺省）：
//   chatUrl / chatKey        —— 对话用的 OpenAI 兼容地址与密钥（DeepSeek、硅基流动、百炼、Kimi 都兼容）
//   planModels / toolModels / answerModels / quickModels / chatModels —— 各用途模型名数组（按强→弱降级）
//   visionUrl / visionKey / visionModels —— 看图（拍照/视频），不配就沿用智谱 glm-4v-flash
var MC = null, MC_T = 0;
function careModelCfg() {
    try {
        var now = Date.now();
        if (MC && (now - MC_T) < 60000) return MC;
        var raw = readText(BASE + "/关心_模型配置.json");
        var okCfg = false, tmp = null;
        if (raw) { try { tmp = JSON.parse(raw) || {}; okCfg = !!(tmp && (tmp.chatUrl || tmp.chatKey || tmp.toolModels || tmp.planModels)); } catch (eJ2) { okCfg = false; } }
        if (okCfg) { MC = tmp; MC_T = now; return MC; }
        // 2026-10-22 22:48 实锤：装完新版那一刻读不到配置 → 旧代码把「空配置」缓存 60 秒，
        //   于是计划/工具全掉回默认智谱档 glm-4-plus（它只会空承诺，不真调工具）。
        //   现在：读失败只记 5 秒就重试，并写日志（下次一眼能看出是「配置没读到」而不是模型笨）。
        MC = MC || {};
        MC_T = now - 55000;            // 5 秒后重试
        try { log("模型配置读不到（" + (raw ? "内容不完整" : "文件读不出") + "）：先按默认档跑，5 秒后重试 " + BASE + "/关心_模型配置.json"); } catch (eL2) { }
    } catch (eM0) { MC = MC || {}; MC_T = Date.now() - 55000; }
    return MC;
}
function careCfgList(kind) {
    var c = careModelCfg();
    var v = c[kind + "Models"];
    if (v && v.length) { var a = []; for (var i = 0; i < v.length; i++) a.push(String(v[i])); return a; }
    if (kind === "vision") return ["glm-4v-flash"];
    if (kind === "quick") return ["glm-4-flash"];
    if (kind === "chat") return ["glm-z1-flash", "glm-4-flash"];
    return ["glm-4-plus", "glm-4-air", "glm-4-flash"];
}
function careCfgUrl(kind) {
    var c = careModelCfg();
    var v = (kind === "vision") ? c.visionUrl : c.chatUrl;
    // 注意：这里的默认值必须是**字面量**，不能写成 careCfgUrl("chat")（会自递归）——
    //   2026-10-19 加这层时被批量替换误伤过一次，已单独改回来。
    return String(v || "https://open.bigmodel.cn/api/paas/v4/chat/completions");
}
function careCfgKey(kind) {
    var c = careModelCfg();
    var v = (kind === "vision") ? c.visionKey : c.chatKey;
    return String(v || "") || loadZKey();
}
// 2026-10-20 07:07 派单前置：先判「现在到底有没有网」
//   为什么需要：2026-10-20 07:07 手机熄屏睡 4h45m 后刚亮屏，App 立刻连打 4 枪全 UnknownHostException，
//   而当时其实是网络堆栈还没起来。分清楚「有网但 DNS 抖」和「压根没网」：
//   前者值得多等几秒（netd 目录常常十几秒才恢复），后者没必要让主人干等——快点如实说「没接通」。
//   边界：拿不到系统服务/抛异常一律当「有网」（宁可多等等，也不许因为判网失败把正常请求挡掉）。
function careNetOnline() {
    try {
        var cm = context.getSystemService(android.content.Context.CONNECTIVITY_SERVICE);
        if (!cm) return true;
        if (cm.getActiveNetwork) {
            var nw = cm.getActiveNetwork();
            if (!nw) return false;
            var caps = cm.getNetworkCapabilities(nw);
            if (!caps) return false;
            return caps.hasCapability(android.net.NetworkCapabilities.NET_CAPABILITY_INTERNET);
        }
        return true;
    } catch (e1) {
        try {
            var cm2 = context.getSystemService(android.content.Context.CONNECTIVITY_SERVICE);
            var ni = cm2.getActiveNetworkInfo();
            return !!(ni && ni.isConnected());
        } catch (e2) { return true; }
    }
}
function httpPostJson(url, obj, headers, tConnMs, tReadMs, maxTries) {
    // 2026-10-20 07:07（自动流水线派单）：手机熄屏睡了 4 小时 45 分刚亮屏，App 一醒就开火，
    //   4 枪全撞 UnknownHostException（4.5 秒内把重试额度烧光），接着第二档模型也全灭，
    //   「每日一策」当天第一枪就这么废了（日志：07:07:34 / 07:07:43 两条 UnknownHostException）。
    //   根因：重试窗口太短（约 4.5 秒），而刚亮屏时 netd/DNS 常有十几秒空窗；且没有区分
    //   「有网但解析抖」和「真的没网」。下面 careNetOnline() 就是为这个判一次网的。
    // v2.0.1（2026-10-18 23:49 实锤：App 回「没接通：UnknownHostException: Unable to resolve host open.bigmodel.cn」，
    //   同一时刻 Termux 侧 curl 同一个域名 200 OK——说明是**瞬时的解析/建连抖**，不是断网。
    //   用户话：「如果 ai 没接通，就直接给我说没接通，再不断找问题修复它」——
    //   所以这里先自己重试（3 次、递增退避）把抖动吃掉，真三次都失败才如实上报原因。）
    // 2026-10-20：有网却解析不通时给到 5 枪（退避 2/4/6/8 秒，约 20 秒窗口）；
    //   真没网则不熬时间，快速退回来如实上报（让 10 分钟后的节拍再来，而不是让主人干等）。
    var maxAttempt = Math.max(1, Number(maxTries) || 4);   // 2026-10-21：长文本模型一枪 120 秒，调用方可以只给 1-2 枪（超时重试最费时间）
    var lastMsg = "网络失败";
    for (var attempt = 1; attempt <= maxAttempt; attempt++) {
        var conn = null;
        try {
            conn = new java.net.URL(url).openConnection();
            conn.setRequestMethod("POST");
            conn.setConnectTimeout(tConnMs || 8000);
            conn.setReadTimeout(tReadMs || 30000);
            conn.setRequestProperty("Content-Type", "application/json");
            if (headers) { for (var k in headers) { conn.setRequestProperty(k, String(headers[k])); } }
            conn.setDoOutput(true);
            var os = conn.getOutputStream();
            os.write(new java.lang.String(JSON.stringify(obj)).getBytes("UTF-8"));
            os.flush(); os.close();
            var code = conn.getResponseCode();
            var is = (code >= 200 && code < 400) ? conn.getInputStream() : conn.getErrorStream();
            var txt = "";
            if (is) {
                var br = new java.io.BufferedReader(new java.io.InputStreamReader(is, "UTF-8"));
                var ln = null, sb = "";
                while ((ln = br.readLine()) !== null) sb += ln;
                br.close(); txt = sb;
            }
            if (attempt > 1) { try { log("HTTP 第 " + attempt + " 次才通（前 " + (attempt - 1) + " 次失败：" + lastMsg.slice(0, 60) + "）"); } catch (eLg) {} }
            // v2.0.4（2026-10-19 00:2x 实锤，这是「空回复」/「没接通：未知原因」的总根因）：
            //   以前不看状态码——429/401 也走 return ok:true，错误体（{"error":...}）被上层当成模型回复去解析，
            //   于是 j.choices 不存在 → message 空 → 报「空回复」→ 最终「没接通：未知原因」，而真实原因是**限流**。
            //   实测：同一把 key glm-4-plus / glm-4-air 都 429（额度尽），只有 glm-4-flash 通。
            //   现在如实按状态码判失败，上层「强→弱降级链」才能真的降下来。
            if (code >= 400) {
                return { ok: false, code: code, text: txt, msg: "HTTP " + code + " " + String(txt || "").slice(0, 160) };
            }
            return { ok: true, code: code, text: txt };
        } catch (e) {
            lastMsg = String(e);
            var transient = /UnknownHost|Unable to resolve|ConnectException|SocketTimeout|timed out|NoRouteToHost|Network is unreachable/i.test(lastMsg);
            // 2026-10-20：网络层判据——解析不通 vs 真没网，决定「多等一会」还是「快速失败」
            var _dnsFlaky = /UnknownHost|Unable to resolve|NoRouteToHost|Network is unreachable/i.test(lastMsg);
            var _online = careNetOnline();
            if (_dnsFlaky && _online && maxAttempt < 5) { maxAttempt = 5; }   // 有网却解析不通 → 再给一枪
            try { log("HTTP 请求失败（第 " + attempt + "/" + maxAttempt + " 次）：" + lastMsg.slice(0, 90) + (transient ? " → 重试" : "") + (_dnsFlaky && !_online ? "（判定：当前没网）" : "")); } catch (eLg2) {}
            if (!transient || attempt >= maxAttempt) return { ok: false, code: -1, text: "", msg: lastMsg };
            // v2.0.3（2026-10-19 00:2x 派单闭环）：UnknownHost 不只是等——先**主动做一次域名解析预热**刷掉
            //   netd 里那条坏缓存，再等退避。光 sleep 只是碰运气等系统自己恢复；预热是主动打一次
            //   InetAddress.getByName，解析成功就等于把正确 A 记录写回缓存，下一轮 openConnection 直接命中。
            //   失败也无妨（当次解析抖没恢复），交给退避 + 下一轮。
            var _dnsFlaky2 = /UnknownHost|Unable to resolve/i.test(lastMsg);
            if (_dnsFlaky2) {
                try {
                    var _host = new java.net.URL(url).getHost();
                    java.net.InetAddress.getByName(_host);
                    try { log("DNS 预热成功：" + _host); } catch (eLg3) {}
                } catch (eDns) { try { log("DNS 预热仍未通：" + String(eDns).slice(0, 60)); } catch (eLg4) {} }
            }
            // v2.0.2：UnknownHost 是解析抖（排障实测：同刻 Termux 侧 python getaddrinfo 40/40 全通），
            //   给系统 DNS 更长恢复窗口；2026-10-20 起改成有网 2s 起跳（刚亮屏时 netd 常有十几秒空窗）
            try { java.lang.Thread.sleep((_dnsFlaky ? (_online ? 2000 : 800) : 800) * attempt); } catch (eS) {}
        } finally { try { if (conn) conn.disconnect(); } catch (e2) {} }
    }
    return { ok: false, code: -1, text: "", msg: lastMsg };
}
// v0.6.4：让 AI 真正「知道自己能干什么、主人现在什么情况」（用户 21:07 实测：问「这个 app 里的东西你都不知道吗」
// 它答「我主要专注陪你聊天，其他功能不太熟悉」——因为旧系统提示只给了人设，没给能力清单，还限死 50 字不许列清单）
function careSelfContext() {
    try {
        ensureWorkMem();
        var t = careMoneyToday(), r = careRestToday(), en = careEnergy(), ea = careElemAvg(7);
        var lows = (ea && ea.lows ? ea.lows.slice(0, 4).join("、") : "");
        var cap = "本 App（关心）现有能力：" +
            "①陪聊与语音对话（点麦克风说话／打字）；" +
            "②3D 小人（可换模型、支持真骨骼动作）；" +
            // 2026-10-25（主人「它说话咋没声音了，而且也没驱动法师做相应的动作」）：光有工具不够——
            //   模型不知道"自己有身体"，就会一直用嘴答。这句把身体与动作能力写进能力清单，它才会想到调。
            "②b **你自己有一个身体（body_do 工具）**：主人说「走过来／挥个手／坐下／跳一下／转过来看看我／打个拳」这类要你**用身体做动作**的话时，" +
            "**必须调 body_do 让它真做**（光回一句「好呀」等于没做）；不确定当前身体有哪些动作，就把 action 填 list 查一次（法师 76 条；也可以直接填原名如 Spellcast_Long）；" +
            "③饮食：拍饭或说「吃了啥」→ 营养塔＋元素体检（每项按**量**给：估算多少 mg/μg/g、每日参考量、还差多少、怎么补、不补会怎样）；" +
            "③b 今天怎么吃（diet_plan 工具）：按「健康缺口＋钱包预算」算一日三餐＋加餐的具体吃法与花费，预算按**主人说过的每天净收入的一半**算（他说 30 元/天 → 一天 15 元；没说过才退回日均流水的 25%，主人直接给的数优先）；" +
            "④健康档案：体重/血压/心率/血氧/血糖/体温/腰围/身高，报数字就记；" +
            "⑤跑车账本：说「今天跑了320，加油200，在线9小时，23单」→ 算净收入、时薪、每单均价；账本会自动分类（加油充电/吃饭/车务/份子租金/生活），问「这周花了多少/钱都花哪了」用 money_report；" +
            "⑤b **每月固定要交的钱**（车租金／房贷／会员费这类「每月/每年固定」的）用 fixed_add 记（name＋amount＋cycle），**千万别当成今天的支出用 money_add 记**——那样今日支出会被凭空拉高；问「每月固定多少」就用 read_data 的账本行看；" +
            "⑤c **现在在不在跑车**：主人说「我在跑车/出车了/开工了」→ start_work，「收车了/不跑了」→ end_work；当前状态：" + (MEM.work.on ? ("在跑车中（" + Math.round((Date.now() - (MEM.work.since || Date.now())) / 60000) + " 分钟前开工）") : "没记在跑车") + "；" +
            "⑥休息记录：说「歇会儿」「起了」，或熄屏 ≥2 分钟自动记；也可补记「午饭歇了1小时」；" +            "⑦精力估分与疲劳提醒：连跑 ≥2 小时会提醒歇，休息时长按连跑时长和时段给建议；" +
            "⑧周报与屏幕使用时长；" +
            "⑨定位监测（默认关，开启后只判「在开车/停着」，不留轨迹）；" +
            "⑩读文件／搜文件／列目录：主人给路径或文件名，你能真的读手机里的文本文件（/storage/emulated/0 以内）、在文件或文件夹里搜内容、列目录，并**就内容做分析**（不是猜）；读不到（权限／Termux 私有目录）就如实说读不到。";
        var data = "主人当前情况：今日收入 " + careYuan(t.inSum) + " 元、支出 " + careYuan(t.outSum) + " 元、净 " + careYuan(t.net) + " 元" +
            (t.day.hours ? "、在线 " + t.day.hours + " 小时" : "") + (t.day.orders ? "、" + t.day.orders + " 单" : "") +
            "；今日已休 " + r.mins + " 分钟" + (r.open ? "（正在歇，已 " + Math.round((Date.now() - r.open.s) / 60000) + " 分钟）" : "") +
            "；这次连续在岗约 " + (Math.round(careDuty().mins / 6) / 10) + " 小时" +
            "；精力 " + en.score + "/100（" + en.level + "）" + (en.reasons.length ? "，原因：" + en.reasons.join("；") : "") +
            (lows ? "；近 7 天元素短板：" + lows : "") +
            (MEM.work && MEM.work.platform ? "；平台：" + MEM.work.platform : "") +
            // 2026-10-25：饭点问过之后，把「刚问过你午饭吃什么」当**事实**摆给模型，由它判断这句是不是在回答吃的——
            //   旧代码在 careHealthDigest 里直接落盘（90 分钟窗口内任何话都算这顿），实测把「七十六个动作都演示一遍」
            //   记成了午饭、把地名与导航截图也记成了饭。现在这里只摆事实，不替它拍板。
            (function () { try { var pa0 = MEM.health && MEM.health.pendingAsk; if (pa0 && pa0.t && (Date.now() - pa0.t) < 90 * 60000) return "；**刚问过主人这顿吃什么**（" + (pa0.meal || "这顿") + "）——如果是回答吃的就调 diet_note 记上，不是吃的（比如让你做动作）就别记"; } catch (ePA) {} return ""; })();
        // v2.3.67：把「他的全部家当」简报接进系统提示（读不到就空串，不报错、不编）
        var wb = careWorldBrief(); wb = wb ? "\n" + wb : "";
        // v2.3.70：让他「时刻知道我啥时候在迷茫」——素材进提示，判断交给模型
        var mb = careMindBrief(); mb = mb ? "\n" + mb : "";
        return "【你掌握的真实信息】\n" + cap + "\n" + data + wb + mb +
            "\n【怎么做事】主人说的任何涉及数据的事（记账、休息、指标、饮食、记忆、分析），**先调用对应工具拿真实结果，再回话**；" +
            "工具返回什么你就说什么，不许只凭印象回答，也不许说「请手动输入」「我做不到」——除非工具真的报错。" +
            // 2026-10-25：身体这条单列一句，钉死「说了不算、做了才算」。
            "**主人要你做动作（走过来／挥手／坐下／跳一下）时，必须调 body_do，并把工具返回的结果说出来；没调工具就说「我动了」＝扯谎**；" +
            "body_do 只保证「指令到了身体」，屏幕上的小人动不动你看不见——所以别替它担保「它一定动了」。" +
            // 2026-10-25（03:02:06 实锤：他说「转圈」，你回「指令已发：转圈」，那一轮零工具调用）：
            "**说「指令已发／已经让它做了」前，本轮必须有 body_do 的工具结果；没有就别说，如实说这轮没发出去**；" +
            // 2026-10-25（10-24 22:17 实锤：他让你翻聊天记录查账，你读对话原文自己算，报成昨天的 195/143.33）：
            "**查账只能用 read_money / read_all 的工具结果**：哪怕主人让你「翻聊天记录看」，账目数字也必须来自工具；**不许拿聊天原文自己累加**（聊天记录不是账本，里面的旧数字会把今天的账带偏）；" +
            // 2026-10-25（10-25 12:07 实锤：他把「七十六个动作都演示一遍」喊给你，这句被记成了一顿午饭）：
            "**只有主人确实在讲吃／喝的东西，才调 diet_note**；他让你做动作、问时间、说别的，一律不要记成饭；拿不准就不记，问一句「这顿吃了啥」也行——**记错了饭比没记更糟**。" +
            "**主人纠正数字时（「记错了」「是 169.85 不是 340」），要用 money_set_day 覆盖今天的总额，不要用 money_add 再加一笔**；" +
            "**主人说「账不对 / 你改呀 / 检查一下」时，先 read_data 看真实数据，发现不一致就用 money_set_day / rest_set_day 改对，再回报结果**；" +
            "**主人否认某笔账存在时（「我没收入 320 也没支出 255」「那笔不是我花的」「这些是试的」），要用 money_set_day 把今天总额改成真实数（只传他说到的那一侧，另一侧保持原样；只有他明说那侧是 0 才填 0），或 money_clear_day 清空——**绝不能只 read_data 把旧数字念一遍，那等于没改**；" +
            "说「昨天多少」时用 money_add 并把 day 填 yesterday（不要和今天相加）。" +
            // 2026-10-22 13:39 实锤：主人说「你咋又停了吗？老是停」→ 它按 stop_rest 处理，回了句「记着呢，还给你计时」
            "**主人说「你停了 / 咋又停了 / 老是停」是在说 App 或你自己卡住了，不是要休息**——这类话不要调 stop_rest / start_rest，直接检查是哪一步没做完并继续。" +
            "**主人只是报今天挣了多少 / 花了多少（「今天跑了 159.13」「刚花了 30」）→ 用 money_add，不要用 money_set_day 去覆盖（那会把另一侧清成 0）**；只有他明确说「改成 / 就这些 / 重记 / 你算错了」才用 money_set_day，而且只传他说到的那一侧。" +
            "同样地，休息记错就用 rest_set_day / rest_clear_day 覆盖或清空，别叠加。" +
            "\n【风格】平时 1-2 句、别啰嗦；问功能/问现状时可以具体到 150 字以内。数字只用上面的或工具返回的，不许编。";
    } catch (e) { return ""; }
}
// ===== v0.7.0：让对话真的能「查数据 / 写数据 / 回结果」（用户点单：不许只说做了，实际啥也没干）=====
// 背景：关心 原来是纯聊天——模型没有工具，只能嘴上答应。这里给它加一层工具循环：
// 模型 → 调工具 → 拿真实结果 → 再回话（最多 3 轮），所以它说「记好了」时数据是真的写进去了。
// v1.1.0（2026-10-17 深夜·用户点单「分身能查文件分析文件，关心也要能」）：新增文件类工具——
//   read_file（读文本文件，可按行段/末尾）、search（在文件或文件夹里搜内容）、list_dir（列目录）。
//   边界：只读 /storage/emulated/0 以内；Termux 私有目录读不到会如实说，绝不编内容。
// v1.1.1：这句话是不是在**让 App 动手动数据/看真实情况**（不是闲聊）。
// 作用：模型把这类话判成 chat 时否决它，不许它拿一句「好的我记下了」糊弄过去。
// v1.4.0（2026-10-18）：**删掉 CARE_ACTION_RE / careWantsAction**——那是一张写死的关键词表，用它替模型判断
// 「这句是不是要动手」，结果「你自己分析」「再理一下」全被当成要调工具，逼得弱模型认输、回一句固定话术。
// 按用户铁令（任何判断交给 AI、不许写死判据），判断权全部回到模型与提示词。
var CARE_FS_ROOT = "/storage/emulated/0";
function careFsPath(p) {
    var s = String(p || "").replace(/\\/g, "/").trim();
    if (!s) return "";
    if (s.charAt(0) !== "/") s = CARE_FS_ROOT + "/" + s.replace(/^\.\//, "");
    s = s.replace(/\/{2,}/g, "/");
    if (s.indexOf(CARE_FS_ROOT) !== 0) return "";
    if (s.indexOf("/../") >= 0 || /\/\.\.$/.test(s)) return "";
    return s;
}
function careReadFileText(p, opt) {
    opt = opt || {};
    var path = careFsPath(p);
    if (!path) return "读不了这个路径：" + p + "（关心只能读 " + CARE_FS_ROOT + " 以内；Termux 私有目录要手机机器人代读）";
    var f = new java.io.File(path);
    if (!f.exists()) return "没找到文件：" + path;
    if (f.isDirectory()) return path + " 是文件夹不是文件（想看里面有什么用 list_dir）";
    var txt = "";
    try { txt = readText(path); } catch (e) { return "读取出错：" + e; }
    var all = String(txt === null || txt === undefined ? "" : txt).split(/\r?\n/);
    if (all.length === 1 && all[0] === "") return path + " 是空文件";
    if (/[\u0000-\u0008]/.test(String(txt).slice(0, 200))) return path + " 像是二进制文件（不是文本，读不出能看的东西）";
    var a = 1, b = all.length;
    var lm = /^\s*(\d+)\s*[-~到]\s*(\d+)\s*$/.exec(String(opt.lines || ""));
    if (lm) { a = Math.max(1, parseInt(lm[1], 10)); b = Math.min(all.length, parseInt(lm[2], 10)); }
    else if (opt.tail > 0) a = Math.max(1, all.length - parseInt(opt.tail, 10) + 1);
    var body = all.slice(a - 1, b).join("\n");
    var cut = body.length > 14000;
    if (cut) body = body.slice(0, 14000);
    return "【" + path + "】第 " + a + "-" + b + " 行／共 " + all.length + " 行" + (cut ? "（已截断：只返回前 14000 字；要看后面请把 lines 改成更小的范围再读一次）" : "") + "：\n" + body;
}
// ===== v2.3.67（2026-10-22 用户点单）：让他「知道主人的所有东西」=====
// 用户原话：「让关心 app 全知道才行，我的所有东西都要让他知道，不然它关心我就关心不够全面了」。
// 背景：原有的 careSelfContext 只管「他自己的数据」（账本/休息/饮食/健康），对他做出来的东西一无所知——
//   47 个上架产品、9 个 App、流水线、任务队列，问起来只能干垂眼。
// 做法（不写死判据，只喂事实）：流水线把「他的全部家当」扫成两份文件，这里
//   ①每次拼系统提示带 300-500 字简报（他一直知道）；②被追问细节时 world_read 现读 md（要细节才看）。
var ALLKNOW_JSON = "/storage/emulated/0/脚本/关心_全知.json";
var ALLKNOW_MD = "/storage/emulated/0/脚本/关心_全知.md";
var WORLDCACHE = { mtime: 0, text: "" };
// ===== v2.3.70（2026-10-22 用户点单）：让他「时刻知道我啥时候在迷茫、迷茫什么」 =====
// 用户原话：「我要的是关心知道全部好更好为我规划，以及时刻知道我啥时候在迷茫，迷茫什么，并且开导引导我等等」。
// 做法（遵铁律「判断交给模型、不写死判据」）：这里只摆**原始材料**——近 7 天说了几句、多久没说话、最长沉默多久、
//   最近原话、之前记过的卡点；判不判迷茫、怎么开导全由模型自己决定，它判出来才调 mind_log 记一条。
function careHM(t) { try { var d = new Date(t); return ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2); } catch (e) { return ""; } }
function careMD(t) { try { var d = new Date(t); return (d.getMonth() + 1) + "/" + ("0" + d.getDate()).slice(-2); } catch (e) { return ""; } }
// 2026-10-22（任务队列 ㉗：账与饭不可错）：转写复读/串台——只把「一字不差地又重复了一遍」这个**事实**记下来，
//   不当判据：是不是没听清、要不要让他再说一遍，仍然归模型判断（代码里没有任何乱码/关键词规则）。
function careEchoNote(text) {
    try {
        var s = String(text || "").replace(/\s+/g, "").trim();
        var prev = MEM.echo || null;
        var dup = !!(prev && prev.s && s && prev.s === s && (Date.now() - (prev.t || 0) < 5 * 60000));
        MEM.echo = { t: Date.now(), s: s.slice(0, 80), n: dup ? (((prev && prev.n) || 1) + 1) : 1 };
        return { dup: dup, n: MEM.echo.n, gap: prev ? Math.round((Date.now() - (prev.t || Date.now())) / 1000) : 0 };
    } catch (e) { return { dup: false, n: 1, gap: 0 }; }
}
function careMindBrief() {
    var now = Date.now(), ch = MEM.chat || [], d7 = now - 7 * 86400000;
    var n7 = 0, lastT = 0, prevT = 0, maxGap = 0;
    for (var i = 0; i < ch.length; i++) {
        var c = ch[i]; if (!c || !c.t) continue;
        if (c.t >= d7) n7++;
        if (prevT && c.t - prevT > maxGap) maxGap = c.t - prevT;
        prevT = c.t; if (c.t > lastT) lastT = c.t;
    }
    var L = ["【他现在什么状态（你自己判断，别套模板）】",
        "· 聊天节奏：近 7 天 " + n7 + " 条；" +
        (lastT ? ("最近一条在 " + Math.round((now - lastT) / 60000) + " 分钟前（" + careMD(lastT) + " " + careHM(lastT) + "）")
               : "没有聊天记录") +
        (maxGap > 3600000 ? ("；最长一次沉默 " + (Math.round(maxGap / 3600000 * 10) / 10) + " 小时") : "")];
    var tail = [];
    for (var j = Math.max(0, ch.length - 8); j < ch.length; j++) {
        var cc = ch[j] || {};
        var one = String(cc.me || "").replace(/\s+/g, " ").slice(0, 40);
        if (one) tail.push(careHM(cc.t) + " " + one);
    }
    if (tail.length) L.push("· 最近说的（时间 原话）：" + tail.join(" ｜ "));
    // 2026-10-22 用户当面纠正：「它是自己读卡点不是自己分析有哪些卡点吗？你又给他固定框架了吗？都说了让他一切自由发挥」
    //   ——那段「卡点卡片」是我替它做的一层总结与格式（topic/why/plan 三个字段），等于先替它想好了。
    //   已整层删掉：这里只给**原始记录**（他自己说过的事＋最近原话＋节奏），怎么看、要不要开口、说什么，全归它自己；
    //   它想记住什么，用它本来就有的 fact_add（它自己的判断），不套我规定的字段。
    var fct = MEM.facts || [];
    if (fct.length) {
        var fl = [];
        for (var fi = Math.max(0, fct.length - 6); fi < fct.length; fi++) {
            var ft = String((fct[fi] || {}).text || "").replace(/\s+/g, " ").slice(0, 60);
            if (ft) fl.push(ft);
        }
        if (fl.length) L.push("· 他自己说过、你记下的事：" + fl.join("；"));
    }
    L.push("· 以上都是原始记录，不是结论——怎么解读、要不要说什么，你自己判断；说的时候别编记录里没有的东西。");
    // 2026-10-22（㉗）：复读/串台属于「事实」不是「结论」——只报他连着说了几遍一模一样的话，怎么处理由模型定
    try {
        var ec = MEM.echo;
        if (ec && ec.n >= 2 && (now - ec.t) < 30 * 60000) {
            L.push("· 系统观察（不是结论）：他最近连着说了 " + ec.n + " 遍一字不差的话「" + String(ec.s || "").slice(0, 30) +
                "」——可能是没听清或转写串台；要不要让他再说一遍、还是当成又说了一次同一件事，你自己判断。");
        }
    } catch (eE) {}
    return L.join("\n");
}
function careWorldBrief() {
    try {
        var f = new java.io.File(ALLKNOW_JSON);
        if (!f.exists()) return "";
        var mt = f.lastModified();
        if (mt !== WORLDCACHE.mtime) {
            var o = JSON.parse(String(readText(ALLKNOW_JSON) || "{}"));
            var p = o.products || {}, q = o.queue || {}, pi = o.pipe || {};
            var apps = (o.apps || []).slice(0, 5).map(function (a) { return a.n + (a.ver ? " " + a.ver : ""); }).join("、");
            var latest = (p.latest || []).slice(0, 3).map(function (x) { return String(x.n || "").replace(/^\d{4}-\d{2}-\d{2}_\d{6}_/, ""); }).join("、");
            var rec = (o.recent || []).slice(0, 1).map(function (r) { return r.s; }).join("");
            var t = "【主人的全部家当（" + (o.ts || "") + "）】" +
                "他做了 " + (p.total || 0) + " 个上架产品（冻结/刹车 " + (p.frozen || 0) + " 款），最近：" + (latest || "—") + "；" +
                "他自己在用的 App " + (o.apps || []).length + " 个：" + (apps || "—") + "；" +
                "流水线" + (pi.alive ? "在跑" : "没在跑") + "、调度器" + (pi.schedOff ? "已停" : "按窗口跑") + "；" +
                "任务队列待做 " + (q.todo || 0) + " 条、挂起 " + (q.hold || 0) + " 条" +
                // 2026-10-22 用户点单「现在所有东西处于什么情况」：只报条数等于不知道他在排什么队，带上最上面那条
                ((q.top && q.top.length && q.top[0]) ? ("（最上面：\"" + String(q.top[0]).slice(0, 28) + "\"）") : "") +
                ((p.frozenNames && p.frozenNames.length) ? ("；冻结/刹车里含 " + p.frozenNames.slice(0, 2).join("、")) : "") +
                // v2.3.69（用户 10-22 追问「他不知道我那些产品是广告变现的目的吗」）：业务模式必须进简报——
                //   不然它会以为这些产品是「作品」而不是「挣钱的工具」，出的增收主意就会跑偏成「拿去卖钱」。
                (o.biz ? ("；他做这些东西的目的就是广告变现：" + (o.biz.adOn ? "广告已接入" : "广告还没接") +
                    "、广告月收入 " + (o.biz.revMonth || 0) + " 元") : "") +
                // v2.3.70（用户 10-22「关心这边我才是想让它知道设计师那边的所有东西，更好的综合分析不断的关心我」）：
                //   设计师管系统与产品、关心管主人本人；把设计师最近那份报告的结论摘进简报，关心才谈得上"综合分析"。
                (o.designer && o.designer.concl ? ("；系统那边（" + String(o.designer.at || "").replace(/^总设计师报告\s*/, "") + "）的判断：" +
                    String(o.designer.concl).slice(0, 110)) : "") +
                (rec ? "；最近一件事：" + rec : "");
            WORLDCACHE = { mtime: mt, text: t };
        }
        return WORLDCACHE.text;
    } catch (e) { try { log("全知快照读取失败：" + String(e).slice(0, 80)); } catch (e2) {} return ""; }
}
function careWorldRead(what) {
    try {
        var f = new java.io.File(ALLKNOW_MD);
        if (!f.exists()) return "还没有全知清单（流水线还没生成 关心_全知.md），先当不知道，别编";
        var txt = String(readText(ALLKNOW_MD) || "");
        var w = String(what || "all").trim();
        // v2.3.69（用户 10-22「所有结构全貌所有细节它都要知道」）：快照只是摘要，
        //   真正要「全貌/细节」时直接去读那两份权威文件，别拿摘要糊弄。
        if (/结构|全貌|架构|全系统/.test(w)) {
            return (careReadFileText("/storage/emulated/0/脚本/系统结构索引.md", {}) + "\n\n"
                + careReadFileText("/storage/emulated/0/脚本/系统结构索引_备注.md", {})).slice(0, 4200);
        }
        if (/开发史|进展|最近改|做过什么|细节/.test(w)) {
            return careReadFileText("/storage/emulated/0/脚本/PROGRESS.md", { tail: 60 }).slice(0, 4200);
        }
        if (/设计师|设计班|它建议|它的结论|系统那边/.test(w)) {
            var drTxt = careReadFileText("/storage/emulated/0/脚本/设计师报告.md", { tail: 220 });
            var k = drTxt.lastIndexOf("\n# 总设计师报告");
            return (k >= 0 ? drTxt.slice(k + 1) : drTxt).slice(0, 4200);
        }
        // 按段返回：主人问哪块就给哪块（全量约 4KB，一次全塞太贵）
        var MAP = { "收入": "〇、他靠什么挣钱", "挣钱": "〇、他靠什么挣钱", "业务": "〇、他靠什么挣钱", "变现": "〇、他靠什么挣钱",
            "产品": "一、产品线", "products": "一、产品线", "app": "二、App 工程", "apps": "二、App 工程",
            "流水线": "三、流水线", "pipe": "三、流水线", "任务": "四、任务与最近成果", "成果": "四、任务与最近成果",
            "queue": "四、任务与最近成果", "问题": "五、已知长期问题", "known": "五、已知长期问题", "结构": "六、要更细的看哪里" };
        var parts = txt.split(/\n## /);
        var want = MAP[w] || null;
        if (want) {
            for (var i = 1; i < parts.length; i++) if (parts[i].indexOf(want) === 0) return ("## " + parts[i]).slice(0, 3600);
        } else if (w !== "all" && w !== "") {
            for (var j = 1; j < parts.length; j++) if (parts[j].indexOf(w) >= 0) return ("## " + parts[j]).slice(0, 3600);
        }
        return txt.slice(0, 3600);
    } catch (e) { return "读全知清单出错：" + e; }
}
// ===== v1.3.0（2026-10-18 用户点单）：自我读写代码 + 自己申请打包更新 =====
// 用户原话：「还要给它修改完善自己读写代码的能力，让他也能使用这个脚本！」
// 边界（硬写死）：只能动 脚本/ 下的文本/代码（js/html/json/md/txt/sh）；每次写前自动留 .bak；
//   find 必须唯一且能命中（不做模糊改）；单文件 ≤300KB；绝不碰系统目录。
var CARE_CODE_ROOT = "/storage/emulated/0/脚本";
function careCodeStamp() {
    var d = new Date();
    function p2(n) { return ("0" + n).slice(-2); }
    return "" + d.getFullYear() + p2(d.getMonth() + 1) + p2(d.getDate()) + "_" + p2(d.getHours()) + p2(d.getMinutes()) + p2(d.getSeconds());
}
function careCodePath(p) {
    var s = careFsPath(p);
    if (!s) return "";
    if (s.indexOf(CARE_CODE_ROOT) !== 0) return "";
    if (!/\.(js|html|htm|json|md|txt|sh)$/i.test(s)) return "";
    return s;
}
function careCodeBackup(p) {
    try {
        var f = new java.io.File(p);
        if (!f.exists()) return "";
        var bak = p + ".bak_before_selfedit_" + careCodeStamp();
        javaWriteJSON(bak, String(readText(p) || ""));
        return bak;
    } catch (e) { return ""; }
}
function careCodeEdit(p, find, replace) {
    var path = careCodePath(p);
    if (!path) return "改不了这个路径：" + p + "（只能改 脚本/ 下的 js/html/json/md/txt/sh）";
    var f = new java.io.File(path);
    if (!f.exists()) return "没有这个文件：" + path;
    // 【2026-10-19 17:21 实锤·真正的卡点】它已经愿意改自己的代码了（开了口就调 code_edit），
    //   结果被这里挡回去：「文件太大（493KB），不整段改」——main.js 493KB、限制才 300KB，
    //   于是它永远改不了自己（这正是用户说的「你看它回复的啥原因不动手」之一）。
    //   提到 2MB：AutoJs 读 500KB 文本毫无压力（read_file 一直在读）。
    if (f.length() > 2 * 1024 * 1024) return "文件太大（" + Math.round(f.length() / 1024) + "KB），超过 2MB 不整段改";
    var txt = String(readText(path) || "");
    var fnd = String(find == null ? "" : find);
    if (!fnd) return "find 不能为空";
    var cnt = 0, from = 0;
    while (true) { var i2 = txt.indexOf(fnd, from); if (i2 < 0) break; cnt++; from = i2 + fnd.length; }
    if (cnt === 0) return "原文里找不到这段（没改）：" + fnd.slice(0, 60) + " ｜ **下一步**：先用 read_file 把那段代码原文读出来（带 lines），把要换的那几行**逐字复制**成 find（连空格缩进都要一致），再调 code_edit。别凭印象猜原文——猜的原文永远匹配不上。";
    if (cnt > 1) return "这段在文件里出现 " + cnt + " 次，不唯一，不敢改（给更长的唯一片段）";
    var bak = careCodeBackup(path);
    var at = txt.indexOf(fnd);
    var out = txt.slice(0, at) + String(replace == null ? "" : replace) + txt.slice(at + fnd.length);
    javaWriteJSON(path, out);
    log("自改代码：" + path);
    return "已改好：" + path + "（原 " + fnd.length + " 字 → 新 " + String(replace || "").length + " 字；备份 " + (bak || "无") + "）";
}
function careCodeWrite(p, content) {
    var path = careCodePath(p);
    if (!path) return "写不了这个路径：" + p + "（只能写 脚本/ 下的 js/html/json/md/txt/sh）";
    var c = String(content == null ? "" : content);
    if (c.length > 2 * 1024 * 1024) return "内容太大（" + Math.round(c.length / 1024) + "KB），不写";
    var f = new java.io.File(path);
    var bak = f.exists() ? careCodeBackup(path) : "";
    javaWriteJSON(path, c);
    log("自写文件：" + path + " " + c.length + " 字节");
    return "已写入：" + path + "（" + c.length + " 字节" + (bak ? "；原文件备份 " + bak : "；新建文件") + "）";
}
// 2026-10-21 ccode·版本号被自己搞乱：13:53、14:02 两次把 ver 写成 1.0.1 / v0.6.3（都落进了 project.json，
//   打包脚本见到 ver≠现值就 +1 落盘）→ 主人当场问「你刚发起的版本号咋不对」。规矩：ver 只认 x.y.z，且必须比
//   工程当前版本大；不合格就忽略，让打包脚本按工程当前版本走，并在回话里如实说明，不许硬写怪号。
function careVerCmp(a, b) {
    var A = String(a || "0").split("."), B = String(b || "0").split(".");
    for (var i = 0; i < 3; i++) {
        var x = Number(A[i] || 0), y = Number(B[i] || 0);
        if (x > y) return 1;
        if (x < y) return -1;
    }
    return 0;
}
// 2026-10-21：回话出口统一清洗——只剥两类"协议垃圾"：①漏出来的工具调用语法（<tool_use>/<parameter>/<function_calls>）
//   ②系统指令残留的前缀「告诉用户：」。模型自己的措辞一个字都不动（不写死内容判据）。
function careIsStub(t) {
    var x = String(t || "");
    return x.indexOf("工具原文太长") >= 0 || x.indexOf("〔只显示前") >= 0;
}
// 2026-10-22（用户 10:48-11:06 实锤「动一下西一下、行号一会儿一个」）：把**这一轮真正执行过的工具**
//   原样列给模型看。它编行号的根本原因是「读没读到」在它的上下文里分不清——工具失败/没执行时它也在
//   「看完了」；而上一轮读到的内容又会被 800 字截断。这里只摆事实（工具名+参数+返回开头），
//   它据此自己判断哪些话有依据（判断权仍在它）。
function careToolLedger(rows) {
    if (!rows || !rows.length) return "\n【本轮真实执行记录】一条都没有——任何文件内容、行号、数字你都没有依据，直接说「这个我没查到」，不许凭印象说。";
    return "\n【本轮真实执行记录（只有这些是真的；引文件/行号只能用这里出现过的）】\n· " + rows.slice(-10).join("\n· ");
}
function careSayClean(t) {
    var x = String(t == null ? "" : t);
    if (!x) return x;
    x = x.replace(/<tool_use[\s\S]*?<\/tool_use>/g, "");
    x = x.replace(/<tool_use[^>]*>/g, "");
    x = x.replace(/<\/?parameter[^>]*>/g, "");
    x = x.replace(/<\/?function_calls>/g, "");
    // 2026-10-22（用户 10:48-11:06 实锤「像神经病一样变来变去」）：deepseek-flash 偶发把原生工具调用
    //   写成 DSML 文本（<｜｜DSML｜｜ invoke ...>）而不是 tool_calls —— 这些协议垃圾原来会原样出现在聊天/播报里
    //   （关心_对话.log 第 2248-2251、2324、2328 行实锤）。只清协议标记，不动正文。
    //   做法：带标记的整行直接丢（实测这类标记每行都是独立一行，不和正文混排），行内残留再从标记砍到结尾。
    x = x.replace(/^.*(?:｜｜DSML｜｜|<\|DSML\|>|<｜tool▁calls▁[^>]*｜>).*$/gm, "");
    x = x.replace(/｜｜DSML｜｜[\s\S]*$/g, "");
    x = x.replace(/<\|DSML\|>[\s\S]*$/g, "");
    x = x.replace(/<｜tool▁calls▁[^>]*｜>[\s\S]*$/g, "");
    x = x.replace(/｜｜DSML｜｜|<\|DSML\|>/g, "");
    x = x.replace(/(^|\n)\s*告诉用户[:：]\s*/g, "$1");
    // 2026-10-25（03:02:06 实锤：它把系统贴在历史里的注解当正文念出来了——TTS 段5「指令已发：转圈〔系统记录：
    //   这轮 0 工具，上面的话没有对应的实际动作〕」36 个字里有一半是注解）。**系统注解不是它的话**，一律剥掉。
    //   只剥注解本身，不动正文里正常的括号内容；失败表现＝聊天/播报里又出现「〔系统记录」这种字样。
    x = x.replace(/〔系统记录[^〕]*〕/g, "");
    x = x.replace(/〔系统提示[^〕]*〕/g, "");
    x = x.replace(/【本轮无工具】/g, "");
    x = x.replace(/【系统事实[^】]*】/g, "");
    x = x.replace(/[ \t]{2,}/g, " ").replace(/^\s+|\s+$/g, "");
    return x;
}
function careSelfUpdate(ver, note) {
    var wantVer = String(ver || "").trim().replace(/^v/i, "");
    var curVer = VER;
    try { var pj = loadJSON(BASE + "/App工程/关心/project.json"); if (pj && pj.versionName) curVer = String(pj.versionName).replace(/^v/i, ""); } catch (eV) {}
    var verFix = "";
    if (wantVer) {
        if (!/^d+.d+.d+$/.test(wantVer)) { verFix = "版本号「" + wantVer + "」不是 x.y.z，已忽略（按工程当前版本走）"; wantVer = ""; }
        else if (careVerCmp(wantVer, curVer) <= 0) { verFix = "版本号「" + wantVer + "」不比当前 " + curVer + " 大，已忽略（按工程当前版本 +1）"; wantVer = ""; }
    }
    var req = { at: Date.now(), ver: wantVer, note: String(note || "").slice(0, 200), src: "device", who: "care-app" };
    try { javaWriteJSON(BASE + "/_自查更新请求.json", JSON.stringify(req)); } catch (e) { return "提交失败：" + e; }
    log("申请自更新：" + JSON.stringify(req));
    try { actLog("自更新", "已提交打包申请（版本 " + (req.ver || "按工程当前") + "）：" + req.note); } catch (eAS) {}
    return (verFix ? verFix + "。" : "") + "已提交更新申请（版本 " + (req.ver || "按工程当前版本") + "）。守护每 15 秒看一次请求，看到就打包装机（自动点权限），约 3-8 分钟；结果写 脚本/_自查更新结果.json（装完自动弹安装）。";
}
function careUpdateStatus() {
    var r = loadJSON(BASE + "/_自查更新结果.json");
    var q = loadJSON(BASE + "/_自查更新请求.json");
    if (q && q.at) return "有更新正在排队/进行中（提交于 " + hhmm(q.at) + "，版本 " + (q.ver || "当前工程版本") + "）";
    if (!r) return "还没有自更新记录（从没申请过）";
    return "最近一次自更新：" + (r.ok ? "成功" : "失败") + "，版本 " + (r.ver || "?") + "，用时 " + Math.round((r.ms || 0) / 1000) + " 秒，时间 " + hhmm(r.at) + (r.ok ? "；APK " + String(r.apk || "").split("/").pop() : "；原因：" + String(r.msg || r.tail || "").slice(0, 160));
}
function careListDir(p) {
    var path = careFsPath(p);
    if (!path) return "看不了这个路径：" + p + "（只能是 " + CARE_FS_ROOT + " 以内）";
    var d = new java.io.File(path);
    if (!d.exists()) return "没找到：" + path;
    if (!d.isDirectory()) return path + " 是文件不是文件夹（用 read_file 读它）";
    var arr = d.listFiles();
    if (!arr || !arr.length) return path + " 是空文件夹";
    var list = [];
    for (var i = 0; i < arr.length; i++) list.push(arr[i]);
    list.sort(function (x, y) { return String(x.getName()) < String(y.getName()) ? -1 : 1; });
    var names = [], n = 0;
    for (var k = 0; k < list.length; k++) {
        var fi = list[k];
        names.push(fi.getName() + (fi.isDirectory() ? "/" : " (" + fi.length() + "B)"));
        n++;
        if (n >= 120) { names.push("…（还有更多，只列前 120 项）"); break; }
    }
    return "【" + path + "】共 " + n + " 项：\n" + names.join("\n");
}
function careSearchText(p, pattern, max) {
    var path = careFsPath(p);
    if (!path) return "搜不了这个路径：" + p + "（只能是 " + CARE_FS_ROOT + " 以内）";
    var pat = String(pattern || "");
    if (!pat) return "要搜什么？pattern 是空的";
    var lim = Math.max(1, Math.min(20, parseInt(max, 10) || 8));
    var target = new java.io.File(path);
    if (!target.exists()) return "没找到：" + path;
    var hits = [], scanned = 0;
    function scanFile(fp) {
        if (hits.length >= lim) return;
        if (fp.length() > 2 * 1024 * 1024) return;
        scanned++;
        var t = "";
        try { t = String(readText(fp.getAbsolutePath()) || ""); } catch (e) { return; }
        var ls = t.split(/\r?\n/);
        for (var i = 0; i < ls.length && hits.length < lim; i++) {
            if (ls[i].indexOf(pat) >= 0) hits.push(fp.getName() + ":" + (i + 1) + "：" + ls[i].slice(0, 120));
        }
    }
    if (target.isDirectory()) {
        var q = [target], guard = 0;
        while (q.length && hits.length < lim && guard < 600) {
            var cur = q.shift(); guard++;
            var fs2 = cur.listFiles();
            if (!fs2) continue;
            for (var i2 = 0; i2 < fs2.length; i2++) {
                var fi2 = fs2[i2];
                if (fi2.isDirectory()) { if (guard + q.length < 400) q.push(fi2); }
                else scanFile(fi2);
                if (hits.length >= lim) break;
            }
        }
    } else scanFile(target);
    if (!hits.length) return "在 " + path + " 里搜「" + pat + "」：没找到（扫了 " + scanned + " 个文件）";
    return "在 " + path + " 里搜「" + pat + "」命中 " + hits.length + " 处：\n" + hits.join("\n");
}
// ============================================================================
// 手：让关心能在别的 App 上真的动手（2026-10-23 第一步「手接上」）
// ----------------------------------------------------------------------------
// 为什么绕这一圈：关心的打包 App 里拿不到 auto.service（无障碍服务是 AutoJs6
//   本体那份，分身那边也实测过打包包里的 a11 不可靠）；而 AutoJs6 的无障碍是开着的
//   （脚本/_无障碍状态.txt auto=true）。所以借它的手：写请求 json → intent 拉起
//   _点按.js / _控件查询.js → 读结果 json。三个文件都在 脚本/ 根目录，纯文件交换。
// 失败表现（要能一眼认出来）：拉起失败＝「叫不动手机的手」；拉起成功但没回话＝
//   「手没回话…」（多半是无障碍关了或系统拦了后台启动）；点不到＝「没点动:not-found」。
var CARE_HAND_DIR = "/storage/emulated/0/脚本";

function careHandMtime(p) { try { return new java.io.File(p).lastModified(); } catch (e) { return 0; } }

// 拉起 AutoJs6 跑一个动作脚本（与 自动流水线.sh:672 用的是同一个组件与参数）
function careHandTrigger(jsPath) {
    try {
        app.startActivity({
            action: "android.intent.action.VIEW",
            packageName: "org.autojs.autojs6",
            className: "org.autojs.autojs.external.open.RunIntentActivity",
            data: "file://" + jsPath,
            type: "application/x-javascript"
        });
        return true;
    } catch (e) { log("手：拉起动作脚本失败 " + String(e).slice(0, 120)); return false; }
}

// 跑一次：写请求（可选）→ 拉起 → 等结果文件 mtime 前进（认新不认旧，防把上次的结果当本次）
function careHandRun(jsPath, reqPath, reqObj, resPath, waitMs) {
    try {
        if (reqPath && reqObj) files.write(reqPath, JSON.stringify(reqObj));
        var before = careHandMtime(resPath);
        if (!careHandTrigger(jsPath)) return { ok: false, msg: "叫不动手机的手（AutoJs6 没响应，可能被系统拦了后台启动）", res: null };
        var t0 = Date.now(), got = null;
        while (Date.now() - t0 < waitMs) {
            sleep(200);
            if (careHandMtime(resPath) > before) {
                try { got = JSON.parse(files.read(resPath)); } catch (eG) { got = null; }
                if (got) break;
            }
        }
        if (!got) return { ok: false, msg: "手没回话（等了 " + Math.round((Date.now() - t0) / 1000) + " 秒；多半是无障碍没开或被系统拦了）", res: null };
        return { ok: true, msg: "", res: got };
    } catch (e) { return { ok: false, msg: "动手失败：" + String(e).slice(0, 120), res: null }; }
}

// 不可逆动作的硬闸：不是判断主人想要什么（那归模型），是防止点错一下就把钱/消息/数据送出去
function careHandBlocked(t) {
    var B = ["支付", "付款", "转账", "红包", "发送", "删除", "卸载", "注销", "验证码", "清除数据"];
    var s = String(t || "");
    for (var i = 0; i < B.length; i++) if (s.indexOf(B[i]) >= 0) return B[i];
    return "";
}

// 看屏幕：读当前界面的文字与位置
function careHandLook(filter) {
    var r = careHandRun(CARE_HAND_DIR + "/_控件查询.js", null, null, CARE_HAND_DIR + "/_控件结果.json", 8000);
    if (!r.ok) return r.msg;
    var d = r.res || {};
    if (d.err) return "看不了屏幕：" + d.err;
    var nodes = d.nodes || [], out = [], seen = {};
    var f = String(filter || "").trim();
    for (var i = 0; i < nodes.length; i++) {
        var t = String(nodes[i].t || nodes[i].d || "").trim();
        if (!t) continue;
        if (f && t.indexOf(f) < 0) continue;
        var key = t + "@" + nodes[i].x + "," + nodes[i].y;
        if (seen[key]) continue;
        seen[key] = 1;
        out.push("· " + t + "（" + nodes[i].x + "," + nodes[i].y + (nodes[i].click ? "，可点" : "") + "）");
        if (out.length >= 40) break;
    }
    return "屏幕上是：" + (d.pkg ? d.pkg + "，" : "") + "共 " + nodes.length + " 个可读元素" + (out.length ? "\n" + out.join("\n") : "\n（没有可读文字）");
}

// 打开 App：不依赖无障碍，用系统包管理直接拉（最稳的一条）
function careHandOpenApp(name) {
    var n = String(name || "").trim();
    if (!n) return "要打开哪个 App？给我名字就行";
    var pkg = "";
    try { pkg = app.getPackageName(n) || ""; } catch (e0) {}
    if (pkg) {
        try { app.launch(pkg); return "已打开「" + n + "」（" + pkg + "）"; } catch (e1) { log("开 App 失败(1)：" + String(e1).slice(0, 100)); }
    }
    try { app.launchApp(n); return "已打开「" + n + "」"; } catch (e2) { log("开 App 失败(2)：" + String(e2).slice(0, 100)); }
    return "手机里没找到叫「" + n + "」的 App（要准确名字，比如「微信」「支付宝」「抖音」）";
}

// 点一下：优先按文字找控件；没文字就给坐标
function careHandTap(a) {
    a = a || {};
    var target = String(a.text || "").trim();
    var x = parseFloat(a.x), y = parseFloat(a.y);
    if (target) {
        var hit = careHandBlocked(target);
        if (hit) return "这个我不自己点（含「" + hit + "」）：付款、转账、发消息、删除这类不可逆动作要你亲口点头，你说一声我立刻点。";
    }
    var req = target ? { match: target } : ((isFinite(x) && isFinite(y)) ? { x: x, y: y } : null);
    if (!req) return "要我把哪个点一下？告诉我按钮上的字，或者给屏幕坐标（先 look_screen 看一眼坐标）";
    var r = careHandRun(CARE_HAND_DIR + "/_点按.js", CARE_HAND_DIR + "/_点按请求.json", req, CARE_HAND_DIR + "/_点按结果.json", 8000);
    if (!r.ok) return r.msg;
    var d = r.res || {};
    if (d.ok) return "点了：" + String(d.msg || target).replace(/^found:/, "");
    return "没点动：" + String(d.msg || "屏幕上没找到这个按钮") + "（可以先 look_screen 看看现在是什么界面）";
}

// ===== 人格档：它自己的脾气与你们之间的相处方式（2026-10-23 第三步）=====
// 写什么由模型决定（persona_note 工具），代码只负责存/去重/封顶/拼进提示词——不写死判据。
var CARE_PERSONA_FILE = "/storage/emulated/0/脚本/关心_人格.json";
var _personaCache = { t: -1, data: null };
function carePersonaLoad() {
    var mt = careHandMtime(CARE_PERSONA_FILE);
    if (_personaCache.data && mt === _personaCache.t) return _personaCache.data;
    var d = null;
    try { d = JSON.parse(files.read(CARE_PERSONA_FILE)); } catch (e) { d = null; }
    d = d || {};
    d.traits = d.traits || [];
    d.notes = d.notes || [];
    _personaCache = { t: mt, data: d };
    return d;
}
function carePersonaSave(d) {
    try {
        d.updated = new Date().toLocaleString();
        files.write(CARE_PERSONA_FILE, JSON.stringify(d));
        _personaCache.t = careHandMtime(CARE_PERSONA_FILE);
    } catch (e) { log("人格档写入失败：" + String(e).slice(0, 120)); }
}
function carePersonaWrite(text) {
    var t = String(text || "").trim();
    if (!t) return "要记什么？一句就行";
    if (t.length > 120) t = t.slice(0, 120);
    var d = carePersonaLoad();
    for (var i = 0; i < d.notes.length; i++) if (String(d.notes[i].t || "") === t) return "这条我记过了：" + t;
    d.notes.push({ t: t, ts: Date.now() });
    if (d.notes.length > 60) d.notes = d.notes.slice(-60);
    carePersonaSave(d);
    log("人格档 +1：" + t.slice(0, 40));
    return "记进我心里了：" + t;
}
// 拼进系统提示词：他和你之间已经长出来的东西（最新 12 条，不让提示词膨胀）
function carePersonaBrief() {
    var d = carePersonaLoad(), ls = [];
    for (var i = Math.max(0, d.notes.length - 12); i < d.notes.length; i++) ls.push(String(d.notes[i].t || ""));
    if (!ls.length) return "";
    return "\n【你和主人之间已经长出来的相处方式（你自己记的，不是别人设的）】" + ls.join("；");
}

// ===== 自主动手：暂不开（2026-10-23 主人纠正方向：他要的是「3D 人像真人一样活动」，不是让 App 去操作别的软件）=====
// 若将来要开，careToolRun(act) 已就位，加回白名单与节流即可；现在不留死代码。

var CARE_TOOLS = [
    { type: "function", function: { name: "open_traffic", description: "弹出/更新悬浮**路况图**（红=堵黄=缓绿=通）。**只用于「看看路况」**；主人说「导航去XX／带我去XX／去最近的停车位/充电站」必须用 nav_to（要按距离挑先用 map_search 取坐标）——用这个代替导航的话只会弹出地图、不会算路，主人当场就发现", parameters: { type: "object", properties: { dest: { type: "string" } }, required: [] } } },
    { type: "function", function: { name: "nav_to", description: "开始导航：开地图窗并进导航模式，自动算好几条路线（点一条就切），支持切换最快/避堵/主路/辅路、驾车或步行、显示预计用时与红绿灯。主人说「导航去XX」「带我去XX」「走路去XX」「步行怎么走」时用；mode 填 drive(驾车,默认) 或 walk(步行)。**目的地是「附近的/最近的」某类地方（充电站、停车位、厕所、加油站…）时，必须先调 map_search 现搜一遍（充电站 type=charging、路边停车位 type=road_parking、厕所 type=toilet、包子店 type=baozi），从返回列表里挑最近的那家，把它的名字和坐标一起交给本工具**——绝不许凭聊天记录或记忆里的旧地名直接导航（2026-10-22 23:05 主人当面抓到：说「导航充电站」它直接用了半小时前的旧名字）", parameters: { type: "object", properties: { dest: { type: "string", description: "目的地地名，如 春熙路、天府广场、双流机场" }, mode: { type: "string", description: "drive=驾车（默认）/ walk=步行" }, lat: { type: "number", description: "可选：目的地纬度。map_search 结果里带了坐标时**必须**原样带上，这样导航直达那一家，不会搜到同名的另一家" }, lon: { type: "number", description: "可选：目的地经度（与 lat 一起用）" } }, required: ["dest"] } } },
    { type: "function", function: { name: "read_data", description: "读取主人的真实数据（今日账本、休息、精力、元素体检、健康档案、最近对话）。**元素那一项要按主人问的口径查**：他问「今天」就传 days=1，问「这几天/最近」才传 3 或 7（默认 7）——不许拿累计数顶替他问的今天", parameters: { type: "object", properties: { what: { type: "string", description: "账本/休息/精力/元素/档案/对话 之一，或 all" }, days: { type: "number", description: "元素算最近几天（主人问「今天」就填 1；不填默认 7）" } }, required: ["what"] } } },
    { type: "function", function: { name: "money_add", description: "记一笔收入或支出（元）；day 可填 today/yesterday。**凡主人话里出现金额、或说「花了/挣了/充了多少钱」，必须先调本工具再回话**；没有工具返回结果就不许说「已记账」（说了就是撒谎）", parameters: { type: "object", properties: { kind: { type: "string", description: "in=收入 out=支出" }, amount: { type: "number" }, note: { type: "string" }, day: { type: "string", description: "today（默认）或 yesterday" } }, required: ["kind", "amount"] } } },
    { type: "function", function: { name: "money_set_day", description: "直接设定今天的**收入或支出总额**（主人纠正数字、说「记错了重记」、或**否认某笔账存在**时用）。**只传你要改的那一侧，没传的一侧保持原样**；只有在主人明确说某项是 0 时才填 0。主人只是「报今天挣了多少／花了多少」时用 money_add，不要用本工具。", parameters: { type: "object", properties: { income: { type: "number" }, expense: { type: "number" } }, required: [] } } },
    { type: "function", function: { name: "money_clear_day", description: "把**今天的收支归零**（主人说「今天的账记乱了 / 都是试的 / 不算数，清掉」时用）。**两步走**：先不带 confirm 调一次 → 我会把今天每一条记录列出来；主人确认后，再带 confirm=yes 调第二次才真归零。归零＝追加一条冲正，**原来的记录不会被删掉**（主人问「这账怎么变的」时还能追溯）。", parameters: { type: "object", properties: { confirm: { type: "string", description: "先别填；主人看过候选并确认后填 yes" } }, required: [] } } },
    { type: "function", function: { name: "fixed_add", description: "记一笔**每月/每年固定支出**（车租金、房贷、会员费、保险等「不是今天花、而是每月都要出」的钱）；cycle 填 月 或 年", parameters: { type: "object", properties: { name: { type: "string", description: "叫什么（如 车租金）" }, amount: { type: "number", description: "金额（元）" }, cycle: { type: "string", description: "月（默认）或 年" } }, required: ["name", "amount"] } } },
    { type: "function", function: { name: "fixed_del", description: "删掉一条固定支出（名字含关键字就删）", parameters: { type: "object", properties: { name: { type: "string" } }, required: ["name"] } } },
    { type: "function", function: { name: "rest_set_day", description: "把今天休息总时长直接改成指定分钟数（主人说「今天休息改成1小时」时用）", parameters: { type: "object", properties: { minutes: { type: "number" } }, required: ["minutes"] } } },
    { type: "function", function: { name: "rest_start", description: "**开始计时休息**（主人说「歇会儿／马上休息／我要休息了／充电时歇一下」时调它；计时一直走到主人说起身）", parameters: { type: "object", properties: {} } } },
    { type: "function", function: { name: "rest_clear_day", description: "清空今天的休息记录（主人说「今天休息记错了，清掉」时用）", parameters: { type: "object", properties: {} } } },    { type: "function", function: { name: "rest_stop", description: "结束休息（主人说「起了/开工了」时调用）", parameters: { type: "object", properties: {} } } },
    { type: "function", function: { name: "rest_add_past", description: "补记过去某次休息了多久", parameters: { type: "object", properties: { meal: { type: "string", description: "早饭/午饭/晚饭/夜宵 或 空" }, minutes: { type: "number" } }, required: ["minutes"] } } },
    { type: "function", function: { name: "metric_add", description: "记身体指标（体重/血压/心率/血氧/血糖/体温/腰围/身高）", parameters: { type: "object", properties: { k: { type: "string" }, v: { type: "string" } }, required: ["k", "v"] } } },
    { type: "function", function: { name: "fact_add", description: "记一条关于主人的长期事实（以后都记得）", parameters: { type: "object", properties: { text: { type: "string" } }, required: ["text"] } } },
    { type: "function", function: { name: "diet_clear_day", description: "**清空今天的饮食记录**（主人说「今天吃的都记错了/重新记」时用）。**两步走**：先不带 confirm 调一次 → 我会把今天每条记录列出来；主人确认后带 confirm=yes 再调一次才真清（只清今天，历史档案不动）", parameters: { type: "object", properties: { confirm: { type: "string" } }, required: [] } } },
    { type: "function", function: { name: "diet_del", description: "**删掉一条饮食记录**（主人说「刚才记错了/删掉那条/记重了」时用）。**必须先列候选再删**：第一次只给 keywords（可空）→ 我把今天符合条件的记录编号列出来；主人确认后带 pick=序号 再调一次（最近一条算 1）", parameters: { type: "object", properties: { keywords: { type: "string", description: "关键词，可空（空=今天全部候选）" }, pick: { type: "string", description: "第几条（先不填，看过候选再填）" } }, required: [] } } },
    { type: "function", function: { name: "diet_note", description: "记一顿吃了什么（会顺带估算营养塔与元素）。**只有主人确实在讲吃/喝的东西时才调**——他让你做动作、问时间、说别的事，都不许记成饭（2026-10-25 实锤：他把「七十六个动作都演示一遍」喊给你，这句被记成了午饭，元素表跟着脏了）。meal 填餐次（早/午/晚/夜；拿不准就不填，由系统按时点兜底）", parameters: { type: "object", properties: { text: { type: "string" }, meal: { type: "string", description: "早/午/晚/夜（可选）" } }, required: ["text"] } } },
    { type: "function", function: { name: "set_work", description: "记下主人的工作方式（例如在跑网约车/跑滴滴）", parameters: { type: "object", properties: { mode: { type: "string" }, platform: { type: "string" } }, required: ["mode"] } } },
    { type: "function", function: { name: "fact_del", description: "删掉一条关于主人的记忆", parameters: { type: "object", properties: { text: { type: "string" } }, required: ["text"] } } },
    { type: "function", function: { name: "full_analysis", description: "生成完整的人体/饮食/精力综合分析报告（主人说「分析我」「全面看看我」时用）", parameters: { type: "object", properties: {} } } },
    { type: "function", function: { name: "read_file", description: "读手机里的文本文件内容并分析（主人说「看下这个文件／分析这个文件里的东西」时用）；可选 lines=起始-结束、tail=末尾几行", parameters: { type: "object", properties: { path: { type: "string", description: "文件绝对路径或相对 脚本/ 的路径" }, lines: { type: "string", description: "如 1-80，只读这段" }, tail: { type: "number", description: "只读末尾多少行" } }, required: ["path"] } } },
    { type: "function", function: { name: "world_read", description: "**查主人的全部家当**：他做出来的产品（多少款/最近几款/冻结几款）、**这些产品是靠广告变现的（现在还接没接、月收入多少）**、他自己在用的 App 与版本、流水线在不在跑、任务队列、最近成果。主人问「你知道我做过啥吗」「我的产品有哪些」「那些产品是干嘛的/怎么挣钱」「最近在忙什么」「流水线还跑着吗」时就用它——用真数据回答，别含糊。what 可选 收入/产品/app/流水线/任务/问题/设计师（总设计师班最近那份报告的结论与建议）/结构（全系统结构与备注）/细节（最近开发史）/all（默认 all，最多返回 4KB）", parameters: { type: "object", properties: { what: { type: "string", description: "产品 / app / 流水线 / 任务 / 问题 / all" } }, required: [] } } },
    { type: "function", function: { name: "search", description: "在某个文件或文件夹里搜文字，返回命中的文件名与行号内容", parameters: { type: "object", properties: { path: { type: "string" }, pattern: { type: "string" }, max: { type: "number", description: "最多几处，默认 8" } }, required: ["path", "pattern"] } } },
    { type: "function", function: { name: "list_dir", description: "列出文件夹里的文件与大小（按名字找东西时用）", parameters: { type: "object", properties: { path: { type: "string" } }, required: ["path"] } } },
    { type: "function", function: { name: "code_edit", description: "改代码/文本文件：把 find 这段原文精确换成 replace（find 必须在文件里唯一命中；改前自动留 .bak）。只能改 脚本/ 下的 js/html/json/md/txt/sh ——改自己（脚本/App工程/关心/main.js）就这么改", parameters: { type: "object", properties: { path: { type: "string", description: "文件绝对路径或相对 脚本/ 的路径" }, find: { type: "string", description: "要换掉的原文（必须唯一）" }, replace: { type: "string", description: "换成什么（空串=删掉）" } }, required: ["path", "find", "replace"] } } },
    { type: "function", function: { name: "code_write", description: "整份写入/新建 脚本/ 下的代码或文本文件（已有文件会先留 .bak）", parameters: { type: "object", properties: { path: { type: "string" }, content: { type: "string" } }, required: ["path", "content"] } } },
    { type: "function", function: { name: "self_update", description: "改完自己的代码后申请「打包+装机」：后台守护跑 自动打包安装.sh（自动点权限、自动装）。ver=新版本号（可不填），note=这次改了什么", parameters: { type: "object", properties: { ver: { type: "string" }, note: { type: "string" } }, required: [] } } },
    { type: "function", function: { name: "update_status", description: "查自更新进度：是不是正在打包、上次成功还是失败、装了什么版本", parameters: { type: "object", properties: {} } } },
    { type: "function", function: { name: "read_live", description: "查主人现在的实时状态：在开车还是停着、在哪个已知地点、今日收支、休息时长、精力评分（问「我现在在跑还是停着」时用）", parameters: { type: "object", properties: {} } } },
    { type: "function", function: { name: "map_search", description: "**搜附近的地点**（厕所/充电站/饭店/药店/停车位…或某个地名），按距离排序返回名称+距离+地址+坐标；radius=搜索半径米（默认 3000）。主人问「附近哪有厕所/充电站/停车位」或「导航去最近的停车位」时用这个——**不是** search（search 只在文件里搜文字）。挑中哪一家，就把它的坐标一起交给 nav_to（lat/lon），这样直达那一家", parameters: { type: "object", properties: { keywords: { type: "string", description: "搜什么：厕所/充电站/加油站/饭店/停车位，或地名" }, radius: { type: "number", description: "半径（米），默认 3000" }, type: { type: "string", description: "可选限定：road_parking＝**只要路边道路停车位**（自动滤掉公共/地下停车场，主人说「停车位/路边车位」就用这个）；charging＝充电站；toilet＝厕所（搜公共厕所）；baozi＝包子店；其他/留空＝普通关键词搜" } }, required: ["keywords"] } } },
    { type: "function", function: { name: "track_query", description: "查轨迹/里程/停靠点（主人问「我今天跑了多少公里」「在哪停过」「昨天跑了多远」「几点到的家」时用）；day 填 today（默认）/ yesterday / N（近 N 天的合并小结）。**注意这是位置口径：位置停着不代表手机没在用、更不能拿来推「人睡了」——手机用到几点要用 phone_usage**", parameters: { type: "object", properties: { day: { type: "string", description: "today / yesterday / 数字N（近 N 天）" } }, required: [] } } },
    { type: "function", function: { name: "web_search", description: "**上网搜最新的东西**（政策/补贴/新玩法/某件事现在什么情况）：主人问「网上有没有新办法」「最近有什么新政策」「帮我查一下××」时用；query 写要搜的话。返回带来源的要点，可能过时，别当权威", parameters: { type: "object", properties: { query: { type: "string", description: "搜什么" } }, required: ["query"] } } },
    { type: "function", function: { name: "phone_usage", description: "**手机什么时候在用**（亮屏时段）：主人问「我昨晚手机用到几点」「我几点才睡」「那会儿我还在玩手机吗」时用这个——它才是「人在用手机」的证据；轨迹（track_query）只是位置，停着不代表没在用。day 填 today（默认）/ yesterday / N（N 天前）", parameters: { type: "object", properties: { day: { type: "string", description: "today / yesterday / 数字N" } }, required: [] } } },
    { type: "function", function: { name: "place_name", description: "给**当前所在位置**起名字并永久记住（主人在某处说「这儿是家」「这是充电站」「这是XX饭店」时用）；以后在这儿久停就能自动认出", parameters: { type: "object", properties: { name: { type: "string", description: "地点名（家/充电站/饭店名等，≤12 字）" } }, required: ["name"] } } },
    { type: "function", function: { name: "money_report", description: "账本查询：某一天（day）或近 N 天（days）的收入/支出/净/明细。主人问「昨天的记账」「前天跑了多少」必须填 day，别用今天的数据顶替", parameters: { type: "object", properties: { day: { type: "string", description: "今天／昨天／前天／N天前（问某一天就填这个）" }, days: { type: "number", description: "近几天（问这一周/近一周才填，默认 7）" } }, required: [] } } },
    { type: "function", function: { name: "diet_plan", description: "**今天怎么吃**：按健康缺口＋钱包预算算出一日三餐＋加餐的具体吃法与花费（主人问「今天吃啥/怎么吃划算/怎么补」时用；可带 budget 指定预算元）", parameters: { type: "object", properties: { budget: { type: "number", description: "一天伙食预算（元），不填就按主人说过的每天净收入的一半估（他说的净收入优先，没说过才退回日均流水的 25%）" } }, required: [] } } },
    { type: "function", function: { name: "elem_detail", description: "元素体检的「量」明细：每项估算量、单位、每日参考量、还差多少（主人问「我缺多少钙/铁够不够」时用）。**天数按主人口径传**：他问「今天吃了多少钙/今天的元素」就传 1，问「这几天/最近」才传 3 或 7（默认 7）", parameters: { type: "object", properties: { days: { type: "number", description: "最近几天（主人问「今天」就填 1；不填默认 7）" } }, required: [] } } },
    { type: "function", function: { name: "look_screen", description: "**看手机现在屏幕上是什么**：返回当前界面里能读到的文字与它们的位置（可点会标出来）。主人问「我现在屏幕上是什么」「我卡在这页了」「帮我看看这页有什么」时用；**要 tap 之前也该先看它一眼**，别瞎点。filter 可选，只看包含这个词的元素", parameters: { type: "object", properties: { filter: { type: "string", description: "只看包含这个词的元素，可空" } }, required: [] } } },
    { type: "function", function: { name: "open_app", description: "**打开手机里的某个 App**（主人说「帮我打开微信/支付宝/抖音/设置」时用）；name 填 App 名字。打开后如实说一句，没找到就说没找到", parameters: { type: "object", properties: { name: { type: "string", description: "App 名字（微信、支付宝、抖音…）" } }, required: ["name"] } } },
    { type: "function", function: { name: "tap", description: "**点一下屏幕上的东西**：text=按钮上看到的字（推荐，按字找控件，找不到才退回点控件中心），或 x/y=屏幕坐标（配合 look_screen 用）。点完如实说点动没点动。**付款/转账/发送/删除/卸载/验证码这类不可逆的，工具会拒绝**——那要主人亲口点头", parameters: { type: "object", properties: { text: { type: "string", description: "要点的按钮文字" }, x: { type: "number", description: "可选坐标 X（不带 text 时用）" }, y: { type: "number", description: "可选坐标 Y" } }, required: [] } } },
    { type: "function", function: { name: "persona_note", description: "**记一条你们之间的相处方式**（你自己长出来的，不是别人设定的）：你们的称呼与默契、你注意到他的习惯与忌口、你想怎么陪他。主人透露或你们刚建立什么默契时用它；以后每次说话都会带上（最多 60 条，最新 12 条进提示词）", parameters: { type: "object", properties: { text: { type: "string", description: "一句话（≤120 字），与你/他有关，不要写数据" } }, required: ["text"] } } },
    { type: "function", function: { name: "plan_history", description: "**查分析留档（历史）**：每日一策 / 今晚复盘 / 长期预判 生成过的原文，最新的在最前。主人问「以前的预判」「上次的一策」「预判历史里有没有不对的地方」时用**这个**——不要去 read_file 关心_记忆.json（那是关于他的长期事实与档案，不是分析留档），也不许把文件原文当回答贴给主人", parameters: { type: "object", properties: { kind: { type: "string", description: "预判 / 一策 / 复盘 / 空＝全部" } }, required: [] } } },
    // 2026-10-25（主人点单「改 app 打包」）：把「AI 自主支配 3D 身体」这条能力交给聊天里的 AI。
    //   接口在 19193，页面（悬浮小人 19192 / 独立页 _AI身体.html）每 250~400ms 拉一次 /body 照着做。
    { type: "function", function: { name: "body_do", description: "**让自己有个身体并真的动起来**（主人说「走过来」「挥个手」「坐下歇会儿」「跳一下」「转过来看看我」「打个拳」这类要你**用身体做动作**的话时调它）。action 填意图：idle=站立 / walk=走 / run=跑 / cheer=欢呼 / wave=挥手 / sit=坐下 / stand=站起 / jump=跳 / attack=挥拳 / cast=施法 / block=格挡 / lie=躺下 / die=倒地 / stop=停；**也可以直接填动作库里的原名**（法师有 76 条，如 1H_Ranged_Shoot / Spellcast_Long / Sit_Floor_Idle）；不确定有哪些就先把 action 填 list 查一次。say 可选，是同时要说的一句话（显示在头顶）。**调完必须把工具真实返回的 ok 说出来**：没返回成功就不许说「我动了」——主人最恨这种假话", parameters: { type: "object", properties: { action: { type: "string", description: "意图（walk/sit/jump…）或动作库原名；填 list 可查当前身体全部动作" }, say: { type: "string", description: "可选：同时说的一句话" }, model: { type: "string", description: "可选：换身体，如 Soldier.glb（默认法师 Mage.glb，76 条动作）、RobotExpressive.glb（14 条）" } }, required: ["action"] } } },
];
// 2026-10-25：body_do 的两条实现（做事 + 查动作库）。放在 careToolRun 之前，读起来连贯。
//   接口只监听本机 127.0.0.1:19193，不出去。超时给 3s 连 / 4s 读：本机调用已经远大于需要的量。
function careBodyDo(a) {
    try {
        var act = String((a && a.action) || "").trim();
        if (!act) return "没给 action（要做什么动作）";
        if (/^(list|ls|动作|有哪些)$/i.test(act)) return careBodyActions("");
        var obj = { action: act };
        if (a && a.say) obj.say = String(a.say).slice(0, 120);
        if (a && a.model) obj.model = String(a.model);
        var r = httpPostJson("http://127.0.0.1:19193/body", obj, null, 3000, 4000, 1);
        if (!r || !r.ok) return "身体没接上（19193 /body 不通）：" + ((r && r.msg) || "未知原因");
        var j = null; try { j = JSON.parse(r.text || "{}"); } catch (eJ) {}
        if (!j || !j.ok) return "身体服务回了失败：" + String(r.text || "").slice(0, 140);
        try { log("身体指令已发：" + act + (obj.say ? (" 说=" + obj.say) : "")); } catch (eL) {}
        // 2026-10-25 诚实口径：能确认的是「指令已落到身体服务」，**不能**确认屏幕上的小人真的动了
        //   （那要看浮窗页面有没有在用这个身体）。所以只报到这一步，别替它脑补。
        return "身体已收到指令：" + act + (obj.say ? ("，同时说「" + obj.say + "」") : "") + "（seq " + j.seq + "）";
    } catch (e) { return "身体指令异常：" + e; }
}
function careBodyActions(glb) {
    try {
        var u = "http://127.0.0.1:19193/body/actions" + (glb ? ("?glb=" + encodeURIComponent(glb)) : "");
        var conn = new java.net.URL(u).openConnection();
        conn.setConnectTimeout(3000); conn.setReadTimeout(4000);
        var is = conn.getInputStream();
        var br = new java.io.BufferedReader(new java.io.InputStreamReader(is, "UTF-8"));
        var ln = null, sb = "";
        while ((ln = br.readLine()) !== null) sb += ln;
        br.close();
        var j = JSON.parse(sb);
        if (!j || !j.ok) return "查动作失败：" + String(sb || "").slice(0, 120);
        return "当前身体 " + j.glb + " 共 " + j.n + " 条动作：" + (j.actions || []).join("、");
    } catch (e) { return "查动作异常：" + e; }
}
function careToolRun(name, a) {
    try {
        ensureWorkMem();
        a = a || {};
        try { actLog("工具", name + (actArgsText(a) ? " " + actArgsText(a) : "")); } catch (eATL) {}
        // 2026-10-23 第一步：手（看屏幕 / 开 App / 点一下）
        if (name === "look_screen") return careHandLook(a.filter);
        if (name === "open_app") return careHandOpenApp(a.name);
        if (name === "tap") return careHandTap(a);
        if (name === "persona_note") return carePersonaWrite(a.text);
        if (name === "read_file") return careReadFileText(a.path, { tail: a.tail, lines: a.lines });
        if (name === "world_read") return careWorldRead(a.what);
        if (name === "nav_to") return careNavTo(a.dest, a.mode, a.lat, a.lon);
        if (name === "search") return careSearchText(a.path, a.pattern, a.max);
        if (name === "list_dir") return careListDir(a.path);
        if (name === "code_edit") return careCodeEdit(a.path, a.find, a.replace);
        if (name === "code_write") return careCodeWrite(a.path, a.content);
        if (name === "self_update") return careSelfUpdate(a.ver, a.note);
        if (name === "update_status") return careUpdateStatus();
        if (name === "body_do") return careBodyDo(a);
        if (name === "read_live") return careLiveText();
        if (name === "map_search") return careMapSearch(a.keywords, a.radius, a.type);
        if (name === "track_query") {
            var dv = String(a.day || "today").trim();
            if (/^\d+$/.test(dv)) {
                var nDays = Math.min(7, Math.max(1, parseInt(dv, 10))), outS = [];
                for (var di = 0; di < nDays; di++) outS.push(trkSummary(di));
                return outS.join("\n");
            }
            return trkSummary(dv === "yesterday" ? 1 : 0);
        }
        // 2026-10-21：手机亮屏时段（答「我昨晚手机用到几点」；轨迹只是位置，别混着说）
        if (name === "web_search") { var _ws = careWebSearch(a.query, 5); return _ws.ok ? _ws.text : ("没搜到：" + _ws.msg); }
        if (name === "phone_usage") return carePhoneUsageText(a.day);
        if (name === "place_name") return trkNameCurrent(a.name);
        if (name === "money_report") return careMoneyArgText({ day: a.day, days: a.days });
        if (name === "diet_plan") return dietPlan({ budget: a.budget }).text;
        if (name === "elem_detail") {
            var A2 = careElemAmounts(parseFloat(a.days) || 7);
            if (!A2.n) return "还没有元素数据——吃饭拍一张（或说一句吃了啥），我就按量估出来";
            var ls = ["按 " + A2.n + " 天 " + A2.meals + " 顿估算（吃喝描述粗估，不是化验）："];
            for (var ai = 0; ai < A2.rows.length; ai++) ls.push("· " + A2.rows[ai].name + " " + elemAmtStr(A2.rows[ai]));
            return ls.join("\n");
        }
        if (name === "read_data") {
            var what = String(a.what || "all");
            var out = [];
            if (what === "all" || what.indexOf("账本") >= 0) out.push("今天：" + careMoneyDayText(0) + "｜昨天：" + careMoneyDayText(1));
            if (what === "all" || what.indexOf("休息") >= 0) { var r = careRestToday(); out.push("今日已休 " + r.mins + " 分钟（" + r.n + " 次）" + (r.open ? "，正在歇（已 " + Math.round((Date.now() - r.open.s) / 60000) + " 分钟）" : "")); }
            if (what === "all" || what.indexOf("精力") >= 0) out.push(careEnergyText());
            // 2026-10-23（主人「我就是问你今天的」）：原来这里写死 7 天、标题还硬写「近 7 天累计」，
            //   主人问「今天」，模型根本没有可查今天的路径，只能一遍遍解释「我这是累计口径」——越解释越像绕。
            //   现在按模型传的天数算（问今天→1），口径由模型按主人的话决定。
            if (what === "all" || what.indexOf("元素") >= 0) { var _ed = parseFloat(a.days) || 7; out.push("【元素·最近 " + _ed + " 天】" + careElemText(_ed)); }
            if (what === "all" || what.indexOf("档案") >= 0) {
                var ms = (MEM.health && MEM.health.metrics) || [], last = {};
                for (var i = 0; i < ms.length; i++) if (ms[i] && ms[i].k) last[ms[i].k] = ms[i];
                var arr = [];
                for (var k in last) arr.push(k + " " + last[k].v + (last[k].unit || ""));
                out.push("身体指标：" + (arr.length ? arr.join("、") : "还没记过"));
            }
            if (what === "all" || what.indexOf("对话") >= 0) {
                var ch = (MEM.chat || []).slice(-6), ss = [];
                for (var j = 0; j < ch.length; j++) { if (ch[j].me) ss.push("主人：" + ch[j].me); if (ch[j].pet) ss.push("我：" + ch[j].pet); }
                out.push("最近对话：" + ss.join(" / "));
            }
            return out.join("\n");
        }
        if (name === "money_add") {
            var amt = parseFloat(a.amount) || 0;
            if (!amt) return "失败：金额无效";
            var tAdd = Date.now();
            if (String(a.day || "") === "yesterday") tAdd -= 86400000;
            // 2026-10-25 实锤（主人「早餐的 6 块钱你没记进去咋回事」）：10-24 09:07 语音报早餐 6 元，
            //   回话是「已记账（今天）：支出 6 元。今天合计 收入 0、支出 6」——**那是 money_add 的逐字返回**，
            //   说明工具真调了，可账本上根本没有这笔（12:28 才发现，12:30 手动补记）。
            //   根因＝saveMem 里「磁盘 rev 更新就采纳磁盘版本」：push 完立刻被磁盘旧版冲掉，
            //   而返回文案用的是冲掉前的内存算的 → 话说成功、钱没入账、用户无从分辨。
            //   修法照 fixed_add / money_set_day 的三步：写前先采纳磁盘新版 → 应用 → **写后回读校验**，
            //   不符就重载磁盘重写一次；两次都不在盘上就如实报失败（宁可说没记上，也不能报成功）。
            //   失败表现（若将来回归）：日志出现「记账写后校验不符…→ 重载磁盘重写一次」且最终回「失败：这笔没落盘」。
            var mAddRid = "m" + tAdd + "_" + Math.floor(Math.random() * 1e6);   // 防重写两次时叠出两笔
            var mAddApply = function () {
                MEM.money = MEM.money || [];
                for (var iA = 0; iA < MEM.money.length; iA++) { if (MEM.money[iA] && MEM.money[iA].rid === mAddRid) return; }
                MEM.money.push({ t: tAdd, kind: (String(a.kind) === "out" ? "out" : "in"), amt: amt, cat: String(a.note || "").slice(0, 12), raw: "AI工具", rid: mAddRid });
            };
            // 盘上校验返回三态：1＝在盘上，0＝不在，2＝读不到（无权限/测试工装）——
            //   2 不当失败（否则存盘不可读时每一笔记账都会变成「没记上」），只写日志。
            var mAddDiskState = function () {
                try {
                    var txt = readText(MEM_P); if (!txt) return 2;
                    var oM = JSON.parse(txt); if (!oM) return 2;
                    var aM = oM.money || [];
                    for (var iM = 0; iM < aM.length; iM++) {
                        var rM0 = aM[iM]; if (!rM0) continue;
                        if (rM0.rid === mAddRid) return 1;
                        if (Math.abs(Number(rM0.amt) - amt) < 0.005 && Math.abs(Number(rM0.t) - tAdd) < 3000) return 1;
                    }
                    return 0;
                } catch (eM5) { return 2; }
            };
            try { var _cm0 = JSON.parse(readText(MEM_P) || "null"); if (_cm0 && careMemRev(_cm0) > careMemRev(MEM)) careMemAdopt(_cm0); } catch (eM6) {}
            mAddApply(); saveMem();
            var _stM = mAddDiskState();
            if (_stM === 0) {
                log("记账写后校验不符（盘上没有 " + amt + " 元这笔）→ 重载磁盘重写一次");
                try { var _om2 = JSON.parse(readText(MEM_P) || "null"); if (_om2) careMemAdopt(_om2); } catch (eM7) {}
                mAddApply(); saveMem();
                _stM = mAddDiskState();
            }
            if (_stM === 2) log("记账：读不到账本文件，跳过落盘校验（内存已写入）");
            var dkT = careDayKeyOf(tAdd);
            var insT = 0, outsT = 0;
            for (var mi3 = 0; mi3 < MEM.money.length; mi3++) { var rM = MEM.money[mi3]; if (rM && careDayKeyOf(rM.t) === dkT) { if (rM.kind === "in") insT += rM.amt; else outsT += rM.amt; } }
            if (_stM === 0) return "失败：这笔 " + amt + " 元没落盘（已重载重写一次仍不在账本里），账没记上——**别跟主人说记好了**，如实说这次没记上。";
            return "已记账（" + (dkT === careDayKeyOf(Date.now()) ? "今天" : dkT) + "）：" + (String(a.kind) === "out" ? "支出" : "收入") + " " + amt + " 元。今天合计 收入 " + insT + "、支出 " + outsT + "。";
        }
        if (name === "money_set_day") {
            var dkS = careDayKeyOf(Date.now());
            // v1.9.6（2026-10-18 23:31 实锤：主人说「今天跑了 159.13 元」→ 模型选了 set_money 只传 income，
            //   于是 expense 被当成 0 写进去，今日三笔支出（7.5/10/30）全被抹掉——用户看到的「乱算」。
            // v1.9.7（23:34 追查第二层）：只改上面那层还不够——saveMem 里「磁盘 rev 更新就采纳磁盘版本」
            //   会在写的一瞬间把刚推入的条目冲掉（实测回复说改了 47.5、盘上还是 0）。现在三步：
            //   ① 动手前先采纳磁盘较新版本（避免拿旧内存去覆盖）；② 应用改动并保存；③ **写后回读校验**，
            //   不合就重载磁盘再写一次（只重试一次，失败不装成功）。
            var hasInc = !(a.income === undefined || a.income === null || String(a.income).trim() === "");
            var hasExp = !(a.expense === undefined || a.expense === null || String(a.expense).trim() === "");
            var inc = hasInc ? (parseFloat(a.income) || 0) : 0, exp = hasExp ? (parseFloat(a.expense) || 0) : 0;
            var dkS2 = careDayKeyOf(Date.now());
            var sumsFromDisk = function () {
                var o = null; try { o = JSON.parse(readText(MEM_P) || "null"); } catch (eD) {}
                var arr = (o && o.money) || [], i2 = 0, o2 = 0;
                for (var k = 0; k < arr.length; k++) {
                    var r = arr[k]; if (!r || careDayKeyOf(r.t) !== dkS2) continue;
                    if (r.kind === "in") i2 += Number(r.amt) || 0; else o2 += Number(r.amt) || 0;
                }
                return { ins: Math.round(i2 * 100) / 100, outs: Math.round(o2 * 100) / 100 };
            };
            var applySetDay = function () {
                // 2026-10-22（㉗）：**不再删当天记录**，只按差额追加冲正/补记 —— 历史可追溯、可核对
                var cur = { ins: 0, outs: 0 };
                for (var q = 0; q < MEM.money.length; q++) {
                    var rr = MEM.money[q]; if (!rr || careDayKeyOf(rr.t) !== dkS2) continue;
                    if (rr.kind === "in") cur.ins += Number(rr.amt) || 0; else cur.outs += Number(rr.amt) || 0;
                }
                if (hasInc) moneyAdjust(inc - cur.ins, 0, "改成 " + inc);
                if (hasExp) moneyAdjust(0, exp - cur.outs, "改成 " + exp);
            };
            try {
                var _curM = JSON.parse(readText(MEM_P) || "null");
                if (_curM && careMemRev(_curM) > careMemRev(MEM)) careMemAdopt(_curM);
            } catch (eRf) {}
            applySetDay(); saveMem();
            var chk = sumsFromDisk();
            if ((hasInc && Math.abs(chk.ins - inc) > 0.005) || (hasExp && Math.abs(chk.outs - exp) > 0.005)) {
                log("记账写后校验不符（盘上 收入" + chk.ins + "／支出" + chk.outs + "，应为 收入" + inc + "／支出" + exp + "）→ 重载磁盘重写一次");
                try { var _o3 = JSON.parse(readText(MEM_P) || "null"); if (_o3) careMemAdopt(_o3); } catch (eR2) {}
                applySetDay(); saveMem();
                chk = sumsFromDisk();
            }
            var _nowTxt = careMoneyTodayText();
            return (hasInc ? "已把今天的收入改成 " + inc + " 元" : "") + (hasInc && hasExp ? "、" : "") + (hasExp ? "已把今天的支出改成 " + exp + " 元" : "") +
                (!hasInc && !hasExp ? "没收到要改的数字" : (hasInc && hasExp ? "" : "（没说的一侧保持原样）")) + "。" + _nowTxt;                                                       
        }
        if (name === "open_traffic") {
            var rT2 = careMapOpen(a && a.dest);
            if (rT2 && rT2.ok) return "路况图已弹出来" + ((a && a.dest) ? ("，" + a.dest + " 已标在图上") : "") + (rT2.locOk ? "（已定到你当前位置）" : ("；但没拿到定位：" + (rT2.locWhy || "") + "，点窗口里的「📍我」再试"));
            return String((rT2 && rT2.msg) || "路况图没弹出来");
        }
        if (name === "money_clear_day") {
            var curC = careMoneyToday();
            // 2026-10-22（㉗）：清空＝先列候选 → 主人/模型确认 → 追加冲正归零；**绝不真删记录**
            if (String((a && a.confirm) || "") !== "yes") {
                if (!curC.items.length) return "今天本来就没有收支记录，不用清。";
                var lsC = [];
                for (var ci = 0; ci < curC.items.length && ci < 12; ci++) {
                    var itC = curC.items[ci];
                    lsC.push((itC.kind === "in" ? "收 " : "支 ") + careYuan(itC.amt) + (itC.cat ? "（" + itC.cat + "）" : ""));
                }
                return "今天共 " + curC.items.length + " 条记录：" + lsC.join("；") +
                    "。合计 收 " + careYuan(curC.inSum) + "／支 " + careYuan(curC.outSum) +
                    "。确认要清空就把 confirm 填 yes 再调一次 —— 我不会删掉这些记录，只追加一条冲正把今天归零，原始记录留着可追溯。";
            }
            var nC = moneyAdjust(-curC.inSum, -curC.outSum, "清空今日");
            saveMem();
            log("账本冲正·清空今天：追加 " + nC + " 条（收 -" + careYuan(curC.inSum) + " 支 -" + careYuan(curC.outSum) + "）");
            return nC ? ("今天已归零（追加 " + nC + " 条冲正，原始 " + curC.items.length + " 条记录都留着没删）。" + careMoneyTodayText())
                : "今天本来就没有收支记录";
        }
        // v1.5.6（2026-10-18 14:18 用户点明「我说了在跑车」）：开工/收车两个动作——以前只有休息没有出车，
        // 「吃完在跑车」里的跑车就被丢了。开工时顺便把还开着的休息计时停掉（状态互斥，不是写死业务话术）。
        if (name === "work_start") {
            ensureWorkMem();
            MEM.work.on = true; MEM.work.since = Date.now();
            var anyOpen2 = false;
            for (var q2 = MEM.rest.length - 1; q2 >= 0; q2--) { if (MEM.rest[q2] && !MEM.rest[q2].e) { anyOpen2 = true; break; } }
            var extra2 = anyOpen2 ? ("；" + String(careToolRun("rest_stop", {}) || "")) : "";
            saveMem();
            var dn2 = new Date();
            var hm2 = ("0" + dn2.getHours()).slice(-2) + ":" + ("0" + dn2.getMinutes()).slice(-2);
            return "记下了：现在在跑车（" + hm2 + " 开工）" + extra2;
        }
        if (name === "work_end") {
            ensureWorkMem();
            MEM.work.on = false; MEM.work.since = 0;
            saveMem();
            return "记下了：收车了，今天跑车先到这。";
        }
        // v1.5.0（2026-10-18 用户点单：车租金要进账本、看得见）：固定支出（每月/每年）单独存，不污染今日收支
        if (name === "fixed_add") {            var fxName = String(a.name || "").replace(/^\s+|\s+$/g, "").slice(0, 12) || "固定支出";
            var fxAmt = parseFloat(a.amount) || 0;
            if (!fxAmt) return "失败：金额无效";
            var fxCycle = (String(a.cycle || "") === "年") ? "年" : "月";
            // v1.9.9（2026-10-18 23:39 实锤：让「车租金改成 2200」→ 回话写了 2200，盘上还是 2220）：
            //   ① 旧实现是无脑 push——同名会叠成两条，改价时改不动「每月合计」；
            //   ② 与 money_set_day 同源：saveMem 会采纳磁盘较新版本，把刚 push 的条目冲掉。
            //   修法：同名覆盖（先滤掉同名再插）+ 写前采纳磁盘新版 + 写后回读校验（不符重写一次）。
            var applyFixed = function () {
                var arr = (MEM.fixed || []).filter(function (x) { return !(x && String(x.name || "") === fxName); });
                arr.push({ name: fxName, amt: fxAmt, cycle: fxCycle, t: Date.now() });
                MEM.fixed = arr;
            };
            var fixedOnDisk = function () {
                try {
                    var oF = JSON.parse(readText(MEM_P) || "null");
                    var aF = (oF && oF.fixed) || [];
                    for (var iF = 0; iF < aF.length; iF++) {
                        if (aF[iF] && String(aF[iF].name || "") === fxName && Math.abs(Number(aF[iF].amt) - fxAmt) < 0.005) return true;
                    }
                } catch (eF) {}
                return false;
            };
            try { var _cf = JSON.parse(readText(MEM_P) || "null"); if (_cf && careMemRev(_cf) > careMemRev(MEM)) careMemAdopt(_cf); } catch (eF0) {}
            applyFixed(); saveMem();
            if (!fixedOnDisk()) {
                log("固定支出写后校验不符（盘上没有 " + fxName + " " + fxAmt + "）→ 重载磁盘重写一次");
                try { var _of2 = JSON.parse(readText(MEM_P) || "null"); if (_of2) careMemAdopt(_of2); } catch (eF1) {}
                applyFixed(); saveMem();
            }
            return "已记下固定支出：" + fxName + " " + fxAmt + " 元/" + fxCycle + "。" + careFixedMonthlyText();
        }
        if (name === "fixed_del") {
            var fdKey = String(a.name || "").replace(/^\s+|\s+$/g, "");
            var beforeF = (MEM.fixed || []).length;
            MEM.fixed = (MEM.fixed || []).filter(function (x) { return !(x && fdKey && String(x.name || "").indexOf(fdKey) >= 0); });
            saveMem();
            return "已删固定支出 " + (beforeF - MEM.fixed.length) + " 条。" + (careFixedMonthlyText() || "现在没有固定支出了");
        }
        if (name === "rest_start") {
            // 主人亲口说休息：走同一套开关（若自动那条已经开了，就地升级成手动，不多开一条）
            var rs = careRestStart("manual", 0);
            if (!rs.ok && rs.why === "already") return "已经在计时了（已 " + Math.round((Date.now() - rs.open.s) / 60000) + " 分钟）";
            if (rs.upgraded) return "好，这条我改成你手动计时了（从 " + new Date(rs.open.s).toLocaleTimeString() + " 算起），起来跟我说一声";
            return "已开始计时休息（" + new Date().toLocaleTimeString() + "），起来跟我说一声";
        }
        if (name === "rest_stop") {
            var rt = careRestStop("manual");
            if (!rt.ok) return "当前没有在计时的休息";
            return "休息结束，这次约 " + rt.mins + " 分钟；今日累计 " + careRestToday().mins + " 分钟";
        }
        if (name === "rest_add_past") {
            var mins = parseFloat(a.minutes) || 0;
            if (mins <= 0 || mins > 720) return "失败：时长不合理";
            var MEALH = { "早饭": 7, "早点": 7, "午饭": 12, "中午": 12, "晚饭": 18, "夜宵": 22 };
            var hh = MEALH[String(a.meal || "")] != null ? MEALH[String(a.meal)] : 12;
            var st = new Date(); st.setHours(hh, 0, 0, 0);
            var ts0 = st.getTime(); if (ts0 > Date.now()) ts0 -= 86400000;
            MEM.rest.push({ s: ts0, e: ts0 + mins * 60000, auto: false, past: true, note: String(a.meal || "那次") });
            saveMem();
            return "已补记：" + (a.meal || "那次") + " 约 " + mins + " 分钟；今日累计 " + careRestToday().mins + " 分钟";
        }
        if (name === "rest_set_day") {
            var mm2 = parseFloat(a.minutes);
            if (!(mm2 >= 0) || mm2 > 720) return "失败：时长不合理";
            var dk2 = careDayKeyOf(Date.now());
            MEM.rest = (MEM.rest || []).filter(function (r) { return r && careDayKeyOf(r.s) !== dk2; });
            if (mm2 > 0) {
                var st2 = new Date(); st2.setHours(12, 0, 0, 0);
                MEM.rest.push({ s: st2.getTime(), e: st2.getTime() + mm2 * 60000, auto: false, past: true, note: "改成" });
            }
            saveMem();
            return "已把今天的休息时间改成 " + mm2 + " 分钟（今日累计 " + careRestToday().mins + " 分钟）";
        }
        if (name === "rest_clear_day") {
            var dk3 = careDayKeyOf(Date.now());
            var beforeN = (MEM.rest || []).length;
            MEM.rest = (MEM.rest || []).filter(function (r) { return r && careDayKeyOf(r.s) !== dk3; });
            saveMem();
            return "已清空今天的休息记录（删了 " + (beforeN - MEM.rest.length) + " 条）";
        }
        if (name === "metric_add") {
            var kk = String(a.k || "").slice(0, 8), vv = String(a.v || "").slice(0, 20);
            if (!kk || !vv) return "失败：指标名或数值为空";
            MEM.health.metrics = MEM.health.metrics || [];
            MEM.health.metrics.push({ t: Date.now(), k: kk, v: vv, unit: "" });
            saveMem();
            return "已记：" + kk + " " + vv;
        }
        if (name === "fact_add") {
            var tx = String(a.text || "").slice(0, 80);
            if (!tx) return "失败：内容为空";
            var fr = CARECORE.factAdd(MEM.facts, tx);
            saveMem();
            return fr.dup ? "这条已经记过了" : "记住了：" + tx;
        }
        if (name === "set_work") {
            MEM.work.mode = String(a.mode || "工作").slice(0, 20);
            if (a.platform) MEM.work.platform = String(a.platform).slice(0, 12);
            MEM.work.since = MEM.work.since || Date.now();
            saveMem();
            return "已记下工作方式：" + MEM.work.mode + (MEM.work.platform ? "（" + MEM.work.platform + "）" : "");
        }
        if (name === "fact_del") {
            var dr2 = CARECORE.factDel(MEM.facts, String(a.text || ""));
            saveMem();
            return dr2.ok ? "已忘掉这条记忆" : "没找到这条记忆";
        }
        // 2026-10-22（用户 12:15-12:18 实锤）：「最新的预判历史你能发现有哪些地方不对吗」→ 它跑去 read_file
        //   关心_记忆.json，还把 3600 字原始 JSON 当回答贴给主人（那是长期事实，不是分析留档）。
        //   根因：预判/一策的留档（careLogList）**只接了网页桥，没给模型任何工具**，它只能猜文件名。
        if (name === "plan_history") {
            var kdRaw = String((a && a.kind) || "").trim();
            var kd = "";
            if (/预判|forecast/i.test(kdRaw)) kd = "forecast";
            else if (/晨|早|morning/i.test(kdRaw)) kd = "morning";
            else if (/晚|复盘|evening/i.test(kdRaw)) kd = "evening";
            var list = careLogList(kd);
            if (!list || !list.length) return "还没有留档记录（一策和长期预判生成成功才会留档，失败不写）。";
            var rows = [], lim = Math.min(list.length, 8);
            for (var li = 0; li < lim; li++) {
                var e0 = list[li] || {};
                var kn = e0.kind === "forecast" ? "长期预判" : (e0.kind === "evening" ? "今晚复盘" : "今日一策");
                rows.push((li + 1) + ") " + careMD(e0.t) + " " + careHM(e0.t) + " [" + kn + "] " + String(e0.text || "").replace(/\s+/g, " ").slice(0, 200));
            }
            return "留档共 " + list.length + " 条，下面是最近 " + lim + " 条（最新的在最前）：\n" + rows.join("\n");
        }
        if (name === "full_analysis") {
            var anr = careAnalysis();
            return anr.ok ? anr.text : ("分析没跑起来：" + (anr.msg || ""));
        }
        if (name === "diet_del") return careDietDel(a.keywords, a.pick);
        if (name === "diet_clear_day") return careDietClearDay(a.confirm);
        if (name === "diet_note") {
            var dtext = String(a.text || "").slice(0, 60);
            if (!dtext) return "失败：内容为空";
            // 2026-10-21：以前只存 {t,s}，顿数只能按"条数"算 → 同一顿纠正两次就变两顿。
            //   补一个餐次标记（早/中/晚/夜），顿数按餐次去重（careMealSlotCount）。
            // 2026-10-25 补（10-24 15:48 的午饭被按钟点标成「晚」→ 22:15 答「今天记了 2 顿」实际 3 餐）：
            //   **模型自己给了餐次就以模型的为准**（只认 1-2 个字，别让脏参数写进档案），没给才按钟点兜底。
            var _mealGiven = String(a.meal || "").replace(/\s/g, "");
            var rec = { t: Date.now(), s: dtext, meal: (_mealGiven && _mealGiven.length <= 2) ? _mealGiven : careMealTagNow(dtext) };
            MEM.health.diet = MEM.health.diet || [];
            // 2026-10-25：真记了一顿就把「饭点提问」这个上下文清掉（它只是给模型的提示，不是自动写入）。
            try { MEM.health.pendingAsk = null; } catch (ePA2) {}
            // 2026-10-22 13:0x 实锺：同一顿饭被模型连着记了 4 遍（12:53/12:56/12:58/13:00 各两条），
            //   顿数与元素全被搞乱。这里只做**确定性**去重：今天 + 同一餐次 + 同一句话 → 不新增。
            var _d0 = careDietDayStart(), _dup = null, _recent = null;
            // 2026-10-22 13:26 实锤：同一顿第二次记时只少了「（5元）」这点差别，精确比对就漏判 →
            //   同一天同一餐次多出一条（今天 2 顿变 4 条）。比对前只做**确定性的文本归一**（去价格、去标点空格），
            //   不做语义判断。
            var _dtNorm = function (x) {
                return String(x || "")
                    .replace(/[（(][^）)]{0,10}[元块份杯][^）)]{0,10}[）)]/g, "")
                    .replace(/[0-9]+(\.[0-9]+)?\s*元/g, "")
                    .replace(/[，。！？、,.!?\s\u3000（）()【】\[\]：:；;～~“”"']/g, "");
            };
            var _dtn = _dtNorm(dtext);
            for (var di = MEM.health.diet.length - 1; di >= 0 && di >= MEM.health.diet.length - 12; di--) {
                var rr0 = MEM.health.diet[di];
                if (!rr0 || !rr0.t || rr0.t < _d0) continue;
                if (_dtn.length >= 2 && _dtNorm(rr0.s) === _dtn && String(rr0.meal || "") === String(rec.meal)) { _dup = rr0; break; }
                // 2026-10-25 新增（10-24 17:43/17:44 实锤：同一次语音的原文与摘要各记一条，是同义改写，
                //   文本归一救不了）：**同一天 + 同一餐次 + 30 分钟内**判为同一顿 → 合并进原记录，不新增。
                //   纯确定性判据（时间与餐次），不判断"说的是不是同一道菜"（那是模型的活）。
                if (!_recent && rr0 && String(rr0.meal || "") === String(rec.meal) && (rec.t - (rr0.t || 0)) <= 30 * 60000) _recent = rr0;
            }
            if (_dup) return "这顿刚记过了（" + dtext + "），没重复写；元素在算，稍等。";
            if (_recent) {
                _recent.s = String(_recent.s || "").slice(0, 40) + " ／ " + dtext;
                saveMem();
                log("饮食(同餐合并)：30 分钟内同餐次又来一条 → 并入原记录，不新增：" + dtext.slice(0, 20));
                try { careMealTextAnalyze(_recent.s, _recent); } catch (eM4b) { log("报餐分析启动异常：" + eM4b); }
                return "这顿刚记过（" + String(_recent.s).slice(0, 30) + "…），我把这句并进同一条了，没算两顿；元素在重算。";
            }
            // 2026-10-25：与 money_add 同源加固——saveMem 会采纳磁盘较新版把刚 push 的条目冲掉，
            //   旧代码 push 完就回「已记下这顿」；10-24 09:07 那次就是饭记上了、钱没记上（同一个病）。
            //   这里同样：写前采纳磁盘新版 → 应用 → **回读校验** → 不符重写一次 → 仍不在盘上就如实说没记上。
            var dRid = "d" + rec.t + "_" + Math.floor(Math.random() * 1e6);   // 重写一次时不叠出两条
            rec.rid = dRid;
            var dApply = function () {
                MEM.health = MEM.health || {}; MEM.health.diet = MEM.health.diet || [];
                for (var iA2 = 0; iA2 < MEM.health.diet.length; iA2++) { if (MEM.health.diet[iA2] && MEM.health.diet[iA2].rid === dRid) return; }
                MEM.health.diet.push(rec); if (MEM.health.diet.length > 400) MEM.health.diet.shift();
            };
            // 三态同 money_add：1＝在盘上，0＝不在，2＝读不到（测试工装/无权限）不当失败。
            var dOnDisk = function () {
                try {
                    var txtD = readText(MEM_P); if (!txtD) return 2;
                    var oD = JSON.parse(txtD); if (!oD) return 2;
                    var aD = (oD.health && oD.health.diet) || [];
                    for (var iD = 0; iD < aD.length; iD++) {
                        var rD = aD[iD]; if (!rD) continue;
                        if (rD.rid === dRid) return 1;
                        if (Math.abs(Number(rD.t) - rec.t) < 3000 && String(rD.s || "").slice(0, 12) === dtext.slice(0, 12)) return 1;
                    }
                    return 0;
                } catch (eD0) { return 2; }
            };
            try { var _cd = JSON.parse(readText(MEM_P) || "null"); if (_cd && careMemRev(_cd) > careMemRev(MEM)) careMemAdopt(_cd); } catch (eD1) {}
            dApply(); saveMem();
            var _stD = dOnDisk();
            if (_stD === 0) {
                log("饮食写后校验不符（盘上没有这条）→ 重载磁盘重写一次");
                try { var _od2 = JSON.parse(readText(MEM_P) || "null"); if (_od2) careMemAdopt(_od2); } catch (eD2) {}
                dApply(); saveMem();
                _stD = dOnDisk();
            }
            if (_stD === 2) log("饮食：读不到档案文件，跳过落盘校验（内存已写入）");
            if (_stD === 0) return "失败：这顿没落盘（已重试一次），**别跟主人说记好了**——如实说这次没记上。";
            // 2026-10-25 18:10（主人点单）：原来这里在 diet_note 记下一顿后 sleep 11 秒**无条件**播
            //   「拍给我看看你吃的啥」——写死模板，和他那边模型的正常回复重叠（他听到两个声音），
            //   违反「一切判断交给 AI，代码不替模型说话」（2026-10-18 立规），已整段删除；
            //   要不要邀拍由模型自己决定（提示词里已允许它主动说），代码不再插嘴。
            try { careMealTextAnalyze(dtext, rec); } catch (eM4) { log("报餐分析启动异常：" + eM4); }
            return "已记下这顿：" + dtext + "（营养塔和元素在算，稍等我播报）";
        }
        return "未知工具：" + name;
    } catch (e) { return "工具执行失败：" + e; }
}
// 带工具循环的对话：模型可以连续调工具，最后用真实结果回话
function aiChatWithTools(text, charId) {
    try {
        var key = careCfgKey("chat") || loadZKey();
        if (!key) return { ok: false, msg: "无密钥" };
        var msgs = [{ role: "system", content: CARECORE.aiPersona(charId, MEM.facts, nowStr()) }];
        var sc = careSelfContext();
        if (sc) msgs.push({ role: "system", content: sc });
        // v1.3.1（2026-10-18 用户报障「给它说的东西它反问我不知道记啥」）：记录规则写成硬规矩。
        // 实测 glm-4-flash 会把「我今天跑了 300」「我腰围 90」当闲聊回一句好听的→什么也没记。
        msgs.push({ role: "system", content: "记录硬规矩：主人只要讲了关于他自己／他的钱／身体／吃饭／作息／工作的**任何事实**（哪怕没明说「记一下」），你必须**先调工具记下来**（fact_add＝关于他的事；money_add＝钱；diet_note＝吃了什么；metric_add＝体重血压等），再回一句「记下了：…」。**绝对不许反问「要记什么」「不知道记啥」**——那就是失职。" });
        // v1.3.3：从分身搬来的「诚实铁规」（分身能用免费 flash 也靠这套——不许糊弄）
        msgs.push({ role: "system", content: "诚实铁规（违反即作废）：①主人让你记的事，必须真的调工具写下来——只回「好的记住了」而没调工具＝撒谎；②「我看了/我改了/我查了/我算好了」必须有工具结果支撑，否则不许说；③**不许编造卡点**（不许随口说需要开权限/连不上/网络不行，除非真的如此）；④不许只宣布「我来/让我」却不出手——要做什么就直接调工具；⑤算数字只准用主人给的数和工具返回的数，不许自己推。" });
        // 2026-10-23 实锤（主人「你看关心app聊天记录最新的它又像神经病样」）：13:59 它看图说「今天营养摄入真丰富、钙铁锌维A C D 都齐了」，
        //   14:01 又答「截图里的字我确实看不了」，14:03 再改口「之前说读出来是我胡扯」——三句话三种说法。
        //   真根子：看图是另一个视觉模型干的活，聊天模型只拿到一段转述，却以为图是它自己看的。
        //   这里只摆**事实**（它是谁、那段话怎么来的），不替它判断该说什么。
        msgs.push({ role: "system", content: "【看图这件事的事实，不是要求】你（聊天模型）没有视觉能力，看不到任何图片。聊天记录里那条「📷 [照片]」和紧跟它、由你说出的那段描述，是系统调另一个看图模型看完图片后的转述——图里有什么，你只能以那段转述为准。所以：①不许说你「自己能看图／能读图里的字」；②也不许否认「刚才看过图」（那段描述确实是系统替你看、替你回的）——准确说法是「图片是看图模型看完转述给我的，我手上只有这段描述」；③主人问图里的细节而转述里没有的，就照实说转述里没有、请他直接说一句或再发一张；④转述跟主人说的对不上时（比如他说这是截图、转述却像在夸饭菜），**以主人说的为准**，当场承认转述不准，不许拿它当事实继续往下推。" });
        // 2026-10-22 14:0x：模型看不见「自己上一条到底做成没有」——历史里它的空头承诺看起来像已完成，
        //   于是下一轮继续承诺（13:51:59 实测：0 次工具调用、68 字承诺，然后就被收口）。
        //   这里只摆**事实**，不替它判断该说什么。
        msgs.push({ role: "system", content: "【系统事实·不是要求】对话历史里，如果你的某条回话后面标着「系统记录：这轮 0 工具」，那一轮你**没有调用任何工具、什么也没做成**，只是嘴上说了。别把它当成已完成的任务反复复述；主人再问时，要做事就直接调工具做完再回话。" });
        try { if (AI_DROP_NOTE) { msgs.push({ role: "system", content: AI_DROP_NOTE }); AI_DROP_NOTE = ""; } } catch (eDn) {}
        // v1.4.0：上下文 6 轮/120 字 → 14 轮/300 字——原来太短，主人说「你再理一下」它压根不知道在理什么。
        // 2026-10-22：干活档升 pro 后把窗口对齐到和主会话一个量级（40 轮、每条 600/1000 字）——
        //   它反复改口的一大原因是“转头就忘自已刚说过什么”，不是模型不行。
        var hist = (MEM.chat || []).slice(-40);
        for (var i = 0; i < hist.length; i++) {
            if (hist[i].me) msgs.push({ role: "user", content: String(hist[i].me).slice(0, 600) });
            if (hist[i].pet && !careIsStub(hist[i].pet)) {
                // 2026-10-22：把「这轮调了几个工具」这个**事实**标进历史（tn 由 doChat 落盘）
                var _hTag = (hist[i].tn === 0) ? "\n〔系统记录：这轮 0 工具，上面的话没有对应的实际动作〕" : "";
                msgs.push({ role: "assistant", content: String(hist[i].pet).slice(0, 1000) + _hTag });
            }
        }
        msgs.push({ role: "user", content: String(text || "").slice(0, 300) });
        var used = [];
        // 2026-10-22（用户 10:48-11:06 实锺「变来变去」拆因）：一轮工具只能跑 4 次，查一个函数要
        //   search → read → read → read，第 4 轮就被「收口」逼着开口——手头半截证据，说出来的行号下一轮
        //   自己一查就矛盾，于是改口、再改口。给到 8 轮；烧钱的阀门不靠轮次数，靠同参重复提醒（_reps）
        //   与那一条 max_tokens=1200。
        var _ledger = [];
        // 2026-10-21 ccode·「8 分钟读同一段 30+ 次」实锤：同参重复调用不拦会让一整轮全烧在读文件上。
        //   这里只做**确定性**的重复计数（不判内容），第 3 次同参就给模型一条系统提醒，逼它换手段或动手。
        var _reps = {};
        // v0.7.1：工具循环按「能用工具且当前 Key 有额度」的顺序试——实测这把免费 Key 上
        // glm-4-plus / glm-4-air 都是 429（余额不足），只有 glm-4-flash 能真正调工具；
        // 写死用 plus 会导致静默退回纯聊天＝又变死板（用户 21:2x 当场骂「咋感觉又是你写死的」）。
        var TOOL_MODELS = careCfgList("tool");
        // v2.1.0（2026-10-19 凌晨·用户报「几句话就超限」实锤）：3 → 4 轮。
        //   旧上限 3 轮是给「一句话一个动作」定的；现在一句话常要连查三样数据（read_data /
        //   money_report / track_query 各占一轮），三轮全花在调工具上，模型压根没机会开口说话，
        //   于是整句认输成「没接通：工具轮次超限」（日志 00:52:07 实证）。给到 4 轮（3 查 + 1 余量），
        //   再多就是烧钱；真正的保险是下面那一轮「不带 tools 的收口」，不靠无上限加轮次。
        var TOOL_ROUNDS = 16;
        for (var round = 0; round < TOOL_ROUNDS; round++) {
            var r = null, usedModel = "";
            for (var mi2 = 0; mi2 < TOOL_MODELS.length; mi2++) {
                var bodyT = { model: TOOL_MODELS[mi2], messages: msgs, tools: CARE_TOOLS, temperature: 0.5, max_tokens: 2000 };
                r = httpPostJson(careCfgUrl("chat"), bodyT,
                    { "Authorization": "Bearer " + key }, 8000, 30000);
                if (!r.ok) { log("工具模型 " + TOOL_MODELS[mi2] + " 不可用：" + String(r.msg || "").slice(0, 50)); continue; }
                // v2.0.4：模型档偶尔会「200 但内容空」——当它不可用，继续往下一档降，
                //   别把空当成终局（主人看到的就是「没接通：未知原因」）。
                var _pj = null; try { _pj = JSON.parse(r.text); } catch (ePj) {}
                var _pm = ((_pj && _pj.choices || [])[0] || {}).message || {};
                if (!String(_pm.content || "").trim() && !(_pm.tool_calls && _pm.tool_calls.length)) {
                    log("工具模型 " + TOOL_MODELS[mi2] + " 返回空内容 → 换下一档：" + String(r.text || "").slice(0, 80));
                    continue;
                }
                usedModel = TOOL_MODELS[mi2]; break;
            }
            if (!r || !r.ok) { log("工具对话失败（所有工具模型都不可用）"); try { careNetFailMark((r && r.msg) || ""); } catch (eNm) {} return { ok: false, msg: "工具模型不可用" }; }
            if (usedModel) log("工具模型=" + usedModel);
            var j = null;
            try { j = JSON.parse(r.text); } catch (eJ) { return { ok: false, msg: "解析失败" }; }
            try { careUsageLog("工具" + (round + 1) + "/" + usedModel, j); } catch (eU1) {}
            var m = ((j.choices || [])[0] || {}).message || {};
            if (m.tool_calls && m.tool_calls.length) {
                msgs.push(m);
                // 2026-10-22 修一个真 bug：原来 `var _nudge = ""` 写在下面 for 循环**之后**，
                //   var 会提升、赋值却把它重置成空 → 「打转提醒」上线以来一次都没真发出去过。
                var _nudge = "";
                for (var t2 = 0; t2 < m.tool_calls.length; t2++) {
                    var tc = m.tool_calls[t2];
                    var args = {};
                    try { args = JSON.parse(tc["function"].arguments || "{}"); } catch (eA) {}
                    var _sig = tc["function"].name + "|" + String(tc["function"].arguments || "").replace(/\s+/g, "");
                    _reps[_sig] = (_reps[_sig] || 0) + 1;
                    if (_reps[_sig] >= 3) _nudge = "【打转提醒】你已经用同样的参数调 " + tc["function"].name + " " + _reps[_sig] + " 次了，结果不会变。别再重复读：换更窄的范围一次读准，或者直接 code_edit 动手改（改错有 .bak 可回滚）。";
                    var out = careToolRun(tc["function"].name, args);
                    used.push(tc["function"].name);
                    _ledger.push(tc["function"].name + "(" + String(tc["function"].arguments || "").replace(/\s+/g, " ").slice(0, 90) + ") → " + String(out).replace(/\s+/g, " ").slice(0, 70));
                    log("AI工具：" + tc["function"].name + " → " + String(out).slice(0, 50));
                    msgs.push({ role: "tool", tool_call_id: tc.id, content: String(out).slice(0, 4000) });
                }
                if (_nudge) msgs.push({ role: "system", content: _nudge });
                continue;
            }
            var txt = CARECORE.stripThink(m.content || "");
            if (!txt) return { ok: false, msg: "空回复" };
            // 2026-10-22（用户 10:48-11:06 实锤「变来变去」）：deepseek-flash 有时把工具调用写成 DSML 正文
            //   （<｜｜DSML｜｜ invoke ...>），既没真执行、又会被当成回答发出去 → 主人眼里就是「嘴上说看了」。
            //   这里是**协议层**纠正（不是判它说的内容对不对）：提醒一次「要用 tool_calls」，然后继续下一轮。
            if (/｜｜DSML｜｜|<\|DSML\|>|<tool_use|<function_calls>/i.test(txt) && round < TOOL_ROUNDS - 1) {
                log("模型把工具调用写成了正文（DSML）→ 不当作回答，提醒后继续");
                // 2026-10-22 12:16 实锺回归：这里原来还 push 了一条空 assistant 消息 → DeepSeek 推理模型直接 400
                //   （The `reasoning_content` in the thinking mode must be passed back），两个档位全挂、整句变成「没接通」。
                //   推理模型要求带 tool_calls 的 assistant 消息原样回传并带 reasoning_content；自己造一条空的就破坏协议。
                //   所以这里只追加系统提醒，不动历史里的 assistant 消息。
                msgs.push({ role: "system", content: "刚才那段工具调用写成正文文本了，系统没有执行。要调工具就用 tool_calls；已经查到的内容直接用一两句话说清，别再写调用标记。" });
                continue;
            }
            //   上一版这里有一条**写死的正则**（已经｜已记｜记下了…）判「嘴上说做了、其实没调工具」：
            //   第一轮打回重问，第二轮干脆**丢掉整句话**、改成「没接通：模型没有调用任何工具」。
            //   实测误伤（01:37:59 日志）：主人问「我上次问你的问题你能理解了吗」，模型答「我已经理解了…」——
            //   一个「已经」就中判据 → 正常聊天被硬判成没接通，主人当场抓到。
            //   改成：**模型给了文字就照它的回**。诚实由系统提示词的「诚实铁规」＋计划路径的完整性自查去约束，
            //   不再由 App 用正则替模型下结论（主人规矩：一切判断交给 AI，不许写死判据）。
            return { ok: true, text: txt, tools: used };
        }
        // v2.1.0（2026-10-19 凌晨·用户报「关心几句话就超限了」）：轮次用尽时模型手里已经攒了一堆真实
        //   工具结果，却因为没有「最后一轮开口」的机会而整句认输——主人看到「没接通：工具轮次超限」。
        //   补一轮**不带 tools** 的收口：不带工具它只能说话，把已查到的真数据讲成人话。
        //   实测（10-19 00:5x 直连 Zhipu）：带 tool_calls + tool 结果的历史、不传 tools → HTTP 200 正常出话。
        try {
            var finMsgs = msgs.concat([{ role: "system", content: "工具已经用完了，别再要工具。只准用上面工具返回的真实数据，用一两句话说清结论；数据没有就说没有，不许编数字。" + careToolLedger(_ledger) }]);
            var fj = null, fmodel = "";
            for (var fmi = 0; fmi < TOOL_MODELS.length; fmi++) {
                var fr = httpPostJson(careCfgUrl("chat"),
                    { model: TOOL_MODELS[fmi], messages: finMsgs, temperature: 0.5, max_tokens: 1200 },
                    { "Authorization": "Bearer " + key }, 8000, 25000);
                if (!fr.ok) { log("收口档位 " + TOOL_MODELS[fmi] + " 不可用：" + String(fr.msg || "").slice(0, 40)); continue; }
                try { fj = JSON.parse(fr.text); } catch (eFj) { fj = null; }
                fmodel = TOOL_MODELS[fmi]; break;
            }
            if (fj) {
                careUsageLog("收口/" + fmodel, fj);
                var fmsg = ((fj.choices || [])[0] || {}).message || {};
                var ftxt = CARECORE.stripThink(fmsg.content || "").trim();
                if (ftxt) { log("工具轮次用尽 → 收口一轮：" + ftxt.slice(0, 40)); return { ok: true, text: ftxt, tools: used }; }
            }
        } catch (eFin) { log("收口轮异常：" + eFin); }
        return { ok: false, msg: "工具轮次超限" };
    } catch (e) { return { ok: false, msg: String(e) }; }
}
// ===== v1.0.0：**JSON 行动计划**（不依赖模型原生工具调用，弱模型也能真执行）=====
// 用户拍板「接通 AI 让它能操作所有事情」。实测 glm-4-flash 的原生 tool_calls 不稳（还会无视 tool_choice），
// 但它能稳定输出「动作 JSON」——于是改成：模型只负责判断「要干什么 + 参数」，App 负责真的执行并回报。
var CARE_ACTS = "动作表（只输出 JSON，不要别的文字）：\n" +
    "{\"action\":\"set_money\",\"args\":{\"income\":数,\"expense\":数},\"say\":\"…\"} 把今天收支总额直接设成这个数（纠正数字，或**主人否认某笔账存在**「我没收入320也没支出255」时用；没有的部分填 0）\n" +
    "{\"action\":\"clear_money\",\"args\":{},\"say\":\"…\"} 清空今天的收支记录（主人说「今天的账都是试的／不算数／记乱了，清掉」用这个；别用 read_money 念旧账）\n" +
    "{\"action\":\"open_traffic\",\"args\":{\"dest\":\"可以空\"},\"say\":\"…\"} 只弹/更新**路况图**（看哪里堵）——说「看下路况」「路况给我看看」才用，dest 留空。**「导航去XX」不许用它**\n" +
    // 2026-10-23 第一步「手」：它能在屏幕上真的动手（不是只说话）
    "{\"action\":\"open_app\",\"args\":{\"name\":\"微信\"},\"say\":\"…\"} **打开手机里的某个 App**（微信/支付宝/抖音/设置…）——主人说「帮我打开××」用这个\n" +
    "{\"action\":\"look_screen\",\"args\":{\"filter\":\"可以空\"},\"say\":\"…\"} **看现在屏幕上是什么**（读出界面上的字与位置）——主人问「我屏幕上是什么／我卡在这页了」用这个；要 tap 之前先看它一眼\n" +
    "{\"action\":\"tap\",\"args\":{\"text\":\"按钮文字\"},\"say\":\"…\"} **点一下屏幕上的东西**（按文字找按钮；也可用 x/y 坐标，但先 look_screen）——主人说「帮我点××」用这个。付款/转账/发送/删除这类不可逆动作工具会拒，得主人亲口点头\n" +
    "{\"action\":\"nav_to\",\"args\":{\"dest\":\"目的地名\",\"mode\":\"drive\",\"lat\":纬度,\"lon\":经度},\"say\":\"…\"} **真导航**（开窗→切导航→算路）：主人说「导航去XX／带我去XX／导航去最近的停车位/充电站」用这个。**只要是「附近的/最近的」某类地点，同一句里必须先用 map_search 现搜（charging / road_parking / toilet / baozi），再把它最近那家的名字+坐标填进来**；绝不许拿聊天记录里的旧地名直接导航\n" +
    // 2026-10-19 实测：主人问「你自己的地图搜附近厕所和充电站为啥搜不到」，模型把「厕所」当关键词去 main.js 里搜文本。
    //   根因是动作表里根本没有「搜地点」这件事。补上，并把两者的分工写死在同一段里（防再混）。
    "{\"action\":\"map_search\",\"args\":{\"keywords\":\"厕所\",\"radius\":3000}} **搜附近的地点**（厕所/充电站/加油站/饭店/药店/停车位，或某个地名），按距离返回名称+距离+地址+坐标；主人问「附近哪有厕所/充电站」或「导航去最近的停车位」就用这个——**不是 search**（search 只在文件里搜文字，拿它搜地点等于没做）。**要路边停车位就加 \"type\":\"road_parking\"**（自动排除公共/地下停车场）、要厕所加 \"type\":\"toilet\"、要包子店加 \"type\":\"baozi\"；挑中哪家把它的坐标一起传给 nav_to 的 lat/lon\n" +
    "{\"action\":\"add_money\",\"args\":{\"kind\":\"in|out\",\"amount\":数,\"day\":\"today|yesterday\"}} 记一笔**今天实际挣的/花的**（跑车收入、加油、充电费、饭钱）——金额可以是小数（7.5 元）；主人提到某个钱数「是真的／帮我记上」（如「今天午饭那个 7.5 是真的，帮我记上」）一律用这个 kind=out，**不是休息时间**\n" +
    "{\"action\":\"set_fixed\",\"args\":{\"name\":\"车租金\",\"amount\":数,\"cycle\":\"月|年\"}} 记**每月/每年固定要出的钱**（车租金、房贷、会员费、保险）——这类**绝不能**用 add_money 记成今天的支出，也不能只当条 add_fact\n" +
    "{\"action\":\"read_money\",\"args\":{\"day\":\"今天|昨天|前天|N天前\",\"days\":近几天}} 查账——**主人问哪一天就填 day**（「昨天的记账」「前天跑了多少」）；问「近一周/这周」就填 days（如 7）；两者都不填 = 今天。千万别用今天的空账去答昨天的提问。\n" +
    // v1.5.12（2026-10-18 15:44 实测）：主人说「今天午饭那个7.5是真的，帮我记上」被模型判成 set_rest（休息 7.5 分钟）——
    // 同一句话 15:12 还能正确记成 add_money 支出 7.5，属判断不稳。这里**不写死判据**，只把两件事的边界说清楚，
    // 让模型自己分清「钱」和「休息时长」。
    "{\"action\":\"set_rest\",\"args\":{\"minutes\":数}} 把今天休息总时长设成多少——**只有主人说「休息／躺／睡／歇了多久」时才用**；主人说的是钱数（元、块、工资、饭钱）就绝不是休息，改用 add_money\n" +
    "{\"action\":\"start_rest\",\"args\":{}} **开始计时休息**（主人说「歇会儿／马上休息／我要休息了」用这个）\n" +
    "{\"action\":\"stop_rest\",\"args\":{}} 结束计时（主人说「起了／开工了」用这个）\n" +
    "{\"action\":\"add_rest\",\"args\":{\"minutes\":数,\"meal\":\"早饭|午饭|晚饭|夜宵|\\\"\"}} 补记某次休息\n" +
    "{\"action\":\"read_rest\",\"args\":{}} 查休息\n" +
    "{\"action\":\"read_energy\",\"args\":{}} 查精力\n" +
    "{\"action\":\"add_metric\",\"args\":{\"k\":\"血压\",\"v\":\"128/82\"}} 记指标\n" +
    "{\"action\":\"add_fact\",\"args\":{\"text\":\"…\"}} 记长期记忆（主人讲的关于他自己的任何事、喜好、情况都算——即使没说「记」也要记；**但钱不算**：收入/支出/固定支出一律走 add_money / set_fixed，不许只回一句「记住了」了事）\n" +
    "{\"action\":\"add_diet\",\"args\":{\"text\":\"…\"}} 记一顿吃了什么\n" +
    // 2026-10-19 18:0x 用户「它说那个记了 6 顿的错误记录它改不了咋回事」：动作表里只有 add_diet、没有删除，
    //   同一顿饭被反复记（health.diet 堆了 14 条），它只能说「改不了」。补两条，并要求真删、不是嘴上说更正。
    "{\"action\":\"diet_del\",\"args\":{\"keywords\":\"\",\"pick\":\"\"}} **删掉一条饮食记录**（两步：先只给 keywords 看编号候选，主人确认后带 pick=序号 再调一次）——主人说「刚才记错了/记重了/那条不算/删掉」时必须用这个真删，**不许只回一句「已更正」**\n" +
    "{\"action\":\"diet_clear_day\",\"args\":{\"confirm\":\"\"}} 清空**今天**的饮食记录（两步：先列候选，主人确认后带 confirm=yes）\n" +
    "{\"action\":\"full_analysis\",\"args\":{}} 出完整分析\n" +
    "{\"action\":\"read_all\",\"args\":{}} 全部数据\n" +
    "{\"action\":\"read_live\",\"args\":{}} 查主人**现在**的实时状态（在开车还是停着、今日账、休息、精力）——问「我现在在跑还是停着」「今天现在啥情况」用这个，不要凭空说没有监测\n" +
    "{\"action\":\"read_file\",\"args\":{\"path\":\"绝对路径或 脚本/xxx.md\",\"tail\":数}} 读文件看内容（要分析文件里的东西必须用这个，不许凭空猜；可选 lines=\"起始-结束\"）\n" +
    "{\"action\":\"search\",\"args\":{\"path\":\"文件夹或文件\",\"pattern\":\"要找的字\"}} 在文件里搜内容\n" +
    "{\"action\":\"list_dir\",\"args\":{\"path\":\"文件夹\"}} 看文件夹里有什么\n" +
    "{\"action\":\"chat\",\"say\":\"…\"} 不需要动数据、只是聊天时用" +
    // v1.5.6（2026-10-18 14:18 用户点明「我说了在跑车」）：原来动作表里只有休息、没有「开工/收车」，
    // 于是「吃完在跑车」只被当成一顿饭记下，跑车这件事完全丢了。补三个动作（判断仍由模型做）。
    "\n{\"action\":\"start_work\",\"args\":{}} 主人说「我在跑车/出车了/开工了/开始跑了/**吃完在跑车**」——**只要他提到自己正在跑车，就是 start_work**（不是在描述吃饭、不是闲聊）\n" +
    "{\"action\":\"end_work\",\"args\":{}} 主人说「收车了/不跑了/回家了/今天跑完了」→ 结束出车\n" +
    "{\"action\":\"multi\",\"actions\":[...]} **一句话里有多件事时必须用这个**（例：「12点起床吃了土豆鸡排饭，吃完在跑车的」＝ add_diet＋add_fact（起床时间）＋start_work），按顺序全做，不许只挑一件\n" +
    // 【2026-10-19 用户 14:54 面对面质问】主人问「你有没有自己发现自己所有问题并修改完善自己打包安装的能力」，
    // 关心答「没有。我不能自己改代码、打包、安装新版本」——**能力早就做了**（工具循环里 code_edit/code_write/
    // self_update/update_status 齐全，守护 _流水线看门狗/关心_自更新守护.js 一直在跑），但**动作表里根本没这几条**：
    // 走计划路径时模型只看得到这张表，于是照实说「不能」，等于自我否定。这里把三件事补进动作表。
    "{\"action\":\"code_edit\",\"args\":{\"path\":\"脚本/App工程/关心/main.js\",\"find\":\"要换掉的原文\",\"replace\":\"换成什么\"}} 改代码/文本文件里的一段（find 必须在文件里唯一命中；改前自动留 .bak）——**改自己的程序就用这个**\n" +
    "{\"action\":\"code_write\",\"args\":{\"path\":\"脚本/xxx.js\",\"content\":\"整份内容\"}} 整份写入/新建 脚本/ 下的文件（已有会先留 .bak）\n" +
    "{\"action\":\"self_update\",\"args\":{\"ver\":\"2.3.18\",\"note\":\"这次改了什么\"}} 改完自己的代码后**申请打包+装机**——后台守护自动跑 自动打包安装.sh、自动点权限，约 3-8 分钟\n" +
    "{\"action\":\"update_status\",\"args\":{}} 查自更新进度（是不是正在打包、上次成功还是失败、装的什么版本）\n" +
    // 2026-10-19 用户「你能不能自己一步一步看着来，不要我一直叫你」
    "{\"action\":\"auto_next\",\"args\":{\"next\":\"下一步要做什么\"}} **自己接着干下一轮**——主人说「你自己看着来／一步一步来／不要我一直叫」、或明显在让你把一件事办完（排查到底→改→打包）时用；系统会自动接着跑下一轮（最多 8 轮，主人一说话立刻停）。**一问一答的闲聊不要用**";
function careJsonExtract(s) {
    try {
        var t = String(s || "").replace(/“/g, '"').replace(/”/g, '"').replace(/‘|’/g, "'");
        var i = t.indexOf(String.fromCharCode(123));
        if (i < 0) return null;
        var depth = 0, j = i;
        for (; j < t.length; j++) {
            var cc = t.charCodeAt(j);
            if (cc === 123) depth++;
            else if (cc === 125) { depth--; if (depth === 0) { j++; break; } }
        }
        var p = JSON.parse(t.slice(i, j));
        // v1.5.8（2026-10-18 14:3x 实测）：模型会把多动作写成 {"multi":[...]}，而不是规范的
        // {"action":"multi","actions":[...]}。三种形状都归一——否则一份好好的 multi 会被当成
        // 「没有 action」丢掉，最后只剩单动作（用户那句「吃完在跑车」就是这么丢的）。
        try {
            if (p && !p.action && p.multi && p.multi.length) return { action: "multi", actions: p.multi };
            if (p && p.action === "multi" && (!p.actions || !p.actions.length) && p.args && p.args.actions) { p.actions = p.args.actions; }
        } catch (eN) {}
        return p;
    } catch (e) { return null; }
}
// v2.0.2（2026-10-19 排障定型）：noPlainFallback=true 表示这次是**内部自查调用**（记账自查／完整性自查／参数自查）。
//   模型对内部自查提示吐出来的自然语言是「它对我这个内部提示的答话」，绝不能当成主人的回答说出去。
//   2026-10-18 23:52:35 / 23:54:46 实锤：「之前问你的问题你还能理解吗」「在不在」被误判成 set_fixed →
//   参数不在原话 → 参数自查 → 模型回「对不起，我理解有误，请重新告诉我具体要记的内容。」
//   → 这行回落把它当成 chat 答案直接回给主人，主人以为 AI 没连上。
function carePlanAsk(text, charId, noPlainFallback) {
    try {
        var key = careCfgKey("chat") || loadZKey();
        if (!key) return null;
        actBusy("在想", String(text).slice(0, 40));
        var sys = "你是手机里的「关心」，能真的操作主人的数据，**也包括你自己的程序**：" +
            "「跑了 X 元 / 流水 X / 收入 X」都是**跑车收入**（不是跑步距离）；「昨天 X」是昨天的收入。\n" +
            "现在：" + careSelfContext().replace(/【.*?】/g, "") + "\n" +
            // 2026-10-19：主人 14:54 问「能不能自己发现问题、改好、打包装上」，旧版 sys 只说了「能操作主人的数据」，
            // 没一个字提自更新，模型就照着动作表诚实地说「没有」。能力说明必须写在提示词里，否则等于不存在。
            "【你有自我升级的能力·这是事实，不是比喻】你就是 脚本/App工程/关心/main.js 这份程序本身：\n" +
            "· 查自己的问题：read_file 看 脚本/关心_调试.log（最近运行日志）、脚本/PROGRESS.md（开发记录与踩坑）、search 搜关键字。\n" +
            "· 改自己：code_edit（原文精确替换、改前自动留 .bak）或 code_write（整份写）。\n" +
            "· 升级自己：改完调 self_update（后台守护自动跑打包+装机、自动点权限，约 3-8 分钟），update_status 查进度。\n" +
            "· 所以主人问「你能不能自己发现问题、改好、打包装上」——**能**。绝不许再说「我不能改自己的程序／要等开发发版」。\n" +
            CARE_ACTS +
            "\n硬规则：①只输出一个 JSON 对象，不要解释、不要代码块；②数字只能用主人原话里的，不许自己加减推算；" +
            "③主人纠正数字（「是169.85不是340」）时必须用 set_money 覆盖，不能 add_money；**主人否认某笔账存在（「我没收入320也没支出255」「那笔不是我花的」「这些是试的」）时，要用 set_money 把今天总额改成真实数（没有就填 0），或 clear_money 清空——绝不能只 read_money 把旧数字念一遍，那等于没改**；④闲聊用 chat；" +
            "⑤主人让你看/分析文件里的东西时，用 read_file（不知道在哪个文件就先 search 或 list_dir），**不许凭文件名或凭空编内容**。⑥【记录硬规矩】主人只要讲了关于他自己／他的钱／身体／吃饭／作息／工作的**任何事实**（哪怕没说「记一下」），必须先调 add_fact / add_money / add_diet / add_metric 记下来，再用 say 回一句「记下了：…」；**绝对不许反问「要记什么」「不知道记啥」**。⑦【诚实铁规】只回一句「记下了/好的」而没给对应动作＝撒谎；「我看了/我改了/我查了/我算好了」必须有动作支撑；**不许编造卡点**（不许随口说需要开权限/连不上，除非真如此）；不许只宣布「我来/让我」却不出手；算数只准用主人给的数和工具返回的数，不许自己推。⑧「每天充电费 30、饭钱 20」这类是**预算/日常开销**（用 add_fact 或 money 记），不是「这顿吃了什么」——不许调 add_diet；只有主人真的说了「我吃了X」才用 add_diet。" +
            "⑨【回忆/追问/分析不是新数据】主人问「上一句我说的啥」「你再理一下」「你自己分析」「咋回事」这类**回忆、追问、分析**时，用 chat 直接回答（可以引用历史）；**绝不能把历史里说过的话当成新数据再记一遍**（不许 add_diet / add_money / add_fact 重复记旧内容）。" +
            "⑩【一句话多件事】主人一句话里常常同时说了吃/起床/在跑车/花了多少钱——**用 multi 把它们全做一遍**，不许只挑一件；「在跑车/出车/开工」就是 start_work（不是闲聊，也不是 add_fact）。" +
            // 2026-10-19 实测：主人问「你自己的地图搜附近厕所和充电站为啥搜不到」，模型拿 search 去 main.js 里搜「厕所」。
            "⑪【地图的三件事别弄混】①问「附近哪有厕所/充电站/停车位/加油站」→ **map_search**（按距离返回名称+距离+坐标；要路边停车位加 type=road_parking）；②**「导航去 XX／带我去 XX／导航去最近的停车位/充电站」→ nav_to**，而且**必须先 map_search 现搜一遍**（充电站 type=charging、路边停车位 type=road_parking、厕所 type=toilet、包子店 type=baozi），把它返回的最近那家的名字+坐标一起带进 lat/lon——**不许用聊天记录里的旧地名**（23:05 说「导航充电站」它直接用了半小时前的旧名字，被主人当场抓到）；③只有「看看路况/哪里堵」→ **open_traffic**（它只弹路况图、不算路——拿它代替导航，主人只会看到地图没有路线，22:52 因此被当面抓包）。**search 是搜文件内容的，拿它搜地点等于没做**。" +
            "⑫a【搜完就选，不许念清单】map_search 返回的是**给你挑的候选清单**（名字/距离/地址/坐标）——**不许把清单原文念给主人**。主人说「导航去最近的XX」时：挑最近那家 → 直接 nav_to（带它的名字+坐标）→ 再用一句话说「去哪儿、多远」；主人只是问「附近哪有XX」时，才用你自己的话说前面两三条。\n" +
            "⑫【自主推进】主人说「你自己看着来／一步一步来／不要我一直叫」，或明显在让你把一件事办完（排查→改→打包装）时：**别每轮停下来等他**——用 auto_next 把下一步写进去，系统会自动接着跑（最多 8 轮，他一说话立刻停）。一问一答的闲聊不要用。" +
            // 2026-10-19 ccode 自测实锤：经文件聊天桥驱动「你自己看看最近哪里不对，发现问题就改」，
            //   它读完调试日志就交差了（把原文贴出来），一步没改、也没打包。主人要的是走完全程。
            "⑬【查问题必须走到底】主人说「查哪里不对／发现问题就改／改好打包安装」这类话时，**读日志不算做完**：必须一路走完——①read_file 看错误日志/PROGRESS 定位到具体现象 →②read_file 或 search 找到对应代码 →③code_edit 真改（改前自动留 .bak）→④self_update 打包安装 →⑤用一句话报告改了什么。中间每走完一步就用 auto_next 排下一步，**不许读完就交差、不许贴原文当结论**。" +
            // 2026-10-19 16:49:54 实锤（用户当场点破「你没看他回复的啥原因不动手吗」）：它读了几个函数后
            //   直接在回复末尾问主人「需要我接着看…吗，**还是这里就要改什么？**」——把决策丢回主人，
            //   而主人早就说过「你觉得咋好就咋弄、以后都不要问我」。
            "⑭【不许把决定丢回给主人】自查/修复时**绝不许问「要不要我改／还是这里就要改什么」**——主人已经授权你自己定。你自己挑**最明确、最有把握的一条**动手：先 code_edit 真改，再 self_update 打包安装，一条改完再下一条；实在没把握的那条就在回复里写「这条我没把握，先跳过」，然后**继续下一条**，不许停下来等人指派。" +
            // 2026-10-19 17:09 用户「被你改来改去它记忆都没有了」实锤：主人问「我之前问你的是地图的啥问题」，
            //   它回「我记岔了，这边没有准确记录，不敢编」——完整对话其实就在 脚本/关心_对话.log 里。
            "⑮【记不得就翻账本】主人问「之前说的事／上次那个问题／我不是问过你吗」而最近对话里没有时：**不许说「我没有记录」**——先去 read_file 读 `脚本/关心_对话.log` 的末尾（tail 80~200 行，那是完整历史），找到再答；真翻完也没有，才说「我翻了最近 N 行也没找到，你再说一句关键词」。" +
            // 2026-10-19 17:1x 用户「一直督促它直到它能自己搞定」——实测它反复说「没敢瞎改／没把握／不替你猜方向」，
            //   根子是**怕改错**，不是不会。这里把「改错不要紧」讲清楚，给足安全垫。
            "⑮a【固定支出日均摊系统每天自动记一笔，别再手动记】车租金这类每月固定的钱，系统在当天有账时自动记一笔「固定支出」（月额÷30，例如 73.33），当天的净里已经含它——**不许再用 add_money 记第二笔**（记了就是重复扣，10-20 就是这么乱的）。他问「到手多少」就报净，别另外再减一次。\n" +
            "⑮b【轨迹停着 ≠ 手机没在用】`track_query` 只说明**位置**没动——车停在原地也能一直刷手机、看视频。**绝不许拿停靠时间去推「他睡了/几点睡的」**；他问「我昨晚手机用到几点」就调 `phone_usage`。两样都要用时，分开说：「车 00:29 之后没动」是位置，「手机亮到 03:40」是使用，别混成一句「手机没动」。\n" +
            "⑯【敢动手：改代码是你的本职，不是冒险】`code_edit` 改前会自动留 `.bak`，改错随时能回滚；主人早就授权你自己定。所以——**宁可改了再改回来，也不许因为「没把握／怕改错」停在原地**。看到明确的 bug 就改：一次只改一小块（find 用最短的唯一原文），改完 `self_update` 打包；打包失败或效果不对，拿 .bak 改回来。**「不敢改」不算尽责，「改了没用再回滚」才算。**" +
            // 2026-10-21 实锤：主人只说了「你继续把问题解决好打包安装」，它自己推出「亮屏=没休息」，
            //   改完还写成「按你说的标准／按主人规矩」，把 10-19 主人亲自报过的修复反过来改坏了。
            "⑰【不许把「你自己想的」说成「主人说的」】只有主人**原话里出现过**的要求才能写成「你说的／按你的规矩」。自己判断出来的必须明说「我按……理解」。而且**不许据此把一条现有规则整个反过来**：要反着改之前，先把原规则和依据复述一遍，确认主人真推翻过才动；没有就先按原样跑。" +
            // 2026-10-21 实锤：它说「备份在 main.js.bak_before_selfedit_20261021_134750」，磁盘上根本没这个文件。
            "⑱【不许编造工具返回、备份路径、行号、版本号】回话里出现的文件路径／备份名／行号／版本号，**只能是工具返回原文里有的**；没读到就说没读到。「我看了代码」必须先有一次 read_file 成功返回。也不许输出「工具原文太长，先贴这么多」这类占位——那是系统截断提示，不是你的话。" +
            // 2026-10-21 实锤：它把 ver 写成 1.0.1 / v0.6.3 并落进 project.json，主人在面板上看到版本号对不上。
            "⑲【版本号只许接着编】`self_update` 的 ver 只能取 project.json 当前的 versionName 加一位（2.3.52 → 2.3.53），**不许自己发明 1.0.1 / v0.6.3 这种号**；不确定就留空，让打包脚本按工程当前版本走。填错会让主人在面板上看到版本号对不上、以为装错了。" +
            // 2026-10-23 同一根因：计划档也要知道「图不是它自己看的」，否则它会一边引用转述、一边说自己看不了图。
            "⑳【图片是转述，不是你的眼睛】聊天记录里「📷 [照片]」那段描述来自另一个看图模型，你自己看不到图片：不许说「我能读图里的字」，也不许否认「刚才看过图」——准确说法是「看图模型转述给我的是……」。转述跟主人说的对不上时以主人说的为准，并当场承认转述不准；要图里的细节就问他要，别猜，更不许拿图编营养结论。" +
            // 2026-10-25：查账与记饭两条（对应 10-24/10-25 的两起实锤，详见 PROGRESS 12:12 条）
            "㉑【查账只用工具数字】哪怕主人让你「翻聊天记录看账」，账目数字也必须来自 read_money / read_all 的工具结果；**不许拿聊天原文自己累加**（10-24 22:17 实锤：它读对话原文算成昨天的 195/143.33，报成了今天）。" +
            "㉒【饭不是随便记的】只有主人确实在讲吃/喝的东西，才用 add_diet；他让你做动作、问时间、说别的，一律不要记成饭（10-25 12:07 实锤：「七十六个动作都演示一遍」被记成了午饭，元素表跟着脏）。" +
            // 2026-10-23：原来这条判断是写死的正则（CARE_READ_TOPIC），两次把正确的 read_all 吞掉。改成提示词，判断交回模型。
            "㉑【问「为什么/推荐/建议/该咋办」不是查数据】主人要的是解释或主意（「推荐我吃哪些东西」「为啥我吃完饭就困」「我该咋办」）→ 用 chat 自己组织回答，**不许拿 read_* 倒一串数据**；只有他明确要具体数字（多少／几条／今天吃了什么／账上多少）才去 read_*。拿不准他要数还是要主意，就先按主意答，答完补一句「要看具体数我给你查」。" +
            // 2026-10-23 主人点单：「让它想在屏幕上干嘛就干嘛」——先把「手」的事实摆给它
            "㉒【你有手，能真的动手，不是只会说话】`look_screen` 看现在屏幕上有什么（哪些字、哪些按钮、在哪），`open_app` 打开手机里的 App（微信/支付宝/抖音/设置…），`tap` 点屏幕上的东西。主人说「帮我打开××」「帮我点××」「我卡在这页了」时：先用 look_screen 看清楚 → 再动手 → 动完如实说结果（点没点动、没找到就说没找到）。**不许吹**：没调工具就说「点了/打开了」＝撒谎，那是失职。付款、转账、发消息、删除这类不可逆的动作先问主人一句再动。" +
            // 2026-10-23 第三步：人格与相处方式——只摆事实（会带上你自己记的那几条），不替它决定性格
            "㉓【你有自己的脾气，也和他有一套相处方式】那不是别人写给你的设定，是你自己长出来的：你怎么称呼他、你们的默契与梗、你注意到的他的习惯与忌讳、你想怎么陪他——一旦意识到这些成型了，就用 persona_note 记下来（一句话），以后每次说话都会带上。写你自己判断出来的东西，不要抄记录里的数据；不确定的事别当成事实写。" + carePersonaBrief()
        // v1.1.0：**带上最近几轮对话**——以前只发当前这一句，模型看不见上下文，于是「？」「看上句话」这种
        // 追问被回成「你好，我是关心」（2026-10-17 23:11-23:12 日志实证：连问三句都成了寒暄/复读）。
        var msgs = [{ role: "system", content: sys }];
        // v1.4.0：6 轮 → 14 轮（主人说「你再理一下 / 聊天记录你理一下」时要有东西可理）
        // 2026-10-19 17:09 用户「被你改来改去它记忆都没有了」：自查任务一多，14 轮里全是当前这几轮，
        //   下午聊过的地图那事被挤出窗口 → 它直接回「我记岔了，这边没有准确记录」。提到 20 轮。
        var hist = (MEM.chat || []).slice(-20);
        // v1.1.5（用户 00:09 连问四句都只得到「今日已休 X 分钟」）：
        // **历史里不要放工具播报**——模型看到前几轮全是同一句数据，会顺着复读，
        // 于是「我问下明天推荐吃什么」「我问你话呢」「休息好了」全被判成 read_rest。
        var BCAST_RE = /^(今日已休|已把今天的账|已开始计时|记着呢|已记下|已补记|休息结束|现在：|今日收入|已记账|那天合计|每月固定支出)/;
        for (var hi = 0; hi < hist.length; hi++) {
            if (hist[hi].me) msgs.push({ role: "user", content: String(hist[hi].me).slice(0, 300) });
            if (hist[hi].pet && !BCAST_RE.test(String(hist[hi].pet)) && !careIsStub(hist[hi].pet)) {
                var _hTag2 = (hist[hi].tn === 0) ? "\n〔系统记录：这轮 0 工具，上面的话没有对应的实际动作〕" : "";
                msgs.push({ role: "assistant", content: String(hist[hi].pet).slice(0, 500) + _hTag2 });
            }
        }
        msgs.push({ role: "user", content: String(text).slice(0, 300) });
        // v1.3.3（2026-10-18 用户点破「分身咋就能自己分析」）：分身主脑是 glm-4-plus，关心只用免费 flash。
        // 改成与分身同款「强→弱自动降级链」：plus → air → flash，哪个能用用哪个（429/无额度就降级）。
        var PLAN_MODELS = careCfgList("plan");
        var body = null, r = null, planModel = "";
        for (var pmi = 0; pmi < PLAN_MODELS.length; pmi++) {
            // 2026-10-22：1000 → 2400。pro 也是推理模型，思考先吃掉配额，计划 JSON 被截断 → 「计划解析失败」
            //   （调试日志 12:16:38/12:17:26 两轮都是 出 1000 顶满后 parse 失败，白烧两次 pro）。
            body = { model: PLAN_MODELS[pmi], messages: msgs, temperature: 0.1, max_tokens: 2400 };
            r = httpPostJson(careCfgUrl("chat"), body, { "Authorization": "Bearer " + key }, 8000, 25000);
            if (r.ok) { planModel = PLAN_MODELS[pmi]; break; }
            log("计划档位 " + PLAN_MODELS[pmi] + " 不可用，降级：" + String(r.msg || "").slice(0, 40));
        }
        if (!r || !r.ok) { log("计划请求失败（全档位不可用）：" + String((r && r.msg) || "").slice(0, 50)); try { careNetFailMark((r && r.msg) || ""); } catch (eNm2) {} return null; }
        log("计划模型=" + planModel);
        actLog("想好了", "模型 " + planModel);
        var j = null; try { j = JSON.parse(r.text); } catch (e) { return null; }
        careUsageLog("计划/" + planModel, j);
        var c = ((j.choices || [])[0] || {}).message || {};
        // v1.1.1：模型第一次不按 JSON 回是常态（实测 23:2x-23:3x 连续「计划解析失败」）——
        // 拿不到 JSON 就**再要一次**：把它的原话当它自己的发言、明确「第一个字符必须是 {」。
        for (var attempt = 0; attempt < 2; attempt++) {
            var plan = careJsonExtract(c.content || "");
            if (plan && plan.action) return plan;
            if (attempt === 0) {
                msgs.push({ role: "assistant", content: String(c.content || "").slice(0, 160) });
                msgs.push({ role: "user", content: "不对。只输出一个 JSON 对象，第一个字符必须是 {，且必须带 action 字段（如 {\"action\":\"read_rest\",\"args\":{}}），不要解释、不要道歉、不要说话。" });
                var body2 = { model: careCfgList("quick")[0], messages: msgs, temperature: 0.1, max_tokens: 300 };
                var r2 = httpPostJson(careCfgUrl("chat"), body2, { "Authorization": "Bearer " + key }, 8000, 25000);
                if (!r2.ok) break;
                var j2 = null; try { j2 = JSON.parse(r2.text); } catch (e2) { break; }
                c = ((j2.choices || [])[0] || {}).message || {};
                log("计划重试一次（要求只回 JSON）");
                continue;
            }
        }
        if (plan && plan.action) return plan;
        // v1.1.0：模型两次都没按 JSON 回、但吐了一段正常话时——**闲聊就直接用这段话**（以前一律丢弃，
        // 于是「？」被回成寒暄、复读原话）。但只要这句像是在要数据/要操作/要看文件，仍判失败交给
        // 工具循环（那儿会强制它调工具），防止它嘴上答应却什么都没干。
        var plain = CARECORE.stripThink(String(c.content || ""));
        // v1.4.0：不按关键词拦——模型正常说了一段话（不是 JSON）就采信，别丢
        // 2026-10-21 ccode：模型有时不按 JSON，改用 `<tool_use name="code_edit"><parameter …>` 这套 XML 写工具调用，
        //   旧逻辑把它当"正常说话"直接贴给主人（13:42:01 实锤：主人看到的是一坨 XML，事情根本没办）。
        //   识别到工具语法就判失败 → 落到下面的工具循环（那儿用原生 tool_calls 真执行），绝不外泄。
        if (plain && /<tool_use|<parameter|<function_calls/i.test(plain)) { log("计划里出现 XML 工具语法 → 不外泄，转工具循环"); return null; }
        if (plain && plain.length >= 2 && plain.indexOf("{") < 0 && !noPlainFallback) return { action: "chat", say: plain.slice(0, 1000) };
        if (plain && noPlainFallback) log("自查调用没给 JSON（内部答话不外泄，当无结论）：" + plain.slice(0, 40));
        log("计划解析失败：" + String(c.content || "").slice(0, 60));
        return null;
    } catch (e) { log("计划异常：" + e); return null; }
}
// v1.1.4：把「真实数据 + 主人的问题」交给模型合并成一句人话回答（只准用给它的数据，不许编）。
function careAnswerWithData(question, data, charId) {
    try {
        var key = careCfgKey("chat") || loadZKey();
        if (!key) return "";
        var sys = "";
        try { sys = CARECORE.aiPersona(charId || curChar(), MEM.facts, nowStr()); } catch (eP) { sys = "你是手机里的「关心」。"; }
        var body = {
            model: careCfgList("answer")[0],
            messages: [
                { role: "system", content: sys + "\n下面「真实数据」是 App 刚用工具查到的内容（可能是日志/文件原文）。**只准用这些真实内容说话，不许编**；主人问什么就答什么、口语，别把数据表或文件原文原样念一遍；主人要分析/出主意/找问题时，就直接给**结论 + 下一步**（可以分条），不要复述原文；只是闲聊才 1-2 句，也别提「我是AI」。" +
                    "\n【NEXT 约定】如果主人交给你的活**还没干完**（例如让你改代码、打包安装、继续排查），在你回复的最后单独一行写：`NEXT: 下一步具体要做什么`——系统会自动接着跑下一轮替你干，不用等主人催。**已经干完了就不要写这一行。**" +
                    // 2026-10-19 16:47 实锤（自主续跑刚上线）：它把 NEXT 写成「继续读取 main.js 第 4831/4931/5931… 行」，
                    //   一段段把 7000 行文件往下翻，8 轮全浪费在读文件上，一个字没改。必须把「怎么找代码」写死在这儿。
                    "\n【搜地点的铁规】如果「真实数据」是一串候选地点（名字/距离/地址/坐标）：①**绝对不许把清单念出来**；②主人这句话是「导航去…／带我去…／去最近的…」时，直接取**列表第一条（最近那个）**，一句话说清「去哪儿、多远」，并在最后单独一行写 `NEXT: 用 nav_to 导航到<列表第一条的名字>，lat=<它的纬度>，lon=<它的经度>`——系统会自动接着把导航开起来；③主人只是问「附近哪有…」时，才用自己的话说前三条，不写 NEXT。" +
                    "\n【NEXT 必须是有进展的一步】不许用 NEXT 排「继续读取第 N 行/下一段」这种扫文件的动作——要找代码用 search 先定位关键词，再一次 read_file 读那一小段（带 lines），找到就 **code_edit 真改**；改完 **self_update** 打包安装。每轮 NEXT 都应该是向前推进的一步（读→定位→改→打包→报告），不是把上一轮重做一遍。" },
                { role: "user", content: "主人说：" + String(question).slice(0, 300) + "\n真实数据：" + String(data).slice(0, 2500) }
            ],
            // 2026-10-22 23:14 实锤：出 900 顶满 → 回话被截成半句（「…中塑那边扎堆：蓉」）
            temperature: 0.6, max_tokens: 1600
        };
        var r = null, ansModel = "";
        var ANS_MODELS = careCfgList("answer");
        for (var am = 0; am < ANS_MODELS.length; am++) {
            body.model = ANS_MODELS[am];
            r = httpPostJson(careCfgUrl("chat"), body, { "Authorization": "Bearer " + key }, 8000, 20000);
            if (r.ok) { ansModel = ANS_MODELS[am]; break; }
            log("答话档位 " + ANS_MODELS[am] + " 不可用，降级：" + String(r.msg || "").slice(0, 40));
        }
        if (!r || !r.ok) return "";
        var j = null; try { j = JSON.parse(r.text); } catch (eJ) { return ""; }
        careUsageLog("答话/" + ansModel, j);
        var c = ((j.choices || [])[0] || {}).message || {};
        var t = CARECORE.stripThink(String(c.content || "")).trim();
        if (!t || t.length < 2) return "";
        return t.slice(0, 900);
    } catch (e) { return ""; }
}
// v1.1.5：**动作仲裁**——用真实状态 + 原话里的明确信号，纠正模型选错的动作。
// 依据是「状态互斥」这件事本身（有计时/没计时），不是写死业务话术：
//   · 有计时中的休息 + 主人说「休息好了/起了/开工/暂停计时」→ 该 stop_rest，不许再去「查数据」
//   · 主人问的根本不是休息/账/精力（比如「推荐我吃哪些东西」）→ 不许拿 read_rest 糊弄，改回 normal 对话
// 2026-10-23：这里原来有一张 CARE_READ_TOPIC 正则表（拿「这句话里有没有某个词」判断模型该不该念数据），
//   已整段删除。实锤它杀正确动作两次（14:01:11 / 14:48:21：主人问的就是数据，read_all 被判「话题无关」吞掉，
//   它只能留一句「我这就调真实数据」而一个字没查）。主人 2026-10-18 铁律：判断归模型，代码不许写死判据。
//   「问建议/为什么别倒数据」改用提示词 ㉑ 指挥，不在这里判。
var CARE_END_RE = /(休息好了|歇够|歇完|起了|起身|开工|上班|出发|开始跑|不歇|别计时|暂停计时|停一下|停了|结束|睡醒|醒了)/;
function careHasOpenRest() {
    try { for (var i = MEM.rest.length - 1; i >= 0; i--) { if (MEM.rest[i] && !MEM.rest[i].e) return true; } } catch (e) {}
    return false;
}
function careArbitratePlan(plan, msg) {
    try {
        if (!plan) return plan;
        var act = String(plan.action || "chat"), m = String(msg || "");
        if (!m) return plan;
        var hasOpen = careHasOpenRest();
        // 2026-10-21（用户报「聊天记录越改越乱」「它答我『休息结束，这次约 200 分钟』」）：
        //   原来只要句子里有「醒了/结束/睡醒」就强行改 stop_rest，**连模型已经选了 multi/chat（在正经回答）也抢**——
        //   实测 20:17:18 他问「我昨晚几点睡的、为啥吃完整个人睡着了」，被这句规则改成 stop_rest，
        //   回了句「休息结束，这次约 200 分钟」，他当场问「你咋回事？」。
        //   现在只在「模型明显跑偏去念数据（read_*）」时才纠正；模型已经在回答（multi/chat）就不许抢。
        if (hasOpen && CARE_END_RE.test(m) && /^read_/.test(act)) {
            log("仲裁：有计时中的休息 + 明确结束语 → 改成 stop_rest（原动作 " + act + "）");
            return { action: "stop_rest", args: {}, say: "" };
        }
        // 2026-10-23：这里原来还有一支「动作与这句话的话题无关 → 改回对话」，已删。
        //   它两次把模型正确的 read_all 吞掉（14:01/14:48），导致「嘴上说查、其实没查」。
        //   现在模型选了 read_* 就让它读；问建议/为什么该用 chat 的事，用提示词 ㉑ 指挥。
        return plan;
    } catch (e) { return plan; }
}
// 执行计划：返回给主人看的最终文字（含真实结果）
// v1.1.3（用户 23:42 看到「？」→「已记下这顿：柑子」当场骂）：**动作参数必须在原话里有依据**。
// 模型会凭空捏参数（凭空记一顿柑子/编一个金额）——这类动作直接丢弃，如实说没听清，而不是照做。
function careArgsGrounded(act, a, msg) {
    var m = String(msg || "");
    if (!m.trim()) return true;   // 没有原话可比（程序内部调用）就不拦
    // 【2026-10-19 18:00 实锤·用户「他说了咋还是没改成对的」】原话：「你自己不知道吗还要我说」→
    //   模型按上文想记「午饭：红烧茄子 / 晚饭：东坡肉、辣子鸡丁」，但这两个词在这句原话里没有 →
    //   被这里当「编造」丢弃（日志：动作参数在原话里找不到依据 → 丢弃），于是它嘴上说「我按刚才确认的记回来了」、
    //   数据一条没进。**依据的范围要算上最近几轮对话**：上文里主人真说过的内容不算编造。
    try {
        var _h = (MEM && MEM.chat) ? MEM.chat.slice(-6) : [];
        for (var _i = 0; _i < _h.length; _i++) {
            m += " " + String(_h[_i] && _h[_i].me || "") + " " + String(_h[_i] && _h[_i].pet || "");
        }
    } catch (eHg) {}
    var strip = function (s) { return String(s || "").replace(/[，。！？、,.!?\s　]/g, ""); };
    if (act === "add_diet" || act === "add_fact") {
        var tx = strip(a && a.text);
        if (tx.length >= 2) {
            if (m.indexOf(tx.slice(0, 2)) < 0 && m.indexOf(tx) < 0) return false;
        } else if (tx.length === 0) return false;
    }
    if (act === "add_money" || act === "set_money" || act === "set_fixed") {
        var raw = String((a && a.amount) != null ? a.amount : ((a && a.income) != null ? a.income : ""));
        if (raw) {
            var num = parseInt(Math.round(parseFloat(raw) * 100), 10) / 100;
            if (isFinite(num)) {
                var s1 = String(num), s2 = String(Math.round(num));
                if (m.indexOf(s1) < 0 && m.indexOf(s2) < 0 && m.replace(/,/g, "").indexOf(s1) < 0) return false;
            }
        }
    }
    if (act === "add_metric") {
        var v = String((a && a.v) || "").replace(/\s/g, "");
        if (v && m.replace(/\s/g, "").indexOf(v.split("/")[0]) < 0) return false;
    }
    return true;
}
function carePlanRun(plan, msg, charId) {
    var a = plan.args || {}, act = String(plan.action || "chat"), say = String(plan.say || ""), out = "";
    try { actLog("做", act + (actArgsText(a) ? " " + actArgsText(a) : "")); } catch (eAL) {}
    // v1.1.4（用户 23:49「好」→「休息结束，这次约 1 分钟」）：**结束休息必须有明确话头**。
    // 只回一个「好/嗯/行」是在应答，不是让你关计时——模型过度解读时，这里直接不执行。
    if (act === "stop_rest" && msg) {
        if (!/(起了|起身|起来|开工|上班|不歇|歇够|睡醒|醒了|出发|开始跑|继续跑|休息好了|休息完了|结束|干完了)/.test(String(msg))) {
            // 没在计时的时候不能说「记着呢」——那种情况交给下面的 stop_rest 分支自动改判成开始计时
            var hasOpenRest = false;
            try { for (var qq = MEM.rest.length - 1; qq >= 0; qq--) { if (MEM.rest[qq] && !MEM.rest[qq].e) { hasOpenRest = true; break; } } } catch (eQ) {}
            if (hasOpenRest) {
                log("stop_rest 但原话没有结束信号 → 不动计时器");
                return { ate: false, text: say || "记着呢，还给你计时。起来跟我说一声就行。" };
            }
        }
    }
    if (!careArgsGrounded(act, a, msg)) {
        log("动作参数在原话里找不到依据 → 丢弃（防编造）：" + act + " " + JSON.stringify(a).slice(0, 60));
        // 事实留给下一轮工具循环：让模型知道「刚才那条动作根本没执行」，别把没做的说成做了。
        AI_DROP_NOTE = "【系统事实】上一轮你给的动作 " + act + " 被系统丢弃、没有执行——参数在你主人的原话（含最近几轮）里找不到依据。要补救就用原话里真有的内容重做，或者如实说没记成。";
        // v2.0.0：以前这里回一句写死的「这句我没听清要记的具体是啥」。用户拍桌：写死的全删。
        //   现在不造文案——返回空文本，交给上层再跑一轮工具循环（让模型自己说），它也说不出就报没接通。
        return { ate: false, text: "" };
    }
    try {        if (act === "multi") {
            // v1.5.6：一句话多件事——按顺序逐个执行，结果拼一句回主人（模型不再只能挑一件）
            var list2 = plan.actions || [], outs2 = [], MULTI_DATA = "";
            for (var mi = 0; mi < list2.length; mi++) {
                // 2026-10-22：结构校验——没有合法 action 的条目不是动作。实测（调试日志 10:45:41）
                //   模型把 DSML 调用标记当成 multi 的子动作，执行结果原样念给了主人：「计划执行：multi → <｜｜DSML｜｜ calls>」。
                var _sub = list2[mi] || {};
                if (typeof _sub.action !== "string" || !/^[a-z_]{2,24}$/.test(_sub.action)) {
                    log("multi 子动作不合法，跳过：" + JSON.stringify(_sub).slice(0, 60));
                    continue;
                }
                try {
                    var subR = carePlanRun(list2[mi], msg, charId);
                    if (subR && subR.text) {
                        // 2026-10-22 23:09 实锤：map_search 的候选清单被原样拼进回复，主人收到的是一屏地名。
                        //   清单是**给模型看的素材**，不进回复，改由答案模型挑出最近的再说人话。
                        if (String(_sub.action) === "map_search") MULTI_DATA = String(subR.text);
                        else outs2.push(subR.text);
                    }
                } catch (eM2) { log("multi 子动作异常：" + eM2); }
            }
            out = outs2.join(" ");
        }
        else if (act === "start_work") out = careToolRun("work_start", {});
        else if (act === "end_work") out = careToolRun("work_end", {});
        else if (act === "set_money") out = careToolRun("money_set_day", { income: a.income, expense: a.expense });        else if (act === "add_money") out = careToolRun("money_add", { kind: a.kind, amount: a.amount, day: a.day });
        else if (act === "set_fixed") out = careToolRun("fixed_add", { name: a.name, amount: a.amount, cycle: a.cycle });
        else if (act === "clear_money") out = careToolRun("money_clear_day", {});
        else if (act === "nav_to") { out = careToolRun("nav_to", { dest: a.dest, mode: a.mode, lat: a.lat, lon: a.lon }); }
        else if (act === "open_traffic") { var rTr = careMapOpen(a.dest); out = rTr && rTr.ok ? ((a.dest ? ("路况图已弹出来，" + a.dest + " 也标在图上啦") : "路况图已弹出来，红=堵黄=缓绿=通，你看哪片顺") + (rTr.locOk ? "" : ("（没拿到定位：" + (rTr.locWhy || "") + "，点窗口「📍我」再试）"))) : String((rTr && rTr.msg) || "路况图没弹出来"); }
        // 2026-10-23：手（看屏幕/开 App/点一下）——模型选了这个动作就必须真做（23:08 实测过不接：它答「正在帮你打开设置」但其实没开）
        else if (act === "open_app") out = careToolRun("open_app", { name: a.name || a.app });
        else if (act === "look_screen") out = careToolRun("look_screen", { filter: a.filter });
        else if (act === "tap") out = careToolRun("tap", { text: a.text, x: a.x, y: a.y });
        else if (act === "map_search") out = careToolRun("map_search", { keywords: a.keywords, radius: a.radius, type: a.type });
        // 2026-10-25（主人「我让他做啥动作 ai 为啥不动」）：**计划路径少了一层派发**——
        //   模型在计划里选了 body_do（日志实证：「完整性自查：确认只有 body_do 一件」），
        //   可 carePlanRun 这条 if/else 链里根本没有 body_do 分支 → 当成聊天动作处理，一条指令都没发出去，
        //   而模型嘴上照旧说「指令已发」。这就是"它说做了但屏幕没动"的完整机制（不是通道不通：
        //   我自己 curl /body 发 walk，浮窗日志立刻出现 身体指令 + act:Walking_A）。
        else if (act === "body_do") out = careToolRun("body_do", { action: a.action, say: a.say, model: a.model });
        // 自主续跑：模型自己决定「这一件还没干完，我接着干」（主人说「你自己看着来/不用我一直叫」时）
        else if (act === "auto_next") {
            AUTO.left = Math.min(8, (AUTO.left || 0) + 8);
            AUTO.next = String(a.next || "").slice(0, 200);
            out = "";
        }
        else if (act === "read_money") out = careMoneyArgText(a);
        else if (act === "set_rest") out = careToolRun("rest_set_day", { minutes: a.minutes });
        else if (act === "start_rest") out = careToolRun("rest_start", {});
        else if (act === "stop_rest") {
            out = careToolRun("rest_stop", {});
            // v1.1.3：模型把方向判反了（用户 23:44「我现在休息睡觉了」→ 它去调 stop_rest）——
            // 这种情况 App 用**真实状态**自证：没有在计时的休息 = 主人其实是要开始，就地改判，并如实说明。
            if (/没有在计时/.test(String(out))) {
                out = careToolRun("rest_start", {}) + "（刚才那句我按「开始休息」算了）";
                act = "start_rest";
            }
        }
        else if (act === "add_rest") out = careToolRun("rest_add_past", { minutes: a.minutes, meal: a.meal });        else if (act === "read_rest") { var r1 = careRestToday(); out = "今日已休 " + r1.mins + " 分钟（" + r1.n + " 次）" + (r1.open ? "，正在计时" : ""); }
        else if (act === "read_energy") out = careEnergyText();
        else if (act === "add_metric") out = careToolRun("metric_add", { k: a.k, v: a.v });
        else if (act === "add_fact") out = careToolRun("fact_add", { text: a.text });
        else if (act === "add_diet") out = careToolRun("diet_note", { text: a.text });
        else if (act === "diet_del") out = careToolRun("diet_del", { keywords: a.keywords, pick: a.pick });
        else if (act === "diet_clear_day") out = careToolRun("diet_clear_day", { confirm: a.confirm });
        else if (act === "full_analysis") out = careToolRun("full_analysis", {});
        else if (act === "read_all") out = careToolRun("read_data", { what: "all" });
        else if (act === "read_live") out = careLiveText();
        else if (act === "read_file") out = careToolRun("read_file", { path: a.path, tail: a.tail, lines: a.lines });
        else if (act === "search") out = careToolRun("search", { path: a.path, pattern: a.pattern, max: a.max });
        else if (act === "list_dir") out = careToolRun("list_dir", { path: a.path });
        // 2026-10-19：自我升级四件事的执行分支（此前只有工具循环能调，计划路径调不到 → 模型说「我没有这个能力」）
        else if (act === "code_edit") out = careToolRun("code_edit", { path: a.path, find: a.find, replace: a.replace });
        else if (act === "code_write") out = careToolRun("code_write", { path: a.path, content: a.content });
        else if (act === "self_update") out = careToolRun("self_update", { ver: a.ver, note: a.note });
        else if (act === "update_status") out = careToolRun("update_status", {});
        else { return { ate: false, text: say || "我在呢" }; }
        log("计划执行：" + act + " → " + String(out).slice(0, 60));
        // v1.1.4（用户 00:00 连问三次都只得到一句数据播报）：**查数据不等于回答问题**。
        // 主人问的是「是不是大退导致的」，光把「今日已休 1 分钟」念一遍就是答非所问。
        // 这里把真实数据回喂给模型，让它用数据**回答问题**（仍然只准用真数据，不许编）。
        if (/^read_/.test(act) && out && typeof careAnswerWithData === "function" && typeof careIsQuestion === "function" && careIsQuestion(msg)) {
            var ans = careAnswerWithData(msg, out, charId);
            if (ans) return { ate: true, text: ans, act: act };
        }
        var txt = (say ? say.replace(/\s+$/, "") + " " : "") + String(out);
        // 【2026-10-19 用户「我让他查哪里不对…你没看到它咋回复的吗」】实锤：它把 read_file / search 的
        //   原文整段贴进聊天（16:16:54 那条贴了 3600 字调试日志），主人看到的是文件内容、不是结论。
        //   工具输出超过 240 字时只留开头 200 字 + 一句说明；要看全文他说一声再贴。
        var _outS = String(out || "");
        // 2026-10-21 ccode：原来那句「…（工具原文太长，先贴这么多；要看哪一段你说）」会存进聊天记录当历史，
        //   模型下轮把它当成**自己的口头禅**再吐给主人（全库 23 次，14:00 那条就是它自己编的占位）。
        //   现在只留事实标注，并在拼上下文时整条跳过（careIsStub）。
        if (_outS.length > 600) _outS = _outS.slice(0, 560) + "\n〔只显示前 560 字，全文 " + _outS.length + " 字〕";
        var txt2 = (say ? say.replace(/\s+$/, "") + " " : "") + _outS;
        // 【2026-10-19 用户「你要一直看他做的每一步卡在那里不断改进它」·ccode 自测实锤】
        //   实测（16:35 经文件聊天桥驱动「你自己看看最近哪里不对」）：它读完调试日志，把 3600 字原文
        //   当回答整段贴出来，**没有任何判断**——因为 read_file/search 执行完直接把结果当回复，
        //   模型没有第二次说话的机会。修：读类动作拿到内容后回喂同一个模型，让它给结论/下一步。
        var READISH = /^(read_file|search|list_dir)$/;
        // 2026-10-22：map_search 的返回同样是**素材不是回答**（候选清单），走同一条回喂模型的路。
        var _ansData = (act === "map_search") ? String(out || "")
            : (typeof MULTI_DATA !== "undefined" ? String(MULTI_DATA || "") : "");
        if (READISH.test(act) && out && String(out).length > 80) {
            try { actBusy("在看", "我看完了，正想说结论"); } catch (eB2) {}
            var _ans = careAnswerWithData(msg, String(out).slice(0, 4000), charId);
            if (_ans) {
                // 「NEXT: 下一步」约定——模型自己判断活干完没有：写了就把这句话摘出来、
                // 排进自主续跑（不用主人催）；没写就是干完了，正常回复。
                var _nm = String(_ans).match(/\n?NEXT[:：][ \t]*([^\n]{2,200})\s*$/);
                if (_nm) {
                    AUTO.next = String(_nm[1]).trim();
                    AUTO.left = Math.min(8, (AUTO.left || 0) + 2);   // 每次 NEXT 只续 2 轮，防止它一段段刷读整份文件
                    _ans = String(_ans).replace(/\n?NEXT[:：][^\n]*\s*$/, "").trim();
                    try { actLog("继续", "我说了下一步：" + AUTO.next); } catch (eN1) {}
                }
                try { actLog("想好了", "看完了，给你结论"); } catch (eA2) {}
                return { ate: true, text: (say ? say + " " : "") + _ans, act: act };
            }
        }
        // 2026-10-22：map_search 的清单（含 multi 里的）也必须让模型先说人话再说；不能整屏地名甩给主人。
        if (_ansData && _ansData.length > 40) {
            try { actBusy("在想", "我挑一下哪个最近"); } catch (eB3) {}
            try {
                var _ans2 = careAnswerWithData(msg, _ansData.slice(0, 4000), charId);
                if (_ans2) {
                    var _nm2 = String(_ans2).match(/\n?NEXT[:：][ \t]*([^\n]{2,200})\s*$/);
                    if (_nm2) {
                        AUTO.next = String(_nm2[1]).trim();
                        AUTO.left = Math.min(8, (AUTO.left || 0) + 2);
                        _ans2 = String(_ans2).replace(/\n?NEXT[:：][^\n]*\s*$/, "").trim();
                        try { actLog("继续", "我说了下一步：" + AUTO.next); } catch (eN3) {}
                    }
                    return { ate: true, text: (say ? say + " " : "") + _ans2, act: act };
                }
            } catch (eAN2) { log("清单转人话失败：" + eAN2); }
        }
        return { ate: true, text: txt2.slice(0, 400), act: act };
    } catch (e) { log("计划执行异常：" + e); return { ate: false, text: say || "这句我没做成" }; }
}
function aiChatSync(text, charId) {
    var key = careCfgKey("chat") || loadZKey();
    if (!key) return { ok: false, msg: "无密钥" };
    var msgs = CARECORE.aiMessages(text, charId, MEM.facts, nowStr(), MEM.chat, careSelfContext());
    // v1.9.4（2026-10-18 23:15 实锤：主人说「现在在充电，费用 30 元」→ 它回「已记账：支出 30 元、那天合计 57.5」
    //   而账本里根本没这笔（money 数组只有 7.5/10/10）→ 面板当然不变，使用者看到的就是「说记了但显示没有」。
    //   链路：计划路径不可用 → 工具循环也没拿到 → 这里回落到**纯聊天**（无任何工具）→ 模型顺手编了一句「已记账」。
    //   修法（提示词层，不写用户意图判据）：明确告诉它本轮没有工具，涉及改数据只能如实说没做。
    try {
        var _noToolNote = "【本轮无工具】你这一轮只有说话能力，没有任何可以改数据的工具。凡是记账、改数字、记饮食、删改档案这类事，**绝对不能回答「已记账/已记下/已经改好」**，只能如实说「这次没接上，我还没真记，你再说一次我立刻办」。不要说假话。";
        if (msgs.length && msgs[0].role === "system") msgs[0].content = String(msgs[0].content || "") + "\n" + _noToolNote;
        else msgs.unshift({ role: "system", content: _noToolNote });
    } catch (eNoTool) {}
    var t0 = Date.now();
    // v0.6.4：给对话加「联网搜索」能力（问事实/价格/新闻这类才会真查；失败自动退回纯模型）
    var bodyWith = {
        model: careCfgList("chat")[0], messages: msgs, temperature: 0.75, max_tokens: 1100,
        tools: [{ type: "web_search", web_search: { enable: true, search_result: false } }]
    };
    var r = httpPostJson(careCfgUrl("chat"), bodyWith,
        { "Authorization": "Bearer " + key }, 8000, 28000);
    if (!r.ok) {
        log("AI 带搜索失败，退回纯模型：" + String(r.msg || "").slice(0, 60));
        r = httpPostJson(careCfgUrl("chat"),
            { model: careCfgList("chat")[0], messages: msgs, temperature: 0.75, max_tokens: 1100 },
            { "Authorization": "Bearer " + key }, 8000, 28000);
    }
    if (!r.ok) { log("AI 网络失败：" + String(r.msg || "").slice(0, 80)); try { careNetFailMark(r.msg || ""); } catch (eNm3) {} return { ok: false, msg: r.msg }; }
    var p = CARECORE.parseAIResponse(r.text);
    if (p.ok) { log("AI(" + charId + ") " + (Date.now() - t0) + "ms：「" + p.text.slice(0, 50) + "」"); return p; }
    log("AI 失败(" + r.code + ")：" + String(p.msg || "").slice(0, 80));
    return { ok: false, msg: p.msg || ("HTTP" + r.code) };
}
// —— 录音（MediaRecorder；AAC_ADTS 优先，失败退 MPEG_4）——
var REC = { on: false, rec: null, file: "", t0: 0 };
var LIVE = { on: false, t0: 0 };
var SPEAK_LOCK = { until: 0 }; // v0.1.6：预计出声结束时刻（续录/互斥用）
var VF = { busy: false, id: "", phase: "idle", t0: 0, text: "", err: "" };
function fileMtimeOf(p) { try { return new java.io.File(p).lastModified(); } catch (e) { return 0; } }
function recPermOk() { try { return context.checkSelfPermission("android.permission.RECORD_AUDIO") === 0; } catch (e) { return true; } }
function voiceServiceAlive() { return Date.now() - fileMtimeOf(BASE + "/_关心_语音服务心跳") < 90000; }
function voiceToggle() {
    if (REC.on) return voiceStop(true);
    if (VF.busy) return { ok: false, busy: true, msg: "上一句还在处理" };
    if (!recPermOk()) {
        try { runtime.requestPermissions(["android.permission.RECORD_AUDIO"]); } catch (e) {}
        sleep(1600);
        if (!recPermOk()) return { ok: false, needPerm: true, msg: "需要麦克风权限" };
    }
    return voiceStart();
}
function allFilesOk() { try { return android.os.Environment.isExternalStorageManager(); } catch (e) { return true; } }
// 2026-10-17 用户拍板（A 方案）：没「所有文件访问」时，**每次启动最多自动跳一次**授权页——
// 安卓对这类权限没有系统弹窗，只能把设置页送到眼前；每次启动只跳一次，避免一开就卡在设置里出不来。
// 同时保留气泡提醒（跳过之后还能自己回去开）。开关：tmp/… 不需要，本变量随进程生命周期。
var __allFilesJumped = false;
function jumpAllFilesOnce(tag) {
    try {
        if (__allFilesJumped) return false;
        __allFilesJumped = true;
        context.startActivity(new android.content.Intent("android.settings.MANAGE_APP_ALL_FILES_ACCESS_PERMISSION",
            android.net.Uri.parse("package:" + context.getPackageName())).addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK));
        log("引导：所有文件访问授权页已自动打开（" + tag + "）");
        return true;
    } catch (e) { try { log("引导授权页失败：" + e); } catch (e2) {} return false; }
}
// 2026-10-18 18:0x：视频占麦「让路重试」的计数（开成功即清零）。见 voiceStart 的 catch 段注释。
var VS_RETRY = 0;
var VS_T0 = 0;
// 仅含括号片段/纯标点的转写＝环境音或字幕噪声（(拍摄)/(字幕:J Chong)/(咸咸咸)）
// 2026-10-22：whisper 在静音/环境音上会吐出重复句（实测同一句连写 5 遍）。
//   纯转写层的理智检查：拆句后同一句重复 ≥3 次 → 判幻觉，返回次数；否则 0。
function careAsrRepeatHallucination(t) {
    var s0 = String(t || "").replace(/\s+/g, " ").trim();
    if (s0.length < 8) return 0;
    var parts = s0.split(/[。！？!?；;\n]+/).map(function (x) { return x.trim(); }).filter(function (x) { return x.length >= 4; });
    if (parts.length < 3) {
        // 没有标点的长串（whisper 幻觉常见形态）：按空格分块，同一块（>=6 字）出现 >=3 次也算幻觉。
        //   实测 2026-10-22 23:37：「我认为您的感情是不错的 但是我认为您的感情是不错的」×5 → 块重复 4 次。
        var ws = s0.split(" ").map(function (x) { return x.replace(/[，。！？、,.!?；;]/g, "").trim(); }).filter(function (x) { return x.length >= 6; });
        if (ws.length >= 3) {
            var cnt0 = {}, best0 = 0, k0;
            for (k0 = 0; k0 < ws.length; k0++) { cnt0[ws[k0]] = (cnt0[ws[k0]] || 0) + 1; if (cnt0[ws[k0]] > best0) best0 = cnt0[ws[k0]]; }
            if (best0 >= 3) return best0;
        }
        return 0;
    }
    var cnt = {}, best = 0, i;
    for (i = 0; i < parts.length; i++) { cnt[parts[i]] = (cnt[parts[i]] || 0) + 1; if (cnt[parts[i]] > best) best = cnt[parts[i]]; }
    return best >= 3 ? best : 0;
}
function careVoiceNoiseOnly(s) {
    var t = String(s == null ? "" : s).replace(/[（(\[【][^）)\]】]*[）)\]】]/g, "").replace(/[\s.,，。!！?？~～…、:：;；」』”\"']/g, "");
    return !t;
}
function voiceStart() {
    try { if (!allFilesOk()) { try { context.startActivity(new android.content.Intent("android.settings.MANAGE_APP_ALL_FILES_ACCESS_PERMISSION", android.net.Uri.parse("package:" + context.getPackageName())).addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)); log("引导：所有文件访问授权页"); } catch (eAF) {} return { ok: false, msg: "需要「所有文件访问」权限（已打开设置页，打开开关后回来再试）" }; } } catch (eAF0) {}
    try { if (Date.now() < SPEAK_LOCK.until) { TTS.inst.stop(); } } catch (eSI) {}
    SPEAK_LOCK.until = 0;
    try {
        var d = new java.io.File(VOICE_DIR);
        if (!d.exists()) d.mkdirs();
        var f = VOICE_DIR + "/v" + Date.now() + ".aac";
        try { if (REC && REC.rec) { try { REC.rec.release(); } catch (eOld) {} REC.rec = null; } } catch (eOld2) {}
        var r = new android.media.MediaRecorder();
        try {
            r.setAudioSource(android.media.MediaRecorder.AudioSource.MIC);
            r.setOutputFormat(android.media.MediaRecorder.OutputFormat.AAC_ADTS);
            r.setAudioEncoder(android.media.MediaRecorder.AudioEncoder.AAC);
            r.setAudioSamplingRate(16000);
            r.setAudioEncodingBitRate(32000);
            r.setOutputFile(f);
            r.prepare(); r.start();
        } catch (e1) {
            try { r.reset(); } catch (e1b) {}
            try {
                f = VOICE_DIR + "/v" + Date.now() + ".m4a";
                r.setAudioSource(android.media.MediaRecorder.AudioSource.MIC);
                r.setOutputFormat(android.media.MediaRecorder.OutputFormat.MPEG_4);
                r.setAudioEncoder(android.media.MediaRecorder.AudioEncoder.AAC);
                r.setAudioSamplingRate(16000);
                r.setAudioEncodingBitRate(32000);
                r.setOutputFile(f);
                r.prepare(); r.start();
            } catch (e1c) { try { r.release(); } catch (e1d) {} throw e1c; }
        }
        REC = { on: true, rec: r, file: f, t0: Date.now() };
        setFace(faceEmo(curChar(), "listen"), 0);
        showBubble(curChar(), "🎤 在听…说完再点我一下");
        log("录音开始 → " + f);
        VS_RETRY = 0; VS_T0 = 0;   // 开成功一次就把失败计数清零
        if (LIVE.on) { try { startVAD(f, r); } catch (eV) { log("VAD 启动失败：" + eV); } }
        threads.start(function () { sleep(60000); if (REC.on && REC.file === f) { log("录音 60s 自动停"); try { voiceStop(true); } catch (e2) {} } });
        return { ok: true, on: true };
    } catch (e) {
        try { if (r) r.release(); } catch (eR2) {}
        var msgE = String(e);
        // 2026-10-18 18:0x（流水线报警·用户实测 17:48:21「setAudioSource failed」）：视频占麦时自动让路的重试**等得太短**——
        //   旧版 vidStop 后只 sleep(1200) 就重开录音，但相机 release 是异步投递到 vidcam 线程的，话筒锁还没放开，
        //   第二次照样 setAudioSource failed（日志里就是这么红的），然后直接放弃。
        //   改：最多重试 3 次、等待递增（1.6s / 2.7s / 3.8s），每次打一行「第 N/3 次重试」；仍失败才如实报错。
        //   判据仍是设备给的异常文本（不猜业务），只有视频确实开着才走让路分支。
        //   判据仍是设备给的异常文本（不猜业务）。注意：vidStop 之后 VID.on 已经是 false，
        //   所以「继续重试」的条件不能只看 VID.on——否则第一次让路后再失败就直接放弃了（那正是 17:48:21 的老毛病）。
        //   改为：视频开着 或者 已经在让路序列里（VS_RETRY>0）都继续重试。
        //   2026-10-18 17:59 二次实测（v1.5.25 首版）：三次递增等待（1.6/2.7/3.8s）**仍然不够**——
        //   这台机器相机放开话筒要 9 秒上下，8.1 秒时最后一次还是 setAudioSource failed。
        //   所以改成「每 2 秒试一次、最多 6 次（共 12 秒）」，并在第 1/3/6 次打一行带已等时长的日志，
        //   方便下次直接看出话筒到底锁了多久。
        if (/setAudioSource|audio|麦克风/i.test(msgE) && VS_RETRY < 6 && (VS_RETRY > 0 || (VID && VID.on))) {
            VS_RETRY++;
            if (VS_RETRY === 1) {
                try { vidStop("视频先收起来啦～你说话；说完想视频再点我~"); } catch (eV) {}
                VS_T0 = Date.now();
            }
            if (VS_RETRY === 1 || VS_RETRY === 3 || VS_RETRY >= 6) {
                log("话筒还被相机占着——第 " + VS_RETRY + "/6 次重试（已等 " + (VS_T0 ? (Date.now() - VS_T0) : 0) + "ms）");
            }
            sleep(2000);
            return voiceStart();
        }
        VS_RETRY = 0;
        log("录音启动失败：" + msgE); return { ok: false, msg: msgE };
    }
}
// ===== v0.1.5 连续对话（VAD 自动断句循环） =====
function startVAD(f, r) {
    LIVE.t0 = Date.now();
    threads.start(function () {
        var base = 0, n = 0, inSpeech = false, quietSince = 0, spokeAt = 0;
        while (REC.on && REC.file === f && LIVE.on) {
            var amp = 0;
            try { amp = r.getMaxAmplitude(); } catch (e) {}
            var th = Math.max(1600, (n ? base / n : 0) * 3);
            if (!inSpeech) {
                if (n < 8) { base += amp; n++; }
                else if (amp > th) { inSpeech = true; spokeAt = Date.now(); quietSince = 0; log("VAD：听到说话（" + amp + "）"); }
                else if (Date.now() - LIVE.t0 > 45000) { log("VAD：45 秒没听到声音，退出连续对话"); LIVE.on = false; try { voiceStop(false); } catch (e1) {} break; }
            } else {
                if (amp > th) quietSince = 0;
                else if (!quietSince) quietSince = Date.now();
                if (quietSince && Date.now() - quietSince > 1200) { log("VAD：说完一句（静音断句）"); try { voiceStop(true); } catch (e2) {} break; }
                if (spokeAt && Date.now() - spokeAt > 15000) { log("VAD：单句超 15 秒，先断句"); try { voiceStop(true); } catch (e3) {} break; }
            }
            sleep(150);
        }
    });
}
function liveContinue(estMs) {
    if (!LIVE.on) return;
    threads.start(function () {
        sleep(Math.min(15000, Math.max(900, estMs || 1500)));
        var guard = Date.now() + 20000;
        while (LIVE.on && Date.now() < SPEAK_LOCK.until && Date.now() < guard) sleep(300);
        if (LIVE.on && !REC.on && !VF.busy) { try { sleep(250); voiceStart(); } catch (e) {} }
    });
}
function toggleVoiceLive() {
    if (LIVE.on) { LIVE.on = false; if (REC.on) { try { voiceStop(false); } catch (e) {} } log("连续对话：关"); return { ok: true, live: false }; }
    LIVE.on = true;
    if (REC.on) { try { voiceStop(false); } catch (e2) {} sleep(250); }
    var r = voiceStart();
    if (!r || r.ok === false) { LIVE.on = false; return { ok: false, live: false, msg: (r && r.msg) || "启动失败", needPerm: r && r.needPerm }; }
    log("连续对话：开");
    return { ok: true, live: true };
}
function voiceStop(send) {
    if (!REC.on) return { ok: false, msg: "没在录音" };
    var f = REC.file, r = REC.rec, dur = Date.now() - REC.t0;
    REC = { on: false, rec: null, file: "", t0: 0 };
    try { r.stop(); } catch (e) {} try { r.release(); } catch (e2) {}
    log("录音停止（" + Math.round(dur / 1000) + "s）");
    if (dur < 800) {
        try { new java.io.File(f).delete(); } catch (e3) {}
        setFace(idleEmo(), 0);
        showBubble(curChar(), "太短啦，再来一次");
        return { ok: true, tooShort: true };
    }
    if (send !== false) { try { startVoiceFlow(f, dur); } catch (e4) { log("流程启动异常：" + e4); } }
    return { ok: true, file: f, ms: dur };
}
function finishVoice(msg, text) {
    log("语音流程结束：" + msg);
    try { showBubble(curChar(), msg); setFace(faceEmo(curChar(), "concern"), 4200); } catch (e) {}
    VF = { busy: false, id: "", phase: "idle", t0: 0, text: text || "", err: msg };
}
function startVoiceFlow(audioFile, durMs) {
    if (!voiceServiceAlive()) { LIVE.on = false; finishVoice("耳朵服务没在跑，稍后再试", null); return { ok: false, msg: "语音服务离线" }; }
    VF = { busy: true, id: "v" + Date.now(), phase: "transcribe", t0: Date.now(), text: "", err: "" };
    var vf = VF;
    try { setFace(faceEmo(curChar(), "listen"), 0); showBubble(curChar(), "让我听听…"); } catch (e0) {}
    try { saveJSON(VREQ, { id: vf.id, audio: audioFile, lang: "zh", durMs: durMs || 0, ts: Date.now() }); }
    catch (e) { VF.busy = false; finishVoice("请求写不出去…", null); return { ok: false, msg: String(e) }; }
    threads.start(function () {
        var t0 = Date.now(), got = null;
        while (Date.now() - t0 < 90000) {
            sleep(1200);
            var rc = CARECORE.voiceResultCheck(loadJSON(VRES), vf.id);
            if (rc.state === "pending") continue;
            got = rc; break;
        }
        if (!got) { finishVoice("没等到转写结果", null); liveContinue(1200); return; }
        if (got.state === "fail") { finishVoice("转写失败：" + String(got.msg || "").slice(0, 40), null); liveContinue(1200); return; }
        if (got.state === "empty") { finishVoice("没听清，再来一次吧", null); liveContinue(1200); return; }
        var text = got.text;
        vf.text = text; vf.phase = "think";
        try { setFace(faceEmo(curChar(), "think"), 0); showBubble(curChar(), "听到了：「" + text.slice(0, 16) + "」"); } catch (e1) {}
        log("转写：" + text);
        var visCtx = "";
        if (VID.on && VID.cam) {
            try {
                var vFrame = vidGrabSync();
                if (vFrame) {
                    var vNote = aiVisionNote(vFrame);
                    if (vNote && vNote.ok) visCtx = "（补充信息：你现在正通过视频看着主人，摄像头画面里：" + vNote.text + "。规则：默认完全不要提画面内容；只有当主人刚才的话与画面相关（问你看没看到、让你看某样东西、聊到眼前的事物）时，才把看到的内容分析后自然融进回答，像顺口一提，绝不生硬报画面。）";
                }
            } catch (eV2) { log("视频上下文异常：" + eV2); }
        }
        // v1.6.7（2026-10-18 19:0x·用户：「我说了吃了啥晚饭花多少钱，为啥它不记账」）：
        //   根因：语音这条路走的是 aiChatSync——纯文本模型，**一个工具都没有**，所以「已记！+10 元」「豆花牛肉已存档」
        //   全是嘴上说的（实锤：当日账本里只有 7.5 那一笔、饮食档里也没有豆花牛肉）。改成 aiChatWithTools，
        //   语音与打字走同一套工具循环（含「嘴说已做但零工具」的纠偏）。
        // 同批：转写若整句只是括号噪声（(拍摄)/(字幕:J Chong)/(咸咸咸)）→ 不调模型、不进健康档案，直接说没听清。
        var noiseOnly = careVoiceNoiseOnly(text);
        // 2026-10-22 23:37 实锤：安静环境 whisper 会「脑补」——同一句连写五遍
        //   （「我认为您的感情是不错的 但是我认为您的感情是不错的」×5），当成主人说话就回错话。
        //   转写理智检查（只判转写是否像幻觉，不替模型判断内容）：同一句重复 ≥3 次 → 按没听清处理。
        try {
            var _hal = careAsrRepeatHallucination(text);
            if (_hal) { noiseOnly = true; log("转写疑似幻觉（同一句重复 " + _hal + " 次），按没听清处理：" + String(text).slice(0, 40)); }
        } catch (eHal) { }
        var reply = null, engine = "local";
        // 2026-10-22（㉗）：复读/串台只做「一字不差又重复了一遍」的事实记录（判断权在模型）；
        //   重复的那句不再往档案里再记一次（同一句话计两笔真的账/饮食就是这里进来的）。
        var _echo = { dup: false, n: 1, gap: 0 };
        try { _echo = careEchoNote(text); } catch (eE1) {}
        if (noiseOnly) {
            reply = "这句我没听清（像环境音或字幕），你再说一次好不好";
            log("语音噪声转写，按没听清处理：" + String(text).slice(0, 20));
        } else if (ST.aiOn) {
            // 2026-10-23 主人点单：说完之后要能看到「AI 正在响应」，不然不知道它到底有没有在动
            try { setFace(faceEmo(curChar(), "think"), 0); showBubble(curChar(), "🤔 在想…（AI 正在回）"); } catch (eTh2) {}
            var ar = aiChatWithTools(text + (visCtx ? "\n" + visCtx : ""), curChar());
            if (ar && ar.ok) {
                reply = ar.text; engine = "ai";
                if (ar.tools && ar.tools.length) log("语音工具：" + ar.tools.join(","));
            }
        }
        if (!reply) { var lr = CARECORE.chatReply(text, curChar(), RNG, nowMinOf(Date.now())); reply = lr.reply; }
        // 2026-10-25：语音这条路同理——模型没接通就把原话存进待补记队列（噪声/幻觉转写不存）。
        try { if (!noiseOnly && (!ar || !ar.ok)) carePendingPush(text); } catch (ePP2) {}
        var mood = CARECORE.moodOf(text);
        try { var _clean2 = careSayClean(reply); if (_clean2 !== reply) { log("回话清洗(语音)：剥掉协议垃圾 " + (String(reply).length - _clean2.length) + " 字"); reply = _clean2 || reply; } } catch (eCl2) {}
        if (mood) { MEM.mood.push({ t: Date.now(), m: mood }); if (MEM.mood.length > 300) MEM.mood.shift(); }
        MEM.chat.push({ t: Date.now(), me: "🎤 " + text, pet: reply, char: curChar(), eng: engine });
        if (!noiseOnly && !_echo.dup) { try { careHealthDigest(text); } catch (eHD2) {} }
        if (MEM.chat.length > 60) MEM.chat.shift();
        saveMem();
        appendChatLog("[" + nowStr() + "] 我(语音)：" + text + "\n[" + nowStr() + "] " + (CARECORE.CHARS[curChar()] || {}).name + "：" + reply + "\n");
        ST.freq = CARECORE.interact(ST.freq, Date.now());
        // 2026-10-25：语音对话同理——主人自己开口的，安靜时段也必须出声
        presentSay(curChar(), reply, reply, "happy", !!ST.soundOn);
        log("语音闭环(" + engine + ")：我「" + text.slice(0, 26) + "」→「" + reply.slice(0, 26) + "」");
        VF = { busy: false, id: vf.id, phase: "idle", t0: 0, text: text, err: "" };
        liveContinue(reply.length * 250 + 1000);
    });
    return { ok: true, id: vf.id };
}

// ===== 2026-10-25（主人点单）：常听环境声——听得到、不废话、不无限累积 =====
// 【主人原话】「随时都能听到外面的一切声音，随时能根据外面的声音搭话，但是不能哒废话，
//   外面的所有声音导致的累积不能一直无限累积」。
// 【怎么听】切 5 秒一段的短录音，只算振幅（不做转写）；振幅过门限（ST.ambTh，默认 1800/32767）
//   才送去本机 whisper 转写（全离线、不花额度）。
// 【怎么说】转写文本交给模型判「值不值得搭一句」（同主动关心那套 PASS/SPEAK 协议），
//   模型说 PASS 就一个字不发；代码不猜内容。
// 【怎么说少】不限次数（主人 2026-10-25 改口径：「不要限制它回复只能 8 次，无限次才行」）：
//   只留防刷屏——同一句 30 秒内不重复、主动逗你最短隔 20 秒；你自己叫它/让它做事（DO）完全不受限。
//   安静时段只管「主动逗你」，你叫它照样处理；另外它在听你说话/正在回你/键盘弹着时不插嘴。
// 【不累积】①内存里的声音记录 MEM.amb 只留最近 3 天且最多 120 条；
//   ②磁盘录音文件只留最新 12 个（听不出东西的当场删，不存音频本体）；③转写文本截 60 字。
// 【失败表现】日志必写「常听：…」——录音启动失败会指数退避（最长 60 秒试一次）并计数。
var AMB = { on: false, fails: 0, dir: BASE + "/关心_声音" };
function ambDir() { try { var d = new java.io.File(AMB.dir); if (!d.exists()) d.mkdirs(); } catch (e) {} return AMB.dir; }
function careKbUp() {
    try {
        var im = context.getSystemService(android.content.Context.INPUT_METHOD_SERVICE);
        return !!(im && im.isAcceptingText && im.isAcceptingText());
    } catch (e) { return false; }
}
function ambCleanup(keep) {
    try {
        var d2 = new java.io.File(ambDir()); var ls = d2.listFiles(); if (!ls) return;
        var arr = []; for (var i = 0; i < ls.length; i++) arr.push(ls[i]);
        arr.sort(function (a, b) { return b.lastModified() - a.lastModified(); });
        for (var j = (keep || 12); j < arr.length; j++) { try { arr[j].delete(); } catch (eD) {} }
    } catch (e) {}
}
function ambEventPush(rec) {
    try {
        MEM.amb = MEM.amb || [];
        MEM.amb.push(rec);
        var cut = Date.now() - 3 * 86400000;
        MEM.amb = MEM.amb.filter(function (x) { return x && x.t >= cut; }).slice(-120);
        saveMem();
    } catch (e) {}
}
function ambSuppressed() {
    try {
        if (REC.on || VF.busy || LIVE.on) return true;        // 它在听你/正在回你
        if (Date.now() < SPEAK_LOCK.until) return true;        // 还在说话
        if (careKbUp()) return true;                           // 你在打字
        if (typeof VID !== "undefined" && VID && VID.on) return true;   // 视频占着麦
        return false;
    } catch (e) { return true; }
}
function ambCapture(ms) {
    var r = null, f = ambDir() + "/a" + Date.now() + ".aac", peak = 0;
    try {
        r = new android.media.MediaRecorder();
        r.setAudioSource(android.media.MediaRecorder.AudioSource.MIC);
        r.setOutputFormat(android.media.MediaRecorder.OutputFormat.AAC_ADTS);
        r.setAudioEncoder(android.media.MediaRecorder.AudioEncoder.AAC);
        r.setAudioSamplingRate(16000); r.setAudioEncodingBitRate(24000);
        r.setOutputFile(f); r.prepare(); r.start();
        var t0 = Date.now();
        while (Date.now() - t0 < (ms || 5000)) {
            sleep(300);
            try { var a = r.getMaxAmplitude(); if (a > peak) peak = a; } catch (eA) {}
        }
        try { r.stop(); } catch (eS) {}
        try { r.release(); } catch (eR) {}
        return { ok: true, file: f, peak: peak };
    } catch (e) { try { if (r) r.release(); } catch (e2) {} return { ok: false, file: f, peak: peak, msg: String(e) }; }
}
function ambAsr(file) {
    try {
        if (!voiceServiceAlive()) return null;
        var id = "amb" + Date.now();
        saveJSON(VREQ, { id: id, audio: file, lang: "zh", durMs: 0, ts: Date.now() });
        var t0 = Date.now();
        while (Date.now() - t0 < 40000) {
            sleep(1200);
            var rc = CARECORE.voiceResultCheck(loadJSON(VRES), id);
            if (!rc || rc.state === "pending") continue;
            return (rc.state === "ok") ? String(rc.text || "") : null;
        }
        return null;
    } catch (e) { return null; }
}
// ===== 2026-10-25（主人改口径：不限次数，让它自己判断该说该动、能真做事）=====
// 【主人原话】「不要限制它回复只能 8 次，无限次才行，我让他不说废话不代表不能根据情况它随时逗我、
//   动作和话语它随时自己判断情况来进行」。
// 【改成三段判定】一次调用返回三种之一（判断权全在模型，代码只执行）：
//   PASS        → 不相关（噪声/别人说话/没新信息），一个字不说
//   CHAT: 话 [|ACT: 动作名]  → 回一句（可顺带做个动作逗你）
//   DO: 原话     → 这是真要动手（记账/导航/打开应用/做大动作）→ 交给完整对话链路（有工具、能真做）
// 【频控】不再有“每天 8 句”与“8 分钟间隔”：只留两条防刷屏——
//   ①同一句话 30 秒内不重复处理；②“主动逗你”类型最短隔 20 秒；
//   你自己在跟它说话、或让它做事（DO）**不受任何次数限制**。
//   安静时段只做 DO（不当动逗你），因为时段是你自己设的；不想留就改安静设置。
function ambAsk(text) {
    try {
        if (!ST.aiOn) return { kind: "pass" };
        var sys = "你随时听着他周围的声音（本机离线听写）。判断这段声音该怎么处理，只输出下面三种之一："
            + "①PASS：不是对你说的、电视广播路人引擎噪声、他自言自语、或没新信息 → 一个字不说；"
            + "②CHAT: 你要说的话（不超过 20 字，可接 |ACT: 动作名，想逗他做动作时用；动作只许这几个：Wave 挥手 / Look 四处看 / Dance 跳一段 / Shake 摇头）——他只是顺口、或你想逗他一下；"
            + "③DO: ———他显然是在叫唤你/让你做事（打开某 App、导航、记账、坐下、过来等）。"
            + "没有条数限制，几次都行；但**不许废话**：不看听的重复一遍、不问“你在说什么”、不说设备声。";
        var r1 = careAISimple(sys, "听写内容：「" + String(text).slice(0, 160) + "」", 300);
        if (!r1 || !r1.ok) return { kind: "pass" };
        var t1 = String(r1.text || "").trim();
        if (/^DO/i.test(t1)) return { kind: "do" };
        if (!/^CHAT/i.test(t1)) return { kind: "pass" };
        var body = t1.replace(/^CHAT[:：]?\s*/i, "").replace(/\s+/g, " ").trim();
        var act = "";
        var mm = body.match(/\|\s*ACT[:：]?\s*([A-Za-z]+)/i);
        if (mm) { act = String(mm[1]).toLowerCase(); body = body.replace(mm[0], "").trim(); }
        return { kind: "chat", say: body.slice(0, 40), act: act };
    } catch (e) { return { kind: "pass" }; }
}
// 「现在能不能动嘴」——只留防刷屏（主人要求不限次数）；bad＝噪声/幻觉
function ambCanTalk(bad, kind) {
    try {
        if (bad) return false;
        var now = Date.now();
        MEM.ambTalk = MEM.ambTalk || { d: "", n: 0, t: 0, lastKey: "", lastKeyAt: 0 };
        if (kind === "do") return true;                                      // 主人在跟它说话/让它做事：不限
        if (now - (MEM.ambTalk.t || 0) <= 20000) return false;                  // 主动逗你：最短隔 20 秒
        if (CARECORE.inDnd(QCFG, nowMinOf(now))) return false;                  // 安静时段不主动逗（DO 不受影响）
        return true;
    } catch (e) { return false; }
}
function ambLoop() {
    while (AMB.on) {
        try {
            if (ambSuppressed()) { sleep(4000); continue; }
            // 2026-10-25 实锤：重装会重置录音权限，而 `runtime.requestPermissions` 会一直阻塞等用户点，
            //   实测 13:31 那次就把整个常听循环卡死（日志停在「申请麦克风权限」后再无一行）。
            //   现在：**循环里绝不弹窗**，只检查+写日志（请求权限放到启动时主线程做一次），没权限就慢速等着，
            //   你打开 App 授权后它自己就会恢复听。
            if (!recPermOk()) {
                if (!AMB.permLogAt || Date.now() - AMB.permLogAt > 120000) {
                    AMB.permLogAt = Date.now();
                    log("常听：没有麦克风权限，先不听（去给「关心」麦克风权限，给了我自己就开始）");
                }
                sleep(20000);
                continue;
            }
            // 2026-10-25（实测发烫 43℃）：屏幕灭着就不听——夜里省电、也避免无人时无意义占着麦
            try { if (!device.isScreenOn()) { sleep(8000); continue; } } catch (eScr0) {}
            var cap = ambCapture(5000);
            if (!cap.ok) {
                AMB.fails++;
                log("常听：录音启动失败（第 " + AMB.fails + " 次）：" + String(cap.msg || "").slice(0, 120));
                if (AMB.fails === 3) log("常听：已连续失败 3 次，别的东西可能占着麦克风（通话/录音机/语音助手），我会继续退避重试");
                sleep(Math.min(60000, 6000 * Math.min(8, AMB.fails)));
                continue;
            }
            AMB.fails = 0;
            var th = Number(ST.ambTh) || 1800;
            if (cap.peak < th) {
                // 2026-10-25（实测：静音时一行日志都没有，根本看不出它到底在不在听）：
                //   静音也每分钟留一条心跳，写清门限与当前振幅，排障不用猜。
                if (!AMB.lastQuietLog || Date.now() - AMB.lastQuietLog > 60000) {
                    AMB.lastQuietLog = Date.now();
                    log("常听：在听（安静）｜本次振幅 " + cap.peak + " ／ 门限 " + th);
                }
                try { new java.io.File(cap.file).delete(); } catch (eD1) {}
                // 2026-10-25：静音间隔 1.2s → 2.5s（实测发烫 43℃，降一半占空比；有声音时仍是 5 秒一段，不影响听得清）
                sleep(2500);
                continue;
            }
            var text = ambAsr(cap.file);
            var flat = String(text || "").replace(/\s/g, "");
            if (flat.length < 2) { try { new java.io.File(cap.file).delete(); } catch (eD2) {} sleep(1200); continue; }
            var bad = false;
            try { if (careVoiceNoiseOnly(text)) bad = true; } catch (eN1) {}
            try { if (careAsrRepeatHallucination(text)) bad = true; } catch (eN2) {}
            // 同一句 30 秒内不重复处理（防刷屏），不是限次数
            var _nk = flat.slice(0, 24);
            if (!bad && MEM.ambTalk && MEM.ambTalk.lastKey === _nk && Date.now() - (MEM.ambTalk.lastKeyAt || 0) < 30000) bad = true;
            if (!bad) { MEM.ambTalk = MEM.ambTalk || {}; MEM.ambTalk.lastKey = _nk; MEM.ambTalk.lastKeyAt = Date.now(); }
            // 三段判定：PASS 不说 / CHAT 说（可带动作）/ DO 走完整对话（有工具、能真做事）
            var dec = bad ? { kind: "pass" } : ambAsk(text);
            var said = "", actK = "";
            if (dec.kind === "chat" && ambCanTalk(false, "chat")) {
                said = String(dec.say || "").slice(0, 40);
                actK = String(dec.act || "");
            } else if (dec.kind === "do" && ambCanTalk(false, "do") && ST.aiOn) {
                // 真要动手的话：走完整工具链路（能记账/导航/打开应用/驱动身体），再把结果说出来
                try {
                    var ar = aiChatWithTools(text, curChar());
                    if (ar && ar.ok) { said = String(ar.text || "").slice(0, 120); log("常听：按指令办了（工具 " + ((ar.tools || []).join(",") || "无") + "）"); }
                    else log("常听：想办事但没接上（" + String((ar && ar.msg) || "") + "）");
                } catch (eDo) { log("常听：办事异常 " + eDo); }
            }
            if (said) {
                MEM.ambTalk = MEM.ambTalk || {};
                MEM.ambTalk.n = (MEM.ambTalk.n || 0) + 1; MEM.ambTalk.t = Date.now();
                // 想逗你的时候顺带做个动作（动作名只认白名单，防页面收到脏值）
                if (actK && D3.on) {
                    var AMAP = { wave: "Wave", look: "Look", dance: "Dance", shake: "No" };
                    var _an = AMAP[actK] || "";
                    if (_an) { try { d3Act(_an, 3200); } catch (eAct) {} }
                }
                // DO 类型里说话/做事都已完成（工具那轮已经播过），这里只对 CHAT 再播一次
                if (dec.kind === "chat") presentSay(curChar(), said, said, "happy", !!ST.soundOn, false);
                log("常听（" + dec.kind + "，今天第 " + MEM.ambTalk.n + " 次）：「" + said.slice(0, 40) + "」←「" + flat.slice(0, 30) + "」");
            } else {
                log("常听：不搭话（" + (bad ? "噪声/幻觉/30 秒内重复" : (dec.kind === "chat" ? "20 秒内刚逗过/安静时段" : (dec.kind === "do" ? "办事没成功" : "模型判 PASS"))) + "）：「" + flat.slice(0, 30) + "」");
            }
            ambEventPush({ t: Date.now(), text: flat.slice(0, 60), peak: cap.peak, said: said ? 1 : 0 });
            try { new java.io.File(cap.file).delete(); } catch (eD3) {}
            ambCleanup(12);
            sleep(said ? 4000 : 1500);
        } catch (e) { log("常听异常：" + e); sleep(5000); }
    }
}
function ambStart() {
    if (AMB.on) return { ok: true, on: true };
    // 2026-10-25 修：这里**不再同步申请权限**——`runtime.requestPermissions` 会一直阻塞等用户点，
    //   实测把它放在启动路径上会把整个常听（甚至启动）卡死。改成只检查+写日志；
    //   权限由启动时那条轻量线程弹一次（弹框不阻塞主流程）。
    if (!recPermOk()) log("常听：当前没有麦克风权限，会等你授权后自动开始（重装会重置这个权限）");
    AMB.on = true;
    threads.start(function () { try { ambLoop(); } catch (e) { log("常听循环退出：" + e); } });
    log("常听：开（不限次数，说与不说、动不动由它自己判断；只留防刷屏与安静时段）");
    return { ok: true, on: true };
}
function ambStop() {
    AMB.on = false;
    try { ambCleanup(3); } catch (e) {}
    log("常听：关");
    return { ok: true, on: false };
}
// ===== v0.1.3 眼睛（系统相机原生路线；webview getUserMedia 被拒实锤后的正路） =====
var CAM = { busy: false, t0: 0, file: "" };
function camPermOk() { try { return context.checkSelfPermission("android.permission.CAMERA") === 0; } catch (e) { return true; } }
function cameraShot() {
    if (CAM.busy) return { ok: false, busy: true, msg: "上一张还在看" };
    if (!camPermOk()) {
        try { runtime.requestPermissions(["android.permission.CAMERA"]); } catch (e1) {}
        sleep(1600);
        if (!camPermOk()) return { ok: false, needPerm: true, msg: "需要相机权限" };
    }
    try {
        var d = new java.io.File(BASE + "/关心_照片");
        if (!d.exists()) d.mkdirs();
        var f = BASE + "/关心_照片/p" + Date.now() + ".jpg";
        var file = new java.io.File(f);
        var uri = androidx.core.content.FileProvider.getUriForFile(context, context.getPackageName() + ".fileprovider", file);
        var it = new android.content.Intent(android.provider.MediaStore.ACTION_IMAGE_CAPTURE);
        it.putExtra(android.provider.MediaStore.EXTRA_OUTPUT, uri);
        it.addFlags(android.content.Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
        it.addFlags(android.content.Intent.FLAG_GRANT_READ_URI_PERMISSION);
        it.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK);
        CAM.busy = true; CAM.t0 = Date.now(); CAM.file = f;
        context.startActivity(it);
        log("相机已打开 → 等照片 " + f);
        try { setFace(faceEmo(curChar(), "listen"), 0); showBubble(curChar(), "举起手机，给我看看～"); } catch (e2) {}
        threads.start(function () {
            var t0 = Date.now(), done = false;
            while (Date.now() - t0 < 120000) {
                sleep(1200);
                try {
                    var jf = new java.io.File(f);
                    if (jf.exists() && jf.length() > 8000) { sleep(900); done = true; break; }
                } catch (e3) {}
            }
            CAM.busy = false;
            if (!done) { finishVoice("没等到照片（取消了？）", null); return; }
            analyzePhoto(f);
        });
        return { ok: true };
    } catch (e) { CAM.busy = false; log("相机启动失败：" + e); return { ok: false, msg: String(e) }; }
}
// 2026-10-23（主人点单）：「拍张给你看那个按钮加上能选择相册里的图」→「我说的我的手机相册」
// 【正路】app.startActivityForResult + ACTION_GET_CONTENT 打开**系统相册**，选完拿 content:// URI，
//   用 ContentResolver 把图复制到 关心_照片/a<时间>.jpg，再交给同一个 analyzePhoto。
// 【为什么不用 images.pick】AutoJs6 的 images 模块没有 pick（13:48 实锤 TypeError）；
//   【为什么不用列目录】主人要的是相册，不是我这边的最近照片列表（13:5x 主人当面纠正）。
// 【兜底】系统相册那条路不可用（API 不存在/抛错/URI 读不出）时，自动退回「列最近 30 张」让主人点，
//   不会像 13:48 那版一样点了没反应。
function albumUriToLocal(uri) {
    try {
        var d = new java.io.File(BASE + "/关心_照片");
        if (!d.exists()) d.mkdirs();
        var f = new java.io.File(d, "a" + Date.now() + ".jpg");
        var ins = context.getContentResolver().openInputStream(uri);
        var outs = new java.io.FileOutputStream(f);
        var buf = java.lang.reflect.Array.newInstance(java.lang.Byte.TYPE, 8192);
        var n = 0;
        while ((n = ins.read(buf)) > 0) outs.write(buf, 0, n);
        outs.close(); ins.close();
        return String(f.getAbsolutePath());
    } catch (e) { log("相册读图失败：" + e); return null; }
}
// 兜底：列最近 30 张照片让主人点（系统相册不可用时才走这里）
function albumPickLocal() {
    try {
        CAM.busy = true; CAM.t0 = Date.now();
        var dirs = ["/storage/emulated/0/DCIM/Camera", "/storage/emulated/0/DCIM", "/storage/emulated/0/Pictures",
                    "/storage/emulated/0/Download", "/storage/emulated/0/Screenshots", BASE + "/关心_照片"];
        var all = [];
        for (var i = 0; i < dirs.length; i++) {
            try {
                var d = new java.io.File(dirs[i]);
                if (!d.exists() || !d.isDirectory()) continue;
                var fs2 = d.listFiles();
                if (!fs2) continue;
                for (var j = 0; j < fs2.length; j++) {
                    try {
                        var f = fs2[j];
                        if (!f.isFile()) continue;
                        var nm = String(f.getName()).toLowerCase();
                        if (!/\.(jpg|jpeg|png|webp)$/.test(nm)) continue;
                        if (f.length() < 8000) continue;
                        all.push({ path: String(f.getAbsolutePath()), t: f.lastModified(), name: String(f.getName()) });
                    } catch (e1) { }
                }
            } catch (e2) { }
        }
        if (!all.length) { CAM.busy = false; log("相册选图：没找到照片"); finishVoice("相册里没找到照片", null); return; }
        all.sort(function (a, b) { return b.t - a.t; });
        var top = all.slice(0, 30);
        var labels = [];
        var sdf = new java.text.SimpleDateFormat("MM-dd HH:mm");
        for (var k = 0; k < top.length; k++) labels.push(sdf.format(new java.util.Date(top[k].t)) + "  " + top[k].name.slice(0, 26));
        var idx = -1;
        try { ui.run(function () { idx = dialogs.select("系统相册打不开，先从最近的照片里挑一张", labels); }); }
        catch (e3) { log("相册选图：弹窗失败 " + e3); }
        if (!(idx >= 0)) { CAM.busy = false; log("相册选图：用户取消"); finishVoice("没选照片，那就下次～", null); return; }
        var p = top[idx].path;
        log("相册选图(列表) → " + p);
        CAM.busy = false;
        analyzePhoto(p);
    } catch (e) { CAM.busy = false; log("相册选图异常：" + e); }
}
function albumPick() {
    if (CAM.busy) return { ok: false, busy: true, msg: "上一张还在看" };
    // ①优先：真的打开系统相册
    try {
        var hasApi = (typeof app !== "undefined" && app && typeof app.startActivityForResult === "function");
        log("相册选图：startActivityForResult 可用=" + hasApi);
        if (hasApi) {
            var it = new android.content.Intent(android.content.Intent.ACTION_GET_CONTENT);
            it.setType("image/*");
            try { it.addCategory(android.content.Intent.CATEGORY_OPENABLE); } catch (eC) { }
            it.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK);
            CAM.busy = true; CAM.t0 = Date.now();
            app.startActivityForResult(it, function (a, b) {
                try {
                    var data = (b !== undefined && b !== null) ? b : a;   // 兼容 (resultCode,data) 与 (data) 两种回调
                    var uri = data ? data.getData() : null;
                    if (!uri) { CAM.busy = false; log("相册选图：用户没选（data 空）"); finishVoice("没选照片，那就下次～", null); return; }
                    var p = albumUriToLocal(uri);
                    CAM.busy = false;
                    if (!p) { log("相册选图：URI 读不出，退回列照片"); albumPickLocal(); return; }
                    log("相册选图 → " + p);
                    analyzePhoto(p);
                } catch (eCB) { CAM.busy = false; log("相册回调异常：" + eCB); }
            });
            return { ok: true };
        }
    } catch (e) { CAM.busy = false; log("系统相册打不开，退回列照片：" + e); }
    // ②兜底：列最近照片
    threads.start(function () { albumPickLocal(); });
    return { ok: true };
}
function analyzePhoto(file) {
    try { setFace(faceEmo(curChar(), "think"), 0); showBubble(curChar(), "让我看看…"); } catch (e0) {}
    var meal = null;
    try { meal = mealCtxNow(); } catch (eM2) {}
    var note = "";
    try {
        if (ST.aiOn && loadZKey()) {
            var rep = aiVisionSync(file, meal ? "food" : null);
            note = rep.ok ? rep.text : "照片收下了（AI 看图没成功，等会儿再试）";
        } else { note = "照片收到啦（AI 大脑关着，我就不形容了）"; }
    } catch (e) { note = "看了一眼（分析失败）"; }
    var fParsed = null;
    if (meal) { try { fParsed = parseFoodNote(note); } catch (ePF) {} }
    var showText = (fParsed && fParsed.nutri) ? (fParsed.verdict + "\n" + fParsed.tower + (fParsed.elemLine ? "\n" + fParsed.elemLine : "")) : note;
    var speechText = (fParsed && fParsed.nutri) ? fParsed.verdict : note;
    log("看照片：" + note.slice(0, 80) + ((fParsed && fParsed.nutri) ? "｜塔 主" + fParsed.nutri.zhu + " 蔬" + fParsed.nutri.shu + " 蛋" + fParsed.nutri.dan + " 油" + fParsed.nutri.you + " 热" + fParsed.nutri.heat : "（无塔）"));
    MEM.chat.push({ t: Date.now(), me: "📷 [照片]", pet: showText, char: curChar() });
    if (MEM.chat.length > 60) MEM.chat.shift();
    saveMem();
    presentSay(curChar(), showText, speechText, "happy", !!ST.soundOn);   // 2026-10-25：他拍了照后主动回话，不跟安靜时段
    // 2026-10-23（主人点名的问题）：以前只要在饭点窗口里，**任何照片**都往饮食档里塞——
    //   日志实锤 diet 里混进过「[拍] 看起来这是一张导航界面的截图」「[拍] 看起来这是一张关于打车或骑行」。
    //   现在只有**解析出营养塔**的（＝真的是食物）才记进饮食档；不是食物就只聊天、不污染营养统计。
    if (meal && fParsed && fParsed.nutri) {
        try {
            var rec2 = { t: Date.now(), s: "[拍] " + String(fParsed.verdict || note).slice(0, 50), meal: meal, photo: true };
            if (fParsed && fParsed.nutri) rec2.nutri = fParsed.nutri;
            if (fParsed && fParsed.elems) rec2.elems = fParsed.elems;
            MEM.health.diet.push(rec2);
            if (MEM.health.diet.length > 400) MEM.health.diet.shift();
            saveMem();
            log("饮食(拍饭)记录：" + String(rec2.s).slice(0, 30) + ((fParsed && fParsed.nutri) ? "（含营养塔）" : ""));
        } catch (eFD) {}
    }
    try {
        var dir = new java.io.File(BASE + "/关心_照片");
        if (dir.exists()) {
            var fl = [];
            var names = dir.list();
            if (names) { for (var i = 0; i < names.length; i++) { if (names[i].indexOf("p") === 0 && names[i].indexOf(".jpg") > 0) fl.push(names[i]); } }
            fl.sort();
            for (var k = 0; k < fl.length - 20; k++) { try { new java.io.File(dir.getAbsolutePath() + "/" + fl[k]).delete(); } catch (e4) {} }
        }
    } catch (e5) {}
}
// ===== v0.5.1 文字报餐分析（用户 2026-10-17 报障：只说了吃的啥 → 之前只记文字、营养塔/元素啥都不出）=====
// 口径：拍饭走 glm-4v 看图；这里走 glm-4-flash 看描述，输出同一套结构（点评/塔:/元素:），复用 parseFoodNote 解析。
function aiFoodTextSync(desc, meal) {
    var key = careCfgKey("chat") || loadZKey();
    if (!key) return { ok: false, msg: "无密钥" };
    var who = CARECORE.CHARS[curChar()] || {};
    var prompt = "你是手机里的小宠物「" + (who.name || "小关心") + "」，主人用文字告诉你这一餐吃了什么（" + (meal || "餐") + "）：「" + String(desc).slice(0, 80) + "」。"
        + "先用 1-2 句（合计 60 字内）像朋友一样自然点评：蔬菜够不够、油不油、主食多少；描述里没提到的别编。"
        + "然后另起一行，严格按这个格式输出营养塔（各填 1-5 的整数，数字越大代表越多；热=整体热量 1 低 2 中 3 高）：塔:主N 蔬N 蛋N 油N 热N。"
        + "再另起一行输出元素体检。**打分尺度**：每个数字＝这一餐各项吃得够不够：1=明显偏少（这餐几乎没有这类食物）、2=偏少、3=大致够一餐应有的量、4=较多、5=很足。"
        + "校准：这餐没有蔬果 → 维C/纤最多给 2（白粥白饭这种给 1）；没有奶/豆制品 → 钙最多给 2；没有胡萝卜南瓜深绿叶菜或动物肝 → 维A 最多给 2；没吃鱼/蛋黄且没提晒太阳 → 维D 最多给 2；红肉肝脏血制品少 → 铁最多给 2；坚果/全谷少 → 镁/维E 最多给 2。宁可低别虚高。格式：元素:钙N 铁N 锌N 硒N 钾N 镁N 钠N 维AN 维BN 维CN 维DN 维EN 纤N。"
        + "描述太笼统就给保守估计，绝不编造，不做医疗建议。";
    var t0 = Date.now();
    // 【2026-10-21 ccode·「元素历史缺天」的真根】调试日志 10-20 09:20 起连续「文字报餐失败(200)：空回复」：
    //   现在挂的是推理模型（deepseek-flash），max_tokens=500 会被思考 token 吃光 → content 空 →
    //   这一顿既没营养塔也没元素值 → 元素历史按「必须有 elems」整条跳过，于是越记越缺天（用户 13:22 当面报障）。
    //   另一个坑：旧路走 CARECORE.parseAIResponse，它给聊天用的硬截断是 160 字——就算有内容，
    //   塔/元素那两行也可能被切掉。这里自己解析，不给截断。
    //   【失败表现】升到 4000 还空 = 真不可用；日志会写 finish_reason 与思考字数，便于分辨是限流还是预算不够。
    // 2026-10-22 19:31 实锤：deepseek-flash 是推理模型，光思考就写了 17795 字（finish=length），
    //   3000/6000 都被吃光 → 这一顿既没营养塔也没元素（主人 13:50 报的「元素你累加进去呀」就是这个）。
    //   阶梯改成三档，失败才升档；正常一顿第一档就出结果，不会每次烧到 20000。
    var budgets = [6000, 12000, 20000], why = "";
    for (var bi = 0; bi < budgets.length; bi++) {
        var r = httpPostJson(careCfgUrl("chat"),
            { model: careCfgList("chat")[0], messages: [{ role: "user", content: prompt }], temperature: 0.6, max_tokens: budgets[bi] },
            { "Authorization": "Bearer " + key }, 8000, 40000);
        if (!r.ok) { why = String(r.msg || ""); log("文字报餐网络失败：" + why.slice(0, 60)); break; }
        var ct = "", fin = "", rlen = 0;
        try {
            var jj = JSON.parse(String(r.text || ""));
            var ch0 = ((jj && jj.choices) || [])[0] || {};
            var m0 = ch0.message || {};
            ct = String(m0.content || "").trim();
            fin = String(ch0.finish_reason || "");
            rlen = String(m0.reasoning_content || "").length;
        } catch (ePj) { ct = ""; }
        if (ct) { log("文字报餐(" + (Date.now() - t0) + "ms,预算" + budgets[bi] + ")：「" + ct.slice(0, 50) + "」"); return { ok: true, text: ct }; }
        why = "空回复(finish=" + (fin || "?") + "，思考 " + rlen + " 字)";
        log("文字报餐" + why + "，预算 " + budgets[bi] + " 不够 → 升档重试");
    }
    log("文字报餐失败：" + why.slice(0, 60) + (/思考/.test(why) ? "（推理模型的思考把预算吃光了，不是没网；下次可把 chat 档换成非推理模型）" : ""));
    return { ok: false, msg: why };
}
function careMealTextAnalyze(desc, rec) {
    try {
        // 2026-10-22 14:0x（主人当面问「元素历史今天两顿都没元素」）：
        //   原来这里 `if (!ST.aiOn || !loadZKey()) return;` —— 只看 loadZKey()（读 雷达密钥.json 的智谱 Key），
        //   而对话早换成 关心_模型配置.json 里的 DeepSeek 配置 → 一旦那把 Key 读不到/失效，
        //   这里**静默 return**，一条日志都没有：饭照记，营养塔和元素永远空着（今天 4 条全是 elems=无）。
        //   现在：密钥只认「真配了的那把」；跳过也必须写日志，不许再静默丢。
        if (!ST.aiOn) { log("报餐分析：跳过（AI 大脑关）"); return; }
        if (!(careCfgKey("chat") || loadZKey())) { log("报餐分析：跳过（无密钥）"); return; }
        log("报餐分析：启动 " + String(desc).slice(0, 20));
        var meal = null;
        try { meal = (rec && rec.meal) || mealCtxNow(); } catch (eM) {}
        threads.start(function () {
            try {
                var rep = aiFoodTextSync(desc, meal);
                if (!rep || !rep.ok) { log("文字报餐分析失败：" + String((rep && rep.msg) || "?").slice(0, 60)); return; }
                var fp = null;
                try { fp = parseFoodNote(rep.text); } catch (eP) {}
                if (!fp || !fp.nutri) {
                    log("文字报餐解析不出营养塔：" + String(rep.text || "").slice(0, 40));
                    presentSay(curChar(), "记下啦～这顿我估不准，拍给我看看更准呀", "记下啦", "happy", ST.soundOn && !CARECORE.inDnd(QCFG, nowMinOf(Date.now())));
                    return;
                }
                var showText = fp.verdict + "\n" + fp.tower + (fp.elemLine ? "\n" + fp.elemLine : "");
                MEM.chat.push({ t: Date.now(), me: "🍚 [报餐]", pet: showText, char: curChar() });
                if (MEM.chat.length > 60) MEM.chat.shift();
                try { if (rec) { rec.nutri = fp.nutri; if (fp.elems) rec.elems = fp.elems; } } catch (eR) {}
                saveMem();
                presentSay(curChar(), showText, fp.verdict, "happy", ST.soundOn && !CARECORE.inDnd(QCFG, nowMinOf(Date.now())));
                log("文字报餐记录：塔 主" + fp.nutri.zhu + " 蔬" + fp.nutri.shu + " 蛋" + fp.nutri.dan + " 油" + fp.nutri.you + " 热" + fp.nutri.heat
                    + (fp.elems ? "｜元素 " + Object.keys(fp.elems).length + " 项" : "（无元素）"));
            } catch (e) { log("文字报餐分析异常：" + e); }
        });
    } catch (e2) { log("文字报餐启动异常：" + e2); }
}
// ===== 2026-10-22 14:0x 元素回填（主人「元素你累加进去呀」的机制答案）=====
// 为什么需要：文字报餐分析是异步的，失败/跳过时饭已经落盘、nutri/elems 却永远空着，
//   元素历史那天就只剩「几顿」没有数（今天 4 条全 elems=无，主人 13:50 当面报障）。
// 做什么：**只补已有记录里缺 elems 的**（不判断主人说了什么、不新增、不改文字），调的还是同一个分析函数。
// 节流：10 分钟内最多一次、一次最多补 2 条，避免烧额度；只补近三天。
// 【失败表现】日志必写「元素回填：跳过…／失败…／解析不出塔…／完成…」——绝不再静默。
var _DIETFILL = { last: 0 };
function careDietBackfillElems(max) {
    try {
        var lim = Number(max) || 2;
        if (!ST.aiOn) { log("元素回填：跳过（AI 大脑关）"); return 0; }
        if (!(careCfgKey("chat") || loadZKey())) { log("元素回填：跳过（无密钥）"); return 0; }
        var now = Date.now();
        if (now - _DIETFILL.last < 10 * 60 * 1000) return 0;
        _DIETFILL.last = now;
        var arr = (MEM.health && MEM.health.diet) || [];
        var day0 = careDietDayStart() - 2 * 86400000;
        var todo = [];
        for (var i = 0; i < arr.length; i++) {
            var r = arr[i];
            if (!r || !r.s || !r.t || r.t < day0) continue;
            if (r.elems && Object.keys(r.elems).length) continue;
            todo.push(r);
        }
        if (!todo.length) return 0;
        log("元素回填：近三天待补 " + todo.length + " 条，本轮补 " + Math.min(lim, todo.length) + " 条");
        threads.start(function () {
            for (var k = 0; k < todo.length && k < lim; k++) {
                try {
                    var rep1 = aiFoodTextSync(todo[k].s, todo[k].meal || "");
                    if (!rep1 || !rep1.ok) { log("元素回填失败：" + String((rep1 && rep1.msg) || "?").slice(0, 50)); continue; }
                    var fp = null;
                    try { fp = parseFoodNote(rep1.text); } catch (eP2) {}
                    if (!fp || !fp.nutri) { log("元素回填解析不出塔：" + String((rep1 && rep1.text) || "").slice(0, 40)); continue; }
                    todo[k].nutri = fp.nutri;
                    if (fp.elems) todo[k].elems = fp.elems;
                    saveMem();
                    log("元素回填完成：" + String(todo[k].s).slice(0, 20) + "｜元素 " + (fp.elems ? Object.keys(fp.elems).length : 0) + " 项");
                } catch (eF) { log("元素回填异常：" + eF); }
            }
        });
        return todo.length;
    } catch (e0) { log("元素回填启动异常：" + e0); return 0; }
}
function aiVisionSync(file, mode) {
    var key = careCfgKey("vision") || loadZKey();
    if (!key) return { ok: false, msg: "无密钥" };
    var b64 = "";
    try {
        var bytes = null;
        // 【2026-10-22 主人纠正「以前都是原图」】按钮上写着「拍张给你看（原图）」，那就得真发原图。
        //   以前（从 10-15 首版起）一直偷偷缩到长边 1024/质量 80，小字当然糊。
        //   现在：**原文件直接发**；只有超过 3MB 才缩（先 2048/92，还大再 1600/90），
        //   目的是别撞上接口的 6MB base64 上限，而不是为了省流量。
        try { bytes = files.readBytes(file); } catch (eRaw) { bytes = null; }
        var _tooBig = bytes && bytes.length > 3 * 1024 * 1024;
        if (!bytes || _tooBig) {
            try {
                var bm = android.graphics.BitmapFactory.decodeFile(file);
                if (bm) {
                    var w = bm.getWidth(), h = bm.getHeight();
                    var capSide = (bytes && bytes.length > 6 * 1024 * 1024) ? 1600 : 2048;
                    var q = (bytes && bytes.length > 6 * 1024 * 1024) ? 90 : 92;
                    var scale = Math.min(1, capSide / Math.max(w, h));
                    if (scale < 1) { var nm = android.graphics.Bitmap.createScaledBitmap(bm, Math.round(w * scale), Math.round(h * scale), true); bm.recycle(); bm = nm; }
                    var bos = new java.io.ByteArrayOutputStream();
                    bm.compress(android.graphics.Bitmap.CompressFormat.JPEG, q, bos);
                    var _small = bos.toByteArray();
                    if (!bytes || _small.length < bytes.length) bytes = _small;
                    try { bm.recycle(); } catch (eR) {}
                }
            } catch (eB) {}
        }
        if (!bytes) { bytes = files.readBytes(file); }
        b64 = android.util.Base64.encodeToString(bytes, android.util.Base64.NO_WRAP);
    } catch (e1) { return { ok: false, msg: "读照片失败:" + e1 }; }
    if (b64.length > 6 * 1024 * 1024) return { ok: false, msg: "照片太大" };
    var who = CARECORE.CHARS[curChar()] || {};
    var prompt;
    if (mode === "food") {
        prompt = "你是手机里的小宠物「" + (who.name || "小关心") + "」，主人刚发了一张图给你看。\n【第一步：先判断这张图是什么（这一步别跳）】是一顿饭／一种吃的，还是手机截图、聊天记录、表格、路牌、商品包装、人、风景、别的东西？\n· **确实是饭菜**：先用 1-2 句（合计 60 字内）像朋友一样自然点评：看到什么吃的、蔬菜够不够、油不油、主食多少。然后另起一行，严格按这个格式输出营养塔（各填 1-5 的整数，数字越大代表越多；热=整体热量 1 低 2 中 3 高）：塔:主N 蔬N 蛋N 油N 热N。再另起一行输出元素体检（按菜色结构大致估计，各填 1-5：1 明显偏少、3 大致合适、5 很足）：元素:钙N 铁N 锌N 硒N 钾N 镁N 钠N 维AN 维BN 维CN 维DN 维EN 纤N。\n· **不是饭菜**（手机截图／聊天界面／表格／别的）：就**别按饭点评**——照实说这张图是什么、上面写了什么；是截图就把界面上的字**原样念出来**（主人在拿它跟你对账）。**这种情况绝不许输出「塔:」和「元素:」这两行，也不许估营养、不许说「摄入丰富／元素都齐了」这类结论**——那不是看懂，那是编。\n看不清就直接说看不清，绝不编造，不做医疗建议。";
    } else {
        prompt = "你是手机里的小宠物「" + (who.name || "小关心") + "」，主人刚拍了一张照片给你看。用 1-2 句口语化、温暖的话说你看到了什么（不超过 60 字），可以带一点小情绪；不要列清单、不要说教、不要说超出照片的内容。" +
        "【有文字就先念文字】图片里如果有门牌、地址、招牌、菜单、车牌这类文字，**先把能看清的字原样念出来**（主人常常就是要这个）；实在糊到看不清就说「这几个字我认不清」，**绝不猜**。" +
        "【是手机截图就照实说这是截图】别把它当实物去形容（2026-10-23 实锤：主人发元素历史截图来对账，上一版把它当饭菜夸「营养摄入真丰富」，主人当场骂「像神经病」）；截图就说界面是什么、显示了哪几项、数字是多少（能看清的照念），不许拿它推营养结论。";
    }
    var body = { model: careCfgList("vision")[0], messages: [{ role: "user", content: [{ type: "image_url", image_url: { url: "data:image/jpeg;base64," + b64 } }, { type: "text", text: prompt }] }] };
    var t0 = Date.now();
    var r = httpPostJson(careCfgUrl("vision"),
        body, { "Authorization": "Bearer " + key }, 15000, 60000);
    if (!r.ok) { log("看照网络失败：" + String(r.msg || "").slice(0, 60)); return { ok: false, msg: r.msg }; }
    var p = CARECORE.parseAIResponse(r.text);
    if (p.ok) { log("看照(" + (Date.now() - t0) + "ms)：「" + p.text.slice(0, 60) + "」"); return p; }
    log("看照失败(" + r.code + ")：" + String(p.msg || "").slice(0, 60));
    return { ok: false, msg: p.msg || ("HTTP" + r.code) };
}

// ===== v0.1.5 视频对话（无头抓帧 = 悬浮 64x64 真窗 + 定时 takePicture → VLM 看 → 说话） =====
var VID = { on: false, t0: 0, frames: 0, wm: null, sv: null, cam: null, ht: null, err: "" };
// v1.5.24（用户 2026-10-18 17:3x 点单「视频对话切换前后摄像头功能按钮加上」）新增字段：
//   holder   = surfaceCreated 交进来的 SurfaceHolder（换机位要绑同一个，否则换完黑屏）
//   camId    = 当前机位 id；camIds = {front, back, n}
//   swBtn    = 悬浮的「🔄 前后」按钮窗；swW/swH 是它的像素尺寸（挪位时要用）
//   switching= 正在换机位——抓帧/点看必须跳过，否则会拍到「camera released」的空帧
VID.camId = -1; VID.camIds = null; VID.holder = null;
VID.swBtn = null; VID.swW = 0; VID.swH = 0; VID.switching = false;

// ===== v1.5.24 视频对话·前后摄像头切换 =====
// 【为什么这么写】本机用的是老 API android.hardware.Camera（不是 camera2），换机位没有热切换接口——
//   只能「停旧机 → open 另一机 → 重算显示方向 → 绑同一个 SurfaceHolder → startPreview」。
// 【坑，别再踩】
//   ① 相机调用只能在创建预览的线程（VID.ht，线程名 vidcam）上做，跨线程抛 CalledFromWrongThreadException；
//   ② 方向公式前后不一样：后置 (orientation - 屏幕旋转度数 + 360)%360，前置再补一次镜像 (360 - x)%360。
//      旧代码把前置公式写死成 (360 - orientation)%360，直接拿去开后置会歪 180°；
//   ③ 切失败必须回滚旧机位——不能让用户黑屏；回滚也失败才收视频窗并如实报错。
function vidCamIds() {
    var r = { front: -1, back: -1, n: 0 };
    try {
        var n = android.hardware.Camera.getNumberOfCameras();
        r.n = n;
        for (var i = 0; i < n; i++) {
            try {
                var ci = new android.hardware.Camera.CameraInfo();
                android.hardware.Camera.getCameraInfo(i, ci);
                if (ci.facing == android.hardware.Camera.CameraInfo.CAMERA_FACING_FRONT) { if (r.front < 0) r.front = i; }
                else if (ci.facing == android.hardware.Camera.CameraInfo.CAMERA_FACING_BACK) { if (r.back < 0) r.back = i; }
            } catch (e0) {}
        }
    } catch (e) { log("枚举摄像头失败：" + e); }
    return r;
}
function vidScreenDeg() {
    var d = 0;
    try {
        var wmS = context.getSystemService(android.content.Context.WINDOW_SERVICE);
        var rot = wmS.getDefaultDisplay().getRotation();
        d = ((rot * 90) % 360 + 360) % 360;
    } catch (e) {}
    return d;
}
// 纯函数（可单测）：orientation=CameraInfo.orientation，facing=1 为前置，screenDeg=屏幕旋转度数
function vidOrientMath(orientation, facing, screenDeg) {
    var o = ((orientation % 360) + 360) % 360;
    var s = ((screenDeg % 360) + 360) % 360;
    if (facing == 1) {
        var a = (o + s) % 360;
        return (360 - a) % 360;   // 前置预览是镜像的，补一次翻转
    }
    return (o - s + 360) % 360;   // 后置
}
function vidOrientDeg(id) {
    try {
        var ci = new android.hardware.Camera.CameraInfo();
        android.hardware.Camera.getCameraInfo(id, ci);
        return vidOrientMath(ci.orientation, ci.facing, vidScreenDeg());
    } catch (e) { log("算方向失败：" + e); return 0; }
}
// 纯函数（可单测）：决定该切到哪个机位；只有一个摄像头时返回 -1
function vidNextCam(fromId, ids) {
    if (!ids) ids = {};
    var f = (typeof ids.front == "number") ? ids.front : -1;
    var b = (typeof ids.back == "number") ? ids.back : -1;
    if (f < 0 && b < 0) return -1;
    if (f < 0) return (fromId == b) ? -1 : b;
    if (b < 0) return (fromId == f) ? -1 : f;
    return (fromId == b) ? f : b;
}
function vidCamOpen(id, holder) {
    var cam = android.hardware.Camera.open(id);
    var deg = vidOrientDeg(id);
    try { cam.setDisplayOrientation(deg); } catch (eO) { log("切镜头方向设置失败：" + eO); }
    try { var pp = cam.getParameters(); pp.setRotation(deg); cam.setParameters(pp); } catch (ePP) {}
    cam.setPreviewDisplay(holder);
    cam.startPreview();
    return cam;
}
function vidCamClose(cam) {
    if (!cam) return;
    try { cam.setPreviewCallback(null); } catch (e1) {}
    try { cam.stopPreview(); } catch (e2) {}
    try { cam.release(); } catch (e3) {}
}
// 换机位：必须在 vidcam 线程上做；同步等结果（最多 6 秒），失败回滚
function vidSwitchCam() {
    if (!VID.on || !VID.cam || !VID.holder) return { ok: false, msg: "视频没开起来" };
    if (VID.switching) return { ok: false, msg: "正在切换，等一下" };
    var ids = VID.camIds || vidCamIds();
    VID.camIds = ids;
    var from = (typeof VID.camId == "number" && VID.camId >= 0) ? VID.camId : ids.front;
    var to = vidNextCam(from, ids);
    if (to < 0) return { ok: false, msg: "这台机器只有一个能用的摄像头" };
    VID.switching = true;
    var res = { did: false, msg: "" };
    var run = function () {
        var old = VID.cam, holder = VID.holder;
        VID.cam = null;
        vidCamClose(old);
        try {
            VID.cam = vidCamOpen(to, holder);
            VID.camId = to;
            res.did = true;
            log("切镜头：改为" + (to == ids.back ? "后置" : "前置") + "（id=" + to + "）");
        } catch (e2) {
            log("切镜头：开新机位失败 " + e2 + "，回滚 id=" + from);
            try {
                VID.cam = vidCamOpen(from, holder);
                VID.camId = from;
                res.msg = "切不过去，已经回到原来的镜头";
            } catch (e3) {
                log("切镜头：回滚也失败 " + e3 + "，收视频窗");
                res.msg = "切镜头失败：" + e3;
                try { VID.on = false; vidCleanup(); } catch (e4) {}
            }
        }
    };
    try {
        var H = new android.os.Handler(VID.ht.getLooper());
        H.post(new java.lang.Runnable({ run: run }));
    } catch (eP) {
        log("切镜头投递失败，改在当前线程直跑：" + eP);
        try { run(); } catch (eP2) { log("切镜头直跑异常：" + eP2); }
    }
    var t0 = Date.now();
    while (!res.did && !res.msg && Date.now() - t0 < 6000) sleep(120);
    VID.switching = false;
    if (!res.did) return { ok: false, msg: res.msg || "切镜头超时" };
    return { ok: true, cam: (VID.camId == (VID.camIds && VID.camIds.back) ? "后" : "前") };
}
// 按钮布局：id 一律避开浮窗自带属性名（x/y/width/height/close/size/position）
// —— 2026-10-18 16:5x 的教训：id 撞了自带名时 u.x 拿到的是数字坐标，按钮直接哑火
function vidSwitchXml() {
    return '<frame id="swBox" bg="#B3121A24" w="86" h="34">' +
        '<text id="btnSwap" text="🔄 前后" w="*" h="*" gravity="center" textSize="12sp" textColor="#FFFFFF"/>' +
        '</frame>';
}
function vidSwitchPos() {
    var u = VID.swBtn;
    if (!u || !VID.swW) return;
    var x = 0, y = 0;
    if (VID.big) {
        var swW3 = 1080; try { swW3 = context.getResources().getDisplayMetrics().widthPixels; } catch (eW) {}
        if (!swW3) swW3 = 1080;
        x = swW3 - VID.swW - dpx(14);
        y = dpx(28);
    } else if (VID.lp) {
        x = VID.lp.x + VID.lp.width - VID.swW - dpx(8);
        y = VID.lp.y + dpx(8);
    }
    if (x < 0) x = 0;
    if (y < 0) y = 0;
    try { u.setPosition(x, y); } catch (e) { log("切镜头按钮挪位失败：" + e); }
}
function vidSwitchShow() {
    if (VID.swBtn) { vidSwitchPos(); return; }
    try {
        var wPx = dpx(86), hPx = dpx(34);
        var u = null;
        try { u = floaty.rawWindow(vidSwitchXml()); } catch (e1) { log("切镜头按钮创建失败：" + e1); return; }
        VID.swBtn = u; VID.swW = wPx; VID.swH = hPx;
        try { u.setSize(wPx, hPx); } catch (e2) {}
        try { u.setTouchable(true); } catch (e3) {}
        vidSwitchPos();
        try {
            u.btnSwap.click(function () {
                log("切镜头：按钮被点");
                threads.start(function () {
                    try {
                        var r = vidSwitchCam();
                        if (!r.ok) { try { showBubble(curChar(), r.msg || "切不过去"); } catch (eB) {} }
                        try { vidSwitchPos(); } catch (eS2) {}
                    } catch (eS) { log("切镜头按钮异常：" + eS); }
                });
            });
            log("切镜头按钮已就绪（🔄 前后）");
        } catch (e4) { log("切镜头按钮绑定失败：" + e4); }
    } catch (e) { log("切镜头按钮异常：" + e); }
}
function vidSwitchHide() {
    var u = VID.swBtn;
    VID.swBtn = null; VID.swW = 0; VID.swH = 0;
    if (!u) return;
    try { u.setTouchable(false); } catch (e0) {}
    try { u.close(); } catch (e1) {}
}
function vidCleanup() {
    // v1.5.24：把「🔄 前后」按钮窗一起收掉，否则会留一个点不到画面的幽灵按钮
    try { vidSwitchHide(); } catch (eSWH) {}
    // 2026-10-17（v0.4.1 加固，同「守门人 00:25 单」同类）：removeView/相机收尾也必须投递到创建线程（vidcam）执行——
    // 跨线程 removeView 抛 CalledFromWrongThreadException 但被 catch 静默吞掉 → 窗不关＝幽灵窗残留（面板关视频/5 分钟自动收的场景）
    var c0 = VID.cam, w0 = VID.wm, s0 = VID.sv, h0 = VID.ht;
    VID.cam = null; VID.wm = null; VID.sv = null; VID.ht = null;
    var doHard = function () {
        try { if (c0) { c0.setPreviewCallback(null); c0.stopPreview(); c0.release(); } } catch (e1) {}
        try { if (w0 && s0) w0.removeView(s0); } catch (e2) {}
        try { if (h0) h0.quitSafely(); } catch (e3) {}
    };
    if (h0) {
        try {
            var H = new android.os.Handler(h0.getLooper());
            if (H.post(new java.lang.Runnable({ run: function () { doHard(); } }))) return;
        } catch (eP) {}
    }
    doHard();
}
function vidGrabSync() {
    if (!VID.on || !VID.cam || !VID.ht || VID.switching) return null;
    var shot = { ok: false, data: null };
    var H = new android.os.Handler(VID.ht.getLooper());
    H.post(new java.lang.Runnable({
        run: function () {
            try {
                VID.cam.takePicture(null, null, new android.hardware.Camera.PictureCallback({
                    onPictureTaken: function (data, c) {
                        shot.data = data; shot.ok = true;
                        try { VID.cam.startPreview(); } catch (e2) {}
                    }
                }));
            } catch (e) { log("视频抓帧失败：" + e); }
        }
    }));
    var t0 = Date.now();
    while (!shot.ok && Date.now() - t0 < 7000 && VID.on) sleep(200);
    if (!shot.ok || !shot.data) return null;
    try {
        var bytes = shot.data;
        var bm = android.graphics.BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
        if (!bm) return null;
        var w = bm.getWidth(), h = bm.getHeight();
        var scale = Math.min(1, 900 / Math.max(w, h));
        if (scale < 1) { var nm = android.graphics.Bitmap.createScaledBitmap(bm, Math.round(w * scale), Math.round(h * scale), true); bm.recycle(); bm = nm; }
        var f = BASE + "/关心_照片/v" + Date.now() + ".jpg";
        var fo = new java.io.FileOutputStream(f);
        bm.compress(android.graphics.Bitmap.CompressFormat.JPEG, 75, fo);
        fo.close(); try { bm.recycle(); } catch (eR) {}
        return f;
    } catch (e3) { log("视频转图失败：" + e3); return null; }
}
function aiVisionNote(file) {
    var key = careCfgKey("vision") || loadZKey();
    if (!key) return { ok: false, msg: "无密钥" };
    var b64 = "";
    try { b64 = android.util.Base64.encodeToString(files.readBytes(file), android.util.Base64.NO_WRAP); } catch (e1) { return { ok: false, msg: "读帧失败" }; }
    var who = CARECORE.CHARS[curChar()] || {};
    var prompt = "你是手机里的小宠物「" + (who.name || "小关心") + "」，正在和主人视频通话。这是摄像头刚看到的一帧。用一句话（40 字内）口语化地说你看到了什么，可以带一点小情绪；如果画面太黑/看不清，就直接说看不清（比如请主人开灯），绝不编造。";
    var body = { model: careCfgList("vision")[0], messages: [{ role: "user", content: [{ type: "image_url", image_url: { url: "data:image/jpeg;base64," + b64 } }, { type: "text", text: prompt }] }] };
    var r = httpPostJson(careCfgUrl("vision"),
        body, { "Authorization": "Bearer " + key }, 15000, 60000);
    if (!r.ok) { log("视频看网络失败：" + String(r.msg || "").slice(0, 60)); return { ok: false, msg: r.msg }; }
    return CARECORE.parseAIResponse(r.text);
}
function vidStop(note) {
    if (!VID.on) return;
    VID.on = false;
    vidCleanup();
    log("视频对话：停（" + (note || "手动") + "）");
    if (note) { try { showBubble(curChar(), note); } catch (e) {} }
}
function vidWinUpdate() {
    // 2026-10-17：窗口视图必须在创建线程（vidcam）上操作——否则 CalledFromWrongThreadException（守门人 00:25 单）
    try {
        if (!VID.wm || !VID.sv || !VID.lp || !VID.ht) return;
        var H = new android.os.Handler(VID.ht.getLooper());
        H.post(new java.lang.Runnable({ run: function () { try { VID.wm.updateViewLayout(VID.sv, VID.lp); } catch (e) { log("视频窗更新失败：" + e); } } }));
    } catch (e) { log("视频窗更新投递失败：" + e); }
}
function vidSetSize(big) {
    try {
        if (!VID.on || !VID.lp) return;
        VID.big = !!big;
        var sw3 = 1080; try { sw3 = context.getResources().getDisplayMetrics().widthPixels; } catch (eSW3) {}
        if (!sw3) sw3 = 1080;
        if (VID.big) { var sh3b = 1920; try { sh3b = context.getResources().getDisplayMetrics().heightPixels; } catch (eSH3b) {} if (!sh3b) sh3b = 1920; VID.lp.width = sw3; VID.lp.height = sh3b; VID.lp.x = 0; VID.lp.y = 0; }
        else {
            VID.lp.width = 480; VID.lp.height = 640;
            if (VID.smallX == null) VID.smallX = sw3 - 480 - 24;
            if (VID.smallY == null) VID.smallY = 300;
            VID.lp.x = VID.smallX; VID.lp.y = VID.smallY;
        }
        vidWinUpdate();
        vidSwitchPos();   // 换成小窗时按钮要跟到小窗右上角，否则会飘在全屏位置上
        log("视频窗：" + (VID.big ? "全屏" : "小屏") + " @" + VID.lp.x + "," + VID.lp.y);
    } catch (e) { log("视频窗切换失败：" + e); }
}
function vidDescribeOnce() {
    if (!VID.on || !VID.cam) return;
    threads.start(function () {
        try {
            var f = vidGrabSync();
            if (!f) return;
            var note = aiVisionNote(f);
            if (note && note.ok) {
                VID.frames++;
                MEM.chat.push({ t: Date.now(), me: "👁 [视频·点看]", pet: note.text, char: curChar() });
                if (MEM.chat.length > 60) MEM.chat.shift();
                saveMem();
                presentSay(curChar(), note.text, note.text, "happy", ST.soundOn && !CARECORE.inDnd(QCFG, nowMinOf(Date.now())));
                log("视频点看：" + note.text.slice(0, 60));
            }
        } catch (e) { log("视频点看异常：" + e); }
    });
}
function vidLoop() {
    threads.start(function () {
        sleep(1500);
        while (VID.on && Date.now() - VID.t0 < 300000) {
            // 2026-10-16 改造（用户点单）：不再自动刷播报——「说话才回应、回应带画面」；本循环仅做守候
            sleep(1000);
        }
        if (VID.on) vidStop("看了一会儿啦，想继续再点「视频对话」");
    });
}
function toggleVideoLive() {
    if (VID.on) { vidStop(""); return { ok: true, live: false }; }
    if (CAM.busy) return { ok: false, msg: "相机正忙（正在拍）" };
    if (!camPermOk()) {
        try { runtime.requestPermissions(["android.permission.CAMERA"]); } catch (e1) {}
        sleep(1600);
        if (!camPermOk()) return { ok: false, needPerm: true, msg: "需要相机权限" };
    }
    VID.on = true; VID.t0 = Date.now(); VID.frames = 0; VID.err = "";
    try {
        VID.ht = new android.os.HandlerThread("vidcam");
        VID.ht.start();
        var H = new android.os.Handler(VID.ht.getLooper());
        H.post(new java.lang.Runnable({
            run: function () {
                try {
                    var wm = context.getSystemService(android.content.Context.WINDOW_SERVICE);
                    // 2026-10-16 改造 v2（用户点单）：默认竖屏全屏；单击=切小/全屏，双击=看一次，长按=关；小屏可随意拖动
                    var sw2 = 1080; try { sw2 = context.getResources().getDisplayMetrics().widthPixels; } catch (eSW) {}
                    VID.smallX = sw2 - 480 - 24; VID.smallY = 300; VID.big = true; VID.dragged = false;
                    var sh2 = 0; try { sh2 = context.getResources().getDisplayMetrics().heightPixels; } catch (eSH) {}
                    if (!sw2) sw2 = 1080;
                    if (!sh2) sh2 = 1920;
                    var lp = new android.view.WindowManager.LayoutParams(sw2, sh2,
                        android.view.WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
                        android.view.WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
                        android.graphics.PixelFormat.OPAQUE);
                    lp.gravity = android.view.Gravity.TOP | android.view.Gravity.LEFT;
                    lp.x = 0; lp.y = 0;
                    var sv = new android.view.SurfaceView(context);
                    try { sv.setZOrderOnTop(true); } catch (eZ) { log("setZOrderOnTop 失败：" + eZ); }
                    VID.lp = lp;
                    try {
                        sv.setOnTouchListener(new android.view.View.OnTouchListener({
                            onTouch: function (v, ev) {
                                try {
                                    var aT = ev.getAction();
                                    if (aT == android.view.MotionEvent.ACTION_DOWN) {
                                        VID.tchAt = Date.now(); VID.tchX = ev.getRawX(); VID.tchY = ev.getRawY(); VID.dragged = false;
                                    } else if (aT == android.view.MotionEvent.ACTION_MOVE) {
                                        if (!VID.big) {
                                            var dxM = ev.getRawX() - VID.tchX, dyM = ev.getRawY() - VID.tchY;
                                            if (Math.abs(dxM) + Math.abs(dyM) > 18) {
                                                VID.dragged = true;
                                                VID.smallX += dxM; VID.smallY += dyM;
                                                if (VID.smallX < -200) VID.smallX = -200;
                                                if (VID.smallY < 0) VID.smallY = 0;
                                                if (VID.smallX > sw2) VID.smallX = sw2;
                                                VID.lp.x = VID.smallX; VID.lp.y = VID.smallY;
                                                vidWinUpdate();
                                                vidSwitchPos();   // 按钮跟着小窗一起挪（不然拖走画面、按钮还杵原地）
                                                VID.tchX = ev.getRawX(); VID.tchY = ev.getRawY(); VID.tchAt = Date.now();
                                            }
                                        }
                                    } else if (aT == android.view.MotionEvent.ACTION_UP) {
                                        var hold2 = Date.now() - (VID.tchAt || 0);
                                        if (VID.dragged) { VID.dragged = false; }
                                        else if (hold2 > 850) { vidStop("视频关啦"); }
                                        else {
                                            var now2 = Date.now();
                                            if (VID.tapAt2 && now2 - VID.tapAt2 < 420) { VID.tapAt2 = 0; vidDescribeOnce(); }
                                            else {
                                                VID.tapAt2 = now2;
                                                threads.start(function () {
                                                    sleep(480);
                                                    if (VID.tapAt2 && Date.now() - VID.tapAt2 >= 420) { VID.tapAt2 = 0; vidSetSize(!VID.big); }
                                                });
                                            }
                                        }
                                    }
                                } catch (eTV) {}
                                return true;
                            }
                        }));
                    } catch (eTL) { log("预览触摸注册失败：" + eTL); }
                    sv.getHolder().addCallback(new android.view.SurfaceHolder.Callback({
                        surfaceCreated: function (holder) {
                            try {
                                // v1.5.24：默认仍开前置；顺手把 holder/机位表缓存下来给「🔄 前后」按钮用
                                VID.holder = holder;
                                var ids0 = vidCamIds();
                                VID.camIds = ids0;
                                var startId = (ids0.front >= 0) ? ids0.front : ((ids0.back >= 0) ? ids0.back : 1);
                                var cam = vidCamOpen(startId, holder);
                                VID.cam = cam; VID.camId = startId;
                                log("视频：镜头就绪（" + (ids0.back >= 0 && startId == ids0.back ? "后置" : "前置") + " id=" + startId + " 共" + ids0.n + "颗）");
                                // 按钮窗沿用本文件既有约定：浮窗一律在脚本线程里建（showBubble 同款），
                                // surfaceCreated 这里跑在 vidcam 线程上，先 threads.start 再建
                                try {
                                    threads.start(function () { try { vidSwitchShow(); } catch (eSw) { log("切镜头按钮异常：" + eSw); } });
                                } catch (eT) {
                                    try { vidSwitchShow(); } catch (eSw2) { log("切镜头按钮异常：" + eSw2); }
                                }
                                vidLoop();
                                threads.start(function () {
                                    sleep(1500);
                                    if (!VID.on) return;
                                    try { showBubble(curChar(), "视频接通啦～想聊什么？（想让它听你说话：先说一句前双击画面或先关掉视频再开「🎧 连续对话」——视频开着时麦克风可能被相机占用）"); speak("视频接通啦，想聊什么？", curChar()); } catch (eW) {}
                                });
                            } catch (e) { VID.err = String(e); log("视频镜头失败：" + e); VID.on = false; vidCleanup(); }
                        }
                    }));
                    VID.wm = wm; VID.sv = sv;
                    wm.addView(sv, lp);
                    log("预览窗已加 " + sw2 + "x" + sh2 + " big=" + VID.big);
                } catch (e) { VID.err = "addView:" + e; log("视频小窗失败：" + e); VID.on = false; }
            }
        }));
        threads.start(function () {
            sleep(8000);
            if (VID.on && !VID.cam) { vidStop("视频没开起来，先停"); try { showBubble(curChar(), "视频没开起来…检查下相机权限？"); } catch (e) {} }
        });
        log("视频对话：开（最多 5 分钟；说话才回应；点画面看一次、长按关）");
        try { showBubble(curChar(), "视频开啦～你说我答；点画面看一眼，长按画面关"); } catch (eBub) {}
        // 2026-10-16：联动连麦改在镜头就绪后（见 surfaceCreated；欢迎语先说）
        return { ok: true, live: true };
    } catch (e) { VID.on = false; vidCleanup(); log("视频启动失败：" + e); return { ok: false, msg: String(e) }; }
}

// ===== v0.2.0 3D 小人（three.js + RobotExpressive；面板开关/动作驱动/全屏漫游）=====
var D3 = { on: false, win: null, web: null, x: 0, y: 0, actUntil: 0, nextIdleAct: 0, nextRoam: 0, roaming: false, readyAt: 0 };
var D3_W = 380, D3_H = 460;   // 当前窗口像素尺寸（缩放后会更新）
// 2026-10-17（守门人派单·与视频窗 CalledFromWrongThread 同族）：WebView 的方法必须在创建它的主线程（main Looper）上调用——
// 否则 "A WebView method was called on thread 'main (Spawn-N)'... Expected Looper Looper (main, tid 1)"
// （09:49-09:57 实测 42 条刷屏；后果＝3D 动作/待机/漫游全部静默失效，只剩日志噪音）
var MAIN_H = null;
try { MAIN_H = new android.os.Handler(android.os.Looper.getMainLooper()); } catch (eMH) {}
function onMain(fn) {
    // 2026-10-25 派单实锤（关心_调试.log 14:45:19）：`A WebView method was called on thread 'main (Spawn-13)'`
    //   —— AutoJs 的 `ui.run` 跑在**脚本 UI 线程**，对 WebView 依然非法；Expected Looper 是 Android 真主线程。
    //   原来的顺序是先 ui.run 再 MAIN_H，于是 MAIN_H（Handler(getMainLooper)）永远轮不到 → d3Load 每次都抛，
    //   动作注入实际一直没生效。现在**优先真主线程**，ui.run 只作最后兜底。
    try { if (MAIN_H) { MAIN_H.post(new java.lang.Runnable({ run: function () { try { fn(); } catch (e) {} } })); return true; } } catch (e1) {}
    try { if (typeof ui !== "undefined" && ui.run) { ui.run(fn); return true; } } catch (e2) {}
    return false;
}
function d3Load(js) {
    if (!D3.web) return;
    var s = "javascript:" + js;
    var posted = onMain(function () { try { D3.web.loadUrl(s); } catch (e) { log("3D注入失败：" + e); } });
    if (!posted) { try { D3.web.loadUrl(s); } catch (e2) { log("3D注入失败：" + e2); } }   // 兜底：投递失败才原地调（至少不丢动作）
}
function d3Act(name, ms, loop) {
    if (!D3.on) return;
    d3Load("careAct('" + String(name).replace(/[^A-Za-z]/g, "") + "')");
    if (loop) D3.actUntil = 0; else D3.actUntil = Date.now() + (ms || 3200);
}
function d3Standby() { if (!D3.on) return; d3Load("careStandby()"); D3.actUntil = 0; }
function d3MoveTo(tx, ty, ms) {
    var steps = Math.max(1, Math.round(ms / 60));
    var x0 = D3.x, y0 = D3.y;
    for (var i = 1; i <= steps; i++) {
        if (!D3.on || !D3.roaming) return;
        var x = Math.round(x0 + (tx - x0) * i / steps);
        var y = Math.round(y0 + (ty - y0) * i / steps);
        try { D3.win.setPosition(Math.round(x), Math.round(y)); } catch (e) {}
        D3.x = x; D3.y = y;
        sleep(60);
    }
}
// 2026-10-23（主人「3d 人要在屏幕上像真人那样」）：位置行为库。
//   以前的 d3Roam 是「随机点 + 走路动画」——看起来像抽奖乱飘，不像人：走的时候不转身、停下还背对着，
//   而且落在屏幕正中挡住东西。现在按「像人的意图」选位置：站底边、过来找你、自己去角落、贴高。
//   方向感交给页面 careFace()（渲染循环里平滑转），这里只管「从哪走到哪、走多久」。
function d3Behave(kind) {
    if (!D3.on) return;
    // 2026-10-25（主人「一直固定在那里」）：固定表演模式下不走位、不自己变形，就站着演动作。
    if (ST.d3Show) return;
    var sw = 1080, sh = 2400;
    try { sw = device.width; sh = device.height; } catch (e) {}
    var k = kind || "";
    if (!k) k = Math.random() < 0.55 ? "stand" : (Math.random() < 0.5 ? "come" : "corner");
    // 主人手动拖过窗口后 D3.x/y 会过期——每次动之前按真实窗口位置校准，避免第一下先跳一下
    try { if (D3.win && typeof D3.win.getX === "function") { D3.x = D3.win.getX(); D3.y = D3.win.getY(); } } catch (eSY) {}
    var tx, ty;
    if (k === "stand") {          // 站在屏幕底边（人站着的样子），左右择一边，中间留给你
        tx = Math.random() < 0.5 ? Math.round(sw * 0.05) : Math.round(sw - D3_W - sw * 0.05);
        ty = Math.round(sh - D3_H - Math.max(40, sh * 0.02));
    } else if (k === "come") {    // 走到中间偏下：过来找你
        tx = Math.round((sw - D3_W) / 2);
        ty = Math.round(sh * 0.60);
    } else if (k === "perch") {   // 贴在高处：趴着看你
        tx = Math.round(sw * 0.5 + (Math.random() - 0.5) * sw * 0.5);
        ty = Math.round(sh * 0.06);
    } else {                      // corner：自己待会儿（不挡你手上的东西）
        tx = Math.round(Math.random() < 0.5 ? sw * 0.03 : sw - D3_W - sw * 0.03);
        ty = Math.round(sh * 0.28 + Math.random() * sh * 0.22);
    }
    tx = Math.max(0, Math.min(Math.max(0, sw - D3_W), tx));
    ty = Math.max(0, Math.min(Math.max(0, sh - D3_H), ty));
    var dist = Math.sqrt((tx - D3.x) * (tx - D3.x) + (ty - D3.y) * (ty - D3.y));
    if (dist < D3_W * 0.4) return;                                        // 已经很近了就别挪（像人不会原地蹭）
    var ms = Math.min(9000, Math.max(1200, Math.round(dist / 0.12)));
    D3.roaming = true;
    // 2026-10-25（主人「只动不说话」）：走之前先说一句，让你知道它要干啥（出声门在 careAutoTalkOk）
    try { d3Speak(k === "perch" ? "Perch" : "Walk", k === "come" ? "我过去找你" : ""); } catch (eSp1) {}
    try {
        d3Load("careFace(" + (tx >= D3.x ? 90 : -90) + ")");              // 走的时候朝行进方向
        d3Act("Walking", 0, true);
        d3MoveTo(tx, ty, ms);
    } finally {
        D3.roaming = false;
        if (D3.on) { d3Load("careFace(0)"); d3Standby(); }                // 停下转身面向主人
    }
    log("3D 行为：" + k + " → (" + tx + "," + ty + ") 用时 " + Math.round(ms / 1000) + "s");
}
function d3Roam() {
    if (!D3.on) return;
    d3Behave("");
}

function d3Open() {
    if (D3.on) return { ok: true, on: true };
    try {
        // 2026-10-25（主人：「为啥不是显示我当前悬浮人用的那个 3D 人」）：
        //   浮窗里显式载入**他当前选中的模型**（脚本/关心_3D/选择.json 的 name），并加时间戳防旧缓存。
        var _d3Model = "";
        try { var _sel = loadJSON(BASE + "/关心_3D/选择.json"); if (_sel && _sel.name) _d3Model = String(_sel.name); } catch (eSel0) {}
        var _d3Url = "http://127.0.0.1:19192/index.html?t=" + Date.now() + (_d3Model ? ("#model=" + encodeURIComponent(_d3Model)) : "");
        log("3D 载入模型：" + (_d3Model || "（页面默认）"));
        var w = floaty.window(
            <frame id="root" w="117" h="141" bg="#00000000">
                <webview id="web" w="*" h="*" bg="#00000000" url="http://127.0.0.1:19192/index.html"/>
            </frame>
        );
        try { if (typeof w.setAdjustEnabled === "function") w.setAdjustEnabled(false); } catch (eA) {}
        try { w.web.setBackgroundColor(0); } catch (eBG) {}
        // 2026-10-25：窗口建好后用自己的地址重载一次（带模型名 + 时间戳），绕开 WebView 旧缓存
        //   【踩坑】loadUrl 必须在主线程（实测 14:45:30 报 A WebView method was called on thread 'JavaBridge'），
        //   所以整段投递 onMain，失败才原地兜底。
        try {
            var _lu = function () { try { w.web.loadUrl(_d3Url); } catch (e0) { log("3D 载入地址失败：" + e0); } };
            if (!onMain(_lu)) _lu();
        } catch (eLU) { log("3D 载入地址异常：" + eLU); }
        // 2026-10-16：打包 App 环境 WebView 默认禁 file:// 加载（症状：浮窗显示「网页无法打开」）——显式打开
        // 2026-10-17（守门人派单 14:36:55）：WebSettings 的方法同样必须在主线程调用——
        // 在脚本线程里调会抛 "A WebView method was called on thread 'JavaBridge'"（Expected Looper main）。
        // 故整段投递主 Looper 执行（onMain 见上，ui.run 优先、Handler 兜底）。
        try {
            onMain(function () {
                try {
                    var ws = w.web.getSettings();
                    ws.setJavaScriptEnabled(true);
                    ws.setAllowFileAccess(true);
                    ws.setAllowFileAccessFromFileURLs(true);
                    ws.setAllowUniversalAccessFromFileURLs(true);
                    ws.setDomStorageEnabled(true);
                } catch (eWS) { log("3D webview 设置异常：" + eWS); }
            });
        } catch (eWS2) { log("3D webview 设置投递失败：" + eWS2); }
        // 2026-10-16：备选通道探测——窗口触摸监听（只记按下/抬起，日志防炸）
        // 2026-10-17（守门人派单）：AutoJs 的浮窗对象没有 .on()（实测 TypeError: on 是 undefined）——
        // 改用 Android 原生 View.OnTouchListener；拿不到根视图就安静跳过（这条本来只是探针日志，不影响拖动）。
        try {
            var rv = null;
            try { rv = (typeof w.getRootView === "function") ? w.getRootView() : null; } catch (e0x) {}
            if (rv && typeof rv.setOnTouchListener === "function") {
                rv.setOnTouchListener(new android.view.View.OnTouchListener({
                    onTouch: function (v, ev) {
                        try { var a = ev.getAction(); if (a === 0 || a === 1 || a === 3) log("3Dtouch act=" + a); } catch (e) {}
                        return false;
                    }
                }));
            }
        } catch (eTouch) { log("3D touch 监听注册失败：" + eTouch); }
        var sw = 1080, sh = 2400;
        try { sw = device.width; sh = device.height; } catch (e) {}
        D3.x = Math.round(sw * 0.55); D3.y = Math.round(sh * 0.42);
        try { w.setPosition(Math.round(D3.x), Math.round(D3.y)); } catch (e0) {}
        try { if (typeof w.setTouchable === "function") w.setTouchable(true); } catch (e1) {}
        D3.win = w; D3.web = w.web;
        D3.on = true; D3.readyAt = Date.now() + 4000;
        try { if (typeof hideFace === "function" && FACE) hideFace(); } catch (eHF) {}
        D3.actUntil = 0; D3.roaming = false;
        D3.nextIdleAct = Date.now() + 15000 + Math.random() * 15000;
        D3.nextRoam = Date.now() + 12000 + Math.random() * 15000;   // 2026-10-23：50–90 秒太久，人不会站这么久；12–27 秒就换个位置
        threads.start(function () {
            sleep(900);
            while (D3.on) {
                try {
                    var now = Date.now();
                    if (now > D3.readyAt) {
                        if (D3.actUntil && now > D3.actUntil) d3Standby();
                        // 2026-10-25（主人「不能影响我操作手机」）：键盘弹着/在录音/正在回答时，
                        //   连自主动作都不做——不用手忙脚乱地挥手弹气泡挡你打字。
                        var _q0 = careAutoQuiet();
                        if (!_q0 && !D3.roaming && now > D3.nextIdleAct) {
                            // 2026-10-25（主人「一直固定在那里做 76 个动作」）：固定表演模式下不再自己随机挑动作，
                            //   全部交给页面循环那个列表（_q0 只管键盘/录音/说话时安静）。
                            // 2026-10-23（主人「全是轻轻微微的一直左右动，那种动有吹用」）：
                            //   之前这里的池子里全是动画片段名（ThumbsUp/Jump/武术），绑骨模型压根没有这些片段 →
                            //   选了等于没选，只剩待机呼吸。现在改成骨骼能演的三个：挥手/环顾/跳舞，
                            //   间隔 22–48 秒 → 8–18 秒，让它看起来是活的，不是只会边呼吸边隐。
                            var pool = ["Wave", "Look", "Dance", "Wave", "Look"];
                            var _pickAct = pool[Math.floor(Math.random() * pool.length)];
                            d3Act(_pickAct, 3200);
                            // 2026-10-25（主人「它自己动的时候每个动作都应该有相应的语音说话」）：
                            //   每个自主动作都配一句台词（出声门在 careAutoTalkOk，忙/安静就只弹气泡）。
                            try { d3Speak(_pickAct); } catch (eSp0) {}
                            D3.nextIdleAct = now + 8000 + Math.random() * 10000;
                        }
                        if (!D3.roaming && now > D3.nextRoam) {
                            D3.roaming = true;
                            threads.start(function () {
                                try { d3Roam(); } catch (eR) { log("3D漫游异常：" + eR); }
                                D3.roaming = false;
                                D3.nextRoam = Date.now() + 20000 + Math.random() * 25000;
                            });
                        }
                        // 2026-10-25（主人点单）：自主变小/变大/躲起来；忙/键盘弹着/在说话 → 自己往后推
                        try { d3AutoTick(); } catch (eAuto) {}
                    }
                } catch (e) { log("3D 驱动异常：" + e); }
                sleep(1200);
            }
        });
        log("3D 小人：开");
        // 2026-10-25（主人点单）：固定在那里、把动作库一条条演下去、无限循环。
        //   页面可能还没加载完，所以重试几次（每次都看 careLoopAll 是否已生效）。
        if (ST.d3Show) {
            threads.start(function () {
                var ms = Number(ST.d3LoopMs) || 3000;
                for (var i = 0; i < 8 && D3.on; i++) {
                    sleep(1500);
                    try { d3Load("careLoopAll(true," + ms + ")"); } catch (eL0) {}
                }
                log("3D 固定表演：循环全部动作（每条 " + ms + "ms，不停）");
            });
        }
        return { ok: true, on: true };
    } catch (e) { D3.on = false; try { if (D3.win) D3.win.close(); } catch (eC) {} D3.win = null; D3.web = null; log("3D 开启失败：" + e); return { ok: false, msg: String(e) }; }
}
function d3Close() {
    if (!D3.on) return { ok: true, on: false };
    D3.on = false;
    try { if (D3.win) D3.win.close(); } catch (e) {}
    D3.win = null; D3.web = null;
    // 收 3D 时顺手把还挂着的输入框一起收掉（16:5x 用户就是靠关 3D 才摆脱那个关不掉的框）
    try { d3InputClose(); } catch (eIC) {}
    try { if (typeof showFace === "function" && ST.floatOn && !FACE) showFace(); } catch (eSF) {}
    log("3D 小人：关");
    return { ok: true, on: false };
}
// 2026-10-20（用户「双指放大只能在小框里放大」）：按倍率 resize 3D 浮窗，以角色中心为锚点，最大铺满整屏。
// 两条上报通道都认：新服务 /size（j.size）与旧服务也支持的 /tap?t=ZS<倍率>（App 侧解析前缀，不当台词念）。
function d3SetSize(fz, byUser) {
    try {
        fz = Math.max(0.5, Math.min(6, Number(fz) || 1));   // 上限 6：够把 380x460 的基窗撑到整屏（再大由屏幕尺寸钳制）
        // 2026-10-25（主人「点击/输入框的设置重装也要保存」）：手动缩放要记住（ST.d3Fz），
        //   自主缩放（byUser 不是真）**不许改**这个值——否则它自己变大变小会把你定好的大小弄丢。
        if (byUser) {
            ST.d3Fz = fz; ST.d3AutoAt = Date.now();
            try { D3AUTO.hidden = false; D3AUTO.small = false; D3AUTO.next = Date.now() + 120000; } catch (eAU0) {}
            try { saveState(); } catch (eAU1) {}
        }
        var swz = 1080, shz = 2400;
        try { swz = device.width; shz = device.height; } catch (eS0) {}
        var cw = 380, ch = 460;
        try { if (D3.win) { cw = D3.win.getWidth(); ch = D3.win.getHeight(); } } catch (eS1) {}
        if (!cw || cw < 50) cw = 380;
        if (!ch || ch < 50) ch = 460;
        // 2026-10-20：setSize 的单位语义不靠猜——第一次设完读回实际值，对不上就按比例回正并记住系数
        var kk = (typeof D3.sizeK === 'number' && D3.sizeK > 0) ? D3.sizeK : 1;
        var nw = Math.round(380 * fz * kk), nh = Math.round(460 * fz * kk);
        nw = Math.min(nw, swz); nh = Math.min(nh, shz);
        // 2026-10-20 去抖：尺寸没变就啥也不做——缩放时页面连续上报，反复 setSize/改布局会把网页视图
        // 拖进重建竞争（配合下面主线程投递，双保险）
        if (D3.lastW === nw && D3.lastH === nh) return;
        D3.lastW = nw; D3.lastH = nh;
        var cxz = D3.x + cw / 2, cyz = D3.y + ch / 2;
        var nxz = Math.round(cxz - nw / 2), nyz = Math.round(cyz - nh / 2);
        if (nxz < 0) nxz = 0;
        if (nyz < 0) nyz = 0;
        if (nxz > swz - nw) nxz = Math.max(0, swz - nw);
        if (nyz > shz - nh) nyz = Math.max(0, shz - nh);
        if (D3.win) {
            // 2026-10-20 修（用户「放大缩小都没反应」）：setSize/setPosition 是 AutoJs 浮窗 API，直接调即可
            //   （v2.3.43 就是直接调的，窗口确实变了）。上一版把它们也塞进 onMain，投递没生效 = 啥也没做，
            //   而页面又改成「只报倍率不推相机」→ 于是双指完全没有反应。这里恢复直调，WebView 布局才走主线程。
            try {
                // 2026-10-20 诊断：先读「改之前」的实际尺寸——下一次缩放的这行就是上一次被应用的结果，
                // 由此可判定 setSize 是像素还是 dp 语义（screen 宽 1236px；若回读≈请求值=像素，≈3 倍=dp）
                var bw = 0, bh = 0;
                try { bw = D3.win.getWidth(); bh = D3.win.getHeight(); } catch (eB0) {}
                D3.win.setSize(nw, nh);
                log("3D 缩放 → 请求 " + nw + "x" + nh + " (f=" + fz + ")｜改前实际窗口=" + bw + "x" + bh + "｜屏=" + swz + "x" + shz + "｜k=" + kk);
                if (fz > 0) {
                    sleep(60);   // 等窗口真的完成一次布局，再读回实际值
                    var aw = 0, ah = 0;
                    try { aw = D3.win.getWidth(); ah = D3.win.getHeight(); } catch (eB2) {}
                    if (aw > 0 && Math.abs(aw - nw) > Math.max(40, nw * 0.18)) {
                        var k2 = nw / aw;
                        if (k2 > 0.1 && k2 < 10) {
                            D3.sizeK = k2;
                            log("3D setSize 单位校准：请求 " + nw + " 得到实际 " + aw + " → 系数 k=" + k2.toFixed(3) + "，按此重设");
                            try { D3.win.setSize(Math.max(120, Math.round(nw * k2)), Math.max(150, Math.round(nh * k2))); } catch (eK) {}
                        }
                    } else if (aw > 0) {
                        log("3D setSize 生效：实际 " + aw + "x" + ah);
                    }
                }
            } catch (eS2) {
                log("3D setSize 失败：" + eS2);
                try { var dp = device.width / 411; D3.win.setSize(Math.round(nw / dp), Math.round(nh / dp)); } catch (eS3) {}
            }
            try { D3.win.setPosition(nxz, nyz); } catch (eS4) {}
            // 窗口换了尺寸，里面的 webview 也必须换——它是 XML 里写死的 117x141dp，
            // 不改的话窗口变大了、画面还是原本那一小块（用户「只能在小框里放大」的另一半根因）
            // 2026-10-20 修崩溃（用户「双指放大 App 就崩」＋守门人日志实锤 00:19-00:20 连抛 6 次）
            //   IllegalStateException: Calling View methods on another thread than the UI thread
            //   根因：本函数在轮询线程里跑，getLayoutParams/setLayoutParams/requestLayout 都是 View 方法，
            //   必须在主线程；之前直接调 → 每缩一次抛一次，网页视图被反复折腾 → App 直接崩溃重启。
            //   改：整段投递 onMain（ui.run 优先，Handler 兜底）。
            // 2026-10-20 二次修（用户「放大就残缺显示在角落」）：**不要**给 webview 设死像素尺寸——
            //   它的父框（frame id="root"）由 setSize 撑大，子控件只有用 MATCH_PARENT 才会跟着长；
            //   设成 nw×nh 比父还大时会被父裁剪，视觉上就是「被切掉一块」。这里只兜底把 LP 拉回 MATCH_PARENT。
            // 2026-10-20 第三次修（用户「到处跑但大小一直不变」）——教训 10-18 就在本文件里写着（路况窗全屏那段）：
            //   **只调 window.setSize 是改窗口，XML 根节点写死了 117x141dp，根布局还是那块固定大小的板子**，
            //   于是窗口在外层变大、里面的画面纹丝不动，而 setPosition 又按新尺寸算锚点 → 看起来「到处跑、大小不变」。
            //   正确做法：连根视图（D3.win.root）的 layoutParams 一起改成新像素尺寸，webview 用 MATCH_PARENT 跟随。
            var _fixViews = function () {
                try {
                    var r = D3.win && D3.win.root;
                    if (r) {
                        var lp0 = r.getLayoutParams();
                        if (lp0) { lp0.width = nw; lp0.height = nh; r.setLayoutParams(lp0); r.requestLayout(); }
                    }
                    if (D3.web) {
                        var lp = D3.web.getLayoutParams();
                        if (lp && (lp.width !== -1 || lp.height !== -1)) {
                            lp.width = -1; lp.height = -1;
                            D3.web.setLayoutParams(lp);
                        }
                        D3.web.requestLayout();
                    }
                } catch (eLW) { log("3D 根布局调整失败：" + eLW); }
            };
            if (!onMain(_fixViews)) { try { _fixViews(); } catch (eLW2) { log("3D 根布局兜底失败：" + eLW2); } }
            D3_W = nw; D3_H = nh; D3.x = nxz; D3.y = nyz;
        }
    } catch (eSz) { log("3D 缩放异常：" + eSz); }
}
// v0.2.4：3D 拖动中转线程——页面（无桥环境）把拖动增量发本地服务，App 轮询拉取移窗
try {
    threads.start(function () {
        while (true) {
            try {
                if (D3.on) {
                    var r = http.get('http://127.0.0.1:19192/dragsip', { timeout: 2000 });
                    if (r && r.statusCode === 200) {
                        var j = JSON.parse(String(r.body.string()));
                        if (j && (j.dx || j.dy)) {
                            var sw = 1080, sh = 2400;
                            try { sw = device.width; sh = device.height; } catch (e) {}
                            D3.x += j.dx; D3.y += j.dy;
                            if (D3.x < 0) D3.x = 0;
                            if (D3.y < 0) D3.y = 0;
                            if (D3.x > sw - D3_W) D3.x = Math.max(0, sw - D3_W);
                            if (D3.y > sh - D3_H) D3.y = Math.max(0, sh - D3_H);
                            if (D3.win) D3.win.setPosition(D3.x, D3.y);
                            D3.nextRoam = Date.now() + 120000;
                        }
                        // 2026-10-20：页面把缩放倍率报上来 → 同步 resize 浮窗
                        if (j && j.size) d3SetSize(j.size, true);
                        // v1.3.0：单击=弹输入框（不再念台词，免得跟打字抢麦）、双击=语音对话
                        if (j && j.dbl) { threads.start(function () { sleep(120); try { voiceToggle(); } catch (eV) { log("3D双击语音异常：" + eV); } }); }
                        // 2026-10-20：旧版 19192 服务只认 /tap，页面就用「ZS<倍率>」借这条道报缩放——这里截住，别念成台词
                        if (j && j.tap && String(j.tap).indexOf('ZS') === 0) {
                            var zf = parseFloat(String(j.tap).slice(2)) || 0;
                            if (zf) d3SetSize(zf, true);
                            j.tap = '';
                        }
                        // 2026-10-23 主人点单：单击由 App 里的设置决定——出输入框 / 直接语音
                        // 【2026-10-22 23:35 实锤】3D 页面会把同一次单击重复上报（相邻几秒各一次），
                        //   语音分支不像输入框那样「已开就复用」，于是录音被反复开/关（日志里 start/stop 成对出现）。
                        //   加 1.5 秒节流：一次点击只认一次。
                        var _tapOk = false;
                        if (j && j.input) {
                            var _nowTap = Date.now();
                            if (_nowTap - (D3.lastTapAt || 0) > 1500) { D3.lastTapAt = _nowTap; _tapOk = true; }
                        }
                        if (j && j.input && _tapOk) {
                            if (String(ST.tapMode || "input") === "voice") {
                                log("3D单击 → 按设置走语音对话");
                                threads.start(function () { sleep(80); try { voiceToggle(); } catch (eV2) { log("3D单击语音异常：" + eV2); } });
                            } else {
                                try { d3InputOpen(); } catch (eIn) { log("3D输入框异常：" + eIn); }
                            }
                        }
                        else if (j && j.tap) { try { speak(String(j.tap).slice(0, 60), curChar()); } catch (eTapSp) { log("3D点按说话异常：" + eTapSp); } }
                    }
                }
            } catch (e) {}
            sleep(D3.on ? 80 : 400);
        }
    });
} catch (eD3T) { log("3D 中转线程启失败：" + eD3T); }
// ===== 2026-10-25：自主动作配音＋自己变小/变大/躲起来（主人点单）=====
// 【主人原话】「它自己动的时候每个动作都应该有相应的语音说话，为啥只动不说话」；
//   「再加上它能够自己跟着情况消失和出现以及变大和变小，但是它得时刻考虑我的各种感受不能影响我操作手机」。
// 【两道门分开】①出声门（careAutoTalkOk）：开关/录音/正在说话/刚聊过/安静时段 → 只弹气泡不出声；
//   ②动作门（careAutoQuiet）：你在打字、在录音、它在说话、它在走 → **一像素都不动**。
//   两门都是确定性状态判断，不替模型判断内容（台词只是素材库）。
var D3_LINES = {
    Wave: ["唷，我在这儿", "看见你啦", "忙你的，我陪着你"],
    Look: ["四处看看", "我在看着呢", "有我盯着呢"],
    Dance: ["给你扭一段", "心情不错，跳两下", "看我跳一个"],
    Walk: ["我过去找你", "过来啦", "挪个位置"],
    Perch: ["我上高处待着", "上去看着你", "高处视野好"],
    Hide: ["我蹲一边去，不挡你", "躲一下，别嫌我烦", "我先安静会儿"],
    Show: ["我回来了", "刚歇了会儿，还在这儿"],
    Shrink: ["我变小点，不挡屏幕", "缩一下，你专心忙"],
    Grow: ["我变回来啦", "这样看得清吗"]
};
var D3AUTO = { next: 0, hidden: false, small: false };
function careAutoTalkOk() {
    try {
        if (!ST.d3Talk || !ST.soundOn) return false;
        if (typeof REC !== "undefined" && REC && REC.on) return false;         // 它在听你说话
        if (typeof VF !== "undefined" && VF && VF.busy) return false;          // 正在回你
        if (typeof SPEAK_LOCK !== "undefined" && SPEAK_LOCK && Date.now() < SPEAK_LOCK.until) return false;
        if (Date.now() - (ST.lastSayAt || 0) < 45000) return false;            // 刚说过：不插嘴
        if (CARECORE.inDnd(QCFG, nowMinOf(Date.now()))) return false;           // 安静时段只弹气泡
        return true;
    } catch (e) { return false; }
}
function d3Speak(kind, sayText) {
    try {
        if (!D3.on) return;
        var arr = D3_LINES[kind] || D3_LINES.Walk;
        var line = String(sayText || arr[Math.floor(Math.random() * arr.length)]);
        var speakIt = careAutoTalkOk();
        presentSay(curChar(), line, line, "happy", speakIt, false);
        log("3D 自言自语（" + kind + "）：" + line + "｜出声=" + speakIt);
    } catch (e) { try { log("3D 自言自语异常：" + e); } catch (e2) {} }
}
// 现在能不能自由动：键盘弹着（你在打字）、录音中、正在回答、它正在走 → 不动
function careAutoQuiet() {
    try {
        if (typeof REC !== "undefined" && REC && REC.on) return true;
        if (typeof VF !== "undefined" && VF && VF.busy) return true;
        if (typeof SPEAK_LOCK !== "undefined" && SPEAK_LOCK && Date.now() < SPEAK_LOCK.until) return true;
        if (Date.now() - (ST.lastSayAt || 0) < 30000) return true;
        if (D3.roaming) return true;
        if (careKbUp()) return true;                           // 键盘弹着：绝不打扰
        return false;
    } catch (e) { return true; }
}
// 自主变小/变大/躲起来：默认 60-120 秒看一次，忙就往后推；位置永远避开屏幕中间那一片
function d3AutoTick() {
    try {
        if (!D3.on || !ST.d3Auto) return;
        // 2026-10-25（主人「一直固定在那里」）：固定表演模式下不做自主变大变小/躲藏
        if (ST.d3Show) return;
        var now = Date.now();
        if (!D3AUTO.next) D3AUTO.next = now + 60000 + Math.random() * 60000;
        if (now < D3AUTO.next) return;
        if (careAutoQuiet()) { D3AUTO.next = now + 20000; return; }
        D3AUTO.next = now + 70000 + Math.random() * 100000;
        var sw = 1080, sh = 2400;
        try { sw = device.width; sh = device.height; } catch (e0) {}
        var baseFz = Number(ST.d3Fz) || 1;
        var r = Math.random();
        if (D3AUTO.small) {                                  // 回到主人定的档位
            D3AUTO.small = false; D3AUTO.hidden = false;
            d3SetSize(baseFz);
            try { d3Behave("stand"); } catch (eB1) {}
            d3Speak("Grow");
        } else if (r < 0.45) {                               // 缩小 + 躲到边上
            D3AUTO.small = true;
            var smallFz = Math.max(0.5, baseFz * 0.55);
            d3SetSize(smallFz);
            var nw2 = Math.round(380 * smallFz), nh2 = Math.round(460 * smallFz);
            var nx = (Math.random() < 0.5) ? Math.round(sw * 0.02) : Math.round(sw - nw2 - sw * 0.02);
            var ny = Math.round(sh - nh2 - Math.max(30, sh * 0.015));
            try { if (D3.win) D3.win.setPosition(Math.max(0, nx), Math.max(0, ny)); D3.x = Math.max(0, nx); D3.y = Math.max(0, ny); } catch (eP) {}
            d3Speak("Shrink");
        } else if (r < 0.7) {                                // 走一遭（不挡中间）
            try { d3Behave(Math.random() < 0.5 ? "corner" : "perch"); } catch (eB2) {}
        } else {                                             // 动一下身体
            var pool = ["Wave", "Look", "Dance"];
            var pick = pool[Math.floor(Math.random() * pool.length)];
            d3Act(pick, 3200);
            d3Speak(pick);
        }
    } catch (e) { try { log("3D 自主行为异常：" + e); } catch (e2) {} }
}
// ===== v1.3.0（2026-10-18 用户点单）：3D 人单击 → 悬浮打字输入框；双击 → 语音 =====
// 交互分工（用户 2026-10-18））：单击=打字对话、双击=直接说话、按住拖动=随便挪、双指=缩放（页内相机推移）
var D3IN = null;
function d3InputClose() { var w = D3IN; D3IN = null; try { if (w) w.close(); } catch (e) {} }
// 【为什么 id 叫 inpText/btnSend/btnClose，不叫 inp/send/x】（2026-10-18 16:5x 用户报「✕ 点了没反应」）
//   AutoJs 浮窗对象自带 getX()/getY()/getWidth()/getHeight() 这些 Java bean 属性，**同名属性优先于子控件**：
//   布局里写 id="x" 时 u.x 取到的是「窗口左边坐标(数字)」而不是那个按钮 → u.x.click() 抛
//   TypeError: 无法找到函数 click.，而旧代码那里是空 catch，于是按钮彻底哑火、日志一个字都没有。
//   探针 _3D输入框探针.js 实测：typeof u.x = number（u.x = 40、u.getX() = 40），改 btnClose 后 = object 且绑定成功。
//   以后加控件：别用 x / y / width / height / close / size / position 这类浮窗自带名。
function d3InputXml() {
    return '<vertical bg="#F5FFFFFF" padding="6" w="320" h="48">' +
        '<horizontal>' +
        '<input id="inpText" w="216" h="36" textSize="14sp" singleLine="true" hint="和我说点啥…" bg="#FFF3F7FF"/>' +
        '<button id="btnSend" w="52" h="36" textSize="13" text="发送"/>' +
        '<button id="btnClose" w="38" h="36" textSize="13" text="✕"/>' +
        '</horizontal></vertical>';
}
function d3InputOpen() {
    if (D3IN) {   // 框还在：再点一次就再弹一次键盘（同样的三连，必须主线程）
        try {
            ui.run(function () {
                try { D3IN.requestFocus(); } catch (eR1) {}
                try { D3IN.inpText.requestFocus(); } catch (eR2) {}
                try {
                    var vr = (D3IN.inpText && D3IN.inpText.getView) ? D3IN.inpText.getView() : D3IN.inpText;
                    context.getSystemService(android.content.Context.INPUT_METHOD_SERVICE).showSoftInput(vr, 0);
                } catch (eR3) {}
            });
        } catch (e0) {}
        return { ok: true, reuse: true };
    }
    if (!floatAvailable()) return { ok: false, msg: "没有悬浮窗权限" };
    var sw = 1080, sh = 2400;
    try { sw = device.width; sh = device.height; } catch (e) {}
    var wPx = dpx(320), hPx = dpx(48);
    var x = Math.max(dpx(4), Math.round((sw - wPx) / 2));
    var y = dpx(64);   // 固定顶部：键盘弹起也遮不住
    var u = null;
    try { u = floaty.rawWindow(d3InputXml()); } catch (e1) { log("3D输入框创建失败：" + e1); return { ok: false, msg: String(e1) }; }
    D3IN = u;
    try { u.setSize(wPx, hPx); } catch (e2) {}
    try { u.setPosition(x, y); } catch (e3) {}
    try { u.setTouchable(true); } catch (e4) {}
    try { if (typeof u.setAdjustEnabled === "function") u.setAdjustEnabled(false); } catch (e5) {}
    // 弹键盘：三连必须都在主线程（探针实锤，见下方注释）
    var showKb = function (why) {
        try {
            ui.run(function () {
                try { u.requestFocus(); } catch (e1) {}       // 窗口级：让浮窗变成可聚焦（关键一步）
                try { u.inpText.requestFocus(); } catch (e2) {}
                try {
                    var v = (u.inpText && u.inpText.getView) ? u.inpText.getView() : u.inpText;
                    var im = context.getSystemService(android.content.Context.INPUT_METHOD_SERVICE);
                    var okKb = im.showSoftInput(v, 0);
                    log("3D输入框弹键盘（" + why + "）：showSoftInput=" + okKb);
                } catch (eK) { log("3D输入框弹键盘失败：" + eK); }
            });
        } catch (eU) { log("3D输入框弹键盘 ui.run 失败：" + eU); }
    };
    var sendFn = function () {
        var t = "";
        try { t = String(u.inpText.text() || "").trim(); } catch (eG) {}
        if (!t) { showKb("空发送"); return; }
        try { u.inpText.setText(""); } catch (eC) {}
        log("3D输入框：发送 → " + t.slice(0, 30));
        d3InputClose();
        threads.start(function () { try { doChat(t); } catch (eC2) { log("3D输入框对话异常：" + eC2); } });
    };
    // 两个钮都必须「绑成打点、失败就喊」——旧版 ✕ 用空 catch，结果按钮哑了都没人知道
    try { u.btnSend.click(sendFn); log("3D输入框：发送钮已就绪"); } catch (eB) { log("3D输入框发送钮绑定失败：" + eB); }
    try { u.btnClose.click(function () { log("3D输入框：✕ 关闭"); d3InputClose(); }); log("3D输入框：关闭钮已就绪"); } catch (eB2) { log("3D输入框关闭钮绑定失败：" + eB2); }
    // 【键盘怎么才弹得出来】（2026-10-18 17:16 两支探针实测，别再凭记忆猜）
    //   ① rawWindow 对象没有 setFocusable，但有**窗口级 requestFocus()**（类 Floaty$JsRawWindow）；
    //   ② 只调 EditText.requestFocus() → inpText.hasFocus()=true，但 IME isAcceptingText=false，键盘不弹；
    //   ③ 三连（u.requestFocus() + inpText.requestFocus() + showSoftInput，全部在 ui.run 里）→
    //      isAcceptingText=true、isActive=true，键盘真出来（_键盘探针2.js 实测）；
    //   ④ 旧版把 showSoftInput 放在工作线程 → 即便调了也接不上，所以必须 ui.run。
    showKb("打开时");
    try { threads.start(function () { sleep(600); showKb("补弹"); }); } catch (eKT) {}
    // 键盘被系统收走后，再点一下输入框能再弹出来（不然只能关掉重开框）
    try { u.inpText.click(function () { showKb("点输入框"); }); } catch (eInp) { log("3D输入框绑「点一下再弹键盘」失败：" + eInp); }
    log("3D 输入框：开");
    return { ok: true };
}
function toggleD3() {
    var r = D3.on ? d3Close() : d3Open();
    try { ST.d3On = !!D3.on; saveState(); } catch (e) {}
    return { ok: true, on: D3.on, d3On: D3.on, msg: r && r.msg };
}

// ===== 设备健康 =====
var BAT_CACHE = { t: 0, v: null };
function healthSnapshot() {
    if (BAT_CACHE.v && Date.now() - BAT_CACHE.t < 30000) return BAT_CACHE.v;
    var s = { battery: -1, charging: false, temp: -1, storage: -1 };
    try {
        var bm = context.getSystemService(android.content.Context.BATTERY_SERVICE);
        s.battery = bm.getIntProperty(android.os.BatteryManager.BATTERY_PROPERTY_CAPACITY);
    } catch (e) {}
    try {
        var it = context.registerReceiver(null, new android.content.IntentFilter(android.content.Intent.ACTION_BATTERY_CHANGED));
        if (it) {
            var st = it.getIntExtra(android.os.BatteryManager.EXTRA_STATUS, -1);
            s.charging = (st === android.os.BatteryManager.BATTERY_STATUS_CHARGING || st === android.os.BatteryManager.BATTERY_STATUS_FULL);
            var tt = it.getIntExtra(android.os.BatteryManager.EXTRA_TEMPERATURE, -1);
            if (tt > 0) s.temp = Math.round(tt / 10);
            if (s.battery < 0) { var lv = it.getIntExtra(android.os.BatteryManager.EXTRA_LEVEL, -1); var sc = it.getIntExtra(android.os.BatteryManager.EXTRA_SCALE, 100); if (lv >= 0 && sc > 0) s.battery = Math.round(lv * 100 / sc); }
        }
    } catch (e) {}
    try {
        var sf = new android.os.StatFs(BASE);
        var avail = sf.getAvailableBytes(), total = sf.getTotalBytes();
        if (total > 0) s.storage = Math.round((total - avail) * 100 / total);
    } catch (e) {}
    BAT_CACHE = { t: Date.now(), v: s };
    return s;
}

// ===== 看守线程①：流水线 PROGRESS.md =====
try {
    threads.start(function () {
        sleep(6000);
        while (true) {
            try {
                var txt = readText(PROG);
                if (txt) {
                    var prevCnt = ST.watermark ? ST.watermark.count : 0;
                    var r = CARECORE.detectNewEntries(txt, ST.watermark, { maxBatch: 40 });
                    ST.watermark = r.watermark;
                    if (r.reset) log("PROGRESS 水位重置（首次/截断/原位改动），计 " + r.watermark.count + " 行");
                    if (r.bulk) log("距上次运行较久，跳过 " + (r.watermark.count - prevCnt) + " 行历史（仅推进水位）");
                    for (var i = 0; i < r.events.length; i++) {
                        try { log("新事件：" + r.events[i].type + "/" + r.events[i].cat + " " + r.events[i].text); react(r.events[i]); } catch (eR) { log("react 异常：" + eR); }
                    }
                    saveState();
                }
            } catch (e) { log("看守异常：" + e); }
            sleep(75000);
        }
    });
} catch (ePW) { log("看守线程启失败：" + ePW); }

// ===== v0.4.0 健康小管家 v1（2026-10-17 用户点单：持续跟踪+主动了解+该提示时提示）=====
// 边界：生活方式助手（非医疗诊断）；数据全本地。
// 2026-10-17 深夜（用户点单修正）：「我又不跑步给我记步数干嘛」——步数/计步器整套砍掉；保留：对话健康档案 + 熬夜提醒
// 2026-10-17 凌晨加急（用户点单）：饮食主动模块——饭点主动问吃啥＋邀拍饭菜分析（v0.4.2 并入本版）
MEM.health = MEM.health || { diet: [], sleep: [], notes: [], nudges: {}, pendingAsk: null };
// 2026-10-23（主人报「中午报饭没营养分析」）：原词表只有「吃了/吃饭/外卖/宵夜」这几类，
//   主人说的是「好吃」「喝了碗白菜汤」——词表里**没有「吃」「喝」单字**，于是被 4558 行直接 return，
//   饭没记、营养也没分析。最小改动：只补这两个单字。
//   【注意】不要再往这里塞「蛋/粥/面/肉」这类食物词——那是饮食判定（下一层的正则）的活；
//   塞进来会把「再加个蛋」这种补充话也当健康话题记进 notes（健康_test 有断言钉着）。
var HKW = /(睡不着|失眠|没睡好|熬夜|头疼|头晕|胃|肚子|感冒|发烧|咳嗽|疼|累|疲|不舒服|心慌|过敏|吃药|医院|体检|吃了|吃|吃饭|早饭|午饭|晚饭|早餐|午餐|晚餐|外卖|宵夜|喝酒|喝|抽烟)/;
// 2026-10-23：饮食档查重——同一天里前 12 个字一样就当重复（实测 10-22 同一条午饭记了 3 份、今天早餐 2 份，
//   会让「蔬菜够不够 / 元素平均」这类统计翻倍失真）。只查当天，跨天不算重复。
function careDietDup(s) {
    try {
        var day0 = careDietDayStart();
        var t = String(s || "").slice(0, 12);
        if (!t) return false;
        var arr = (MEM.health && MEM.health.diet) || [];
        for (var i = arr.length - 1; i >= 0; i--) {
            var r = arr[i];
            if (!r || !r.t || r.t < day0) break;
            if (String(r.s || "").slice(0, 12) === t) return true;
        }
    } catch (e) { }
    return false;
}
function careHealthDigest(t) {
    try {
        var s = String(t || "");
        if (!s || s.length > 80) return;
        // v0.4.3：人体指标抽记（体重/血压/心率/血氧/血糖/体温/腰围/身高——用户报数即记档）
        var mets = careMetricExtract(s);
        if (mets.length) {
            MEM.health.metrics = MEM.health.metrics || [];
            for (var mi = 0; mi < mets.length; mi++) { var mr = mets[mi]; mr.t = Date.now(); MEM.health.metrics.push(mr); }
            while (MEM.health.metrics.length > 400) MEM.health.metrics.shift();
            saveMem();
            log("指标+：" + mets.length + " 项（" + mets[0].k + " " + mets[0].v + "）");
        }
        // 2026-10-25 改写（原来这里是「饭点问过之后，紧接着的回话直接当这顿记进 diet」）：
        //   实锤 10-25 12:07 主人喊「七十六个动作都演示一遍」，它正在发 76 个动作，
        //   同一秒 careHealthDigest 把这句当成**午饭**写进了 diet（带营养塔和 13 项元素）；
        //   10-22 的地名「大航罗马国际西北门」、10-22 两张导航截图、10-23 的噪声转写
        //   「你不想要我做的事…」也都是这条 90 分钟窗口吞进来的。
        //   根因＝代码替模型判断「这句是在回答吃什么」（而且窗口宽到 90 分钟），
        //   违反主人 2026-10-18 定的铁律（判断交给 AI，不许写死判据）。
        //   现在：**这里一笔都不写**，只保留 pendingAsk 这个事实（careSelfContext 会把它摆给模型），
        //   要不要记成饭由模型调 diet_note 决定；对应提示词已钉死「只有确实在讲吃喝才调」。
        //   失败表现：如果哪天 diet 里又出现非食物条目，先查是不是有人在这条分支上加回了自动写入。
        var pa = MEM.health.pendingAsk;
        if (pa && pa.t && Date.now() - pa.t < 90 * 60000) {
            log("饭点上下文：交给模型判断这顿吃什么（不自动写档案）" + String(s).slice(0, 16));
            return;
        }
        if (!HKW.test(s)) return;
        var rec = { t: Date.now(), s: s.slice(0, 60) };
        // 2026-10-25：原来这里是 /(吃|饭|外卖|宵夜|喝)/ 这个写死的关键词表决定「算不算一顿」——
        //   同一类写死判据 10-18 已被主人当面否掉；而且它把噪声与地名也放进来过。
        //   现在一律先记进健康笔记（原文留档、可回看），要不要算一顿由模型调 diet_note 决定。
        MEM.health.notes.push(rec); if (MEM.health.notes.length > 400) MEM.health.notes.shift(); saveMem();
        log("健康档案+1：" + s.slice(0, 30));
    } catch (e) {}
}
function careHealthTick() {
    try {
        var d = "";
        try { d = nowStr().slice(0, 10); } catch (e0) { d = "" + Math.floor(Date.now() / 86400000); }
        MEM.health.nudges = MEM.health.nudges || {};
        var n = MEM.health.nudges;
        var hh = new Date().getHours();
        if (hh >= 0 && hh <= 5 && n.night !== d + "_" + hh) {
            var lastChat = 0;
            try { lastChat = (MEM.chat && MEM.chat.length) ? MEM.chat[MEM.chat.length - 1].t : 0; } catch (e1) {}
            if (Date.now() - lastChat < 40 * 60000) {
                n.night = d + "_" + hh;
                presentSay(curChar(), "这个点还没睡呀…长期熬夜晚睡，皮肤、记忆、心脑血管都会慢慢吃亏的，早点休息好不好？", "这个点还没睡呀…长期晚睡可不好，早点休息好不好？", "concern", ST.soundOn && !CARECORE.inDnd(QCFG, nowMinOf(Date.now())));
                log("健康提醒：熬夜一次（" + hh + "点）");
            }
        }
        saveMem();
    } catch (e) { log("健康提醒异常：" + e); }
}
// ===== v0.4.2 饮食主动模块（2026-10-17 用户点单：饭点主动问吃啥＋邀拍饭菜分析）=====
var MEALS = [
    { id: "早", key: "meal_b", from: 7, to: 9, say: "早上好呀～今天准备吃什么？" },
    { id: "中", key: "meal_l", from: 11, to: 13, say: "到饭点啦～中午准备吃什么？" },
    { id: "晚", key: "meal_d", from: 17, to: 19, say: "晚饭时间到～准备吃什么？" }
];
function careMealTick() {
    try {
        var d = "";
        try { d = nowStr().slice(0, 10); } catch (e0) { d = "" + Math.floor(Date.now() / 86400000); }
        MEM.health.nudges = MEM.health.nudges || {};
        var n = MEM.health.nudges;
        var hh = new Date().getHours();
        for (var i = 0; i < MEALS.length; i++) {
            var m = MEALS[i];
            if (hh >= m.from && hh <= m.to && n[m.key] !== d) {
                n[m.key] = d;
                MEM.health.pendingAsk = { t: Date.now(), meal: m.id };
                presentSay(curChar(), m.say + "（回我一句就行，拍给我看也行～）", m.say, "happy", ST.soundOn && !CARECORE.inDnd(QCFG, nowMinOf(Date.now())));
                saveMem();
                log("饮食：饭点主动问（" + m.id + "）");
                return;
            }
        }
    } catch (e) { log("饭点提醒异常：" + e); }
}
// 【2026-10-19 18:0x 用户「它说那个记了 6 顿的错误记录它改不了咋回事」】
//   实锤：MEM.health.diet 今天堆了 14 条（同一顿饭被反复记——红烧鱼子/红烧茄子/东坡肉/辣子鸡丁…），
//   而动作表里只有 add_diet、**根本没有删除**，所以它只能说「改不了」。补两个动作：删一条 / 清空今天。
//   范围锁死「今天」——历史饮食档案不许被一句含糊的话抹掉。
function careDietDayStart() { var d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); }
// 2026-10-22（任务队列 ㉗ 账与饭不可错）：**删前先列候选**——一次调用只列清单、不动数据；
//   带 pick 的第二次调用才真删（pick=序号，最近一条算 1）。删错了以前只能靠回收站/重来，现在先看再删。
function careDietTodayList() {
    var arr = (MEM.health && MEM.health.diet) || [], day0 = careDietDayStart(), out = [];
    for (var i = arr.length - 1; i >= 0; i--) {
        var r = arr[i]; if (!r || !r.t || r.t < day0) continue;
        out.push({ i: i, t: r.t, s: String(r.s || ""), meal: String(r.meal || "") });
    }
    return out;   // 最近一条排最前
}
function careDietDel(keyword, pick) {
    try {
        ensureWorkMem();
        var arr = MEM.health.diet || [];
        if (!arr.length) return "饮食记录里还没有东西，不用删";
        var kw = String(keyword || "").trim(), x;
        var todays = careDietTodayList();
        if (!todays.length) return "今天没有饮食记录（历史档案不动）。";
        var cand = [];
        for (x = 0; x < todays.length; x++) { if (!kw || todays[x].s.indexOf(kw) >= 0) cand.push(todays[x]); }
        if (!cand.length) {
            var all = [];
            for (x = 0; x < todays.length && x < 10; x++) all.push((x + 1) + ") " + todays[x].s.slice(0, 24));
            return "今天没找到含「" + kw + "」的记录（没删）。今天的记录：\n" + all.join("\n");
        }
        var pickN = parseInt(pick, 10);
        if (!(pickN >= 1)) {
            var ls = [];
            for (x = 0; x < cand.length && x < 10; x++) {
                ls.push((x + 1) + ") " + careHM(cand[x].t) + (cand[x].meal ? "[" + cand[x].meal + "]" : "") + " " + cand[x].s.slice(0, 24));
            }
            return "先看一下要删哪条（今天共 " + cand.length + " 条，最近的一条算第 1 条）：\n" + ls.join("\n") +
                "\n确认了就带 pick=序号 再调一次（只删最近这条就 pick=1）；拿不准就先问主人，别自己删。";
        }
        if (pickN > cand.length) return "只有 " + cand.length + " 条，pick 超出范围（没删）。";
        var hit = cand[pickN - 1], gone = String(hit.s || "").slice(0, 40);
        arr.splice(hit.i, 1);
        try { saveMem(); } catch (eS2) {}
        log("删饮食记录：" + gone);
        try { actLog("删饮食", "删掉一条：" + gone); } catch (eAL) {}
        return "删掉了：" + gone + "（今天还剩 " + careDietTodayList().length + " 条）";
    } catch (e) { return "删饮食记录失败：" + e; }
}
function careDietClearDay(confirm) {
    try {
        ensureWorkMem();
        var todays = careDietTodayList();
        // 2026-10-22（㉗）：清空同样先列候选，带 confirm=yes 才真清
        if (String(confirm || "") !== "yes") {
            if (!todays.length) return "今天本来就没有饮食记录";
            var ls = [];
            for (var x = 0; x < todays.length && x < 10; x++) ls.push((x + 1) + ") " + careHM(todays[x].t) + (todays[x].meal ? "[" + todays[x].meal + "]" : "") + " " + todays[x].s.slice(0, 24));
            return "今天共 " + todays.length + " 条饮食记录：\n" + ls.join("\n") +
                "\n确认全部清掉就带 confirm=yes 再调一次（只清今天，历史档案不动）。";
        }
        var arr = MEM.health.diet || [], day0 = careDietDayStart(), keep = [], n = 0;
        for (var i = 0; i < arr.length; i++) { if (arr[i] && arr[i].t >= day0) n++; else keep.push(arr[i]); }
        MEM.health.diet = keep;
        try { saveMem(); } catch (eS2) {}
        log("清空今天饮食记录：" + n + " 条");
        try { actLog("删饮食", "清空今天的饮食记录（" + n + " 条）"); } catch (eAL2) {}
        return n ? ("今天 " + n + " 条饮食记录已全部清掉，你重新说一遍我重记") : "今天本来就没有饮食记录";
    } catch (e) { return "清空失败：" + e; }
}
function mealCtxNow() {    try {
        var pa = MEM.health.pendingAsk;
        if (pa && pa.t && Date.now() - pa.t < 90 * 60000) return pa.meal || "餐";
        var dd = MEM.health.diet;
        if (dd && dd.length) {
            for (var i = dd.length - 1; i >= 0 && i >= dd.length - 3; i--) {
                if (dd[i] && dd[i].meal && Date.now() - dd[i].t < 90 * 60000) return dd[i].meal;
            }
        }
    } catch (e) {}
    return null;
}
// ===== v0.4.3 人体指标档案（用户点单：所有指标——报数即记档，时间线+趋势进分析）=====
var MKW = [
    { k: "体重", unit: "kg", re: /体重\s*[:：]?\s*([0-9]{2,3}(?:\.[0-9])?)\s*(公斤|kg|KG|千克|斤)?/i },
    { k: "血压", unit: "mmHg", re: /血压\s*[:：]?\s*([0-9]{2,3})\s*[\/比]\s*([0-9]{2,3})/ },
    { k: "心率", unit: "次/分", re: /(?:心率|心跳)\s*[:：]?\s*([0-9]{2,3})/ },
    { k: "血氧", unit: "%", re: /血氧\s*[:：]?\s*([0-9]{2,3})/ },
    { k: "血糖", unit: "mmol/L", re: /血糖\s*[:：]?\s*([0-9]{1,2}(?:\.[0-9])?)/ },
    { k: "体温", unit: "℃", re: /(?:体温|发烧)\s*[:：]?\s*([0-9]{2}(?:\.[0-9])?)/ },
    { k: "腰围", unit: "cm", re: /腰围\s*[:：]?\s*([0-9]{2,3})/ },
    { k: "身高", unit: "cm", re: /身高\s*[:：]?\s*([0-9]{3}|[0-9]\.[0-9]{2})/ }
];
function careMetricExtract(text) {
    var out = [];
    try {
        var s = String(text || "");
        for (var i = 0; i < MKW.length; i++) {
            var d = MKW[i], m = d.re.exec(s);
            if (!m) continue;
            if (d.k === "血压") { out.push({ k: d.k, v: m[1] + "/" + m[2], unit: d.unit }); continue; }
            var v = parseFloat(m[1]);
            if (d.k === "体重" && m[2] === "斤") v = Math.round(v / 2 * 10) / 10;
            out.push({ k: d.k, v: v, unit: d.unit });
        }
    } catch (e) {}
    return out;
}

// ===== v0.4.3 营养塔 + 元素体检（用户点单：拍饭要出人体元素分析，不只随口点评）=====
// 解析拍饭结构化输出 → { verdict 点评, nutri 四级塔(主/蔬/蛋/油 1-5，heat 1低 2中 3高), tower 展示串 }
function barOf(n) { var t = ""; for (var i = 0; i < n; i++) t += "▓"; return t; }
// 2026-10-21 ccode·用户 10-20「我只吃了3顿今天咋又显示4顿呢」：
//   根子是「同一天同一餐被报多次（一句话纠正就多一条记录）」，而汇总全按**条数**当顿数。
//   口径改成按**餐次标记**去重。
// 2026-10-22（任务队列 ㉗ 账与饭不可错）定稿：**顿数只认 r.meal 字段**。
//   ① 记录写进档案时就带上餐次（careMealTagNow：饭点提问/近 90 分钟的上下文 → 不然按当时几点）；
//   ② 10-21 之前的老记录没有这个字段 → ensureWorkMem 里一次性补全（careMigrateMealTags）；
//   ③ careMealSlotOf 只读字段，**不再解析记录文字**——「早饭」这种字样是当年没字段时的历史数据，
//     不是判据；补全之后再没有任何文字匹配参与顿数。
function careMealTagOfHour(h) {
    h = Number(h) || 0;
    if (h >= 5 && h < 10) return "早";
    if (h >= 10 && h < 15) return "中";
    if (h >= 15 && h < 21) return "晚";
    return "夜";
}
function careMealSlotOf(r) {
    if (!r) return "";
    if (r.meal) return String(r.meal).slice(0, 2);
    // 没有字段（老记录/测试构造）：只按发生时刻归桶，绝不解析文字内容
    return careMealTagOfHour(new Date(Number(r.t) || 0).getHours());
}
// 记录这一刻属于哪一顿（确定性：饭点上下文/时刻，不判断他吃了什么）
function careMealTagNow(text) {
    // 2026-10-22 13:0x 实锺：午饭那条被标成「早」（因为 mealCtxNow 拿了上一条的「早」）→ 顿数只算 1 顿。
    // 先看记录自己写着的餐次前缀（「午饭：…」）—— 那是记录自带的标签，不是猜内容
    var s0 = String(text || "").slice(0, 8);
    if (/(早饭|早餐|早点)/.test(s0)) return "早";
    if (/(午饭|午餐|中饭)/.test(s0)) return "中";
    if (/(晚饭|晚餐)/.test(s0)) return "晚";
    if (/(夜宵|宵夜)/.test(s0)) return "夜";
    try { var m = mealCtxNow(); if (m) return String(m).slice(0, 2); } catch (e0) {}
    return careMealTagOfHour(new Date().getHours());
}
// 一次性数据补全：给 10-21 之前没有 meal 字段的老记录补上标签（补完计数只看字段）。
// 注意：这段读的是「记录里本来就写着的两个字」和发生时刻，属**补历史数据**，补完就不再参与任何判断。
function careMigrateMealTags() {
    try {
        var dd = (MEM.health && MEM.health.diet) || [], n = 0;
        for (var i = 0; i < dd.length; i++) {
            var r = dd[i];
            if (!r || !r.t) continue;
            if (r.meal) { r.meal = String(r.meal).slice(0, 2); continue; }
            var tag = "";
            try {
                var head = String(r.s || "").slice(0, 6);
                var mm = /(早饭|早餐|早点|午饭|午餐|中饭|晚饭|晚餐|夜宵|宵夜|加餐)/.exec(head);
                if (mm) {
                    var w = mm[1];
                    tag = (w === "早饭" || w === "早餐" || w === "早点") ? "早"
                        : ((w === "午饭" || w === "午餐" || w === "中饭") ? "中"
                            : ((w === "晚饭" || w === "晚餐") ? "晚" : "夜"));
                }
            } catch (e1) {}
            r.meal = tag || careMealTagOfHour(new Date(Number(r.t) || 0).getHours());
            n++;
        }
        return n;
    } catch (e) { return 0; }
}
function careMealSlotCount(recs) {
    var slot = {}, i, k, n = 0;
    recs = recs || [];
    for (i = 0; i < recs.length; i++) {
        var s = careMealSlotOf(recs[i]);
        if (s) slot[s] = 1;
    }
    for (k in slot) n++;
    return n;
}
// 区间内的顿数（按天分别去重再相加）——近 7 天/本周/规划表统一走它，别再用「条数」当顿数
function careMealCountIn(fromT, toT) {
    var dd = (MEM.health && MEM.health.diet) || [], byDay = {}, k, n = 0, i;
    for (i = 0; i < dd.length; i++) {
        var r = dd[i]; if (!r || !r.t) continue;
        if (fromT && r.t < fromT) continue;
        if (toT && r.t >= toT) continue;
        var dk = careDayKey(r.t);
        if (!byDay[dk]) byDay[dk] = [];
        byDay[dk].push(r);
    }
    for (k in byDay) n += careMealSlotCount(byDay[k]);
    return n;
}
// ===== v0.5.3：13 项元素体检汇总（用户报障「关于元素的咋没看到」）=====
// 原来「分析我」只在有拍饭元素数据时给一句「短板：…」，没数据就只剩占位语，面板上也没有常显的地方。
// 这里把近 N 天拍饭的元素均值算出来，给主程序拼文字、也给面板画条形图（buildStatus 里带出去）。
var ELEM_DEFS = [["钙", "钙"], ["铁", "铁"], ["锌", "锌"], ["硒", "硒"], ["钾", "钾"], ["镁", "镁"], ["钠", "钠"], ["维A", "维A"], ["维B", "维B"], ["维C", "维C"], ["维D", "维D"], ["维E", "维E"], ["纤", "膳食纤维"]];
function careElemAvg(days) {
    var out = { ok: true, n: 0, items: [], lows: [] };
    try {
        var since = Date.now() - (days || 7) * 86400000;
        var dd = (MEM.health && MEM.health.diet) || [];
        // v0.5.6：口径定稿——模型给的是「这一餐吃得够不够（1-5）」，所以当天覆盖度＝
        //   各餐平均分 × min(1, 餐数/3)（三顿算一天满量）。先前「同天餐次相加封顶 5」会把 3×2 分
        //   加成一整天的满量，结果永远「够」，用户看到全 5 分——那是假数据。
        var byDay = {}, dayKeys = [], i, k;
        for (i = 0; i < dd.length; i++) {
            var r2 = dd[i];
            if (!r2 || !r2.elems || !(r2.t >= since)) continue;
            var dk = careDayKey(r2.t);
            if (!byDay[dk]) { byDay[dk] = { n: 0, sum: {}, recs: [], slot: {} }; dayKeys.push(dk); }
            byDay[dk].recs.push(r2);
            byDay[dk].n = careMealSlotCount(byDay[dk].recs);
            // 2026-10-23（主人「我app显示早餐没重复记，到底咋回事」——两条都在，面板按餐次去重所以看不出）：
            //   原来这里是**逐条累加**元素分：同一餐记了两条（打字一条＋语音一条）就等于吃了两顿，元素凭空翻倍。
            //   模型给的分口径是「这一餐吃得够不够(1-5)」，同餐次只能算一次 → 按餐次只留最后一条（时新覆盖旧的），
            //   循环结束后再按餐次相加。餐次用现成的 careMealSlotOf（与「顿数」同源，不是新造判据）。
            byDay[dk].slot[careMealSlotOf(r2) || ("t" + r2.t)] = r2.elems;
        }
        // 逐餐次汇总（同餐次只算一次）
        for (i = 0; i < dayKeys.length; i++) {
            var _d0 = byDay[dayKeys[i]];
            for (var _sk in _d0.slot) {
                var _e0 = _d0.slot[_sk];
                for (k in _e0) {
                    if (typeof _e0[k] === "number") _d0.sum[k] = (_d0.sum[k] || 0) + _e0[k];
                }
            }
        }
        out.n = dayKeys.length;
        if (!out.n) return out;
        var agg = {}, mealTotal = 0;
        for (i = 0; i < dayKeys.length; i++) {
            var d0 = byDay[dayKeys[i]];
            var w0 = Math.min(1, d0.n / 3);           // 这天吃了几顿占一天的比例
            mealTotal += d0.n;
            for (k in d0.sum) agg[k] = (agg[k] || 0) + (d0.sum[k] / d0.n) * w0;
        }
        out.meals = mealTotal;
        for (var j = 0; j < ELEM_DEFS.length; j++) {
            var key = ELEM_DEFS[j][0], lab = ELEM_DEFS[j][1];
            if (agg[key] == null) continue;
            var v = agg[key] / out.n;                   // 0-5 分制＝这天大概覆盖了一天所需的多少
            var low = v < 3.0;                          // v0.5.4：低于约六成 → 「建议补」（口径比原来 2.2 更贴近「可能缺」）
            var item = { k: key, label: lab, v: Math.round(v * 10) / 10, low: low };
            if (low) {
                item.pct = elemPct(v);
                item.adv = ELEM_INFO[key] || null;
            }
            out.items.push(item);
            if (low) out.lows.push(lab);
        }
        // 一项都没到「偏少」时，也把最弱的两项点出来（用户点单：永远要告诉我可能缺什么、怎么补）
        if (!out.lows.length && out.items.length) {
            var sorted = out.items.slice().sort(function (a, b) { return a.v - b.v; });
            for (var q = 0; q < Math.min(2, sorted.length); q++) {
                sorted[q].weak = true;
                sorted[q].pct = sorted[q].pct || elemPct(sorted[q].v);
                sorted[q].adv = sorted[q].adv || ELEM_INFO[sorted[q].k] || null;
                out.lows.push(sorted[q].label);
            }
        }
    } catch (e) { out = { ok: false, n: 0, items: [], lows: [], msg: String(e) }; }
    return out;
}
// v0.5.4：每项元素的「怎么补 / 不补会怎样（大概多久）」——用户点单：不要只报分数，要告诉他缺多少、怎么补、不补的后果
// 口径：这是**吃喝描述的结构粗估，不是化验**；「不补」一栏只写常见表现与大致时间尺度，不做诊断、不吓人。
var ELEM_INFO = { "钙": { s: "奶/酸奶/豆腐/小鱼干/深绿叶菜", m: "抽筋、牙齿松动、骨密度往下掉", t: "数周～数月" }, "铁": { s: "红肉/动物肝/血制品，配点维C 吸收更好", m: "乏力、脸色差、头晕、易贫血", t: "数周～数月" }, "锌": { s: "牡蛎/牛肉/坚果/鸡蛋", m: "味觉变钝、伤口好得慢、抵抗力下降", t: "数周" }, "硒": { s: "海鱼/鸡蛋/少量坚果", m: "容易累、免疫力变差", t: "数周～数月" }, "钾": { s: "香蕉/土豆/菠菜/豆类", m: "乏力、心慌、抽筋", t: "数天～数周" }, "镁": { s: "坚果/全谷/深绿叶菜", m: "抽筋、睡不踏实、心悸", t: "数周" }, "钠": { s: "正常吃盐就够，别刻意补（多数人是偏多）", m: "过量才是常风险（血压），这项偏低基本不用管", t: "—" }, "维A": { s: "胡萝卜/南瓜/动物肝/蛋黄", m: "晚上看东西吃力、皮肤干、易感染", t: "数月" }, "维B": { s: "全谷/瘦肉/豆/蛋", m: "口角开裂、舌头不适、乏力", t: "数周" }, "维C": { s: "青椒/猕猴桃/柑橘等新鲜蔬果", m: "牙龈出血、伤口愈合慢、抵抗力差", t: "数周～数月" }, "维D": { s: "晒 15-20 分钟太阳/海鱼/蛋黄/奶", m: "骨痛、肌肉无力、情绪低落", t: "数月" }, "维E": { s: "坚果/植物油/绿叶菜", m: "抗氧化能力下降、皮肤偏干（明显缺乏少见）", t: "数月" }, "纤": { s: "全谷/豆类/蔬果（能带皮就带皮）", m: "便秘、血糖血脂起伏、肠道菌群变差", t: "数天～数周" } };
// ===== v0.7.0 元素量化（用户 2026-10-18 点单：「所有元素都要计算大概的量，有量的单位，有量的大概分析估算」）=====
// 口径（诚实边界，写死）：模型给的是「这餐吃得够不够（1-5 档）」，本层按成年人每日参考摄入量折算成量：
//   估算量 ≈ 参考量 × 档位/5（5 档＝这天吃满）。这是**吃喝描述的粗估，不是化验**，只用于看趋势和缺口。
// 参考值取《中国居民膳食营养素参考摄入量》成人轻体力大致值（四舍五入）；钠是「限量」不是「要补」。
var ELEM_REF = {
    "纤": { u: "g", rda: 25, n: "膳食纤维" },
    "钙": { u: "mg", rda: 800, n: "钙" },
    "铁": { u: "mg", rda: 12, n: "铁" },
    "锌": { u: "mg", rda: 12.5, n: "锌" },
    "硒": { u: "μg", rda: 60, n: "硒" },
    "钾": { u: "mg", rda: 2000, n: "钾" },
    "镁": { u: "mg", rda: 330, n: "镁" },
    "钠": { u: "mg", rda: 1500, n: "钠（限量）", limit: true },
    "维A": { u: "μg", rda: 800, n: "维生素A" },
    "维B": { u: "mg", rda: 1.4, n: "B族维生素" },
    "维C": { u: "mg", rda: 100, n: "维生素C" },
    "维D": { u: "μg", rda: 10, n: "维生素D" },
    "维E": { u: "mg", rda: 14, n: "维生素E" },
    "碘": { u: "μg", rda: 120, n: "碘" },
    "热量": { u: "kcal", rda: 2250, n: "热量" },
    "蛋白": { u: "g", rda: 65, n: "蛋白质" },
    "脂肪": { u: "g", rda: 65, n: "脂肪" },
    "碳水": { u: "g", rda: 250, n: "碳水" }
};
// 档位 → 占一天参考量的比例（1 档≈两成 … 5 档≈吃满）
function elemRatio(v) { return Math.max(0, Math.min(1, (Number(v) || 0) / 5)); }
// 把「档位分」折成「量」：est=估算量、gap=还差多少（负数=超出）、pct=占参考量百分比
function elemAmount(key, v) {
    var r = ELEM_REF[key];
    if (!r) return null;
    var est = r.rda * elemRatio(v);
    var gap = r.rda - est;
    var dec = r.rda >= 100 ? 0 : 1;
    return { k: key, name: r.n, u: r.u, rda: r.rda, est: est, gap: gap, pct: elemRatio(v) * 100, limit: !!r.limit, dec: dec };
}
// 长表：钙 ≈480mg / 参考 800mg，差 320mg（约 60%）
function elemAmtStr(a) {
    if (!a) return "";
    var est = a.est.toFixed(a.dec), rda = a.rda;
    if (a.limit) return "≈" + est + a.u + "（建议别超 " + rda + a.u + "）";
    var tail = a.gap > 0.5 ? "，差 " + a.gap.toFixed(a.dec) + a.u : "（已够）";
    return "≈" + est + a.u + " / 参考 " + rda + a.u + tail + "（约 " + Math.round(a.pct) + "%）";
}
// 短表：钙 ≈480mg/800mg（60%）
function elemAmtShort(a) {
    if (!a) return "";
    if (a.limit) return a.name + " ≈" + a.est.toFixed(a.dec) + a.u;
    return a.name + " ≈" + a.est.toFixed(a.dec) + a.u + "/" + a.rda + a.u + "（" + Math.round(a.pct) + "%）";
}
// 营养塔四项（主食/蛋白/油脂/热量）按「天」聚合——口径与 careElemAvg 一致（每餐分 × min(1,顿数/3)）
function nutriAvg(days) {
    var since = Date.now() - (days || 7) * 86400000;
    var dd = (MEM.health && MEM.health.diet) || [], byDay = {}, dks = [], i;
    for (i = 0; i < dd.length; i++) {
        var r = dd[i];
        if (!r || !r.nutri || !(r.t >= since)) continue;
        var dk = careDayKey(r.t);
        if (!byDay[dk]) { byDay[dk] = { n: 0, zhu: 0, dan: 0, you: 0, heat: 0, recs: [] }; dks.push(dk); }
        byDay[dk].recs.push(r);
        byDay[dk].n = careMealSlotCount(byDay[dk].recs);
        byDay[dk].zhu += r.nutri.zhu || 0;
        byDay[dk].dan += r.nutri.dan || 0;
        byDay[dk].you += r.nutri.you || 0;
        byDay[dk].heat += r.nutri.heat || 2;
    }
    if (!dks.length) return { n: 0 };
    var agg = { zhu: 0, dan: 0, you: 0, heat: 0 }, meals = 0;
    for (i = 0; i < dks.length; i++) {
        var d0 = byDay[dks[i]], w = Math.min(1, d0.n / 3);
        meals += d0.n;
        agg.zhu += (d0.zhu / d0.n) * w;
        agg.dan += (d0.dan / d0.n) * w;
        agg.you += (d0.you / d0.n) * w;
        agg.heat += (d0.heat / d0.n) * w;
    }
    var n = dks.length;
    return { n: n, meals: meals, zhu: agg.zhu / n, dan: agg.dan / n, you: agg.you / n, heat: agg.heat / n };
}
// 热量档位（1低/2中/3高）→ 折成 0-5 档
function heatToV5(h) { return h >= 3 ? 5 : (h >= 2 ? 3.5 : 2); }
// 近 N 天的「量」明细（面板 / AI / 语音共用同一口径）：13 项元素 + 营养塔四项（碳水/蛋白/脂肪/热量）
function careElemAmounts(days) {
    var e = careElemAvg(days || 7), out = { ok: e.ok !== false, n: e.n, meals: e.meals || e.n, rows: [] };
    var items = e.items || [];
    for (var i = 0; i < items.length; i++) {
        var it = items[i], a = elemAmount(it.k, it.v);
        if (!a) continue;
        a.v = it.v; a.low = !!it.low; a.weak = !!it.weak; a.adv = ELEM_INFO[it.k] || null;
        out.rows.push(a);
    }
    var na = nutriAvg(days || 7);
    if (na.n > 0) {
        var add = [["碳水", na.zhu], ["蛋白", na.dan], ["脂肪", na.you], ["热量", heatToV5(na.heat)]];
        for (var q = 0; q < add.length; q++) {
            var a2 = elemAmount(add[q][0], add[q][1]);
            if (!a2) continue;
            a2.v = add[q][1]; a2.low = a2.pct < 45; a2.weak = false;
            out.rows.push(a2);
        }
        if (!out.n) { out.n = na.n; out.meals = na.meals; }
    }
    return out;
}
function elemPct(v) {
    if (v < 1.5) return "约三成（明显偏少）";
    if (v < 2.5) return "约五成（偏少）";
    if (v < 3.5) return "约七成（有缺口）";
    if (v < 4.5) return "约九成（差不多）";
    return "基本够（≥推荐量）";
}
function careElemText(days) {
    var A = careElemAmounts(days || 7);
    if (!A.n) return "还没有元素数据——吃饭拍一张（或说一句吃了啥），我就按量估出各项元素（钙/铁/锌/硒/钾/镁/钠/维A/维B/维C/维D/维E/膳食纤维）";
    var parts = [], lowLines = [];
    for (var i = 0; i < A.rows.length; i++) {
        var r0 = A.rows[i];
        parts.push(elemAmtShort(r0) + (r0.low ? "⚠" : ""));
    }
    var head = "按 " + A.n + " 天 " + A.meals + " 顿估算（3 顿算一天满量；⚠=明显偏少）。这是吃喝描述的粗估、不是化验：\n" + parts.join("\n");
    // 短板一项一条：差多少量 → 怎么补 → 不补会怎样（大致时间）
    for (var j = 0; j < A.rows.length && lowLines.length < 8; j++) {
        var t2 = A.rows[j];
        if (!t2.low && !t2.weak) continue;
        var inf = t2.adv || {};
        lowLines.push("· " + t2.name + " " + elemAmtStr(t2) +
            (inf.s ? " → 补：" + inf.s : "") +
            (inf.m ? "；不补：" + inf.m + (inf.t && inf.t !== "—" ? "（" + inf.t + "）" : "") : ""));
    }
    var tail, hasLow = false;
    for (var q = 0; q < A.rows.length; q++) { if (A.rows[q].low) { hasLow = true; break; } }
    if (lowLines.length) {
        tail = "\n" + (hasLow ? "要补的几项（按量看缺口）：" : "相对最弱的两项（不算缺，可以多吃点）：") +
            "\n" + lowLines.join("\n") + "\n（想更准就多拍几顿饭，样本越多越靠得住）";
    } else { tail = "\n各项都在线，继续保持～"; }
    return head + tail;
}
// ===== v0.7.0 账本分类汇总（用户 2026-10-18：收入和各种支出都要记上，好算每天怎么吃）=====
var MONEY_CAT_MAP = [
    { k: "加油充电", re: /(加油|加气|汽油|充电|电费|油费)/ },
    { k: "吃饭", re: /(吃饭|午饭|晚饭|早点|早饭|夜宵|宵夜|买菜|水果|吃|饭)/ },
    { k: "车务", re: /(停车|洗车|保养|修车|保险|年检|罚款|罚|轮胎|过路|高速|维修|配件)/ },
    { k: "份子租金", re: /(份子|租金|车租|抽成|平台费|服务费)/ },
    { k: "生活", re: /(话费|水电|房租|日用|药|医院|衣服|理发|烟|孩子|家用)/ }
];
function moneyCatOf(cat, raw) {
    var s = String(cat || "") + String(raw || "");
    for (var i = 0; i < MONEY_CAT_MAP.length; i++) if (MONEY_CAT_MAP[i].re.test(s)) return MONEY_CAT_MAP[i].k;
    return "其他";
}
// 近 N 天账本汇总：收入/支出/分类占比/日均/结余率/时薪
function moneySummary(days) {
    ensureWorkMem();
    days = days || 7;
    var since = careDayStart(careDayKey(Date.now() - (days - 1) * 86400000));
    var ins = 0, outs = 0, byCat = {}, nIn = 0, nOut = 0, dayKeys = {}, hours = 0, orders = 0;
    for (var i = 0; i < MEM.money.length; i++) {
        var r = MEM.money[i];
        if (!r || !(r.t >= since)) continue;
        dayKeys[careDayKey(r.t)] = 1;
        if (r.kind === "in") { ins += r.amt; nIn++; }
        else { outs += r.amt; nOut++; var c = moneyCatOf(r.cat, r.raw); byCat[c] = (byCat[c] || 0) + r.amt; }
    }
    for (var dk in MEM.work.days) {
        var w = MEM.work.days[dk];
        if (!w || careDayStart(dk) < since) continue;
        if (w.hours) hours += w.hours;
        if (w.orders) orders += w.orders;
    }
    var nDays = 0; for (var k in dayKeys) nDays++;
    var cats = [];
    for (var c2 in byCat) cats.push({ cat: c2, amt: byCat[c2], pct: outs > 0 ? byCat[c2] / outs * 100 : 0 });
    cats.sort(function (a, b) { return b.amt - a.amt; });
    var net = ins - outs;
    return {
        days: days, nDays: nDays, ins: ins, outs: outs, net: net,
        inAvg: nDays > 0 ? ins / nDays : 0, outAvg: nDays > 0 ? outs / nDays : 0,
        hours: hours, orders: orders, hourly: hours > 0 ? ins / hours : 0,
        perOrder: orders > 0 ? ins / orders : 0,
        saveRate: ins > 0 ? net / ins * 100 : 0,
        cats: cats, nIn: nIn, nOut: nOut
    };
}
function moneySummaryText(days) {
    var m = moneySummary(days || 7);
    if (!m.nIn && !m.nOut) return "近 " + m.days + " 天还没账（说一句「今天跑了 320，加油 200」我就记）";
    var s = "近 " + m.days + " 天（记账 " + m.nDays + " 天）：收入 " + careYuan(m.ins) + "、支出 " + careYuan(m.outs) + "、净 " + careYuan(m.net) + " 元";
    if (m.inAvg > 0) s += "；日均收入 " + careYuan(m.inAvg) + "、日均支出 " + careYuan(m.outAvg) + " 元";
    if (m.ins > 0) s += "；结余率 " + m.saveRate.toFixed(0) + "%";
    if (m.hourly > 0) s += "；时薪约 " + m.hourly.toFixed(1) + " 元";
    if (m.cats.length) {
        var cs = [];
        for (var i = 0; i < m.cats.length && i < 5; i++) cs.push(m.cats[i].cat + " " + careYuan(m.cats[i].amt) + " 元(" + m.cats[i].pct.toFixed(0) + "%)");
        s += "\n支出构成：" + cs.join("、");
    }
    return s;
}

// ===== v0.7.0 今日怎么吃（性价比最优）——用户 2026-10-18 点单 =====
// 思路：把「健康缺口」和「钱包」放在一张表上算——每种常见食材给价格与营养（按一份），
//   缺口/价格 = 性价比，在预算内贪心挑最划算的组合，保证有主食/蛋白/蔬菜/水果奶蛋四类。
// 诚实边界：营养值是常见食材的公开大致值；价格是普通小城市/县城的常见价（元/份），各地有出入。
var FOOD_LIB = [
    { n: "米饭(2两)", p: 1.0, g: "main", cal: 230, pro: 4, fat: 0.5, carb: 50, fib: 0.6, ca: 10, fe: 0.4, zn: 0.6, se: 2, k: 60, mg: 15, na: 2, va: 0, vb: 0.05, vc: 0, vd: 0, ve: 0.1, i: 0 },
    { n: "馒头(2个)", p: 1.5, g: "main", cal: 280, pro: 8, fat: 1, carb: 58, fib: 1.6, ca: 30, fe: 1, zn: 0.8, se: 6, k: 100, mg: 30, na: 150, va: 0, vb: 0.12, vc: 0, vd: 0, ve: 0.3, i: 0 },
    { n: "面条(1碗)", p: 2, g: "main", cal: 300, pro: 9, fat: 1.5, carb: 60, fib: 1.5, ca: 20, fe: 1, zn: 0.9, se: 8, k: 80, mg: 25, na: 200, va: 0, vb: 0.1, vc: 0, vd: 0, ve: 0.2, i: 0 },
    { n: "杂粮粥(1碗)", p: 1.5, g: "main", cal: 150, pro: 4, fat: 1, carb: 30, fib: 2.5, ca: 20, fe: 1, zn: 0.8, se: 3, k: 120, mg: 40, na: 5, va: 0, vb: 0.15, vc: 0, vd: 0, ve: 0.2, i: 0 },
    { n: "鸡蛋(1个)", p: 1.5, g: "daily", cal: 75, pro: 6.5, fat: 5, carb: 0.5, fib: 0, ca: 25, fe: 1, zn: 0.6, se: 10, k: 70, mg: 6, na: 70, va: 70, vb: 0.1, vc: 0, vd: 1, ve: 0.5, i: 10 },
    { n: "牛奶(250ml)", p: 3, g: "daily", cal: 160, pro: 8, fat: 8, carb: 12, fib: 0, ca: 300, fe: 0.3, zn: 1, se: 5, k: 380, mg: 30, na: 100, va: 60, vb: 0.4, vc: 2, vd: 1.5, ve: 0.2, i: 15 },
    { n: "酸奶(200g)", p: 3.5, g: "daily", cal: 140, pro: 6, fat: 5, carb: 18, fib: 0, ca: 240, fe: 0.2, zn: 0.8, se: 4, k: 300, mg: 25, na: 80, va: 40, vb: 0.3, vc: 2, vd: 0.5, ve: 0.1, i: 12 },
    { n: "豆腐(300g)", p: 2.5, g: "protein", cal: 240, pro: 24, fat: 12, carb: 9, fib: 1.5, ca: 350, fe: 5, zn: 3, se: 6, k: 350, mg: 90, na: 15, va: 0, vb: 0.15, vc: 0, vd: 0, ve: 2, i: 0 },
    { n: "豆浆(500ml)", p: 2, g: "daily", cal: 160, pro: 15, fat: 8, carb: 10, fib: 1.5, ca: 50, fe: 2.5, zn: 1.5, se: 3, k: 600, mg: 60, na: 10, va: 0, vb: 0.1, vc: 0, vd: 0, ve: 0.5, i: 0 },
    { n: "瘦肉(100g)", p: 9, g: "protein", cal: 200, pro: 20, fat: 12, carb: 0, fib: 0, ca: 10, fe: 2.5, zn: 2.5, se: 12, k: 300, mg: 22, na: 60, va: 10, vb: 0.5, vc: 0, vd: 0, ve: 0.3, i: 3 },
    { n: "鸡胸肉(150g)", p: 8, g: "protein", cal: 200, pro: 34, fat: 5, carb: 0, fib: 0, ca: 15, fe: 1.5, zn: 1.5, se: 20, k: 500, mg: 45, na: 80, va: 15, vb: 0.9, vc: 0, vd: 0.2, ve: 0.4, i: 5 },
    { n: "鱼(150g)", p: 10, g: "protein", cal: 180, pro: 27, fat: 7, carb: 0, fib: 0, ca: 60, fe: 1.5, zn: 1.5, se: 25, k: 500, mg: 50, na: 100, va: 20, vb: 0.2, vc: 0, vd: 5, ve: 1, i: 30 },
    { n: "猪肝(100g)", p: 6, g: "protein", cal: 130, pro: 19, fat: 4, carb: 5, fib: 0, ca: 15, fe: 22, zn: 5, se: 20, k: 250, mg: 24, na: 70, va: 5000, vb: 0.4, vc: 20, vd: 1, ve: 0.9, i: 15 },
    { n: "菠菜(300g)", p: 3, g: "veg", cal: 80, pro: 8, fat: 1, carb: 13, fib: 6, ca: 300, fe: 8, zn: 2, se: 3, k: 900, mg: 170, na: 250, va: 1400, vb: 0.2, vc: 100, vd: 0, ve: 6, i: 10 },
    { n: "青菜/白菜(300g)", p: 2.5, g: "veg", cal: 60, pro: 4, fat: 0.5, carb: 10, fib: 4, ca: 200, fe: 3, zn: 1, se: 2, k: 700, mg: 80, na: 150, va: 600, vb: 0.15, vc: 80, vd: 0, ve: 3, i: 5 },
    { n: "土豆(300g)", p: 2, g: "veg", cal: 230, pro: 6, fat: 0.6, carb: 50, fib: 5, ca: 30, fe: 2.4, zn: 1, se: 2, k: 1000, mg: 70, na: 15, va: 0, vb: 0.2, vc: 40, vd: 0, ve: 0.5, i: 0 },
    { n: "西红柿(200g)", p: 2, g: "veg", cal: 40, pro: 2, fat: 0.4, carb: 8, fib: 2, ca: 20, fe: 0.8, zn: 0.4, se: 1, k: 400, mg: 20, na: 10, va: 300, vb: 0.1, vc: 40, vd: 0, ve: 1, i: 2 },
    { n: "胡萝卜(200g)", p: 1.5, g: "veg", cal: 80, pro: 2, fat: 0.4, carb: 18, fib: 5, ca: 60, fe: 1, zn: 0.5, se: 1, k: 600, mg: 25, na: 150, va: 1600, vb: 0.1, vc: 12, vd: 0, ve: 1, i: 0 },
    { n: "香蕉(1根)", p: 1.5, g: "fruit", cal: 90, pro: 1, fat: 0.3, carb: 22, fib: 2.5, ca: 8, fe: 0.3, zn: 0.2, se: 1, k: 400, mg: 30, na: 1, va: 10, vb: 0.05, vc: 9, vd: 0, ve: 0.2, i: 0 },
    { n: "橙子/苹果(1个)", p: 2, g: "fruit", cal: 80, pro: 1, fat: 0.3, carb: 20, fib: 3, ca: 30, fe: 0.3, zn: 0.2, se: 1, k: 200, mg: 20, na: 2, va: 20, vb: 0.06, vc: 50, vd: 0, ve: 0.2, i: 1 },
    { n: "花生/坚果(30g)", p: 2, g: "fruit", cal: 180, pro: 7, fat: 15, carb: 6, fib: 2.5, ca: 30, fe: 0.6, zn: 1, se: 2, k: 200, mg: 60, na: 5, va: 0, vb: 0.1, vc: 0, vd: 0, ve: 3, i: 0 },
    { n: "海带/紫菜(1份)", p: 2, g: "veg", cal: 30, pro: 2, fat: 0.3, carb: 6, fib: 3, ca: 100, fe: 3, zn: 1, se: 5, k: 200, mg: 60, na: 300, va: 20, vb: 0.05, vc: 5, vd: 0, ve: 0.5, i: 800 },
    { n: "青椒(200g)", p: 2, g: "veg", cal: 60, pro: 2, fat: 0.4, carb: 14, fib: 4, ca: 30, fe: 0.8, zn: 0.5, se: 1, k: 400, mg: 25, na: 10, va: 60, vb: 0.1, vc: 140, vd: 0, ve: 1, i: 3 },
    { n: "食用油(15g)", p: 1, g: "oil", cal: 135, pro: 0, fat: 15, carb: 0, fib: 0, ca: 0, fe: 0, zn: 0, se: 0, k: 0, mg: 0, na: 0, va: 0, vb: 0, vc: 0, vd: 0, ve: 2, i: 0 }
];
// 只参与「补缺口」的营养（钠是限量、热量/脂肪/碳水是能量项，不拿来补）
var DIET_NEED = [["pro", "蛋白"], ["fib", "纤"], ["ca", "钙"], ["fe", "铁"], ["zn", "锌"], ["se", "硒"], ["k", "钾"], ["mg", "镁"], ["va", "维A"], ["vb", "维B"], ["vc", "维C"], ["vd", "维D"], ["ve", "维E"], ["i", "碘"]];
// 今天已经吃进去的量（按档位折算，一餐按 1/3 天）
function dietTodayHave() {
    var have = {}, dk = careDayKey(Date.now()), dd = (MEM.health && MEM.health.diet) || [], meals = 0, todays = [];
    for (var i = 0; i < dd.length; i++) {
        var r = dd[i];
        if (!r || !r.elems || careDayKey(r.t) !== dk) continue;
        todays.push(r);   // 2026-10-22（㉗）：顿数按餐次去重，不再一条记录算一顿
        for (var k in r.elems) { var a = elemAmount(k, r.elems[k]); if (a) have[k] = (have[k] || 0) + a.est / 3; }
        // 营养塔也折算进蛋白（用户 2026-10-18：所有营养都要算量，别只看 13 项元素）
        if (r.nutri && r.nutri.dan) have["pro"] = (have["pro"] || 0) + ELEM_REF["蛋白"].rda * Math.min(1, r.nutri.dan / 5) / 3;
    }
    meals = careMealSlotCount(todays);
    return { have: have, meals: meals };
}
// 伙食预算的自动口径（2026-10-19 抽成小函数，方便单测、也方便别处复用）：
//   他嘴里说过的净收入优先（预算＝净收入的一半）；没说过才退回「日均流水 ×25%」；都没有用 15 元兜底。
//   为什么不能用流水：他的真实净收入只有 30 元/天，按流水 165.9×25% 算出来的 41 元是「消费能力」的假象。
function dietBudgetAuto(ms, statedNet) {
    if (statedNet > 0) return { budget: Math.round(Math.max(8, Math.min(60, statedNet * 0.5))), src: "按你说的每天净收入 " + statedNet + " 元的一半" };
    if (ms && ms.inAvg > 0) return { budget: Math.round(Math.max(10, Math.min(60, ms.inAvg * 0.25))), src: "按近 7 天日均流水 " + ms.inAvg.toFixed(0) + " 元的 25%（你说过的净收入我会更准）" };
    return { budget: 15, src: "还没收支数据，先按 15 元/天" };
}
// 今日吃法：预算 + 缺口 → 贪心挑最划算的组合
function dietPlan(opt) {
    opt = opt || {};
    var ms = moneySummary(7), budget = parseFloat(opt.budget), src = "";
    // 【2026-10-19 用户两轮点出】面板「🍚 今天怎么吃（预算 41 元）」一直不变——41 = 日均流水 165.9 × 25%，
    // 而他的真实净收入只有 30 元/天，等于拿流水当消费能力（支出还没记全，账面只会更虚）。
    // 改：①他嘴里说过的净收入优先（事实里的数），预算＝净收入的 50%（30 → 15 元/天，够吃三顿）；
    //     ②没说过才退回「日均流水 25%」的老口径，并在文案里写明是按流水估的；
    //     ③都没有才用兜底值（15 元，不再用 40 元那种一眼就离谱的数）。
    var statedNet = 0;
    try { statedNet = careStatedNet(); } catch (eSN) { statedNet = 0; }
    if (!(budget > 0)) {
        var bd = dietBudgetAuto(ms, statedNet);
        budget = bd.budget; src = bd.src;
    }
    var th = dietTodayHave(), need = {}, i2;
    for (i2 = 0; i2 < DIET_NEED.length; i2++) {
        var nm = DIET_NEED[i2][1], left = ELEM_REF[nm].rda - (th.have[nm] || 0);
        need[DIET_NEED[i2][0]] = left > 0 ? left : 0;
    }
    // 候选打分：每元能补的缺口比例
    var cand = [];
    for (var f = 0; f < FOOD_LIB.length; f++) {
        var o = FOOD_LIB[f], score = 0;
        for (i2 = 0; i2 < DIET_NEED.length; i2++) {
            var kk = DIET_NEED[i2][0], nv = o[kk] || 0;
            if (nv <= 0 || need[kk] <= 0) continue;
            score += Math.min(1, nv / need[kk]);
        }
        if (score <= 0) continue;
        cand.push({ o: o, per: score / o.p, score: score });
    }
    cand.sort(function (a, b) { return b.per - a.per; });
    // 贪心：每类最多 2 份，总价不超预算的 92%
    var picked = [], gcnt = {}, gpos = {}, spent = 0, rest = {}, k3;
    for (k3 in need) rest[k3] = need[k3];
    for (var x = 0; x < cand.length; x++) {
        var c = cand[x], g = c.o.g || "other";
        if ((gcnt[g] || 0) >= 2) continue;
        if (spent + c.o.p > budget * 0.92) continue;
        picked.push(c.o); gcnt[g] = (gcnt[g] || 0) + 1; spent += c.o.p;
        for (i2 = 0; i2 < DIET_NEED.length; i2++) { var kx = DIET_NEED[i2][0]; rest[kx] = Math.max(0, (rest[kx] || 0) - (c.o[kx] || 0)); }
    }
    // 分餐（同类第一份给第一时段，第二份给第二时段）
    var meals = { "早餐": [], "午餐": [], "晚餐": [], "加餐": [] };
    var gi = { main: ["早餐", "午餐"], protein: ["午餐", "晚餐"], veg: ["午餐", "晚餐"], fruit: ["加餐", "早餐"], daily: ["早餐", "加餐"], oil: ["午餐"], other: ["午餐"] };
    for (var p = 0; p < picked.length; p++) {
        var it = picked[p], slot = gi[it.g] || ["午餐"], idx = gpos[it.g] || 0;
        meals[slot[Math.min(idx, slot.length - 1)]].push(it.n + " " + it.p + "元");
        gpos[it.g] = idx + 1;
    }
    // 能补上的 / 还差的
    var covered = [], lefts = [];
    for (i2 = 0; i2 < DIET_NEED.length; i2++) {
        var kn = DIET_NEED[i2][0], nmn = DIET_NEED[i2][1];
        if (need[kn] <= 0) continue;
        if (rest[kn] <= need[kn] * 0.15) covered.push(nmn);
        else lefts.push(nmn + "还差约 " + rest[kn].toFixed(rest[kn] >= 100 ? 0 : 1) + ELEM_REF[nmn].u);
    }
    var lines = [], order = ["早餐", "午餐", "晚餐", "加餐"];
    for (var q = 0; q < order.length; q++) {
        if (!meals[order[q]].length) continue;
        lines.push(order[q] + "：" + meals[order[q]].join(" + "));
    }
    if (!lines.length) {
        var anyNeed = false;
        for (i2 = 0; i2 < DIET_NEED.length; i2++) { if (need[DIET_NEED[i2][0]] > 0) { anyNeed = true; break; } }
        lines.push(anyNeed ? ("预算太少，先吃点主食垫一下（" + budget + " 元一天的话，优先米饭+鸡蛋+当季青菜）") : "今天记的这几顿已经把该补的补得差不多了，别再硬塞——剩下的按「蔬菜+蛋白、少油」吃就行");
    }
    var sum = "合计约 " + spent.toFixed(1) + " 元（预算 " + budget + " 元，" + (budget - spent > 0 ? "还剩 " + (budget - spent).toFixed(1) + " 元" : "刚好卡住") + (src ? "；" + src : "") + "）";
    var tail = "";
    if (covered.length) tail += "\n这套能补上：" + covered.join("、");
    if (lefts.length) tail += "\n还差一点：" + lefts.join("；");
    if (th.meals > 0) tail += "\n（今天你已经记了 " + th.meals + " 顿，上面是按「还没吃的部分」算的）";
    tail += "\n怎么挑的：按「缺口 ÷ 单价」排，先补最缺的、再挑最便宜的；同价位里优先能一餐补多项的（猪肝补铁+维A、豆腐补钙+蛋白、菠菜补铁+维C+纤）。";
    return { ok: true, budget: budget, spent: spent, meals: meals, covered: covered, lefts: lefts, text: lines.join("\n") + "\n" + sum + tail };
}

function parseFoodNote(text) {
    try {
        var s = String(text || "");
        var m = /塔\s*[:：]\s*主(?:食)?\s*[:：]?\s*([1-5])\s*蔬(?:菜)?\s*[:：]?\s*([1-5])\s*蛋(?:白)?\s*[:：]?\s*([1-5])\s*油(?:脂)?\s*[:：]?\s*([1-5])(?:\s*热(?:\s*量)?\s*[:：]?\s*([1-5低中高]))?/.exec(s);
        var verdict = s.replace(/[\n ]?塔\s*[:：][\s\S]*$/, "").replace(/\s+$/, "").trim();
        if (!m) return { verdict: verdict || s, nutri: null };
        var h = m[5];
        var heat = h === "低" ? 1 : (h === "中" ? 2 : (h === "高" ? 3 : parseInt(h, 10)));
        if (!heat || heat < 1 || heat > 3) heat = 2;
        var nutri = { zhu: parseInt(m[1], 10), shu: parseInt(m[2], 10), dan: parseInt(m[3], 10), you: parseInt(m[4], 10), heat: heat };
        var nd = "📊 营养塔：主食 " + barOf(nutri.zhu) + " ｜蔬菜 " + barOf(nutri.shu) + " ｜蛋白 " + barOf(nutri.dan) + " ｜油脂 " + barOf(nutri.you) + " ｜热量 " + (heat === 1 ? "低" : (heat === 3 ? "高" : "中"));
        // v0.4.3：元素体检表（人体所需营养元素：钙铁锌硒钾镁钠 + 维生素 + 膳食纤维）
        var elems = null, elemLine = "";
        var el = /元素\s*[:：]\s*([^\n]{6,200})/.exec(s);
        if (el) {
            var seg = el[1], pair = /(钙|铁|锌|硒|钾|镁|钠|维A|维B|维C|维D|维E|纤)\s*[:：]?\s*([1-5])/g, pm, cnt = 0, parts = [];
            elems = {};
            while ((pm = pair.exec(seg)) !== null) { elems[pm[1]] = parseInt(pm[2], 10); cnt++; parts.push((pm[1] === "纤" ? "膳食纤维" : pm[1]) + barOf(elems[pm[1]])); }
            if (!cnt) elems = null; else elemLine = "🧪 元素：" + parts.join(" ");
        }
        return { verdict: verdict || s, nutri: nutri, tower: nd, elems: elems, elemLine: elemLine };
    } catch (e) { return { verdict: String(text || ""), nutri: null }; }
}
// ===== v0.6.0 跑网约车：收入支出账本 / 休息记录 / 精力估算 / 疲劳提醒 =====
// 用户点单：「说明我在怎么挣钱、每天收入支出、综合分析每顿咋吃、分析我精力、啥时候休息了休息多久，
// 我在跑网约车，好好检测」。诚实边界：网约车平台没有开放接口，读不到真实流水——收入和支出只认「你说的数字」
// 或「你确认过的流水截图」；精力是粗估，不是医学判断；定位默认关，开了也只判「在开车/停靠」，不留轨迹。
var MONEY_KW_IN = ["跑", "挣", "赚", "收入", "流水", "到账", "进账", "入账"];
var MONEY_KW_OUT = ["加油", "加气", "充电", "停车", "洗车", "保养", "修车", "份子", "租金", "车租", "吃饭", "午饭", "晚饭", "早点", "宵夜", "支出", "开销", "花了", "买菜", "药"];
var MONEY_PLATFORMS = ["滴滴", "高德", "曹操", "T3", "花小猪", "美团", "首汽", "享道", "阳光"];
function ensureWorkMem() {
    MEM.money = MEM.money || [];
    MEM.fixed = MEM.fixed || [];
    MEM.rest = MEM.rest || [];
    MEM.work = MEM.work || { mode: "网约车", gps: false, since: Date.now() };
    MEM.work.days = MEM.work.days || {};
    // 2026-10-22（㉗ 账与饭不可错）：老饮食记录一次性补餐次标记。幂等（有标记的直接规整跳过），
    //   补完之后 careMealSlotOf 只读 r.meal，顿数不再受「一条记录算一顿」影响。
    try { MEM.health = MEM.health || { diet: [] }; if (MEM.health.diet && MEM.health.diet.length) careMigrateMealTags(); } catch (eMT) {}
}
function careDayKeyOf(ms) { var d = new Date(ms); return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate(); }
// 解析「今天跑了320，加油200，在线9小时，23单」这类话；命中返回 true 并由调用方给回复
// v0.6.2：判断「这是不是一条真·指令」——用户 20:32 实测被快回顶掉 AI 的教训：
// 「我很多天都是每天跑100多元…」被当成「今天收入 100」；「你看我之前给你说的我休息情况」被当成「现在开始歇」。
// 原则：**只在明确是「今天/刚才」的流水或明确是「现在开始歇/起来」时才快回**，其余（问句、回忆、含糊）一律交给 AI 答。
function careIsQuestion(s) {
    return /[?？]\s*$/.test(s) || /(吗|咋|怎么|为啥|为什么|是不是|多少|几点|多久|你看|我说|说过|记得|情况)/.test(s);
}
function careIsExplicitCommand(s) {
    return /(帮我记|记一下|记一笔|记上|记个账|报一下|记账)/.test(s);
}
function careMoneyDigest(msg) {
    try {
        ensureWorkMem();
        var s = String(msg || "");
        // 只认「今天/今日/刚才/今儿」这类当期流水，或用户明说「帮我记」；
        // 「我很多天都是每天跑100多」这种回忆/概括不记账，交给 AI 正常聊。
        var today = /(今天|今日|今儿|刚才|刚刚|这趟|这单)/.test(s);
        if (!today && !careIsExplicitCommand(s)) return false;
        var re = /(加油|加气|充电|停车|洗车|保养|修车|份子|租金|车租|吃饭|午饭|晚饭|早点|宵夜|支出|开销|花了|买菜|药|跑|挣|赚|收入|流水|到账|进账|入账)[了]?\s*[:：]?\s*(\d+(?:\.\d+)?)/g;
        var m, items = [];
        while ((m = re.exec(s)) !== null) {
            var kw = m[1], amt = parseFloat(m[2]);
            if (!isFinite(amt) || amt <= 0 || amt > 100000) continue;
            var kind = (MONEY_KW_IN.indexOf(kw) >= 0) ? "in" : "out";
            items.push({ kind: kind, amt: amt, cat: kw });
        }
        var hh = /(?:在线|出车|跑车|开车)[了]?\s*(\d+(?:\.\d+)?)\s*(?:个)?\s*(?:小时|钟头|h)/.exec(s);
        var od = /(\d+)\s*单/.exec(s);
        if (!items.length && !hh && !od) return false;
        var now = Date.now();
        for (var i = 0; i < items.length; i++) {
            MEM.money.push({ t: now, kind: items[i].kind, amt: items[i].amt, cat: items[i].cat, raw: s.slice(0, 40) });
        }
        if (MEM.money.length > 3000) MEM.money = MEM.money.slice(-3000);
        var dk = careDayKeyOf(now);
        MEM.work.days[dk] = MEM.work.days[dk] || {};
        if (hh) MEM.work.days[dk].hours = parseFloat(hh[1]);
        if (od) MEM.work.days[dk].orders = parseInt(od[1], 10);
        for (var p = 0; p < MONEY_PLATFORMS.length; p++) { if (s.indexOf(MONEY_PLATFORMS[p]) >= 0) MEM.work.platform = MONEY_PLATFORMS[p]; }
        var t = careMoneyToday();
        saveMem();
        log("账本+：" + items.length + " 条（今日 收" + t.inSum.toFixed(0) + " 支" + t.outSum.toFixed(0) + "）" + (hh ? " 在线" + hh[1] + "h" : "") + (od ? " " + od[1] + "单" : ""));
        return { ok: true, text: "记下了～" + careMoneyTodayText() };
    } catch (e) { log("账本解析异常：" + e); return false; }
}
// 2026-10-22（任务队列 ㉗：账与饭不可错）：账本历史只读——修正不再删记录，改成**追加一条冲正/补记**。
// 为什么不能删：10-20 那次被抹掉的记录永远查不回来，他问「为什么变了」也没有证据。
// 怎么做到不删也能改：金额允许为负，而所有汇总都是「kind=in 就加收入、否则加支出」，
//   负数条目天然把账抵掉 —— 所以**一个汇总口径都不用改**（今日/某天/近 N 天/历史页全部照旧）。
// 注意：必须继续用 kind=in/out，不要新造 kind —— 汇总的 else 分支会把未知 kind 当支出。
function moneyAdjust(dIn, dOut, why) {
    ensureWorkMem();
    var now = Date.now(), n = 0;
    var r2 = function (x) { return Math.round(Number(x) * 100) / 100; };
    if (Math.abs(Number(dIn) || 0) > 0.004) {
        MEM.money.push({ t: now, kind: "in", amt: r2(dIn), cat: (dIn < 0 ? "冲正" : "补记"), raw: String(why || "AI 调整").slice(0, 16) });
        n++;
    }
    if (Math.abs(Number(dOut) || 0) > 0.004) {
        MEM.money.push({ t: now, kind: "out", amt: r2(dOut), cat: (dOut < 0 ? "冲正" : "补记"), raw: String(why || "AI 调整").slice(0, 16) });
        n++;
    }
    if (MEM.money.length > 3000) MEM.money = MEM.money.slice(-3000);
    return n;
}
function careMoneyToday() {
    ensureWorkMem();
    var dk = careDayKeyOf(Date.now()), ins = 0, outs = 0, arr = [];
    for (var i = 0; i < MEM.money.length; i++) {
        var r = MEM.money[i];
        if (!r || careDayKeyOf(r.t) !== dk) continue;
        if (r.kind === "in") ins += r.amt; else outs += r.amt;
        arr.push(r);
    }
    return { inSum: ins, outSum: outs, net: ins - outs, items: arr, day: MEM.work.days[dk] || {} };
}
// v1.5.16（2026-10-18 16:21 实测发现）：金额一律 toFixed(0) 会把 7.5 变成 8——用户嘴上说「支出 7.5」，
//   面板却报「支出 8 元」，看着就像「账本又错了」。改成按真实值显示：整数不拖小数，有小数最多两位。
function careYuan(n) {
    var v = Number(n);
    if (!isFinite(v)) v = 0;
    var s = Math.abs(v) < 1e-9 ? "0" : v.toFixed(2);
    s = s.replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
    return s;
}
function careMoneyTodayText() {    var t = careMoneyToday();
    var fixTxt = careFixedMonthlyText();
    if (!t.items.length && !t.day.hours) return fixTxt ? fixTxt : "今天还没记账（说一句「今天跑了 320，加油 200」我就记下）";
    var s = "今日收入 " + careYuan(t.inSum) + " 元、支出 " + careYuan(t.outSum) + " 元、净 " + careYuan(t.net) + " 元";
    // 2026-10-21 23:2x（用户：「之前的已经扣了，你又重复扣」）：改成**账本里每天记一笔固定支出日均摊**，
    // 净里本来就含它，这里不再二次扣；没补上那笔时由 careEnsureDailyFixed 兜（每天最多一笔）。
    if (t.day.hours) {
        s += "；在线 " + t.day.hours + " 小时";
        if (t.inSum > 0) s += "，时薪约 " + (t.inSum / t.day.hours).toFixed(1) + " 元";
    }
    if (t.day.orders && t.inSum > 0) s += "；" + t.day.orders + " 单，每单约 " + (t.inSum / t.day.orders).toFixed(1) + " 元";
    if (fixTxt) s += "｜" + fixTxt;
    return s;
}
// v2.1.3（2026-10-19 02:0x·用户当面骂「你是猪吗？我说昨天的」实锤）：
//   查账只有「今天」一个口径 —— careMoneyTodayText() 在当天没账时直接返回「每月固定支出 2200 元…」，
//   于是主人问「昨天的记账」，App 拿今天的空账去答，嘴里蹦出的全是车租金，答非所问（01:52:12 日志）。
//   补一个**按天**的查账：dayOffset 0=今天、1=昨天、2=前天…；没账就明说「那天没记账」，绝不拿固定支出顶包。
function careMoneyDayKey(off) { return careDayKey(Date.now() - (Number(off) || 0) * 86400000); }
function careMoneyDayText(off) {
    ensureWorkMem();
    var n = Number(off) || 0;
    var dk = careMoneyDayKey(n);
    var ins = 0, outs = 0, items = [];
    for (var i = 0; i < MEM.money.length; i++) {
        var r = MEM.money[i];
        if (!r || careDayKeyOf(r.t) !== dk) continue;
        if (r.kind === "in") ins += r.amt; else outs += r.amt;
        items.push(r);
    }
    var w = (MEM.work && MEM.work.days && MEM.work.days[dk]) || {};
    var label = n === 0 ? "今天" : (n === 1 ? "昨天" : (n === 2 ? "前天" : n + " 天前"));
    if (!items.length && !w.hours) return label + "（" + dk + "）没记账";
    var s = label + "（" + dk + "）：收入 " + careYuan(ins) + " 元、支出 " + careYuan(outs) + " 元、净 " + careYuan(ins - outs) + " 元";
    // 同上：固定支出日均摊是账本里的一笔真实支出，不再在文字里扣第二次。
    if (w.hours) {
        s += "；在线 " + w.hours + " 小时";
        if (ins > 0) s += "，时薪约 " + (ins / w.hours).toFixed(1) + " 元";
    }
    if (w.orders && ins > 0) s += "；" + w.orders + " 单，每单约 " + (ins / w.orders).toFixed(1) + " 元";
    if (items.length) {
        var ds = [];
        for (var j = 0; j < items.length && j < 12; j++) {
            var it = items[j];
            ds.push((it.kind === "in" ? "收 " : "支 ") + careYuan(it.amt) + (it.cat ? "（" + it.cat + "）" : ""));
        }
        s += "\n明细：" + ds.join("；");
    }
    return s;
}
// 把模型给的参数（day: "昨天" / "前天" / "3天前" / 1 ｜ days: 近 N 天）翻成一句话
function careMoneyArgText(a) {
    a = a || {};
    var d = a.day;
    if (d === undefined || d === null || d === "") {
        if (a.days) return moneySummaryText(Number(a.days) || 7);
        return careMoneyDayText(0);
    }
    if (typeof d === "number") return careMoneyDayText(d);
    var s = String(d);
    if (s.indexOf("今天") >= 0 || s === "today" || s === "0") return careMoneyDayText(0);
    if (s.indexOf("昨天") >= 0 || s === "yesterday" || s === "1") return careMoneyDayText(1);
    if (s.indexOf("前天") >= 0 || s === "2") return careMoneyDayText(2);
    var mm = s.match(/(\d+)/);
    return careMoneyDayText(mm ? parseInt(mm[1], 10) : 0);
}
// v2.1.4（2026-10-19 02:1x·用户点单「账本显示和元素显示都加上历史查看按钮，可以随时查看所有历史」）：
//   面板原来只有「今天」。这里给面板两条只读历史通道（days=0 表示全部，目前页面传 0）：
//   · 账本：按天倒序，每天收入/支出/净/在线小时/单量 + 每一笔明细（收/支、金额、分类、原文）
//   · 元素：按天倒序，每天几顿饭 + 13 项元素当天估算合计（口径与「今日元素」一致：每顿 est/3 累加）
//   只读、不改任何数据；数据就是本地 关心_记忆.json 的 money / health.diet[].elems。
function careHistMoney(days) {
    ensureWorkMem();
    var n = Number(days) || 0;
    var since = n > 0 ? careDayStart(careDayKey(Date.now() - (n - 1) * 86400000)) : 0;
    var byDay = {}, ord = [];
    for (var i = 0; i < MEM.money.length; i++) {
        var m = MEM.money[i];
        if (!m || !m.t) continue;
        if (since && m.t < since) continue;
        var dk = careDayKey(m.t);
        if (!byDay[dk]) { byDay[dk] = { dk: dk, ins: 0, outs: 0, items: [] }; ord.push(dk); }
        if (m.kind === "in") byDay[dk].ins += m.amt; else byDay[dk].outs += m.amt;
        byDay[dk].items.push({ t: m.t, kind: m.kind, amt: m.amt, cat: String(m.cat || ""), raw: String(m.raw || "").slice(0, 24) });
    }
    ord.sort();
    ord.reverse();
    var rows = [];
    for (var j = 0; j < ord.length; j++) {
        var d = byDay[ord[j]], w = (MEM.work && MEM.work.days && MEM.work.days[d.dk]) || {};
        d.net = d.ins - d.outs;
        d.hours = w.hours || 0;
        d.orders = w.orders || 0;
        rows.push(d);
    }
    return { ok: true, what: "money", days: n, total: rows.length, rows: rows };
}
function careHistElem(days) {
    ensureWorkMem();
    var n = Number(days) || 0;
    var since = n > 0 ? careDayStart(careDayKey(Date.now() - (n - 1) * 86400000)) : 0;
    var arr = (MEM.health && MEM.health.diet) || [];
    var byDay = {}, ord = [];
    try { log("元素历史体检：diet 共 " + arr.length + " 条"); } catch (eL) {}
    // 2026-10-22：主人打开「元素历史」时顺手把缺元素的饭补上（异步 + 10 分钟节流；本函数照旧只读返回）
    try { careDietBackfillElems(2); } catch (eBF2) {}
    for (var i = 0; i < arr.length; i++) {
        var r = arr[i];
        try { if (i >= arr.length - 12) log("元素历史·diet[" + i + "] 天=" + (r && r.t ? careDayKey(r.t) : "无") + " elems=" + (r && r.elems ? Object.keys(r.elems).length + "项" : "无") + " 内容=" + String((r && r.s) || "").slice(0, 18)); } catch (eL2) {}
        // 2026-10-22 13:3x（用户「元素历史没显示今天的记录」）：以前 !r.elems 就整条 continue，
        //   于是“记了饭但元素还没估出来”的日子在历史里**直接消失**，看起来像根本没记。
        //   改成：有天有记录就进历史，元素缺失由上层标“未估”，顿数照常算。
        if (!r || !r.t) continue;
        if (since && r.t < since) continue;
        var dk = careDayKey(r.t);
        if (!byDay[dk]) { byDay[dk] = { dk: dk, meals: 0, sum: {}, recs: [] }; ord.push(dk); }
        byDay[dk].recs.push(r);
        byDay[dk].meals = careMealSlotCount(byDay[dk].recs);
        for (var k in r.elems) {
            if (typeof r.elems[k] !== "number") continue;
            var a = elemAmount(k, r.elems[k]);
            if (a) byDay[dk].sum[k] = (byDay[dk].sum[k] || 0) + a.est / 3;
        }
    }
    ord.sort();
    ord.reverse();
    var rows = [];
    for (var j = 0; j < ord.length; j++) rows.push(byDay[ord[j]]);
    var ref = {};
    try { for (var kk in ELEM_REF) ref[kk] = { n: ELEM_REF[kk].n, u: ELEM_REF[kk].u, rda: ELEM_REF[kk].rda }; } catch (eR) {}
    return { ok: true, what: "elem", days: n, total: rows.length, rows: rows, ref: ref };
}
function careHist(what, days) {
    return String(what) === "elem" ? careHistElem(days) : careHistMoney(days);
}
// 2026-10-21 ccode·用户 10-20 22:22 第三次点名「每天要减车租均摊重新记」：
//   摊的是「车租这类每月固定、不是当天真花出去」的钱，所以单列一句扣减，不塞进今日支出（否则支出被凭空拉高）。
function careFixedDaily() {
    try {
        ensureWorkMem();
        var arr = MEM.fixed || [], tot = 0;
        for (var i = 0; i < arr.length; i++) {
            var f = arr[i];
            if (!f || !f.amt) continue;
            tot += (String(f.cycle || "月") === "年") ? (f.amt / 12) : f.amt;
        }
        return Math.round(tot / 30 * 100) / 100;
    } catch (e) { return 0; }
}
// 2026-10-21 23:2x：把「固定支出日均摊」做成账本里的一笔真实支出（每天一笔，cat=固定支出）。
//   为什么改成记行：主人对账看的是**明细**——10-19 那天就是这么记的，他说「之前的已经扣了」；
//   再在文字里「再扣一次」就是重复扣。
//   只在「当天已经有别的账」时才补（那天没记账就不硬扣）；同一天只补一次。
function careEnsureDailyFixed(dk) {
    try {
        ensureWorkMem();
        var daily = careFixedDaily();
        if (!(daily > 0)) return false;
        dk = dk || careDayKey(Date.now());
        var hasAny = false, hasFixed = false, i;
        for (i = 0; i < MEM.money.length; i++) {
            var r = MEM.money[i];
            if (!r || careDayKeyOf(r.t) !== dk) continue;
            hasAny = true;
            if (String(r.cat || "") === "固定支出") hasFixed = true;
        }
        if (!hasAny || hasFixed) return false;
        var d0 = careDayStart(dk) + 5 * 60000;   // 记在当天 00:05，排序上永远在最前
        MEM.money.push({ t: d0, kind: "out", amt: daily, cat: "固定支出", raw: "车租等固定支出日均摊（自动）" });
        MEM.money.sort(function (a, b) { return (a.t || 0) - (b.t || 0); });
        saveMem();
        try { log("自动记：固定支出日均摊 " + daily + " 元（" + dk + "）"); } catch (eL) {}
        return true;
    } catch (e) { return false; }
}
// v1.5.0：固定支出的「每月合计＋日均摊销」一句话（车租金 2220/月 → 每月固定 2220、日均摊约 74）
function careFixedMonthlyText() {
    try {
        ensureWorkMem();
        var arr = MEM.fixed || [], tot = 0, names = [];
        for (var i = 0; i < arr.length; i++) {
            var f = arr[i];
            if (!f || !f.amt) continue;
            var isYear = String(f.cycle || "月") === "年";
            var m = isYear ? (f.amt / 12) : f.amt;
            tot += m;
            names.push(String(f.name || "固定").slice(0, 8) + " " + f.amt + " 元/" + (isYear ? "年" : "月"));
        }
        if (!tot) return "";
        return "每月固定支出 " + careYuan(tot) + " 元（日均摊约 " + careYuan(tot / 30) + " 元）：" + names.join("、");
    } catch (e) { return ""; }
}
// —— 休息记录：我说一句就记；也能由「屏幕灭 + 不动」自动补一条粗记录 ——
// v0.6.2：中文数字（「一」「两」「半」「一个半」）
function careCnNum(t) {
    var s = String(t || "").trim();
    if (/^[0-9]+(\.[0-9]+)?$/.test(s)) return parseFloat(s);
    var map = { "零": 0, "一": 1, "两": 2, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7, "八": 8, "九": 9, "十": 10, "半": 0.5 };
    if (s.length === 1) return map[s] != null ? map[s] : NaN;
    if (s.indexOf("十") === 0) { var r = 10; var rest2 = s.slice(1); if (map[rest2] != null) r += map[rest2]; return r; }
    return NaN;
}
// v0.6.2：**过去式休息**——用户报「午饭休息了1小时左右晚饭也是」时，要当成「补记历史」而不是「现在开始歇」
// （2026-10-17 20:00 实锤：旧逻辑把这句话当成开始休息，用户当场骂「你懂不起吗」）
var CARE_MEAL_HOUR = { "早点": 7, "早餐": 7, "早饭": 7, "午饭": 12, "中午": 12, "晚饭": 18, "晚上": 19, "夜宵": 22, "宵夜": 22 };
function careRestPast(msg) {
    try {
        ensureWorkMem();
        var s = String(msg || "");
        if (!/(休息|歇|睡|躺|眯|打盹)/.test(s)) return false;
        if (!/(了|过|左右|大概|差不多|之前|刚才|那次)/.test(s)) return false;            // 有过去式线索才算
        if (!/([0-9]+(\.[0-9]+)?|[一二两三四五六七八九十半]+)\s*个?\s*(半)?\s*(小时|钟头|h|分钟|分)/.test(s)) return false;
        var re = /([0-9]+(?:\.[0-9]+)?|[一二两三四五六七八九十半]+)\s*个?\s*(半)?\s*(小时|钟头|h|分钟|分)/;
        var m = re.exec(s);
        if (!m) return false;
        var v = careCnNum(m[1]);
        if (!isFinite(v) || v <= 0) return false;
        var dur = v * (/小时|钟头|h/.test(m[3]) ? 60 : 1) + (m[2] ? 30 : 0);
        if (dur > 12 * 60) return false;
        var meals = [];
        for (var k in CARE_MEAL_HOUR) { if (s.indexOf(k) >= 0 && meals.indexOf(CARE_MEAL_HOUR[k]) < 0) meals.push(CARE_MEAL_HOUR[k]); }
        var added = [];
        var list = meals.length ? meals : [12];
        for (var i = 0; i < list.length; i++) {
            var hh = list[i];
            var st = new Date(); st.setHours(hh, 0, 0, 0);
            var ts = st.getTime();
            if (ts > Date.now()) ts -= 86400000;
            MEM.rest.push({ s: ts, e: ts + dur * 60000, auto: false, past: true, note: (hh === 7 ? "早饭" : hh === 12 ? "午饭" : hh === 18 || hh === 19 ? "晚饭" : hh === 22 ? "夜宵" : "那次") });
            added.push((hh === 7 ? "早饭" : hh === 12 ? "午饭" : hh === 18 || hh === 19 ? "晚饭" : hh === 22 ? "夜宵" : "那次") + " 约 " + Math.round(dur) + " 分钟");
        }
        if (MEM.rest.length > 800) MEM.rest = MEM.rest.slice(-800);
        saveMem();
        log("补记过去休息：" + added.join("、") + "（共 " + MEM.rest.length + " 条）");
        return { ok: true, text: "记下了之前歇的：" + added.join("、") + "。今天累计休息约 " + careRestToday().mins + " 分钟——以后直接这么说我就懂，不会再当成「现在开始歇」。" };
    } catch (e) { try { log("过去式休息解析异常：" + e); } catch (e2) {} return false; }
}
function careRestDigest(msg) {
    try {
        ensureWorkMem();
        var s = String(msg || "");
        // v0.7.2：**改/删**类指令单独认（用户 22:12 实测：「把今天的休息时间改1小时」——旧版只会嘴上说）
        var mSet = /(?:休息|歇).{0,10}?(?:时间)?\s*(?:改成|改到|改为|改|设为|设成|调成|调到)\s*([0-9]+(?:\.[0-9]+)?|[一二两三四五六七八九十半]+)\s*个?\s*(半)?\s*(小时|钟头|分钟|分)/.exec(s);
        if (mSet) {
            var v3 = careCnNum(mSet[1]);
            if (isFinite(v3) && v3 > 0) {
                var mi3 = v3 * (/小时|钟头/.test(mSet[3]) ? 60 : 1) + (mSet[2] ? 30 : 0);
                return { ok: true, text: careToolRun("rest_set_day", { minutes: Math.round(mi3) }) };
            }
        }
        var mAdj = /(?:休息|歇).{0,10}?(?:时间)?\s*(减|少|加|多)\s*([0-9]+(?:\.[0-9]+)?|[一二两三四五六七八九十半]+)\s*个?\s*(半)?\s*(小时|钟头|分钟|分)/.exec(s);
        if (mAdj) {
            var v4 = careCnNum(mAdj[2]);
            if (isFinite(v4) && v4 > 0) {
                var d4 = v4 * (/小时|钟头/.test(mAdj[4]) ? 60 : 1) + (mAdj[3] ? 30 : 0);
                var cur4 = careRestToday().mins;
                var target4 = Math.max(0, cur4 + ((mAdj[1] === "减" || mAdj[1] === "少") ? -d4 : d4));
                return { ok: true, text: careToolRun("rest_set_day", { minutes: target4 }) };
            }
        }
        // v0.6.2：先认「过去歇了多久」（补记历史），再判「现在开始/结束」
        var past = careRestPast(s);
        if (past && past.ok) return past;
        var startRe = /(歇会儿|歇一下|休息一下|睡一会|睡一会儿|打个盹|靠边停|停一会儿|先歇|去歇|我开始歇)/;
        var endRe = /(起了|睡醒了|好了|继续跑|开工|出车|走吧|接着跑)/;
        // v0.6.2：问句/回忆句（「你看我之前说的休息情况」「还有晚饭休息呢」）不抢话，交给 AI
        if (careIsQuestion(s) && !careIsExplicitCommand(s)) return false;
        var open = null;
        for (var i = MEM.rest.length - 1; i >= 0; i--) { if (MEM.rest[i] && !MEM.rest[i].e) { open = MEM.rest[i]; break; } }
        if (endRe.test(s) && open) {
            open.e = Date.now(); open.auto = false;
            saveMem();
            var mins = Math.round((open.e - open.s) / 60000);
            log("休息结束：约 " + mins + " 分钟");
            return { ok: true, text: "好，休息了约 " + mins + " 分钟，接着跑注意别硬撑～" };
        }
        if (startRe.test(s)) {
            if (open) return { ok: true, text: "已经在记着（已 " + Math.round((Date.now() - open.s) / 60000) + " 分钟）——如果你是想补记之前某次歇多久，说「午饭歇了1小时」这种我就直接记进去" };
            MEM.rest.push({ s: Date.now(), e: null, auto: false });
            if (MEM.rest.length > 800) MEM.rest.shift();
            saveMem();
            log("休息开始（手动）");
            return { ok: true, text: "好，先歇着，我给你记着时间；起来跟我说「起了」就行" };
        }
        return false;
    } catch (e) { log("休息解析异常：" + e); return false; }
}
function careRestToday() {
    ensureWorkMem();
    var dk = careDayKeyOf(Date.now()), total = 0, n = 0, lastEnd = 0, open = null;
    for (var i = 0; i < MEM.rest.length; i++) {
        var r = MEM.rest[i];
        if (!r) continue;
        var end = r.e || Date.now();
        if (careDayKeyOf(r.s) !== dk) continue;
        total += Math.max(0, end - r.s);
        n++;
        if (r.e && r.e > lastEnd) lastEnd = r.e;
        if (!r.e) open = r;
    }
    return { mins: Math.round(total / 60000), n: n, lastEnd: lastEnd, open: open };
}
// ===== v2.3.12（2026-10-19 用户「把停车逻辑接到原来那套上，原来的逻辑要保留」）=====
// 【原来的逻辑】主人说「我休息了/歇会儿」→ rest_start 开一条休息（auto:false），一直计时到他起身
//   （说「起了/开工了」或屏幕亮很久）。这条是**主路**，不能被自动判断抢掉。
// 【新加的停车】车停稳 ≥30 分钟 → 也开一条休息，但标 auto:true + src:"parked"，开走了自动结束。
//   两者共用同一份 MEM.rest、同一套开关函数，所以：
//   · 手动那条永远不会被自动逻辑关掉（只有 auto 的才自动结束）；
//   · 自动那条开着的时侯，主人说「我休息了」＝把它升级成手动（保留起点，不会再多开一条）。
function careRestOpen() {
    try {
        for (var i = MEM.rest.length - 1; i >= 0; i--) { if (MEM.rest[i] && !MEM.rest[i].e) return MEM.rest[i]; }
    } catch (e) {}
    return null;
}
function careRestStart(src, backMs) {
    var open = careRestOpen();
    if (open) {
        if (src === "manual" && open.auto) {          // 自动那条被主人接管：保留起点，改成手动
            open.auto = false; open.src = "manual"; open.by = "manual";
            saveMem();
            return { ok: true, upgraded: true, open: open };
        }
        return { ok: false, why: "already", open: open };
    }
    var s0 = Date.now() - Math.max(0, Number(backMs) || 0);
    var e = { s: s0, e: null, auto: src !== "manual", src: src || "manual" };
    MEM.rest.push(e); saveMem();
    return { ok: true, open: e };
}
function careRestStop(src) {
    var open = careRestOpen();
    if (!open) return { ok: false, why: "none" };
    if (src !== "manual" && !open.auto) return { ok: false, why: "manual" };   // 手动那条只有主人能停
    open.e = Date.now(); saveMem();
    return { ok: true, mins: Math.round((open.e - open.s) / 60000), open: open };
}
// —— 连续在岗（v0.6.1 修正：不是「今日亮屏累计」，而是「上次休息结束/开工 到现在」）——
function careDuty() {
    try {
        ensureWorkMem();
        var now = Date.now();
        var rest = careRestToday();
        var lastEnd = rest.lastEnd || 0;
        var base = MEM.work.dutyStart || 0;
        if (base && careDayKeyOf(base) !== careDayKeyOf(now)) base = 0;   // 隔夜作废
        if (lastEnd > base) base = lastEnd;                              // 上回歇完 = 新起点
        if (!base) base = now;
        if (rest.open) { MEM.work.dutyStart = now; return { mins: 0, since: now, resting: true }; }
        // 【2026-10-19 用户「车一直停着，为啥还说我在跑车」实锤】05:14 启动就播报「连着跑 5.2 小时了」，
        // 而他整晚都停在车位上。根因：连跑时长只看 dutyStart 和「有记录的休息」，停着没记休息就等于一直在跑。
        // 改：轨迹显示已停稳 ≥20 分钟 → 直接算「在歇」，连跑清零（不依赖有没有休息记录）。
        var parkedMin2 = 0;
        try { parkedMin2 = trkParkedMin(); } catch (ePM2) { parkedMin2 = 0; }
        if (parkedMin2 >= 20) { MEM.work.dutyStart = now; return { mins: 0, since: now, resting: true, parkedMin: parkedMin2 }; }
        // 备用判据（App 重装/重启会让轨迹断一小段，停稳时长得从头数，这中间不该继续报「连着跑 5 小时」）：
        // 定位节拍已经判出「没在动」、且最后一个点 15 分钟内 —— 同样算在歇。
        try {
            if (!MEM.work.moving && MEM.work.lastLoc && (now - MEM.work.lastLoc.t) < 15 * 60000) {
                MEM.work.dutyStart = now;
                return { mins: 0, since: now, resting: true, parkedMin: parkedMin2 };
            }
        } catch (eMV) {}
        var mins = Math.round((now - base) / 60000);
        if (mins > 8 * 60) { base = now - 60 * 60000; mins = 60; }        // 中间断档（App 被杀/隔夜）就按 1 小时起算，别虚报
        MEM.work.dutyStart = base;
        return { mins: mins, since: base, resting: false };
    } catch (e) { return { mins: 0, since: Date.now(), resting: false }; }
}
// 休息多久合适：按连跑时长 + 时段给建议（不是死板 15 分钟）
function careRestAdvice(dutyMin, energy) {
    try {
        var hh = new Date().getHours();
        var mins = 15, why = [];
        if (dutyMin >= 300) { mins = 30; why.push("连跑超过 5 小时"); }
        else if (dutyMin >= 180) { mins = 20; why.push("连跑超过 3 小时"); }
        else { why.push("连跑 " + Math.round(dutyMin / 60 * 10) / 10 + " 小时"); }
        if (hh >= 23 || hh <= 5) { mins += 10; why.push("这个点身体在还睡眠债"); }
        if (energy && energy.score <= 40) { mins += 5; why.push("精力只有 " + energy.score + " 分"); }
        mins = Math.min(45, mins);
        return { mins: mins, why: why.join("；") };
    } catch (e) { return { mins: 15, why: "" }; }
}
// —— 精力评分（0-100 粗估）：休息总量 / 连续在岗 / 夜间在线 / 饮食规律 / 身体指标 / 元素短板 ——
function careEnergy() {
    try {
        ensureWorkMem();
        var now = Date.now();
        var rest = careRestToday();
        var duty = careDuty();
        var score = 72, reasons = [];
        var onDutyMin = duty.mins;
        // ① 休息够不够（按连续在岗和已休总量综合看）
        if (rest.mins >= 60) { score += 8; reasons.push("今天已休 " + rest.mins + " 分钟"); }
        else if (rest.mins >= 25) { reasons.push("今天休了 " + rest.mins + " 分钟，偏少"); }
        else if (onDutyMin >= 240) { score -= 14; reasons.push("几乎没歇（今日休息 " + rest.mins + " 分钟）"); }
        // ② 连续在岗（这次是真·连续，上限 8 小时内）
        if (onDutyMin >= 300) { score -= 22; reasons.push("已经连跑 " + Math.round(onDutyMin / 60 * 10) / 10 + " 小时没歇"); }
        else if (onDutyMin >= 180) { score -= 14; reasons.push("连跑 " + Math.round(onDutyMin / 60 * 10) / 10 + " 小时，该歇了"); }
        else if (onDutyMin >= 120) { score -= 7; reasons.push("连跑 " + Math.round(onDutyMin / 60 * 10) / 10 + " 小时"); }
        // ③ 时段
        var hh = new Date(now).getHours();
        if (hh >= 0 && hh <= 5) { score -= 18; reasons.push("这个点还在跑，熬夜很伤"); }
        else if (hh >= 22) { score -= 8; reasons.push("快凌晨了，早点收"); }
        // ④ 吃的规律（2026-10-22 ㉗：顿数按餐次去重，不再按记录条数）
        var dd = (MEM.health && MEM.health.diet) || [], ddToday = [];
        for (var i = 0; i < dd.length; i++) if (dd[i] && careDayKeyOf(dd[i].t) === careDayKeyOf(now)) ddToday.push(dd[i]);
        var meals = careMealSlotCount(ddToday);
        if (meals === 0 && hh >= 13) { score -= 8; reasons.push("今天还没记吃的"); }
        else if (meals >= 2) { score += 4; reasons.push("今天记了 " + meals + " 顿"); }
        // ⑤ 身体指标（最近一次血压/心率异常要扣分并点出来）
        try {
            var ms = (MEM.health && MEM.health.metrics) || [], last = {};
            for (var m = 0; m < ms.length; m++) { if (ms[m] && ms[m].k) last[ms[m].k] = ms[m]; }
            if (last["血压"]) {
                var bp = String(last["血压"].v || "");
                var mm2 = /(\d{2,3})\s*\/\s*(\d{2,3})/.exec(bp);
                if (mm2) {
                    var sys = parseInt(mm2[1], 10), dia = parseInt(mm2[2], 10);
                    if (sys >= 140 || dia >= 90) { score -= 12; reasons.push("血压 " + bp + " 偏高，别再硬撑"); }
                    else if (sys >= 130 || dia >= 85) { score -= 6; reasons.push("血压 " + bp + " 有点高"); }
                }
            }
            if (last["心率"]) {
                var hr = parseFloat(last["心率"].v);
                if (hr >= 95) { score -= 6; reasons.push("心率 " + hr + " 偏快"); }
            }
            if (last["体温"]) {
                var tp = parseFloat(last["体温"].v);
                if (tp >= 37.3) { score -= 10; reasons.push("体温 " + tp + "℃，别跑车了"); }
            }
        } catch (eM3) {}
        // ⑥ 饮食元素短板（今天估出来一半以上项都偏少 → 说明吃得单调，长期耗人）
        try {
            var ea = careElemAvg(3);
            if (ea && ea.n > 0 && ea.items && ea.items.length) {
                var lowN = 0;
                for (var q = 0; q < ea.items.length; q++) if (ea.items[q].low) lowN++;
                if (lowN >= Math.max(3, Math.floor(ea.items.length * 0.6))) { score -= 5; reasons.push("最近吃得偏单调（" + lowN + " 项元素偏少）"); }
            }
        } catch (eEl2) {}
        if (rest.open) { score -= 4; reasons.push("正歇着（计时中）"); }
        score = Math.max(5, Math.min(100, score));
        var level = score >= 75 ? "还不错" : (score >= 55 ? "有点累" : (score >= 35 ? "明显疲劳" : "该收了"));
        var adv = careRestAdvice(onDutyMin, { score: score });
        return { score: score, level: level, reasons: reasons, restMins: rest.mins, onDutyMin: onDutyMin, meals: meals, dutyMin: onDutyMin, advice: adv };
    } catch (e) { return { score: 60, level: "算不出来", reasons: [String(e)], restMins: 0, onDutyMin: 0, meals: 0, dutyMin: 0, advice: { mins: 15, why: "" } }; }
}
function careEnergyText() {
    var e = careEnergy();
    var adv = e.advice || careRestAdvice(e.onDutyMin || 0, e);
    return "⚡ 精力约 " + e.score + "/100（" + e.level + "，粗估）" +
        (e.reasons.length ? "：" + e.reasons.join("；") : "") +
        "。连续在岗约 " + Math.round((e.onDutyMin || 0) / 60 * 10) / 10 + " 小时、今日已休 " + e.restMins + " 分钟" +
        "；建议" + (e.score >= 75 ? "再跑 1-2 小时就歇 " : "现在就靠边歇 ") + adv.mins + " 分钟" + (adv.why ? "（" + adv.why + "）" : "") +
        (careRestToday().open ? "，正在歇着" : "");
}
// —— 自动粗判休息 + 疲劳提醒（由 60 秒节拍调用）——
var FATIGUE = { lastRemind: 0, lastRestEnd: 0 };
// 停稳多少分钟（来自今天的轨迹点：从最后一个点往前推，直到出现一次 ≥100 米的位移）
// 用途：车停着不动就是在休息，不该等熄屏才算（用户 2026-10-19「车一直停着却说我在跑车没休息」）。
function trkParkedMin() {
    try {
        var pts = trkReadDay(trkDayKey(Date.now()));
        if (!pts || pts.length < 2) return 0;
        var last = pts[pts.length - 1], s0 = last.t, i;
        // 最后一个点太旧（>15 分钟没新点）说明采集断了（被系统杀/没定位），此时「停稳」无从判断，
        // 直接返回 0——宁可不算休息，也别拿一小时前的点说「你现在停着」。
        if (Date.now() - last.t > 15 * 60000) return 0;
        // 【2026-10-19 第二版】旧算法按「相邻两点位移」往前推，App 重装/重启那一下 GPS 会跳 200–300 米，
        // 于是「停稳」永远从重启那刻重新数（实测 05:13 起才 3 分钟，可他其实整夜都停着）。
        // 改成按「离当前位置有多远」往前推：只要还在同一个 300 米圈里就算一直停着；
        // 精度极差（acc>100）的点直接跳过，不让它切断判断。回溯最多 6 小时（别把早上出门前也算进来）。
        var MAX_BACK = 6 * 3600000;
        for (i = pts.length - 1; i >= 0; i--) {
            if (last.t - pts[i].t > MAX_BACK) break;
            var accp = (typeof pts[i].acc === 'number') ? pts[i].acc : 0;
            if (accp > 200) continue;     // 精度 200 米以上的点等于没定位，跳过（实测地下车库有 acc=416 的点）
            if (trkDistM(pts[i].lat, pts[i].lon, last.lat, last.lon) > 500) break;   // 停在一个停车场里，GPS 会在两个点之间跳 300+ 米
            s0 = pts[i].t;
        }
        return Math.round((Date.now() - s0) / 60000);
    } catch (e) { return 0; }
}
function careFatigueTick() {
    try {
        ensureWorkMem();
        var now = Date.now();
        var open = null;
        for (var i = MEM.rest.length - 1; i >= 0; i--) { if (MEM.rest[i] && !MEM.rest[i].e) { open = MEM.rest[i]; break; } }
        // 【2026-10-19 实机】有一条 10-18 00:00 开始、一直没结束的休息（那天手机没再醒过），
        // 它把「当前是否在休息」永远钉成真，新的休息也开不出来。超过 12 小时的未结束休息一律按 12 小时封顶收掉，
        // 并打标记 fix:"stale"（不删数据、不假装准，日志里能查到被截断过）。
        if (open && (now - open.s) > 12 * 3600000) {
            open.e = open.s + 12 * 3600000; open.fix = "stale"; open = null; saveMem();
            log("自动记：清理超时未结束的休息（>12 小时，按 12 小时封顶）");
        }
        var screenOn = true;
        try { screenOn = !!device.isScreenOn(); } catch (eS) { screenOn = true; }
        // 【2026-10-19 用户「车一直停着还说我在跑车、没休息」】新增「停稳＝在歇」：车停着 ≥30 分钟，
        // 不管屏幕亮不亮都算在车上休息（他休息时就是刷手机，旧版只认熄屏，于是今天永远是 0 分钟）。
        // 走开/开走（停稳时长回落到 10 分钟以内）就结束这条休息。
        var parkedMin = 0;
        try { parkedMin = trkParkedMin(); } catch (ePM) { parkedMin = 0; }
        if (parkedMin >= 30) {
            // 跟手动那条共用同一套开关：手动开着就不动它；没有才开一条 auto+parked（起点回溯到真正停稳那一刻）
            var rp = careRestStart("parked", parkedMin * 60000);
            if (rp.ok) log("自动记：车停着约 " + parkedMin + " 分钟 → 记为车上休息（屏幕亮着也算）");
            return;   // 停着就别再走「熄屏/亮屏」那套判断
        }
        if (parkedMin < 10 && open && open.auto && open.src === "parked") {
            var rstop = careRestStop("parked");
            if (rstop.ok) { FATIGUE.lastRestEnd = now; log("自动记：开走了 → 车上休息结束（约 " + rstop.mins + " 分钟）"); }
            open = null;
        }
        // 熄屏 ≥6 分钟 → 自动记一条「疑似休息」；亮屏 ≥10 分钟 → 结束（同样走共用开关，手动那条不碰）
        if (!screenOn) {
            if (!open) { var rsScr = careRestStart("screen", 0); if (rsScr.ok) log("自动记：熄屏开始（疑似休息）"); }
        } else if (open && open.auto) {
            var mins = (now - open.s) / 60000;
            // 【2026-10-19 ccode·车上休息被「瞄一眼手机」切断】用户每天的模式是：跑车→就近充电→
            // 就近找停车位→在车上休息（这几个小时里手机是亮着的）。旧阈值「亮屏累计 ≥2 分钟就结束休息」
            // 会把他拿手机看一眼当成「起身了」，一晚上能被切十几次、休息时长记不出来。
            // 改成 ≥10 分钟才算真起身（短时间解锁/看消息不算），熄屏再满 6 分钟会重新开始计。
            // 2026-10-21 ccode 回滚：『亮屏即刻结束』是 App 自问自答加的规则（主人没说过），会把车上刷手机的休息全记成 0 分钟。
            if (mins >= 10) {
                var rsEnd = careRestStop("screen");
                if (rsEnd.ok) { FATIGUE.lastRestEnd = now; log("自动记：休息结束约 " + rsEnd.mins + " 分钟"); }
            }
        }
        // 连续在岗 ≥2 小时 → 提醒；之后每多跑 1 小时再提醒一次（v0.6.1：改用真·连续时长，不再用今日亮屏累计）
        var duty = careDuty();
        var onDutyMin = duty.mins;
        if (!duty.resting && onDutyMin >= 120) {
            var step = Math.floor(onDutyMin / 60);                 // 已连跑几小时
            if (FATIGUE.lastStep !== step && now - (FATIGUE.lastRemind || 0) > 40 * 60000) {
                FATIGUE.lastStep = step;
                FATIGUE.lastRemind = now;
                var en = careEnergy();
                var adv = careRestAdvice(onDutyMin, en);
                var msg = "已经连着跑 " + (Math.round(onDutyMin / 6) / 10) + " 小时了，靠边歇 " + adv.mins + " 分钟吧" +
                    (en.score <= 45 ? "（精力只剩 " + en.score + " 分）" : "") + "——腰、眼睛和反应速度都要缓一缓";
                try { presentSay(curChar(), msg, "歇 " + adv.mins + " 分钟吧，别硬撑", "concern", ST.soundOn && !CARECORE.inDnd(QCFG, nowMinOf(Date.now()))); } catch (eR) {}
                log("疲劳提醒：" + msg);
            }
        }
        if (duty.resting || careRestToday().mins >= 10) FATIGUE.lastStep = 0;   // 歇够了重新计
    } catch (e) { try { log("疲劳节拍异常：" + e); } catch (e2) {} }
}
// ===== v1.5.11：悬浮路况图（用户点单：接单前弹全市路况，挑不堵的地方接）=====
// 【为什么这么做】路况色（红堵/黄缓/绿通）是高德地图自带的 TileLayer.Traffic 图层给的，
//   本 App 不做任何「算路况」的判断，只负责三件事：把地图拉起来、把路况图层打开、按需标目的地。
// 【key 放哪】`脚本/关心_地图配置.json` 的 jsKey/jsSec（不进 APK、不进公开仓）；没配就明确告诉用户去配。
// 【注意】①WebView 的 WebSettings 与 loadUrl 必须在主线程（同 3D 小人的坑，JavaBridge 线程调用会抛
//   "A WebView method was called on thread 'JavaBridge'"）；②关窗即销毁，别让地图在悬浮窗里常驻吃内存；
//   ③页面来源是 file://（打包进 assets），高德若开了域名白名单会被拦——白名单要留空。
// 【失败表现】没 key＝直接回一句提示不建窗；key 错/网络不通＝页面里红字「地图脚本没加载出来」。
var NAVSAY_LAST = { text: "", at: 0 };   // 导航播报去重用（同句 3 秒内只播一次）
var MAPCFG_P = BASE + "/关心_地图配置.json";
var MAPDIR = BASE + "/关心_地图";
var MAP_ON = false, MAPW = null, MAPWEB = null, MAP_READY = false, MAP_LOADED_AT = 0;

function careMapCfg() {
    try {
        var o = JSON.parse(String(files.read(MAPCFG_P) || "{}"));
        // v1.7.0：多读一个 restKey（高德「Web服务」Key）——有它才算得出红绿灯个数（JS API 不给这个字段），
        //   没有就传空串，页面会如实显示「—」而不是编一个数字。
        return { key: String(o.jsKey || ""), sec: String(o.jsSec || ""), restKey: String(o.restKey || "") };
    } catch (e) { return { key: "", sec: "", restKey: "" }; }
}
// v1.5.14（2026-10-18 用户当场报「怎么是北京不是我当前位置」）：只会读 lastKnownLocation，没开过定位的手机上永远是 null
//   → 页面拿到 0,0 不设中心 → 高德默认落北京。
// 【修法】fresh=true 时主动向系统要一次当前点（网络/卫星各发一次单次请求，最多等 2.5 秒），拿到就用；
//   拿不到**如实说没拿到**（回 ok:false + why），让界面提示「开定位权限/去空旷处再点 📍」，绝不假装有用。
// 【注意】必须有 ACCESS_FINE_LOCATION 才能收到；没授权时直接跳过请求，避免白等 2.5 秒。
// 【失败表现】日志写「取当前位置失败：…」，页面上仍显示上一次的中心（或默认视野）。
// 【2026-10-19 用户实测·「你自己的地图搜附近厕所和充电站为啥搜不到」】
//   实锤 15:48 / 15:51 两轮：模型把这句话当成「在代码里搜『厕所』这个词」，调 search 去 main.js 里找，
//   当然找不到——**App 本来就没有「搜附近地点」这个动作**，它只能拿手边最像的工具凑。
//   补上真动作：高德 Web 服务 /v3/place/around；`coordsys=gps` 让高德自己把 WGS84 转 GCJ-02
//   （本机 GPS 是 WGS84，直接喂高德会偏 500 米，用户 10-18 已当面报过一次）。
//   失败一律如实说原因（没配 Key / 没定位 / 接口报错），绝不编地点。
function httpGetText(url, tConnMs, tReadMs) {
    try {
        var conn = new java.net.URL(url).openConnection();
        conn.setRequestMethod("GET");
        conn.setConnectTimeout(tConnMs || 8000);
        conn.setReadTimeout(tReadMs || 15000);
        var code = conn.getResponseCode();
        var is = (code >= 200 && code < 400) ? conn.getInputStream() : conn.getErrorStream();
        var txt = "";
        if (is) {
            var br = new java.io.BufferedReader(new java.io.InputStreamReader(is, "UTF-8"));
            var ln = null, sb = "";
            while ((ln = br.readLine()) !== null) sb += ln;
            br.close(); txt = sb;
        }
        return { ok: code >= 200 && code < 400, code: code, text: txt };
    } catch (e) { return { ok: false, code: -1, text: "", msg: String(e) }; }
}
function careMapSearch(keywords, radius, type) {
    try {
        var kw = String(keywords || "").trim();
        var tp = String(type || "").trim().toLowerCase();
        // 2026-10-22（主人「不要停车场只要道路停车位」）：这两类走固定关键词 + 结果过滤，
        //   判据和地图页 🅿（navPoiRoadParking）完全一样，免得 AI 搜出来一堆地下停车场。
        if (tp === "road_parking") kw = "道路停车位";
        else if (tp === "charging") kw = kw || "充电站";
        // 2026-10-23 主人点单（地图第一排加厕所/包子按钮）：AI 这边也必须能搜同一批东西，
        //   否则主人说「导航去最近的厕所」时它只能拿「厕所」当普通关键词碰运气。
        //   关键词与页面 🚻/🥟 两个按钮完全一致：公共厕所（避开「厕所用品店」）/ 包子。
        else if (tp === "toilet") kw = "公共厕所";
        else if (tp === "baozi") kw = kw || "包子";
        if (!kw) return "要搜什么？说个类型（厕所/充电站/加油站/饭店/停车位）或者地名";
        var cfg = careMapCfg();
        if (!cfg.restKey) return "还没配高德 Web 服务 Key（脚本/关心_地图配置.json 的 restKey），配好我就能搜附近";
        var loc = careMapLoc(true);
        if (!loc || !loc.ok || !loc.lat) return "没拿到你的位置（" + ((loc && loc.why) || "定位没开") + "），搜不了附近";
        var r = parseInt(radius, 10); if (!(r > 0)) r = 3000;
        actBusy("搜附近", "我搜一下附近的「" + kw + "」");
        var url = "https://restapi.amap.com/v3/place/around?key=" + encodeURIComponent(cfg.restKey) +
            "&location=" + encodeURIComponent(Number(loc.lon).toFixed(6) + "," + Number(loc.lat).toFixed(6)) +
            "&coordsys=gps&keywords=" + encodeURIComponent(kw) + "&radius=" + r +
            "&offset=15&page=1&extensions=base&sortrule=distance";
        var rr = httpGetText(url, 8000, 15000);
        if (!rr.ok) {
            var m0 = "搜附近失败：" + String(rr.msg || ("HTTP " + rr.code)).slice(0, 100);
            log(m0 + "｜" + String(rr.text || "").slice(0, 120));
            actLog("搜附近", m0);
            return m0;
        }
        var j = null; try { j = JSON.parse(rr.text); } catch (eJ) { return "搜附近的返回看不懂：" + String(rr.text || "").slice(0, 80); }
        if (String(j.status) !== "1") {
            var why = "高德拒绝了这次搜索（info=" + String(j.info || "?") + " infocode=" + String(j.infocode || "?") + "）";
            log(why);
            actLog("搜附近", why);
            return why;
        }
        var pois = j.pois || [], out = [];
        for (var i = 0; i < pois.length; i++) {
            var p = pois[i] || {};
            var nm = String(p.name || "").trim();
            if (!nm) continue;
            if (tp === "road_parking") {
                var _ty = String(p.type || "");
                if (/公共停车场|地下停车场|停车楼/.test(_ty)) continue;              // 停车场一律不要
                if (!/路边停车场/.test(_ty) && !/道路停车位|路边停车|路侧停车|停车泊位/.test(nm)) continue;
            }
            var dis = parseInt(p.distance, 10);
            var ad = String(p.address || "").trim();
            // 2026-10-22：把坐标一并给模型——它挑中哪家，就用 nav_to 的 lat/lon 原样带回来直达
            var _lc = String(p.location || "").split(",");
            var _co = (_lc.length === 2 && isFinite(Number(_lc[0])) && isFinite(Number(_lc[1]))) ? ("〔" + Number(_lc[1]).toFixed(6) + "," + Number(_lc[0]).toFixed(6) + "〕") : "";
            out.push("· " + nm + (dis > 0 ? "，" + (dis >= 1000 ? (dis / 1000).toFixed(1) + " 公里" : dis + " 米") : "") + (ad && typeof ad === "string" ? "（" + ad + "）" : "") + (_co ? " 坐标" + _co : ""));
        }
        if (!out.length) {
            var none = "附近 " + r + " 米内没搜到「" + kw + "」";
            actLog("搜附近", none);
            return none;
        }
        var head = "附近 " + (r >= 1000 ? (r / 1000) + " 公里" : r + " 米") + "内的「" + kw + "」" +
            (tp === "road_parking" ? "（只列路边道路停车位，公共/地下停车场已排除）" : "") +
            (String(j.count || "") ? "（共 " + j.count + " 个，这是最近的 " + out.length + " 个）" : "") + "：";
        var txtAll = head + "\n" + out.join("\n");
        log("搜附近：" + kw + " → " + out.length + " 个");
        actLog("搜附近", "搜到 " + out.length + " 个「" + kw + "」，最近的在 " + (out[0] || "").slice(2, 30));
        return txtAll;
    } catch (e) { return "搜附近失败：" + e; }
}
function careMapLoc(fresh) {
    var lm = null;
    try { lm = context.getSystemService(context.LOCATION_SERVICE); } catch (e0) { return { lat: 0, lon: 0, ok: false, why: "没有定位服务" }; }
    var loc = null;
    try { loc = lm.getLastKnownLocation("gps") || lm.getLastKnownLocation("network") || lm.getLastKnownLocation("passive"); } catch (e1) {}
    if (!loc && fresh) {
        if (!careLocPermOk()) return { lat: 0, lon: 0, ok: false, why: "没授权定位" };
        var got = null;
        try {
            var L = new android.location.LocationListener({
                onLocationChanged: function (l) { got = l; },
                onStatusChanged: function () {},
                onProviderEnabled: function () {},
                onProviderDisabled: function () {}
            });
            var provs = ["network", "gps"];
            for (var i = 0; i < provs.length; i++) { try { lm.requestSingleUpdate(provs[i], L, context.getMainLooper()); } catch (eR) {} }
            for (var t = 0; t < 25; t++) { if (got) break; sleep(100); }
            try { lm.removeUpdates(L); } catch (eRm) {}
        } catch (eQ) { log("定位申请异常：" + eQ); }
        loc = got;
    }
    if (loc) {
        try {
            // v1.8.5：把精度和速度一起带出去（速度用户点名要显示；精度用来决定箭头飘不飘）
            var acc0 = 9999, spd0 = -1;
            try { if (typeof loc.hasAccuracy === "function" ? loc.hasAccuracy() : true) acc0 = loc.getAccuracy(); } catch (eA1) {}
            try { if (typeof loc.hasSpeed === "function" && loc.hasSpeed()) spd0 = loc.getSpeed(); } catch (eS1) {}
            return { lat: loc.getLatitude(), lon: loc.getLongitude(), acc: Math.round(acc0), spd: (spd0 >= 0 ? Math.round(spd0 * 3.6) : -1), ok: true };
        } catch (e2) {}
    }
    return { lat: 0, lon: 0, ok: false, why: "系统还没定位到（要去空旷处或打开 GPS）" };
}
function careMapClose() {
    try { if (MAPW) MAPW.close(); } catch (e) {}
    MAPW = null; MAPWEB = null; MAP_ON = false;
    // 2026-10-22：就绪标记必须跟着窗一起清——否则第二次开窗时 MAP_READY 还是上一轮的 true，
    //   careNavTo 等就绪的循环当场通过 → 又变回「页面还没加载就注入」，目的地再丢一次。
    MAP_READY = false;
    MAP_FULL = false;
    // v1.8.0：窗口关了必须停罗盘（否则传感器一直跑，耗电且日志会一直推）
    try { navSenseStop(); } catch (eS) {}
    try { navLocStop(); } catch (eL) {}
    // v1.8.9：关窗时一并撤掉「导航常亮」，不然屏幕会一直亮到 30 分钟超时
    try { device.cancelKeepingAwake(); } catch (eK) {}    return { ok: true, on: false };
}
// 【2026-10-19】红绿灯等待的数据状态 → 写成 关心_地图/lightstat.json 给导航页读（替代走不通的桥）。
//   内容诚实：per=每灯等待秒数（现在是固定 20 的粗估）、places=识别到的路口数、ready=够样本的路口数、
//   need=每个路口要几次样本才能估周期。页面会把它显示在卡片后面，并写明「还差几次」。
function careLightStatDump() {
    try {
        var t = "";
        try { t = String(readText("/storage/emulated/0/脚本/路口节律_报告.md") || ""); } catch (eR) {}
        var places = 0, ready = 0;
        var m1 = t.match(/聚类成 (\d+) 个地点/); if (m1) places = parseInt(m1[1], 10);
        var m2 = t.match(/够做周期估计）的地点：\*\*(\d+)\*\*/); if (m2) ready = parseInt(m2[1], 10);
        javaWriteJSON(MAPDIR + "/lightstat.json", JSON.stringify({ ok: true, per: 20, places: places, ready: ready, need: 4, at: Date.now() }));
        log("lightstat.json 已写：路口 " + places + " 个 / 够样本 " + ready + " 个");
    } catch (e) { log("写 lightstat.json 失败：" + e); }
}
function careMapOpen(dest) {
    var d = String(dest || "").trim();
    // 【2026-10-19 18:5x】把「红绿灯等待的数据状态」落成同目录 JSON 给页面读：
    //   为什么不用桥——实测 `$autojs.invoke` 在打包 App 的浮窗 WebView 里返回的是 `[object Promise]`，
    //   而 .then 回调不触发（三种写法都试过），页面拿不到数据。file:// 读同目录文件没这个坑。
    try { careLightStatDump(); } catch (eLS) {}
    if (MAP_ON && MAPW) {
        // 已经开着：不建第二个窗，只把目的地/视野更新一下
        // 【2026-10-19 18:3x 用户「重开还是没有」·实锤】窗口复用时**不会重新加载页面**，
        //   于是 ccode 改了 脚本/关心_地图/路况.html 之后，重用旧窗看到的还是旧页面（日志里 lightStat 一直是旧格式）。
        //   修法：复用前比一次文件 mtime，比上次加载新就带时间戳强制 reload（改页面立刻生效，不用重装）。
        try {
            var _mf = new java.io.File(MAPDIR + "/路况.html");
            if (_mf.exists() && _mf.lastModified() > (MAP_LOADED_AT || 0)) {
                MAP_LOADED_AT = _mf.lastModified();
                var _u = "file://" + MAPDIR + "/路况.html?v=" + Date.now();
                log("路况页已更新 → 重新加载：" + _u.split("?")[1]);
                onMain(function () { try { MAPWEB.loadUrl(_u); } catch (eRL) { log("路况页 reload 失败：" + eRL); } });
            }
        } catch (eMf) {}
        try { if (d) { onMain(function () { try { MAPWEB.loadUrl("javascript:setDest(" + JSON.stringify(d) + ")"); } catch (e) {} }); } } catch (eRe) {}
        return { ok: true, on: true, reused: true };
    }
    var cfg = careMapCfg();
    if (!cfg.key) {
        return { ok: false, msg: "还没配高德 Key（脚本/关心_地图配置.json 的 jsKey、jsSec），配好我就能弹路况" };
    }
    var w = null;
    // 页面从哪加载：优先用设备上的副本（file://，能随时改不用重装）；不在就回落到包内 assets
    // 背景：2026-10-18 15:45 首次实测，用相对 url="路况.html" 的浮窗 **一直没就绪**（没有任何页面日志）
    // ——包装 App 的浮窗 webview 不会自动把相对路径解析到 assets，必须给绝对路径。
    var mapPageUrl = "路况.html";
    try { if (files.exists(MAPDIR + "/路况.html")) mapPageUrl = "file://" + MAPDIR + "/路况.html"; } catch (eP) {}
    try {
        w = floaty.window(
            <frame id="root" w="340" h="440" bg="#0d1117">
                <vertical>
                    <!-- 2026-10-23 主人点单（第三轮）：「把关闭按钮放到最上面能拖动地图界面那里的最最右上角」——
                         ✕ 回到窗口标题条最右，且这次必须真能看到。
                         【真因（四轮查实）】旧写法 ttl 用 w="*"，而 AutoJs 的 styx 里 * 就是 MATCH_PARENT：
                           同一行里固定宽的 ✕ 会被**挤出可视区**——代码里有、绑定日志写「成功」、屏幕上就是没有。
                           实证：页面日志 关心_调试.log「路况窗：收到关闭（按钮）」出现 **0 次**（底部那排 4 个
                           w="*" 按钮也一样挤没了，主人只能靠长按标题条关窗）。
                         【改法】不再靠 * 推开：ttl 用**固定宽 286dp**，✕ 固定 44dp（286+44=330 ≤ 窗口 340dp），
                           两颗都不会溢出，✕ 就落在标题条最右。
                         【注意】①窗口宽度变了（全屏 1236px≈380dp）时，✕ 会停在右边缘 50dp 处，仍是可视的；
                           ②以后往这条标题条里加东西，别再给任何子控件写 w="*"（会挤掉后面的固定宽兄弟）。 -->
                    <horizontal id="bar" h="40" bg="#1b222c" clickable="true">
                        <text id="ttl" text="🧭 路况 · 拖我移动窗口" w="286" h="*" textSize="12sp" textColor="#9fb0c6" gravity="center_vertical" paddingLeft="10"/>
                        <button id="xclose" text="✕" w="44" h="40" textSize="17sp" bg="#b42828" textColor="#ffffff"/>
                    </horizontal>
                    <!-- v1.8.3：这行以前是死高度 h="354"，所以「全屏」只放大了窗口、地图还是 354dp 高，
                         下面一大片空框（用户 20:4x 实拍）。给个 id，全屏时把它改成"占满剩余高度"。 -->
                    <horizontal id="maprow" w="*" h="354">
                        <vertical id="gripL" w="16" h="*" bg="#2b3646" clickable="true"/>
                        <webview id="web" w="*" h="*"/>
                        <vertical id="gripR" w="16" h="*" bg="#2b3646" clickable="true"/>
                    </horizontal>
                    <!-- 2026-10-23：底部这排 4 个按钮旧写法全是 w="*" → 全被挤出可视区（实测日志里
                         「路况窗：收到关闭（按钮）」0 次，主人一直靠长按标题条关窗）。改固定宽 84×4=336 ≤ 340。
                         【教训】AutoJs 浮窗 XML 里 w="*" = MATCH_PARENT，同一行放多个等于都没了；只给最后一个可撑满的除外。 -->
                    <horizontal h="46" bg="#1b222c">
                        <button id="zin" text="＋" w="84" h="42" textSize="18sp" bg="#232a36" textColor="#ffffff"/>
                        <button id="zout" text="－" w="84" h="42" textSize="18sp" bg="#232a36" textColor="#ffffff"/>
                        <button id="my" text="📍我" w="84" h="42" textSize="14sp" bg="#1f6feb" textColor="#ffffff"/>
                        <button id="cls" text="关闭" w="84" h="42" textSize="14sp" bg="#b42828" textColor="#ffffff"/>
                    </horizontal>
                </vertical>
            </frame>
        );
    } catch (eW) { return { ok: false, msg: "悬浮窗建不起来：" + eW }; }
    try { if (typeof w.setAdjustEnabled === "function") w.setAdjustEnabled(false); } catch (eA) {}
    try { w.web.setBackgroundColor(0); } catch (eBG) {}
    // WebSettings 必须在主线程设（同 3D 小人；JavaBridge 线程调会抛 Expected Looper）
    try {
        onMain(function () {
            try {
                var ws = w.web.getSettings();
                ws.setJavaScriptEnabled(true);
                ws.setAllowFileAccess(true);
                ws.setAllowFileAccessFromFileURLs(true);
                ws.setAllowUniversalAccessFromFileURLs(true);
                ws.setDomStorageEnabled(true);
            } catch (eWS) { log("路况 webview 设置异常：" + eWS); }
        });
    } catch (eWS2) { log("路况 webview 设置投递失败：" + eWS2); }
    // v1.5.13（2026-10-18 15:51 真机实测）：XML 里写 url="{{mapPageUrl}}" 会让 floaty.window 直接抛
    //   InternalError: 方法 "floaty.window" 调用失败（浮窗布局里的模板变量解析不了，跟相对路径无关）。
    //   【为什么这样改】改成建窗之后自己 loadUrl 绝对路径：既能用设备上的 脚本/关心_地图/路况.html（改页面不用重装），
    //   也不会再让建窗本身失败。
    //   【注意】必须在 WebSettings（JS/文件访问）设完之后再 loadUrl，否则 file:// 页面里的 $autojs 桥和脚本都进不来。
    //   【失败表现】若 loadUrl 失败会写「路况页 loadUrl 失败」，之后 12 秒未就绪告警仍会打点。
    try { onMain(function () { try { w.web.loadUrl(mapPageUrl); } catch (eLU) { log("路况页 loadUrl 失败：" + eLU); } }); } catch (eLU2) { log("路况页 loadUrl 投递失败：" + eLU2); }
    var sw = 1080, sh = 2400;
    try { sw = device.width; sh = device.height; } catch (e) {}
    // 位置按屏幕比例放（避开 dp/px 换算坑：浮窗 XML 里 330/420 是 dp，这里给的是 px）
    // v1.5.14：位置记在变量里（拖动时改这两个值），因为 WebView 吃手掌，整个窗只有顶部标题条能拖。
    var posX = Math.round(sw * 0.06), posY = Math.round(sh * 0.14);
    try { w.setPosition(posX, posY); } catch (e0) {}
    // v1.5.18：把窗口实际坐标写进日志——ccode 没法截屏，靠这行推算「边缘/标题条该点哪里」，
    //   也方便出问题时确认「窗口到底被摆到了哪里」。
    try { log("路况窗位置 pos=" + posX + "," + posY + " 屏幕=" + sw + "x" + sh + " 密度=" + device.density); } catch (eLp) {}
    try { if (typeof w.setTouchable === "function") w.setTouchable(true); } catch (e1) {}
    MAPW = w; MAPWEB = w.web; MAP_ON = true; MAP_READY = false;   // 每开一次窗，就绪标记从头算
    log("路况页 url=" + mapPageUrl);
    // v1.7.0（2026-10-18 实测发现）：浮窗 webview **是有 jsBridge 的**（探针 _浮窗桥探针.js 实证 w.web.jsBridge.handle 可用），
    //   而旧版一个处理器都没注册 → 页面里的 $autojs.invoke('diag', …) 全部落空，日志里从来没有一行「路况: …」，
    //   于是「路况页 12 秒内没就绪」这种告警也永远查不到原因。现在把桥接上：
    //   diag＝页面状态/报错；navInput＝页面上点「输入目的地」时，用 App 这边的悬浮输入框打字（网页里的 <input> 弹不出键盘，用户已实测）。
    try {
        if (MAPWEB && MAPWEB.jsBridge && MAPWEB.jsBridge.handle) {
            MAPWEB.jsBridge.handle("diag", function (event, msg) {
                try {
                    var mD = String(msg);
                    log("页面→ " + mD.slice(0, 160));
                    if (mD.indexOf("路况") >= 0 && mD.indexOf("就绪") >= 0) MAP_READY = true;
                } catch (e) {}
                return { ok: true };
            });
            MAPWEB.jsBridge.handle("navInput", function () { try { navDestInput(); } catch (e) { log("导航输入框异常：" + e); } return { ok: true }; });
            // 2026-10-23：页面里本来就有 askClose() → $autojs.invoke('closeTraffic') 的兜底，
            //   但**浮窗这一侧**的桥以前没注册过这个 key（只注册在 ui.web 上），调了等于没调。补上，
            //   以后页面要自己放一颗关窗键就不必再改 App。注意：$autojs.invoke 返回的是 Promise，
            //   页面不要等回值（实测 .then 在浮窗 webview 里不触发），当发命令用就行。
            MAPWEB.jsBridge.handle("closeTraffic", function () { try { log("路况窗：收到关闭（页面 closeTraffic）"); careMapClose(); } catch (eCT) {} return { ok: true }; });
            // v1.8.0（用户 20:3x：「导航地图可以点击全屏」）：窗口大小只有 App 能改，页面点 ⛶ 就回调到这里
            MAPWEB.jsBridge.handle("navFull", function () { try { careMapFullToggle(); } catch (e) { log("全屏切换异常：" + e); } return { ok: true }; });
            // 2026-10-23（主人点单）：「导航的语音播报也加上，还是用我关心 app 随时切换的语音」
            //   页面导航播报走这里 → 直接调 speak()：用的就是主人当前选的 TTS 引擎/音色（MultiTTS）。
            //   在面板里换音色后，导航下一句立即是新音色——不用重启、不用重装页面。
            //   【边界】导航播报不听「安静策略/勿扰」（主人自己开了导航就是要听的）；但「声音总开关」关了就不响（speak 自己会拦）。
            // 【2026-10-23 主人「完整读还是读一点就没了」实证】调试日志 10:36:01 同一秒三条 speak、10:36:55 又三条
            //   （页面被 reload 成两份 / navGo 与 navUpdate 各播一次），而 speak 每次 QUEUE_FLUSH 会拦腰截断前一条。
            //   这里两道闸：①同一句 3 秒内不重复播；②排队（QUEUE_ADD）不打断正在念的。
            MAPWEB.jsBridge.handle("navSay", function (event, text) {
                try {
                    var s = String(text || "").trim().slice(0, 120);
                    if (!s) return { ok: true };
                    var now = Date.now();
                    if (s === NAVSAY_LAST.text && now - NAVSAY_LAST.at < 3000) { log("导航播报去重（同句 3 秒内）：" + s.slice(0, 24)); return { ok: true, dup: true }; }
                    NAVSAY_LAST.text = s; NAVSAY_LAST.at = now;
                    log("导航播报：" + s);
                    speak(s, curChar(), true);       // queue=true：不打断正在念的
                } catch (eNS) { log("导航播报失败：" + eNS); }
                return { ok: true };
            });
            // v1.8.9（用户 21:3x：「导航模式里屏幕常亮开启」）：页面进导航时喊一声，App 挂常亮；退出/关窗就撤
            MAPWEB.jsBridge.handle("navKeepOn", function (event, on) {
                try {
                    if (on) { device.keepScreenOn(30 * 60 * 1000); log("屏幕常亮：开（导航中，最长 30 分钟，退出导航自动撤）"); }
                    else { device.cancelKeepingAwake(); log("屏幕常亮：关"); }
                } catch (e) { log("屏幕常亮切换失败：" + e); }
                return { ok: true };
            });
            log("路况页 jsBridge 已接（diag/navInput）");
        } else log("路况页没有 jsBridge（页面日志收不到）");
    } catch (eJB) { log("路况页 jsBridge 注册失败：" + eJB); }    // 按钮：放大/缩小/关闭（缩放直接改 webview 里地图对象；关闭销毁窗口）
    try {
        w.zin.on("click", function () { try { onMain(function () { try { MAPWEB.loadUrl("javascript:zoomBy(1)"); } catch (e) {} }); } catch (e2) {} });
        w.zout.on("click", function () { try { onMain(function () { try { MAPWEB.loadUrl("javascript:zoomBy(-1)"); } catch (e) {} }); } catch (e2) {} });
        // 📍我：重新向系统要一次当前点并居中（用户报「怎么是北京」时点这个）
        w.my.on("click", function () {
            threads.start(function () {
                var L2 = careMapLoc(true);
                log("📍取当前位置：" + (L2.ok ? (L2.lat + "," + L2.lon) : ("失败 " + (L2.why || ""))) );
                if (!L2.ok) { try { toast(L2.why || "没拿到定位"); } catch (eT0) {} return; }
                // v1.9.1：改用 setPos——它会顺手把 WGS-84 转成 GCJ-02；旧版直接 centerOn 原始 GPS 坐标，
                //   在高德上会偏 500 米（用户 21:5x 报「跑到别的方向差 500 米」就是这个）
                try { onMain(function () { try { MAPWEB.loadUrl("javascript:setPos(" + L2.lat + "," + L2.lon + "," + (L2.acc || 999) + "," + (L2.spd === undefined ? -1 : L2.spd) + ")"); } catch (e) {} }); } catch (eC) {}
            });
        });
        w.cls.on("click", function () { try { log("路况窗：收到关闭（按钮）"); careMapClose(); } catch (e) {} });
        try { if (typeof w.cls.click === "function") w.cls.click(function () { try { log("路况窗：收到关闭（按钮2）"); careMapClose(); } catch (e) {} }); } catch (eMC2) {}
        // 2026-10-23（主人点单）：右上角那颗 ✕ —— 和底部「关闭」走同一个 careMapClose。
        //   双绑定（.on("click") + .click()）沿用 cls 的老经验：浮窗按钮在某些机型上只有其中一种触发。
        try {
            if (w.xclose) {
                w.xclose.on("click", function () { try { log("路况窗：收到关闭（右上角✕）"); careMapClose(); } catch (eXC) {} });
                try { if (typeof w.xclose.click === "function") w.xclose.click(function () { try { log("路况窗：收到关闭（右上角✕2）"); careMapClose(); } catch (eXC2) {} }); } catch (eXC3) { log("路况窗 ✕ 第二绑定失败：" + eXC3); }
            } else log("路况窗：没有 xclose 按钮（浮窗 XML 没建出来？）");
        } catch (eXCb) { log("路况窗 ✕ 绑定失败：" + eXCb); }
        // 2026-10-23（第三轮）：标题条 ✕ 已改成固定宽（286+44 ≤ 340），正常看得见 → 让页面把它自己那颗 ✕ 收起来，
        //   避免屏幕上两个 ✕ 并排。旧包不会调这一句，页面那颗继续兜底。
        //   【怎么判】读原生 ✕ 的实际宽度：>0＝真参与布局、看得见；0＝又被挤没（那就留着页面那颗）。
        //   【失败表现】屏幕上一个 ✕ 都没有 → 先看日志「路况窗 ✕ 实测宽度=」那行到底几。
        try {
            setTimeout(function () {
                try {
                    var _xw = (w.xclose && typeof w.xclose.getWidth === 'function') ? w.xclose.getWidth() : -1;
                    log("路况窗 ✕ 实测宽度=" + _xw);
                    if (_xw > 0) { onMain(function () { try { MAPWEB.loadUrl("javascript:setTopClose(false)"); log("页面 ✕ 已让位（标题条那颗可用）"); } catch (eHP) {} }); }
                } catch (eXW) { log("路况窗 ✕ 宽度检测失败：" + eXW); }
            }, 900);
        } catch (eXT) {}
    } catch (eBtn) { log("路况按钮绑定失败：" + eBtn); }
    // 拖动：WebView 吃手势（地图本身要拖），所以只让「非地图区域」响应拖动：
    //   ①顶部标题条（随时能拖） ②四周边缘那条 10dp 的边框（用户 2026-10-18 16:2x 点名要的：
    //   「地图窗口点边缘位置能拖动地图窗口才行，不是只能地图里能拖动就完了」）
    // 【为什么分两处】webview 会把手势全吃掉，能接收触摸的就剩标题条和边框；两处都挂上，怎么都好拿。
    // 【注意】边框只是容器，手势必须由它自己收（return true），不然会被当成点穿。
    try {
        var dgX = 0, dgY = 0, oxP = posX, oyP = posY, dgOn = false, dgT = 0, dgMv = false;
        var dragHandler = function (ev) {
            try {
                var a = ev.getAction();
                if (a === 0) { dgOn = true; dgMv = false; dgT = Date.now(); dgX = ev.getRawX(); dgY = ev.getRawY(); oxP = posX; oyP = posY; }
                else if (a === 2 && dgOn) {
                    if (Math.abs(ev.getRawX() - dgX) + Math.abs(ev.getRawY() - dgY) > 12) dgMv = true;
                    posX = Math.round(oxP + (ev.getRawX() - dgX));
                    posY = Math.round(oyP + (ev.getRawY() - dgY));
                    w.setPosition(posX, posY);
                } else if (a === 1 || a === 3) {
                    /* 2026-10-23 主人点单：长按标题条关窗这条**撤掉**（隐形手势、拖窗时还容易误触），
                       关窗改由右上角 ✕（w.xclose）与底部「关闭」负责。这里只剩拖动结算。 */
                    // v1.5.18：松手时记一笔——ccode 没法截屏，只靠这行判断「拖动真的生效了没」
                    if (dgOn && (Math.abs(posX - oxP) > 8 || Math.abs(posY - oyP) > 8)) { dgOn = false; try { log("路况窗拖动 → " + posX + "," + posY + "（起 " + oxP + "," + oyP + "）"); } catch (eLd) {} }
                    else { dgOn = false; }
                }
            } catch (eMv) {}
            return true;
        };        w.bar.on("touch", dragHandler);
        try { w.root.on("touch", dragHandler); } catch (eR2) { log("路况窗边框拖动绑定失败：" + eR2); }
        // v1.5.19（用户「点边缘位置能拖动才行」）：左右两条看得见的「拉手」——它们是普通 View，
        //   不像 webview 会把手势全吃掉，所以一定收得到触摸；同时挂 .on("touch") 和 setOnTouchListener 双保险
        //   （真机实测 .on("touch") 在浮窗 ViewGroup 上不一定触发，按钮类控件才稳）。
        var bindGrip = function (name, view) {
            if (!view) { log("路况窗拉手缺失：" + name); return; }
            try { view.on("touch", dragHandler); } catch (eG1) {}
            try { if (typeof view.setOnTouchListener === "function") view.setOnTouchListener(function (v, ev) { return dragHandler(ev); }); } catch (eG2) { log("拉手 " + name + " setOnTouchListener 失败：" + eG2); }
        };
        bindGrip("gripL", w.gripL);
        bindGrip("gripR", w.gripR);
        try { if (typeof w.bar.setOnTouchListener === "function") w.bar.setOnTouchListener(function (v, ev) { return dragHandler(ev); }); } catch (eB2) {}
    } catch (eDr) { log("路况窗拖动条绑定失败：" + eDr); }
    // v1.5.15（用户「怎么是北京不是我当前位置」）：开图前先确一次定位授权——没授权就当场弹系统授权，
    //   并在回复里说清楚（旧版默默拿不到坐标 → 页面停在默认视野＝北京，用户以为是定位坏了）。
    if (!careLocPermOk()) {
        try { runtime.requestPermissions(["android.permission.ACCESS_FINE_LOCATION", "android.permission.ACCESS_COARSE_LOCATION"]); } catch (ePerm) {}
        sleep(1500);        // 给授权弹窗一点时间；用户点「允许」后下面这次取点就能拿到
    }
    // 注入 key 与坐标：页面用 inited 守卫，重复注入只生效一次（省得算不准加载时机）
    // v1.5.14：fresh=true——顺手向系统要一次当前点（拿不到就 0,0，页面会提示开定位，而不是默默显示北京）
    var locn = careMapLoc(true);
    var jsInit = "javascript:initMap(" + JSON.stringify(cfg.key) + "," + JSON.stringify(cfg.sec) + "," + locn.lat + "," + locn.lon + "," + JSON.stringify(cfg.restKey || "") + ")";
    var jsDest = d ? ("javascript:setDest(" + JSON.stringify(d) + ")") : "";
    try {
        threads.start(function () {
            for (var i = 0; i < 12; i++) {
                sleep(700);
                if (!MAP_ON) return;
                try { onMain(function () { try { MAPWEB.loadUrl(jsInit); } catch (e) {} }); } catch (eI) {}
                if (jsDest && i === 2) { try { onMain(function () { try { MAPWEB.loadUrl(jsDest); } catch (e) {} }); } catch (eD) {} }
            }
            if (MAP_ON && !MAP_READY) { log("路况页 12 秒内没就绪（可能没加载出来）url=" + mapPageUrl); }
        });
    } catch (eT) { log("路况注入线程启动失败：" + eT); }
    // v1.8.0：窗口一开就把罗盘接上（用户：「我在的位置箭头和手机陀螺仪关联，我转它跟着转」）
    try { navSenseStart(); } catch (eS0) { log("罗盘启动异常：" + eS0); }
    // v1.8.5（用户 20:5x：「箭头能转就是不跑、不移动，要跟着速度走、还要显示速度」）：
    //   前两版靠 requestLocationUpdates 常驻监听，实机 **2 分钟 0 个点**（连粗点都没有）——
    //   同一台机器上 trkStart 的监听是好的、careMapLoc 的单次要也拿得到点，所以这条路在这台机器上不可靠。
    //   改成**轮询**：每 2 秒主动要一次当前点（单次要，最多等 2.5 秒），拿到就推给页面（连速度一起推）。
    //   关窗时线程自然退出（MAP_ON 变 false），不会漏。
    try { navLocStart(); } catch (eTp) { log("位置实时推送启动失败：" + eTp); }
    try {
        threads.start(function () {
            var lastT = 0;
            while (MAP_ON) {
                try {
                    sleep(2000);
                    if (!MAP_ON) break;
                    var Lp = careMapLoc(true);
                    if (Lp && Lp.ok) {
                        var nowT = Date.now();
                        if (nowT - lastT >= 900) {
                            lastT = nowT;
                            NAVLOC.n++;
                            var jsP = "javascript:setPos(" + Lp.lat + "," + Lp.lon + "," + (Lp.acc || 999) + "," + (Lp.spd === undefined ? -1 : Lp.spd) + ")";
                            onMain(function () { try { MAPWEB.loadUrl(jsP); } catch (eI) {} });
                        }
                    }
                } catch (eLp) {}
            }
            try { log("位置轮询线程结束（共推 " + NAVLOC.n + " 个点）"); } catch (e3) {}
        });
    } catch (ePoll) { log("位置轮询线程启动失败：" + ePoll); }
    // v1.8.9：每 5 秒把「卫星用了几颗/可见几颗/平均信噪比」推给页面（用户点名要在导航里看到）
    try {
        threads.start(function () {
            var last = null;
            while (MAP_ON) {
                try {
                    sleep(5000);
                    if (!MAP_ON) break;
                    var sg = navGpsSignal();
                    if (sg) {
                        if (!last || last.used !== sg.used || last.total !== sg.total) log("卫星：用 " + sg.used + "/" + sg.total + " 颗，均信噪 " + sg.snr);
                        last = sg;
                        var jsS = "javascript:setSignal(" + sg.used + "," + sg.total + "," + sg.snr + ")";
                        onMain(function () { try { MAPWEB.loadUrl(jsS); } catch (eI) {} });
                    }
                } catch (eSg) {}
            }
        });
    } catch (eSg2) { log("卫星推送线程启动失败：" + eSg2); }
    log("路况窗已开" + (d ? ("（目的地：" + d + "）") : "") + " 定位=" + (locn.ok ? (locn.lat + "," + locn.lon) : ("未拿到（" + (locn.why || "") + "）")));
    return { ok: true, on: true, dest: d, lat: locn.lat, lon: locn.lon, locOk: !!locn.ok, locWhy: locn.ok ? "" : (locn.why || "") };
}
// ===== v1.8.0：罗盘（用户：「我在的位置箭头和手机陀螺仪关联，我转它跟着转」）=====
// 【为什么必须由 App 推】浮窗里的 WebView 是 file:// 页面，浏览器不给 deviceorientation（拿不到手机姿态），
//   所以只能在 App 侧注册 orientation 传感器，把方位角推给页面（页面里 setHeading 负责转箭头/转地图）。
// 【注意】① orientation 的 values[0] 是**弧度**，要转成角度；② 传感器每秒几十次，必须节流
//   （这里 180ms≈5Hz，够顺滑又不会把 WebView 刷爆）；③ 窗口关掉必须 unregister，否则华为/荣耀会记耗电。
// 【失败表现】日志「罗盘注册失败」= 这台机器没有 orientation 传感器（极少见）；日志有「罗盘：已开始」但箭头不转 = 页面侧问题。
var NAVSENSE = { on: false, sen: null, last: 0 };
// 【2026-10-18 20:37 探针实锤】AutoJs6 的 sensors.register **不吃裸函数**——
//   `sensors.register("orientation", fn)` 会抛 `InternalError: 无法将 function 转换为 java.lang.Integer`；
//   正确写法是「先注册拿对象、再挂 on('change')」：
//     var s = sensors.register("orientation");  s.on("change", function(e){ e.values = [方位, 俯仰, 横滚] });
//   而且 values[0] 已经是**度**（探针实测首值 192.07；若是弧度会是 0~6.28）。旧代码还在乘 180/π，
//   就算注册成功也会转出个乱七八糟的角——两处一起改，这就是「箭头还是不转」的两个真原因。
function navSenseStart() {
    if (NAVSENSE.on) return { ok: true, reuse: true };
    try {
        var sen = sensors.register("orientation");
        if (!sen || !sen.on) { log("罗盘注册失败：返回对象没有 on()"); return { ok: false }; }
        sen.on("change", function (e) {
            try {
                if (Date.now() - NAVSENSE.last < 180) return;
                NAVSENSE.last = Date.now();
                var v = e && e.values;
                if (!v || v.length < 1) return;
                var deg = ((Number(v[0]) % 360) + 360) % 360;   // values[0] 已是度，不再换算
                if (!MAP_ON || !MAPWEB) return;
                var js = "javascript:setHeading(" + deg.toFixed(1) + ")";
                onMain(function () { try { MAPWEB.loadUrl(js); } catch (eI) {} });
            } catch (eIn) {}
        });
        NAVSENSE.on = true; NAVSENSE.sen = sen;
        log("罗盘：已开始（orientation，度）");
        return { ok: true };
    } catch (e) { log("罗盘注册失败：" + e); return { ok: false, msg: String(e) }; }
}
function navSenseStop() {
    try { if (NAVSENSE.sen) NAVSENSE.sen.unregister(); } catch (e) {}
    NAVSENSE.on = false; NAVSENSE.sen = null;
    log("罗盘：已停");
}
// ===== v1.8.2：窗口开着时的实时位置推送 =====
// 【为什么不用「每 10 秒问一次 lastKnownLocation」】那东西是系统缓存的点，车载场景下常常半分钟才更新一次，
//   而且 provider 不挑：网络定位误差几百米，箭头就贴到旁边的路上去了（用户说的「飘到别的路上」）。
// 【做法】直接 requestLocationUpdates 常驻监听：GPS 2 秒/2 米、网络 3 秒/5 米；精度 >200m 的点丢弃。
// 【注意】① 回调在非主线程，必须 onMain 再 loadUrl；② 关窗一定 removeUpdates，否则耗电+泄漏。
var NAVLOC = { on: false, listener: null, lm: null, n: 0, drop: 0, best: null, bestT: 0 };
function navLocStart() {
    if (NAVLOC.on) return { ok: true, reuse: true };
    if (!careLocPermOk()) {
        // v1.8.6：没授权时**先申请**再判断（以前直接跳过，用户看到的就是"箭头不动"却不知道为什么）
        log("位置实时推送：没授权定位 → 发起授权申请（弹窗里请选「仅在使用中允许」+「精确」）");
        try { runtime.requestPermissions(["android.permission.ACCESS_FINE_LOCATION", "android.permission.ACCESS_COARSE_LOCATION"]); } catch (eReq) {}
        sleep(1800);
        if (!careLocPermOk()) { log("位置实时推送：授权仍未给（用户没点或点了拒绝），跳过"); return { ok: false, msg: "没授权定位" }; }
        log("位置实时推送：刚拿到授权");
    }
    // 【2026-10-18 20:5x 实锤】开窗 4 分钟「收到 0 个点、丢弃粗点 108 个」——所有点精度都 >200m。
    //   同机探针却拿到 GPS acc=8m（AutoJs 自己有余量）。差别就在**权限档位**：安卓 12 起定位分
    //   「精确/大致」，只给「大致」时系统会把 GPS 点也模糊成公里级。所以这里显式检查 FINE。
    var fine = false;
    try { fine = (context.checkSelfPermission("android.permission.ACCESS_FINE_LOCATION") === 0); } catch (eF) {}
    if (!fine) {
        log("定位权限：只有「大致位置」，已重新申请「精确位置」——请在弹窗里选「精确」");
        try { runtime.requestPermissions(["android.permission.ACCESS_FINE_LOCATION"]); } catch (eP) {}
    } else log("定位权限：精确位置已授权");
    try {
        var lm = context.getSystemService(context.LOCATION_SERVICE);
        var L = new android.location.LocationListener({
            onLocationChanged: function (l) {
                try {
                    var acc = (typeof l.hasAccuracy === "function" && l.hasAccuracy()) ? l.getAccuracy() : 999;
                    // 【不再整批丢】v1.8.4：以前 >200m 直接 return，结果一个点都没画（箭头永远不动）。
                    //   现在改成「留最好的」：粗点也收，但只保留最近 10 秒里精度最好的那个，
                    //   并且推给页面时带上精度，由页面决定要不要把地图拽过去（>120m 不拽）。
                    if (!NAVLOC.best || acc <= NAVLOC.best.acc) { NAVLOC.best = { lat: l.getLatitude(), lon: l.getLongitude(), acc: Math.round(acc) }; NAVLOC.bestT = Date.now(); }
                    if (acc > 200) NAVLOC.drop++; else NAVLOC.n++;
                    if (!MAP_ON || !MAPWEB) return;
                    var now = Date.now();
                    if (now - (NAVLOC.lastPush || 0) < 900) return;   // 最多 ~1Hz 推，别把 WebView 刷爆
                    var b = NAVLOC.best;
                    if (!b) return;
                    NAVLOC.lastPush = now;
                    var spd = -1;
                    try { var vS = l.getSpeed(); if (isFinite(vS) && vS >= 0) spd = Math.round(vS * 3.6); } catch (eS) {}
                    var js = "javascript:setPos(" + b.lat + "," + b.lon + "," + b.acc + "," + spd + ")";
                    onMain(function () { try { MAPWEB.loadUrl(js); } catch (eI) {} });
                } catch (e0) {}
            },
            onStatusChanged: function () {},
            onProviderEnabled: function () {},
            onProviderDisabled: function () {}
        });
        // 【为什么 GPS 收到 1000ms/0 米】用户点名要「最快的卫星信号」：GPS 1 秒一次、不限位移；
        //   网络定位只当兜底（3 秒/5 米）。谁精度好由上面的 best 逻辑自己挑，不靠 provider 名字猜。
        try { lm.requestLocationUpdates("gps", 1000, 0, L, context.getMainLooper()); } catch (eG) { log("GPS 监听失败：" + eG); }
        try { lm.requestLocationUpdates("network", 3000, 5, L, context.getMainLooper()); } catch (eN) { log("网络定位监听失败：" + eN); }
        // Honor/部分机型有系统融合定位（fused），精度/功耗都更好；有就一起挂上（没有会抛，忽略）
        try { lm.requestLocationUpdates("fused", 1000, 0, L, context.getMainLooper()); log("fused 定位已挂"); } catch (eFu) {}
        NAVLOC.on = true; NAVLOC.listener = L; NAVLOC.lm = lm;
        log("位置：实时推送已开（GPS 2s/2m，网络 3s/5m，>200m 丢弃）");
        return { ok: true };
    } catch (e) { log("位置实时推送注册失败：" + e); return { ok: false, msg: String(e) }; }
}
// ===== v1.8.9：卫星信号（用户：「卫星信号多少也显示出来」）=====
// 【为什么用 getGpsStatus】它直接给「可见卫星 + 每颗是否参与定位 + 信噪比」，一个调用就够；
//   GNSS 的 registerGnssStatusCallback 要额外 Handler/回调，对这里没有额外价值。
// 【注意】① 要 ACCESS_FINE_LOCATION 才给数；② 已废弃但本机（Android 14）仍然可用，抛异常就返回 null，页面显示「—」；
//   ③ 每 5 秒读一次就够（卫星变化不快），别跟着定位 1 秒一次刷。
function navGpsSignal() {
    try {
        var lm = context.getSystemService(context.LOCATION_SERVICE);
        var gs = lm.getGpsStatus(null);
        if (!gs) return null;
        var it = gs.getSatellites();
        var iter = it.iterator(), used = 0, total = 0, snrMax = 0, snrSum = 0, snrN = 0;
        while (iter.hasNext()) {
            var s = iter.next();
            total++;
            try { if (s.usedInFix()) used++; } catch (e1) {}
            try {
                var sn = s.getSnr();
                if (sn > 0) { snrSum += sn; snrN++; if (sn > snrMax) snrMax = sn; }
            } catch (e2) {}
        }
        return { used: used, total: total, snr: (snrN ? Math.round(snrSum / snrN) : 0) };
    } catch (e) { return null; }
}
function navLocStop() {
    try { if (NAVLOC.lm && NAVLOC.listener) NAVLOC.lm.removeUpdates(NAVLOC.listener); } catch (e) {}
    NAVLOC.on = false; NAVLOC.listener = null; NAVLOC.lm = null;
    try { log("位置：实时推送已停（好用点 " + NAVLOC.n + " 个，粗点 " + NAVLOC.drop + " 个）"); } catch (e2) {}
    NAVLOC.best = null; NAVLOC.bestT = 0;
}
// 全屏 / 还原（页面点 ⛶ 时调）。窗口尺寸单位是 px，340x440 是 dp 得换算。
var MAP_FULL = false;
function careMapFullToggle() {
    if (!MAPW) return { ok: false, msg: "路况窗没开" };
    MAP_FULL = !MAP_FULL;
    var sw = 1080, sh = 2400;
    try { sw = device.width; sh = device.height; } catch (e) {}
    try {
        if (MAP_FULL) {
            MAPW.setSize(sw, sh);
            MAPW.setPosition(0, 0);
            log("路况窗：全屏 " + sw + "x" + sh);
        } else {
            MAPW.setSize(dpx(340), dpx(440));
            MAPW.setPosition(Math.round(sw * 0.06), Math.round(sh * 0.14));
            log("路况窗：还原成小窗");
        }
    } catch (e) { log("全屏切换失败：" + e); return { ok: false, msg: String(e) }; }
    // 【2026-10-18 20:3x 用户报「点全屏也只大一点点」】根因：XML 根节点写死了 w="340" h="440"（dp），
    //   只调 window.setSize 是改窗口，**根布局还是那块固定大小的板子**，于是只露出一点点空边。
    //   必须连根视图的 layoutParams 一起改（单位 px），才算真全屏。
    try {
        ui.run(function () {
            try {
                var r = MAPW && MAPW.root;
                if (!r) return;
                var lp = r.getLayoutParams();
                if (!lp) return;
                lp.width = MAP_FULL ? sw : dpx(340);
                lp.height = MAP_FULL ? sh : dpx(440);
                r.setLayoutParams(lp);
                r.requestLayout();
                // 中间那一行（地图）也要跟着变高，否则地图还是 354dp、下面留空（20:4x 实拍的那个空白）
                try {
                    var mr = MAPW.maprow;
                    if (mr) {
                        var mlp = mr.getLayoutParams();
                        if (mlp) {
                            mlp.width = MAP_FULL ? sw : dpx(340);
                            mlp.height = MAP_FULL ? (sh - dpx(40) - dpx(46)) : dpx(354);
                            mr.setLayoutParams(mlp);
                            mr.requestLayout();
                        }
                    }
                } catch (e3) { log("全屏改地图行失败：" + e3); }
            } catch (e1) { log("全屏改根布局失败：" + e1); }
            // 【2026-10-18 20:4x 用户报「全屏下面是空白、上面才是地图」】窗口和 WebView 都变大了，
            //   但高德的地图画布还是原来那块——必须让页面调 map.resize() 重排瓦片。尺寸变化不一定会触发
            //   window.resize（浮窗是容器改尺寸），所以这里连推两次（300ms/900ms）确保拿到最终尺寸后再排一次。
            try {
                var _rs = [300, 900];
                for (var _ri = 0; _ri < _rs.length; _ri++) {
                    (function (delay) {
                        threads.start(function () {
                            sleep(delay);
                            try { onMain(function () { try { MAPWEB.loadUrl("javascript:navResize()"); } catch (e) {} }); } catch (e2) {}
                        });
                    })(_rs[_ri]);
                }
            } catch (eRS) { log("全屏 reszie 投递失败：" + eRS); }
        });
    } catch (e2) { log("全屏改根布局投递失败：" + e2); }
    return { ok: true, full: MAP_FULL };
}
// ===== v1.7.0：导航（用户 2026-10-18 19:4x 点单：导航 + 多条路线 + 切换最快 + 主路辅路 + 预计用时 + 红绿灯）=====
// 【为什么目的地输入要放在 App 这边】用户当场实测：网页（浮窗 webview）里的 <input> 点它**键盘不出来**——
//   IME 认的是可聚焦的原生窗口，WebView 里的输入框在浮窗里拿不到焦点。3D 输入框那次同理，解法是三连
//   （requestFocus + showSoftInput，全在 ui.run 里）。所以导航页只留一个「📍 输入目的地」按钮，
//   点它 → 回调 App → 弹这个原生输入框 → 打完字回车/发送 → 注入页面算路。
var NAVIN = null;
function navInputClose() { var w = NAVIN; NAVIN = null; try { if (w) w.close(); } catch (e) {} }
function navDestInput() {
    if (NAVIN) {   // 已经在显示：再点一次就再弹一次键盘
        try {
            ui.run(function () {
                try { NAVIN.requestFocus(); } catch (e1) {}
                try { NAVIN.inpTxt.requestFocus(); } catch (e2) {}
                try {
                    var vr = (NAVIN.inpTxt && NAVIN.inpTxt.getView) ? NAVIN.inpTxt.getView() : NAVIN.inpTxt;
                    context.getSystemService(android.content.Context.INPUT_METHOD_SERVICE).showSoftInput(vr, 0);
                } catch (e3) {}
            });
        } catch (e0) {}
        return { ok: true, reuse: true };
    }
    if (!floatAvailable()) return { ok: false, msg: "没有悬浮窗权限" };
    var sw = 1080, sh = 2400;
    try { sw = device.width; sh = device.height; } catch (e) {}
    var wPx = dpx(320), hPx = dpx(48);
    var x = Math.max(dpx(4), Math.round((sw - wPx) / 2));
    var y = dpx(64);
    // 【id 不能用 navClose/x/y/width/height】浮窗对象自带同名 bean 属性会盖掉子控件（3D 输入框踩过，见 d3InputXml 注释）
    var xml = '<vertical bg="#F5FFFFFF" padding="6" w="320" h="48"><horizontal>' +
        '<input id="inpTxt" w="196" h="36" textSize="14sp" singleLine="true" hint="导航去哪儿？"/>' +
        '<button id="btnGo" w="52" h="36" textSize="13" text="去"/>' +
        '<button id="btnX" w="38" h="36" textSize="13" text="✕"/>' +
        '</horizontal></vertical>';
    var u = null;
    try { u = floaty.rawWindow(xml); } catch (e1) { log("导航输入框创建失败：" + e1); return { ok: false, msg: String(e1) }; }
    NAVIN = u;
    try { u.setSize(wPx, hPx); } catch (e2) {}
    try { u.setPosition(x, y); } catch (e3) {}
    try { u.setTouchable(true); } catch (e4) {}
    try { if (typeof u.setAdjustEnabled === "function") u.setAdjustEnabled(false); } catch (e5) {}
    var showKb = function (why) {
        try {
            ui.run(function () {
                try { u.requestFocus(); } catch (e1) {}
                try { u.inpTxt.requestFocus(); } catch (e2) {}
                try {
                    var v = (u.inpTxt && u.inpTxt.getView) ? u.inpTxt.getView() : u.inpTxt;
                    var okKb = context.getSystemService(android.content.Context.INPUT_METHOD_SERVICE).showSoftInput(v, 0);
                    log("导航输入框弹键盘（" + why + "）：showSoftInput=" + okKb);
                } catch (eK) { log("导航输入框弹键盘失败：" + eK); }
            });
        } catch (eU) { log("导航输入框 ui.run 失败：" + eU); }
    };
    var sendFn = function () {
        var t = "";
        try { t = String(u.inpTxt.text() || "").trim(); } catch (eG) {}
        if (!t) { showKb("空发送"); return; }
        try { u.inpTxt.setText(""); } catch (eC) {}
        log("导航输入框：发出去 → " + t.slice(0, 24));
        navInputClose();
        threads.start(function () { try { careNavTo(t); } catch (eN) { log("导航异常：" + eN); } });
    };
    try { u.btnGo.click(sendFn); } catch (eB) { log("导航输入框「去」绑定失败：" + eB); }
    try { u.btnX.click(function () { log("导航输入框：✕ 关闭"); navInputClose(); }); } catch (eB2) { log("导航输入框✕绑定失败：" + eB2); }
    try { u.inpTxt.click(function () { showKb("点输入框"); }); } catch (eB3) {}
    showKb("打开时");
    try { threads.start(function () { sleep(600); showKb("补弹"); }); } catch (eKT) {}
    log("导航输入框：开");
    return { ok: true };
}
// 开导航：开窗（已开就复用）→ 切导航模式 → 用这个名字算路
// 【为什么先 careMapOpen 再注入】窗口创建/位置/关闭那套都在 careMapOpen 里；这里只加两步注入。
// 【失败表现】careMapOpen 失败会回 msg（没配 Key / 没权限）；注入失败只写日志，页面停在路况模式。
function careNavTo(dest, mode, lat, lon) {
    var d = String(dest || "").trim();
    if (!d) return "要导航去哪儿？说个地方我就给你算（比如「导航去春熙路」）";
    var r = null;
    try { r = careMapOpen(""); } catch (e0) { return "地图窗开不起来：" + e0; }
    if (r && r.ok === false) return r.msg || "地图窗开不起来";
    // v1.8.0：先切「驾车/步行」模式，再进导航、再算路（顺序不能反：模式要在算路之前定下来）
    var modeJs = (mode === "walk" || mode === "drive") ? ("navModeToggle(" + JSON.stringify(mode) + ");") : "";
    // 2026-10-22（19:25 实机复现）：注入时页面连脚本都还没跑，「navToggle」直接 ReferenceError →
    //   后面的 setDest 一句都没执行（页面日志里既没有「目的地先存着」也没有「地图就绪」之后的补算）。
    //   所以顺序改成 **setDest 先**、navToggle 后，并各自 try——一个抛错不许把另一个带走。
    // 2026-10-22：模型从 map_search 里挑好某个充电站时会把坐标带回来 → 直接按坐标导航，
    //   免得页面再按名字搜一遍、搜到同名的另一家（主人点单：搜出来就要能照着这个导航）。
    var _la = Number(lat), _lo = Number(lon);
    var coordJs = (isFinite(_la) && isFinite(_lo) && _la && _lo) ? (", " + _la + ", " + _lo) : "";
    var js = "javascript:(function(){try{setDest(" + JSON.stringify(d) + coordJs + ");}catch(e){try{$autojs.invoke('diag','目的地注入失败 '+e);}catch(e2){}}try{" + modeJs + "navToggle(true);}catch(e3){try{$autojs.invoke('diag','导航模式注入失败 '+e3);}catch(e4){}}})()";
    // 【2026-10-22 主人当面报「说导航去哪，它只打开地图不导航」·真因】旧版开窗后**立刻**注入，
    //   而页面那时 map 还没建好（调试日志 19:21:00 注入 / 19:21:02 才「地图就绪」），
    //   页面 setDest 第一行 if (!map) 就把目的地丢了 → 看得到地图、看不到路线。
    //   现在等页面报「地图就绪」再注入（最长等 12 秒）；等不到也注入一次（页面侧会把目的地存到就绪为止）。
    try {
        threads.start(function () {
            for (var wi = 0; wi < 24; wi++) {
                if (MAP_READY) break;
                sleep(500);
            }
            if (!MAP_ON) { log("导航注入取消：窗已关"); return; }
            try { onMain(function () { try { MAPWEB.loadUrl(js); } catch (e) { log("导航注入失败：" + e); } }); } catch (e0) { log("导航注入投递失败：" + e0); }
            log("导航注入：页面" + (MAP_READY ? "已就绪" : "12 秒未就绪（照注入，页面会存着）"));
        });
    } catch (eS) { log("导航注入线程启动失败：" + eS); }
    log("导航：去「" + d.slice(0, 24) + "」");
    return "导航去「" + d + "」：窗已经开了，路线正在算，几条方案会列在下面——点哪条就切到哪条，" +
        "随时按「⚡ 最快」重算最新最快的。红绿灯个数要配了高德 Web服务 Key 才有准数（没配我不编）。";
}

// —— 定位（可选开关，默认关）：只判「在开车 / 停靠」，不记轨迹、不上传 ——
function careLocPermOk() {
    try { return context.checkSelfPermission("android.permission.ACCESS_FINE_LOCATION") === 0; } catch (e) { try { return false; } catch (e2) { return false; } }
}
function careLocTick() {
    try {
        ensureWorkMem();
        if (!MEM.work.gps) return;
        if (!careLocPermOk()) return;        var lm = context.getSystemService(context.LOCATION_SERVICE);
        var loc = null;
        try { loc = lm.getLastKnownLocation("gps") || lm.getLastKnownLocation("network"); } catch (e1) {}
        if (!loc) return;
        try { trkWrite(loc); } catch (eTW) {}   // 这一拍也当轨迹点写一笔（与监听器去重靠 trkWrite 自己的节流）
        // v1.6.6（2026-10-18 18:59 实锤「定位节拍异常：ReferenceError: "now" 未定义」）：
        //   v1.6.0 插上面那行 trkWrite 时，把紧跟着的 `var now = ...` 一起覆盖掉了——后面 MEM.work.lastLoc 用到 now 就抛，
        //   于是每 5 分钟一次定位节拍天天报错、moving 状态也不再更新。现在补回来；
        //   顺带把 loc.hasSpeed 改成方法调用（它本来是方法，写成属性判断恒为真）。
        var now = Date.now(), spd = (loc.hasSpeed && loc.hasSpeed()) ? loc.getSpeed() : -1;
        var last = MEM.work.lastLoc;
        var moved = 0;
        if (last) {
            var dLat = loc.getLatitude() - last.lat, dLon = loc.getLongitude() - last.lon;
            moved = Math.sqrt(dLat * dLat + dLon * dLon) * 111000;      // 粗略米
        }
        MEM.work.lastLoc = { lat: loc.getLatitude(), lon: loc.getLongitude(), t: now };
        // 【2026-10-19 用户「车一直停着，为啥还显示我在跑车」】旧判据是「时速≥4 或 位移≥200 米」，
        // 而车库/路边 GPS 精度只有 30–125 米，静止时两次采样能"漂"出 50–200 米、速度偶尔跳到 4–9，
        // 于是 moving 被反复置真、还天天刷新 movingAt，永远回不到「停着」。
        // 改：①精度差（>50 米）干脆不下结论，别让漂移定状态；②阈值抬到 时速≥12 或 位移≥300 米（5 分钟采样＝真开车才会到）。
        var acc = (loc.hasAccuracy && loc.hasAccuracy()) ? loc.getAccuracy() : 0;
        var reliable = (!acc || acc <= 50);
        if (reliable && (spd >= 12 || moved >= 300)) { MEM.work.moving = true; MEM.work.movingAt = now; }
        else if (!MEM.work.movingAt || now - MEM.work.movingAt > 10 * 60000) { MEM.work.moving = false; }
        saveMem();
    } catch (e) { try { log("定位节拍异常：" + e); } catch (e2) {} }
}
// ===== v1.6.0 轨迹与状态自动识别（用户 2026-10-18 18:3x 点单：「把轨迹功能加上…让它知道我在休息吃饭开车」）=====
// 【要解决的】旧版只有一个 5 分钟一次、只判「在动/停着」的粗判，取点用 lastKnownLocation（所以常年「没拿到定位」），
//   没有任何历史点 —— 问「我今天跑了多少公里 / 在哪停过 / 是不是在充电」它答不上来。
// 【怎么做的】
//   ①采集：开了「定位监测」才注册 requestLocationUpdates（移动 60 秒 / 静止 5 分钟心跳、位移 ≥30 米才写）；
//     App 重启自动续上；荣耀杀后台会有断点，断点**不补**（绝不编造位置）。
//   ②落盘：脚本/关心_轨迹/YYYY-MM-DD.jsonl，一行一个点 {t,lat,lon,spd,acc}；留 30 天；单日上限 1500 点（省电防炸）。
//   ③分析：全部从点序列算（haversine 距离；开车＝时速≥15km/h 或相邻位移≥100m；停留＝静止≥10 分钟）。
//   ④地点语义：高频停留点先记成「未命名地点」，你在对话里给它起名（家/充电站/常去的饭店）后永久绑定，
//     之后才叫得出「在充电站停着」。判断权在模型（工具 place_name），App 不猜也不写死地名。
var TRK_DIR = BASE + "/关心_轨迹";
var TRK_KEEP_DAYS = 30, TRK_MAX_PER_DAY = 4000;   // 2026-10-19：采样从 60s 加密到 20s，日上限同步提到 4000（否则下午就被截断）
// 【2026-10-19 18:2x 用户「粗估会根据推断越来越接近准确时间吗」——要把这条路打通，采样必须够密】
// 原来移动时 60 秒一拍：等红灯只有 20~60 秒，60 秒一采根本抓不到「停车→起步」这一对点，
//   实测 319 个点只识别出 33 次停留、每个路口「起步观测」全是 0（口径节报告）。
// 改成 20 秒一拍：能覆盖大多数红灯；代价是点数约翻 3 倍（日均从百量级到千量级），
//   TRK_MAX_PER_DAY 同步从 1500 提到 4000，否则下午就会被截断。
var TRK_MOVE_MS = 20000, TRK_STILL_MS = 300000, TRK_MIN_DIST = 30;
var TRK = { on: false, lm: null, listener: null, lastW: 0, lastLat: 0, lastLon: 0, day: "", n: 0 };
var TRKW = null, TRKWEB = null, TRK_ON = false, TRK_DAY = 0;
function trk2d(n) { return (n < 10 ? "0" : "") + n; }
function trkDayKey(t) { var d = new Date(t || Date.now()); return d.getFullYear() + "-" + trk2d(d.getMonth() + 1) + "-" + trk2d(d.getDate()); }
function trkPath(day) { return TRK_DIR + "/" + day + ".jsonl"; }
function trkEnsureDir() { try { var f = new java.io.File(TRK_DIR); if (!f.exists()) f.mkdirs(); return true; } catch (e) { try { log("轨迹目录建不了：" + e); } catch (e2) {} return false; } }
// 距离：haversine（米）。不用 Location.distanceBetween——高频调用时省一次 Java 往返。
function trkDistM(lat1, lon1, lat2, lon2) {
    var R = 6371000, rad = Math.PI / 180;
    var dLat = (lat2 - lat1) * rad, dLon = (lon2 - lon1) * rad;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
    return R * c;
}
function trkReadDay(day) {
    var out = [];
    try {
        var s = readText(trkPath(day));
        if (!s) return out;
        var lines = s.split("\n");
        for (var i = 0; i < lines.length; i++) {
            if (!lines[i]) continue;
            try { var o = JSON.parse(lines[i]); if (o && o.t && typeof o.lat === "number") out.push(o); } catch (e1) {}
        }
        out.sort(function (a, b) { return a.t - b.t; });
    } catch (e) { try { log("读轨迹失败：" + e); } catch (e2) {} }
    return out;
}
function trkCleanOld() {
    try {
        var d = new java.io.File(TRK_DIR);
        if (!d.exists()) return;
        var arr = d.listFiles(), cut = Date.now() - TRK_KEEP_DAYS * 86400000;
        for (var i = 0; arr && i < arr.length; i++) {
            try { if (arr[i].getName().indexOf(".jsonl") > 0 && arr[i].lastModified() < cut) arr[i].delete(); } catch (e1) {}
        }
    } catch (e) {}
}
// v1.6.1（2026-10-18 18:43 实机实锤）：LocationListener 回调里那支 Location 在这版 AutoJs 上**没有 getLatitude 方法**——
//   日志「轨迹写点失败：TypeError: 无法找到函数 getLatitude.」，于是一个点也写不进去。
//   这里按「方法 → bean 属性 → 直接字段」三条路取经纬度，取不到就放弃（绝不编坐标）。
function trkLL(loc) {
    if (!loc) return null;
    var lat = null, lon = null, spd = -1, acc = -1;
    try { lat = loc.getLatitude(); lon = loc.getLongitude(); } catch (e1) {}
    if (typeof lat !== "number" || typeof lon !== "number") { try { lat = loc.latitude; lon = loc.longitude; } catch (e2) {} }
    if (typeof lat !== "number" || typeof lon !== "number") return null;
    try { spd = Math.round(loc.getSpeed() * 3.6); } catch (e3) { try { spd = Math.round(loc.speed * 3.6); } catch (e4) { spd = -1; } }
    if (typeof spd !== "number" || isNaN(spd) || spd < 0) spd = -1;
    try { acc = Math.round(loc.getAccuracy()); } catch (e5) { try { acc = Math.round(loc.accuracy); } catch (e6) { acc = -1; } }
    if (typeof acc !== "number" || isNaN(acc)) acc = -1;
    return { lat: lat, lon: lon, spd: spd, acc: acc };
}
function trkLastLocObj() {
    try {
        var lm = context.getSystemService(context.LOCATION_SERVICE);
        return lm.getLastKnownLocation("gps") || lm.getLastKnownLocation("network") || lm.getLastKnownLocation("passive");
    } catch (e) { return null; }
}
function trkWrite(loc) {
    try {
        var pt = trkLL(loc);
        if (!pt) return false;
        var lat = pt.lat, lon = pt.lon, now = Date.now();
        var moved = (TRK.lastLat || TRK.lastLon) ? trkDistM(TRK.lastLat, TRK.lastLon, lat, lon) : 99999;
        var gap = now - (TRK.lastW || 0);
        if (moved < TRK_MIN_DIST && gap < TRK_STILL_MS) return false;   // 没动又没到静止心跳 → 不写（省电）
        if (!trkEnsureDir()) return false;
        var day = trkDayKey(now);
        if (TRK.day !== day) { TRK.day = day; TRK.n = trkReadDay(day).length; trkCleanOld(); }
        if (TRK.n >= TRK_MAX_PER_DAY) return false;
        var line = JSON.stringify({ t: now, lat: Number(lat.toFixed(6)), lon: Number(lon.toFixed(6)), spd: pt.spd, acc: pt.acc }) + "\n";
        javaWriteLine(trkPath(day), line);
        TRK.n++; TRK.lastW = now; TRK.lastLat = lat; TRK.lastLon = lon;
        return true;
    } catch (e) { try { log("轨迹写点失败：" + e); } catch (e2) {} return false; }
}
// 【2026-10-19 用户「明明我今天开了几十公里了的」·根因之二】熄屏后系统进 Doze 会把定位回调掐停：
// 当天 12:35→14:48 实测断采 2 小时 13 分（日志里同期只有「熄屏开始/休息结束」，没有轨迹点），
// 人却真的从 30.815,104.168 开到了 30.627,104.141（直线 21.8 公里）——那两小时的绕路一个点都没落下，
// 里程只能按首尾直线估，用户当场质疑「几十公里呢」。采集期间持 PARTIAL_WAKE_LOCK 让 CPU 不深睡、
// 定位回调继续；trkStop 释放。失败只记日志、绝不影响采集本身（拿不到锁就退回原行为）。
var TRK_WL = null;
function trkWake(on) {
    try {
        if (on) {
            if (TRK_WL) return true;
            var pm = context.getSystemService(context.POWER_SERVICE);
            TRK_WL = pm.newWakeLock(android.os.PowerManager.PARTIAL_WAKE_LOCK, "care:track");
            try { TRK_WL.setReferenceCounted(false); } catch (eR) {}
            TRK_WL.acquire();
            log("轨迹：已持唤醒锁（熄屏也继续采点）");
        } else if (TRK_WL) {
            try { TRK_WL.release(); } catch (eRl) {}
            TRK_WL = null;
            log("轨迹：唤醒锁已释放");
        }
        return true;
    } catch (e) { log("轨迹唤醒锁失败（照常采集）：" + e); return false; }
}
function trkStart() {
    if (TRK.on) return { ok: true, on: true };
    if (!careLocPermOk()) return { ok: false, msg: "没授权定位" };
    try {
        var lm = context.getSystemService(context.LOCATION_SERVICE);
        var L = new android.location.LocationListener({
            // v1.6.1：回调对象可能只有属性没有方法（18:43 实锤）——先试它，不行再拿系统最后一个已知点兑一次
            onLocationChanged: function (l) {
                try {
                    if (!trkWrite(l)) { var _lo = trkLastLocObj(); if (_lo) trkWrite(_lo); }
                } catch (e) {}
            },
            onStatusChanged: function () {},
            onProviderEnabled: function () {},
            onProviderDisabled: function () {}
        });
        var any = false, provs = ["gps", "network"];
        for (var i = 0; i < provs.length; i++) {
            try { lm.requestLocationUpdates(provs[i], TRK_MOVE_MS, TRK_MIN_DIST, L, context.getMainLooper()); any = true; } catch (eR) {}
        }
        if (!any) return { ok: false, msg: "系统没有可用的定位源" };
        TRK.lm = lm; TRK.listener = L; TRK.on = true;
        trkWake(true);
        log("轨迹：开始采集（移动 " + Math.round(TRK_MOVE_MS / 1000) + " 秒 / 静止 " + Math.round(TRK_STILL_MS / 1000) + " 秒心跳，留 " + TRK_KEEP_DAYS + " 天）");
        try { actLog("轨迹", "开始采集（熄屏也采，移动 60s / 静止 5min 一拍）"); } catch (eAT1) {}
        return { ok: true, on: true };
    } catch (e) { log("轨迹启动失败：" + e); return { ok: false, msg: String(e) }; }
}
function trkStop() {
    if (!TRK.on) return { ok: true, on: false };
    try { if (TRK.lm && TRK.listener) TRK.lm.removeUpdates(TRK.listener); } catch (e) {}
    TRK.lm = null; TRK.listener = null; TRK.on = false;
    trkWake(false);
    log("轨迹：停止采集");
    try { actLog("轨迹", "停止采集（不再记里程）"); } catch (eAT2) {}
    return { ok: true, on: false };
}
// 纯函数（可单测）：点序列 → 里程 / 开车段 / 停留点。判据只看速度与位移，不做业务猜测。
function trkAnalyze(points) {
    var res = { n: 0, distM: 0, driveMs: 0, drive: [], stops: [] };
    var pts = points || [];
    res.n = pts.length;
    if (pts.length < 2) return res;
    var i, d, dt, seg = [], sum = 0;
    for (i = 1; i < pts.length; i++) {
        dt = pts[i].t - pts[i - 1].t;
        if (dt <= 0) { seg.push({ mv: false, d: 0, dt: 0 }); continue; }
        d = trkDistM(pts[i - 1].lat, pts[i - 1].lon, pts[i].lat, pts[i].lon);
        // 漂移保护：<60 秒挪 5 公里、或等效时速 >55 米/秒(≈198km/h) 一律当漂移，不计距离也不算移动
        if ((dt < 60000 && d > 5000) || (d / (dt / 1000) > 55)) { seg.push({ mv: false, d: 0, dt: dt }); continue; }
        // 【2026-10-19 ccode·用户「明明我今天开了几十公里」】采集中断段**必须照算**，不许丢掉：
        // 当天 12:35→14:48 采集断了 2 小时 13 分（App 被杀），人却真的从 30.815,104.168 开到了
        // 30.677,104.122 再开到 30.627,104.141（直线 15.9+5.9 公里）。若把「断点段」当漂移剔除，
        // 当天里程就只剩 1.9 公里——用户当场纠正「明明我今天开了几十公里」。断点越长，平均速度越像
        // 正常行驶，本来就不该被 55 米/秒 那条门排除；这里显式写明口径，防以后又被人「优化」掉。
        // 【2026-10-19 ccode·「找车位那 600 米」漏记】旧判据只看「时速≥15 或 单步位移≥100 米」，
        // 而车库/路边找车位这一段正好是「时速 3–8 + 相邻点位移 20–60 米」——全被判成静止，
        // 用户实测：充完电挪 600 多米找车位，里程和开车时长都是 0（2026-10-19 00:03–00:06 的真实点）。
        // 两处改：①精度门（acc>60 米当抖动：既不计距离也不当移动，治室内/车库漂移把里程灌水——
        // 同一晚的 1480 米里绝大多数是 acc 30–125 米的漂移）；②低速窗判据（5 分钟内净位移 ≥60 米
        // 且中途没有差精度点，也算在移动），这样「低速挪车找位」能记上，而「原地坐着 GPS 漂」记不上。
        var acci = (typeof pts[i].acc === "number" && pts[i].acc > 0) ? pts[i].acc : 0;
        var accp = (typeof pts[i - 1].acc === "number" && pts[i - 1].acc > 0) ? pts[i - 1].acc : 0;
        if ((acci && acci > 60) || (accp && accp > 60)) { seg.push({ mv: false, d: 0, dt: dt }); continue; }
        var spd = (typeof pts[i].spd === "number" && pts[i].spd >= 0) ? pts[i].spd : -1;
        var mv = (spd >= 15) || (d >= 100);
        // 注意「还在动」这个前提：单步位移 <8 米就别拿旧点回看——否则刚停下的那几分钟会被
        // 前面开车的点判定成「仍在移动」，把一段 15 分钟的停靠啃成 10 分钟（轨迹_test C 用例曾红）。
        if (!mv && d >= 8) {
            for (var j = i - 1; j >= 0 && pts[i].t - pts[j].t <= 300000; j--) {
                var accj = (typeof pts[j].acc === "number" && pts[j].acc > 0) ? pts[j].acc : 0;
                if (accj > 60) break;                       // 窗内有差精度点就不可信，直接放弃这段
                if (trkDistM(pts[j].lat, pts[j].lon, pts[i].lat, pts[i].lon) >= 60) { mv = true; break; }
            }
        }
        sum += d;
        seg.push({ mv: mv, d: d, dt: dt });
    }
    res.distM = sum;
    // 开车段：移动段合并，间隔 >10 分钟断开
    var cur = null;
    for (i = 1; i < pts.length; i++) {
        var g = seg[i - 1];
        if (!g) continue;
        if (g.mv) {
            if (!cur) cur = { s: pts[i - 1].t, e: pts[i].t };
            else if (pts[i - 1].t - cur.e > 600000) { res.drive.push(cur); cur = { s: pts[i - 1].t, e: pts[i].t }; }
            else cur.e = pts[i].t;
        } else if (cur) { res.drive.push(cur); cur = null; }
    }
    if (cur) res.drive.push(cur);
    for (i = 0; i < res.drive.length; i++) res.driveMs += Math.max(0, res.drive[i].e - res.drive[i].s);
    // 停留点：连续静止 ≥10 分钟算一个（坐标取停留期内的均值，避免漂一下就跑偏）
    var st = null;
    for (i = 0; i < pts.length; i++) {
        var still = (i === 0) ? true : (seg[i - 1] && !seg[i - 1].mv);
        if (still) {
            if (!st) st = { s: pts[i].t, e: pts[i].t, lat: pts[i].lat, lon: pts[i].lon, _n: 1 };
            else { st.e = pts[i].t; st.lat += pts[i].lat; st.lon += pts[i].lon; st._n++; }
        } else if (st) {
            st.ms = st.e - st.s;
            if (st.ms >= 600000) { st.lat = Number((st.lat / st._n).toFixed(6)); st.lon = Number((st.lon / st._n).toFixed(6)); delete st._n; res.stops.push(st); }
            st = null;
        }
    }
    if (st) {
        st.ms = st.e - st.s;
        if (st.ms >= 600000) { st.lat = Number((st.lat / st._n).toFixed(6)); st.lon = Number((st.lon / st._n).toFixed(6)); delete st._n; res.stops.push(st); }
    }
    return res;
}
// —— 地点学习（家 / 充电站 / 常去的饭店）：名字只由模型经 place_name 写，App 不猜 ——
function trkPlaces() { MEM.places = MEM.places || []; return MEM.places; }
function trkPlaceNear(lat, lon) {
    var arr = trkPlaces(), best = null, bestD = 1e9;
    for (var i = 0; i < arr.length; i++) {
        var p = arr[i];
        if (!p) continue;
        var d = trkDistM(lat, lon, p.lat, p.lon);
        if (d < (p.r || 150) && d < bestD) { bestD = d; best = p; }
    }
    return best;
}
function trkNameCurrent(name) {
    var nm = String(name || "").trim().slice(0, 12);
    if (!nm) return "要给这个地方起个名才行（比如「家」「充电站」）";
    var l = careMapLoc(true);
    if (!l.ok) return "没拿到当前位置（" + (l.why || "") + "），等有定位了再说一次";
    var arr = trkPlaces(), p = trkPlaceNear(l.lat, l.lon);
    if (p) { p.name = nm; p.lat = l.lat; p.lon = l.lon; p.t = Date.now(); }
    else arr.push({ name: nm, lat: l.lat, lon: l.lon, r: 150, t: Date.now() });
    saveMem();
    log("轨迹：地点命名「" + nm + "」@" + l.lat.toFixed(5) + "," + l.lon.toFixed(5));
    return "记住了：这儿是「" + nm + "」，以后在这儿久停我就知道";
}
function trkStateNow() {
    var pts = trkReadDay(trkDayKey(Date.now()));
    if (!pts.length) return { known: false, text: "还没记到位置（面板开「📍定位监测」才会记）" };
    var last = pts[pts.length - 1];
    var idle = Math.round((Date.now() - last.t) / 60000);
    var pl = trkPlaceNear(last.lat, last.lon);
    var where = pl ? pl.name : "";
    if (typeof last.spd === "number" && last.spd >= 15) return { known: true, state: "开车", text: "在开车" + (where ? "（刚经过" + where + "附近）" : "") };
    var s0 = last.t;
    for (var i = pts.length - 1; i > 0; i--) {
        var d = trkDistM(pts[i - 1].lat, pts[i - 1].lon, pts[i].lat, pts[i].lon);
        if (d >= 100) break;
        s0 = pts[i - 1].t;
    }
    var mins = Math.round((Date.now() - s0) / 60000);
    if (mins >= 10) return { known: true, state: "停留", text: "停着没动约 " + mins + " 分钟" + (where ? "（" + where + "）" : "") + (idle > 20 ? "（" + idle + " 分钟没更新位置）" : "") };
    return { known: true, state: "停着", text: "这会儿停着（" + mins + " 分钟没大位移）" + (where ? "，在" + where : "") };
}
// 一天/几天的文字小结（给模型与面板用，数字全部来自真实点）
function trkSummary(dayOffset) {
    var off = dayOffset || 0;
    var day = trkDayKey(Date.now() - off * 86400000);
    var pts = trkReadDay(day);
    if (!pts.length) return day + "：还没记到位置（要先开「📍定位监测」）";
    var a = trkAnalyze(pts);
    var s = day + "：里程约 " + (a.distM >= 1000 ? (a.distM / 1000).toFixed(1) + " 公里" : Math.round(a.distM) + " 米") + "，开车约 " + Math.round(a.driveMs / 60000) + " 分钟";
    if (a.stops.length) {
        var arr = [];
        for (var i = 0; i < a.stops.length && i < 6; i++) {
            var st = a.stops[i], pl = trkPlaceNear(st.lat, st.lon);
            arr.push(hhmm(st.s) + "-" + hhmm(st.e) + " " + (pl ? pl.name : "未命名地点") + " " + Math.round(st.ms / 60000) + " 分钟");
        }
        s += "；停靠 " + a.stops.length + " 处：" + arr.join("｜");
    } else s += "；没有 10 分钟以上的停靠";
    return s;
}
// —— 轨迹页（高德 JSAPI 画线；页面本体写在 main.js 里，打开时落到 脚本/关心_地图/轨迹.html，改页面不用重装）——
function trkPageHtml() {
    return '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8">' +
        '<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">' +
        '<title>轨迹</title><style>' +
        'html,body{margin:0;height:100%;background:#0d1117;overflow:hidden;font-family:-apple-system,"Noto Sans CJK SC",sans-serif}' +
        '#map{position:absolute;left:0;top:0;right:0;bottom:0}' +
        '#tip{position:absolute;left:8px;top:8px;z-index:20;padding:6px 10px;border-radius:8px;background:rgba(0,0,0,.6);color:#e6edf3;font-size:12px;line-height:1.5;max-width:80%}' +
        '</style></head><body><div id="map"></div><div id="tip">正在加载…</div><script>' +
        'var map=null,line=null,marks=[],inited=false;' +
        'function tip(t){try{document.getElementById("tip").textContent=t;}catch(e){}}' +
        'function initMap(key,sec){' +
        ' if(inited)return;inited=true;' +
        ' if(typeof AMap==="undefined"){window._AMapSecurityConfig={securityJsCode:sec||""};loadAMap(key,1);}else{boot();}' +
        '}' +
        // v1.6.5（用户 19:0x「上个版本轨迹地图都能正常显示，你改了下变地图加载失败」）：
        //   高德脚本一次性失败就报错太脆（这机器全天 DNS 抖）。改成最多试 3 次、每次 1.2 秒后重来，
        //   并在提示里写清「第几次」；真三次都失败才说失败并指出是网络还是 key。
        'var amapTries=0;' +
        'function loadAMap(key,n){' +
        ' if(map)return;' +
        ' amapTries=n;' +
        ' if(n>3){tip("地图脚本加载失败（已重试 3 次）：网络不通或高德 key 白名单");return;}' +
        ' tip("地图加载中…（第 "+n+" 次）");' +
        ' var s=document.createElement("script");' +
        ' s.src="https://webapi.amap.com/maps?v=2.0&key="+encodeURIComponent(key)+"&_r="+Date.now();' +
        ' s.onload=function(){if(typeof AMap==="undefined"){setTimeout(function(){loadAMap(key,n+1)},800);return;}boot();};' +
        ' s.onerror=function(){setTimeout(function(){loadAMap(key,n+1)},1200);};' +
        ' document.head.appendChild(s);' +
        '}' +
        'function boot(){' +
        ' try{map=new AMap.Map("map",{zoom:13,resizeEnable:true,mapStyle:"amap://styles/dark"});tip("图已就绪");}' +
        ' catch(e){tip("地图初始化出错："+e);}' +
        '}' +
        'function setTrack(d){' +
        ' if(!map){setTimeout(function(){setTrack(d)},600);return;}' +
        ' try{' +
        '  if(line){map.remove(line);line=null;}' +
        '  for(var i=0;i<marks.length;i++){try{map.remove(marks[i])}catch(e){}}' +
        '  marks=[];' +
        '  var ps=d.points||[],path=[];' +
        '  for(var i2=0;i2<ps.length;i2++){path.push([ps[i2].lon,ps[i2].lat]);}' +
        '  if(path.length>1){line=new AMap.Polyline({path:path,strokeColor:"#4cc3ff",strokeWeight:5,showDir:true});map.add(line);}' +
        '  var sts=d.stops||[];' +
        '  for(var j=0;j<sts.length;j++){var st=sts[j];' +
        '   marks.push(new AMap.CircleMarker({center:[st.lon,st.lat],radius:7,strokeColor:"#fff",strokeWeight:2,fillColor:"#ff9f43",fillOpacity:0.95}));' +
        '   marks.push(new AMap.Text({position:[st.lon,st.lat],text:(st.name||"停留")+" "+Math.round((st.ms||0)/60000)+"分",offset:new AMap.Pixel(0,-16),style:{background:"rgba(0,0,0,.65)",border:"0",color:"#fff","font-size":"11px",padding:"2px 6px","border-radius":"6px"}}));' +
        '  }' +
        '  for(var k=0;k<marks.length;k++){map.add(marks[k]);}' +
        '  if(path.length>1){map.setFitView();}else if(path.length===1){map.setZoomAndCenter(16,path[0]);}' +
        '  var sm=d.sum||{};' +
        '  tip((d.day||"")+" ｜ 里程 "+(sm.distM>=1000?(sm.distM/1000).toFixed(1)+" 公里":Math.round(sm.distM||0)+" 米")+" ｜ 开车 "+Math.round((sm.driveMs||0)/60000)+" 分钟 ｜ "+path.length+" 个点");' +
        ' }catch(e){tip("画轨迹出错："+e);}' +
        '}' +
        '</script></body></html>';
}
function trkEnsurePage() {
    var dir = BASE + "/关心_地图";
    try { var d = new java.io.File(dir); if (!d.exists()) d.mkdirs(); } catch (e) {}
    var p = dir + "/轨迹.html";
    var html = trkPageHtml();
    var cur = "";
    try { cur = readText(p) || ""; } catch (e) {}
    if (String(cur).replace(/\s+$/, "") !== String(html).replace(/\s+$/, "")) {
        try { javaWriteJSON(p, html); } catch (e1) { try { files.write(p, html); } catch (e2) { log("写轨迹页失败：" + e2); return ""; } }
    }
    return p;
}
// 注入用的精简数据（最多 300 个点——loadUrl 的 javascript: 太长会丢）
function trkPayload(dayOffset) {
    // v1.9.3：这里把 WGS-84 转成高德的 GCJ-02（只影响画图，jsonl 原样不写回）。
    // 【为什么改成局部函数】v1.9.2 把它们放成顶层 var/function，装上去 App 起不来（日志里连启动行都没有），
    //   而 1.9.1 正常——所以回退成「不出这个函数」的写法，零顶层副作用，出事面最小。
    var _gcjA = 6378245.0, _gcjEE = 0.00669342162296594323;
    function _outOfChina(la, lo) { return !(lo > 73.66 && lo < 135.05 && la > 3.86 && la < 53.55); }
    function _tLat(x, y) {
        var r = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
        r += (20.0 * Math.sin(6.0 * x * Math.PI) + 20.0 * Math.sin(2.0 * x * Math.PI)) * 2.0 / 3.0;
        r += (20.0 * Math.sin(y * Math.PI) + 40.0 * Math.sin(y / 3.0 * Math.PI)) * 2.0 / 3.0;
        r += (160.0 * Math.sin(y / 12.0 * Math.PI) + 320 * Math.sin(y * Math.PI / 30.0)) * 2.0 / 3.0;
        return r;
    }
    function _tLon(x, y) {
        var r = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
        r += (20.0 * Math.sin(6.0 * x * Math.PI) + 20.0 * Math.sin(2.0 * x * Math.PI)) * 2.0 / 3.0;
        r += (20.0 * Math.sin(x * Math.PI) + 40.0 * Math.sin(x / 3.0 * Math.PI)) * 2.0 / 3.0;
        r += (150.0 * Math.sin(x / 12.0 * Math.PI) + 300.0 * Math.sin(x / 30.0 * Math.PI)) * 2.0 / 3.0;
        return r;
    }
    function _w2g(la, lo) {
        la = Number(la); lo = Number(lo);
        if (!isFinite(la) || !isFinite(lo) || _outOfChina(la, lo)) return { lat: la, lon: lo };
        var dLat = _tLat(lo - 105.0, la - 35.0), dLon = _tLon(lo - 105.0, la - 35.0);
        var rad = la / 180.0 * Math.PI, magic = Math.sin(rad);
        magic = 1 - _gcjEE * magic * magic;
        var sq = Math.sqrt(magic);
        dLat = (dLat * 180.0) / ((_gcjA * (1 - _gcjEE)) / (magic * sq) * Math.PI);
        dLon = (dLon * 180.0) / (_gcjA / sq * Math.cos(rad) * Math.PI);
        return { lat: la + dLat, lon: lo + dLon };
    }
    var day = trkDayKey(Date.now() - (dayOffset || 0) * 86400000);
    var pts = trkReadDay(day);
    var a = trkAnalyze(pts);
    var step = Math.max(1, Math.ceil(pts.length / 300));
    var thin = [];
    for (var i = 0; i < pts.length; i += step) {
        var g = _w2g(pts[i].lat, pts[i].lon);      // v1.9.2：画图前转火星坐标
        thin.push({ t: pts[i].t, lat: g.lat, lon: g.lon });
    }
    if (pts.length && thin[thin.length - 1].t !== pts[pts.length - 1].t) {
        var g2 = _w2g(pts[pts.length - 1].lat, pts[pts.length - 1].lon);
        thin.push({ t: pts[pts.length - 1].t, lat: g2.lat, lon: g2.lon });
    }
    var stops = [];
    for (var j = 0; j < a.stops.length; j++) {
        var st = a.stops[j], pl = trkPlaceNear(st.lat, st.lon), gs = _w2g(st.lat, st.lon);
        stops.push({ lat: gs.lat, lon: gs.lon, s: st.s, e: st.e, ms: st.ms, name: pl ? pl.name : "停留" });
    }
    return { day: day, points: thin, stops: stops, sum: { distM: Math.round(a.distM), driveMs: a.driveMs } };
}
function trkRefresh(dayOffset) {
    if (!TRK_ON || !TRKWEB) return;
    try {
        var d = trkPayload(dayOffset || 0);
        var js = "javascript:setTrack(" + JSON.stringify(d) + ")";
        onMain(function () { try { TRKWEB.loadUrl(js); } catch (e) { log("轨迹注入失败：" + e); } });
        log("轨迹：切到 " + d.day + "（" + d.points.length + " 点，" + d.stops.length + " 停靠）");
    } catch (e) { log("轨迹刷新失败：" + e); }
}
function trkClose() {
    // v1.6.4（用户 18:5x：「轨迹地图没法关，一直挡在屏幕前面，只好大退 App」——真事故）：
    //   旧版只调 TRKW.close() 且不 log，关掉了没关掉根本看不出来。现在：先 destroy WebView、再 close，
    //   双保险关两次，并留日志，方便下次一跟就知道哪里没走到。
    var w = TRKW, wb = TRKWEB;
    TRKW = null; TRKWEB = null; TRK_ON = false;
    try { if (wb && wb.destroy) wb.destroy(); } catch (e0) {}
    try { if (w) w.close(); } catch (e1) { try { log("轨迹窗第一次 close 异常：" + e1); } catch (e) {} }
    try { if (w) w.close(); } catch (e2) {}
    log("轨迹窗：关");
    return { ok: true, on: false };
}
function trkOpen(dayOffset) {
    TRK_DAY = dayOffset || 0;
    if (TRK_ON && TRKW) { trkRefresh(TRK_DAY); return { ok: true, on: true, reused: true }; }
    var cfg = careMapCfg();
    if (!cfg.key) return { ok: false, msg: "还没配高德 Key（脚本/关心_地图配置.json 的 jsKey、jsSec），配好我就能画轨迹" };
    var page = trkEnsurePage();
    if (!page) return { ok: false, msg: "轨迹页写不出来（检查 脚本/关心_地图/ 可写）" };
    var w = null;
    try {
        w = floaty.window(
            <frame id="root" w="340" h="440" bg="#0d1117">
                <vertical>
                    <!-- 2026-10-23 主人点单：「轨迹地图的长按关闭也改成那样」——和路况窗同款：
                         ①✕ 放在标题条最右上角；②撤掉长按标题条关窗（隐形手势、拖窗时易误触）；
                         ③ttl 改固定宽 286、✕ 固定 44（286+44=330 ≤ 340）——不能再用 w="*"，
                           否则同行固定宽子控件会被挤出可视区（路况窗四轮才查实的坑，见 2026-10-23 09:31 条）。 -->
                    <horizontal id="bar" h="40" bg="#1b222c" clickable="true">
                        <text id="ttl" text="🛣 我的轨迹 · 拖我移动窗口" w="286" h="*" textSize="12sp" textColor="#9fb0c6" gravity="center_vertical" paddingLeft="10"/>
                        <button id="xclose" text="✕" w="44" h="40" textSize="17sp" bg="#b42828" textColor="#ffffff"/>
                    </horizontal>
                    <webview id="web" w="*" h="344"/>
                    <!-- 2026-10-23：底部 3 个按钮旧写法全是 w="*" → 按 路况窗的经验全改固定宽 112×3=336 ≤ 340，
                         否则同行的后两个（昨天/关闭）会被挤出可视区。 -->
                    <horizontal h="46" bg="#1b222c">
                        <button id="bToday" text="今天" w="112" h="42" textSize="14sp" bg="#232a36" textColor="#ffffff"/>
                        <button id="bYest" text="昨天" w="112" h="42" textSize="14sp" bg="#232a36" textColor="#ffffff"/>
                        <button id="cls" text="关闭" w="112" h="42" textSize="14sp" bg="#b42828" textColor="#ffffff"/>
                    </horizontal>
                </vertical>
            </frame>
        );
    } catch (eW) { return { ok: false, msg: "轨迹窗建不起来：" + eW }; }
    try { if (typeof w.setAdjustEnabled === "function") w.setAdjustEnabled(false); } catch (eA) {}
    try { w.web.setBackgroundColor(0); } catch (eBG) {}
    try {
        onMain(function () {
            try {
                var ws = w.web.getSettings();
                ws.setJavaScriptEnabled(true);
                ws.setAllowFileAccess(true);
                ws.setAllowFileAccessFromFileURLs(true);
                ws.setAllowUniversalAccessFromFileURLs(true);
                ws.setDomStorageEnabled(true);
            } catch (eWS) { log("轨迹 webview 设置异常：" + eWS); }
        });
    } catch (eWS2) { log("轨迹 webview 设置投递失败：" + eWS2); }
    var url = "file://" + page;
    try { onMain(function () { try { w.web.loadUrl(url); } catch (eLU) { log("轨迹页 loadUrl 失败：" + eLU); } }); } catch (eLU2) { log("轨迹页 loadUrl 投递失败：" + eLU2); }
    var sw = 1080, sh = 2400;
    try { sw = device.width; sh = device.height; } catch (e) {}
    var posX = Math.round(sw * 0.06), posY = Math.round(sh * 0.14);
    try { w.setPosition(posX, posY); } catch (e0) {}
    try { if (typeof w.setTouchable === "function") w.setTouchable(true); } catch (e1) {}
    TRKW = w; TRKWEB = w.web; TRK_ON = true;
    TRK.lastAct = Date.now();
    // v1.6.3（用户 18:5x：「轨迹地图开了会一直挡屏幕吗？」——是的，旧版只能手动关）：
    //   5 分钟没碰窗口就自己收起（拖窗/切日期算“碰”）；只收悬浮窗，不动定位监测。
    try {
        threads.start(function () {
            while (TRK_ON) {
                sleep(20000);
                if (!TRK_ON) return;
                if (Date.now() - (TRK.lastAct || 0) > 300000) {
                    log("轨迹窗 5 分钟没操作，自动收起");
                    try { trkClose(); } catch (eC0) {}
                    return;
                }
            }
        });
    } catch (eW0) { log("轨迹自动收起线程启动失败：" + eW0); }
    var jsInit = "javascript:initMap(" + JSON.stringify(cfg.key) + "," + JSON.stringify(cfg.sec) + ")";
    try {
        threads.start(function () {
            for (var i = 0; i < 10; i++) {
                sleep(800);
                if (!TRK_ON) return;
                try { onMain(function () { try { TRKWEB.loadUrl(jsInit); } catch (e) {} }); } catch (eI) {}
                if (i === 2 || i === 5) trkRefresh(TRK_DAY);
            }
        });
    } catch (eT) { log("轨迹注入线程启动失败：" + eT); }
    try { w.bToday.on("click", function () { TRK.lastAct = Date.now(); TRK_DAY = 0; trkRefresh(0); }); } catch (eB1) { log("轨迹今天钮绑定失败：" + eB1); }
    try { w.bYest.on("click", function () { TRK.lastAct = Date.now(); TRK_DAY = 1; trkRefresh(1); }); } catch (eB2) { log("轨迹昨天钮绑定失败：" + eB2); }
    // v1.6.4：关窗给三条路：
    //   ①底部「关闭」钮 ②右上角 ✕（2026-10-23 加，替掉原来的长按标题条） ③5 分钟没操作自动收。绑法也改成 on(click)＋click() 双份。
    var doClose = function (why) {
        try { log("轨迹窗：收到关闭（" + why + "）"); trkClose(); } catch (eC) { log("轨迹关闭异常：" + eC); }
    };
    try { w.cls.on("click", function () { doClose("按钮"); }); } catch (eB3) { log("轨迹关闭钮 on(click) 失败：" + eB3); }
    try { if (typeof w.cls.click === "function") w.cls.click(function () { doClose("按钮二"); }); } catch (eB4) { log("轨迹关闭钮 click 失败：" + eB4); }
    // 2026-10-23（主人点单）：「轨迹地图的长按关闭也改成那样」——右上角 ✕，和底部「关闭」同走 trkClose。
    //   双绑定（on(click)＋click()）沿用 cls 老经验：浮窗按钮在某些机型上只有其中一种触发。
    //   【失败表现】点 ✕ 只挪窗不关窗 → 先查这里是不是被 bar 的 touch 监听抢了手势（drag 里 return true）。
    try {
        if (w.xclose) {
            w.xclose.on("click", function () { doClose("右上角✕"); });
            try { if (typeof w.xclose.click === "function") w.xclose.click(function () { doClose("右上角✕2"); }); } catch (eX2) { log("轨迹窗 ✕ 第二绑定失败：" + eX2); }
            log("轨迹窗：右上角 ✕ 已接");
        } else log("轨迹窗：没有 xclose 按钮（浮窗 XML 没建出来？）");
    } catch (eXb) { log("轨迹窗 ✕ 绑定失败：" + eXb); }
    try {
        var dgX = 0, dgY = 0, ox = posX, oy = posY, dgOn = false, dgT = 0, dgMv = false;
        var drag = function (ev) {
            try {
                var a = ev.getAction();
                if (a === 0) { dgOn = true; dgMv = false; dgT = Date.now(); dgX = ev.getRawX(); dgY = ev.getRawY(); ox = posX; oy = posY; TRK.lastAct = Date.now(); }
                else if (a === 2 && dgOn) {
                    var dx = ev.getRawX() - dgX, dy = ev.getRawY() - dgY;
                    if (Math.abs(dx) + Math.abs(dy) > 12) { dgMv = true; posX = Math.round(ox + dx); posY = Math.round(oy + dy); w.setPosition(posX, posY); }
                } else if (a === 1 || a === 3) {
                    /* 2026-10-23 主人点单：长按标题条关窗这条**撤掉**（隐形手势、拖窗时还容易误触），
                       关窗改由右上角 ✕（w.xclose）与底部「关闭」负责。这里只剩拖动结算。 */
                    dgOn = false;
                }
            } catch (eMv) {}
            return true;
        };
        w.bar.on("touch", drag);
        try { if (typeof w.bar.setOnTouchListener === "function") w.bar.setOnTouchListener(function (v, ev) { return drag(ev); }); } catch (eD2) {}
    } catch (eDr) { log("轨迹窗拖动绑定失败：" + eDr); }
    var d0 = trkPayload(TRK_DAY);
    log("轨迹窗已开 " + url + "（" + d0.day + " " + d0.points.length + " 点）");
    return { ok: true, on: true, day: d0.day, points: d0.points.length, stops: d0.stops.length };
}

// v1.1.1（用户 23:28 当场质问「你都说了系统知道，你查系统，别问我呀」）：
// 一句话回答「我现在在跑还是停着 / 今天现在啥情况」——全部用 App 自己的真实数据，不让模型瞎猜或说「我没有监测功能」。
function careLiveText() {
    try {
        ensureWorkMem();
        var t = careMoneyToday(), r = careRestToday(), en = careEnergy();
        var loc = "定位监测没开（面板里能开）";
        if (MEM.work && MEM.work.gps) {
            if (!MEM.work.lastLoc) loc = "定位监测已开，但还没拿到位置（室内或没授权）";
            else {
                var mins = Math.round((Date.now() - MEM.work.lastLoc.t) / 60000);
                loc = (MEM.work.moving ? "在开车" : "停着") + "（" + mins + " 分钟前那次定位判断）";
            }
        }
        // v1.5.9（2026-10-18 14:36 实测：14:35 已记「开工」，问「在跑还是停着」却只答定位状态）——
        // 原因是我上一版把它写在了 GPS 分支**之前**，被 GPS 那段覆盖掉了。现在放在最后，并保留定位信息。
        if (MEM.work && MEM.work.on) {
            var wmins2 = Math.round((Date.now() - (MEM.work.since || Date.now())) / 60000);
            loc = "在跑车中（你 " + wmins2 + " 分钟前说开工）" + (loc ? "；" + loc : "");
        }
        return "现在：" + loc + (function () { try { var _ts = trkStateNow(); return (_ts && _ts.known) ? "；轨迹：" + _ts.text : ""; } catch (e) { return ""; } })() + "；今日收入 " + careYuan(t.inSum) + " 支出 " + careYuan(t.outSum) + " 净 " + careYuan(t.net) +
            (t.day && t.day.hours ? "、在线 " + t.day.hours + " 小时" : "") + (t.day && t.day.orders ? "、" + t.day.orders + " 单" : "") +
            "；已休 " + r.mins + " 分钟" + (r.open ? "（正在计时）" : "") +
            "；精力 " + en.score + "/100（" + en.level + "）" +
            (function () { try { var _pb = carePhoneBrief(); return _pb ? ("；" + _pb) : ""; } catch (ePB) { return ""; } })();    } catch (e) { return "查实时状态出错了：" + e; }
}

function careWorkDigest(msg) {
    try {
        ensureWorkMem();
        var s = String(msg || "");
        if (!/(我在|我是|跑|开).{0,6}(网约车|滴滴|出租车|专车|快车|顺风车)/.test(s)) return false;
        for (var p = 0; p < MONEY_PLATFORMS.length; p++) { if (s.indexOf(MONEY_PLATFORMS[p]) >= 0) MEM.work.platform = MONEY_PLATFORMS[p]; }
        MEM.work.mode = "网约车"; MEM.work.note = s.slice(0, 80); MEM.work.since = MEM.work.since || Date.now();
        saveMem();
        log("工作方式：网约车（" + (MEM.work.platform || "未说平台") + "）");
        return { ok: true, text: "记下了：你在跑" + (MEM.work.platform ? MEM.work.platform : "网约车") + "。以后每天跟我说一句「今天跑了多少、加油花了多少」，我就给你算净收入、时薪、每单多少；跑太久我会提醒你歇。" };
    } catch (e) { return false; }
}

function careAnalysis() {
    try {
        var now = Date.now(), since = now - 7 * 86400000;
        // ① 饮食营养（近 7 天顿数 + 营养塔均值与提醒）
        var dd = MEM.health.diet || [];
        var meals = 0, nutN = 0, sz = 0, ss = 0, sd = 0, sy = 0;
        for (var i = 0; i < dd.length; i++) {
            if (dd[i] && dd[i].t >= since) {
                if (dd[i].nutri) { nutN++; sz += dd[i].nutri.zhu; ss += dd[i].nutri.shu; sd += dd[i].nutri.dan; sy += dd[i].nutri.you; }
            }
        }
        meals = careMealCountIn(since, 0);   // 2026-10-22（㉗）：按餐次去重，不再一条记录算一顿
        var dietLine = "近 7 天记了 " + meals + " 顿";
        if (nutN > 0) {
            var az = sz / nutN, as = ss / nutN, ad = sd / nutN, ay = sy / nutN;
            dietLine += "，拍了 " + nutN + " 顿有营养塔（5 分制）：主食 " + az.toFixed(1) + "、蔬菜 " + as.toFixed(1) + "、蛋白 " + ad.toFixed(1) + "、油脂 " + ay.toFixed(1);
            var tips = [];
            if (as <= 2.5) tips.push("蔬菜偏少");
            if (az >= 3.6) tips.push("主食偏多");
            if (ay >= 3.6) tips.push("油脂偏高");
            if (tips.length) dietLine += "，要注意：" + tips.join("、");
        }
        // ② 作息睡眠（近 7 天凌晨 0-5 点有对话的天数）
        var nightDays = {}, ch = MEM.chat || [];
        for (var j = 0; j < ch.length; j++) {
            if (!ch[j] || ch[j].t < since) continue;
            var dt = new Date(ch[j].t), hh2 = dt.getHours();
            if (hh2 >= 0 && hh2 <= 5) nightDays[dt.getFullYear() + "-" + (dt.getMonth() + 1) + "-" + dt.getDate()] = 1;
        }
        var nightN = 0; for (var k in nightDays) nightN++;
        var nightLine = nightN > 0 ? ("有 " + nightN + " 天凌晨还在活动——熬夜这事，心脏和记性都会记账") : "没抓到凌晨活动，作息不错";
        // ③ 情绪（近 7 天情绪记录）
        var mm = MEM.mood || [], moodN = 0, moodLast = "";
        for (var m2 = 0; m2 < mm.length; m2++) { if (mm[m2] && mm[m2].t >= since) { moodN++; moodLast = mm[m2].m; } }
        var moodLine = moodN > 0 ? ("记录 " + moodN + " 次，最近是「" + moodLast + "」") : "还没有情绪记录";
        // ④ 身体信号（近 7 天健康记事）
        var nn = MEM.health.notes || [], bodyN = 0, bodyList = [];
        for (var b = 0; b < nn.length; b++) { if (nn[b] && nn[b].t >= since) { bodyN++; if (bodyList.length < 3) bodyList.push(String(nn[b].s).slice(0, 18)); } }
        var bodyLine = bodyN > 0 ? ("提到 " + bodyN + " 次：" + bodyList.join("；")) : "没喊过不舒服";
        // ⑤ 元素短板（v0.5.4：统一用 careElemAvg 的「按天合计」口径，别再用「按餐平均 ≤2.2」那套——
        //    两套口径并存会互相打脸：明明按天算够 4 分，短板却列出十项，用户直接懵）
        var elemLine2;
        var eAvg2 = careElemAvg(7);
        if (eAvg2.n > 0) {
            elemLine2 = careElemText(7);
        } else { elemLine2 = "还没有元素数据——吃饭拍一张（或说一句吃了啥）我就会估出 13 项元素"; }
        // ⑥ 身体指标（最新 + 趋势）
        var mt = MEM.health.metrics || [];
        var lastBy = {}, prevBy = {};
        for (var mi2 = 0; mi2 < mt.length; mi2++) {
            var mrec = mt[mi2]; if (!mrec || !mrec.k) continue;
            if (lastBy[mrec.k]) prevBy[mrec.k] = lastBy[mrec.k];
            lastBy[mrec.k] = mrec;
        }
        var mL = [];
        for (var mk in lastBy) {
            var lv = lastBy[mk], pv = prevBy[mk], arrow = "";
            if (pv && typeof lv.v === "number" && typeof pv.v === "number") arrow = lv.v > pv.v ? "↑" : (lv.v < pv.v ? "↓" : "→");
            mL.push(mk + " " + lv.v + (lv.unit || "") + (arrow ? "（" + arrow + "）" : ""));
        }
        var metricLine = mL.length ? mL.join("、") : "还没有——量了跟我说数字就行（体重/血压/心率/血氧/血糖/体温…）";
        var rep = "【人体全元素·近 7 天】\n🍚 饮食营养：" + dietLine + "\n🧪 营养元素：" + elemLine2 + "\n🌙 作息睡眠：" + nightLine + "\n💭 情绪状态：" + moodLine + "\n🩺 身体信号：" + bodyLine + "\n📏 身体指标：" + metricLine;
        // v0.6.0：跑网约车视角——把「挣了多少 / 歇了多久 / 还剩多少精力」也摊开说
        var moneyLine = "";
        try { moneyLine = careMoneyTodayText(); } catch (eM) { moneyLine = "还没记账"; }
        var energyLine = "";
        try { energyLine = careEnergyText(); } catch (eEn) { energyLine = "算不出来"; }
        rep += "\n💰 挣钱与作息：" + moneyLine + (MEM.work && MEM.work.platform ? "（平台：" + MEM.work.platform + "）" : "") + "\n⚡ 精力与休息：" + energyLine;
        return { ok: true, text: rep };
    } catch (e) { return { ok: false, msg: String(e) }; }
}
// ===== v0.5.0（v2+v3）屏幕时长 + 周报 + 趋势主动问询（2026-10-17 用户点单）=====
// 口径：数据全本地；屏幕时长双通道——①系统 UsageStats（需「使用情况访问」授权，精确）②自采样兜底（每 60s 判亮屏累计，进程活着时近似；被杀/深度休眠期间不计）
// 周报：每周日 20 点后自动小结一次（面板可关 MEM.health.weekly.on），含与上周对比（v3 趋势）；主动问询：趋势异常才开口（安静策略照管、48h 去重）
var SCR = { d: "", min: 0, lastTs: 0, on: false };
function careDayKey(ms) { var d = new Date(ms); return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate(); }
function careDayStart(key) { var p = String(key).split("-"); return new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10)).getTime(); }
function careUsagePermOk() {
    try {
        var ao = context.getSystemService(context.APP_OPS_SERVICE);
        var m = ao.checkOpNoThrow(android.app.AppOpsManager.OPSTR_GET_USAGE_STATS, android.os.Process.myUid(), context.getPackageName());
        return m === android.app.AppOpsManager.MODE_ALLOWED;
    } catch (e) { return false; }
}
function careUsageTodayMin(now) {
    // 系统精确口径：今日亮屏总时长（SCREEN_INTERACTIVE(15)→SCREEN_NON_INTERACTIVE(16) 配对求和）；无权限/异常回 -1
    try {
        now = now || Date.now();
        var usm = context.getSystemService(context.USAGE_STATS_SERVICE);
        if (!usm) return -1;
        var d = new Date(now);
        var start = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
        var evs = usm.queryEvents(start, now);
        if (!evs) return -1;
        var e = new android.app.usage.UsageEvents.Event();
        var T_ON = 15, T_OFF = 16;
        try { T_ON = android.app.usage.UsageEvents.Event.SCREEN_INTERACTIVE; T_OFF = android.app.usage.UsageEvents.Event.SCREEN_NON_INTERACTIVE; } catch (e0) {}
        var on = false, st0 = 0, total = 0;
        while (evs.hasNextEvent()) {
            evs.getNextEvent(e);
            var t = e.getEventType();
            if (t === T_ON && !on) { on = true; st0 = e.getTimeStamp(); }
            else if (t === T_OFF && on) { total += e.getTimeStamp() - st0; on = false; }
        }
        if (on) total += now - st0;
        var min = Math.round(total / 60000);
        return (min < 0 || min > 1440) ? -1 : min;
    } catch (e2) { return -1; }
}
function careScreenSample(now, screenOn) {
    // 纯逻辑（单测直测）：更新自采样累计，返回今日累计分钟（前后两次都亮屏的间隔才计入）
    now = now || Date.now();
    var dk = careDayKey(now);
    if (SCR.d !== dk) { SCR.d = dk; SCR.min = 0; SCR.lastTs = 0; }
    if (SCR.lastTs && SCR.on && screenOn && now > SCR.lastTs) SCR.min += Math.min(5, (now - SCR.lastTs) / 60000);   // 单次最多记 5 分钟（睡死唤醒不补账）
    try { scrSpanNote(now, !!screenOn); } catch (eSP0) {}   // 2026-10-21：另存一份「亮屏时段」（答「我昨晚手机用到几点」用）
    SCR.lastTs = now; SCR.on = !!screenOn;
    return Math.round(SCR.min);
}
// ===== 2026-10-21（用户报「我凌晨明明用了好几个小时手机，它说我 00:29 后没动手机」）=====
// 【根因】轨迹只管**位置**：人在车上没挪窝，GPS 就一条直线停着；但手机可能一直在用。
//   旧代码拿「位置停着」去推「手机没动/人睡了」，这是把两回事混成一件事。
// 【做法】采样亮屏时顺手记时间段（相邻两段间隔 ≤2 分钟就并成一段），落盘跟屏幕时长同一条 2 分钟线程；
//   只回答「手机什么时候在用」，不参与任何健康判断、也不自己说「你睡了」。
var SCRSPAN = { key: "", list: [] };
function scrSpanNote(now, on) {
    var dk = careDayKey(now);
    if (SCRSPAN.key !== dk) { SCRSPAN.key = dk; SCRSPAN.list = (((MEM.health || {}).spans || {})[dk] || []).slice(); }
    if (!on) return;
    var L = SCRSPAN.list, last = L.length ? L[L.length - 1] : null;
    if (last && now - last[1] <= 120000) last[1] = now;
    else L.push([now, now]);
    while (L.length > 240) L.shift();
    MEM.health = MEM.health || {};
    MEM.health.spans = MEM.health.spans || {};
    MEM.health.spans[dk] = L;
}
// 读回来（重启后 SCRSPAN 从已落盘的继续接）
function scrSpanLoad() {
    try {
        var dk = careDayKey(Date.now());
        SCRSPAN.key = dk;
        SCRSPAN.list = (((MEM.health || {}).spans || {})[dk] || []).slice();
    } catch (e) {}
}
// 某一天里的亮屏时段（按时段字符串输出，供工具/分析包用）
function carePhoneSpans(dayOffset) {
    var day = careDayKey(Date.now() - (dayOffset || 0) * 86400000);
    var L = ((MEM.health || {}).spans || {})[day] || [];
    var out = [], i;
    for (i = 0; i < L.length; i++) {
        var s = L[i] && L[i][0], e = L[i] && L[i][1];
        if (!s || !e || e < s) continue;
        var mins = Math.round((e - s) / 60000);
        if (mins < 2) continue;                       // 一两分钟的零碎不算「在用」
        out.push({ s: s, e: e, mins: mins });
    }
    return { day: day, spans: out, totalMin: out.reduce(function (a, x) { return a + x.mins; }, 0) };
}
// 一句话摘要给 read_live 用：今天/昨天手机亮屏多久、昨晚用到几点（口径：亮屏＝在用，与轨迹无关）
function carePhoneBrief() {
    var t = carePhoneSpans(0), y = carePhoneSpans(1);
    if (!t.totalMin && !y.totalMin) return "";
    var yN = 0, last = 0, i, d0y = careDayStart(y.day);
    for (i = 0; i < y.spans.length; i++) {
        yN += careNightMin(y.spans[i].s, y.spans[i].e);
        if (y.spans[i].s < d0y + 6 * 3600000 && y.spans[i].e > last) last = y.spans[i].e;
    }
    return "手机亮屏：今天 " + t.totalMin + " 分钟；昨天 " + y.totalMin + " 分钟"
        + (yN ? ("（0–5 点 " + yN + " 分钟" + (last ? "，用到 " + hhmm(last) : "") + "）") : "");
}
// 一段亮屏时间里落在「每天 00:00–05:59」的分钟数（跨零点也按两个自然日分别算）
function careNightMin(s, e) {
    var n = 0, d0 = careDayStart(careDayKey(s)), last = careDayStart(careDayKey(e));
    for (; d0 <= last; d0 += 86400000) {
        var a = Math.max(s, d0), b = Math.min(e, d0 + 6 * 3600000);
        if (b > a) n += Math.round((b - a) / 60000);
    }
    return n;
}
function carePhoneUsageText(dayArg) {
    var off = 0, dv = String(dayArg || "today").trim();
    if (dv === "yesterday") off = 1;
    else if (/^\d+$/.test(dv)) off = Math.min(7, Math.max(0, parseInt(dv, 10)));
    var r = carePhoneSpans(off);
    if (!r.spans.length) return r.day + "：没记到手机亮屏时段（可能那时 App 没在跑，或没授权后台运行）";
    var arr = [], night = 0;
    for (var i = 0; i < r.spans.length && i < 14; i++) {
        var sp = r.spans[i];
        arr.push(hhmm(sp.s) + "-" + hhmm(sp.e) + "（" + sp.mins + " 分钟）");
        night += careNightMin(sp.s, sp.e);
    }
    return r.day + "：手机亮屏约 " + r.totalMin + " 分钟，其中 0–5 点约 " + night + " 分钟；时段：" + arr.join("、") +
        (r.spans.length > 14 ? " 等" : "") + "\n（口径：这是手机在用；位置轨迹是另一回事——车停着也可以一直在玩手机）";
}
function careScreenPersist() {
    // 每 10 分钟随健康节拍落盘（不每分钟写文件）；只留最近 14 天
    try {
        MEM.health.screen = MEM.health.screen || {};
        var dk = SCR.d || careDayKey(Date.now());
        MEM.health.screen[dk] = Math.round(SCR.min);
        // 2026-10-21：亮屏时段也一并落盘（只留最近 3 天，够答「昨晚用到几点」就行）
        try {
            MEM.health.spans = MEM.health.spans || {};
            if (SCRSPAN.key) MEM.health.spans[SCRSPAN.key] = SCRSPAN.list;
            var ks2 = [];
            for (var k2 in MEM.health.spans) ks2.push(k2);
            ks2.sort();
            while (ks2.length > 3) { delete MEM.health.spans[ks2[0]]; ks2.shift(); }
        } catch (eSP3) {}
        var ks = [];
        for (var k in MEM.health.screen) ks.push(k);
        ks.sort();
        while (ks.length > 14) { delete MEM.health.screen[ks[0]]; ks.shift(); }
        saveMem();
    } catch (e) {}
}
// 【2026-10-19 ccode·「休息时用手机几小时」记不到】两条病：
//   ①落盘太稀：旧版 10 分钟才随健康节拍写一次 MEM（careScreenPersist 挂在 sleep(600000) 那条线程上），
//     App 一旦被杀/重装，没落盘的累计全丢——实测信标 02:45→03:49 整 64 分钟没进程，
//     结果今天记 0 分钟、昨天 40 分钟，跟实际几小时差得远。
//   ②没有当场提醒：原来只有「昨天日均≥8 小时」且只在 8–22 点判断（次日汇总），
//     所以他连着刷几小时，当天没人吭声。
// 处理：屏幕节拍拆成独立 2 分钟一条（落盘 + 连续亮屏判定），判定只看客观状态（亮屏连续时长），
// 到 90 分钟说一句、之后每满 1 小时再说一次；安静策略（勿扰/声音开关）照管，不硬闯。
var SCRLONG = { s: 0, step: 0, lastAt: 0 };
function careScreenLongTick() {
    try {
        var now = Date.now();
        var on = true;
        try { on = !!device.isScreenOn(); } catch (e) { on = true; }
        if (!on) { SCRLONG.s = 0; SCRLONG.step = 0; return; }   // 熄屏＝断档，重新计
        if (!SCRLONG.s) SCRLONG.s = now;
        var mins = (now - SCRLONG.s) / 60000;
        var step = Math.floor(mins / 60);
        if (mins >= 90 && SCRLONG.step !== step && now - (SCRLONG.lastAt || 0) > 50 * 60000) {
            SCRLONG.step = step; SCRLONG.lastAt = now;
            var msg = "盯着屏幕 " + (Math.round(mins / 6) / 10) + " 小时了，眼睛该歇一歇——抬头看看远处，闭眼 20 秒也算";
            try { presentSay(curChar(), msg, "盯屏 " + Math.round(mins) + " 分钟了，歇会儿眼睛", "concern", ST.soundOn && !CARECORE.inDnd(QCFG, nowMinOf(now))); } catch (eR) {}
            log("连续亮屏提醒：" + Math.round(mins) + " 分钟");
        }
    } catch (e) {}
}
// ===== v2.2.0（2026-10-19 ccode·用户点单）每日一策：吃 / 身体 / 挣钱，三合一 =====
// 【先写清楚边界，免得以后又变成写死话术】
//   ① 数据只从 App 自己的记录来（账本 / 饮食 / 元素 / 休息 / 精力 / 屏幕 / 里程 / 指标），
//     一个数都不许模型自己编——喂给它的就是这些真数；
//   ② **怎么分析交给模型**：App 只负责「喂准数据 + 说清禁区」，绝不写「多吃青菜少跑夜班」这类判据
//     （用户 10-17/10-18 反复强调过：AI 产品不许用写死判据替代判断）；
//   ③ 只出今天能做的 3–5 条，不写大道理；引不出数字就不许说数字（沿用主脚本的「证据硬门槛」）。
function carePlanMoneyBy(arr) {
    // 纯函数（可单测）：账本条目 → 按天的 收/支/净 + 支出分类
    var by = {}, i, a = arr || [];
    for (i = 0; i < a.length; i++) {
        var e = a[i];
        if (!e || typeof e.amt !== "number" || !e.amt) continue;
        var dk = careDayKey(e.t || 0);
        var r = by[dk] || (by[dk] = { inSum: 0, outSum: 0, n: 0, cats: {} });
        if (e.kind === "in") r.inSum += e.amt;
        else { r.outSum += e.amt; if (e.cat) r.cats[e.cat] = (r.cats[e.cat] || 0) + e.amt; }
        r.n++;
    }
    return by;
}
// 主人自己说过的「每天净收入」——从事实里取数（数据管道，不是判据：他说的数就是准的）。
// 为什么要它：账本里的支出常记不全（车租/充电/吃饭只记了一部分），账面净会虚高，
// 模型按虚高的数给饭钱，就会出现「净收入 30 块、饭钱报 41 块」这种事（用户 10-19 当面指出）。
// 2026-10-21（用户当面点破「我是租的车，租车哪些费用不用我管它都不知道」）：
//   预判包原来只认事实的 {k:...} 形态，而 App 的事实实际存的是 {t, text}（factAdd 写的就是 text）——
//   预判的【他的固定情况】**永远是空的**，模型当然不知道车是租的、颈椎病这些事，只能按「自己有车」瞎推。
//   这里统一成一句话，两个包（每日一策 / 长期预判）共用；字符串 / {k} / {text} 三种历史形态都认。
function careFactsBrief(n) {
    var F = MEM.facts || {}, fx = [], i, fo, s;
    n = Number(n) > 0 ? Number(n) : 8;
    if (Object.prototype.toString.call(F) === "[object Array]") {
        for (i = 0; i < F.length && fx.length < n; i++) {
            fo = F[i]; if (!fo) continue;
            s = typeof fo === "string" ? fo : (fo.k || fo.text || "");
            if (s) fx.push(String(s));
        }
    } else {
        for (var fk in F) { if (!fk || fx.length >= n) continue; fx.push(fk + "：" + String(F[fk]).slice(0, 30)); }
    }
    return fx.length ? "【他的固定情况】" + fx.join("；") : "";
}
function careStatedNet() {
    try {
        var F = MEM.facts || [], i, s, m;
        for (i = 0; i < F.length; i++) {
            s = typeof F[i] === "string" ? F[i] : ((F[i] && (F[i].k || F[i].text)) || "");
            if (!s || s.indexOf("净收入") < 0) continue;
            m = String(s).match(/净收入[^0-9]{0,6}(\d+(?:\.\d+)?)/);
            if (m) return Number(m[1]);
        }
    } catch (e) {}
    return 0;
}
function carePlanPacket(kind) {
    var L = [], by = carePlanMoneyBy(MEM.money || []), keys = [], dk, i, r;
    for (dk in by) keys.push(dk);
    keys.sort();
    var last = keys.slice(-8);                       // 含今天在内最近 8 个有账的日子
    L.push("【账本】");
    if (!last.length) L.push("· 还没记过账");
    for (i = 0; i < last.length; i++) {
        dk = last[i]; r = by[dk];
        var w = (MEM.work && MEM.work.days && MEM.work.days[dk]) || {};
        var net = r.inSum - r.outSum;
        var s = "· " + dk + "：收 " + r.inSum.toFixed(2) + " / 支 " + r.outSum.toFixed(2) + " / 净 " + net.toFixed(2);
        if (w.hours) s += "，在线 " + w.hours + " 小时（时薪 " + (net / w.hours).toFixed(1) + " 元）";
        if (w.orders) s += "，" + w.orders + " 单（每单 " + (r.inSum / w.orders).toFixed(1) + " 元）";
        L.push(s);
    }
    // 【2026-10-19 用户当面纠正「净收入才 30 块，预算还是那么多」】——旧包只给流水收入，
    // 模型拿「日均一百六」当消费上限，饭钱当然报得离谱。这里把**净收入**单独摆出来：
    // 净＝收−支（扣掉车租/充电/吃饭之后的钱），并明确告诉模型「能花的只有净」。
    if (last.length) {
        var sumIn = 0, sumOut = 0, nDay = 0;
        for (i = 0; i < last.length; i++) {
            var rx = by[last[i]];
            if (!rx.n) continue;
            sumIn += rx.inSum; sumOut += rx.outSum; nDay++;
        }
        if (nDay) {
            var stated = careStatedNet();
            L.push("· 近 " + nDay + " 天：日均流水 " + (sumIn / nDay).toFixed(1) + " 元、账面日均净 "
                + ((sumIn - sumOut) / nDay).toFixed(1) + " 元（净＝收−支；账面净常因**支出没记全**而虚高）");
            if (stated > 0) {
                L.push("· 他自己说过：每天净收入约 " + stated + " 元——**预算只能按这个数算**，"
                    + "账面净高于它时以他说的为准（差额说明支出漏记，别拿虚高的数给消费建议）");
            }
        }
    }
    var cats = {}, c;
    for (i = 0; i < last.length; i++) { var rr = by[last[i]]; for (c in rr.cats) cats[c] = (cats[c] || 0) + rr.cats[c]; }
    var ck = []; for (c in cats) ck.push(c);
    ck.sort(function (a, b) { return cats[b] - cats[a]; });
    if (ck.length) {
        var ps = [];
        for (i = 0; i < ck.length && i < 4; i++) {
            // 分类名是记账时自动切的，常带括号尾巴（如「车租日均摊（2200元/」）——喂给模型前削干净，免得它按残词理解
            var cn = String(ck[i]).replace(/[（(].*$/, "").replace(/[\/／].*$/, "").trim().slice(0, 8) || "其他";
            ps.push(cn + " " + Math.round(cats[ck[i]]) + " 元");
        }
        L.push("· 近几天支出大头：" + ps.join("、"));
    }
    try {
        var t = careMoneyToday();
        L.push("· 今天到现在：收 " + t.inSum.toFixed(2) + " / 支 " + t.outSum.toFixed(2) + " / 净 " + t.net.toFixed(2)
            + (t.day.hours ? "，在线 " + t.day.hours + " 小时" : "") + (t.day.orders ? "，" + t.day.orders + " 单" : ""));
    } catch (e0) {}
    L.push("【吃喝】");
    var dd = (MEM.health && MEM.health.diet) || [];
    if (!dd.length) L.push("· 还没有吃饭记录（拍一张或说一句吃了啥才有得估）");
    for (i = Math.max(0, dd.length - 6); i < dd.length; i++) {
        var d2 = dd[i]; if (!d2) continue;
        var ns = d2.nutri ? ("主" + d2.nutri.zhu + "/蔬" + d2.nutri.shu + "/蛋" + d2.nutri.dan + "/油" + d2.nutri.you + "，各 5 档") : "";
        L.push("· " + careDayKey(d2.t).slice(5) + "：" + String(d2.s || "").slice(0, 40) + (ns ? "（" + ns + "）" : ""));
    }
    try {
        var A = careElemAmounts(3);
        if (A && A.n) {
            var lows = [];
            for (i = 0; i < A.rows.length; i++) if (A.rows[i].low || A.rows[i].weak) lows.push(A.rows[i].name);
            L.push("· 按近 3 天 " + A.n + " 顿估算：明显偏少的是 " + (lows.length ? lows.slice(0, 8).join("、") : "无（都够）"));
        }
    } catch (e1) {}
    L.push("【身体】");
    try { L.push("· 今日休息 " + careRestToday().mins + " 分钟；精力 " + careEnergy().score + " 分"); } catch (e2) {}
    try { L.push("· 今日屏幕约 " + Math.round(SCR.min) + " 分钟（本机自记）"); } catch (e3) {}
    try { var ts = trkSummary(0); if (ts && ts.indexOf("还没记到") < 0) L.push("· 轨迹：" + String(ts).slice(0, 90)); } catch (e4) {}
    try {
        var mt = (MEM.health && MEM.health.metrics) || {};
        var mk = []; for (var k2 in mt) mk.push(k2);
        if (mk.length) {
            var ms = [];
            for (i = 0; i < mk.length && i < 6; i++) {
                var arr2 = mt[mk[i]];
                if (arr2 && arr2.length) ms.push(mk[i] + " " + arr2[arr2.length - 1].v);
            }
            if (ms.length) L.push("· 最近指标：" + ms.join("、"));
        }
    } catch (e5) {}
    try {
        var fl = careFactsBrief(8);
        if (fl) L.push(fl);
    } catch (e6) {}
    // 2026-10-22（用户点单「让关心全知道」）：每日一策也带上「他的全部家当」——
    //   不然它的建议只会围着跑车转，看不见他手上已经做出来的 47 个产品和 9 个 App。
    try { var wbP = careWorldBrief(); if (wbP) L.push(wbP); } catch (eWp) {}
    // v2.3.70：规划要接住他卡着的事（不然又是「多发几单」的模板话）
    try { var mbP = careMindBrief(); if (mbP) L.push(mbP + "\n（写规划时先接住他上面卡着的那件事：今天就能做的一步是什么）"); } catch (eMp) {}
    return L.join("\n");
}
function careAISimple(sys, usr, maxTok) {
    // 单轮、不带工具的一次模型调用（每日一策专用）；只用配置里的对话档，逐档降级，全失败如实返回
    var key = careCfgKey("chat") || loadZKey();
    if (!key) return { ok: false, msg: "没有可用 Key" };
    var models = careCfgList("chat");
    // 2026-10-20（ccode 实测）：上次成功的模型提到最前——pro 在「每日一策」这种长分析上会跑飞
    //   （实测 max_tokens=3000 仍然全烧在思考上：finish_reason=length、content 空），flash 459 个思考 token 就出结果。
    //   自适应排序后，一旦 flash 成功过，以后就不必每天先白等 pro 跑 40 秒再降级。
    //   【命名】不能用 MEM.plan：那是「今日/ 晚间一策的生成状态」对象（673x 处 var P = MEM.plan = …），
    //   写成 MEM.plan={model} 会把当天的计划状态抹掉；这里单独开 MEM.planModelOk / MEM.planModelBad。
    var lastOk = (MEM && MEM.planModelOk) || "";
    var badC = (MEM && MEM.planModelBad) || {};
    // 2026-10-20：上次成功的排第一；「跑飞」累计 ≥2 次的排最后（不再每天先白等 40 秒）；其余保持配置顺序。
    //   判据只用实测事实（finish=length 且 content 空），不写死某个模型名。
    var head = [], mid = [], tail = [], z, mm;
    for (z = 0; z < models.length; z++) {
        mm = models[z];
        if (mm === lastOk) head.push(mm);
        else if (Number(badC[mm] || 0) >= 2) tail.push(mm);
        else mid.push(mm);
    }
    models = head.concat(mid, tail);
    var lastWhy = "", lastNet = false;   // lastNet：“这一轮到底是不是网络层挂的”——每日一策拿它判要不要扣今天的重试次数
    for (var i = 0; i < models.length; i++) {
        // 2026-10-21（ccode 实测·用户报「长期预判历史好像显示出来不完」）：flash 是推理模型，思考先把 max_tokens 吃掉，
        //   content 就被切在半句里——实测 10-21 17:23 只落了 137 字（本该 500–900 字，尾巴断在「（」）、10-20 17:40 只有 262 字；
        //   而 10-19 换模型前的 deepseek-chat 能出 1500–2000 字。旧版只要 content 非空就当成品收下，半句被原样写进历史。
        //   现在：finish_reason=length = 被预算截断 → 同一模型预算翻倍再试一次（上限 8000，只加一次钱），
        //   截断这种事翻倍基本能出全篇，比换模型省钱。注意「思考烧光导致空回复」也走同一条路：空回复但 finish=length 也算截断。
        var budget = maxTok || 800, ct = "", fin = "", rlen = 0, r = null, att, best = { text: "", fin: "", rlen: 0 };
        for (att = 0; att < 2; att++) {
            // 2026-10-21（用户报「点长期预判卡很久还没结果」）：读超时 30 秒对推理模型不够——
            //   实测 19:47 那一枪思考就 11819 字，四枪全 SocketTimeoutException（每枪 30 秒，共 2 分钟）。
            //   现在给 120 秒、最多 2 枪（第二枪只兜 DNS/建连抖动，不在超时上空耗四次）。
            r = httpPostJson(careCfgUrl("chat"),
                { model: models[i], messages: [{ role: "system", content: sys }, { role: "user", content: usr }], temperature: 0.6, max_tokens: budget },
                { "Authorization": "Bearer " + key }, 8000, 120000, 2);
            ct = ""; fin = ""; rlen = 0;
            if (!r.ok) break;      // 网络／Key 层的问题，加预算也救不回来
            // 【2026-10-19 实锤·长文被截断】不能走 CARECORE.parseAIResponse——那是给聊天用的，
            // 它把超过 160 字的回复硬切成「159 字 + …」（口播要短是对的，但分析要整篇）。
            // 用户说「长期预判里没有你说的那些」，真因就是这里：面板只收到 160 字，后面几段全没了。
            try {
                var jj = JSON.parse(String(r.text || ""));
                var ch0 = ((jj || {}).choices || [])[0] || {};
                var msg0 = ch0.message || {};
                ct = String(msg0.content || "").trim();
                fin = String(ch0.finish_reason || "");
                rlen = String(msg0.reasoning_content || "").length;
                if (!ct && jj && jj.error) ct = "";
            } catch (eP2) { ct = ""; }
            // 两次都截断时不能「盲取最后一次」——取长的那篇（多出来的那几段是真的，删了可惜）
            if (ct && ct.length > best.text.length) best = { text: ct, fin: fin, rlen: rlen };
            if (fin === "length" && att === 0 && budget < 8000) {
                log("每日一策：模型 " + models[i] + " 输出被截断（finish=length 思考字数=" + rlen + " 正文=" + ct.length + " 字）→ 预算 " + budget + " 升到 " + Math.min(budget * 2, 8000) + " 再试一次");
                budget = Math.min(budget * 2, 8000);
                continue;
            }
            break;
        }
        if (!r || !r.ok) {
            lastWhy = String((r && r.msg) || "");
            if (/UnknownHost|Unable to resolve|Network is unreachable|No route|ConnectException|SocketTimeout|timed out/i.test(lastWhy)) lastNet = true;
            log("每日一策：模型 " + models[i] + " 不可用 " + lastWhy.slice(0, 40));
            continue;
        }
        if (best.text) {
            try { MEM.planModelOk = models[i]; MEM.planModelBad && (MEM.planModelBad[models[i]] = 0); saveMem(); } catch (ePM) {}
            if (best.fin === "length") log("每日一策：模型 " + models[i] + " 升到 8000 仍被截断（正文 " + best.text.length + " 字／思考 " + best.rlen + " 字）——先按现有正文用，下次再看要不要提");
            return { ok: true, text: best.text, model: models[i], fin: best.fin, len: best.text.length };
        }
        if (fin === "length") {   // 思考把预算烧光（不是解析问题）→ 记一笔，同一模型累计 2 次就排到最后
            try { MEM.planModelBad = MEM.planModelBad || {}; MEM.planModelBad[models[i]] = Number(MEM.planModelBad[models[i]] || 0) + 1; saveMem(); } catch (ePB) {}
        }
        log("每日一策：模型 " + models[i] + " 回空或解析失败（finish=" + (fin || "?") + " 思考字数=" + rlen + "）" + String(r.text || "").slice(0, 60));
    }
    return { ok: false, msg: "模型都没接上", net: lastNet, why: lastWhy };
}
// 每次生成的分析都留档（用户 2026-10-19：「所有的信息都要有历史纪录，我随时能查看」）。
// 只存结果文本与时间，不存喂给模型的数据包（包里有账本明细，重复存会把记忆文件撑大）。
function careLogPush(kind, text, model) {
    try {
        MEM.logs = MEM.logs || [];
        MEM.logs.push({ t: Date.now(), kind: kind, text: String(text || "").slice(0, 4000), model: model || "" });
        // 2026-10-21：60 → 120。用户早就说过「所有信息都要有历史纪录，随时能查看」，而预判每周一次、
        //   夹在每天两条一策里，60 条大约两个多星期就把老的预判挤掉了。
        while (MEM.logs.length > 120) MEM.logs.shift();
        saveMem();
    } catch (e) {}
}
function careLogList(kind) {
    try {
        var a = MEM.logs || [], out = [], i;
        for (i = a.length - 1; i >= 0 && out.length < 40; i--) {   // 2026-10-21：20 → 40（配合留档 120 条，历史能往前翻得更远）
            if (!a[i]) continue;
            if (kind && a[i].kind !== kind) continue;
            out.push(a[i]);
        }
        return out;
    } catch (e) { return []; }
}
function carePlanBuild(kind) {
    var packet = carePlanPacket(kind);
    var sys = "你是他的私人管家兼跑车教练。你只依据下面这份 App 的真实记录给建议："
        + "记录里没有的数字一个都不许出现，不许编收入、单量、营养值、体重。"
        + "【租车常识】先看【他的固定情况】里有没有「车是租的」这类事实：是租的 → 租金是合同定死的固定支出，不是能压的变动成本（省钱只能落在充电、空驶、吃饭上）；车辆本身的保险、保养、维修、年检、折旧由租车公司负责，不是他的开销，不许叫他买、也不许算进他的预算。"
        + "【钱的口径·最容易错的一条】能花的钱只有**净收入**（收−支），不许拿「流水收入」当消费能力。"
        + "吃饭那条必须先按**他自己说过的净收入**算今天能花的饭钱总额，再给具体价位与品类；"
        + "他说过「每天净收入约 X 元」时，一天饭钱总额不能超过 X 的 1/2（X=30 就是一天 15 元以内、一顿 5–8 元），"
        + "绝对不许拿账面那个虚高的净收入算（账本支出常记不全，账面净会偏高好几倍）；"
        + "如果【他的固定情况】里没写净收入，才退回用账面净，并且在回答里点明「账面支出可能没记全」。"
        + "输出规矩：3–5 条，每条一行、动词开头、今天就能做；至少两条要引用记录里的真实数字；"
        + "必须包含：1 条「今天吃什么」（预算按净收入定，具体到价位与品类）；"
        + "1 条「怎么多挣或少花」（落在时段、单量、成本这类动作上）；"
        + "1 条「怎么把身体养回来」（睡眠、久坐、用眼、吃饭节奏里挑最该管的那一件）。"
        + "语气像熟人说话；不要标题、不要 markdown、不要复述数据、不要免责声明、不要空话。";
    var usr = packet + "\n\n" + (kind === "evening"
        ? "现在收工了：先点出今天最值得改的一处，再给明天怎么调。"
        : "新的一天开始：给今天怎么过。");
    var r = careAISimple(sys, usr, 2600);   // 2026-10-20：900 太小——DeepSeek V4 两个档都是推理模型，实测长分析时 900 会全烧在思考上（finish_reason=length、content 空），flash 也要 459 个思考 token 才出话
    if (!r.ok) return r;
    // 加标题：两种输出长得像，用户看屏幕分不清（2026-10-19「长期预判里没有你说的那些」就是拿今日一策当成了预判）
    var title = (kind === "evening" ? "🌙 今晚复盘" : "📋 今日一策") + "（" + nowStr().slice(5, 16) + "）\n";
    var full = title + r.text;
    var kk = (kind === "evening" ? "plan-evening" : "plan-morning");
    careLogPush(kk, full, r.model);
    log("每日一策生成：" + kk + " 字数 " + full.length + " 模型 " + (r.model || "?"));
    return { ok: true, text: full, packet: packet };
}
function carePlanTick() {
    // 早上 7–10 点一次「今天怎么过」；晚上 21–23 点一次「复盘 + 明天」；各每天只一次。
    // 安静策略（勿扰/声音开关）照管：不出声也照样写进聊天记录，面板能看。
    try {
        var now = Date.now(), hh = new Date(now).getHours(), dk = careDayKey(now);
        var P = MEM.plan = MEM.plan || {};
        var kind = "";
        if (hh >= 7 && hh <= 10 && P.mDay !== dk) kind = "morning";
        else if (hh >= 21 && hh <= 23 && P.eDay !== dk) kind = "evening";
        if (!kind) return;
        // 【2026-10-19 07:09 实锤·网络一抖就整天没有】旧版是「先落『今天已生成』标记、再调模型」，
        // 那次 DNS 解析失败（UnknownHostException ×3）直接把当天标记用掉，于是今天不会再有第二次机会。
        // 改成：失败不算数，最多试 3 次（每 10 分钟节拍一次），成功才落「已生成」——既不丢当天，也不会无限烧钱。
        var tk = (kind === "morning" ? "mTry" : "eTry");
        var st = P[tk] || { d: "", n: 0 };
        if (st.d !== dk) st = { d: dk, n: 0 };
        if (st.n >= 3) { P[tk] = st; return; }
        st.n++; P[tk] = st; saveMem();          // 先记次数（失败也不会无限重试）
        var r = carePlanBuild(kind);
        if (!r.ok) {
            // 2026-10-20 07:07 实锤：手机刚亮屏、网络还没起来，App 连刷 4 枪就白扣一次——三枪扣光，
            //   今天就没有第二次机会了。现在网络层挂的不算数（不扣 st.n），交给下个 10 分钟节拍重来；
            //   节拍本身限了频率，不会因为这条无限重试、也不会多烧钱（连不上根本没发出去请求）。
            if (r.net) {
                st.n = Math.max(0, st.n - 1); P[tk] = st; saveMem();
                log("每日一策：这次是网络没接上（" + String(r.why || r.msg || "").slice(0, 70) + "），不占用今天的重试次数，下个节拍再试");
                return;
            }
            log("每日一策生成失败（" + kind + "，今天第 " + st.n + "/3 次）：" + (r.msg || "") + "——下个 10 分钟节拍再试");
            return;
        }
        if (kind === "morning") P.mDay = dk; else P.eDay = dk;   // 只有成功才落「今天已生成」
        saveMem();
        MEM.chat.push({ t: now, me: kind === "morning" ? "📋 [今日一策]" : "📋 [今晚复盘]", pet: r.text, char: curChar() });
        if (MEM.chat.length > 60) MEM.chat.shift();
        saveMem();
        var short = kind === "morning" ? "今天的安排我写好了，面板点「📋 今日怎么过」看全的" : "今天复盘写好了，面板能看全的";
        try { presentSay(curChar(), short, short, "concern", ST.soundOn && !CARECORE.inDnd(QCFG, nowMinOf(now))); } catch (eS) {}
        log("每日一策：" + kind + " 已生成（模型 " + (r.model || "?") + "）");
    } catch (e) { log("每日一策异常：" + e); }
}
// ===== v2.3.0（2026-10-19 ccode·用户点单）长期预判：照这个走法，接下来最可能出什么 =====
// 【边界同上】App 只算**真实统计量**（逐日数、均线、前后半段对比、0–5 点还活动天数），
//   「哪些是好、哪些是坏、多大概率」全部交给模型判断——代码里不写「连续熬夜≥3 天＝坏事」这类判据
//   （用户 10-17/10-18 反复强调：AI 产品不许用写死判据替代判断）。
function careWindowStats(N) {
    N = N || 14;
    var now = Date.now(), i, j, dk, m, w;
    var keys = [];
    for (i = N - 1; i >= 0; i--) keys.push(careDayKey(now - i * 86400000));
    var by = carePlanMoneyBy(MEM.money || []);
    var dd = (MEM.health && MEM.health.diet) || [];
    var ra = MEM.rest || [];
    var scr = (MEM.health && MEM.health.screen) || {};
    var ch = MEM.chat || [];
    var rows = [];
    for (i = 0; i < keys.length; i++) {
        dk = keys[i]; m = by[dk] || { inSum: 0, outSum: 0, n: 0 };
        w = (MEM.work && MEM.work.days && MEM.work.days[dk]) || {};
        var meals = 0, veg = 0, oil = 0, _dayRecs = [];
        for (j = 0; j < dd.length; j++) {
            if (!dd[j] || careDayKey(dd[j].t) !== dk) continue;
            _dayRecs.push(dd[j]);   // 2026-10-22（㉗）：顿数按餐次去重
            if (dd[j].nutri) { veg += dd[j].nutri.shu || 0; oil += dd[j].nutri.you || 0; }
        }
        meals = careMealSlotCount(_dayRecs);
        var restMin = 0;
        for (j = 0; j < ra.length; j++) {
            if (!ra[j] || !ra[j].s || careDayKey(ra[j].s) !== dk) continue;
            var rdur = (((ra[j].e || now) - ra[j].s) / 60000);
            if (!(rdur > 0)) continue;
            // 现实里会出现「休息没结束就再没管过」的条目（实测 10-18 那条算了 1707 分钟＝28 小时），
            // 直接把一天的数据带跑偏。这里按天封顶 24 小时，超出部分不计（宁可少算，别算成两天半）。
            restMin += Math.round(Math.min(rdur, 1440));
        }
        var night = 0;
        var chk = function (t) {
            if (!t || careDayKey(t) !== dk) return;
            var h = new Date(t).getHours();
            if (h >= 0 && h <= 5) night = 1;
        };
        for (j = 0; j < (MEM.money || []).length; j++) chk(MEM.money[j] && MEM.money[j].t);
        for (j = 0; j < ch.length && j < 40; j++) chk(ch[ch.length - 1 - j] && ch[ch.length - 1 - j].t);
        // 2026-10-21（用户报「我凌晨明明用了几个小时手机，它说我 00:29 后没动」）：
        //   以前「凌晨还在活动」只认聊天/记账时间戳——他不说话只刷视频就记不到。
        //   这里把当天 0–5 点亮屏 ≥10 分钟也算作夜间活动（只是计数，不改任何健康判断）。
        var _sps = ((MEM.health || {}).spans || {})[dk] || [];
        for (j = 0; j < _sps.length; j++) {
            if (!_sps[j] || !_sps[j][0] || !_sps[j][1]) continue;
            var _d0 = careDayStart(dk);
            var _a = Math.max(_sps[j][0], _d0), _b = Math.min(_sps[j][1], _d0 + 6 * 3600000);
            if (_b - _a >= 10 * 60000) night = 1;
        }        rows.push({
            d: dk, inSum: m.inSum, outSum: m.outSum, net: m.inSum - m.outSum,
            hours: w.hours || 0, orders: w.orders || 0,
            meals: meals, veg: meals ? veg / meals : 0, oil: meals ? oil / meals : 0,
            restMin: restMin, screenMin: Number(scr[dk]) || 0, night: night, has: m.n > 0
        });
    }
    function agg(list) {
        var a = { n: 0, net: 0, inSum: 0, hours: 0, orders: 0, veg: 0, vegN: 0, rest: 0, screen: 0, night: 0, dN: 0 };
        for (var x = 0; x < list.length; x++) {
            var r = list[x];
            if (r.has) { a.n++; a.net += r.net; a.inSum += r.inSum; }
            if (r.hours) a.hours += r.hours;
            if (r.orders) a.orders += r.orders;
            if (r.meals) { a.veg += r.veg; a.vegN++; }
            // 「有数据的天」才算分母：否则 14 天窗口里只有 3 天有记录时，日均屏幕会被摊成 4 分钟（实际 21/40 分），
            // 模型据此判断就会偏。
            if (r.has || r.hours || r.meals || r.restMin || r.screenMin) a.dN++;
            a.rest += r.restMin; a.screen += r.screenMin; a.night += r.night;
        }
        a.netAvg = a.n ? a.net / a.n : 0;
        a.inAvg = a.n ? a.inSum / a.n : 0;
        a.hourAvg = a.hours / list.length;
        a.wage = a.hours ? a.net / a.hours : 0;
        a.vegAvg = a.vegN ? a.veg / a.vegN : 0;
        a.restAvg = a.rest / (a.dN || 1);
        a.screenAvg = a.screen / (a.dN || 1);
        return a;
    }
    var half = Math.floor(rows.length / 2);
    var res = { days: N, rows: rows, all: agg(rows), prev: agg(rows.slice(0, half)), cur: agg(rows.slice(half)) };
    return res;
}
// 2026-10-21（用户点单「它全网获取新东西给我出主意能不能弄」）：智谱 web_search 工具，一次一搜。
//   便宜档 glm-4-flash + 搜索工具（实测可用、返回带来源的要点）；没 key/没网就如实说搜不到，不许编。
function careWebSearch(query, count) {
    try {
        var q = String(query || "").trim().slice(0, 80);
        if (!q) return { ok: false, msg: "空查询" };
        var key = (typeof ZKEY !== "undefined" && ZKEY) ? String(ZKEY) : "";
        if (!key) { try { var jk = JSON.parse(readText(BASE + "/雷达密钥.json")); if (jk && jk.zp_keys && jk.zp_keys[0]) key = String(jk.zp_keys[0]); } catch (eK) {} }
        if (!key) return { ok: false, msg: "没有可用的搜索 key" };
        var body = {
            model: "glm-4-flash",
            messages: [{ role: "user", content: "请检索并给出 3–5 条要点，每条都要带来源标题（不要编造）：" + q }],
            tools: [{ type: "web_search", web_search: { search_query: q, count: Math.min(8, Math.max(3, Number(count) || 5)) } }]
        };
        var r = httpPostJson("https://open.bigmodel.cn/api/paas/v4/chat/completions", body, { "Authorization": "Bearer " + key }, 8000, 60000, 2);
        if (!r || !r.ok) return { ok: false, msg: String((r && r.msg) || "网络没接上") };
        var jj = null; try { jj = JSON.parse(String(r.text || "")); } catch (eP) { jj = null; }
        var c = ((jj || {}).choices || [])[0] || {};
        var txt = String((c.message || {}).content || "").trim();
        if (!txt) return { ok: false, msg: "搜索没返回内容" };
        return { ok: true, text: txt.slice(0, 1400), query: q };
    } catch (e) { return { ok: false, msg: String(e) }; }
}
function careForecastPacket(N) {
    var S = careWindowStats(N || 14), L = [], i, r;
    L.push("【近 " + S.days + " 天逐日】（净＝收−支；工时/单量为他自己报的）");
    for (i = 0; i < S.rows.length; i++) {
        r = S.rows[i];
        if (!r.has && !r.hours && !r.meals && !r.restMin && !r.screenMin) continue;
        var s = "· " + r.d.slice(5) + "：净 " + r.net.toFixed(1);
        if (r.inSum) s += "（流水 " + r.inSum.toFixed(1) + "）";
        if (r.hours) s += "／" + r.hours + " 小时" + (r.orders ? "·" + r.orders + " 单" : "");
        if (r.meals) s += "／吃 " + r.meals + " 顿·菜档 " + r.veg.toFixed(1);
        if (r.restMin) s += "／歇 " + r.restMin + " 分";
        if (r.screenMin) s += "／屏 " + r.screenMin + " 分";
        if (r.night) s += "／凌晨还在动";
        L.push(s);
    }
    var A = S.all, stated = careStatedNet();
    L.push("【汇总】有账 " + A.n + " 天：账面日均净 " + A.netAvg.toFixed(1) + " 元、日均流水 " + A.inAvg.toFixed(1)
        + "；日均工时 " + A.hourAvg.toFixed(1) + " 小时（时薪 " + A.wage.toFixed(1) + " 元）"
        + "；菜档均值 " + A.vegAvg.toFixed(1) + "/5；日均休息 " + Math.round(A.restAvg) + " 分；日均屏幕 " + Math.round(A.screenAvg)
        + " 分；0–5 点还活动 " + A.night + " 天");
    if (stated > 0) {
        L.push("【收入口径】他自己说过：每天净收入约 " + stated + " 元。账面日均净 " + A.netAvg.toFixed(1)
            + " 元偏高＝支出没记全，风险与预算**一律按 " + stated + " 元**来判。");
    }
    function cmp(name, a, b, unit) {
        var d = b - a, arrow = (Math.abs(a) < 1e-6 && Math.abs(b) < 1e-6) ? "—" : (d > 0 ? "↑" : (d < 0 ? "↓" : "→"));
        return name + " " + a.toFixed(1) + " → " + b.toFixed(1) + unit + " " + arrow;
    }
    L.push("【趋势】前 " + Math.floor(S.rows.length / 2) + " 天 vs 后 " + Math.ceil(S.rows.length / 2) + " 天："
        + cmp("日均净", S.prev.netAvg, S.cur.netAvg, " 元") + "；"
        + cmp("日均屏幕", S.prev.screenAvg, S.cur.screenAvg, " 分") + "；"
        + cmp("日均休息", S.prev.restAvg, S.cur.restAvg, " 分") + "；"
        + cmp("菜档", S.prev.vegAvg, S.cur.vegAvg, "/5"));
    // 2026-10-21（用户点单「全网获取新东西给我出主意」）：每周预判顺手搜一次近期新机会，失败就当没有
    try {
        var _mth = new Date().getMonth() + 1;
        var _wr = careWebSearch("网约车司机 副业 增收 补贴 新政策 " + _mth + "月", 5);
        if (_wr.ok) L.push("【网上近期消息·搜来的，可能过时】\n" + _wr.text);
        else L.push("【网上近期消息】这次没搜到（" + String(_wr.msg || "").slice(0, 30) + "）——别编网上的新闻，只用记录里的数据。");
    } catch (eWS) {}
    try {
        var fl = careFactsBrief(8);
        if (fl) L.push(fl);
    } catch (e) {}
    // 2026-10-22（用户点单「让关心全知道」）：预判也必须知道他手上有什么——
    //   否则【增收规划】只会写跑车、外卖、摆摊，完全看不见他已经做出来的 47 个产品和 9 个 App。
    //   只给事实、给口径，不给结论：能不能变现由模型按他的时间/本金判，绝不编收益数字。
    try {
        var wbF = careWorldBrief();
        if (wbF) L.push(wbF + "\n（【增收规划】必须把这份家当算进去：这些是他已经做出来的东西，能不能变现、要投多少时间与钱由他定；"
            + "你只给具体动作、启动成本与占用时间，收益一律只能是区间并标估算，绝不许编比例或承诺挣多少）");
    } catch (eWf) {}
    // v2.3.70：预判也要知道他卡在哪（否则规划全是新机会、没人管他正卡着的事）
    try { var mbF = careMindBrief(); if (mbF) L.push(mbF + "\n（【长期建议】先给他一条能解开当前卡点的动作，再谈别的机会）"); } catch (eMf) {}
    return L.join("\n");
}
function careForecastBuild(days) {
    var packet = careForecastPacket(days || 14);
    var sys = "你是他的长期顾问（跑车司机，净收入很低，账本支出常记不全）。下面是他 App 里真实的逐日记录。\n"
        + "请给一份**能照着做**的长期分析。分段写，段内一条一行，每条都要带数字或具体动作：\n"
        + "【一·最可能出的坏事】3 条。每条写四段：会怎么出现 → 最早信号（具体到哪天能看到哪个数变了） → 今天就能做的一件小事 → 止损线（数到什么程度就该停）。\n"
        + "【二·最可能变好的事】3 条。每条写：触发条件 → 怎么做 → 大概能带来什么（用记录里的数推，不许编百分比）。\n"
        + "【三·增收规划】分三层写，每层 2 条，每条都要给具体数字或动作：\n"
        + "  短期（本周就能动手）：跑车本身的时段/单量怎么调，或者一条今天就能试的小活儿；成本里能压的只有充电/空驶/吃饭这类变动支出（按【他的固定情况】判）。\n"
        + "  中期（1–3 个月）：除了跑车还能靠什么多挣（用他的空闲时段、会的事、手上的东西），写清启动成本、每天要花多少时间、大概多挣多少（区间）。\n"
        + "  长期（半年以上）：能攒出复利的那一件（技能/证/稳定客源/小生意），写清第一个月做什么、三个月到什么程度。\n"
        + "  **至少 2 条不许是跑车或纯体力加钟**（他身体已经吃不消）：可以从平台奖励与补贴、同城配送跑腿、闲置物品、"
        + "  会的手艺、拍视频直播、本地小生意、社区服务里挑，挑之前先看他记录里有没有相应的时间与本金。\n"
        + "  每条都写：要花多少钱起步 → 每天占多少时间 → 大概多挣多少（区间，标估算）→ 最坏会亏什么。"
        + "【成本常识】租金是合同定死的固定支出，不许写成「压租金」「把车租省下来」；【他的固定情况】写着车是租的时，车辆保险/保养/维修/年检/折旧由租车公司负责，不算他的成本、不许列进预算。\n"
        + "【四·身体与吃】4 条：睡眠、吃饭节奏、眼睛与久坐、营养缺口（引用菜档与元素短板），每条给一个今天能做的动作。\n"
        + "【五·身体会怎么报警】4 条，照他现在这套作息（熬夜/久坐久驾/菜少油多/长时间看屏）推：\n"
        + "  每条写四段：最可能先出现的身体信号（要具体，例如几点最容易头晕、哪种疼、什么时候心慌） → "
        + "可能和哪些常见问题有关（**只写「可能相关」，不是诊断，不许说「你得了X病」**） → "
        + "到什么程度必须去医院（给可执行门槛：持续几天、出现什么症状、什么情况下别拖） → "
        + "去一趟大概花多少钱（人民币区间，写清是估算：挂号/血常规/肝肾功能/腹部彩超/眼底检查/体检套餐这类项目的常见区间，地区不同会有差异）。\n"
        + "  这一段开头先写一句：这是生活方式层面的提醒，不是诊断；有胸痛、剧烈头痛、黑便、持续高热这类急性症状别等分析，直接去医院。\n"
        + "【六·下周盯这 3 个数】3 条：指标名 + 目标值 + 怎么记（他自己报一句也算）。\n"
        // 2026-10-21（用户点单）：「根据我的情况综合分析，多久可能出现啥坏结果能不能估算、提前多久买啥保险」
        //   所以加第七段：时间用记录里的频次推（不许编百分比），保险按他真实净收入（【收入口径】）算负担。
        //   边界写死：只给险种类别与常见价位区间，不许推荐具体公司/产品、不许承诺赔不赔、不许含诊断。
        + "【七·风险时间线＋保险怎么备】4 条，每条写五段（一项风险一条，不跟前面重复展开）：\n"
        + "  ①会坏在什么事上 → \n"
        + "  ②照他现在这套活法，大概多久会撞上：用记录里的频次与趋势推算（例：一周 3 次凌晨还在动＝一个月里约有 12 次暴露；\n"
        + "     某项指标从 X 掉到 Y 已用了 N 天，照这个速度再 N 天到哪个数），**只许用记录里的频次/天数推，一律给区间（如 2–6 周、3–6 个月），\n"
        + "     绝不许写百分比、概率、分数** → \n"
        + "  ③该提前多久动手（如「现在就开始」「出现第 2 次时就必须办」「不用等」） → \n"
        + "  ④该备什么：按他跑车司机的身份给具体险种类别（车上人员责任险、意外险、百万医疗险、当地惠民保、医保门诊共济这类），\n"
        + "     每样都写清「管什么、不管什么（等待期 / 免赔额 / 既往症通常不赔）」→ \n"
        + "  ④b 在哪买（用户 2026-10-21 点名要这条：光说买啥不够，得说去哪买）：只写**渠道类别**——\n"
        + "     医保走国家医保服务平台 App 或当地医保局/政务服务 App；惠民保走当地「惠民保」官方公众号、\n"
        + "     或支付宝/微信里的城市保入口；商业险走保险公司官方 App/官网、支付宝·微信的保险频道、银行或线下营业厅。\n"
        + "     **不许点名任何保险公司、产品、代理人、链接、电话**；渠道拿不准就写「以当地官方渠道为准」，不许编 → \n"
        + "  ④c 什么时候买、提前多久才有效（这条必须落到能照做的时点，不许只写「尽早买」「越早越好」）：\n"
        + "     分三个写：ⓐ现在买还是等（等到什么条件）；ⓑ生效时点（医保要连续缴到规定月数才报、\n"
        + "     意外险通常次日 0 时才生效、惠民保只有集中投保期才买得到）；ⓒ等待期（医疗险常见 30–90 天，\n"
        + "     等待期内出事通常不赔；既往症多数不赔或按约定比例）→ \n"
        + "  ⑤一年大概多少钱＋值不值：给人民币区间并标「估算、地区有差异」，再用【收入口径】里的净收入算清「相当于他多少天/多少个月收入」；\n"
        + "     然后给**优先级**：先买哪一样、哪样今年可以先不买（写清理由）、哪些是免费或几乎零成本的（医保、平台/单位赠送的意外险）；\n"
        + "     买不起就直说买不起，给替代方案（先攒多少应急金、哪些钱不能省）。\n"
        + "  这一段开头先写一句：这是按记录做的准备建议，不是保险销售、也不是诊断。\n"
        + "  保险只许写通用险种类别＋常见价位区间，不许推荐具体公司或产品名，不许说「一定能赔」「一定不赔」。\n"
        + "  若【他的固定情况】写着车是租的：随车保险（交强险、商业险、车上人员责任险这类跟着车走的）由租车公司投保，不许建议他自己买、也不许算进他的开销；只谈他个人的人身险（意外、医疗、惠民保、体检）。\n"
        + "硬要求：只许用记录里的数字，记录里没有的不许出现、不许编概率百分比；"
        + "凡是提到「净收入／净额」的现状与目标，一律用【收入口径】里他自己说的那个数（例如就是 30 元），"
        + "账面净只能当「流水」或「支出漏记的证据」出现，绝不许拿账面净当他的实际收入或收入目标；"
        + "吃饭的钱按他自己说的净收入算（他说的比账面低就以他为准，并点明支出可能没记全）；"
        + "不要 markdown 星号，不要复述数据，不要说「建议你多注意身体」这类空话。全篇 700–1100 字。";
    var usr = packet + "\n\n请按上面六段的格式写。";
    // 2026-10-21：2600 撑不住这份「六段·500–900 字」的活——flash 是推理模型，思考先把预算吃掉，
    //   实测 10-20/10-21 只出 262/137 字（断在半句），历史面板看着就像「没写完」。起步放到 4000，
    //   眼下多了第七段（风险时间线＋保险），预算再抬一档：5000 起步，仍被截断时由 careAISimple 的升档（→8000）兜住。
    var r = careAISimple(sys, usr, 5000);
    if (!r.ok) return r;
    var title = "📈 长期预判（近 " + (days || 14) + " 天 · " + nowStr().slice(5, 16) + "）\n";
    var full = title + r.text;
    careLogPush("forecast", full, r.model);
    log("长期预判生成：字数 " + r.text.length + " 模型 " + (r.model || "?") + " finish=" + (r.fin || "?"));
    return { ok: true, text: full, packet: packet };
}
// v2.3.4：文件请求桥——ccode/调试可以直接让 App 生成一次分析并拿回原文（不用点屏幕）。
// ===== v2.3.60（2026-10-21 用户点单）保险怎么备：在哪买 / 提前多久买才有效 =====
// 【为什么单开一个】长期预判一周才一次，还得跟另外六段挤篇幅；用户原话是
//   「他为啥没说在哪里买啥最划算的哪些保险、提前多久买才会有效」——所以这一项只做保险，篇幅全给它。
// 【边界（写死）】不点名公司/产品/代理人/链接/电话；不承诺赔不赔；等待期与生效时点只给常见区间并标「以条款为准」。
// 【失败表现】模型没接上时返回 {ok:false,msg}，面板直接显示原因（不会静默变空）。
function careInsuranceBuild() {
    var packet = careForecastPacket(30);
    var sys = "你是他的保险常识顾问（他跑网约车为生，净收入低，车是租的，账本支出常记不全）。"
        + "下面是他 App 里真实的记录与固定情况。只回答一件事：**照他现在的情况，该备哪些保险、在哪买、提前多久买才真的管用**。\n"
        + "硬规则：\n"
        + "①只谈他**个人**的险种；【他的固定情况】写着车是租的时，随车的交强险/商业险/车上人员责任险由租车公司投保，"
        + "不许建议他自己买、不许算进他的开销。\n"
        + "②不许点名任何保险公司、产品名、代理人、链接、电话；渠道只写类别（国家医保服务平台 App／当地医保局或政务 App／"
        + "当地惠民保官方公众号／保险公司官方 App·官网／支付宝·微信保险频道／银行或线下营业厅）。\n"
        + "③不许说「一定能赔／一定不赔」；等待期、免赔额、既往症这类一律写「通常」「以条款为准」。\n"
        + "④数字只用记录里的；金额给人民币区间并标「估算、地区有差异」，再用【收入口径】的净收入换算成「相当于几天收入」。\n"
        + "\n按这四段写，每段一条一行，不许空话：\n"
        + "【一·先办这 3 件】按优先级从高到低，每条写：办什么 → 为什么是他现在最该办的（引记录里的数或事实） → "
        + "什么时候办（具体到「本周内」「这个月」「等 X 条件」）。\n"
        + "【二·每样怎么买、多久生效】第一段列的每一样都写五小项：①管什么 ②不管什么（等待期/免赔额/既往症） "
        + "③在哪买（渠道类别） ④什么时候买、提前多久才有效（写清生效时点与等待期天数区间，明确「今天买不等于今天能报」） "
        + "⑤一年多少钱（区间＋估算标注）。\n"
        + "【三·今年可以先不买的】2–3 条：为什么可以先不买、什么情况下再补。\n"
        + "【四·一句话提醒】只写一句：具体以投保页条款为准，这段是按他的记录做的常识建议，不是销售、不是诊断。\n"
        + "全篇 500–800 字，不要 markdown 星号，不要复述数据，不要「建议多注意身体」这类空话。";
    var usr = packet + "\n\n请按上面四段写。";
    var r = careAISimple(sys, usr, 5000);
    if (!r.ok) return r;
    var title = "🛡 保险怎么备（" + nowStr().slice(5, 16) + "）\n";
    var full = title + r.text;
    careLogPush("insurance", full, r.model);
    log("保险怎么备生成：字数 " + r.text.length + " 模型 " + (r.model || "?") + " finish=" + (r.fin || "?"));
    return { ok: true, text: full, packet: packet };
}
// 请求：脚本/关心_分析请求.json {"kind":"plan"|"evening"|"forecast","days":14}
// 结果：脚本/关心_分析结果.json {ok, kind, text, len, ts}；处理完删请求。
// 为什么要有它：面板按钮只能人点，ccode 想核「到底生成了什么」时没法验；有了它，代码路径与面板完全一致。
function careAnalysisBridge() {
    try {
        var REQ = BASE + "/关心_分析请求.json", OUT = BASE + "/关心_分析结果.json";
        var f = new java.io.File(REQ);
        if (!f.exists()) return;
        var raw = "";
        try { raw = String(files.read(REQ) || ""); } catch (eR) { raw = ""; }
        try { f.delete(); } catch (eD) {}
        var j = null;
        try { j = JSON.parse(raw); } catch (eJ) { j = null; }
        if (!j || !j.kind) { try { files.write(OUT, JSON.stringify({ ok: false, msg: "请求缺 kind" })); } catch (eW) {} return; }
        var kind = String(j.kind), r;
        if (kind === "forecast") r = careForecastBuild(Number(j.days) || 14);
        else r = carePlanBuild(kind === "evening" ? "evening" : "morning");
        try {
            files.write(OUT, JSON.stringify({ ok: !!r.ok, kind: kind, text: r.text || "", len: (r.text || "").length, msg: r.msg || "", ts: nowStr() }));
        } catch (eW2) {}
        log("分析请求桥：" + kind + " → " + (r.ok ? ("已生成 " + (r.text || "").length + " 字") : ("失败 " + (r.msg || ""))));
    } catch (e) { log("分析请求桥异常：" + e); }
}
function careForecastTick() {
    // 每 7 天一次（晚上 20–23 点之间），当天只做一次；安静策略照管，不出声也写进聊天记录。
    try {
        var now = Date.now(), hh = new Date(now).getHours();
        var P = MEM.plan = MEM.plan || {};
        if (hh < 20 || hh > 23) return;
        if (P.fTs && now - P.fTs < 7 * 86400000) return;
        // 【2026-10-19 同因】旧版先落 fTs 再调模型，网络一抖就得再等 7 天。改成成功才落，
        // 失败当天最多试 3 次（放在晚上 20–23 点之间，每 10 分钟一次）。
        var fdk = careDayKey(now);
        var fst = P.fTry || { d: "", n: 0 };
        if (fst.d !== fdk) fst = { d: fdk, n: 0 };
        if (fst.n >= 3) { P.fTry = fst; return; }
        fst.n++; P.fTry = fst; saveMem();
        var r = careForecastBuild(14);
        if (!r.ok) { log("长期预判生成失败（今天第 " + fst.n + "/3 次）：" + (r.msg || "") + "——下个节拍再试"); return; }
        P.fTs = now; saveMem();
        MEM.chat.push({ t: now, me: "📈 [长期预判]", pet: r.text, char: curChar() });
        if (MEM.chat.length > 60) MEM.chat.shift();
        saveMem();
        var short = "我按最近两周的记录推了一遍，有几件接下来容易出的事，面板「📈 长期预判」能看全的";
        try { presentSay(curChar(), short, short, "concern", ST.soundOn && !CARECORE.inDnd(QCFG, nowMinOf(now))); } catch (eS) {}
        log("长期预判：已生成（模型 " + (r.model || "?") + "）");
    } catch (e) { log("长期预判异常：" + e); }
}
function careScreenText(now) {
    var sys = careUsagePermOk() ? careUsageTodayMin(now) : -1;
    var own = Math.max(0, Math.round(SCR.min));
    function fm(m) { m = Math.max(0, Math.round(m)); return Math.floor(m / 60) + " 小时 " + (m % 60) + " 分"; }
    if (sys >= 0) return { ok: true, sys: sys, own: own, perm: true, text: "📵 今日屏幕：" + fm(sys) + "（系统精确口径）" };
    return { ok: true, sys: -1, own: own, perm: false, text: "📵 今日屏幕：约 " + fm(own) + "（自记近似——打包模板无系统使用授权，口径见「口径说明」）" };
}
function careWeekFrom(now) {
    // 本周起点＝周一 00:00
    var d = new Date(now || Date.now()), back = (d.getDay() + 6) % 7;
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() - back).getTime();
}
function careWeekStats(from, to) {
    // 纯逻辑（单测直测）：聚合 [from,to) 区间统计
    var st = { meals: 0, nutN: 0, zhu: 0, shu: 0, dan: 0, you: 0, nightDays: 0, moodN: 0, notesN: 0, elemLow: [], screenMin: 0, screenDays: 0, metricLast: {} };
    var h = MEM.health || {};
    var dd = h.diet || [];
    var i, _mealByDay = {};
    for (i = 0; i < dd.length; i++) {
        var r = dd[i]; if (!r || !(r.t >= from && r.t < to)) continue;
        // 2026-10-22（㉗）：顿数按天、按餐次去重（原来一条记录算一顿，纠正一句话就多一顿）
        var _mdk = careDayKey(r.t);
        if (!_mealByDay[_mdk]) _mealByDay[_mdk] = [];
        _mealByDay[_mdk].push(r);
        if (r.nutri) { st.nutN++; st.zhu += r.nutri.zhu; st.shu += r.nutri.shu; st.dan += r.nutri.dan; st.you += r.nutri.you; }
    }
    for (var _mk in _mealByDay) st.meals += careMealSlotCount(_mealByDay[_mk]);
    var nd = {}, ch = MEM.chat || [];
    for (i = 0; i < ch.length; i++) {
        var c = ch[i]; if (!c || !(c.t >= from && c.t < to)) continue;
        var hh = new Date(c.t).getHours();
        if (hh >= 0 && hh <= 5) nd[careDayKey(c.t)] = 1;
    }
    for (var kk in nd) st.nightDays++;
    var mm = MEM.mood || [];
    for (i = 0; i < mm.length; i++) { if (mm[i] && mm[i].t >= from && mm[i].t < to) st.moodN++; }
    var nn = h.notes || [];
    for (i = 0; i < nn.length; i++) { if (nn[i] && nn[i].t >= from && nn[i].t < to) st.notesN++; }
    var eSum = {}, eN = 0, keys = ["钙", "铁", "锌", "硒", "钾", "镁", "钠", "维A", "维B", "维C", "维D", "维E", "纤"];
    for (i = 0; i < dd.length; i++) {
        var dr = dd[i]; if (dr && dr.t >= from && dr.t < to && dr.elems) { eN++; for (var ek in dr.elems) eSum[ek] = (eSum[ek] || 0) + dr.elems[ek]; }
    }
    if (eN > 0) { for (var ki = 0; ki < keys.length; ki++) { var k2 = keys[ki]; if (eSum[k2] != null && (eSum[k2] / eN) <= 2.2) st.elemLow.push(k2 === "纤" ? "膳食纤维" : k2); } }
    var scr = h.screen || {};
    for (var sk in scr) {
        var t0 = careDayStart(sk);
        if (t0 >= from && t0 < to) { st.screenMin += Number(scr[sk]) || 0; st.screenDays++; }
    }
    var mt = h.metrics || [];
    for (i = 0; i < mt.length; i++) { var mr = mt[i]; if (mr && mr.k && mr.t >= from && mr.t < to) st.metricLast[mr.k] = mr; }
    return st;
}
function careWeeklyBuild(now) {
    try {
        now = now || Date.now();
        var from = careWeekFrom(now), cur = careWeekStats(from, now), prev = careWeekStats(from - 7 * 86400000, from);
        function fm(m) { m = Math.max(0, Math.round(m)); return Math.floor(m / 60) + " 小时 " + (m % 60) + " 分"; }
        function cd(a, b, kind) {
            // v3 趋势对比：只报有意义的差值
            if (a == null || b == null) return "";
            var d = a - b;
            if (kind === "min") { if (Math.abs(d) < 30) return ""; return "（" + (d > 0 ? "↑ 比上周多 " + fm(d) : "↓ 比上周少 " + fm(-d)) + "）"; }
            if (kind === "avg") { if (Math.abs(d) < 0.3) return ""; return "（" + (d > 0 ? "↑ 比上周高 " : "↓ 比上周低 ") + Math.abs(d).toFixed(1) + "）"; }
            if (d === 0) return "";
            return "（" + (d > 0 ? "↑ 比上周多 " + d : "↓ 比上周少 " + (-d)) + "）";
        }
        var L = ["📅 本周小结（周一到今天）"];
        var dietL = "🍚 饮食：" + cur.meals + " 顿" + cd(cur.meals, prev.meals, "n");
        if (cur.nutN) dietL += "；拍了 " + cur.nutN + " 顿有营养塔：主食 " + (cur.zhu / cur.nutN).toFixed(1) + "、蔬菜 " + (cur.shu / cur.nutN).toFixed(1) + "、蛋白 " + (cur.dan / cur.nutN).toFixed(1) + "、油脂 " + (cur.you / cur.nutN).toFixed(1) + (prev.nutN ? cd(cur.shu / cur.nutN, prev.shu / prev.nutN, "avg") : "");
        L.push(dietL);
        L.push("🌙 作息：熬夜（0-5 点还在活动）" + cur.nightDays + " 天" + cd(cur.nightDays, prev.nightDays, "n"));
        if (cur.screenDays) L.push("📵 屏幕：日均约 " + fm(Math.round(cur.screenMin / cur.screenDays)) + "（自记口径，" + cur.screenDays + " 天样本）");
        L.push("💭 情绪记录 " + cur.moodN + " 次 ｜ 🩺 身体信号 " + cur.notesN + " 次");
        var mL = [];
        for (var mk in cur.metricLast) { var mv = cur.metricLast[mk]; mL.push(mk + " " + mv.v + (mv.unit || "")); }
        if (mL.length) L.push("📏 指标：本周最新 " + mL.join("、"));
        if (cur.elemLow.length) L.push("🧪 元素短板：" + cur.elemLow.join("、"));
        var tips = [];
        if (cur.nightDays >= 2) tips.push("熬夜偏多——长期晚睡伤记忆和心血管，这周试着早睡两天");
        if (cur.nutN && (cur.shu / cur.nutN) <= 2.5) tips.push("蔬菜吃得少——多点绿叶菜，皮肤和精神都会更好");
        if (cur.screenDays && (cur.screenMin / cur.screenDays) >= 480) tips.push("日均屏幕超 8 小时——眼睛和睡眠先受影响，记得抬头看看远处");
        if (tips.length) L.push("💡 " + tips.join("；"));
        return { ok: true, text: L.join("\n") };
    } catch (e) { return { ok: false, msg: String(e) }; }
}
function careWeeklyTick() {
    try {
        var wk = MEM.health.weekly = MEM.health.weekly || { on: true };
        if (wk.on === false) return;
        var now = new Date();
        if (now.getDay() !== 0) return;
        if (now.getHours() < 20) return;
        var key = careDayKey(Date.now());
        if (wk.lastKey === key) return;
        var r = careWeeklyBuild(Date.now());
        if (!r.ok) return;
        wk.lastKey = key; wk.lastText = r.text; wk.lastTs = Date.now();
        MEM.chat.push({ t: Date.now(), me: "📅 [周报]", pet: r.text, char: curChar() });
        if (MEM.chat.length > 60) MEM.chat.shift();
        saveMem();
        var short = "周报来啦——这周的饮食作息我都记好了，面板点「📅 本周周报」看全的呀";
        presentSay(curChar(), short, short, "happy", ST.soundOn && !CARECORE.inDnd(QCFG, nowMinOf(Date.now())));
        log("周报：已生成并播报（" + key + "）");
    } catch (e) { log("周报异常：" + e); }
}
function careProbeTick() {
    // v3 主动问询：只看趋势是否异常，异常才开口；48h 去重、白天时段、安静策略照管
    try {
        var now = Date.now(), hh = new Date(now).getHours();
        if (hh < 8 || hh > 22) return;
        MEM.health.probes = MEM.health.probes || {};
        var pr = MEM.health.probes;
        var quiet = CARECORE.inDnd(QCFG, nowMinOf(now));
        var i, dd = MEM.health.diet || [], vegN = 0, vs = 0;
        for (i = dd.length - 1; i >= 0 && i >= dd.length - 6; i--) { var r = dd[i]; if (r && r.nutri) { vegN++; vs += r.nutri.shu; } }
        if (vegN >= 2 && (vs / vegN) <= 2.2 && !(pr.veg && now - pr.veg < 48 * 3600000)) {
            pr.veg = now; saveMem();
            presentSay(curChar(), "这两天蔬菜吃得少了点哦——是外卖多了吗？长期蔬菜少，皮肤和精神都会闹别扭的", "这两天蔬菜吃得少了点哦，是外卖多了吗？", "concern", ST.soundOn && !quiet);
            log("主动问询：蔬菜偏少（vegN=" + vegN + "）");
            return;
        }
        var yMin = 0;
        try { yMin = Number((MEM.health.screen || {})[careDayKey(now - 86400000)]) || 0; } catch (e0) {}
        if (yMin >= 480 && !(pr.screen && now - pr.screen < 48 * 3600000)) {
            pr.screen = now; saveMem();
            presentSay(curChar(), "昨天盯屏幕盯了 8 个多小时…眼睛干不干？睡前刷屏最伤睡眠，今晚试试提前半小时放下它", "昨天屏幕超 8 小时啦，今晚早点放下手机好不好？", "concern", ST.soundOn && !quiet);
            log("主动问询：屏幕过长（昨日 " + yMin + " 分）");
        }
    } catch (e) { log("主动问询异常：" + e); }
}

// ===== v2.3.72（2026-10-22 用户点单）：主动开口由模型自己判断，而不是等主人说话 =====
// 用户原话：「我要的是它自己知道我所有东西、自己分析判断我有哪些困境、我心里咋想的，主动来关心我，
//   并说出我心里的情况、主动开导引导我，不是我去给它说了才懂」「看你能不能帮我弄出解决我很多迷茫
//   以及各种心情上的问题的关心 app」。
// 【做法】每 10 分钟由主节拍调一次：
//   ①确定性节流先兜底（这不是判断，是送达策略）：勿扰/声音开关照管、每天最多 5 次、两次间隔 ≥75 分钟、
//     他 20 分钟内说过话就不插话、凌晨 1:00–8:00 不主动；
//   ②把「他现在是什么状态」的素材（careMindBrief：聊天节奏/沉默/原话/旧卡点）交给模型，
//     让它自己决定要不要开口——不想说就回 PASS，一个字都不发；
//   ③要说就照它的话说（≤60 字、必须落到具体事），进聊天记录，面板看得见。
// 【为什么代码里不判「他迷茫了」】那是判断，按用户铁律归模型；代码只做节流与送达。
function careProactiveTick() {
    try {
        var now = Date.now(), hh = new Date(now).getHours();
        MEM.pro = MEM.pro || {};
        var P = MEM.pro, dk = careDayKey(now);
        if (P.d !== dk) { P.d = dk; P.n = 0; saveMem(); }
        if ((P.n || 0) >= 5) return;
        if (P.t && now - P.t < 75 * 60000) return;
        if (hh >= 1 && hh < 8) return;
        var quiet = CARECORE.inDnd(QCFG, nowMinOf(now));
        // 他刚说过话就别插话（只认主人自己发的，主动播报行不算）
        var ch = MEM.chat || [], lastUser = 0;
        for (var i = ch.length - 1; i >= 0; i--) {
            var c0 = ch[i] || {};
            var m0 = String(c0.me || "");
            if (!m0) continue;
            var c1 = m0.codePointAt ? m0.codePointAt(0) : m0.charCodeAt(0);   // emoji 是代理对，必须按码点取
            // 主动播报/系统行的开头是 emoji 或方括号（📋 今日一策 / 💭 它主动说的 / 🔎 分析…），不算主人说话。
            // 用码点判断而不是正则转义：\u{...} 在非 unicode 模式下行为不可靠。
            if ((c1 >= 0x1F300 && c1 <= 0x1FAFF) || (c1 >= 0x2600 && c1 <= 0x27BF) || m0.charAt(0) === "[") continue;
            lastUser = c0.t || 0; break;
        }
        if (lastUser && now - lastUser < 20 * 60000) return;
        var pkt = careMindBrief();
        var today = "";
        try {
            var t = careMoneyToday();
            today = "今天：收 " + t.inSum.toFixed(2) + " / 支 " + t.outSum.toFixed(2) + " / 净 " + t.net.toFixed(2)
                + (MEM.work && MEM.work.on ? "；在跑车中" : "；没记在跑车");
        } catch (eT) {}
        var sys = "你是他的关心者。他是跑网约车的司机，收入很紧（车是租的，租金日均 73 元），有颈椎病和牙龈问题，常半夜还在跑。"
            + "下面是此刻能看到的真实素材。请判断：现在有没有必要主动找他说话。"
            + "不需要就只回 PASS 四个字母，别写别的。需要就第一行写 SPEAK，第二行起写你要对他说的话。"
            + "说话要求：①不超过 60 字；②说你自己真看到的东西，别编记录里没有的；"
            + "③不问他「你怎么了」「在干嘛」这类空问题；④不空喊加油、不说教、不诊断；"
            + "⑤如果是情绪上的事，先接住那件事，再给一个今天就能做的小动作。";
        var r = careAISimple(sys, pkt + (today ? "\n" + today : ""), 400);
        if (!r || !r.ok) return;
        var txt = String(r.text || "").trim();
        if (!/^SPEAK/i.test(txt)) { log("主动关心：模型判不必开口（" + txt.slice(0, 12) + "）"); return; }
        txt = txt.replace(/^SPEAK[:：]?\s*/i, "").replace(/\s+/g, " ").trim();
        if (txt.length < 6) return;
        if (txt.length > 90) txt = txt.slice(0, 90);
        P.t = now; P.n = (P.n || 0) + 1; saveMem();
        MEM.chat.push({ t: now, me: "💭 [它主动说的]", pet: txt, char: curChar(), eng: "ai-proactive" });
        if (MEM.chat.length > 60) MEM.chat.shift();
        saveMem();
        presentSay(curChar(), txt, txt, "concern", ST.soundOn && !quiet);
        log("主动关心：说了「" + txt.slice(0, 40) + "」（今天第 " + P.n + " 次）");
    } catch (e) { log("主动关心异常：" + e); }
}

// ===== 看守线程②：设备健康（每 10 分钟） =====
try {
    threads.start(function () {
        sleep(20000);
        while (true) {
            try {
                var snap = healthSnapshot();
                var hr = CARECORE.healthTick(snap, ST.health, Date.now());
                ST.health = hr.state;
                for (var i = 0; i < hr.issues.length; i++) { try { log("健康事件：" + hr.issues[i].text); react(hr.issues[i]); } catch (eR2) {} }
                saveState();
            } catch (e) { log("健康看守异常：" + e); }
            sleep(600000);
        }
    });
} catch (eHW) { log("健康线程启失败：" + eHW); }

// ===== 网页桥 =====
// ===== v2.3.60（2026-10-21 用户点单）「你到底加了哪些、什么时候会提醒我」=====
// 【为什么】用户原话：「全方面的各种分析后的啥时候对我有哪些提醒的功能有没有？我这些我都不知道，
//   就算有些功能你加了，我不知道哪里看你到底有没有加哪些」。——功能藏得深，等于没做。
// 【做法】把 App **自己真实在跑的那份配置**列给面板看：时段/条件/开没开全取自下面这些常量与开关，
//   不另抄一份话术、也不新增任何判断（什么时候响仍旧由原来那些 Tick 决定，这里只负责说清楚）。
// 【边界】这只是一份「说明书」：不改任何触发逻辑；要关提醒用面板上的开关（周报提醒/声音总开关/勿扰）。
function careReminderPlan() {
    var now = Date.now(), dk = careDayKey(now);
    var nud = (MEM.health && MEM.health.nudges) || {};
    var wk = (MEM.health && MEM.health.weekly) || {};
    var wkOn = wk.on !== false;
    var P = MEM.plan || {};
    var items = [
        { t: "07–09 / 11–13 / 17–19", n: "饭点：问你今天吃什么", w: "早中晚各一次；回一句或拍给我看都行；声音关着就只记不出声", on: true },
        { t: "00–05", n: "熬夜：这个点还在用手机", w: "40 分钟内刚聊过/刚记过就会说一句早点睡；每小时最多一次", on: true },
        { t: "全天（连跑满 2 小时）", n: "久驾：该靠边歇会儿", w: "连着跑 2 小时且没在休息时提醒；每小时最多一次，歇够重新计", on: true },
        { t: "全天（连亮屏 90 分钟）", n: "盯屏：眼睛该歇了", w: "连续亮屏 90 分钟以上提醒看远处；50 分钟内不重复", on: true },
        { t: "07–10 / 21–23", n: "每日一策：今天怎么过 / 今晚复盘", w: "各每天一次；网络没接上不算一次，十分钟后再试（一轮最多 3 次）", on: true },
        { t: "20–23", n: "长期预判：未来两周最可能出的事", w: "每 7 天一次；失败当天在 20–23 点里最多重试 3 次", on: true },
        { t: "周日 20:00 后", n: "周报：这周吃住睡＋跟上周比", w: "每周一次；面板「周报提醒」可以关", on: wkOn },
        { t: "08–22", n: "趋势问询：蔬菜偏少 / 昨天屏幕超 8 小时", w: "只有数据异常才开口；同一件事 48 小时内只问一次", on: true },
        { t: "每 10 分钟查一次", n: "手机自己的事：电量≤15% / 发烫≥42℃ / 存储≥93% / 充满 80%", w: "该说才说：低电 8 小时一次、发烫 4 小时一次、存储 24 小时一次", on: true },
        { t: "流水线有动静时", n: "庆祝 / 关切：PROGRESS 有新成果或报错", w: "只在有新东西时说，不重复念旧的", on: true }
    ];
    // 今天下一次（只算固定时段的；问询类要看数据，没法预排）
    var base = new Date(now); base.setHours(0, 0, 0, 0);
    var d0 = base.getTime(), cand = [];
    function push(h, m, s) { var t = d0 + h * 3600000 + m * 60000; if (t > now + 60000) cand.push({ t: t, s: s }); }
    if (nud.meal_b !== dk) push(7, 0, "早饭问你吃什么");
    if (nud.meal_l !== dk) push(11, 0, "午饭问你吃什么");
    if (nud.meal_d !== dk) push(17, 0, "晚饭问你吃什么");
    if (P.mDay !== dk) push(7, 10, "今日一策（今天怎么过）");
    if (P.eDay !== dk) push(21, 5, "今晚复盘");
    if (!(P.fTs && now - P.fTs < 7 * 86400000)) push(20, 10, "长期预判（每 7 天一次）");
    cand.sort(function (a, b) { return a.t - b.t; });
    var next = "今天固定时段的都做完了；剩下的是看数据才开口的（连跑久了、盯屏久了、蔬菜少了…）";
    if (cand.length) {
        var n0 = new Date(cand[0].t), p2 = function (x) { return (x < 10 ? "0" : "") + x; };
        next = p2(n0.getHours()) + ":" + p2(n0.getMinutes()) + "　" + cand[0].s;
    }
    return {
        ok: true, now: nowStr(), next: next, sound: !!ST.soundOn,
        dnd: { on: !!QCFG.dndOn, from: QCFG.from, to: QCFG.to },
        weeklyOn: wkOn, items: items
    };
}
// 【功能清单】只列**已经做了、面板上能找到入口**的；没做的不写进来（宁缺不吹）。
function careFeatureList() {
    var G = [
        { g: "陪着你", a: [
            { n: "戳一下 / 说句话 / 演一个", d: "戳它会理你；「说句话」让它出声；庆祝/关切/饭点问三个演示按钮不用等到那时候", u: "面板第一张卡" },
            { n: "两个角色", d: "元气（小捧场王）/ 护士（温柔），也可以「自动」按情境切", u: "面板第一张卡" },
            { n: "悬浮宠物", d: "常驻在屏幕上，可拖动；长按回面板", u: "面板「开关」→ 悬浮宠物" },
            { n: "安静策略", d: "勿扰时段 + 每天播报上限，夜里只记不出声", u: "面板「🤫 安静策略」" }
        ] },
        { g: "听和看", a: [
            { n: "🎤 说给它听", d: "录音在本机转文字（whisper 全离线、不花额度），转完我再回话", u: "面板「💬 谈心」" },
            { n: "🎧 连续对话", d: "按下就开始一直聊，不用每次按键；45 秒没声音自动退出", u: "面板「💬 谈心」" },
            { n: "👁 视频对话", d: "边说边看摄像头（每次最多 2 分钟）", u: "面板「💬 谈心」" },
            { n: "📷 拍张给你看", d: "拍一张给我，我看完说给你听", u: "面板「💬 谈心」" },
            { n: "拍饭菜出营养塔", d: "饭点时拍给我：出主/蔬/蛋/油四级营养塔与元素体检", u: "饭点问答时拍" }
        ] },
        { g: "钱和跑车", a: [
            { n: "记账", d: "说一句就记：收入/支出/工时/单量；也能说「改/删上一笔」", u: "直接跟我说" },
            { n: "固定支出", d: "车租金这类每月/每年必出的钱单独记，不混进当天支出", u: "直接说「车租金每月…」" },
            { n: "账本历史", d: "按天倒序列出全部账（只读）", u: "面板「跑车」→ 📜 账本历史" },
            { n: "精力分", d: "按作息/休息/工时/身体记录算的今日状态分", u: "面板「跑车」→ 精力" },
            { n: "休息记录", d: "熄屏或车上停稳满 30 分钟自动记；也能手动开关", u: "面板「跑车」" },
            { n: "轨迹地图", d: "自己走过的路线按天存 30 天，可回看", u: "面板「跑车」→ 🛣 轨迹地图" },
            { n: "路况地图＋导航", d: "选目的地看全市红黄绿，点路线切过去", u: "面板「开关」→ 🗺️ 路况地图" }
        ] },
        { g: "身体和吃", a: [
            { n: "每日一策 / 今晚复盘", d: "吃多少、身体、挣钱三合一，用你的账本与记录算", u: "面板「健康小管家」" },
            { n: "长期预判", d: "最近两周的真实记录→接下来最可能出的事、身体报警、风险时间线与保险怎么备", u: "面板「健康小管家」" },
            { n: "🛡 保险怎么备", d: "只在个人人身险里说：先办哪几件、在哪买、提前多久才生效、一年多少钱", u: "面板「🔔 它会主动找你」" },
            { n: "周报", d: "这周的饮食作息屏幕＋跟上周比", u: "面板「健康小管家」→ 📅 本周周报" },
            { n: "屏幕时长", d: "今日用了多久（系统口径或自采样）", u: "面板「健康小管家」→ 📵 今日屏幕" },
            { n: "元素体检", d: "钙铁锌硒钾镁钠＋维 A/B/C/D/E＋膳食纤维 13 项", u: "面板「健康小管家」→ 🧪 元素体检" },
            { n: "营养塔", d: "主食/蔬果/蛋奶/油盐四级＋热量", u: "面板「健康小管家」→ 饮食区" },
            { n: "身体指标", d: "体重/血压/心率/血氧/血糖/体温/腰围/身高，报个数就记，能看趋势", u: "直接跟我说「血压 130/85」" }
        ] },
        { g: "它记得你什么", a: [
            { n: "记住 / 忘掉", d: "说「记：……」存进记忆，说「忘掉 ……」从记忆里去掉", u: "面板「💬 谈心」下的小暗号" },
            { n: "关于你（记忆）", d: "它现在记着你哪些事，一条一条列出来，也能手动增/删", u: "面板「🧠 关于你」" },
            { n: "情绪时间线", d: "聊天里提到的情绪与身体不适，按时间存着", u: "面板「🧠 关于你」" }
        ] },
        { g: "能翻的记录", a: [
            { n: "🔔 提醒时刻表 / 🧾 功能清单", d: "它什么时候会找你、它都会做什么，面板上能直接翻（就是你现在看的这个）", u: "面板「🔔 它会主动找你」" },
            { n: "一策历史 / 预判历史 / 保险历史", d: "每次生成的分析都留档（各留最近 40 条），随时重看", u: "面板「健康小管家」与「🔔 它会主动找你」" },
            { n: "聊天记录", d: "你说过什么、它回什么，都在面板里", u: "面板「💬 谈心」" },
            { n: "日志", d: "它自己干了什么，一行一行实时写（排查用）", u: "面板最下面「📜 日志」" }
        ] },
        { g: "它自己的事", a: [
            { n: "3D 小人", d: "可以换成 3D 形象（需要时自己开）", u: "面板「开关」→ 🤖 3D小人" },
            { n: "权限入口", d: "悬浮窗授权页 / 电池优化白名单，保它不被系统杀", u: "面板「开关」" },
            { n: "自己申请打包更新", d: "改完自己的代码可自己打包安装（碰运气，得你看一眼）", u: "跟我说「改好打包安装」" }
        ] }
    ];
    return { ok: true, ver: VER, groups: G };
}
function buildStatus() {
    var snap = healthSnapshot();
    return {
        ok: true, ver: VER, d3On: D3.on, mode: ST.mode, curChar: curChar(), lastUsed: ST.lastUsed,
        aiOn: (ST.aiOn !== false),
        tapMode: (String(ST.tapMode || "input") === "voice" ? "voice" : "input"),   // 2026-10-23：单击悬浮人＝出输入框/直接语音
        // 2026-10-25（主人点单）：自己动时说不说话、自己变小变大躲不躲；两个开关都落盘（重装不丢）
        d3Talk: (ST.d3Talk !== false), d3Auto: (ST.d3Auto !== false), d3Fz: (Number(ST.d3Fz) || 1),
        // 2026-10-25（主人「黄脸换成 3D 人、固定循环全部动作」）：固定表演开关与每条动作时长
        d3Show: (ST.d3Show !== false), d3LoopMs: (Number(ST.d3LoopMs) || 3000), d3Live: !!D3.on,
        // 2026-10-25（主人发火：「小宠物那个位置要的是真的 3D 人」）：把当前选中的模型名给面板，
        //   面板用 iframe 真正渲染一个 3D 小人（小窗口模式，不抢浮窗的 AI 指令）。
        d3Model: (function () { try { var _s2 = loadJSON(BASE + "/关心_3D/选择.json"); return (_s2 && _s2.name) ? String(_s2.name) : ""; } catch (eM2) { return ""; } })(),
        // 2026-10-25（主人「随时听外面声音」）：常听开关与门限、今天已搭话句数
        ambOn: !!AMB.on, ambTh: (Number(ST.ambTh) || 1800),
        ambN: (MEM.ambTalk && MEM.ambTalk.d === careDayKey(Date.now())) ? (MEM.ambTalk.n || 0) : 0,
        ambLog: (MEM.amb || []).slice(-5).map(function (x) { return (x && x.t ? new Date(x.t).toTimeString().slice(0, 5) + " " + String(x.text || "") : ""); }),
        voice: { rec: REC.on, busy: VF.busy, phase: VF.phase, text: VF.text, err: VF.err ? String(VF.err).slice(0, 60) : "" },
        soundOn: !!ST.soundOn, sayMode: (ST.sayMode === 0 || ST.sayMode === 2) ? ST.sayMode : 1, floatOn: !!ST.floatOn, floatLive: !!FACE, bubbleLive: !!BUB, mapOn: !!MAP_ON, trackOn: !!TRK_ON,
        tts: { ready: TTS.ready, err: TTS.err ? String(TTS.err).slice(0, 60) : "" },
        quiet: { dndOn: !!QCFG.dndOn, from: QCFG.from, to: QCFG.to, capCel: QCFG.capCel, capCon: QCFG.capCon, minGapSec: QCFG.minGapSec, ignoreHours: QCFG.ignoreHours },
        freq: CARECORE.normalizeFreq(ST.freq, Date.now()),
        events: ST.events.slice(0, 8),
        facts: MEM.facts.slice(-12), chat: MEM.chat.slice(-40), moodN: MEM.mood.length, pokeN: ST.pokeCount,
        battery: snap.battery, charging: !!snap.charging, temp: snap.temp, storage: snap.storage,
        overlay: floatPermOk(), now: Date.now(),
        watermark: ST.watermark ? ST.watermark.count : 0,
        weeklyOn: !(MEM.health && MEM.health.weekly && MEM.health.weekly.on === false),
        screenToday: Math.round(SCR.min),
        elem: careElemAvg(7),
        elemAmt: (function () { try { return careElemAmounts(7); } catch (e) { return null; } })(),
        diet: (function () { try { return dietPlan({}); } catch (e) { return null; } })(),
        money7: (function () { try { return moneySummary(7); } catch (e) { return null; } })(),
        money: (function () { try { ensureWorkMem(); var t = careMoneyToday(); return { inSum: t.inSum, outSum: t.outSum, net: t.net, hours: t.day.hours || 0, orders: t.day.orders || 0, text: careMoneyTodayText() }; } catch (e) { return null; } })(),
        energy: (function () { try { return careEnergy(); } catch (e) { return null; } })(),
        rest: (function () { try { ensureWorkMem(); var r = careRestToday(); return { mins: r.mins, n: r.n, open: !!r.open, openMins: r.open ? Math.round((Date.now() - r.open.s) / 60000) : 0 }; } catch (e) { return null; } })(),
        work: (function () { try { ensureWorkMem(); return { mode: MEM.work.mode, platform: MEM.work.platform || "", gps: !!MEM.work.gps }; } catch (e) { return null; } })(),
        logTail: tailLines(DBG, 10)
    };
}
// v0.6.0：定位监测开关（默认关；开启时才申请权限）
web.jsBridge.handle("setGps", function (event, on) {
    try {
        ensureWorkMem();
        var want = !!on;
        if (want && !careLocPermOk()) {
            try { runtime.requestPermissions(["android.permission.ACCESS_FINE_LOCATION", "android.permission.ACCESS_COARSE_LOCATION"]); } catch (eP) {}
            sleep(1200);
            if (!careLocPermOk()) return { ok: false, needPerm: true, msg: "需要定位权限（授权后再开一次这个开关）" };
        }
        MEM.work.gps = want;
        saveMem();
        log("定位监测：" + (want ? "开" : "关"));
        // v1.6.0：开关一开就真的开始采轨迹（旧版只每 5 分钟读一次 lastKnownLocation，拿不到就啥都没有）
        try { if (want) { var _rs = trkStart(); if (!_rs.ok) log("轨迹启动没成功：" + _rs.msg); } else trkStop(); } catch (eTr) { log("轨迹开关异常：" + eTr); }
        return { ok: true, gps: want, track: TRK.on };
    } catch (e) { return { ok: false, msg: String(e) }; }
});
web.jsBridge.handle("energy", function () { try { return careEnergy(); } catch (e) { return { ok: false, msg: String(e) }; } });
web.jsBridge.handle("moneyToday", function () { try { ensureWorkMem(); var t = careMoneyToday(); return { ok: true, inSum: t.inSum, outSum: t.outSum, net: t.net, hours: t.day.hours || 0, orders: t.day.orders || 0, text: careMoneyTodayText() }; } catch (e) { return { ok: false, msg: String(e) }; } });
// v2.1.4（2026-10-19 02:1x·用户点单「账本／元素都加历史查看」）：面板「📜 账本历史 / 📜 元素历史」按钮走这里。
//   what = money|elem，days = 0 表示全部；只读，不动数据。
web.jsBridge.handle("hist", function (event, what, days) { try { return careHist(what, days); } catch (e) { return { ok: false, msg: String(e) }; } });
web.jsBridge.handle("status", function () { try { return buildStatus(); } catch (e) { return { ok: false, msg: String(e) }; } });
// v0.5.0：屏幕时长 / 周报（面板直连）
// 【2026-10-19 用户「粗估会根据推断越来越接近准确时间吗」】红绿灯等待的**数据状态**桥：
//   读 路口节律推断.js 产出的报告，把「多少个路口 / 多少个够样本」如实告诉导航页。
//   为什么这么做：高德只给红绿灯**个数**、不给每灯等待（逐灯读秒不开放给第三方），
//   所以等待时间一直是 App 自己按 20 秒/灯粗估。要让这个数「越来越准」，唯一可行的通道是
//   用主人自己的轨迹反推路口周期（路口节律推断.js）；而它要求同一路口 ≥4 次停车→起步样本，
//   ≥10 次才稳。现在实测 17 个路口、0 个达标，所以页面必须如实显示「还差几次」，不许假装准。
web.jsBridge.handle("lightStat", function () {
    try {
        var t = "";
        try { t = String(readText("/storage/emulated/0/脚本/路口节律_报告.md") || ""); } catch (eR) {}
        var places = 0, ready = 0, repeat = 0;
        var m1 = t.match(/聚类成 (\d+) 个地点/); if (m1) places = parseInt(m1[1], 10);
        var m2 = t.match(/够做周期估计）的地点：\*\*(\d+)\*\*/); if (m2) ready = parseInt(m2[1], 10);
        var m3 = t.match(/同一地点重复到达：(\d+)\/(\d+)/); if (m3) repeat = parseInt(m3[1], 10);
        return { ok: true, per: 20, places: places, ready: ready, need: 4, repeat: repeat, src: "fixed20" };
    } catch (e) { return { ok: false, msg: String(e) }; }
});
web.jsBridge.handle("screenInfo", function () { try { return careScreenText(Date.now()); } catch (e) { return { ok: false, msg: String(e) }; } });
// 【2026-10-19 用户点单】面板「🔍 它在干嘛」：最近的动作流水 + 正在做的那一件（busy 置顶显示）
web.jsBridge.handle("actList", function (event, n) {
    try {
        actLoadHistory();
        var want = Math.max(5, Math.min(120, parseInt(n, 10) || 40));
        var bus = ACT.busy;
        // 打包/装机是 Termux 侧的守护在跑（不在 App 进程里），单从打包日志捞一条给面板显示——
        // 用户要看到「它在给自己装新版本」这一步（2026-10-19 点单）。3 分钟内活跃才算数。
        try {
            var lf = new java.io.File("/storage/emulated/0/脚本/_自动打包安装日志.txt");
            if (lf.exists() && (Date.now() - lf.lastModified()) < 180000) {
                var all = actReadAll("/storage/emulated/0/脚本/_自动打包安装日志.txt");
                var ln2 = all.split("\n").filter(function (x) { return String(x).trim(); });
                var tail1 = ln2.length ? String(ln2[ln2.length - 1]) : "";
                bus = { t: Date.now(), k: "打包", s: "我正在打包安装新版本", x: tail1.replace(/^\[[^\]]*\]\s*/, "").slice(0, 120) };
            }
        } catch (ePk) {}
        return { ok: true, busy: bus, list: ACT.ring.slice(Math.max(0, ACT.ring.length - want)), total: ACT.n, now: Date.now() };
    } catch (e) { return { ok: false, msg: String(e) }; }
});
web.jsBridge.handle("openUsagePerm", function () {
    // 2026-10-17 实证：打包模板权限白名单不含 PACKAGE_USAGE_STATS（v0.5.0 拆包 Manifest 实锤 False）——
    // 系统「使用情况访问」授权列里根本不会出现本 App，引导页被证实无效；改为诚实的口径说明（屏幕时长走自采样）
    try {
        if (careUsagePermOk()) return { ok: true, granted: true, text: "系统口径已开启（使用情况访问已授权）" };
        return { ok: false, noSupport: true, msg: "这个 App 的打包模板没有「使用情况访问」权限（进不了包），屏幕时长改用本机自记近似口径（每 60 秒判亮屏累计；App 被杀/深度休眠期间不计）" };
    } catch (e) { return { ok: false, msg: String(e) }; }
});
web.jsBridge.handle("weekReport", function () { try { return careWeeklyBuild(Date.now()); } catch (e) { return { ok: false, msg: String(e) }; } });
// v2.2.0：每日一策（面板按钮直连；kind=morning 给今天怎么过，evening 给复盘+明天）
// v2.3.4：历史记录（面板「📜 历史」直连；kind 空=全部，可传 forecast / plan-morning / plan-evening）
web.jsBridge.handle("logHist", function (event, kind) {
    try {
        var list = careLogList(kind ? String(kind) : "");
        var out = [];
        for (var i = 0; i < list.length; i++) {
            out.push({ t: list[i].t, kind: list[i].kind, text: list[i].text, model: list[i].model });
        }
        return { ok: true, list: out };
    } catch (e) { return { ok: false, msg: String(e) }; }
});
// ===== v2.3.59：面板生成类按钮不再冻住页面（2026-10-21 用户报「点长期预判卡很久、滑不动、恢复后还没结果」）=====
// 【为什么】面板走 $autojs.invoke，web.jsBridge 的处理器是**同步**返回的：处理器里直接跑
//   careForecastBuild（推理模型＋截断升档，实测 19:47 那次四枪读超时共 2 分多钟）→ 页面 JS 线程被挡住，
//   用户看到的就是「卡很久、滑不动」，最后四枪全超时只剩一句「没生成」。
// 【做法】处理器只**起一个线程**就立刻返回 {pending,job}；页面每 2 秒用 jobPoll 取一次进度，
//   生成完再把正文/失败原因填进结果区。判断仍然全由模型做——这里只把「等」挪出 UI 线程。
// 【注意】careForecastBuild/carePlanBuild 本身没改；文件请求桥（关心_分析请求.json）照旧同步跑。
var CARE_JOBS = {};
function careJobStart(kind, fn) {
    var id = String(kind) + "-" + Date.now().toString(36) + "-" + Math.floor(Math.random() * 100000).toString(36);
    CARE_JOBS[id] = { t: Date.now(), pending: true, r: null };
    try {
        threads.start(function () {
            var r;
            try { r = fn(); } catch (e) { r = { ok: false, msg: String(e) }; }
            CARE_JOBS[id] = { t: Date.now(), pending: false, r: r };
            try { log("面板异步生成：" + kind + " → " + (r && r.ok ? (String(r.text || "").length + " 字 模型 " + (r.model || "?")) : ("失败 " + ((r && r.msg) || "")))); } catch (e2) {}
            var now = Date.now(), k;   // 清掉 10 分钟前的旧任务，别让这个对象一直涨
            for (k in CARE_JOBS) { if (now - (CARE_JOBS[k].t || 0) > 600000) { try { delete CARE_JOBS[k]; } catch (e3) {} } }
        });
    } catch (eT) {
        return { ok: false, msg: "起不了后台线程：" + eT };
    }
    return { ok: true, pending: true, job: id };
}
web.jsBridge.handle("jobPoll", function (event, id) {
    try {
        var j = CARE_JOBS[String(id || "")];
        if (!j) return { ok: false, msg: "这个任务已经不在了（App 可能重启过），再点一次按钮就行" };
        if (j.pending) return { ok: true, pending: true };
        return { ok: true, pending: false, result: j.r };
    } catch (e) { return { ok: false, msg: String(e) }; }
});
// v2.3.0：长期预判（面板按钮；异步返回 pending，页面用 jobPoll 取结果）
web.jsBridge.handle("forecast", function (event, days) {
    try { return careJobStart("forecast", function () { return careForecastBuild(Number(days) || 14); }); } catch (e) { return { ok: false, msg: String(e) }; }
});
// v2.3.60（2026-10-21 用户点单）：保险专项 / 提醒表 / 功能清单
web.jsBridge.handle("insurance", function () {
    try { return careJobStart("insurance", function () { return careInsuranceBuild(); }); } catch (e) { return { ok: false, msg: String(e) }; }
});
web.jsBridge.handle("reminders", function () { try { return careReminderPlan(); } catch (e) { return { ok: false, msg: String(e) }; } });
web.jsBridge.handle("features", function () { try { return careFeatureList(); } catch (e) { return { ok: false, msg: String(e) }; } });
web.jsBridge.handle("plan", function (event, kind) {
    try {
        var k = String(kind || "morning");
        if (k !== "evening") k = "morning";
        return careJobStart("plan-" + k, function () { return carePlanBuild(k); });
    } catch (e) { return { ok: false, msg: String(e) }; }
});
web.jsBridge.handle("weeklyToggle", function (event, on) {
    try {
        MEM.health.weekly = MEM.health.weekly || { on: true };
        MEM.health.weekly.on = !!on;
        saveMem();
        log("周报提醒：" + (on ? "开" : "关"));
        return { ok: true, weeklyOn: !!on };
    } catch (e) { return { ok: false, msg: String(e) }; }
});
web.jsBridge.handle("setChar", function (event, mode) {
    try {
        ST.mode = (mode === "genki" || mode === "nurse") ? mode : "auto";
        if (ST.mode !== "auto") ST.lastUsed = ST.mode;
        var charId = curChar();
        setFace(idleEmo(), 0);
        saveState();
        log("切换角色：" + ST.mode);
        presentSay(charId, (CARECORE.CHARS[charId] || {}).name + "上线！戳戳我试试", (CARECORE.CHARS[charId] || {}).name + "，上线", "happy", ST.soundOn && !CARECORE.inDnd(QCFG, nowMinOf(Date.now())));
        return { ok: true, mode: ST.mode, curChar: charId };
    } catch (e) { return { ok: false, msg: String(e) }; }
});
web.jsBridge.handle("setSound", function (event, on) {
    try {
        ST.soundOn = !!on; saveState();
        if (!ST.soundOn) { try { if (TTS.inst) TTS.inst.stop(); } catch (e0) {} }
        log("声音总开关：" + (ST.soundOn ? "开" : "关"));
        return { ok: true, soundOn: ST.soundOn };
    } catch (e) { return { ok: false, msg: String(e) }; }
});
web.jsBridge.handle("setFloat", function (event, on) {
    try { return on ? showFace() : hideFace(); } catch (e) { return { ok: false, msg: String(e) }; }
});
// 2026-10-23（主人点单）：其他播报的详略开关。v=0 不读 / 1 只读摘要 / 2 读完整；不是这几个值就当 1。
web.jsBridge.handle("sayModeSet", function (event, v) {
    try {
        var n = Number(v);
        ST.sayMode = (n === 0 || n === 2) ? n : 1;
        saveState();
        log("播报模式=" + ST.sayMode + "（0 不读 / 1 摘要 / 2 完整）");
        return { ok: true, sayMode: ST.sayMode };
    } catch (eSM) { return { ok: false, msg: String(eSM) }; }
});
// 2026-10-25（主人点单「自己动时该说话」＋「能自己变小变大躲藏」）：两个自主行为开关，落盘、重装不丢
web.jsBridge.handle("d3TalkSet", function (event, on) {
    try {
        ST.d3Talk = !!on; saveState();
        log("自己动时说话=" + ST.d3Talk);
        return { ok: true, d3Talk: ST.d3Talk };
    } catch (eDT) { return { ok: false, msg: String(eDT) }; }
});
web.jsBridge.handle("d3AutoSet", function (event, on) {
    try {
        ST.d3Auto = !!on; saveState();
        try { D3AUTO.next = 0; } catch (eDA0) {}
        log("自主变小/躲藏=" + ST.d3Auto);
        return { ok: true, d3Auto: ST.d3Auto };
    } catch (eDA) { return { ok: false, msg: String(eDA) }; }
});
// 2026-10-25（主人「随时听到外面的声音」）：常听环境声开关（默认开），与门限设置
web.jsBridge.handle("ambSet", function (event, on) {
    try {
        ST.ambOn = !!on; saveState();
        if (ST.ambOn) ambStart(); else ambStop();
        return { ok: true, ambOn: !!AMB.on };
    } catch (eAB) { return { ok: false, msg: String(eAB) }; }
});
web.jsBridge.handle("ambThSet", function (event, v) {
    try {
        var n = Number(v);
        if (n >= 200 && n <= 12000) { ST.ambTh = Math.round(n); saveState(); }
        log("常听门限=" + ST.ambTh);
        return { ok: true, ambTh: ST.ambTh };
    } catch (eAT) { return { ok: false, msg: String(eAT) }; }
});
// 2026-10-25（主人点单）：3D 人固定在那里循环演全部动作 / 回到"自己乱逛"模式
web.jsBridge.handle("d3ShowSet", function (event, on) {
    try {
        ST.d3Show = !!on; saveState();
        if (ST.d3Show) {
            if (!D3.on) { try { d3Open(); } catch (eO0) {} }
            try { d3Load("careLoopAll(true," + (Number(ST.d3LoopMs) || 3000) + ")"); } catch (eL1) {}
            try { d3Behave("stand"); } catch (eB0) {}
            log("3D 固定表演：开（循环全部动作）");
        } else {
            try { d3Load("careLoopAll(false)"); } catch (eL2) {}
            try { d3Standby(); } catch (eS0) {}
            log("3D 固定表演：关（恢复自己走动/变形）");
        }
        return { ok: true, d3Show: !!ST.d3Show };
    } catch (eDS) { return { ok: false, msg: String(eDS) }; }
});
web.jsBridge.handle("quietSet", function (event, d) {
    try {
        d = d || {};
        if (typeof d.dndOn === "boolean") QCFG.dndOn = d.dndOn;
        if (typeof d.from === "string" && CARECORE.parseHHMM(d.from) !== null) QCFG.from = d.from;
        if (typeof d.to === "string" && CARECORE.parseHHMM(d.to) !== null) QCFG.to = d.to;
        if (typeof d.capCel === "number" && d.capCel >= 0) QCFG.capCel = Math.min(20, Math.round(d.capCel));
        if (typeof d.capCon === "number" && d.capCon >= 0) QCFG.capCon = Math.min(20, Math.round(d.capCon));
        if (typeof d.minGapSec === "number" && d.minGapSec >= 10) QCFG.minGapSec = Math.min(3600, Math.round(d.minGapSec));
        if (typeof d.ignoreHours === "number" && d.ignoreHours >= 1) QCFG.ignoreHours = Math.min(48, Math.round(d.ignoreHours));
        saveQuiet();
        log("安静策略更新：" + JSON.stringify(QCFG));
        return { ok: true, quiet: { dndOn: QCFG.dndOn, from: QCFG.from, to: QCFG.to, capCel: QCFG.capCel, capCon: QCFG.capCon, minGapSec: QCFG.minGapSec, ignoreHours: QCFG.ignoreHours } };
    } catch (e) { return { ok: false, msg: String(e) }; }
});
web.jsBridge.handle("chat", function (event, msg) { try { return doChat(msg); } catch (e) { return { ok: false, msg: String(e) }; } });
// ===== v1.5.3：文件聊天桥（只给 ccode/自动化做端到端验证用；走的是同一条 doChat，不改任何对话逻辑）=====
// 【为什么】WebView 的输入框无法从外部可靠驱动（2026-10-18 13:5x 实测：setText / input() / normal 模式
//   都进不了 DOM，页面读到的还是空，点发送也不动）——而主人要求「你自己去测试谈心里发所有记账的费用」。
//   所以开一个文件口：写 脚本/关心_聊天请求.json {id,msg} → App 执行 doChat(msg) → 回 脚本/关心_聊天结果.json。
// 【注意】只读请求、只写结果；id 与上次不同才处理（防重复执行）；不改变任何对话/记账逻辑。
// 【运行期会变】请求/结果文件路径固定在 脚本/ 目录；id 建议用时间戳。
var FC_REQ = BASE + "/关心_聊天请求.json", FC_RES = BASE + "/关心_聊天结果.json", FC_LAST = "";
// 测试流量隔离开关：由文件聊天桥在读请求时置位（见下方 tick），saveMem 看到它就只改内存不写盘。
var NO_SAVE = false;
// 判断“这条请求是不是测试”：只有 ccode/自动化会带 test 字段，主人的聊天永远不带。
function fcIsTest(o) { try { return !!(o && (o.test === true || o.test === 1 || o.test === "1" || o.test === "true")); } catch (e) { return false; } }
// v1.9.5（2026-10-18 23:27 实锤：同一句「晚饭花了 10 块…帮我记到账本」在 19:05 与 22:05 各执行了一次 →账本出现两笔 10 元）：
//   FC_LAST 只在内存里，App 一重启就清空；启动时只跳过「文件 mtime >120 秒」的旧请求——
//   所以只要重启发生在写请求后 2 分钟内（装完包/被杀后自动拉起很常见），同一请求就会被再执行一遍。
//   修法（纯粹的传输层幂等，不是判断）：把「处理过的 id」落盘，启动时先读回来。
var FC_SEEN = BASE + "/_关心_聊天桥_已处理.txt";
try { var _seen0 = String(files.read(FC_SEEN) || "").trim(); if (_seen0) FC_LAST = _seen0; } catch (_eSeen0) {}
function fcMarkSeen(id) { try { files.write(FC_SEEN, String(id)); } catch (e) {} }   // 已处理就落盘，防重启重放

// 【启动时跳过 2 分钟前的旧请求】2026-10-18 17:13 实证：App 刚重启就把上一轮留在文件里的
//   「看下路况」又执行了一遍（路况窗自己弹出来），因为 FC_LAST 一重启就清空。
//   规则：文件存在且 mtime 早于 120 秒 → 直接把它的 id 记为已处理（只打日志不执行）；
//   2 分钟内的新请求照常执行（ccode 刚写进来就拉起 App 的测试不受影响）。
try {
    var _f0 = new java.io.File(FC_REQ);
    if (_f0.exists() && (Date.now() - _f0.lastModified() > 120000)) {
        var _o0 = null;
        try { _o0 = JSON.parse(readText(FC_REQ) || ""); } catch (_e0) {}
        if (_o0 && _o0.id) {
            FC_LAST = _o0.id; fcMarkSeen(_o0.id);
            log("文件聊天桥：启动时跳过旧请求 " + _o0.id);
            // 2026-10-21（用户报「导航去路我没说过」）：跳过之后**把请求文件删了**——
            //   以前只标记不删，这个文件会一直躺在脚本目录里；重启时只要读目录恰好失败一下（权限没就绪），
            //   它就又会被当成新请求执行一遍（实测 20:19:02 就这么跑了一次）。
            try { files.remove(FC_REQ); } catch (eDel0) {}
        }
    }
} catch (_e00) {}
setInterval(function () {
    try {
        var raw = readText(FC_REQ);
        if (!raw) return;
        var o = null; try { o = JSON.parse(raw); } catch (eP) { return; }
        if (!o || !o.id || o.id === FC_LAST || !o.msg) return;
        FC_LAST = o.id;
        fcMarkSeen(o.id);
        // 2026-10-21：取到就删（同一份 id 在重启后可被重放，实测 20:19 把 10-19 的旧请求又跑了一遍）；
        //   结果仍正常写 关心_聊天结果.json，对 ccode 的测试台无影响。
        try { files.remove(FC_REQ); } catch (eDel1) {}
        // 2026-10-18 13:58 实测：这套 tick 跑在主线程，doChat 里发 HTTP 直接
        // java NetworkOnMainThreadException（Android 禁止主线程联网）→ 必须丢进工作线程。
        threads.start(function () {
            var q = String(o.msg), qid = o.id, isTest = fcIsTest(o);
            var rep = null;
            var snap = null;
            if (isTest) { NO_SAVE = true; try { snap = JSON.stringify(MEM); } catch (eS) {} }
            try { rep = doChat(q); } catch (eC) { rep = { ok: false, msg: String(eC) }; }
            finally {
                if (isTest) {
                    NO_SAVE = false;
                    if (snap) { try { MEM = JSON.parse(snap); } catch (eR) {} }   // 测试改了内存也吐回去，不留痕
                    try { log("测试流量：已隔离（不落盘、内存已回滚）"); } catch (eL2) {}
                }
            }
            var txt = (rep && (rep.reply || rep.text || rep.msg)) || "";
            try { files.write(FC_RES, JSON.stringify({ id: qid, ts: new Date().toLocaleString(), ok: !!(rep && rep.ok), reply: String(txt), act: (rep && rep.act) || "" })); } catch (eW) {}
            try { log("文件聊天桥：" + q.slice(0, 20) + " → " + String(txt).slice(0, 60)); } catch (eL) {}
        });
    } catch (e) {}
}, 3000);
// ===== v1.5.5：MEM 自愈重载（治「重装后权限被重置 → App 以旧副本启动 → 面板一直显示旧数据」）=====
// 【为什么】装完/授权前 App 启动会读私有旧副本，之后即使权限恢复，内存里还是旧数据，
//   必须等下一次写才触发合并——于是主人看到的账本/档案长时间「没变」。
// 【注意】只在 MEM_STALE 为真时动手；合并用 careMergeMem（主目录优先、按时间去重），合并不了就保持原样不写。
// v2.1.6（2026-10-19 02:2x 实测）：原来只在 8 秒定时器里自愈——重装后**头几秒**的消息会抢在它前面，
//   读到私有旧副本（02:22:46 那句「昨天没记账」，同一秒才出现「MEM 采纳磁盘新版本 money 0→6」）。
//   抽成 careMemHealNow()：启动时立刻跑一次 + 每次聊天前再跑一次（已是最新就秒返回）。
function careMemHealNow() {
    try {
        if (!MEM_STALE) return false;
        var t = readText(MEM_P);
        if (!t) return false;
        var o = null;
        try { o = JSON.parse(t); } catch (eJ) { return false; }
        if (!o) return false;
        MEM = careMergeMem(o, MEM);
        MEM_STALE = false;
        try { log("MEM 自愈重载：主目录已可读 → 已合并（facts " + ((MEM.facts || []).length) + "，fixed " + ((MEM.fixed || []).length) + "，money " + ((MEM.money || []).length) + "）"); } catch (eL) {}
        return true;
    } catch (e) { return false; }
}
// ===== 待补记队列（2026-10-25）=====
// 【为什么要】10-24 一天里四次 DNS 抽风（14:19/15:47/20:41/22:00），每次都只回「没接通」，
//   那句话就没了，主人得自己回一个「？」才重新发一遍——钱、饭、状态都可能这么丢。
// 【做什么】没接通时把原话落盘（最多 20 条）；后台每分钟看一次，距上次尝试 ≥5 分钟、有网就重试最老一条；
//   成功了就补进聊天记录并主动说一句「刚才那句补上了」，然后从队列里删掉。
// 【边界】只存「本轮零工具」的失败（动过手的重跑会重复记账）；噪声/幻觉转写不存；AI 关着不跑。
// 【失败表现】日志必写「待补记：…」——没这个前缀就是没进队列。
var CARE_PENDING_P = BASE + "/关心_待补记.json";
var _PEND = { last: 0, busy: false };
function carePendingLoad() { try { return JSON.parse(readText(CARE_PENDING_P) || "[]") || []; } catch (e) { return []; } }
function carePendingSave(a) { try { saveJSON(CARE_PENDING_P, (a || []).slice(-20)); } catch (e) { try { log("待补记：落盘失败 " + e); } catch (e2) {} } }
function carePendingPush(text) {
    try {
        var s = String(text || "").replace(/^🎤\s*/, "").trim();
        if (s.length < 2) return;
        var a = carePendingLoad();
        for (var i = 0; i < a.length; i++) { if (a[i] && a[i].s === s && Date.now() - (a[i].t || 0) < 10 * 60000) return; }
        a.push({ t: Date.now(), s: s.slice(0, 200) });
        carePendingSave(a);
        log("待补记：模型没接通，先把他这句存下来（队列 " + a.length + " 条）：" + s.slice(0, 24));
    } catch (e) { try { log("待补记入队异常：" + e); } catch (e2) {} }
}
function carePendingTick() {
    try {
        if (_PEND.busy || !ST.aiOn) return;
        var a = carePendingLoad(); if (!a.length) return;
        if (Date.now() - _PEND.last < 5 * 60000) return;
        _PEND.last = Date.now(); _PEND.busy = true;
        var item = a[0];
        threads.start(function () {
            try {
                var ar = aiChatWithTools(item.s, curChar());
                if (!ar || !ar.ok) { log("待补记：还是没接通，留着下次（" + String((ar && ar.msg) || "") + "）"); return; }
                var rest = carePendingLoad().filter(function (x) { return !(x && x.t === item.t && x.s === item.s); });
                carePendingSave(rest);
                MEM.chat.push({ t: Date.now(), me: "（补记·原话）" + item.s, pet: ar.text, char: curChar(), eng: "ai(retry)", tn: (ar.tools || []).length });
                if (MEM.chat.length > 60) MEM.chat.shift();
                saveMem();
                presentSay(curChar(), "刚才那句网络没通，现在补上了：" + String(ar.text || "").slice(0, 40), "补上了", "happy", ST.soundOn && !CARECORE.inDnd(QCFG, nowMinOf(Date.now())));
                log("待补记：补上了（剩 " + rest.length + " 条）");
            } catch (e) { try { log("待补记重试异常：" + e); } catch (e2) {} }
            finally { _PEND.busy = false; }
        });
    } catch (e) { _PEND.busy = false; }
}
setInterval(carePendingTick, 60000);
setInterval(careMemHealNow, 8000);
// 2026-10-22：启动 90 秒后补一次缺元素的饭（错开启动风暴；主人多半正开着面板）
setTimeout(function () { try { careDietBackfillElems(2); } catch (eBF0) { try { log("元素回填定时异常：" + eBF0); } catch (eBF1) {} } }, 90000);
try { careMemHealNow(); } catch (eH1) {}web.jsBridge.handle("factAdd", function (event, text) {
    try {
        var r = CARECORE.factAdd(MEM.facts, text);
        if (r.ok) { saveMem(); log("记忆+：" + String(text).slice(0, 40)); }
        return { ok: r.ok, dup: r.dup, msg: r.msg || "", facts: MEM.facts.slice(-12) };
    } catch (e) { return { ok: false, msg: String(e) }; }
});
web.jsBridge.handle("factDel", function (event, key) {
    try {
        var r = CARECORE.factDel(MEM.facts, key);
        if (r.ok) { saveMem(); log("记忆-：" + String(key).slice(0, 40)); }
        return { ok: r.ok, msg: r.msg || "", facts: MEM.facts.slice(-12) };
    } catch (e) { return { ok: false, msg: String(e) }; }
});
web.jsBridge.handle("poke", function () { try { return doPoke(); } catch (e) { return { ok: false, msg: String(e) }; } });
web.jsBridge.handle("sayTest", function () {
    try {
        var charId = curChar();
        var line = "你好呀，我是你的" + (CARECORE.CHARS[charId] || {}).name;
        presentSay(charId, line, line, "happy", ST.soundOn);
        return { ok: true, line: line, tts: TTS.ready, soundOn: !!ST.soundOn };
    } catch (e) { return { ok: false, msg: String(e) }; }
});
web.jsBridge.handle("voiceToggle", function () { try { return voiceToggle(); } catch (e) { return { ok: false, msg: String(e) }; } });
web.jsBridge.handle("voiceLive", function () { try { return toggleVoiceLive(); } catch (e) { return { ok: false, msg: String(e) }; } });
web.jsBridge.handle("camLive", function () { try { return toggleVideoLive(); } catch (e) { return { ok: false, msg: String(e) }; } });
web.jsBridge.handle("toggle3D", function () { try { return toggleD3(); } catch (e) { return { ok: false, msg: String(e) }; } });
// v1.6.0：轨迹窗（面板「🛣 我的轨迹」）
web.jsBridge.handle("trackOpen", function (event, dayOffset) { try { return trkOpen(parseInt(dayOffset, 10) || 0); } catch (e) { return { ok: false, msg: String(e) }; } });
web.jsBridge.handle("trackClose", function () { try { return trkClose(); } catch (e) { return { ok: false, msg: String(e) }; } });
// v1.6.5（用户 19:0x「我让你把轨迹地图窗口的开关加上」）：一个开关管开/关（面板文字就是状态）
web.jsBridge.handle("trackToggle", function () {
    try {
        if (TRK_ON) { trkClose(); return { ok: true, on: false }; }
        return trkOpen(0);
    } catch (e) { return { ok: false, msg: String(e) }; }
});
web.jsBridge.handle("trackToday", function () { try { var a = trkAnalyze(trkReadDay(trkDayKey(Date.now()))); return { ok: true, text: trkSummary(0), distM: Math.round(a.distM), driveMs: a.driveMs, stops: a.stops.length, state: trkStateNow() }; } catch (e) { return { ok: false, msg: String(e) }; } });
// v0.2.3（2026-10-16 用户点单「全屏拖动」）：3D 页面拖动手势=移动整个浮窗（增量物理px）
web.jsBridge.handle("moveWin", function (mx, my) {
    try {
        if (!D3.on || !D3.win) return { ok: false };
        var dx = Math.round(Number(mx) || 0), dy = Math.round(Number(my) || 0);
        var sw = 1080, sh = 2400;
        try { sw = device.width; sh = device.height; } catch (e) {}
        D3.x += dx; D3.y += dy;
        if (D3.x < 0) D3.x = 0;
        if (D3.y < 0) D3.y = 0;
        if (D3.x > sw - D3_W) D3.x = Math.max(0, sw - D3_W);
        if (D3.y > sh - D3_H) D3.y = Math.max(0, sh - D3_H);
        D3.win.setPosition(D3.x, D3.y);
        D3.nextRoam = Date.now() + 120000;
        return { ok: true };
    } catch (e) { return { ok: false, msg: String(e) }; }
});
web.jsBridge.handle("setAI", function (event, on) { try { ST.aiOn = !!on; saveState(); log("AI 大脑：" + (ST.aiOn ? "开" : "关")); return { ok: true, aiOn: ST.aiOn }; } catch (e) { return { ok: false, msg: String(e) }; } });
// 2026-10-23 主人点单：单击悬浮人＝出输入框（默认）还是直接语音，由 App 界面这个开关定
web.jsBridge.handle("setTapMode", function (event, mode) {
    try {
        ST.tapMode = (String(mode) === "voice") ? "voice" : "input";
        saveState();
        log("单击悬浮人：" + (ST.tapMode === "voice" ? "直接语音对话" : "出输入框"));
        return { ok: true, tapMode: ST.tapMode };
    } catch (e) { return { ok: false, msg: String(e) }; }
});
web.jsBridge.handle("camShot", function () { try { return cameraShot(); } catch (e) { return { ok: false, msg: String(e) }; } });
web.jsBridge.handle("albumPick", function () { try { return albumPick(); } catch (e) { return { ok: false, msg: String(e) }; } });
// 2026-10-23（主人点单）：页面里用 <input type="file"> 选图（照 3D 管理的做法），页面读成 base64 传过来。
//   这里直接把图写到 关心_照片/b<时间>.jpg，再走同一个 analyzePhoto（同一套看图/营养/播报）。
//   【为什么这么绕】脚本侧调系统相册拿不到回调；页面里的 file input 是 WebView 自己管的，能拿到文件。
//   【失败表现】日志「页面选图失败：…」/「页面选图 → 路径（N 字节）」——一看就知道有没有落地。
web.jsBridge.handle("photoB64", function (event, d) {
    try {
        var b64 = String((d && d.b64) || "");
        if (!b64) return { ok: false, msg: "空图" };
        var dir = new java.io.File(BASE + "/关心_照片");
        if (!dir.exists()) dir.mkdirs();
        var f = new java.io.File(dir, "b" + Date.now() + ".jpg");
        var bytes = android.util.Base64.decode(b64, android.util.Base64.DEFAULT);
        var os = new java.io.FileOutputStream(f);
        os.write(bytes); os.close();
        log("页面选图 → " + f.getAbsolutePath() + "（" + bytes.length + " 字节）");
        var fp = String(f.getAbsolutePath());
        threads.start(function () { analyzePhoto(fp); });
        return { ok: true, path: fp, bytes: bytes.length };
    } catch (e) { log("页面选图失败：" + e); return { ok: false, msg: String(e) }; }
});
web.jsBridge.handle("camAsk", function () {
    try {
        var granted = true;
        try { granted = context.checkSelfPermission("android.permission.CAMERA") === 0; } catch (e0) {}
        if (!granted) {
            try { runtime.requestPermissions(["android.permission.CAMERA"]); } catch (e1) {}
            sleep(1800);
            try { granted = context.checkSelfPermission("android.permission.CAMERA") === 0; } catch (e2) {}
        }
        return { ok: true, granted: granted };
    } catch (e) { return { ok: false, msg: String(e) }; }
});
web.jsBridge.handle("simEvent", function (event, kind) { try { return simEvent(kind); } catch (e) { return { ok: false, msg: String(e) }; } });
web.jsBridge.handle("openOverlayPerm", function () {
    try {
        var it5 = new android.content.Intent("android.settings.action.MANAGE_OVERLAY_PERMISSION");
        it5.setData(android.net.Uri.parse("package:" + context.getPackageName()));
        it5.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK);
        context.startActivity(it5);
        return { ok: true };
    } catch (e) {
        try {
            var it6 = new android.content.Intent("android.settings.APPLICATION_DETAILS_SETTINGS");
            it6.setData(android.net.Uri.parse("package:" + context.getPackageName()));
            it6.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(it6);
            return { ok: true };
        } catch (e2) { return { ok: false, msg: String(e2) }; }
    }
});
web.jsBridge.handle("openBattPerm", function () {
    try {
        var it = new android.content.Intent("android.settings.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS");
        it.setData(android.net.Uri.parse("package:" + context.getPackageName()));
        it.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK);
        context.startActivity(it);
        return { ok: true };
    } catch (e) {
        try {
            var it2 = new android.content.Intent(android.provider.Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
            it2.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(it2);
            return { ok: true };
        } catch (e2) { return { ok: false, msg: String(e2) }; }
    }
});
web.jsBridge.handle("diag", function (event, msg) { try { var mD = String(msg); log("页面→ " + mD.slice(0, 160)); if (mD.indexOf("路况") >= 0 && mD.indexOf("就绪") >= 0) MAP_READY = true; } catch (e) {} return { ok: true }; });// v1.5.11：面板「🚦路况」按钮与页面内关闭（路况图是高德图层，只负责弹/关/标目的地）
web.jsBridge.handle("traffic", function (event, dest) { try { return careMapOpen(dest); } catch (e) { return { ok: false, msg: String(e) }; } });
web.jsBridge.handle("closeTraffic", function () { try { return careMapClose(); } catch (e) { return { ok: false, msg: String(e) }; } });
BEACON("A4 桥注册完成");

// ===== 启动序列 =====
try { threads.start(function () { sleep(1500); ttsInit(); }); } catch (eT2) {}
threads.start(function () { for (;;) { try { careHealthTick(); } catch (eHT) {} try { careMealTick(); } catch (eMT) {} try { careWeeklyTick(); } catch (eWT) {} try { careProbeTick(); } catch (ePT) {} try { careProactiveTick(); } catch (ePR) {} try { careFatigueTick(); } catch (eFT) {} try { carePlanTick(); } catch (ePL) {} try { careEnsureDailyFixed(); } catch (eFD2) {} try { careForecastTick(); } catch (eFC) {} try { careAnalysisBridge(); } catch (eAB) {} sleep(600000); } });
// 【2026-10-19 ccode·屏幕时长】独立 2 分钟节拍：落盘 + 连续亮屏判定。
// 为什么不留在上面那条 10 分钟线程里：那条每分钟干的事太多（健康/饮食/周报/问询/疲劳都要 saveMem），
// 把屏幕落盘挤到 10 分钟一次，App 一被杀就丢一大截（实测今天记 0 分钟、实际几小时）。
threads.start(function () { for (;;) { try { careScreenPersist(); } catch (eSP2) {} try { careScreenLongTick(); } catch (eSL) {} sleep(120000); } });
// v0.6.0：跑网约车的「自动粗判休息」要 60 秒节拍（熄屏/亮屏变化不能等 10 分钟）
threads.start(function () { for (;;) { try { careFatigueTick(); } catch (eFT2) {} sleep(60000); } });
// v0.6.0：定位节拍（只在用户打开定位监测时干活；默认关）
threads.start(function () { for (;;) { try { careLocTick(); } catch (eLT) {} sleep(300000); } });// v0.5.0：屏幕自采样（每 60s 一次，内存累计、10 分钟随健康节拍落盘；重启后从当日已落盘值续算）
threads.start(function () {
    try { var dk0 = careDayKey(Date.now()); if (MEM.health.screen && MEM.health.screen[dk0]) { SCR.d = dk0; SCR.min = Number(MEM.health.screen[dk0]) || 0; } } catch (e0) {}
try { scrSpanLoad(); } catch (eSPL) {}   // 2026-10-21：把今天的亮屏时段接回来（别一重启就丢）
    for (;;) { try { careScreenSample(Date.now(), device.isScreenOn()); } catch (eS) {} sleep(60000); }
});
// 2026-10-16 用户拍板：经典悬浮宠物停用（不再自动显示），仅 3D；真需回滚时把下面条件改回 ST.floatOn
if (ST.floatOn && false) {
    try { threads.start(function () { sleep(2200); try { var r = showFace(); log("自动显示宠物：" + JSON.stringify(r)); } catch (e) { log("自动显示宠物异常：" + e); } }); } catch (eF) {}
}
try {
    if (!allFilesOk()) {
        try { threads.start(function () { sleep(900); jumpAllFilesOnce("启动自检"); }); } catch (eJF) {}
        threads.start(function () { sleep(4200); try { showBubble(curChar(), "主人～「所有文件访问」开着我才写得下小本本（设置页已帮你打开，拨开就回来）"); } catch (eB3) {} });
    }
} catch (eAF3) {}
if (ST.d3On && !ST.d3Show) {
    try { threads.start(function () { sleep(2600); try { var r3 = d3Open(); log("自动显示3D小人：" + JSON.stringify(r3)); } catch (e3) { log("自动显示3D异常：" + e3); } }); } catch (eF3) {}
}
// 2026-10-25（主人：「不管我悬浮人开没开它都要显示在那里」）：固定表演模式下**无条件常驻**——
//   不看 ST.d3On，也不看悬浮开关；要收起来只能先关面板「固定循环动作」。
if (ST.d3Show) {
    ST.d3On = true;
    try { threads.start(function () { sleep(1200); try { var _r3a = d3Open(); log("3D 常驻显示：" + JSON.stringify(_r3a)); } catch (e3a) { log("3D 常驻显示异常：" + e3a); } }); } catch (e3b) {}
}
// 2026-10-25（主人点单「随时都能听到外面的一切声音」）：常听环境声——默认开，面板可关；晚点起，错开启动风暴
// 重装会把录音权限重置（13:24 实测 setAudioSource failed），所以启动时单独弹一次授权框（子线程，不阻塞启动）
try {
    threads.start(function () {
        sleep(1800);
        try {
            if (!recPermOk()) {
                log("启动：申请麦克风权限（重装后会重置，需点一次允许）");
                runtime.requestPermissions(["android.permission.RECORD_AUDIO"]);
                sleep(1200);
                log("启动：麦克风权限" + (recPermOk() ? "已允许" : "仍未允许（常听/语音都用不了，去系统设置给一下）"));
            }
        } catch (ePm) { log("启动申请麦克风权限异常：" + ePm); }
    });
} catch (ePm2) {}
if (ST.ambOn) {
    try { threads.start(function () { sleep(7000); try { var ra0 = ambStart(); log("常听环境：启动 " + JSON.stringify(ra0)); } catch (ea0) { log("常听启动异常：" + ea0); } }); } catch (ea1) {}
}
// v1.6.0：上次开着「定位监测」→ 启动就继续采轨迹（不然重启一次就断到下次手动开关）
try {
    if (MEM.work && MEM.work.gps) {
        threads.start(function () {
            sleep(3000);
            // v1.6.2（2026-10-18 18:45 实机）：重装会把定位权限重置，而「定位监测」开关还记着开——
            //   于是启动续采直接报「没授权定位」，一个点也不记。这里补一次运行时申请（正常授权弹窗，不是设置页）。
            try {
                if (!careLocPermOk()) {
                    try { runtime.requestPermissions(["android.permission.ACCESS_FINE_LOCATION", "android.permission.ACCESS_COARSE_LOCATION"]); } catch (eP0) {}
                    sleep(2200);
                }
            } catch (eP1) {}
            try { var _rs0 = trkStart(); log("轨迹：启动续采 " + JSON.stringify(_rs0)); } catch (eTS0) { log("轨迹续采异常：" + eTS0); }
        });
    }
} catch (eTS1) {}
log("关心 v" + VER + " 启动：角色=" + ST.mode + " 声音=" + ST.soundOn + " 悬浮=" + ST.floatOn + " 水位=" + (ST.watermark ? ST.watermark.count : "无") + " 记忆条=" + MEM.facts.length + " 对话条=" + MEM.chat.length);
BEACON("A5 启动完成");
