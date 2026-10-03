console.show();
// ========== 文件日志：log() 同时写文件（实时落盘）+ 打日志窗 ==========
// 本机魔改版 Rhino 静默忽略 console.log 的赋值（实测），无法重定义双写。
// 方案：定义全局 log()，脚本内所有 log( 已由 sed 批量替换为 log(。
var LOG_FILE = "/storage/emulated/0/脚本/巡检_日志.log";
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
// ========== 灵感雷达 · 产品巡检（自动意见闭环）==========
// 每次巡检覆盖全部基线产品：静态检查零 token 全查；LLM 审查按「今日变更优先 + 最久未审优先」逐个进行，
// 预算余量不足时自动降级为仅静态（与主脚本共享每日预算，预留 40000 余量给主脚本）
// 发现问题直接提交「意见」issue（label=自检+意见），主脚本闭环自动评分：总分≥21 且判定采纳才自动改进上线，不采纳自动回复关闭
// 同产品已有 open 意见不重提；同一天最多重报 3 次：主脚本改不好 → 下一轮立刻再报 → 再改，自愈快且不会死循环烧 token
// 建议在 AutoJs 里设置定时任务 12:00（主脚本 09:00 跑完后），手动重跑本脚本 = 立即巡检一轮
// 与主脚本共享每日 token 预算（token预算.json），并预留 40000 余量给主脚本运行

// ========== 密钥统一外置（与主脚本同款）==========
const SECRET_PATH = "/storage/emulated/0/脚本/雷达密钥.json";
function loadSecrets() {
    try {
        let j = JSON.parse(files.read(SECRET_PATH));
        if (j && typeof j === "object") return j;
    } catch (e) {
        log("❌ 密钥配置文件读取失败：" + e + "（将跳过需要密钥的环节）");
    }
    return {};
}
const SEC = loadSecrets();
const WX_HOOK = SEC.wx_hook || "";
const GITHUB_USER = SEC.github_user || "";
const GITHUB_TOKEN = SEC.github_token || "";
const GITHUB_REPO = SEC.github_repo || "apps";

// ========== API 池：多 Key 轮换 + 模型政策共享 + 限流冷却 + 预算共享 ==========
// 模型政策与主脚本共享一份事实源：主脚本每轮从 GitHub 仓库 model_policy.json 同步到本地缓存
// /storage/emulated/0/脚本/模型政策.json，本脚本只读这份缓存（内置默认兜底），不重复拉远程。
// 字段：name=模型名；commercial=false 表示条款禁止商用（自动跳过）；price=0免费/1低/2中/3高；
// quality=1-5 能力分。排序：日常=性价比优先（价格低→能力强）；quality 模式=能力优先、同分取便宜。
// 429 限流：该模型冷却 5 分钟（与主脚本共享 模型冷却.json，跨脚本跨运行生效）；401/403：换 Key。
const ZP_KEYS = SEC.zp_keys || [];
if (!ZP_KEYS.length) log("⚠️ ZP_KEYS 为空：请检查雷达密钥.json（LLM 审查将跳过）");
if (!WX_HOOK) log("⚠️ WX_HOOK 为空：企微推送将跳过");
const POLICY_PATH = "/storage/emulated/0/脚本/模型政策.json"; // 主脚本每轮同步维护
const COOLDOWN_PATH = "/storage/emulated/0/脚本/模型冷却.json"; // 与主脚本共享
const POLICY_DEFAULT = {
    updated: "",
    note: "内置默认：glm-4-flash 免费且可商用（智谱官方政策）；glm-4-air 付费可商用。",
    models: [
        {name: "glm-4-flash", enabled: true, commercial: true, price: 0, quality: 3},
        {name: "glm-4-air", enabled: true, commercial: true, price: 1, quality: 5}
    ]
};
function loadPolicy() {
    try {
        let p = JSON.parse(files.read(POLICY_PATH));
        if (p && Array.isArray(p.models) && p.models.length) return p;
    } catch (e) {}
    return POLICY_DEFAULT;
}
let MODEL_POLICY = loadPolicy();
function policyTier(quality) {
    let list = (MODEL_POLICY.models || []).filter(function(x) { return x && x.name && x.enabled !== false && x.commercial !== false; });
    list.sort(function(a, b) {
        if (quality) { // 质量模式：能力优先，同分取便宜
            let dq = (b.quality || 0) - (a.quality || 0);
            if (dq !== 0) return dq;
            return (a.price || 0) - (b.price || 0);
        }
        let dp = (a.price || 0) - (b.price || 0); // 日常模式：性价比优先（价格低 → 能力强）
        if (dp !== 0) return dp;
        return (b.quality || 0) - (a.quality || 0);
    });
    return list.map(function(x) { return x.name; });
}
log("📜 模型政策（" + (MODEL_POLICY.updated || "内置默认") + "）候选档位：" + policyTier(false).join(" → "));
function loadCooldowns() {
    try {
        let j = JSON.parse(files.read(COOLDOWN_PATH));
        if (j && typeof j === "object") return j;
    } catch (e) {}
    return {};
}
let MODEL_COOLDOWN = loadCooldowns();
function saveCooldowns() {
    try { files.write(COOLDOWN_PATH, JSON.stringify(MODEL_COOLDOWN)); } catch (e) {}
}
// 冷却键设计（2026-10-03 修，与主脚本保持一致）：429 按「模型@Key指纹」分别冷却（多把 Key 才能真正顶上限流）；
// 网络类错误仍按整个模型冷却（服务端问题，与 Key 无关）。指纹为不可逆短哈希，不泄露 Key 原文。
function keyTag(k) {
    let h = 0;
    for (let i = 0; i < String(k).length; i++) { h = (h * 31 + String(k).charCodeAt(i)) | 0; }
    return (h >>> 0).toString(36).slice(0, 6);
}
function isCooling(model, key) {
    let now = Date.now();
    if (now < (MODEL_COOLDOWN[model] || 0)) return true;
    if (key && now < (MODEL_COOLDOWN[model + "@" + keyTag(key)] || 0)) return true;
    return false;
}
function cooldown(model, secs, key) {
    let now = Date.now();
    let ks = Object.keys(MODEL_COOLDOWN);
    for (let i = 0; i < ks.length; i++) {
        if ((MODEL_COOLDOWN[ks[i]] || 0) < now) delete MODEL_COOLDOWN[ks[i]];
    }
    MODEL_COOLDOWN[key ? (model + "@" + keyTag(key)) : model] = now + secs * 1000;
    saveCooldowns();
}
let keyIdx = 0;
const DAILY_BUDGET = 30000000;  // 与主脚本共用每日预算上限（2026-10-03 由 1000 万提到 3000 万——两处常量必须同步改，否则巡检会先于主脚本停 LLM 审查）；实测峰值≈150K 几乎不触发；单日失控硬顶≈¥30-60
const BUDGET_RESERVE = 40000;  // 巡检最多花到 预算-4万，给主脚本每日运行留余量
const BUDGET_PATH = "/storage/emulated/0/脚本/token预算.json";
function dayKey() {
    let d = new Date();
    return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
}
function dateStr() {
    let d = new Date();
    let p = function(n) { return ("0" + n).slice(-2); };
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
}
function loadBudget() {
    try {
        let j = JSON.parse(files.read(BUDGET_PATH));
        if (j && j.d === dayKey() && typeof j.cost === "number") return j.cost;
    } catch (e) {}
    return 0;
}
function saveBudget() {
    try { files.write(BUDGET_PATH, JSON.stringify({d: dayKey(), cost: dailyTokenCost})); } catch (e) {}
}
let dailyTokenCost = loadBudget();
if (dailyTokenCost > 0) log("💰 今日已累计 " + dailyTokenCost + " token（预算 " + DAILY_BUDGET + "）");

function callLLM(messages, maxTokens, quality, temp) {
    let tier = policyTier(quality);
    if (dailyTokenCost > DAILY_BUDGET) return null; // 统一预算闸门
    for (let k = 0; k < ZP_KEYS.length; k++) {
        let key = ZP_KEYS[(keyIdx + k) % ZP_KEYS.length];
        for (let m = 0; m < tier.length; m++) {
            let model = tier[m];
            if (isCooling(model, key)) { log("🧊 " + model + "@" + keyTag(key) + " 限流冷却中，跳过（换下一把 Key）"); continue; }
            try {
                // 注意：必须用 postJson（对象参数）——AutoJs6 的 http.post 传字符串 body 会强制转对象报错
                let r = http.postJson("https://open.bigmodel.cn/api/paas/v4/chat/completions", {
                    model: model,
                    messages: messages,
                    temperature: temp !== undefined ? temp : 0.3,
                    max_tokens: maxTokens
                }, {
                    headers: {"Authorization": "Bearer " + key, "Content-Type": "application/json"},
                    timeout: 90000
                });
                let sc = r.statusCode;
                if (sc === 200) {
                    let j = r.body.json();
                    if (j && j.choices && j.choices[0]) {
                        keyIdx = (keyIdx + k) % ZP_KEYS.length;
                        let usage = j.usage || {};
                        let cost = (usage.prompt_tokens || 0) + (usage.completion_tokens || 0);
                        dailyTokenCost += cost;
                        saveBudget(); // 与主脚本共享同一预算文件，防双脚本合计失控
                        log("🤖 " + model + " 完成，本轮约 " + cost + " token，今日累计 " + dailyTokenCost + "（预算 " + DAILY_BUDGET + "）");
                        return j.choices[0].message.content;
                    }
                    log("⚠️ " + model + " 返回异常（额度耗尽/参数错误），自动切换下一档…");
                } else if (sc === 429) {
                    log("🚦 " + model + " 限流(429)：冷却 5 分钟并切换…");
                    cooldown(model, 300, key); // 429 按「模型@Key」分别冷却（多把 Key 才能真正顶上限流）
                    break; // 限流可能按 Key 或按模型计，直接换下一个 Key 最稳妥
                } else if (sc === 401 || sc === 403) {
                    log("🔑 Key 无效(HTTP " + sc + ")，自动换下一个 Key…");
                    break;
                } else {
                    log("⚠️ " + model + " 异常(HTTP " + sc + ")，自动切换下一档…");
                }
            } catch (e) {
                log("❌ " + model + " 调用失败：" + e + "，短冷却 60 秒并切换…");
                cooldown(model, 60); // 网络异常（超时/断连）短暂冷却，避免同轮内连续白撞同一个慢模型
            }
            sleep(1500);
        }
    }
    return null;
}

function ghHeaders() {
    return {
        "Authorization": "token " + GITHUB_TOKEN,
        "Content-Type": "application/json",
        "User-Agent": "AutoJs6-Radar-Check",
        "Accept": "application/vnd.github+json"
    };
}

// ========== 企微推送（与主脚本同款分段逻辑）==========
function pushToWx(title, content) {
    if (!WX_HOOK) {
        log("⚠️ 未配置企微 webhook，跳过推送");
        return;
    }
    let chunks = [];
    let rest = content;
    while (rest.length > 550) {
        chunks.push(rest.slice(0, 550));
        rest = rest.slice(550);
    }
    if (rest) chunks.push(rest);
    chunks = chunks.slice(0, 10);
    for (let i = 0; i < chunks.length; i++) {
        let text = (i === 0 ? title + "\n\n" : "") + chunks[i];
        if (i < chunks.length - 1) text += "\n…";
        try {
            let r = http.postJson(WX_HOOK, {msgtype: "text", text: {content: text}}, {timeout: 15000});
            let j = r.body.json();
            if (j && j.errcode !== 0) log("❌ 推送第 " + (i + 1) + " 段失败: errcode " + j.errcode);
            else log("✅ 已推送第 " + (i + 1) + "/" + chunks.length + " 段");
        } catch (e) {
            log("❌ 推送第 " + (i + 1) + " 段失败: " + e);
        }
        sleep(2000);
    }
}

// ========== 质检函数（与主脚本同款，口径一致）==========
const FREE_FOOTER_MARK = "free-ad-standard-2026";
function looksComplete(html) {
    return !!html && html.indexOf("</body>") > 0 && /<\/html>\s*$/i.test(html);
}
function localHardCheck(html) {
    // 系统注入的多语言块（含各语言译文）不参与扫描：译文里可能合法出现“付费/收款/心率带”等字样，不能误杀
    html = stripI18nBlock(html);
    // 硬件依赖检查（放在最前）：含专用硬件词且无“模拟/演示”声明 → 不合格（防“连接设备”型空想产品）
    let hw = ["连接设备", "设备连接", "扫描设备", "脑电波", "脑波", "脑电", "心率带", "血糖仪"];
    for (let i = 0; i < hw.length; i++) {
        if (html.indexOf(hw[i]) >= 0 && html.indexOf("模拟") < 0 && html.indexOf("演示") < 0) return "含" + hw[i] + "依赖但无模拟演示声明";
    }
    if (!html || html.length < 300) return "内容为空或过短";
    let body = html;
    let m = html.indexOf(FREE_FOOTER_MARK);
    if (m >= 0) body = html.slice(0, m);
    let forbidden = [
        ["shoukuan", "收款码"],
        ["checkCode", "激活码算法"],
        ["激活码", "激活码"],
        ["wxid", "微信号收款"],
        ["¥", "价格"],
        ["付费", "付费字样"],
        ["解锁完整版", "付费解锁区块"],
        ["收款", "收款引导"]
    ];
    for (let i = 0; i < forbidden.length; i++) {
        if (body.indexOf(forbidden[i][0]) >= 0) return "含" + forbidden[i][1];
    }
    let required = [
        ["完全免费", "免费声明"],
        ["广告", "广告位标注"]
    ];
    for (let j = 0; j < required.length; j++) {
        if (html.indexOf(required[j][0]) < 0) return "缺少" + required[j][1];
    }
    return "";
}

// ========== 目标选择：全部基线产品 ==========
const PRODUCT_DIR = "/storage/emulated/0/脚本/产出";
const REVIEW_LOG_PATH = "/storage/emulated/0/脚本/巡检历史.json"; // 产品名 → 最近 LLM 审查日期（最久未审优先的公平轮转依据）
const CHECK_LABEL = "自检";
const FB_LABEL = "意见";                    // 与主脚本 FEEDBACK_LABEL 一致：巡检 issue 打此标签进自动闭环
const REPORTED_PATH = "/storage/emulated/0/脚本/巡检已报.json"; // 产品名 → {d: 最后上报日期, n: 当日已报次数}
const MAX_RETRY_PER_DAY = 3;               // 同一产品每天最多重报 3 次：改不好下一轮立刻再报，又限制死循环烧 token
const SWEEP_FLAG_PATH = "/storage/emulated/0/脚本/旧自检清扫完成.json"; // 一次性清扫旧自检 issue 的完成标记

// 基线过滤：排除总览页/关于页与 _vN/_prev 快照（与主脚本 collectProducts 同规则，另排除 about.html）
function collectBaselines() {
    let names = [];
    try {
        names = files.listDir(PRODUCT_DIR, function(n) {
            return n.endsWith(".html") && n !== "index.html" && n !== "about.html" && !/_(?:v\d+|prev)\.html$/.test(n);
        });
    } catch (e) {}
    names.sort();
    return names;
}

// 今日新品/今日改版：今天 0 点后写入过的基线（v2 写回会刷新 mtime）+ 文件名带今天日期前缀的
function todayChanged() {
    let t0 = new Date();
    t0.setHours(0, 0, 0, 0);
    let t0ms = t0.getTime();
    let prefix = dateStr();
    let today = [];
    collectBaselines().forEach(function(n) {
        let f = new java.io.File(PRODUCT_DIR + "/" + n);
        let mtime = 0;
        try { mtime = f.lastModified(); } catch (e) {}
        if (mtime >= t0ms || n.indexOf(prefix) === 0) today.push(n);
    });
    return today;
}

// 审查历史：记录每个产品最近一次 LLM 审查日期（预算闸门降级时，最久未审的优先拿到 LLM 名额，公平轮转）
function loadReviewLog() {
    try {
        let j = JSON.parse(files.read(REVIEW_LOG_PATH));
        if (j && typeof j === "object") return j;
    } catch (e) {}
    return {};
}
function markReviewed(name) {
    let log = loadReviewLog();
    let mt = 0;
    try { mt = new java.io.File(PRODUCT_DIR + "/" + name).lastModified(); } catch (e) {}
    // 记「日期 + 审查时刻 + 当时的文件 mtime」：mtime 是判断「改过没有」的唯一依据
    log[name] = {d: dateStr(), t: Date.now(), mt: mt};
    try { files.write(REVIEW_LOG_PATH, JSON.stringify(log)); } catch (e) {}
}
// 历史里存的可能是新格式 {d,t,mt} 或旧的「日期字符串」，统一取出日期供排序用
function reviewDate(name, log) {
    let r = log[name];
    if (r && typeof r === "object") return r.d || "";
    return r || "";
}
// 【2026-10-03 新增·省 token 的关键闸门】要不要送 LLM 审查
// 背景：原来 39 个产品每轮全部送审 —— 实测单轮 39 × 7854 = 306K token，巡检约 10 分钟一轮，
// 折合约 1.84M/小时，30M 日预算约 16 小时见底。**这才是「token 用得快」的主因**（远大于此前那起双开）。
// 新规则：只审「上次审查之后文件被改动过」的产品；未改动的做 24 小时兜底复检。
// 静态检查（零 token）仍每轮全量跑，发现能力不受影响 —— 省掉的只是反复送审同一份没变过的源码。
function shouldReview(name) {
    let log = loadReviewLog();
    let h = log[name];
    if (!h) return true;                                    // 从没审过 → 必审
    let rec = (h && typeof h === "object") ? h : {d: String(h || ""), t: 0, mt: 0};
    let mt = 0;
    try { mt = new java.io.File(PRODUCT_DIR + "/" + name).lastModified(); } catch (e) {}
    if (mt > (rec.mt || 0)) return true;                     // 上次审查之后被改过 → 必审
    if (!rec.t) return true;                                 // 旧格式没记时间戳 → 本轮审一次并升级格式
    return (Date.now() - rec.t) > 24 * 3600 * 1000;          // 未改动：24 小时兜底复检
}

// 巡检目标 = 全部基线产品：今日变更（新品/改版）排最前（最可能有新问题），其余按「最久未审 → 最近已审」排队；
// 静态检查零 token 全查；LLM 审查逐产品受预算闸门，预算不足时后面的产品自动降级为仅静态
function pickTargets() {
    let picked = [];
    todayChanged().forEach(function(n) {
        if (picked.indexOf(n) < 0) picked.push(n);
    });
    let log = loadReviewLog();
    let rest = collectBaselines().filter(function(n) { return picked.indexOf(n) < 0; });
    rest.sort(function(a, b) {
        let da = reviewDate(a, log);
        let db = reviewDate(b, log);
        if (da !== db) return da < db ? -1 : 1;
        return a < b ? -1 : 1;
    });
    rest.forEach(function(n) { picked.push(n); });
    return picked;
}

// ========== 静态检查层（零 token）==========
function staticCheck(name, html) {
    let issues = [];
    if (!html || html.length < 300) {
        issues.push("文件为空或过短（" + (html ? html.length : 0) + " 字节）");
        return issues;
    }
    if (!looksComplete(html)) issues.push("HTML 不完整（缺 </body> 或 </html> 结尾）");
    let hard = localHardCheck(html);
    if (hard) issues.push("硬检查不通过：" + hard);
    // 产品交互脚本检查：剥离多语言块与头部统计码后，产品部分必须还有 <script>（否则所有按钮都是死按钮）
    let productPart = stripI18nBlock(html);
    let fm = productPart.indexOf("<!-- " + FREE_FOOTER_MARK + " -->");
    if (fm >= 0) productPart = productPart.slice(0, fm);
    productPart = productPart.replace(/<script[^>]*id="LA_COLLECT"[^>]*>\s*<\/script>/gi, "")
        .replace(/<script>\s*if\(typeof LA!==[\s\S]*?<\/script>/gi, "");
    if (!/<script[\s>]/i.test(productPart)) issues.push("产品交互脚本丢失（所有按钮都是死按钮）");
    // 统计埋码版本：无埋码或旧版（协议相对 //sdk / LA.init 裸调无保护）都算问题；重跑 51la 批量脚本可升级
    if (html.indexOf("51.la") < 0) {
        issues.push("未接入 51.la 统计（系统支持自动埋码，重跑「灵感雷达51la批量接入.js」即可补齐）");
    } else if (html.indexOf('typeof LA!=="undefined"') < 0) {
        issues.push("51.la 埋码是旧版（协议相对或无 LA 加载保护，SDK 加载失败会抛 ReferenceError）；重跑「灵感雷达51la批量接入.js」可批量升级");
    }
    // SEO meta：系统已支持自动补全，缺失说明页面还没经过新管线重写（下次优化轮换自动补齐）
    if (html.indexOf('property="og:title"') < 0 || html.indexOf('<meta name="description"') < 0 || html.indexOf('name="theme-color"') < 0) {
        issues.push("SEO meta 不完整（缺 og:title/description/theme-color 之一，下次重写自动补齐）");
    }
    // 多语言块完整性：标记残缺是真问题；完全没有是遗留页（优化轮换会自动注入），仅提示不记问题
    let i18nS = html.indexOf("<!-- radar-i18n-start -->");
    let i18nE = html.indexOf("<!-- radar-i18n-end -->");
    if ((i18nS >= 0 && i18nE < 0) || (i18nS < 0 && i18nE >= 0)) {
        issues.push("多语言块标记残缺（radar-i18n-start/end 不成对，切换器或翻译功能可能失效）");
    } else if (i18nS < 0) {
        log("ℹ️ " + name + " 尚无多语言块（遗留页，优化轮换会自动注入）");
    }
    return issues;
}

// Rhino 编译仅 console 参考（浏览器 ES 语法 Rhino 未必支持，不进报告、不算问题）
function compileAdvisory(name, html) {
    let re = /<script[^>]*>([\s\S]*?)<\/script>/gi;
    let m, bad = 0;
    while ((m = re.exec(html)) !== null) {
        if (!m[1].trim()) continue;
        try {
            new Function(m[1]);
        } catch (e) {
            bad++;
            log("ℹ️ " + name + " 第 " + bad + " 个脚本块 Rhino 编译不过（仅供参考，浏览器环境无碍）：" + e);
        }
    }
}

// ========== LLM 审查层（air 主审，证据匹配过滤防幻觉）==========
// 证据匹配：先精确（空白+引号归一）；模型常把解释性文字混进证据或引号风格不一致（实测导致真发现被误丢），
// 再退而取“代码指纹”——证据里带引号的选择器/id（如 ".btn-secondary"、"inviteBtn"），命中任一个即视为有据可查
function evidenceInSource(evidence, srcNorm) {
    let e = evidence.replace(/\s+/g, "").replace(/'/g, '"');
    if (srcNorm.indexOf(e) >= 0) return true;
    // 代码指纹候选：带引号的选择器/id（".btn-secondary"、"inviteBtn"）+ 带点的类名选择器（.feature-card，可能只出现在 CSS/HTML 里）
    let cands = (e.match(/"[^"]{2,40}"/g) || []).concat(e.match(/\.[A-Za-z_-][A-Za-z0-9_-]{1,40}/g) || []);
    for (let i = 0; i < cands.length; i++) {
        if (srcNorm.indexOf(cands[i]) >= 0) return true;
    }
    return false;
}
// 解析 LLM 输出：格式「问题:x | 证据:源码片段 | 修复建议:x」；证据必须能在源码里匹配（空白/引号归一 + 代码指纹兜底），否则视为幻觉丢弃
function parseFindings(out, src) {
    let findings = [];
    if (!out) return findings;
    if (out.trim() === "无问题") return findings;
    let srcNorm = src.replace(/\s+/g, "").replace(/'/g, '"');
    out.split("\n").forEach(function(line) {
        line = line.trim();
        if (!line || line.indexOf("问题") !== 0) return;
        // 按标签定位切三段（证据里可能含 | 或 ||，不能按 "|" 切分）
        let evIdx = line.indexOf("证据:");
        let adIdx = line.lastIndexOf("修复建议:");
        if (evIdx < 0 || adIdx < 0 || adIdx <= evIdx) return;
        let issue = line.slice(0, evIdx).replace(/^问题[:：]\s*/, "").replace(/\s*\|\s*$/, "").trim();
        let evidence = line.slice(evIdx + 3, adIdx).replace(/^\s*\|\s*/, "").replace(/\s*\|\s*$/, "").trim();
        let advice = line.slice(adIdx + 5).replace(/^\s*\|\s*/, "").trim();
        if (!issue || !advice) return;
        if (evidence) {
            if (!evidenceInSource(evidence, srcNorm)) {
                log("🗑️ 丢弃疑似幻觉发现（证据在源码中找不到）：" + issue);
                return;
            }
        } else {
            evidence = "（未附代码证据）";
        }
        // 模型偶用纯数字当问题标题（问题:1/2/3…），据证据生成可读标题
        if (/^\d{1,2}$/.test(issue)) {
            issue = "疑似问题：" + (evidence.indexOf("（未附") === 0 ? "无证据" : evidence.slice(0, 80));
        }
        findings.push({issue: issue, evidence: evidence, advice: advice});
    });
    return findings.slice(0, 5);
}

// 系统注入的多语言块（radar-i18n-start ~ radar-i18n-end）不送审：脚本生成的固定代码，不是产品源码
function stripI18nBlock(html) {
    if (!html) return html;
    let a = html.indexOf("<!-- radar-i18n-start -->");
    if (a < 0) return html;
    let b = html.indexOf("<!-- radar-i18n-end -->");
    if (b < 0) return html.slice(0, a);
    return html.slice(0, a) + html.slice(b + ("<!-- radar-i18n-end -->").length);
}

function reviewProduct(name, html) {
    if (dailyTokenCost > DAILY_BUDGET - BUDGET_RESERVE) {
        log("💰 预算余量不足（" + dailyTokenCost + "/" + DAILY_BUDGET + "），跳过 LLM 审查层，仅静态检查");
        return null; // null = 预算跳过、本轮未审查（不计入审查历史，下次优先）
    }
    if (!shouldReview(name)) return null; // 源码自上轮审查后没变过 → 不重复送审（null = 本轮未审查，不记历史）
    // 审查视界：20000 会砍掉长产品的交互脚本尾部（实测 AI Code Ment 脚本在 13906-27193 字节），
    // 42KB 级产品（BrainWaveHea 42638）同样被 30000 截断盲区覆盖尾部监测 JS；50000 覆盖当前全部产品（最大 43KB）
    let src = html.length > 50000 ? html.slice(0, 50000) + "\n<!-- 源码过长已截断 -->" : html;
    src = stripI18nBlock(src); // 系统注入的多语言块不送审（固定代码，非产品源码）
    let prompt = "你是严格的产品测试员。下面是已上线单文件 HTML 产品的完整源码（若被截断，截断处之后无法审查）。请逐项检查：\n1) 每个按钮/表单/交互元素是否都有对应 JS 处理，逻辑闭环（不引用页面里不存在的 id/函数/变量）\n2) 状态切换后 UI 是否同步更新（增删改查、计数器、列表渲染）\n3) 有无明显 JS 错误（未定义变量、函数调用参数错误、作用域问题）\n4) 有无残留付费痕迹（价格/收款码/激活码/付费解锁）\n5) 事件绑定是否存在 document.querySelector('.class') 只绑定第一个元素的写法（会导致其余同类按钮全是死按钮）\n6) 有无伪随机假数据（如随机分数+固定提示文案的假评分，数据无真实来源）\n只输出 0-5 条你**有把握**的问题，没有把握的不要写。检查通过的项目禁止输出（如「无明显JS错误」「状态切换后UI同步更新」这类结论不是问题，禁止列出来）。每条一行，格式：\n问题:xxx | 证据:原样引用源码片段 | 修复建议:xxx\n没有问题就只输出：无问题\n产品名：" + name + "\n源码：\n" + src;
    let out = callLLM([
        {role: "system", content: "你是严格的测试员。只按格式输出，禁止解释。"},
        {role: "user", content: prompt}
    ], 1200, true, 0.3); // air 主审（代码理解需要强模型）
    if (!out) return [];
    let findings = parseFindings(out, src);
    if (!findings.length && out.indexOf("无问题") < 0) {
        log("⚠️ " + name + " 审查输出未解析出可验证发现，原文：\n" + out);
    }
    return findings;
}

// ========== 提交层：label 自举 + 指纹冷却去重 + issue + 企微摘要 ==========

// 双标签都要存在（GitHub 对不存在的 label 会拒收 issue）：自检=红色可人工过滤，意见=主脚本闭环自动处理
function ensureLabels() {
    if (!GITHUB_USER || !GITHUB_TOKEN) return;
    let defs = [[CHECK_LABEL, "d73a4a", "产品巡检报告（自动进意见闭环）"], [FB_LABEL, "0e8a16", "用户意见反馈（自动处理）"]];
    for (let i = 0; i < defs.length; i++) {
        let name = defs[i][0];
        try {
            let r = http.get("https://api.github.com/repos/" + GITHUB_USER + "/" + GITHUB_REPO + "/labels/" + encodeURIComponent(name), {headers: ghHeaders(), timeout: 30000});
            if (r.statusCode === 200) continue;
            http.request("https://api.github.com/repos/" + GITHUB_USER + "/" + GITHUB_REPO + "/labels", {
                method: "POST",
                headers: ghHeaders(),
                body: JSON.stringify({name: name, color: defs[i][1], description: defs[i][2]}),
                timeout: 30000
            });
            log("🏷️ 已自动创建 label：" + name);
        } catch (e) {
            log("label " + name + " 处理失败：" + e);
        }
    }
}

// 本地重报台账：同一产品一天最多重报 MAX_RETRY_PER_DAY 次。主脚本闭环处理完会关闭 issue，
// 所以用「是否已有 open 意见」+「当日重报次数」双闸防重复刷屏
function loadReported() {
    try {
        let j = JSON.parse(files.read(REPORTED_PATH));
        if (j && typeof j === "object") return j;
    } catch (e) {}
    return {};
}
function todayReportCount(name) {
    let db = loadReported();
    let rec = db[name];
    if (!rec) return 0;
    if (typeof rec === "string") return rec === dateStr() ? 1 : 0; // 兼容旧格式（纯日期字符串）
    return rec.d === dateStr() ? (rec.n || 0) : 0;
}
function markReported(name) {
    let db = loadReported();
    db[name] = {d: dateStr(), n: todayReportCount(name) + 1};
    let keys = Object.keys(db);
    if (keys.length > 120) keys.slice(0, keys.length - 120).forEach(function(k) { delete db[k]; });
    try { files.write(REPORTED_PATH, JSON.stringify(db)); } catch (e) {}
}

// 拉取当前所有 open 意见 issue 标题（最多 3 页 × 100）：产品已有 open 意见 = 主脚本还没处理完，不重复提
function loadOpenTitles() {
    let titles = [];
    for (let page = 1; page <= 3; page++) {
        // 2026-10-04 加固：网络抖动不再直接 break——去重闸门看不全会把「已有 open 意见」漏判、导致重复提单，每页最多 3 次重试（间隔 4 秒）
        let arr = null, stop = false;
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                let r = http.get("https://api.github.com/repos/" + GITHUB_USER + "/" + GITHUB_REPO + "/issues?state=open&labels=" + encodeURIComponent(FB_LABEL) + "&per_page=100&page=" + page, {headers: ghHeaders(), timeout: 30000});
                if (r.statusCode === 200) { arr = r.body.json() || []; break; }
                if (attempt < 3) sleep(4000);
            } catch (e) { if (attempt < 3) sleep(4000); }
        }
        if (arr === null) { stop = true; } // 3 次都没拿到：与原语义一致地停止（宁可不全，也不能假装拉全）
        else {
            arr.forEach(function(i) { if (i.title) titles.push(i.title); });
            if (arr.length < 100) stop = true;
        }
        if (stop) break;
    }
    return titles;
}
let openTitles = []; // 本轮巡检开始时快照的 open 意见 issue 标题

// 一次性清扫：关闭桥打通前遗留的旧「自检」单标签 issue（标题【自检】开头），附说明评论；
// 当前问题会由新巡检以「意见」双标签重新上报，旧报告不转意见（内容可能过时，转过去会让闭环重复采纳）
function sweepLegacyCheckIssues() {
    if (!GITHUB_USER || !GITHUB_TOKEN) return;
    try { if (files.exists(SWEEP_FLAG_PATH)) return; } catch (e) {}
    let legacy = [];
    for (let page = 1; page <= 10; page++) {
        try {
            let r = http.get("https://api.github.com/repos/" + GITHUB_USER + "/" + GITHUB_REPO + "/issues?state=open&labels=" + encodeURIComponent(CHECK_LABEL) + "&per_page=100&page=" + page, {headers: ghHeaders(), timeout: 30000});
            if (r.statusCode !== 200) break;
            let arr = r.body.json() || [];
            if (!arr.length) break;
            arr.forEach(function(i) {
                if (i.number && (i.title || "").indexOf("【自检】") === 0) legacy.push(i.number);
            });
            if (arr.length < 100) break;
        } catch (e) { break; }
    }
    if (!legacy.length) {
        try { files.write(SWEEP_FLAG_PATH, JSON.stringify({done: true, closed: 0, date: dateStr()})); } catch (e) {}
        log("🧹 无遗留旧自检 issue，清扫完成");
        return;
    }
    let ok = 0, fail = 0;
    legacy.forEach(function(no) {
        try {
            http.request("https://api.github.com/repos/" + GITHUB_USER + "/" + GITHUB_REPO + "/issues/" + no + "/comments", {
                method: "POST",
                headers: ghHeaders(),
                body: JSON.stringify({body: "🧹 归档说明：巡检脚本已切换为「意见」闭环（发现问题自动评分、达标自动改进上线），本旧版「自检」报告关闭归档。当前问题将由新一轮巡检以「意见」issue 重新上报。"}),
                timeout: 30000
            });
            http.request("https://api.github.com/repos/" + GITHUB_USER + "/" + GITHUB_REPO + "/issues/" + no, {
                method: "PATCH",
                headers: ghHeaders(),
                body: JSON.stringify({state: "closed"}),
                timeout: 30000
            });
            ok++;
            log("🧹 已归档旧自检 issue #" + no);
        } catch (e) {
            fail++;
            log("⚠️ 归档旧自检 issue #" + no + " 失败：" + e);
        }
    });
    if (!fail) {
        try { files.write(SWEEP_FLAG_PATH, JSON.stringify({done: true, closed: ok, date: dateStr()})); } catch (e) {}
    }
    log("🧹 旧自检清扫完成：归档 " + ok + " 个" + (fail ? "，失败 " + fail + " 个（下轮重试）" : ""));
}

function fileIssue(name, staticIssues, findings) {
    // 无问题不提交（意见闭环只处理真问题；全绿产品走企微摘要「通过」列表）
    if (!staticIssues.length && !findings.length) return "clean";
    // 双闸防重复：① 该产品已有 open 意见 issue（主脚本还没处理完）→ 不重提；
    // ② 当天已重报 MAX_RETRY_PER_DAY 次 → 明天再试（防「改不好→无限循环烧 token」）
    for (let i = 0; i < openTitles.length; i++) {
        if (openTitles[i].indexOf("【意见】" + name + "（巡检") === 0) {
            log("⏭️ 该产品已有 open 意见待主脚本处理，跳过重复上报：" + name);
            return "skip";
        }
    }
    // 【2026-10-03 修·拆死锁】实测发现（"功能实测：" 前缀）是**机器点出来的客观事实**，不是 AI 的主观意见，
    // 且天然有界。原先它和 AI 意见共用同一个日重报上限，造成死锁：产品被 AI 反复改不好 → 名额耗光 →
    // 后面更硬的实测证据反而进不来。实际案例：CodeSentry 实测「5 个按钮 4 个是死的」，21:23 那条被判
    // 「今日已重报 3 次」直接丢弃 —— 机器人改不动 + 新证据进不来 = 产品永久烂在队列里。
    // 现在给实测发现额外 2 个名额（合计上限 3+2=5），仍然有界，也仍受上面「已有 open 意见」闸门约束。
    let hasFT = false;
    for (let i = 0; i < staticIssues.length; i++) {
        if (String(staticIssues[i]).indexOf("功能实测：") === 0) { hasFT = true; break; }
    }
    let cap = MAX_RETRY_PER_DAY + (hasFT ? 2 : 0);
    let cnt = todayReportCount(name);
    if (cnt >= cap) {
        log("⏭️ 该产品今日已重报 " + cnt + " 次（上限 " + cap + (hasFT ? "，已含实测额外 2 个名额" : "") + "），明天再试：" + name);
        return "skip";
    }
    let title = "【意见】" + name + "（巡检 " + dateStr() + "）";
    let body = "## 🔍 产品巡检发现（自动意见闭环）\n\n";
    body += "- 产品：" + name + "\n";
    body += "- 链接：https://" + GITHUB_USER + ".github.io/" + GITHUB_REPO + "/" + name + "\n";
    body += "- 检查时间：" + new Date().toLocaleString() + "\n";
    body += "- 来源：自动巡检（静态检查 + LLM 审查，证据已与源码匹配）\n\n";
    if (staticIssues.length) {
        body += "### 静态检查问题（零 token）\n";
        staticIssues.forEach(function(s) { body += "- ❌ " + s + "\n"; });
    }
    if (findings.length) {
        body += "\n### LLM 审查问题\n";
        findings.forEach(function(f) {
            body += "- ❌ " + f.issue + "\n  - 证据：" + f.evidence.slice(0, 200) + "\n  - 修复建议：" + f.advice + "\n";
        });
    }
    body += "\n> 改进目标：已有产品「" + name + "」，请主脚本意见闭环自动评分处理：总分 ≥21 且判定采纳即自动改进上线，不采纳自动回复关闭。\n";
    // 2026-10-04 加固：网络抖动（DNS 闪断/超时）曾让整条意见直接丢失（VPN Privacy 实测 11 死按钮的报告就这么没了）。
    // 提交整段最多重试 3 次（间隔 4 秒）——与主脚本 deployToGithub 的加固同款；有响应但非 201 属业务性失败，重试无益直接返回。
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            let r = http.request("https://api.github.com/repos/" + GITHUB_USER + "/" + GITHUB_REPO + "/issues", {
                method: "POST",
                headers: ghHeaders(),
                body: JSON.stringify({title: title, body: body, labels: [CHECK_LABEL, FB_LABEL]}),
                timeout: 30000
            });
            if (r.statusCode === 201) {
                markReported(name);
                log("📮 已提交意见 issue（自检+意见）：" + title);
                return title;
            }
            log("❌ issue 提交失败 HTTP " + r.statusCode + "：" + String(r.body).slice(0, 200));
            return null; // 有响应但非 201：业务性失败，重试无益
        } catch (e) {
            log("⚠️ issue 提交网络异常（第 " + attempt + "/3 次）：" + String(e).slice(0, 120));
            if (attempt < 3) sleep(4000);
        }
    }
    log("❌ issue 提交失败：3 次重试均超时/网络异常，本轮放弃（下轮巡检按日重报上限自动重试）；产品：" + name);
    return null;
}

// ========== 主流程 ==========
// ========== 功能实测层（真 WebView 加载 + 自动点击；每轮轮测最多 FT_MAX_PER_ROUND 个产品；零 token）==========
// 由「灵感雷达功能实测.js」（ui 模式）执行：加载产品副本→注入错误捕获→点击全部按钮→结果经 hash 回传；
// 发现并入该产品的 staticIssues → 走「意见」issue 同一闭环（评分≥21 自动改进上线）；
// 无结果/超时不报 issue（防实测器自身兼容问题刷屏，只记日志供排查）
const FT_HARNESS_PATH = "/storage/emulated/0/脚本/灵感雷达功能实测.js";
const FT_TASK_PATH = "/storage/emulated/0/脚本/功能实测_任务.json";
const FT_RESULT_PATH = "/storage/emulated/0/脚本/功能实测_结果.json";
const FT_CURSOR_PATH = "/storage/emulated/0/脚本/功能实测游标.txt";
const FT_LOG_PATH = "/storage/emulated/0/脚本/功能实测_历史.json"; // {文件名: 上次实测时间戳ms} 防重复实测（2026-10-03 修）
const FT_MAX_PER_ROUND = 8; // 每轮实测产品数。2026-10-03 演进：1 → 3 → 8。
// 量化过的取舍（每个产品约 20-40 秒；纯 WebView 点击、**零 token**，代价只是时间）：
//   3 个/轮  → 巡检约 3.5 分钟/轮，主脚本约 6 次/小时，全量覆盖一轮约 2 小时（实测被故障拖到 7-10 小时）
//   39 个/轮（每轮全测）→ 巡检约 23 分钟/轮，主脚本频率被砍到 1/3 —— 主脚本才是产出产品的那一头，不划算
//   8 个/轮（当前）→ 巡检约 7.5 分钟/轮，主脚本降到约 4.6 次/小时（-28%），全量覆盖约 1 小时
// 结论：用 28% 的生产降幅换 6 倍的覆盖速度。想再快就调这个数，代价是主脚本频率下降。
const FT_RESERVE_FOR_ROTATION = 2; // 每轮至少留这么多名额给「游标轮转」：防「变更优先」把名额吃光 → 没改过的产品被永远饿死
let FT_PICK_CACHE = null; // 本轮实测目标缓存（数组，最多 FT_MAX_PER_ROUND 个）；首次调用时算好并缓存（防循环中因历史更新而连环换选）
function loadFTLog() {
    try { let j = JSON.parse(files.read(FT_LOG_PATH)); if (j && typeof j === "object") return j; } catch (e) {}
    return {};
}
function saveFTLog(j) {
    try { files.write(FT_LOG_PATH, JSON.stringify(j)); } catch (e) {}
}
function functionalTest(name) {
    let names = collectBaselines();
    if (!names.length) return [];
    // 挑选本轮目标（2026-10-03 重构，修“同一产品整天重复实测”）：
    // 原实现永远取今日变更列表的字母序第一个（AICodeHelper 整天被钉住重复测，游标轮转失效）；
    // 现改为：①优先“今天变过、且改动晚于上次实测”的产品（取最近改动的那个）；
    // ②没有新鲜变更 → 游标轮转，跳过 20 小时内已测过的产品（保证全量覆盖）；③全测过则回到纯轮转。
    if (FT_PICK_CACHE === null) {
        let hist0 = loadFTLog();
        let picks = [];
        let cands = [];
        todayChanged().forEach(function(n) {
            let mt = 0;
            try { mt = new java.io.File(PRODUCT_DIR + "/" + n).lastModified(); } catch (e) {}
            if (!hist0[n] || mt > hist0[n]) cands.push({n: n, mt: mt});
        });
        // ① 变更优先：今天变过且改动晚于上次实测的产品，最近改动的排前面，取够 FT_MAX_PER_ROUND 个为止
        cands.sort(function(a, b) { return b.mt - a.mt; });
        // 「变更优先」最多占用 FT_MAX_PER_ROUND - FT_RESERVE_FOR_ROTATION 个名额，剩下至少 2 个留给游标轮转。
        // 否则产品频繁改版时，名额全被变更产品吃掉，没改过的产品永远轮不到（CodeSentry 整天没被实点就是这样来的）。
        let maxChanged = Math.max(1, FT_MAX_PER_ROUND - FT_RESERVE_FOR_ROTATION);
        for (let i = 0; i < cands.length && picks.length < maxChanged; i++) picks.push(cands[i].n);
        // ② 名额没用满 → 游标轮转补齐：跳过 20 小时内已测过的，且不与①重复（保证全量覆盖）
        if (picks.length < FT_MAX_PER_ROUND) {
            let last = "";
            try { last = files.read(FT_CURSOR_PATH).trim(); } catch (e) {}
            let start = names.indexOf(last);
            let fresh = Date.now() - 20 * 3600 * 1000;
            for (let k = 1; k <= names.length && picks.length < FT_MAX_PER_ROUND; k++) {
                let n2 = names[(start + k) % names.length];
                if (picks.indexOf(n2) >= 0) continue;
                if (!hist0[n2] || hist0[n2] < fresh) picks.push(n2);
            }
        }
        // ③ 兜底：②没能把名额填满（全都 20 小时内测过 / 候选与①重复）→ 放开时间限制做纯轮转补位，
        //    保证每轮仍有足额实测产出。注意判断必须是「名额没满」而非「一个都没选到」——
        //    否则①刚好只选中 1 个、②又补不上时，整轮会退化成只测 1 个（2026-10-03 单测 T4 抓到）。
        if (picks.length < FT_MAX_PER_ROUND) {
            let last2 = "";
            try { last2 = files.read(FT_CURSOR_PATH).trim(); } catch (e) {}
            let s2 = names.indexOf(last2);
            for (let k = 1; k <= names.length && picks.length < FT_MAX_PER_ROUND; k++) {
                let n3 = names[(s2 + k) % names.length];
                if (picks.indexOf(n3) < 0) picks.push(n3);
            }
        }
        FT_PICK_CACHE = picks;
    }
    if (FT_PICK_CACHE.indexOf(name) < 0) return [];
    let pick = name;
    try { files.write(FT_CURSOR_PATH, pick); } catch (e) {}
    try { files.remove(FT_RESULT_PATH); } catch (e) {}
    try { files.write(FT_TASK_PATH, JSON.stringify({target: PRODUCT_DIR + "/" + pick, label: pick})); } catch (e) { return []; }
    log("功能实测启动：" + pick);
    try { engines.execScriptFile(FT_HARNESS_PATH); } catch (e) { log("功能实测器启动失败：" + e); return []; }
    let hist = loadFTLog(); // 记录本次实测（attempt 即记，防无结果产品被无限重试；产品下次有变更时仍会被优先重测）
    hist[pick] = Date.now();
    saveFTLog(hist);
    // 等结果文件（本机 waitFor 不可靠，用结果文件轮询；上限 45 秒）
    let deadline = Date.now() + 45000;
    let res = null;
    while (Date.now() < deadline) {
        sleep(1500);
        try {
            if (files.exists(FT_RESULT_PATH)) {
                let raw = files.read(FT_RESULT_PATH);
                if (raw && raw.length > 10) { res = JSON.parse(raw); break; }
            }
        } catch (e) {}
    }
    if (!res) {
        log("功能实测 [" + pick + "]：45 秒内无结果（实测器未跑起来或页面卡死），本轮只记日志不报 issue（防误报刷屏）");
        return [];
    }
    let out = [];
    if (res.errs && res.errs.length) out.push("功能实测：点击交互触发 JS 报错 " + res.errs.length + " 处，例如「" + String(res.errs[0]).slice(0, 100) + "」");
    if (res.fatal) out.push("功能实测：页面/实测器异常（" + String(res.fatal).slice(0, 100) + "）");
    if (res.timeout) out.push("功能实测：页面 25 秒内未完成点击响应（卡死或驱动失败，卡在 " + (res.step || "?") + "）");
    // 【2026-10-03 新增维度】「点了没反应 / 只弹个提示」在旧版实测器里完全不可见 —— 它们都不抛异常。
    // 这正是用户反复反馈的「按钮点了没触发该有的功能，却显示 0 报错」：实测器当时只验「会不会崩」，
    // 没验「点了有没有用」。现在按 无效果按钮占比 判定：≥ 一半即认定「整站按钮多为安慰剂」。
    let dead = (res.noeffect || []).length + (res.alertonly || []).length;
    let clickedN = res.clicked || 0;
    if (clickedN > 0 && dead >= Math.max(2, Math.ceil(clickedN / 2))) {
        let d1 = (res.alertonly || []).slice(0, 4).join("、");
        let d2 = (res.noeffect || []).slice(0, 4).join("、");
        out.push("功能实测：" + dead + "/" + clickedN + " 个按钮点了没有任何实际效果"
            + (d1 ? "（只弹提示：" + d1 + "）" : "")
            + (d2 ? "（点了没反应：" + d2 + "）" : "")
            + " —— 疑似占位/假功能，必须改成真能干活或直接删掉");
    }
    // 【2026-10-03 新增维度·页内提示】弹个「开发中 / Coming soon / not implemented」既不抛异常、
    // DOM 也真的变了，于是旧判据全判成「无问题」（用户实测反馈：「弹出英文的它直接就说报错0没效果0」）。
    // 现在由钩子用 MutationObserver 抓「点击后新出现的文字」再去比对占位话术 —— 命中即报 issue。
    let ph = res.placeholder || [];
    if (ph.length) {
        out.push("功能实测：" + ph.length + " 个按钮点了只弹出占位提示（该功能没做出来）：" + ph.slice(0, 4).join(" ／ "));
    }
    if (res.alerts && res.alerts.length) {
        log("功能实测 [" + pick + "]：浏览器弹窗内容 → " + res.alerts.join(" ／ ").slice(0, 200));
    }
    if (res.msgs && res.msgs.length) {
        log("功能实测 [" + pick + "]：点击后出现的短文本 → " + res.msgs.slice(0, 6).join(" ／ ").slice(0, 220));
    }
    log("功能实测 [" + pick + "]：按钮 " + (res.buttons || 0) + " 个，点击 " + (res.clicked || 0) + " 个，报错 " + ((res.errs && res.errs.length) || 0) + " 处，点了没效果 " + dead + " 个，占位提示 " + ph.length + " 个" + (out.length ? " ⚠️" : " ✓"));
    return out;
}

function main() {
    if (!GITHUB_USER || !GITHUB_TOKEN) log("ℹ️ 未配置 GitHub，巡检仅跑本地检查、无法提交 issue");
    log("🔍 产品巡检启动…");
    let targets = pickTargets();
    log("🎯 本轮巡检 " + targets.length + " 个产品：" + (targets.join("、") || "（无）"));
    if (!targets.length) {
        log("✅ 无可巡检产品，脚本退出");
        return;
    }
    ensureLabels();
    sweepLegacyCheckIssues();
    openTitles = loadOpenTitles(); // 本轮 open 意见快照：已有 open 意见的产品不重复上报
    let filed = [];
    let allOk = [];
    let skipped = 0;
    let failed = 0;
    let llmCount = 0;
    targets.forEach(function(name) {
        let html = "";
        try { html = files.read(PRODUCT_DIR + "/" + name); } catch (e) {}
        if (!html || html.length < 200) {
            log("⚠️ 读取失败，跳过：" + name);
            return;
        }
        log("🔎 检查 " + name + "（" + html.length + " 字节）…");
        let staticIssues = staticCheck(name, html);
        compileAdvisory(name, html);
        // 功能实测（真 WebView 自动点击，每轮最多 FT_MAX_PER_ROUND 个产品轮转）——发现并入 staticIssues，走同一意见闭环
        try {
            let ftIssues = functionalTest(name);
            if (ftIssues && ftIssues.length) staticIssues = staticIssues.concat(ftIssues);
        } catch (e) { log("⚠️ 功能实测异常（不影响静态巡检）：" + e); }
        // 页面残缺（缺 </html>）时 LLM 审查无意义，只报静态问题
        let findings = null;
        if (looksComplete(html)) {
            findings = reviewProduct(name, html);
            if (findings !== null) { llmCount++; markReviewed(name); } // null = 预算跳过未审查，不记历史
        }
        if (findings === null) findings = [];
        let t = fileIssue(name, staticIssues, findings);
        if (t === "clean") allOk.push(name);
        else if (t === "skip") skipped++;
        else if (t) filed.push(name);
        else failed++;
    });
    let summary = "🔍 产品巡检（" + dateStr() + "）\n全量 " + targets.length + " 个产品（LLM 审查 " + llmCount + " 个，其余仅静态）";
    if (filed.length) summary += "\n📮 新开意见 issue（进自动闭环）：" + filed.join("、");
    if (skipped) summary += "\n⏭️ 跳过：" + skipped + " 个（已有 open 意见待处理，或今日重报达 " + MAX_RETRY_PER_DAY + " 次上限）";
    if (failed) summary += "\n❌ 提交异常：" + failed + " 个（见运行日志）";
    if (allOk.length) summary += "\n✅ 通过：" + allOk.join("、");
    pushToWx("灵感雷达·巡检摘要", summary);
    log("✅ 巡检完成，脚本退出");
}
main();
// 调度器完成标记：供「灵感雷达轮流调度.js」检测本轮已结束（写失败不影响巡检流程）
try { files.write("/storage/emulated/0/脚本/调度子脚本完成.txt", "巡检脚本 " + new Date().toLocaleString()); } catch (e) {}
