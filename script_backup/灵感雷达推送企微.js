console.show();
// ========== 文件日志：log() 同时写文件（实时落盘）+ 打日志窗 ==========
// 本机魔改版 Rhino 静默忽略 console.log 的赋值（实测），无法重定义双写。
// 方案：定义全局 log()，脚本内所有 log( 已由 sed 批量替换为 log(。
var LOG_FILE = "/storage/emulated/0/脚本/主脚本_日志.log";
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
// ========== 灵感雷达 · 每日推送企业微信 ==========
// 本脚本不需要无障碍服务（只做网络请求+推送），已去掉 "auto" 标记，无障碍关没关都不影响运行
// 启动后立即跑一次；之后每天 9:00 自动抓 8 路信源 → AI 提炼 → 推送企业微信
// 想手动再跑一次：重新运行本脚本即可
// 变现模式（全局铁律）：所有产品完全免费 + 合规广告变现
//   不设付费/激活码/收款；不碰用户钱（无分账/挂码）；只靠合规广告；贡献按实际贡献评分（不按拉人）；
//   无多级分销/上下线/层级返利；激励优先荣誉榜+署名（少量小额实物，高价值限量并处理个税）。
// 页面分工：产品页 = 产品介绍（干嘛的/怎么用）+ 页脚一个极简广告位 + 一行「完全免费」+ 提意见按钮，不堆任何声明；
//   贡献规则/奖励规则(含税务说明)/隐私说明/无层级返利声明 → 统一放 /about 页（给监管/平台看）；
//   LICENSE 与版权声明只放仓库根 LICENSE 文件，不进任何页面。

// ========== 密钥统一外置：读「雷达密钥.json」，脚本本体不再含任何密钥 ==========
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

// ========== 51.LA 统计：所有产品页自动埋点（含以后新出的产品，程序化注入，不依赖 AI）==========
const LA_ID = SEC["51la_id"] || ""; // 51.la 控制台 → 站点 → 获取统计代码 里的 id
const LA_CK = SEC["51la_ck"] || ""; // 同一段代码里的 ck（校验密钥）
if (!LA_ID) log("ℹ️ 未配置 51la_id：产品页不埋统计码（在 雷达密钥.json 里加 51la_id/51la_ck 即可）");

// ========== 免费 + 合规广告变现配置（可选，全部有默认值，不配置也能跑）==========
const AD_HTML = SEC.ad_html || "";               // 合规广告联盟代码（已接入时填）；留空则显示合规占位广告位
const LIC_NAME = SEC.lic_name || "灵感雷达产品作者";   // LICENSE 署名
const CONTRIBUTORS = SEC.contributors || [];      // 贡献者榜单：[{name, role, score, note}]，按实际贡献手工登记，禁止拉人计分

// ========== API 池：多 Key 自动轮换 + 模型政策自动档位 + 限流冷却 + 成本自控 ==========
// 模型选择不硬编码：读「模型政策」三级兜底 = GitHub 仓库 model_policy.json（维护者随时更新条款/价格）
// → 本地缓存（/storage/emulated/0/脚本/模型政策.json）→ 内置默认。脚本每次运行自动同步最新政策。
// 政策条目字段：name=模型名；commercial=false 表示该模型条款禁止商用（自动跳过）；
// price=0免费/1低价/2中价/3高价（性价比排序第一优先）；quality=1-5 能力分（quality 模式第一优先）。
// 429 限流：该模型冷却 5 分钟（跨运行持久化）自动切下一档；401/403：自动换下一个 Key。
const ZP_KEYS = SEC.zp_keys || [];
if (!ZP_KEYS.length) log("⚠️ ZP_KEYS 为空：请检查雷达密钥.json（AI 调用将全部失败）");
if (!WX_HOOK) log("⚠️ WX_HOOK 为空：企微推送将跳过");
const POLICY_PATH = "/storage/emulated/0/脚本/模型政策.json";
const COOLDOWN_PATH = "/storage/emulated/0/脚本/模型冷却.json";
const POLICY_REMOTE = "model_policy.json"; // 仓库根目录；条款/价格变化时在 GitHub 网页上直接编辑即可
const POLICY_DEFAULT = {
    updated: "",
    note: "内置默认：glm-4-flash 免费且可商用（智谱官方政策）；glm-4-air 付费可商用；429 限流自动冷却切换下一档。",
    models: [
        {name: "glm-4-flash", enabled: true, commercial: true, price: 0, quality: 3},
        {name: "glm-4-air", enabled: true, commercial: true, price: 1, quality: 5}
    ]
};
function b64encode(s) {
    let bytes = new java.lang.String(String(s)).getBytes("UTF-8");
    return android.util.Base64.encodeToString(bytes, 2); // NO_WRAP
}
function b64decode(b) {
    let bytes = android.util.Base64.decode(String(b).replace(/\s/g, ""), 0);
    return new java.lang.String(bytes, "UTF-8");
}
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
function refreshPolicy() {
    if (!GITHUB_USER || !GITHUB_TOKEN) { log("ℹ️ 未配置 GitHub：使用本地缓存/内置模型政策"); return; }
    let url = "https://api.github.com/repos/" + GITHUB_USER + "/" + GITHUB_REPO + "/contents/" + POLICY_REMOTE;
    try {
        let r = http.get(url, {headers: ghHeaders(), timeout: 30000});
        if (r.statusCode === 200) {
            let txt = b64decode(r.body.json().content || "");
            let p = JSON.parse(txt);
            if (!p || !Array.isArray(p.models) || !p.models.length) { log("⚠️ 远程模型政策格式异常，沿用本地缓存"); return; }
            // 规范化比对（parse 再 stringify）：只认字段级变化，空白/换行/键序差异不算变更，防每天误推「政策已更新」
            let oldNorm = "";
            try { oldNorm = JSON.stringify(JSON.parse(files.read(POLICY_PATH))); } catch (e) {}
            if (oldNorm !== JSON.stringify(p)) {
                files.write(POLICY_PATH, txt);
                log("📜 模型政策已更新（" + (p.updated || "未标日期") + "）：" + (p.note || ""));
                pushToWx("📜 模型政策更新", "条款/价格政策有变化，模型档位已自动调整：\n" + (p.note || "（无说明）") + (p.updated ? "\n（更新日期 " + p.updated + "）" : ""));
            }
            MODEL_POLICY = p;
            return;
        }
        if (r.statusCode === 404) {
            // 仓库还没有政策文件：用内置默认创建（以后可直接在 GitHub 网页上编辑，不用改脚本）
            let def = JSON.parse(JSON.stringify(POLICY_DEFAULT));
            def.updated = dayKey();
            files.write(POLICY_PATH, JSON.stringify(def, null, 2));
            let body = JSON.stringify({message: "init " + POLICY_REMOTE + "（模型条款/性价比自动档位）", content: b64encode(JSON.stringify(def, null, 2))});
            http.request(url, {method: "PUT", headers: ghHeaders(), body: body, timeout: 30000});
            MODEL_POLICY = def;
            log("📜 已在仓库创建 model_policy.json（默认政策）：以后改条款/调档位只需在 GitHub 上编辑该文件");
        }
    } catch (e) {
        log("⚠️ 模型政策拉取失败：" + e + "，沿用本地缓存");
    }
}
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
function isCooling(model) {
    return Date.now() < (MODEL_COOLDOWN[model] || 0);
}
function cooldown(model, secs) {
    let now = Date.now();
    let keys = Object.keys(MODEL_COOLDOWN);
    for (let i = 0; i < keys.length; i++) {
        if ((MODEL_COOLDOWN[keys[i]] || 0) < now) delete MODEL_COOLDOWN[keys[i]];
    }
    MODEL_COOLDOWN[model] = now + secs * 1000;
    saveCooldowns();
}
let keyIdx = 0;            // 当前可用 Key 下标
const DAILY_BUDGET = 10000000; // 每日 token 预算上限：实际日消耗峰值≈150K，设 1000 万基本不触发；最坏情况（flash 免费档耗尽全走 air）约 ¥10-20/天，且预算文件每日重置，单日失控硬顶可控
// 预算跨运行持久化：一天内多次运行共享同一份预算（防手动多轮跑失控）
const BUDGET_PATH = "/storage/emulated/0/脚本/token预算.json";
function dayKey() {
    let d = new Date();
    return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
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
let dailyTokenCost = loadBudget();    // 今日累计 token（估算，从预算文件恢复）
if (dailyTokenCost > 0) log("💰 今日已累计 " + dailyTokenCost + " token（预算 " + DAILY_BUDGET + "）");

// quality=true 时按能力优先（产品生成/重写用），日常按性价比优先；429 冷却切换、401/403 换 Key、其余错误逐档切换
function callLLM(messages, maxTokens, quality, temp) {
    let tier = policyTier(quality);
    if (dailyTokenCost > DAILY_BUDGET) return null; // 统一预算闸门：所有调用入口先过这里，防失控闭环
    for (let k = 0; k < ZP_KEYS.length; k++) {
        let key = ZP_KEYS[(keyIdx + k) % ZP_KEYS.length];
        for (let m = 0; m < tier.length; m++) {
            let model = tier[m];
            if (isCooling(model)) { log("🧊 " + model + " 限流冷却中，跳过"); continue; }
            try {
                // 注意：必须用 postJson（对象参数）——AutoJs6 的 http.post 传字符串 body 会强制转对象报错
                // 网络抖动加固：同模型重试 1 次再走冷却切换（SocketTimeout 多为瞬时抖动，避免白炸一次调用就直接切到贵模型）
                let r = null, netErr = null;
                for (let attempt = 1; attempt <= 2; attempt++) {
                    try {
                        r = http.postJson("https://open.bigmodel.cn/api/paas/v4/chat/completions", {
                            model: model,
                            messages: messages,
                            temperature: temp !== undefined ? temp : 0.9,
                            max_tokens: maxTokens
                        }, {
                            headers: {"Authorization": "Bearer " + key, "Content-Type": "application/json"},
                            timeout: quality ? 240000 : 90000 // 产品生成/重写类大请求给 240s（上限提到 12000 token 后需要更长的等待窗口），日常提炼 90s 够用
                        });
                        break;
                    } catch (eNet) {
                        netErr = eNet;
                        if (attempt === 1) {
                            log("⚠️ " + model + " 网络异常（" + eNet + "），3 秒后同模型重试一次…");
                            sleep(3000);
                        }
                    }
                }
                if (!r) throw netErr;
                let sc = r.statusCode;
                if (sc === 200) {
                    let j = r.body.json();
                    if (j && j.choices && j.choices[0]) {
                        keyIdx = (keyIdx + k) % ZP_KEYS.length;
                        let usage = j.usage || {};
                        let cost = (usage.prompt_tokens || 0) + (usage.completion_tokens || 0);
                        dailyTokenCost += cost;
                        saveBudget(); // 每次成功调用都落盘，进程被杀也不丢预算
                        log("🤖 " + model + " 完成，本轮约 " + cost + " token，今日累计 " + dailyTokenCost + "（预算 " + DAILY_BUDGET + "）");
                        return j.choices[0].message.content;
                    }
                    log("⚠️ " + model + " 返回异常（额度耗尽/参数错误），自动切换下一档…");
                } else if (sc === 429) {
                    log("🚦 " + model + " 限流(429)：冷却 5 分钟并切换…");
                    cooldown(model, 300);
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
const UA = "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36";

// 统一抓取入口：25 秒超时 + 最多重试 2 次（默认 10 秒超时在国内网络经常不够，HN 等慢源会误报失败）
function httpGetJson(url) {
    let lastErr = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
        try {
            let r = http.get(url, {headers: {"User-Agent": UA}, timeout: 25000});
            return r.body.json();
        } catch (e) {
            lastErr = e;
            if (attempt < 2) sleep(2000);
        }
    }
    throw lastErr; // 重试都用尽才抛出，外层 try/catch 正常记日志
}
function httpGetText(url) {
    let lastErr = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
        try {
            let r = http.get(url, {headers: {"User-Agent": UA}, timeout: 25000});
            return r.body.string();
        } catch (e) {
            lastErr = e;
            if (attempt < 2) sleep(2000);
        }
    }
    throw lastErr;
}

function getHN() {
    try {
        let d = httpGetJson("https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=20");
        return (d.hits || []).map(h => h.title || h.story_title).filter(Boolean);
    } catch (e) { log("HN 失败: " + e); return []; }
}
function getRss(name, url) {
    try {
        let d = httpGetJson("https://api.rss2json.com/v1/api.json?rss_url=" + encodeURIComponent(url));
        return (d.items || []).map(i => i.title).filter(Boolean).slice(0, 20);
    } catch (e) { log(name + " 失败: " + e); return []; }
}
function getV2ex() {
    // 直连 www.v2ex.com 在本机网络双栈均不可达（IPv4 秒拒、IPv6 黑洞超时，2026-10-01 curl 实测）；
    // 改走 api.rss2json.com 中转抓 V2EX RSS（与 36氪/少数派/IT之家 同一条可达通道），由海外服务器代抓
    try {
        let d = httpGetJson("https://api.rss2json.com/v1/api.json?rss_url=" + encodeURIComponent("https://www.v2ex.com/index.xml"));
        return (d.items || []).map(i => i.title).filter(Boolean).slice(0, 20);
    } catch (e) { log("V2EX 失败: " + e); return []; }
}
function getGithub() {
    // 主路：Search API（api.github.com 本机可达——本轮日志里 Pages 上传全成功；github.com 网页端 IP 常超时）
    try {
        let d = new Date();
        d.setDate(d.getDate() - 1); // created:>昨天，避免当天新仓库太少抓到空
        let p = function(n) { return ("0" + n).slice(-2); };
        let since = d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
        let j = httpGetJson("https://api.github.com/search/repositories?q=" + encodeURIComponent("created:>" + since) + "&sort=stars&order=desc&per_page=20");
        return (j.items || []).map(function(i) {
            return i.full_name + (i.description ? " — " + i.description : "");
        }).slice(0, 20);
    } catch (e) {
        // 兜底：抓 Trending 网页（github.com 网页端国内常超时，仅作后备）
        try {
            let html = httpGetText("https://github.com/trending?since=daily");
            let titles = [];
            let re = /<h2[^>]*>\s*<a[^>]*href="[^"]*"[^>]*>([\s\S]*?)<\/a>/g;
            let m;
            while ((m = re.exec(html)) !== null) {
                titles.push(m[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim());
            }
            return titles.filter(Boolean).slice(0, 20);
        } catch (e2) { log("GitHub 失败: " + e2); return []; }
    }
}
function getWeibo() {
    try {
        let j = httpGetJson("https://weibo.com/ajax/side/hotSearch");
        return ((j.data && j.data.realtime) || []).map(w => w.word).filter(Boolean).slice(0, 20);
    } catch (e) { log("微博 失败: " + e); return []; }
}
function getZhihu() {
    try {
        let j = httpGetJson("https://www.zhihu.com/api/v3/feed/topstory/hot-lists/total?limit=50");
        return (j.data || []).map(x => x.target && x.target.title).filter(Boolean).slice(0, 20);
    } catch (e) { log("知乎 失败: " + e); return []; }
}

const SYSTEM_PROMPT = "你是懂技术、懂商业、懂中国互联网市场的产品顾问，也是一个持续推演人类需求的观察者。用户会给你：①一批来自 Hacker News、36氪、少数派、IT之家、V2EX、GitHub Trending、微博热搜、知乎热榜 的最新头条；②过去几天的历史报告。请据此输出中文报告：\n1.【趋势】3 个正在升温的方向，每个一句话，并注明信号来自哪条头条（用引号标出标题关键词）\n2.【机会】5 个适合中国个人开发者（1-3人、低预算）的 App/小程序/工具点子，每个必须包含：名字、一句话定位、目标用户、为什么现在值得做（引用具体头条标题作证据，没有证据就写“信号不足”）、最快验证方法（1周内能做的低成本验证）、主要风险\n3.【行动】给最有潜力的 1 个方向写启动路线：第一周做什么、第一个月做什么\n硬性要求：必须合法合规，禁止暗网、爬虫灰产、侵犯隐私、涉赌涉黄等方向；禁止依赖专用设备才能使用的方向：VR/AR 头显、智能手表/手环、脑电波头环、心率带、血糖/血压计、体脂秤、智能眼镜、无人机、机器人、智能家居/物联网设备、专用传感器与仪器等一切需要用户额外购买或连接硬件的产品，个人开发者无硬件供应链，一律禁止；【设备红线】每个点子的核心体验必须开箱即用——用户只用普通手机/电脑的浏览器即可完整使用全部功能，不得把「需要 XX 设备」当作使用前提或卖点，不得以「如果你有 XX 设备就能体验」的假设场景作为产品设计基础，硬件周边软件仅限通用手机传感器能实现的功能（摄像头/麦克风/加速度计/GPS）；凡监测/传感/测量类功能（需要真实硬件才有意义的）一律不做，换成无需硬件且能真实实现的功能；点子要具体可落地，每个点子必须是用户拿去就能用的真实工具（严禁做成演示/模拟页面）、禁止“做一个XX平台/生态”这类空话；优先考虑 AI应用层小工具、效率工具、细分行业软件、内容创作工具、硬件周边软件；如果头条里没有足够信号，就明确说“信号不足”，绝对不要编造趋势\n变现铁律：所有产品完全免费——禁止付费、收款码、激活码、分账、挂码收款设计；变现只能靠合规广告（不挂违规内容）；禁止拉人头、多级分销、上下线、层级返利设计；激励只能按实际贡献（荣誉榜/署名优先，少量小额实物，高价值奖品限量并处理个税）\n【原创红线】产品名、定位与文案不得使用真实公司/品牌/已有产品名，不得抄袭或复刻任何现有产品；所有内容必须原创\n【独一无二】核心要求：对照【历史报告】，今天输出的 5 个方向必须与历史提过的方向不重复；如果相关只能作为“深化版”输出，格式：【v2】方向名——相对旧版的深化点；每天输出应是增量推演，不是复读昨天的想法\n- 【方向多样性硬规则】①禁止近亲变体：如果历史已提过“AI行为模仿助手”，则“AI情绪模仿助手”“情绪同步助手”“AI情绪反应模拟器”“AI语音助手”等同属一个方向的换皮，一律禁止；②连续两天的方向必须属于不同大类，大类包括：效率工具、生活实用、内容创作、学习教育、健康管理、娱乐游戏、开发工具、硬件周边等；③同一大类内连续深耕不得超过 2 天，第 3 天必须强制换到另一个大类；④主推方向禁止与历史任何方向的“近亲变体”，只允许真正的全新方向或明确标注的 v2 深化\n【深度推演】每个点子必须额外推演：使用场景（谁、什么时刻、为什么打开它）、广告变现潜力（谁会用、广告主为什么愿意投放、预估规模与合规性）、12周可行性（前4周原型验证、中4周种子用户、后4周决定继续或砍掉）\n【自动决策】这是你作为自主推演引擎的核心职责，最后必须输出：\n4.【决策】给 5 个方向按潜力打分（1-10分，各附一句理由），自动选定最高分作为「今日主推方向」，写出：①今天这一步的具体推进动作（一条今天内能完成的、可验证的动作）②对照历史报告，说明昨天主推方向的进展状态（继续推进/放弃，放弃要写明原因）。你不需要等人类确认，直接做决策并推进。";

const HIST_PATH = "/storage/emulated/0/脚本/雷达历史.txt";
function readHist() {
    try { return files.read(HIST_PATH); } catch (e) { return ""; }
}
function saveHist(report) {
    try {
        let old = readHist();
        let entry = "=== " + new Date().toLocaleString() + " ===\n" + report + "\n\n";
        let merged = entry + old;
        if (merged.length > 200000) merged = merged.slice(0, 200000); // 只留最近约 200KB，防文件无限增长
        files.write(HIST_PATH, merged);
        log("📚 历史档案已更新");
    } catch (e) { log("历史保存失败: " + e); }
}

// ========== 8 大类轮盘：每天指定一个方向大类，AI 的所有方向必须属于此类 ==========
const CATS = ["效率工具", "生活实用", "内容创作", "学习教育", "健康管理", "娱乐游戏", "开发工具", "硬件周边"];
const CAT_STATE_PATH = "/storage/emulated/0/脚本/轮盘状态.json";

function todayCategory() {
    let st = [];
    try { st = JSON.parse(files.read(CAT_STATE_PATH)); } catch (e) { st = []; }
    if (!Array.isArray(st)) st = [];
    let d = new Date();
    let todayKey = d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
    // 同一天重复运行直接复用已转出的大类，方向不跳变
    let last = st[st.length - 1];
    if (last && last.d === todayKey && CATS.indexOf(last.c) >= 0) return last.c;
    // 规则：今天大类 ≠ 昨天大类（连续两天必须不同大类，与 SYSTEM_PROMPT 硬规则②一致，天然杜绝连续深耕）
    let past = st.filter(x => x.d !== todayKey).slice(-2);
    let ban = past.length ? past[past.length - 1].c : "";
    let pool = CATS.filter(c => c !== ban);
    let cat = pool[Math.floor(Math.random() * pool.length)];
    st.push({d: todayKey, c: cat});
    st = st.slice(-30); // 只留最近 30 天
    try { files.write(CAT_STATE_PATH, JSON.stringify(st)); } catch (e) {}
    return cat;
}

// 文件名时间戳：精确到秒，月/日/时/分/秒全部补零——字典序即时间序，产出文件夹排序不乱
function dateStr() {
    let d = new Date();
    let p = function(n) { return ("0" + n).slice(-2); };
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + "_" + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
}

// ========== 部署层：自动上线 GitHub Pages（全自动发布）==========
// GitHub token 等密钥统一存「雷达密钥.json」，脚本本体不含密钥，改 key 只需改配置文件
const GITHUB_USER = SEC.github_user || "";   // 从雷达密钥.json 读取
const GITHUB_TOKEN = SEC.github_token || ""; // 从雷达密钥.json 读取
const GITHUB_REPO = SEC.github_repo || "apps";

function ghHeaders() {
    return {
        "Authorization": "token " + GITHUB_TOKEN,
        "Content-Type": "application/json",
        "User-Agent": "AutoJs6-Radar",
        "Accept": "application/vnd.github+json"
    };
}

function ensureRepo() {
    let defaultBranch = "main"; // 兜底值；下面尽量取仓库真实默认分支
    try {
        let chk = http.get("https://api.github.com/repos/" + GITHUB_USER + "/" + GITHUB_REPO, {headers: ghHeaders(), timeout: 30000});
        if (chk.statusCode === 200) {
            let info = chk.body.json();
            if (info && info.default_branch) defaultBranch = info.default_branch;
        } else {
            try {
                // 建仓库
                http.request("https://api.github.com/user/repos", {
                    method: "POST",
                    headers: ghHeaders(),
                    body: JSON.stringify({name: GITHUB_REPO, auto_init: true, description: "AI 自动生成的产品"}),
                    timeout: 30000
                });
            } catch (e) {}
            try {
                // 建完回查默认分支（老账号默认分支可能是 master，硬编码 main 会让 Pages 永远 404）
                let chk2 = http.get("https://api.github.com/repos/" + GITHUB_USER + "/" + GITHUB_REPO, {headers: ghHeaders(), timeout: 30000});
                if (chk2.statusCode === 200) {
                    let info2 = chk2.body.json();
                    if (info2 && info2.default_branch) defaultBranch = info2.default_branch;
                }
            } catch (e) {}
        }
    } catch (e) {}
    try {
        // 开启 GitHub Pages（用真实默认分支；重复开启报错，忽略）
        http.request("https://api.github.com/repos/" + GITHUB_USER + "/" + GITHUB_REPO + "/pages", {
            method: "POST",
            headers: ghHeaders(),
            body: JSON.stringify({source: {branch: defaultBranch, path: "/"}}),
            timeout: 30000
        });
    } catch (e) {}
}

// （收款码上传函数已删除：所有产品完全免费，不再有任何收款资源）

// ========== 产品自动优化环：完整源码 + air 重写 + 自检 + 不合格回退 ==========
// 产品质检：先本地硬检查（零 token、100% 准确、不受输出截断影响），过了再让 AI 查交互逻辑（生成/优化共用）
// 硬检查规则：含任何付费痕迹（价格/收款码/激活码/微信收款/付费解锁）直接不合格；
// 完全免费声明由 injectStandardBlock 统一注入（检查前先注入，保证必过）
// 免费硬检查（零 token、100% 准确、不受截断影响）：
// 禁用件：任何付费痕迹（价格/收款码/激活码/微信收款/付费解锁）一律不合格；
// 必备件：完全免费声明（由 injectStandardBlock 注入，检查前先注入保证存在）
function localHardCheck(html, srcRef) {
    if (!html || html.length < 300) return "内容为空或过短";
    // 系统注入的多语言块（含各语言译文）不参与禁用件扫描：译文里可能合法出现“付费/收款”等字样，不能误杀
    html = stripI18nBlock(html);
    // 禁用件检查只查 AI 输出部分：脚本注入的标准区块说明文案必然包含“激活码/收款”等字样，不能误杀
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
        ["收款", "收款引导"],
        ["simulation for demonstration", "模拟演示声明（必须做成真实工具）"],
        ["demonstration purposes only", "模拟演示声明（必须做成真实工具）"],
        ["仅供演示", "模拟演示声明（必须做成真实工具）"],
        ["仅用于演示", "模拟演示声明（必须做成真实工具）"],
        ["// simulate", "模拟分析式假功能（必须真实实现）"],
        ["simulate ai", "模拟分析式假功能（必须真实实现）"],
        ["fake data", "假数据（必须真实数据）"],
        ["mock data", "假数据（必须真实数据）"],
        ["// 模拟", "模拟式假功能（必须真实实现）"],
        ["模拟分析结果", "写死的假结果模板（必须真实计算）"],
        ["模拟分析过程", "写死的假结果模板（必须真实计算）"],
        ["这里可以添加", "空壳函数/未实现占位（必须真实实现）"],
        ["此处可以添加", "空壳函数/未实现占位（必须真实实现）"],
        ["待实现", "空壳函数/未实现占位（必须真实实现）"],
        ["尚未实现", "空壳函数/未实现占位（必须真实实现）"],
        ["功能开发中", "占位按钮（弹「开发中/敬请期待」，点了等于没点，必须做成真功能或删掉该按钮）"],
        ["敬请期待", "占位按钮（弹「开发中/敬请期待」，点了等于没点，必须做成真功能或删掉该按钮）"],
        ["敬请关注", "占位按钮（弹「开发中/敬请期待」，点了等于没点，必须做成真功能或删掉该按钮）"],
        ["coming soon", "占位按钮（弹 coming soon，点了等于没点，必须做成真功能或删掉该按钮）"],
        ["即将上线", "占位按钮（弹「即将上线」，点了等于没点，必须做成真功能或删掉该按钮）"],
        ["暂未开放", "占位按钮（弹「暂未开放」，点了等于没点，必须做成真功能或删掉该按钮）"],
        ["尚未开放", "占位按钮（弹「尚未开放」，点了等于没点，必须做成真功能或删掉该按钮）"],
        ["this is a demo", "自称演示（必须做成真实工具）"],
        ["©", "版权声明行（页面严禁出现 ©/版权字样）"],
        ["&copy;", "版权声明行（页面严禁出现 ©/版权字样）"],
        ["u0026copy;", "版权声明行（页面严禁出现 ©/版权字样）"],
        ["all rights reserved", "版权声明行（页面严禁出现 ©/版权字样）"],
        ["版权所有", "版权声明行（页面严禁出现 ©/版权字样）"],
        ["版权声明", "版权声明行（页面严禁出现 ©/版权字样）"],
        ["版权归", "版权声明行（页面严禁出现 ©/版权字样）"]
    ];
    for (let i = 0; i < forbidden.length; i++) {
        if (body.toLowerCase().indexOf(String(forbidden[i][0]).toLowerCase()) >= 0) return "含" + forbidden[i][1]; // 大小写不敏感：Simulate/simulate 之类变体都要拦
    }
    // 【禁伪随机】零 token 硬检查（2026-10-03）：Math.random 当结论/分数/指标是最常见的“能点但没用”假功能
    // （实测 AI Security 扫描=Math.random()>0.8?'Threat detected'；VPN Privacy 安全评分=random*100；Pi OS VPN 测速=random…）
    if (/Math\.random\(\)\s*[<>]=?\s*0?\.\d/.test(body)) return "伪随机假结论（Math.random 当判定，必须真实计算）";
    if (/Math\.random\(\)\s*\*\s*(?:100|40|20|50)\b/.test(body)) return "伪随机假分数（Math.random 当指标，必须真实计算）";
    if (/Math\.random\(\)\s*\*\s*[A-Za-z_$][\w$]*\.length/.test(body)) return "伪随机抽固定模板（必须换成真实逻辑）";
    // 产品交互脚本必须存在：AI 重写时可能把产品 JS 整个删掉（DevBoost 实测死页面），零 token 硬拦截
    if (!/<script[\s>]/i.test(body)) return "产品交互脚本丢失（死页面）";
    // 必备件检查查整页：完全免费声明 + 广告位由页脚保证存在，这里作为最终兜底
    let required = [
        ["完全免费", "免费声明"],
        ["广告", "广告位标注"]
    ];
    for (let j = 0; j < required.length; j++) {
        if (html.indexOf(required[j][0]) < 0) return "缺少" + required[j][1];
    }
    // 【可运行静态检查】零 token 引用一致性——AI 生成最常见的“没法用”坏点：按钮引用的函数没定义 / JS 查的 id 不存在（页面打开正常、一按没反应）
    // 只查 AI 输出部分（body）：系统注入代码自身必然自洽
    let handlerNames = [];
    let hmRe = /\bon[a-z]+="\s*(?:return\s+)?([A-Za-z_$][\w$]*)\s*\(/gi;
    let mh;
    while ((mh = hmRe.exec(body)) !== null) { if (handlerNames.indexOf(mh[1]) < 0) handlerNames.push(mh[1]); }
    for (let i = 0; i < handlerNames.length; i++) {
        let n = handlerNames[i];
        let defRe = new RegExp("function\\s+" + n + "\\b|(?:var|let|const)\\s+" + n + "\\s*=|window\\." + n + "\\s*=|^" + n + "\\s*=\\s*function", "m");
        if (!defRe.test(body)) return "JS 引用了未定义的函数：" + n;
    }
    let idRefs = [];
    let idRe = /getElementById\(\s*["']([^"']+)["']\s*\)|querySelector(?:All)?\(\s*["']#([^"']+)["']\s*\)/g;
    let mi;
    while ((mi = idRe.exec(body)) !== null) {
        let idv = mi[1] || mi[2];
        if (idv && idRefs.indexOf(idv) < 0) idRefs.push(idv);
    }
    for (let i = 0; i < idRefs.length; i++) {
        let idv = idRefs[i];
        if (body.indexOf('id="' + idv + '"') < 0 && body.indexOf("id='" + idv + "'") < 0
            && body.indexOf('.id = "' + idv + '"') < 0 && body.indexOf('.id="' + idv + '"') < 0) return "JS 引用的元素 id 不存在：" + idv;
    }
    return "";
}
// 质检/重写输入上限：产品主交互脚本实测落在 9K-27K 字节区间（AI Code Ment 脚本 13906-27193），
// 但 42KB 级产品（BrainWaveHea 42638）的脚本尾部超出 30000 截断线，重写模型看不到尾部监测 JS，
// 两轮重写均产出「无事件处理的完整死页」烧 52K token；结构完整性与付费/免费声明由零 token 硬检查负责
const QC_SRC_CAP = 50000;
function qualityPrompt(html) {
    let src = html.length > QC_SRC_CAP ? html.slice(0, QC_SRC_CAP) + "\n<!-- 源码过长已截断：截断处之后无法审查，请只按可见部分判断，不要因为看不到结尾而判不通过 -->" : html;
    return "你是前端质检员。检查下面的 HTML 的交互逻辑是否合格：\n1) 有可交互的 JS 逻辑（不是死页面）\n2) 功能有真实可用逻辑，不是 alert 占位；所有按钮点击都有真实响应，没有只绑定第一个按钮的 document.querySelector('.class') 写法，没有随机分数+固定文案的伪随机假数据\n3) 产品自身的交互脚本必须存在，所有按钮 onclick/事件引用的函数都有定义（完全没有产品脚本的死页面不通过）\n4) 【真实工具】产品必须真能干活：若功能靠预置假数据/固定文案装样子（点击只输出说明文字、搜索返回写死的假结果、列表是预置假数据且不可增删改、含 simulation/demonstration/模拟 类模拟声明、或存在只 console.log 不干活的空壳函数（如导航 showPage 只打印日志）），即使结构完整也判不通过\n说明：页面结构完整性（</body></html>）、付费痕迹、免费声明与广告位已由系统零 token 校验通过，无需重复检查。\n只输出一行：通过 或 不通过（不通过时附一句原因，指出具体按钮/函数）\nHTML：\n" + src;
}
function aiQualityCheck(html) {
    let check = callLLM([
        {role: "system", content: "你是严格的前端质检员。"},
        {role: "user", content: qualityPrompt(html)}
    ], 100);
    if (!check) return {ok: false, reason: "AI 质检不可用（预算/Key 耗尽）"};
    if (check.indexOf("通过") >= 0 && check.indexOf("不通过") < 0 && check.indexOf("未通过") < 0) return {ok: true, reason: ""};
    // 提取「不通过/未通过」后的一句原因透传给重写循环：没有原因的第二轮重写等于瞎改
    let reason = "";
    let m = String(check).match(/(?:不通过|未通过)\s*[：:，,\-–—]?\s*([\s\S]{1,150})/);
    if (m) reason = m[1].trim();
    return {ok: false, reason: reason || "未附原因"};
}
function checkHtmlQuality(html) {
    let hard = localHardCheck(html);
    if (hard) {
        log("⛔ 本地硬检查不通过：" + hard);
        return false;
    }
    let q = aiQualityCheck(html);
    if (!q.ok) log("⚠️ AI 质检不通过：" + q.reason);
    return q.ok;
}

function cleanHtml(s) {
    if (!s) return null;
    s = s.replace(/^```[a-z]*\s*/i, "").replace(/```\s*$/, "").trim();
    let i = s.indexOf("<!DOCTYPE");
    if (i < 0) i = s.indexOf("<html");
    if (i > 0) s = s.slice(i);
    if (s.indexOf("<!DOCTYPE") !== 0 && s.indexOf("<html") !== 0) return null;
    return s;
}

// 完整性守卫：API 输出被 max_tokens 截断时 HTML 结尾会残缺，cleanHtml 只看开头，这里补上结尾检查
function looksComplete(html) {
    return !!html && html.indexOf("</body>") > 0 && /<\/html>\s*$/i.test(html);
}

// 截断续写守卫：输出被 max_tokens 砍断时把尾部喂回去续写并拼接（最多 3 轮、每轮 6000 token），保住完整页面
function completeHtml(html) {
    for (let i = 0; i < 3 && !looksComplete(html); i++) {
        if (dailyTokenCost > DAILY_BUDGET) break;
        let cont = callLLM([
            {role: "system", content: "你是资深前端工程师。你正在续写一个被截断的 HTML 文件，只输出剩余部分代码，禁止 markdown 围栏、禁止解释文字；续写内容同样禁止出现收款码/激活码/付费等任何收费元素。"},
            {role: "user", content: "下面这个 HTML 文件在输出时被截断了（结尾残缺）。请从被截断处继续输出剩余代码，直到完整的 </body></html>。只输出剩余部分，禁止重复已输出的内容。\n\n（被截断处之前的结尾）\n" + html.slice(-1500)}
        ], 6000, true, 0.7);
        if (!cont) break;
        cont = cont.replace(/^```[a-z]*\s*/i, "").replace(/```\s*$/, "").trim();
        if (!cont) break;
        if (cont.indexOf("<!DOCTYPE") === 0 || cont.indexOf("<html") === 0) {
            html = cont; // 模型从头重写了整篇：直接以新输出为准，仍不完整则下一轮继续
        } else {
            html += cont;
        }
    }
    return html;
}

// 老产品死代码摘除：批量转免费时代注入的 NEUTRALIZER 清洗脚本，代码本身含“收款码/付费/激活码”字样，
// 零 token 硬检查按子串扫描会误杀（本轮 CodeSentry 两轮自检失败即此原因）；转免费已完成，这段运行时兜底是死代码
function stripLegacyCleanup(html) {
    if (!html) return html;
    let out = html;
    // 1) 整段 NEUTRALIZER：以 unlocked 指纹定位 <script>…</script> 整块删除
    out = out.replace(/<script>\s*\(function\(\)\{[\s\S]*?localStorage\.setItem\("unlocked","1"\);[\s\S]*?\}\)\(\);\s*<\/script>/g, "");
    // 2) 散装残留语句（v2 重写可能只保留片段）：按注入时原文精确匹配摘除
    out = out.split('document.querySelectorAll("img").forEach(function(el){ if(/shoukuan/i.test(el.getAttribute("src")||"")) el.remove(); });').join("");
    out = out.split('var BAD=/付费解锁|激活码|收款码|付款后截图|领取激活码|解锁完整版|微信支付/;').join("");
    out = out.split('document.querySelectorAll("body *").forEach(function(el){').join("");
    out = out.split('if(!el.children.length && BAD.test(el.textContent||"") && !el.closest(".free-footer")) el.remove();').join("");
    out = out.split('if(b){ b.disabled=false; var t=b.textContent||""; if(t.indexOf("付费")>=0||t.indexOf("解锁")>=0) b.textContent="立即使用"; }').join("");
    return out;
}

// 51.LA 统计埋码：往 </head> 前插统计码（https 协议 + LA 加载保护）；已是新版则跳过，旧版裸调自动升级（幂等）
function injectAnalytics(html) {
    if (!html || !LA_ID) return html;
    let ck = LA_CK ? ',ck:"' + LA_CK + '"' : "";
    let snippet = '<script charset="UTF-8" id="LA_COLLECT" src="https://sdk.51.la/js-sdk-pro.min.js"></script>'
        + '<script>if(typeof LA!=="undefined"&&LA.init)LA.init({id:"' + LA_ID + '"' + ck + '});</script>';
    if (html.indexOf('typeof LA!=="undefined"') >= 0) return html; // 已是新版埋码（含 LA 加载保护），跳过
    if (html.indexOf("51.la") >= 0) {
        // 旧版埋码（//sdk 协议相对 / LA.init 裸调，SDK 加载失败会抛 ReferenceError）：整体摘除后重插新版
        html = html.replace(/<script[^>]*id="LA_COLLECT"[^>]*>\s*<\/script>/gi, "")
            .replace(/<script>\s*LA\.init\(\{[^}]*\}\)\s*;?\s*<\/script>/gi, "")
            .replace(/LA\.init\(\{[^}]*\}\)\s*;?/g, "");
    }
    let i = html.indexOf("</head>");
    if (i >= 0) return html.slice(0, i) + snippet + html.slice(i);
    let j = html.toLowerCase().indexOf("<body");
    if (j >= 0) return html.slice(0, j) + snippet + html.slice(j);
    return snippet + html;
}

// ========== SEO meta 自动补全：description / og 分享卡片 / theme-color（零 token，缺才补，幂等）==========
function escapeAttr(s) {
    return (s || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function injectMeta(html, pageName) {
    if (!html) return html;
    let hasOg = html.indexOf('property="og:title"') >= 0;
    let hasDesc = html.indexOf('<meta name="description"') >= 0;
    let hasTheme = html.indexOf('name="theme-color"') >= 0;
    if (hasOg && hasDesc && hasTheme) return html;
    let m = html.match(/<title>([\s\S]*?)<\/title>/i);
    let t = m ? m[1].replace(/<[^>]+>/g, "").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&quot;/gi, '"').replace(/\s+/g, " ").trim() : "";
    if (!t) t = "Free Online Tools";
    let desc = "Free online tool: " + t + ". No signup, no payment — free forever.";
    let meta = "";
    if (!hasDesc) meta += '<meta name="description" content="' + escapeAttr(desc) + '">\n';
    if (!hasOg) {
        meta += '<meta property="og:title" content="' + escapeAttr(t) + '">\n'
            + '<meta property="og:description" content="' + escapeAttr(desc) + '">\n'
            + '<meta property="og:type" content="website">\n';
        if (pageName && GITHUB_USER && GITHUB_REPO) {
            meta += '<meta property="og:url" content="https://' + GITHUB_USER + '.github.io/' + GITHUB_REPO + '/' + pageName + '">\n';
        }
    }
    if (!hasTheme) meta += '<meta name="theme-color" content="#333333">\n';
    if (!meta) return html;
    let i = html.indexOf("</title>");
    if (i >= 0) return html.slice(0, i + 8) + meta + html.slice(i + 8);
    let j = html.toLowerCase().indexOf("<head>");
    if (j >= 0) return html.slice(0, j + 6) + meta + html.slice(j + 6);
    return meta + html;
}

// ========== 多语言系统：页面文案自动翻译 + 切换器 + 检测解析器（浏览器语言优先，IP 兜底）==========
// 语言包顺序决定切换器选项顺序，第一个是默认（en）；加语言只需在 I18N_LANGS 加一项，并在 I18N_FIXED 补页脚四件套译文
const I18N_LANGS = [
    {code: "en", name: "English"},
    {code: "zh-CN", name: "中文"},
    {code: "es", name: "Español"},
    {code: "ja", name: "日本語"},
    {code: "ko", name: "한국어"},
    {code: "fr", name: "Français"},
    {code: "de", name: "Deutsch"},
    {code: "ru", name: "Русский"},
    {code: "pt", name: "Português"},
    {code: "ar", name: "العربية"},
    {code: "hi", name: "हिन्दी"},
    {code: "id", name: "Bahasa Indonesia"},
    {code: "vi", name: "Tiếng Việt"},
    {code: "th", name: "ไทย"}
];
const I18N_MARK = "radar-i18n-start";
const I18N_MARK_END = "radar-i18n-end";
// 国家码 → 语言（ipwho.is 返回的 country_code）
const I18N_GEO = {
    US: "en", GB: "en", CA: "en", AU: "en", NZ: "en", IE: "en", ZA: "en", SG: "en",
    CN: "zh-CN", HK: "zh-CN", TW: "zh-CN", MO: "zh-CN",
    ES: "es", MX: "es", AR: "es", CO: "es", CL: "es", PE: "es", VE: "es", EC: "es", GT: "es", CU: "es", BO: "es", DO: "es", HN: "es", PY: "es", SV: "es", NI: "es", CR: "es", PA: "es", UY: "es",
    JP: "ja",
    KR: "ko", KP: "ko",
    FR: "fr", MC: "fr", CI: "fr", SN: "fr", ML: "fr", NE: "fr", BF: "fr", TG: "fr", BJ: "fr",
    DE: "de", AT: "de", CH: "de", LI: "de", LU: "fr",
    RU: "ru", BY: "ru", KZ: "ru", UZ: "ru", KG: "ru", UA: "ru",
    PT: "pt", BR: "pt", AO: "pt", MZ: "pt", CV: "pt", GW: "pt",
    SA: "ar", AE: "ar", EG: "ar", IQ: "ar", JO: "ar", KW: "ar", QA: "ar", BH: "ar", OM: "ar", LB: "ar", SY: "ar", YE: "ar", SD: "ar", LY: "ar", TN: "ar", DZ: "ar", MA: "ar", MR: "ar", PS: "ar",
    IN: "hi", NP: "hi",
    ID: "id",
    VN: "vi",
    TH: "th"
};
// 系统注入的页脚四件套翻译（零 token，硬编码；页面正文翻译走 GLM）
const I18N_FIXED = {
    "en":    {"footer-ad": "Ad", "footer-free": "100% Free", "footer-about": "About", "footer-fb": "Feedback"},
    "zh-CN": {"footer-ad": "广告", "footer-free": "完全免费", "footer-about": "关于", "footer-fb": "提意见"},
    "es":    {"footer-ad": "Anuncio", "footer-free": "100% Gratis", "footer-about": "Acerca de", "footer-fb": "Comentarios"},
    "ja":    {"footer-ad": "広告", "footer-free": "完全無料", "footer-about": "このサイトについて", "footer-fb": "フィードバック"},
    "ko": {"footer-ad": "광고", "footer-free": "완전 무료", "footer-about": "소개", "footer-fb": "의견 제출"},
    "fr": {"footer-ad": "Publicité", "footer-free": "Complètement gratuit", "footer-about": "À propos", "footer-fb": "Faire des suggestions"},
    "de": {"footer-ad": "Werbung", "footer-free": "komplett kostenlos", "footer-about": "Über", "footer-fb": "Vorschläge einreichen"},
    "ru": {"footer-ad": "Реклама", "footer-free": "Полностью бесплатно", "footer-about": "О сайте", "footer-fb": "Предложить идею"},
    "pt": {"footer-ad": "Anúncio", "footer-free": "Grátis", "footer-about": "Sobre", "footer-fb": "Dar sugestão"},
    "ar": {"footer-ad": "إعلان", "footer-free": "مجاني بالكامل", "footer-about": "عن", "footer-fb": "قدم اقتراح"},
    "hi": {"footer-ad": "विज्ञापन", "footer-free": "पूर्णतः मुफ्त", "footer-about": "बारे में", "footer-fb": "सुझाव दें"},
    "id": {"footer-ad": "Iklan", "footer-free": "Gratis", "footer-about": "Tentang", "footer-fb": "Beri Tanggapan"},
    "vi": {"footer-ad": "Quảng cáo", "footer-free": "Miễn phí hoàn toàn", "footer-about": "Về chúng tôi", "footer-fb": "Gửi ý kiến"},
    "th": {"footer-ad": "การโฆษณา", "footer-free": "ฟรีทุกอย่าง", "footer-about": "เกี่ยวกับ", "footer-fb": "ส่งความคิดเห็น"},
};
// 关于页专用固定文案翻译（硬编码零 token；页面全部文案都是脚本静态输出的，无需 GLM）
const I18N_FIXED_ABOUT = {
    "en": {
        "ab-h1": "About This Site",
        "ab-rules": "Contribution Rules",
        "ab-rules-desc": "Contributions are scored by actual contribution (code, design, content, feedback, compliant promotion, etc.), not by referrals. No uplines, downlines, tiers, or headcount rewards.",
        "ab-th-name": "Contributor", "ab-th-role": "Contribution", "ab-th-score": "Score", "ab-th-note": "Note",
        "ab-role-feedback": "Feedback Contributor", "ab-note-prefix": "Recently adopted: ",
        "ab-empty": "The leaderboard is being registered by actual contribution — content, scores and attribution are based on public records.",
        "ab-reward": "Reward Rules (incl. tax notes)",
        "ab-tier-intro": "After your feedback is adopted, contribution points are calculated from the total review score (21-24 points +10, 25-27 points +15, 28-30 points +20).",
        "ab-honor": "Currently in pure honor mode: rewards are based on the honor roll and attribution, with no physical prize tiers for now. Once monthly ad revenue reaches a level that can support physical rewards, they will resume automatically (assessed on the 1st of each month; takes effect on the next run after revenue recovers).",
        "ab-history": "📜 Tier Adjustment History",
        "ab-hd-date": "Date", "ab-hd-action": "Action", "ab-hd-tier": "Tier", "ab-hd-basis": "Basis",
        "ab-no-ref": "No Multi-Level Rebate Statement",
        "ab-no-ref-desc": "All products on this site have no multi-level distribution, no uplines or downlines, and no tiered rebates; any form of headhunting or per-head compensation does not exist.",
        "ab-privacy": "Privacy",
        "ab-privacy-desc": "All products are pure front-end pages: no personal information is collected and no user data is uploaded; only routine access data required for site analytics and compliant advertising is involved.",
        "ab-feedback": "Feedback",
        "ab-fb-a": "Have an idea or suggestion?",
        "ab-fb-link": "Submit feedback here",
        "ab-fb-b": ". Once adopted, feedback is scored by actual contribution and you are automatically added to the contributor leaderboard."
    },
    "zh-CN": {
        "ab-h1": "关于本站",
        "ab-rules": "贡献规则",
        "ab-rules-desc": "贡献按实际贡献评分（代码、设计、内容、反馈、合规推广等），不按拉人评分；不设上下线、层级或人头奖励。",
        "ab-th-name": "贡献者", "ab-th-role": "贡献内容", "ab-th-score": "评分", "ab-th-note": "备注",
        "ab-role-feedback": "意见贡献者", "ab-note-prefix": "最近采纳：",
        "ab-empty": "榜单按实际贡献登记中——贡献内容、评分与署名以公开记录为准",
        "ab-reward": "奖励规则（含税务说明）",
        "ab-tier-intro": "意见被采纳后按评审总分计贡献分（21-24 分 +10，25-27 分 +15，28-30 分 +20）。",
        "ab-honor": "当前为纯荣誉模式：奖励以荣誉榜、署名为准，暂无实物奖励档位；广告月收入达到可支撑实物奖励的水平后自动恢复（每月 1 日评估，收入恢复后下次运行即可生效）。",
        "ab-history": "📜 档位调整历史",
        "ab-hd-date": "日期", "ab-hd-action": "动作", "ab-hd-tier": "档位", "ab-hd-basis": "依据",
        "ab-no-ref": "无层级返利声明",
        "ab-no-ref-desc": "本站所有产品无多级分销、无上下线、无层级返利；任何形式的拉人头、按人数计酬均不存在。",
        "ab-privacy": "隐私说明",
        "ab-privacy-desc": "产品均为纯前端页面：不收集个人信息、不上传用户数据；仅含站点统计与合规广告所需的常规访问数据。",
        "ab-feedback": "提意见",
        "ab-fb-a": "有想法或改进建议？",
        "ab-fb-link": "点这里提交意见",
        "ab-fb-b": "。意见被采纳后按实际贡献评分，自动登上贡献者榜单。"
    },
    "es": {
        "ab-h1": "Acerca de este sitio",
        "ab-rules": "Reglas de contribución",
        "ab-rules-desc": "Las contribuciones se puntúan por contribución real (código, diseño, contenido, comentarios, promoción conforme, etc.), no por referidos. No hay líneas ascendentes, descendentes, niveles ni recompensas por número de personas.",
        "ab-th-name": "Colaborador", "ab-th-role": "Contribución", "ab-th-score": "Puntuación", "ab-th-note": "Nota",
        "ab-role-feedback": "Colaborador de comentarios", "ab-note-prefix": "Adoptado recientemente: ",
        "ab-empty": "La clasificación se registra según la contribución real: el contenido, las puntuaciones y la atribución se basan en registros públicos.",
        "ab-reward": "Reglas de recompensas (incl. notas fiscales)",
        "ab-tier-intro": "Después de que se adopten tus comentarios, los puntos de contribución se calculan según la puntuación total de la revisión (21-24 puntos +10, 25-27 puntos +15, 28-30 puntos +20).",
        "ab-honor": "Actualmente en modo de honor puro: las recompensas se basan en el cuadro de honor y la atribución; por ahora no hay niveles de premios físicos. Cuando los ingresos publicitarios mensuales alcancen un nivel que pueda sostener premios físicos, se reanudarán automáticamente (se evalúa el día 1 de cada mes y entra en vigor en la siguiente ejecución tras la recuperación de ingresos).",
        "ab-history": "📜 Historial de ajustes de niveles",
        "ab-hd-date": "Fecha", "ab-hd-action": "Acción", "ab-hd-tier": "Nivel", "ab-hd-basis": "Base",
        "ab-no-ref": "Declaración de ausencia de reembolsos multinivel",
        "ab-no-ref-desc": "Todos los productos de este sitio no tienen distribución multinivel, ni líneas ascendentes o descendentes, ni reembolsos por niveles; no existe ninguna forma de captación de personas ni remuneración por número de personas.",
        "ab-privacy": "Privacidad",
        "ab-privacy-desc": "Todos los productos son páginas puramente de front-end: no se recopila información personal ni se suben datos del usuario; solo se incluyen los datos de acceso habituales necesarios para las estadísticas del sitio y la publicidad conforme.",
        "ab-feedback": "Comentarios",
        "ab-fb-a": "¿Tienes una idea o sugerencia?",
        "ab-fb-link": "Envía tus comentarios aquí",
        "ab-fb-b": ". Una vez adoptados, los comentarios se puntúan por contribución real y entras automáticamente en la clasificación de colaboradores."
    },
    "ja": {
        "ab-h1": "このサイトについて",
        "ab-rules": "貢献ルール",
        "ab-rules-desc": "貢献は実際の貢献（コード、デザイン、コンテンツ、フィードバック、コンプライアンスに沿った宣伝など）で評価され、紹介人数では評価されません。上下線、階層、人数による報酬はありません。",
        "ab-th-name": "貢献者", "ab-th-role": "貢献内容", "ab-th-score": "スコア", "ab-th-note": "備考",
        "ab-role-feedback": "フィードバック貢献者", "ab-note-prefix": "最近採用：",
        "ab-empty": "ランキングは実際の貢献に基づいて登録中です。貢献内容、スコア、署名は公開記録に基づきます。",
        "ab-reward": "報酬ルール（税務説明を含む）",
        "ab-tier-intro": "フィードバックが採用されると、レビュー合計点に基づいて貢献ポイントが付与されます（21〜24点 +10、25〜27点 +15、28〜30点 +20）。",
        "ab-honor": "現在は純粋な名誉モードです。報酬は名誉ランキングと署名を基準とし、今のところ物理的な賞品の段階はありません。毎月の広告収入が物理的な賞品を支えられる水準に達すると自動的に再開されます（毎月1日に評価され、収入回復後の次回実行で有効になります）。",
        "ab-history": "📜 段階調整履歴",
        "ab-hd-date": "日付", "ab-hd-action": "アクション", "ab-hd-tier": "段階", "ab-hd-basis": "根拠",
        "ab-no-ref": "多層リベートなしの宣言",
        "ab-no-ref-desc": "本サイトのすべての製品には多層マーケティング、上下線、階層リベートはありません。人数集めや人数に応じた報酬はいかなる形でも存在しません。",
        "ab-privacy": "プライバシー",
        "ab-privacy-desc": "すべての製品は純粋なフロントエンドページです。個人情報の収集やユーザーデータのアップロードは行いません。サイト統計とコンプライアンスに沿った広告に必要な通常のアクセスデータのみが含まれます。",
        "ab-feedback": "フィードバック",
        "ab-fb-a": "アイデアや改善提案はありますか？",
        "ab-fb-link": "こちらからフィードバックを送信",
        "ab-fb-b": "。採用されたフィードバックは実際の貢献に基づいて評価され、自動的に貢献者ランキングに掲載されます。"
    },
    "ko": {"ab-h1": "이 사이트에 대하여", "ab-rules": "기여 규칙", "ab-rules-desc": "기여는 실제 기여에 따라 평가됩니다. (코드, 디자인, 내용, 피드백, 법적 홍보 등) 인원 유치에 따라 평가하지 않습니다. 상하선, 계층 또는 인원 보상이 없습니다.", "ab-th-name": "기여자", "ab-th-role": "기여 내용", "ab-th-score": "점수", "ab-th-note": "비고", "ab-role-feedback": "의견 기여자", "ab-note-prefix": "최근 채택: ", "ab-empty": "리스트는 실제 기여에 따라 등록 중입니다. 기여 내용, 점수 및 이름은 공개 기록에 따릅니다.", "ab-reward": "보상 규칙(세금 설명 포함)", "ab-tier-intro": "의견이 채택되면 평가 총점에 따라 기여 점수를 계산합니다. (21-24 점 +10, 25-27 점 +15, 28-30 점 +20).", "ab-honor": "현재 순수 명예 모드입니다: 보상은 명예 순위와 작성자 명의로만 제공되며, 실물 보상 등급은 현재 없습니다. 광고 월수입이 실물 보상을 지원할 수 있는 수준에 도달하면 자동으로 복원됩니다(매월 1일 평가, 수입 복원 후 다음 실행 시 적용).", "ab-history": "📜 등급 조정 기록", "ab-hd-date": "날짜", "ab-hd-action": "작업", "ab-hd-tier": "등급", "ab-hd-basis": "근거", "ab-no-ref": "계층 보상 선언 없음", "ab-no-ref-desc": "본사 모든 제품은 다단계 마케팅이 없으며, 상하 관계나 계층별 보상이 존재하지 않습니다. 어떠한 형태의 인원 모집이나 인원 수에 따른 보상도 없습니다.", "ab-privacy": "개인 정보 보호 설명", "ab-privacy-desc": "제품은 모두 전면 페이지입니다: 개인 정보를 수집하지 않으며, 사용자 데이터를 업로드하지 않습니다. 사이트 통계와 법적 광고에 필요한 일반 방문 데이터만 포함됩니다.", "ab-feedback": "의견 제출", "ab-fb-a": "아이디어나 개선 제안이 있으신가요?", "ab-fb-link": "여기서 의견을 제출하세요", "ab-fb-b": "의견이 채택되면 실제 기여에 따라 평가되어 기여자 목록에 자동으로 올라갑니다."},
    "fr": {"ab-h1": "À propos de ce site", "ab-rules": "Règles de contribution", "ab-rules-desc": "Les contributions sont évaluées selon la contribution réelle (code, design, contenu, feedback, promotion conforme, etc.), pas selon le nombre de personnes recrutées ; pas de système de parrainage, de niveaux ou de récompenses basées sur le nombre de personnes.", "ab-th-name": "Contributeurs", "ab-th-role": "Contenu contribué", "ab-th-score": "Score", "ab-th-note": "Remarques", "ab-role-feedback": "Contributeurs d'opinions", "ab-note-prefix": "Récemment adopté :", "ab-empty": "Le classement est en cours d'enregistrement selon la contribution réelle - le contenu contribué, le score et le nom sont basés sur les enregistrements publics.", "ab-reward": "Règles de récompense (y compris les explications fiscales)", "ab-tier-intro": "Après que les opinions sont adoptées, les points de contribution sont calculés selon le total des points d'évaluation (21-24 points +10, 25-27 points +15, 28-30 points +20).", "ab-honor": "Actuellement en mode pure honneur : les récompenses sont basées sur le classement d'honneur et le nom, sans catégories de récompenses matérielles ; le mode de récompense matériel est automatiquement restauré lorsque le revenu mensuel publicitaire atteint un niveau suffisant pour le soutenir (évalué le 1er jour de chaque mois, applicable à la prochaine exécution après le revenu restauré).", "ab-history": "📜 Histoire des ajustements de catégories", "ab-hd-date": "Date", "ab-hd-action": "Action", "ab-hd-tier": "Catégorie", "ab-hd-basis": "Base", "ab-no-ref": "Déclaration de non-récompense de niveau", "ab-no-ref-desc": "Tous les produits de ce site n'ont pas de distribution en plusieurs niveaux, pas de parrainage, pas de récompenses basées sur les niveaux ; aucune forme de parrainage par tête ou de rémunération basée sur le nombre de personnes n'existe.", "ab-privacy": "Explications sur la confidentialité", "ab-privacy-desc": "Les produits sont tous des pages d'interface avant : ne collectent pas d'informations personnelles, ne téléchargent pas de données utilisateur ; ne contiennent que les données d'accès régulières nécessaires à la statistique du site et à la publicité conforme.", "ab-feedback": "Faire des suggestions", "ab-fb-a": "Avez-vous des idées ou des suggestions d'amélioration ?", "ab-fb-link": "Cliquez ici pour soumettre des suggestions", "ab-fb-b": "Les opinions adoptées sont évaluées selon la contribution réelle et montent automatiquement sur le classement des contributeurs."},
    "de": {"ab-h1": "Über diese Seite", "ab-rules": "Beitragsregeln", "ab-rules-desc": "Beiträge werden nach tatsächlicher Leistung bewertet (Code, Design, Inhalt, Feedback, Compliance-Promotion etc.), nicht nach der Anzahl der geworbenen Personen; es gibt keine Obergrenzen, Stufen oder Kopfgeldbelohnungen.", "ab-th-name": "Beiträger", "ab-th-role": "Beitragsinhalt", "ab-th-score": "Bewertung", "ab-th-note": "Notizen", "ab-role-feedback": "Feedback-Beiträger", "ab-note-prefix": "Zuletzt angenommen：", "ab-empty": "Die Liste wird nach tatsächlichen Beiträgen eingetragen——Beitragsinhalt, Bewertung und Namensnennung gelten als öffentliche Aufzeichnungen.", "ab-reward": "Belohnungsregeln (inkl. Steuerhinweis)", "ab-tier-intro": "Nachdem ein Vorschlag angenommen wurde, wird der Beitrag nach der Gesamtbewertung bewertet (21-24 Punkte +10, 25-27 Punkte +15, 28-30 Punkte +20).", "ab-honor": "Derzeit ist es ein reines Ehrenmodell: Die Belohnung basiert auf der Ehrenliste und dem Namen, es gibt keine physischen Belohnungsstufen; wenn der monatliche Werbeeinnahmebetrag ein Niveau erreicht, das physische Belohnungen unterstützen kann, wird dies automatisch wiederhergestellt (jeden ersten Tag des Monats bewertet, der nächste Lauf wird wirksam, wenn der Einnahmebetrag wiederhergestellt wird).", "ab-history": "📜 Historie der Stufenanpassung", "ab-hd-date": "Datum", "ab-hd-action": "Aktion", "ab-hd-tier": "Stufe", "ab-hd-basis": "Basis", "ab-no-ref": "Keine Ebenen-Rückerstattungsdeklaration", "ab-no-ref-desc": "Alle Produkte dieser Seite haben keine mehrstufige Distribution, keine direkten und indirekten Vertriebslinien, keine Ebenen-Rückerstattungen; es gibt keine Form der Einladung von Personen oder Bezahlung nach der Anzahl der Personen.", "ab-privacy": "Datenschutzerklärung", "ab-privacy-desc": "Produkte sind rein vorderseitige Seiten: Persönliche Informationen werden nicht gesammelt, Benutzerdaten werden nicht hochgeladen; Es enthält nur die gängigen Besuchsdaten, die für die Statistik der Seite und die rechtlichen Werbung erforderlich sind.", "ab-feedback": "Vorschläge einreichen", "ab-fb-a": "Haben Sie Ideen oder Verbesserungsvorschläge?", "ab-fb-link": "Klicken Sie hier, um Vorschläge einzureichen", "ab-fb-b": "。Wenn ein Vorschlag angenommen wird, wird er nach tatsächlichen Beiträgen bewertet und automatisch in die Liste der Beiträger aufgenommen."},
    "ru": {"ab-h1": "О сайте", "ab-rules": "Правила участия", "ab-rules-desc": "Оценка вклада производится на основе реальных достижений (код, дизайн, контент, обратная связь, продвижение соответствия требованиям и т.д.), а не по количеству привлечённых людей; не установлены верхние или нижние пределы, уровни или вознаграждения за количество участников.", "ab-th-name": "Участники", "ab-th-role": "Вклад", "ab-th-score": "Оценка", "ab-th-note": "Заметки", "ab-role-feedback": "Участники с предложениями", "ab-note-prefix": "Недавние предложения:", "ab-empty": "Список формируется по фактическому вкладу - вклад, оценка и подпись основаны на публичных записях", "ab-reward": "Правила премирования (включая налоговые пояснения)", "ab-tier-intro": "После принятия предложения баллы за вносятся в общий рейтинг в соответствии с итоговой оценкой экспертов (21-24 балла +10, 25-27 баллов +15, 28-30 баллов +20).", "ab-honor": "В настоящее время это чистый режим чести: премии основаны на списке почета и подписи, временно нет позиций с физическими призами; автоматически возвращается, когда месячный доход достиг уровня, позволяющего поддерживать физические призы (оценка проводится 1-го числа каждого месяца, действие начинается с следующего запуска).", "ab-history": "📜 История изменений уровней", "ab-hd-date": "Дата", "ab-hd-action": "Действие", "ab-hd-tier": "Уровень", "ab-hd-basis": "Основание", "ab-no-ref": "Декларация об отсутствии уровней вознаграждения", "ab-no-ref-desc": "На нашем сайте нет многоуровневой дистрибуции, нет системы \"верхних-нижних\" линий и нет возвратов по уровням. Любые формы привлечения людей и вознаграждений в зависимости от количества привлеченных лиц отсутствуют.", "ab-privacy": "Пояснение по конфиденциальности", "ab-privacy-desc": "Продукт представляет собой полностью фронтенд-страницу: не собирает личную информацию, не загружает данные пользователей; содержит только обычные данные о посещениях, необходимые для статистики сайта и соответствующей рекламы.", "ab-feedback": "Предложить идею", "ab-fb-a": "У вас есть идеи или предложения для улучшения?", "ab-fb-link": "Нажмите здесь, чтобы предложить идею", "ab-fb-b": ". После принятия предложения оценка вклада рассчитывается по фактическому вкладу и автоматически добавляется в список участников."},
    "pt": {"ab-h1": "Sobre este site", "ab-rules": "Regras de contribuição", "ab-rules-desc": "A contribuição é avaliada conforme a contribuição real (código, design, conteúdo, feedback, promoção em conformidade, etc.), não conforme a avaliação de recrutamento; não há prêmios de linha superior, de nível ou de pessoa. ", "ab-th-name": "Contribuinte", "ab-th-role": "Contribuição de conteúdo", "ab-th-score": "Classificação", "ab-th-note": "Observação", "ab-role-feedback": "Contribuinte de sugestão", "ab-note-prefix": "Adotado recentemente: ", "ab-empty": "A lista está sendo registrada conforme a contribuição real - o conteúdo da contribuição, a classificação e o nome são baseados em registros públicos.", "ab-reward": "Regras de prêmio (com esclarecimento fiscal)", "ab-tier-intro": "Após a aceitação da sugestão, a pontuação de contribuição é calculada com base na pontuação total da avaliação (21-24 pontos +10, 25-27 pontos +15, 28-30 pontos +20).", "ab-honor": "Atualmente é um modelo puramente honorário: os prêmios são baseados na lista de honra e no nome, sem níveis de prêmio físico; o nível de receita mensal de anúncio atingindo o nível que pode suportar prêmios físicos será automaticamente restaurado (avaliação mensal em 1 de cada mês, a recuperação de receita entra em vigor na próxima execução).", "ab-history": "📜 Histórico de ajuste de níveis", "ab-hd-date": "Data", "ab-hd-action": "Ação", "ab-hd-tier": "Nível", "ab-hd-basis": "Base", "ab-no-ref": "Declaração de não recompensa de nível", "ab-no-ref-desc": "Todos os produtos deste site não têm distribuição de multi-nível, não há linha superior e inferior, não há recompensa de nível; não existe qualquer forma de recrutamento de pessoas ou pagamento com base no número de pessoas.", "ab-privacy": "Declaração de privacidade", "ab-privacy-desc": "Os produtos são todas páginas de frontend puras: não coletamos informações pessoais, não carregamos dados do usuário; apenas dados de acesso comuns necessários para a estatística do site e anúncios em conformidade.", "ab-feedback": "Dar sugestão", "ab-fb-a": "Tem alguma ideia ou sugestão de melhoria?", "ab-fb-link": "Clique aqui para enviar sugestão", "ab-fb-b": ". Após a aceitação da sugestão, a classificação de contribuição é calculada conforme a contribuição real e automaticamente listada na lista de contribuintes."},
    "ar": {"ab-h1": "عن هذا الموقع", "ab-rules": "قواعد المساهمة", "ab-rules-desc": "تقييم المساهمات حسب المساهمة الفعلية (كود، تصميم، محتوى، ملاحظات، الترويج المتناسب إلخ)، وليس حسب جذب الآخرين؛ لا توجد جولات أو مستويات أو مكافآت رأسية.", "ab-th-name": "المساهمون", "ab-th-role": "المساهمة في المحتوى", "ab-th-score": "التقييم", "ab-th-note": "ملاحظات", "ab-role-feedback": "مساهمون في الملاحظات", "ab-note-prefix": "المساهمات الأخيرة المقبولة: ", "ab-empty": "القائمة تُسجل حسب المساهمات الفعلية - المحتوى، التقييم، والاسم تُسجل وفقًا للسجلات العامة.", "ab-reward": "قواعد المكافآت (بما في ذلك الشرح الضريبي)", "ab-tier-intro": "بعد قبول الملاحظات، يتم حساب نقاط المساهمة بناءً على مجموع التقييمات (21-24 نقطة +10، 25-27 نقطة +15، 28-30 نقطة +20).", "ab-honor": "الوضع الحالي هو نموذج الشرف فقط: المكافآت تُمنح بناءً على القائمة الشرفية والاسم، وليس هناك مستويات مادية للعوائد؛ عند الوصول إلى مستوى الدخل الشهري الذي يمكن دعم العوائد المادية، يتم استعادة ذلك تلقائيًا (يتم التقييم في الأول من كل شهر، ويُطبق التفعيل بعد استعادة الدخل).", "ab-history": "📜 تاريخ التغيير في المستويات", "ab-hd-date": "التاريخ", "ab-hd-action": "الإجراء", "ab-hd-tier": "المستوى", "ab-hd-basis": "الأساس", "ab-no-ref": "بيان عدم وجود مكافآت بالتدرج", "ab-no-ref-desc": "جميع المنتجات في هذا الموقع ليس لها توزيع متعدد المستويات، وليس هناك خطوط أعلى وأسفل أو مكافآت بالتدرج؛ لا وجود لأي شكل من أشكال جذب الآخرين أو الدفع بناءً على عدد الأشخاص.", "ab-privacy": "بيان الخصوصية", "ab-privacy-desc": "جميع المنتجات هي صفحات أمامية فقط: لا يتم جمع معلومات الشخصية، ولا يتم تحميل بيانات المستخدمين؛ تتضمن فقط بيانات الحركة العادية المطلوبة لتحليل الموقع والترويج المتناسب.", "ab-feedback": "قدم اقتراح", "ab-fb-a": "هل لديك أي أفكار أو مقترحات لتحسين؟", "ab-fb-link": "انقر هنا لتقديم اقتراح", "ab-fb-b": ". بعد قبول الملاحظات، يتم تقييم المساهمة الفعلية تلقائيًا وتسجيلها في قائمة المساهمين."},
    "hi": {"ab-h1": "इस साइट के बारे में", "ab-rules": "योगदान नियम", "ab-rules-desc": "योगदान वास्तविक योगदान पर रैंकिंग किया जाता है (कोड, डिजाइन, सामग्री, प्रतिक्रिया, अवैध प्रचार आदि), न कि लोगों को लाने पर रैंकिंग; कोई ऊपर-नीचे, स्तर या मनुष्य राशि पुरस्कार नहीं है。", "ab-th-name": "योगदानकर्ता", "ab-th-role": "योगदान सामग्री", "ab-th-score": "रेटिंग", "ab-th-note": "टिप्पणी", "ab-role-feedback": "सुझाव देने वाला", "ab-note-prefix": "हाल ही में अपनाया गया: ", "ab-empty": "सूची वास्तविक योगदान पर रजिस्टरिंग कर रही है - योगदान सामग्री, रेटिंग और नामकरण सार्वजनिक रिकॉर्ड के अनुसार हैं", "ab-reward": "पुरस्कार नियम (विधि स्पष्टीकरण सहित)", "ab-tier-intro": "सुझाव अपनाए जाने के बाद समीक्षा के कुल अंक पर योगदान अंक गिना जाता है (21-24 अंक +10, 25-27 अंक +15, 28-30 अंक +20).", "ab-honor": "वर्तमान में यह सफलतापूर्ण मोड है: पुरस्कार सम्मान सूची और नामकरण के अनुसार है, फिजील पुरस्कार स्तर नहीं है; विज्ञापन के महीना आय जो फिजील पुरस्कार को सहारा दे सकता है, स्वचालित रूप से फिजील पुरस्कार स्तर बहाल हो जाता है (प्रत्येक महीने 1 तारीख को समीक्षा, आय बहाल होने के बाद अगली बार लागू होता है).", "ab-history": "📜 स्तर समायोजन इतिहास", "ab-hd-date": "तारीख", "ab-hd-action": "गतिविधि", "ab-hd-tier": "स्तर", "ab-hd-basis": "आधार", "ab-no-ref": "बिना स्तर रिटर्न घोषणा", "ab-no-ref-desc": "इस साइट के सभी उत्पाद बहुस्तर वितरण, ऊपर-नीचे, स्तर रिटर्न नहीं हैं; किसी भी रूप में लोगों को लाने, व्यक्ति की संख्या के आधार पर भुगतान नहीं है।", "ab-privacy": "गोपनीयता स्पष्टीकरण", "ab-privacy-desc": "उत्पाद सबसे अग्रिम पृष्ठभूमि पृष्ठ है: व्यक्तिगत जानकारी एकत्र नहीं की जाती, उपयोगकर्ता डाटा नहीं अपलोड किया जाता; केवल स्टेशन सांख्यिकी और अवैध विज्ञापन के लिए आवश्यक नियमित अवलोकन डाटा है।", "ab-feedback": "सुझाव दें", "ab-fb-a": "कोई विचार या सुधार सुझाव है? ", "ab-fb-link": "यहाँ क्लिक करके सुझाव दें", "ab-fb-b": "। सुझाव अपनाए जाने के बाद वास्तविक योगदान पर रैंकिंग किया जाता है, स्वचालित रूप से योगदानकर्ता सूची में अपने स्थान पा लेता है。"},
    "id": {"ab-h1": "Tentang Situs Ini", "ab-rules": "Aturan Kontribusi", "ab-rules-desc": "Kontribusi dinilai berdasarkan kontribusi aktual (kode, desain, konten, umpan balik, promosi kepatuhan, dll.), bukan berdasarkan jumlah orang yang diundang; tidak ada batas atas/bawah, tingkatan, atau hadiah per orang.", "ab-th-name": "Kontributor", "ab-th-role": "Isi Kontribusi", "ab-th-score": "Skor", "ab-th-note": "Catatan", "ab-role-feedback": "Kontributor Tanggapan", "ab-note-prefix": "Terakhir Terima:", "ab-empty": "Daftar berdasarkan pendaftaran kontribusi nyata - konten, skor, dan tanda tangan berdasarkan catatan publik.", "ab-reward": "Aturan Penghargaan (termasuk penjelasan pajak)", "ab-tier-intro": "Setelah tanggapan diadopsi, kontribusi dihitung berdasarkan total skor penilaian (21-24 poin +10, 25-27 poin +15, 28-30 poin +20).", "ab-honor": "Saat ini mode kehormatan murni: hadiah berdasarkan peringkat kehormatan dan penulisan nama, belum ada tingkatan hadiah fisik; setelah pendapatan bulanan iklan mencapai level yang dapat mendukung hadiah fisik, akan otomatis kembali (dievaluasi setiap tanggal 1, akan berlaku pada berikutnya setelah pendapatan pulih).", "ab-history": "📜 Sejarah Perubahan Tingkat", "ab-hd-date": "Tanggal", "ab-hd-action": "Tindakan", "ab-hd-tier": "Tingkat", "ab-hd-basis": "Dasar", "ab-no-ref": "Deklarasi Tidak Ada Referral Tingkat", "ab-no-ref-desc": "Semua produk di situs ini tidak memiliki sistem multi-level marketing, tidak ada upline/downline, dan tidak ada bonus bertingkat. Tidak ada bentuk apa pun dari perekrutan anggota atau kompensasi berdasarkan jumlah orang yang direkrut.", "ab-privacy": "Keterangan Privasi", "ab-privacy-desc": "Produk semuanya adalah halaman depan: tidak mengumpulkan informasi pribadi, tidak mengunggah data pengguna; hanya mengandung data kunjungan biasa yang diperlukan untuk statistik situs dan iklan konformitas.", "ab-feedback": "Beri Tanggapan", "ab-fb-a": "Ada ide atau saran peningkatan?", "ab-fb-link": "Klik di sini untuk mengirim tanggapan", "ab-fb-b": "Tanggapan yang diadopsi akan dihitung berdasarkan kontribusi nyata dan otomatis masuk ke daftar kontributor."},
    "vi": {"ab-h1": "Về trang web này", "ab-rules": "Quy tắc đóng góp", "ab-rules-desc": "Đánh giá đóng góp dựa trên điểm số thực tế (mã nguồn, thiết kế, nội dung, phản hồi, quảng bá tuân thủ, v.v.), không dựa trên số người giới thiệu; không giới hạn trên dưới, cấp bậc hay thưởng theo đầu người.", "ab-th-name": "Người đóng góp", "ab-th-role": "Nội dung đóng góp", "ab-th-score": "Đánh giá", "ab-th-note": "Ghi chú", "ab-role-feedback": "Người đóng góp ý kiến", "ab-note-prefix": "Gần đây đã chấp nhận: ", "ab-empty": "Bảng xếp hạng đang đăng ký thực tế đóng góp - nội dung đóng góp, đánh giá và tên được công bố theo hồ sơ công khai", "ab-reward": "Quy tắc phần thưởng (bao gồm giải thích thuế)", "ab-tier-intro": "Ý kiến được chấp nhận sau đó tính điểm đóng góp theo tổng điểm đánh giá (21-24 điểm +10, 25-27 điểm +15, 28-30 điểm +20).", "ab-honor": "Hiện tại là chế độ hoàn toàn danh dự: phần thưởng dựa trên bảng danh dự và tên, tạm thời không có mức phần thưởng vật chất; khi thu nhập quảng cáo hàng tháng đạt mức có thể hỗ trợ phần thưởng vật chất sẽ tự động khôi phục (đánh giá hàng tháng vào ngày 1, sau khi thu nhập khôi phục sẽ áp dụng ngay trong lần chạy tiếp theo).", "ab-history": "📜 Lịch sử điều chỉnh mức", "ab-hd-date": "Ngày", "ab-hd-action": "Hành động", "ab-hd-tier": "Mức", "ab-hd-basis": "Cơ sở", "ab-no-ref": "Báo cáo không có phần thưởng theo cấp độ", "ab-no-ref-desc": "Tất cả sản phẩm của trang web này không có phân phối đa cấp, không có dưới trên, không có phần thưởng theo cấp độ; không có bất kỳ hình thức mời người khác nào hoặc tính tiền theo số lượng.", "ab-privacy": "Giải thích quyền riêng tư", "ab-privacy-desc": "Sản phẩm đều là trang web thuần frontend: không thu thập thông tin cá nhân, không tải lên dữ liệu người dùng; chỉ chứa dữ liệu truy cập thông thường cần thiết cho thống kê trang web và quảng cáo tuân thủ.", "ab-feedback": "Gửi ý kiến", "ab-fb-a": "Bạn có ý tưởng hoặc đề xuất cải tiến?", "ab-fb-link": "Nhấp vào đây để gửi ý kiến", "ab-fb-b": "Ý kiến được chấp nhận sau đó sẽ được đánh giá theo thực tế đóng góp và tự động đăng trên bảng xếp hạng người đóng góp."},
    "th": {"ab-h1": "เกี่ยวกับเว็บไซต์นี้", "ab-rules": "กฎระเบียบการบริจาค", "ab-rules-desc": "การบริจาคจะถูกประเมินตามความบริจาคที่แท้จริง (รหัสที่เขียน, การออกแบบ, สิ่งเนื้อหา, ความเห็น, การโฆษณาตามกฎหมาย และอื่น ๆ) ไม่ตามการนำคนเข้ามา; ไม่มีระดับขึ้นและลง, ระดับหรือรางวัลตามหัวของคนเข้ามา。", "ab-th-name": "ผู้บริจาค", "ab-th-role": "สิ่งที่บริจาค", "ab-th-score": "คะแนน", "ab-th-note": "หมายเหตุ", "ab-role-feedback": "ผู้แบ่งประกาศความเห็น", "ab-note-prefix": "รับความเห็นล่าสุด：", "ab-empty": "รายชื่อตามความบริจาคที่แท้จริงกำลังบันทึก——สิ่งที่บริจาค, คะแนนและชื่อนั้นจะตามบันทึกที่เปิดเผยเป็นหลัก", "ab-reward": "กฎระเบียบรางวัล (รวมถึงการชี้แจงภาษี)", "ab-tier-intro": "หลังจากความเห็นถูกรับรอง คะแนนบริจาคจะนับตามคะแนนรวมที่ประเมิน (21-24 คะแนน +10, 25-27 คะแนน +15, 28-30 คะแนน +20)", "ab-honor": "ในระบบเกียรติยศแบบสุทธิอยู่ตอนนี้: รางวัลจะนับตามตารางเกียรติยศและชื่อ ยังไม่มีระดับที่มีรางวัลทางหลังที่เป็นจริง; ระบบจะกลับมาทำงานโดยอัตโนมัติเมื่อรายได้ประจำเดือนของการโฆษณาสามารถสนับสนุนรางวัลทางหลังที่เป็นจริง (ประเมินทุกวันที่ 1 ของเดือน และระบบจะทำงานอีกครั้งหลังจากที่รายได้กลับมา)", "ab-history": "📜 ประวัติการปรับเปลี่ยนระดับ", "ab-hd-date": "วันที่", "ab-hd-action": "การกระทำ", "ab-hd-tier": "ระดับ", "ab-hd-basis": "ตาม", "ab-no-ref": "ปฏิญาณการไม่มีระดับแบ่งประกอบ", "ab-no-ref-desc": "ทุกสินค้าของเว็บไซต์นี้ไม่มีการแบ่งประกอบระดับหลายระดับ, ไม่มีระดับขึ้นและลง, ไม่มีระดับแบ่งประกอบ; ไม่มีการนำคนเข้ามาหรือการจ่ายเงินตามจำนวนคนเข้ามาใดๆ", "ab-privacy": "คำชี้แจงความเป็นส่วนตัว", "ab-privacy-desc": "สินค้าทั้งหมดเป็นหน้าเว็บที่เปิดเผย: ไม่มีการรวบรวมข้อมูลส่วนบุคคล, ไม่มีการอัพโหลดข้อมูลผู้ใช้; มีเพียงข้อมูลการเข้าเว็บและการโฆษณาที่เป็นปกติที่จำเป็นสำหรับการตรวจสอบเว็บไซต์และการโฆษณาตามกฎหมาย", "ab-feedback": "แบ่งประกาศความเห็น", "ab-fb-a": "มีความคิดหรือข้อเสนอแนะที่ดีหรือไม่?", "ab-fb-link": "คลิกที่นี่เพื่อยื่นความเห็น", "ab-fb-b": "ความเห็นที่ถูกรับรองจะถูกประเมินตามความบริจาคที่แท้จริง และจะถูกบันทึกในรายชื่อผู้บริจาค"},
};
function decodeEntities(s) {
    return (s || "").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&quot;/gi, '"').replace(/&#39;/gi, "'").replace(/\s+/g, " ").trim();
}
// 原文语言探测：CJK 字符占比高 → 中文原文页（en 包需要真翻译而不是原文照搬，否则英文访客看到中文）
function isCjkTexts(texts) {
    let cjk = 0, nonAscii = 0;
    for (let i = 0; i < texts.length; i++) {
        for (let j = 0; j < texts[i].length; j++) {
            let c = texts[i].charCodeAt(j);
            if (c > 127) {
                nonAscii++;
                if (c >= 0x4E00 && c <= 0x9FFF) cjk++;
            }
        }
    }
    return nonAscii > 10 && cjk / nonAscii > 0.5;
}
// 提取产品 JS 里的字符串字面量（按钮状态/提示语等动态文案）：运行时由页面 JS 设置，切换语言后靠 MutationObserver 自动按当前语言重翻
function extractJsStrings(html) {
    let seen = {};
    let out = [];
    let re = /<script[^>]*>([\s\S]*?)<\/script>/gi;
    let m;
    while ((m = re.exec(html)) !== null) {
        let code = m[1];
        let strRe = /'([^'\\\n]{2,120})'|"([^"\\\n]{2,120})"/g;
        let s;
        while ((s = strRe.exec(code)) !== null) {
            let txt = s[1] !== undefined ? s[1] : s[2];
            txt = txt.trim();
            if (txt.length < 2 || txt.length > 120) continue;
            if (!/^[A-Za-z\u4e00-\u9fa5][A-Za-z0-9\u4e00-\u9fa5 .,!?:;'’\-—\/%&+]*$/.test(txt)) continue; // 排除代码/URL/符号串（中英文文案都收，中文原页的动态文案也要翻译）
            if (txt.indexOf(" ") < 0 && !/[.!?…。！？：]$/.test(txt)) continue; // 必须是像人话的文案
            if (txt === "广告" || txt === "完全免费" || txt === "关于" || txt === "提意见") continue;
            if (!seen[txt]) { seen[txt] = 1; out.push(txt); }
            if (out.length >= 30) break;
        }
        if (out.length >= 30) break;
    }
    return out;
}
// 提取静态可见文案（只翻叶子文本；页脚四件套由 I18N_FIXED 处理，排除）
function extractVisibleTexts(html) {
    let body = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ");
    let re = /<(h[1-6]|p|button|a|span|label|td|th|li|option|figcaption|summary|legend)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/gi;
    let seen = {};
    let out = [];
    let m;
    while ((m = re.exec(body)) !== null) {
        let txt = decodeEntities(m[2].replace(/<[^>]+>/g, " "));
        if (txt.length < 2 || txt.length > 120) continue;
        if (!/[A-Za-z\u4e00-\u9fa5]/.test(txt)) continue; // 跳过纯数字/符号
        if (/["\\]/.test(txt)) continue; // 双引号/反斜杠会破坏 JSON 键，跳过
        if (txt === "广告" || txt === "完全免费" || txt === "关于" || txt === "提意见") continue; // 页脚四件套走 I18N_FIXED
        if (/©|&copy;|copy;|all rights reserved|版权所有|版权/i.test(txt)) continue; // 版权行不翻译（页面本就不该有；硬检查会拦，这里兜底防扩散到 20 个语言包）
        if (!seen[txt]) { seen[txt] = 1; out.push(txt); }
        if (out.length >= 60) break;
    }
    return out;
}
// GLM 翻译：每语言单独一次调用（扁平格式，实测三语合一的大 JSON 模型容易翻车——格式坍塌/语言混用）；
// 单语言失败只丢该语言包，其余照常；全部失败才返回空对象（页面保持原文单语言）
function translatePageTextsOne(lang, langName, texts, maxTok) {
    if (dailyTokenCost > DAILY_BUDGET) return null;
    let prompt = "把下面的文案逐条翻译成 " + langName + "。\n严格输出一个 JSON 对象，形如：\n{\"原文\":\"译文\",\"原文2\":\"译文2\"}\n要求：\n- 键必须与原文完全一致（含大小写与标点），禁止省略任何条目\n- 译文必须全部使用该语言本身，严格禁止出现中文或其他语言，发现混用即不合格\n- 保持文案里的数字与格式原样\n- 禁止 markdown 围栏、禁止任何解释文字，只输出 JSON\n原文列表：\n" + JSON.stringify(texts);
    let raw = callLLM([
        {role: "system", content: "你是专业的" + langName + "译者。只输出 JSON，不输出任何其他内容。"},
        {role: "user", content: prompt}
    ], maxTok || 8000, false, 0.3); // 输出含原文键+译文，原 2000 必截断（i18n 丢包根因）；温度 0.3 提高键精确度
    if (!raw) return null;
    let j = raw.replace(/^```[a-z]*\s*/i, "").replace(/```\s*$/, "").trim();
    try {
        let obj = JSON.parse(j);
        if (!obj || typeof obj !== "object") return null;
        // 键匹配校验：至少一半键能在原文列表里对上，否则视为幻觉输出直接丢弃
        let hit = 0;
        for (let k in obj) {
            if (texts.indexOf(k) >= 0) hit++;
        }
        if (hit < Math.max(1, Math.floor(texts.length * 0.5))) {
            log("⚠️ i18n 翻译键匹配率过低（" + lang + "：" + hit + "/" + texts.length + "），丢弃该语言包");
            return null;
        }
        return obj;
    } catch (e) {}
    log("⚠️ i18n 翻译输出不是合法 JSON（" + lang + "），跳过该语言");
    return null;
}
// 稳健翻译：单次失败→对半拆分重试；成功但有缺键→补翻缺失条目（根治截断丢包与"半包"）
function translateTextsRobust(lang, langName, texts) {
    if (!texts || !texts.length) return null;
    let obj = translatePageTextsOne(lang, langName, texts);
    if (!obj && texts.length > 2) {
        let h = Math.floor(texts.length / 2);
        let a = translatePageTextsOne(lang, langName, texts.slice(0, h));
        let b = translatePageTextsOne(lang, langName, texts.slice(h));
        if (a || b) {
            obj = {};
            if (a) for (let k in a) obj[k] = a[k];
            if (b) for (let k in b) obj[k] = b[k];
            log("⚠️ i18n " + lang + " 单次输出超限，已对半拆分重试（" + Object.keys(obj).length + "/" + texts.length + " 条）");
        }
    }
    if (!obj) return null;
    let miss = [];
    for (let i = 0; i < texts.length; i++) if (obj[texts[i]] === undefined) miss.push(texts[i]);
    if (miss.length > 0 && miss.length < texts.length && dailyTokenCost <= DAILY_BUDGET) {
        let m = translatePageTextsOne(lang, langName, miss);
        if (m) {
            let fixed = 0;
            for (let k2 in m) { if (obj[k2] === undefined) { obj[k2] = m[k2]; fixed++; } }
            if (fixed > 0) log("🔧 i18n " + lang + " 补翻缺失 " + fixed + " 条");
        }
    }
    let left = 0;
    for (let j = 0; j < texts.length; j++) if (obj[texts[j]] === undefined) left++;
    if (left > 0) log("⚠️ i18n " + lang + " 仍缺 " + left + " 条（该语言将显示部分原文）");
    return obj;
}
function translatePageTexts(texts) {
    let out = {};
    let langs = [["zh-CN", "简体中文"], ["es", "西班牙语"], ["ja", "日语"], ["ko", "韩语"], ["fr", "法语"], ["de", "德语"], ["ru", "俄语"], ["pt", "葡萄牙语"], ["ar", "阿拉伯语"], ["hi", "印地语"], ["id", "印尼语"], ["vi", "越南语"], ["th", "泰语"]];
    for (let i = 0; i < langs.length; i++) {
        if (dailyTokenCost > DAILY_BUDGET) break;
        let one = translateTextsRobust(langs[i][0], langs[i][1], texts);
        if (one) out[langs[i][0]] = one;
    }
    return out;
}
// 浏览器端解析器（ES5，无外部依赖）；手动选择 localStorage > navigator.language > IP 兜底 > en
const I18N_RESOLVER_SRC = [
    "(function(){",
    "var LS=\"radar-lang\";",
    "var PACKS=window.__I18N_PACKS||{};",
    "var FIXED=window.__I18N_FIXED||{};",
    "var GEO=window.__I18N_GEO||{};",
    "var RES_VER=\"20261003b\";",
    "var busy=false;",
    "function norm(s){return (s||\"\").replace(/\\s+/g,\" \").trim();}",
    "function navLang(){",
    "var l=(navigator.language||navigator.userLanguage||\"\").toLowerCase();",
    "if(l.indexOf(\"zh\")===0)return \"zh-CN\";",
    "if(l.indexOf(\"es\")===0)return \"es\";",
    "if(l.indexOf(\"ja\")===0)return \"ja\";",
    "if(l.indexOf(\"ko\")===0)return \"ko\";",
    "if(l.indexOf(\"fr\")===0)return \"fr\";",
    "if(l.indexOf(\"de\")===0)return \"de\";",
    "if(l.indexOf(\"ru\")===0)return \"ru\";",
    "if(l.indexOf(\"pt\")===0)return \"pt\";",
    "if(l.indexOf(\"ar\")===0)return \"ar\";",
    "if(l.indexOf(\"hi\")===0)return \"hi\";",
    "if(l.indexOf(\"id\")===0)return \"id\";",
    "if(l.indexOf(\"vi\")===0)return \"vi\";",
    "if(l.indexOf(\"th\")===0)return \"th\";",
    "if(l.indexOf(\"en\")===0)return \"en\";",
    "return \"\";",
    "}",
    "function applyTexts(lang,fromEn){",
    "if(busy)return;",
    "busy=true;",
    "try{",
    "if(!PACKS[lang])lang=\"en\";",
    "var map=PACKS[lang]||{};",
    "var enMap=PACKS.en||{};",
    "var fix=FIXED[lang]||{};",
    "var els=document.querySelectorAll(\"[data-i18n-id]\");",
    "for(var i=0;i<els.length;i++){",
    "var id=els[i].getAttribute(\"data-i18n-id\");",
    "if(fix[id]&&fix[id]!==els[i].textContent)els[i].textContent=fix[id];",
    "}",
    "var nodes=document.querySelectorAll(\"h1,h2,h3,h4,h5,h6,p,button,a,span,label,td,th,li,option,figcaption,summary,legend\");",
    "for(var j=0;j<nodes.length;j++){",
    "var el=nodes[j];",
    "if(el.getAttribute(\"data-i18n-id\"))continue;",
    "if(el.closest&&el.closest(\"#lang-switch\"))continue;",
    "if(el.closest&&el.closest(\"#adSlot\"))continue;",
    "if(el.children&&el.children.length)continue;",
    "var cur=norm(el.textContent);",
    "var key=null;",
    "if(enMap[cur]!==undefined){key=cur;if(el.__i18nBase===undefined)el.__i18nBase=cur;}",
    "else if(el.__i18nCur!==undefined&&cur===el.__i18nCur&&el.__i18nBase!==undefined){key=el.__i18nBase;}",
    "else if(el.__i18nBase===undefined){el.__i18nBase=cur;}",
    "if(key!==null&&map[key]&&map[key]!==el.textContent){el.textContent=map[key];el.__i18nCur=map[key];}",
    "}",
    "if(map.__title__)document.title=map.__title__;",
    "}finally{busy=false;}",
    "}",
    "function apply(lang,persist){",
    "applyTexts(lang,false);",
    "try{document.documentElement.setAttribute(\"dir\",lang===\"ar\"?\"rtl\":\"ltr\");}catch(e){}",
    "if(persist){try{localStorage.setItem(LS,lang);}catch(e){}}",
    "}",
    "function geoApply(){",
    "try{",
    "var x=new XMLHttpRequest();",
    "x.open(\"GET\",\"https://ipwho.is/\",true);",
    "x.timeout=4000;",
    "x.onreadystatechange=function(){",
    "if(x.readyState!==4)return;",
    "var cc=\"\";",
    "try{cc=(JSON.parse(x.responseText)||{}).country_code||\"\";}catch(e){}",
    "var l=GEO[cc]||\"en\";",
    "apply(PACKS[l]?l:\"en\");",
    "};",
    "x.onerror=function(){apply(\"en\");};",
    "x.send();",
    "}catch(e){apply(\"en\");}",
    "}",
    "function watchMutations(){",
    "if(typeof MutationObserver===\"undefined\")return;",
    "try{",
    "var t=null;",
    "var obs=new MutationObserver(function(){",
    "if(busy)return;",
    "if(t)clearTimeout(t);",
    "t=setTimeout(function(){",
    "var sel=document.getElementById(\"lang-select\");",
    "if(!sel)return;",
    "applyTexts(sel.value,true);",
    "},50);",
    "});",
    "obs.observe(document.body,{subtree:true,childList:true,characterData:true});",
    "}catch(e){}",
    "}",
    "function init(){",
    "var sel=document.getElementById(\"lang-select\");",
    "if(!sel)return;",
    "sel.onchange=function(){apply(sel.value,true);};",
    "var saved=\"\";",
    "try{saved=localStorage.getItem(LS)||\"\";}catch(e){}",
    "if(saved&&PACKS[saved]){sel.value=saved;apply(saved);return;}",
    "var nv=navLang();",
    "if(nv&&PACKS[nv]){sel.value=nv;apply(nv);return;}",
    "geoApply();",
    "}",
    "if(document.readyState===\"loading\"){",
    "document.addEventListener(\"DOMContentLoaded\",init);",
    "}else{",
    "init();",
    "}",
    "watchMutations();",
    "})();"
];
// 多语言块构建：语言包 + 右上角切换器 + 解析器（</body> 前注入，标记包裹便于重写前剥离）
function buildI18nBlock(packs, fixedMap) {
    let opts = "";
    I18N_LANGS.forEach(function(l) {
        if (packs[l.code]) opts += '<option value="' + l.code + '">' + l.name + "</option>";
    });
    if (!opts) return "";
    let switcher = '<div id="lang-switch" style="position:fixed;top:8px;right:8px;z-index:9999;">'
        + '<select id="lang-select" style="background:#1f232b;color:#e6e9ef;border:1px solid #3a4152;border-radius:8px;padding:4px 8px;font-size:12px;cursor:pointer;">'
        + opts + "</select></div>";
    // JSON 内的 < > & 转 \uXXXX，防止页面文案里的尖括号提前闭合 script 标签
    let jsonPacks = JSON.stringify(packs).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
    let jsonFixed = JSON.stringify(fixedMap || I18N_FIXED).replace(/</g, "\\u003c");
    let jsonGeo = JSON.stringify(I18N_GEO).replace(/</g, "\\u003c");
    return "<!-- " + I18N_MARK + " -->"
        + "<script>window.__I18N_PACKS=" + jsonPacks + ";window.__I18N_FIXED=" + jsonFixed + ";window.__I18N_GEO=" + jsonGeo + ";</script>"
        + switcher
        + "<script>" + I18N_RESOLVER_SRC.join("\n") + "</script>"
        + "<!-- " + I18N_MARK_END + " -->";
}
// 重写前剥离多语言块（系统注入，不喂给 AI 照抄）
function stripI18nBlock(html) {
    if (!html) return html;
    let a = html.indexOf("<!-- " + I18N_MARK + " -->");
    if (a < 0) return html;
    let b = html.indexOf("<!-- " + I18N_MARK_END + " -->");
    if (b < 0) return html.slice(0, a);
    return html.slice(0, a) + html.slice(b + ("<!-- " + I18N_MARK_END + " -->").length);
}
// 多语言注入入口：幂等、翻译失败静默保持原文单语言，异常不影响主流程
function injectI18n(html) {
    if (!html || html.indexOf(I18N_MARK) >= 0) return html; // 已注入，跳过
    try {
        html = stripI18nBlock(html);
        let texts = extractVisibleTexts(html);
        // 动态文案（按钮状态/提示语等 JS 字符串字面量）一并翻译：切换语言后按钮响应文案同样要变
        let seenAll = {};
        texts = texts.concat(extractJsStrings(html)).filter(function(k) {
            if (seenAll[k]) return false;
            seenAll[k] = 1;
            return true;
        }).slice(0, 60);
        let tm = html.match(/<title>([\s\S]*?)<\/title>/i);
        let titleKey = tm ? decodeEntities(tm[1].replace(/<[^>]+>/g, " ")) : "";
        if (titleKey && texts.indexOf(titleKey) < 0) texts.unshift(titleKey);
        if (!texts.length) return html;
        let t = translatePageTexts(texts);
        if (!t || !Object.keys(t).length) {
            log("⚠️ i18n 翻译全部失败，页面保持原文单语言");
            return html;
        }
        // 中文原文页：en 包不能照搬原文（英文访客会看到中文），en 也要真翻译；英文原文页 en=原文即可
        let srcIsCjk = isCjkTexts(texts);
        let packs = {};
        if (srcIsCjk) {
            packs.en = translateTextsRobust("en", "英语", texts) || {};
            texts.forEach(function(k) { if (packs.en[k] === undefined) packs.en[k] = k; }); // 缺失条目回填原文
        } else {
            packs.en = {};
            texts.forEach(function(k) { packs.en[k] = k; });
        }
        I18N_LANGS.forEach(function(l) {
            if (l.code !== "en" && t[l.code] && typeof t[l.code] === "object") packs[l.code] = t[l.code];
        });
        if (titleKey) {
            for (let k2 in packs) {
                packs[k2].__title__ = (packs[k2][titleKey] !== undefined) ? packs[k2][titleKey] : titleKey;
            }
        }
        let block = buildI18nBlock(packs);
        if (!block) return html;
        let i = html.lastIndexOf("</body>");
        if (i >= 0) return html.slice(0, i) + block + html.slice(i);
        return html + block;
    } catch (e) {
        log("⚠️ i18n 注入异常：" + e);
        return html;
    }
}

// ========== 页面脚注：产品页只放极简广告位 + 一行小字（完全免费 + 提意见按钮 + about 链接）==========
// 声明类内容（贡献/奖励/税务/隐私/无层级返利）统一放 about 页，产品页不堆声明
const FREE_FOOTER_MARK = "free-ad-standard-2026";

// 榜单数据源：意见闭环贡献分（意见/贡献榜单.json）与雷达密钥.json 手工登记项合并，按名字去重（榜单文件优先）
function loadContributors() {
    let base = (CONTRIBUTORS || []).map(function(c) { return c; });
    let extra = [];
    try {
        let j = JSON.parse(files.read(CONTRIB_PATH));
        if (j && Array.isArray(j.list)) extra = j.list;
    } catch (e) {}
    let map = {};
    base.concat(extra).forEach(function(c) { if (c && c.name) map[c.name] = c; });
    let arr = [];
    for (let k in map) arr.push(map[k]);
    return arr;
}

// 提意见入口：直接开 GitHub issue（带意见模板），未配置 GitHub 时返回空串（不显示入口）
function feedbackIssueLink() {
    if (typeof GITHUB_USER !== "undefined" && GITHUB_USER && GITHUB_REPO) {
        return "https://github.com/" + GITHUB_USER + "/" + GITHUB_REPO + "/issues/new"
            + "?labels=" + encodeURIComponent("意见")
            + "&title=" + encodeURIComponent("【意见】")
            + "&body=" + encodeURIComponent("我的意见（尽量具体：哪个产品、希望怎么改、能解决什么问题）：\n");
    }
    return "";
}

// 产品页脚：极简广告位（只标「广告」+广告内容）+ 一行小字「完全免费」+ about 链接 + 提意见按钮
function buildPageFooter() {
    let fb = feedbackIssueLink();
    let adBody = AD_HTML || "";
    return "<!-- " + FREE_FOOTER_MARK + " -->"
        + '<style>'
        + '.page-footer{max-width:960px;margin:20px auto 0;padding:12px 16px;border-top:1px solid #262b36;font-size:12px;color:#8b93a3;font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;display:flex;align-items:center;justify-content:center;gap:14px;flex-wrap:wrap;}'
        + '.page-footer a{color:#00a884;text-decoration:none;}'
        + '.page-footer .fb-btn{background:#00a884;color:#0f1115;border-radius:8px;padding:5px 14px;font-weight:600;}'
        + '.page-footer .ad-mini{width:100%;text-align:center;padding:8px;border:1px dashed #3a4152;border-radius:8px;background:#0c0e13;margin-bottom:4px;color:#6b7280;}'
        + '</style>'
        + '<div class="page-footer">'
        + '<div class="ad-mini" id="adSlot"><span data-i18n-id="footer-ad">广告</span>' + (adBody ? '<br>' + adBody : "") + '</div>'
        + '<span data-i18n-id="footer-free">完全免费</span><a href="about.html" data-i18n-id="footer-about">关于</a>'
        + (fb ? '<a class="fb-btn" href="' + fb + '" target="_blank" rel="noopener" data-i18n-id="footer-fb">提意见</a>' : "")
        + '</div>';
}

// /about 页：给监管/平台看的内容（贡献规则+榜单、奖励规则含税务、隐私说明、无层级返利声明）
function buildAboutPage() {
    let list = loadContributors().slice().sort(function(a, b) { return (b.score || 0) - (a.score || 0); });
    let rows = list.length
        ? list.map(function(c) {
            // 数据行也要翻译：系统生成的「意见贡献者」与「最近采纳：」前缀走固定文案包（data-i18n-id）；
            // 用户提交的意见标题保持原文（动态内容，静态翻译包覆盖不了）；动态字段统一 escapeAttr 防注入
            let roleCell = (c.role === "意见贡献者")
                ? '<span data-i18n-id="ab-role-feedback">意见贡献者</span>'
                : escapeAttr(c.role || "-");
            let noteCell = "";
            let note = c.note || "";
            let np = note.indexOf("最近采纳：");
            if (np >= 0) {
                noteCell = '<span data-i18n-id="ab-note-prefix">最近采纳：</span><span>' + escapeAttr(note.slice(np + 5)) + '</span>';
            } else if (note) {
                noteCell = escapeAttr(note);
            }
            return "<tr><td>" + escapeAttr(c.name || "-") + "</td><td>" + roleCell + "</td><td>"
                 + (c.score || 0) + "</td><td>" + noteCell + "</td></tr>";
        }).join("")
        : '<tr><td colspan="4" data-i18n-id="ab-empty">榜单按实际贡献登记中——贡献内容、评分与署名以公开记录为准</td></tr>';
    let fb = feedbackIssueLink();
    let html = '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8">'
        + '<meta name="viewport" content="width=device-width, initial-scale=1.0">'
        + '<title>关于本站</title><style>'
        + 'body{background:#0f1115;color:#e6e9ef;font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;padding:20px;max-width:960px;margin:0 auto;line-height:1.8;}'
        + 'h1{font-size:22px;}h2{font-size:16px;color:#ffb020;margin:24px 0 8px;border-left:3px solid #ffb020;padding-left:8px;}'
        + 'p{font-size:14px;color:#c6ccd6;margin:6px 0;}'
        + 'ul{font-size:14px;color:#c6ccd6;margin:6px 0;padding-left:22px;}'
        + 'details{font-size:13px;margin:10px 0;}details summary{cursor:pointer;color:#ffb020;}'
        + 'table{width:100%;border-collapse:collapse;font-size:13px;margin:8px 0;}'
        + 'th,td{padding:8px;border-bottom:1px solid #262b36;text-align:left;word-break:break-all;}'
        + 'a{color:#00a884;}'
        + '</style></head><body>'
        + '<h1 data-i18n-id="ab-h1">关于本站</h1>'
        + '<h2 data-i18n-id="ab-rules">贡献规则</h2>'
        + '<p data-i18n-id="ab-rules-desc">贡献按<b>实际贡献</b>评分（代码、设计、内容、反馈、合规推广等），不按拉人评分；不设上下线、层级或人头奖励。</p>'
        + '<table><tr><th data-i18n-id="ab-th-name">贡献者</th><th data-i18n-id="ab-th-role">贡献内容</th><th data-i18n-id="ab-th-score">评分</th><th data-i18n-id="ab-th-note">备注</th></tr>' + rows + '</table>'
        + '<h2 data-i18n-id="ab-reward">奖励规则（含税务说明）</h2>'
        + tierHtml()
        + '<h2 data-i18n-id="ab-no-ref">无层级返利声明</h2>'
        + '<p data-i18n-id="ab-no-ref-desc">本站所有产品<b>无多级分销、无上下线、无层级返利</b>；任何形式的拉人头、按人数计酬均不存在。</p>'
        + '<h2 data-i18n-id="ab-privacy">隐私说明</h2>'
        + '<p data-i18n-id="ab-privacy-desc">产品均为纯前端页面：不收集个人信息、不上传用户数据；仅含站点统计与合规广告所需的常规访问数据。</p>'
        + (fb ? '<h2 data-i18n-id="ab-feedback">提意见</h2><p><span data-i18n-id="ab-fb-a">有想法或改进建议？</span><a href="' + fb + '" target="_blank" rel="noopener"><span data-i18n-id="ab-fb-link">点这里提交意见</span></a><span data-i18n-id="ab-fb-b">。意见被采纳后按实际贡献评分，自动登上贡献者榜单。</span></p>' : "")
        + '</body></html>';
    // 多语言块：标题语言包 + 关于页专用固定文案（硬编码零 token）+ 切换器 + 解析器
    let aboutPacks = {
        en: {__title__: "About This Site"},
        "zh-CN": {__title__: "关于本站"},
        es: {__title__: "Acerca de este sitio"},
        ja: {__title__: "このサイトについて"},
        "ko": {__title__: "이 사이트에 대하여"},
        "fr": {__title__: "À propos de ce site"},
        "de": {__title__: "Über diese Seite"},
        "ru": {__title__: "О сайте"},
        "pt": {__title__: "Sobre este site"},
        "ar": {__title__: "عن هذا الموقع"},
        "hi": {__title__: "इस साइट के बारे में"},
        "id": {__title__: "Tentang Situs Ini"},
        "vi": {__title__: "Về trang web này"},
        "th": {__title__: "เกี่ยวกับเว็บไซต์นี้"}
    };
    let i = html.lastIndexOf("</body>");
    if (i >= 0) html = html.slice(0, i) + buildI18nBlock(aboutPacks, I18N_FIXED_ABOUT) + html.slice(i);
    return html;
}

// 旧版堆砌页脚剥离：旧标准区块的注入点固定是 </body> 前，从旧标记切到 </body> 即整段移除；
// 页脚之后若还有系统注入的多语言块（radar-i18n），只剥到多语言块为止，不能连坐删掉
function stripOldFooter(html) {
    let m = html.indexOf("<!-- " + FREE_FOOTER_MARK + " -->");
    if (m < 0) return html;
    let i = html.lastIndexOf("</body>");
    let i18n = html.indexOf("<!-- " + I18N_MARK + " -->");
    if (i18n > m && i18n < i) i = i18n;
    if (i > m) return html.slice(0, m) + html.slice(i);
    return html.slice(0, m);
}

// 把页脚注入 </body> 前（先剥旧堆砌页脚再注入极简页脚，旧页面自动换新）
function injectStandardBlock(html) {
    if (!html) return html;
    html = stripOldFooter(html);
    let block = buildPageFooter();
    let i = html.lastIndexOf("</body>");
    if (i >= 0) return html.slice(0, i) + block + html.slice(i);
    return html + block;
}

function optimizeProduct() {
    let dir = "/storage/emulated/0/脚本/产出";
    let list = [];
    try {
        list = files.listDir(dir, function(name) {
            // 迭代链修复：基线（无 _vN 后缀）参与轮换，_v1/_v2/_prev 等版本/回退文件全部排除；index.html 是产品总览页，不参与轮换
            return name.endsWith(".html") && name !== "index.html" && !/_(?:v\d+|prev)\.html$/.test(name);
        });
    } catch (e) { return null; }
    if (!list || list.length === 0) return null;
    list.sort();
    // 轮换制：每天优化不同的产品，新旧都照顾到（游标记录）
    let cursorFile = dir + "/优化游标.txt";
    let lastOpt = "";
    try { lastOpt = files.read(cursorFile).trim(); } catch (e) {}
    let idx = list.indexOf(lastOpt);
    let latest = list[(idx + 1) % list.length];
    try { files.write(cursorFile, latest); } catch (e) {}
    log("🔁 优化轮换：本轮优化 → " + latest);
    let html = "";
    try { html = files.read(dir + "/" + latest); } catch (e) { return null; }
    if (!html || html.length < 200) return null;
    // 完整源码给 AI（不截断），超过 QC_SRC_CAP 才截（保护上下文；12KB 截断曾导致尾部功能被 AI 丢弃，20KB 同样会砍掉长产品脚本尾部）
    let src = html.length > QC_SRC_CAP ? html.slice(0, QC_SRC_CAP) + "\n<!-- 源码过长已截断 -->" : html;
    src = stripI18nBlock(stripLegacyCleanup(src)); // 系统注入的多语言块/死代码摘除：喂给 AI 前剥离，写回前重新注入
    // 1) 优化分析（flash 便宜档）
    let anaPrompt = "你是产品增长顾问。下面是一个已上线产品的完整 HTML 源码。请输出优化报告（200字内）：\n1.【免费与合规优化】有无残留付费痕迹（价格/收款码/激活码/付费解锁，必须删除）？产品是否讲清「干嘛的」「怎么用」？给 3 条内具体改进点\n2.【框架优化】产品信息架构（功能顺序、引导动线、首屏信息）哪里弱？给 3 条内具体改进点\n【重要】改进点要小而准，禁止推翻产品整体设计。\n产品源码：\n" + src;
    let ana = callLLM([
        {role: "system", content: "你是资深产品增长顾问。只输出报告。"},
        {role: "user", content: anaPrompt}
    ], 800);
    if (dailyTokenCost > DAILY_BUDGET) return null;
    // 2) 重写 v2（air 模型，完整源码 + 优化清单 + 忠实重写要求）
    let v2Prompt = "根据下面的产品完整源码和优化报告，输出改进版完整 HTML。\n【铁律】\n- 完整保留原有全部功能和 JS 逻辑，只做报告中列出的改进，禁止删减功能、禁止改变产品定位\n- 产品自身的交互脚本必须完整保留（按钮 onclick/事件引用的函数必须有定义），禁止删掉脚本输出死页面；若原页面本身就缺产品脚本，必须补全所有按钮的真实交互逻辑；【可运行铁律】getElementById/querySelector 引用的 id 必须真实存在（或脚本动态赋值），引用不一致（未定义函数/不存在的 id）会被零 token 检查打回\n- 不要改变页面原有文案语言（多语言翻译由系统统一处理）；所有按钮必须真实可交互，禁止 document.querySelector('.class') 单点绑定（只绑第一个元素），禁止伪随机假数据（随机分数+固定提示类）；【禁伪随机】Math.random 禁止生成结论/分数/状态/指标（必须真实计算，做不了就删掉该功能），深色 UI 按钮与背景对比要明显\n- 老产品中若存在收款码（shoukuan.png）、微信收款、价格、激活码（checkCode 等函数）、付费解锁等付费元素，必须全部删除；被锁定的功能一律改为免费可用\n- 【免费红线】严禁新增任何收款码/收款图片（shoukuan）、微信或支付宝收款、价格或金额、激活码/卡密、付费解锁/付费入口、打赏按钮——老产品没有的元素也不许加\n- 【设备红线】不得引入任何需要购买/连接外部设备的新功能（VR/AR 头显、手表手环、监测设备等）；设备类旧功能一律改为纯网页模拟演示版并明确标注\n- 源码里的页脚区块（从 <!-- free-ad-standard-2026 --> 到 </body> 之前）是系统注入的旧页脚，必须整体删除、不要照抄；页脚与免费声明由系统统一处理\n- 页面里不要写免费声明、广告位、License、贡献/奖励/隐私等声明文案（系统统一处理）\n- 【原创与版权铁律】严禁出现 ©、&copy;、Copyright、All rights reserved、版权/著作权字样与年份版权行——版权只在仓库根 LICENSE，页面一律不写；源码里已有的必须整体删除；年份一律用当前年份（2026）或相对时间，禁止 2023/2024/2025 等旧年份；不得使用真实公司/品牌/产品名，不得模仿或复刻任何现有产品\n- 【真实工具铁律】若原产品是“演示站”（功能靠固定文案/预置假数据装样子、含 simulation/模拟 类说明，或有只 console.log 不干活的空壳函数），必须重构为真实可用的工具：假功能删除或改为真实实现（真实计算/存储/处理）；**占位按钮（点了只弹「开发中/敬请期待/coming soon/即将上线/暂未开放」）同样必须做成真功能或直接删除，禁止保留「以后再说」的按钮**\n- 从 <!DOCTYPE html> 开始输出，禁止 markdown 代码围栏、禁止任何解释文字\n【优化报告】\n" + (ana || "") + "\n【产品完整源码】\n" + src;
    let v2 = callLLM([
        {role: "system", content: "你是资深前端工程师。只输出代码。"},
        {role: "user", content: v2Prompt}
    ], 12000, true, 0.7); // air 模型重写
    v2 = cleanHtml(v2);
    if (v2 && !looksComplete(v2)) v2 = completeHtml(v2); // 截断续写守卫
    v2 = stripLegacyCleanup(v2); // 模型可能照抄残留死代码，质检前再摘一遍（零 token）
    if (v2) v2 = injectStandardBlock(v2); // 标准区块注入（幂等）
    // 3) 自检：先本地硬检查（零 token、100% 准确），再 AI 查交互逻辑（最多重写 2 轮）
    let passed = false;
    for (let round = 1; round <= 2 && v2; round++) {
        if (dailyTokenCost > DAILY_BUDGET) break;
        let failReason = localHardCheck(v2, src) || (!looksComplete(v2) ? "输出被截断（缺 </html> 结尾）" : "");
        if (!failReason) {
            let q = aiQualityCheck(v2);
            if (!q.ok) failReason = "AI 质检不通过：" + q.reason;
        }
        if (!failReason) {
            passed = true;
            break;
        }
        log("⚠️ v2 自检不通过（第" + round + "轮）：" + failReason + (round < 2 ? "，重写…" : "，已达重写上限"));
        if (round >= 2) break; // 最后一轮失败不再白烧一次重写 token
        v2 = cleanHtml(callLLM([
            {role: "system", content: "你是资深前端工程师。只输出代码。"},
            {role: "user", content: v2Prompt + "\n\n【上一版自检未通过的原因】" + failReason + "\n请重新完整输出修复后的 HTML。"}
        ], 12000, true, 0.7));
        if (v2 && !looksComplete(v2)) v2 = completeHtml(v2);
        v2 = stripLegacyCleanup(v2);
        if (v2) v2 = injectStandardBlock(v2);
    }
    if (!passed) {
        log("⛔ v2 两轮自检均不通过，放弃优化，保持原版（宁可不改，不越改越乱）");
        return {name: latest, local: null, report: (ana || "") + "\n\n⛔ 本轮改进版未通过质检，已保持原版。", hasV2: false};
    }
    // 迭代链修复：v2 通过质检后提升为新基线（最初版存一次 _v1 快照；每轮覆盖前把上一版存为 _prev 就近回退点）
    let v1snap = latest.replace(".html", "_v1.html");
    let prevSnap = latest.replace(".html", "_prev.html");
    ensureSnapDir(); // 快照统一进 _版本快照 子文件夹：此前每个产品在产出根目录留 _v1/_prev 两份，被当“重复产品”清理过一批
    if (!files.exists(SNAP_DIR + "/" + v1snap)) {
        try { files.copy(dir + "/" + latest, SNAP_DIR + "/" + v1snap); } catch (e) { log("v1 快照失败：" + e); }
    }
    try { files.write(SNAP_DIR + "/" + prevSnap, html); } catch (e) { log("_prev 快照失败：" + e); }
    try {
        v2 = injectMeta(injectAnalytics(injectI18n(v2)), latest); // v2 重写可能丢统计码/meta/多语言块，写回前补上
        files.write(dir + "/" + latest, v2); // v2 写回基线位置，下一轮从最新版继续迭代（v3、v4…累积）
        log("🔧 产品 v2 已通过质检并提升为新基线：" + latest + "（就近回退点 " + prevSnap + "，最初存档 " + v1snap + "）");
    } catch (e) { log("v2 写回基线失败：" + e); }
    return {name: latest, local: dir + "/" + latest, report: (ana || "") + "\n\n✅ 改进版已上线为新基线（就近回退点 " + prevSnap + "，最初存档 " + v1snap + "），下一轮优化将从本版继续迭代。", hasV2: true};
}

function deployToGithub(localFile, remotePath) {
    if (!GITHUB_USER || !GITHUB_TOKEN) {
        log("ℹ️ 未配置 GitHub，跳过自动上线（产品已存本地产出文件夹）");
        return null;
    }
    // 2026-10-03 加固：网络抖动（如 DNS 闪断）不再一次定生死——整个“查 sha + PUT”最多重试 3 次（间隔 4 秒）。
    // 背景：08:54/09:30 两次域名解析抖动导致上传直接失败、产品滞留本地（双开期间 07:54-08:04 的产物同理）。
    let lastErr = "";
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            let content = files.read(localFile);
            let bytes = new java.lang.String(content).getBytes("UTF-8");
            let b64 = android.util.Base64.encodeToString(bytes, 2); // NO_WRAP
            let url = "https://api.github.com/repos/" + GITHUB_USER + "/" + GITHUB_REPO + "/contents/" + remotePath;
            // 查旧 sha（更新文件需要；抖动时查不到 → PUT 已存在文件会 409，交给重试重查）
            let sha = null;
            try {
                let r = http.get(url, {headers: ghHeaders(), timeout: 30000});
                if (r.statusCode === 200) sha = r.body.json().sha;
            } catch (e) {}
            let body = {message: "auto deploy " + remotePath, content: b64};
            if (sha) body.sha = sha;
            let resp = http.request(url, {
                method: "PUT",
                headers: ghHeaders(),
                body: JSON.stringify(body),
                timeout: 60000
            });
            if (resp.statusCode === 200 || resp.statusCode === 201) {
                let link = "https://" + GITHUB_USER + ".github.io/" + GITHUB_REPO + "/" + remotePath;
                log("🌐 已自动上线：" + link);
                return link;
            }
            if (resp.statusCode === 409 || resp.statusCode === 422) {
                // sha 缺失或过期（常因查 sha 时网络抖动）：值得重试
                lastErr = "HTTP " + resp.statusCode + "（sha 缺失/过期）";
                log("⚠️ 部署 " + remotePath + " 第 " + attempt + "/3 次遇 " + lastErr + "，重试…");
            } else {
                log("⚠️ 部署失败 HTTP " + resp.statusCode + "：" + resp.body.string().slice(0, 200));
                return null; // 语义性错误：不重试（保持原有可见性）
            }
        } catch (e) {
            lastErr = String(e);
            log("⚠️ 部署请求异常（第 " + attempt + "/3 次）：" + e);
        }
        if (attempt < 3) sleep(4000);
    }
    log("❌ 部署异常（3 次均失败，产品滞留本地，待下轮或人工补传）：" + remotePath + " → " + lastErr);
    return null;
}

// ========== 零 token 部署层：不调 AI 的部署/同步操作集合（预算用尽时也照跑）==========
// LICENSE 同步 + 存量页脚迁移 + 奖励档位评估 + 产品台账/总览页 + about 页，全部零 token，
// 铺开类迁移与规则同步不因每日 token 预算停摆（预算用尽的那天也照样完成）。
function zeroTokenDeployLayer(links) {
    links = links || [];
    if (GITHUB_USER && GITHUB_TOKEN) deployLicense();
    migrateLegacyFooters();
    migrateSnapshots(); // 版本快照遗留迁移：产出根目录的 _prev/_v1 挪进 _版本快照/（零 token 幂等）
    let tierTune = autoTuneTiers();
    if (tierTune && tierTune.note) pushToWx("🎁 奖励档位", tierTune.note);
    log("📊 产品台账同步…");
    let ledger = buildLedger(links);
    if (GITHUB_USER && GITHUB_TOKEN) {
        log("📄 关于页同步…");
        syncAbout();
        return syncDashboard(ledger);
    }
    return null;
}

// ========== 存量页脚迁移：旧堆砌页脚批量换极简新页脚（幂等）==========
// 识别旧结构靠 free-footer（旧页脚专有 class），新页脚是 page-footer，不会误伤；
// 只迁移基线产品页（index.html 由 syncDashboard 重建、about.html 由 syncAbout 重建，不在此列）。
function migrateLegacyFooters() {
    let dir = "/storage/emulated/0/脚本/产出";
    let names = [];
    try {
        names = files.listDir(dir, function(n) { return n.endsWith(".html") && n !== "index.html" && !/_(?:v\d+|prev)\.html$/.test(n); });
    } catch (e) { return 0; }
    let migrated = 0;
    for (let i = 0; i < names.length; i++) {
        let f = dir + "/" + names[i];
        let html = "";
        try { html = files.read(f); } catch (e) { continue; }
        if (!html || html.indexOf('<div class="free-footer">') < 0) continue; // 只认旧页脚完整标签；AI 内容区 JS 里的 .free-footer 引用不算
        let v2 = injectMeta(injectAnalytics(injectStandardBlock(html)), names[i]);
        try {
            files.write(f, v2);
            migrated++;
            log("🔁 页脚已迁移：" + names[i]);
            if (GITHUB_USER && GITHUB_TOKEN) deployToGithub(f, names[i]);
        } catch (e) { log("⚠️ 页脚迁移失败：" + names[i] + " " + e); }
    }
    if (migrated) pushToWx("🔁 页脚迁移", "已为 " + migrated + " 个存量产品页换上极简新页脚并重新上线。");
    return migrated;
}

// LICENSE 文件部署到仓库根目录（线上内容相同则跳过，避免每天产生无意义 commit）
function deployLicense() {
    if (!GITHUB_USER || !GITHUB_TOKEN) return null;
    let lic = "MIT License\n\nCopyright (c) 2026 " + LIC_NAME + "\n\n"
        + "Permission is hereby granted, free of charge, to any person obtaining a copy\n"
        + "of this software and associated documentation files (the \"Software\"), to deal\n"
        + "in the Software without restriction, including without limitation the rights\n"
        + "to use, copy, modify, merge, publish, distribute, sublicense, and/or sell\n"
        + "copies of the Software, and to permit persons to whom the Software is\n"
        + "furnished to do so, subject to the following conditions:\n\n"
        + "The above copyright notice and this permission notice shall be included in all\n"
        + "copies or substantial portions of the Software.\n\n"
        + "THE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\n"
        + "IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,\n"
        + "FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE\n"
        + "AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER\n"
        + "LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,\n"
        + "OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE\n"
        + "SOFTWARE.";
    let path = PRODUCT_DIR + "/LICENSE";
    try { files.write(path, lic); } catch (e) { log("LICENSE 本地写入失败：" + e); }
    // 线上已有且内容相同 → 跳过（对比 base64 解码后的内容）
    let apiUrl = "https://api.github.com/repos/" + GITHUB_USER + "/" + GITHUB_REPO + "/contents/LICENSE";
    try {
        let r = http.get(apiUrl, {headers: ghHeaders(), timeout: 30000});
        if (r.statusCode === 200) {
            // 改用与模型政策同步同款、已在设备上验证过的 b64decode；此前静默 catch 把比对失败原因全吞了，导致线上内容明明一致也连续多日重复上传
            // Rhino 下 b64decode 返回 Java String：其 .length 是方法不是属性、=== 与 JS 字符串恒不等，必须 String() 包装（实测 .length 打印出 function length()）
            let remote = String(b64decode(r.body.json().content || ""));
            if (remote === lic) { log("📄 LICENSE 线上无变化，跳过上传"); return null; }
            log("📄 LICENSE 线上与本机生成不一致（线上 " + remote.length + " 字节 / 本地 " + lic.length + " 字节），重新上传同步");
        } else {
            log("📄 LICENSE 线上查询失败 HTTP " + r.statusCode + "，直接重新上传");
        }
    } catch (e) {
        log("📄 LICENSE 线上比对失败：" + e + "，直接重新上传");
    }
    return deployToGithub(path, "LICENSE");
}

// ========== 意见闭环：用户意见 → AI 评分 → 采纳自动改进/生成新品 → 榜单更新 → issue 回复关闭（全自动）==========
// 意见入口：产品页脚的「提意见」按钮与 about 页的提意见链接 → 直接开 GitHub issue（label=意见，标题带【意见】）
// 处理时机：随每日 9:00 那一轮自动执行；手动在 AutoJs 里重跑本脚本 = 立即处理一轮
// 落库位置：/storage/emulated/0/脚本/意见/（意见清单、评分记录、采纳记录、贡献榜单）
// 采纳规则：有用性/可行性/产品价值 各 0-10（总分代码自算），verdict=采纳 且 总分≥21 才执行；
//           执行 = 指向已有产品则改进该产品（复用质检/快照/上线管线），新点子则走 buildProduct 生成新品
// 贡献分：采纳一条 21-24 分 +10 / 25-27 +15 / 28-30 +20，按 GitHub 用户名累计，自动进产品页榜单
const FEEDBACK_DIR = "/storage/emulated/0/脚本/意见";
const FEEDBACK_LIST_PATH = FEEDBACK_DIR + "/意见清单.json";   // 原始意见 + 状态机（待评分/已采纳/已拒绝）
const FEEDBACK_SCORE_PATH = FEEDBACK_DIR + "/评分记录.json";  // 三维评分流水（对外可查）
const FEEDBACK_ADOPT_PATH = FEEDBACK_DIR + "/采纳记录.json";  // 已采纳记录
const CONTRIB_PATH = FEEDBACK_DIR + "/贡献榜单.json";         // 意见贡献分（合并进所有产品页榜单）
const FEEDBACK_LABEL = "意见";
// 每轮处理条数不设上限（巡检意见全自动闭环），唯一硬顶是 DAILY_BUDGET token 闸门
const FEEDBACK_ADOPT_MIN = 21;    // 三维总分 ≥21（满分 30）才采纳

function feedbackReadJson(path) {
    try { return JSON.parse(files.read(path)); } catch (e) { return null; }
}
function feedbackWriteJson(path, obj) {
    // AutoJs files.ensureDir 对 /storage 下新目录的创建不可靠（实测静默失败），改走 Java mkdirs；
    // 首次写失败重试一次（新目录在 FUSE 视图里可能短暂不可见）
    for (let i = 0; i < 2; i++) {
        try {
            new java.io.File(FEEDBACK_DIR).mkdirs();
            files.write(path, JSON.stringify(obj, null, 2));
            return true;
        } catch (e) {
            if (i === 0) { sleep(300); continue; }
            log("意见数据写入失败：" + e);
        }
    }
    return false;
}

// 0) 自举：确保仓库有「意见」label（无则建；已存在返回 422，忽略）
function ensureFeedbackLabel() {
    if (!GITHUB_USER || !GITHUB_TOKEN) return;
    try {
        let r = http.get("https://api.github.com/repos/" + GITHUB_USER + "/" + GITHUB_REPO + "/labels/" + encodeURIComponent(FEEDBACK_LABEL), {headers: ghHeaders(), timeout: 30000});
        if (r.statusCode === 200) return;
        http.request("https://api.github.com/repos/" + GITHUB_USER + "/" + GITHUB_REPO + "/labels", {
            method: "POST",
            headers: ghHeaders(),
            body: JSON.stringify({name: FEEDBACK_LABEL, color: "0e8a16", description: "用户意见反馈（自动处理）"}),
            timeout: 30000
        });
        log("🏷️ 已自动创建 label：" + FEEDBACK_LABEL);
    } catch (e) { log("⚠️ label 检查失败：" + e); }
}

// 1) 拉取未处理意见：open issues 里 label=意见 或 标题带【意见】的（pull request 排除）
function fetchFeedbackIssues() {
    if (!GITHUB_USER || !GITHUB_TOKEN) return [];
    let issues = [];
    for (let page = 1; page <= 3; page++) { // 最多 3 页 × 100 条：巡检全自动提意见后 open issue 可能远超一页
        let url = "https://api.github.com/repos/" + GITHUB_USER + "/" + GITHUB_REPO + "/issues?state=open&per_page=100&page=" + page;
        try {
            let r = http.get(url, {headers: ghHeaders(), timeout: 30000});
            if (r.statusCode !== 200) { log("⚠️ 拉取意见失败 HTTP " + r.statusCode + "（第 " + page + " 页）"); break; }
            let arr = r.body.json() || [];
            if (!arr.length) break;
            arr.forEach(function(it) {
                if (it.pull_request) return;
                let hasLabel = false;
                (it.labels || []).forEach(function(lb) { if (lb && lb.name === FEEDBACK_LABEL) hasLabel = true; });
                if (!hasLabel && (it.title || "").indexOf("【意见】") < 0) return;
                issues.push({no: it.number || 0, title: it.title || "", body: (it.body || "").slice(0, 2000), user: (it.user && it.user.login) || "", created: it.created_at || ""});
            });
            if (arr.length < 100) break;
        } catch (e) { log("⚠️ 拉取意见异常（第 " + page + " 页）：" + e); break; }
    }
    return issues;
}

// 1b) 意见清单状态机：入册过的跳过（防重复评分）；只有实际评分完成的才入册（预算中断的留下轮）
function filterFreshFeedback(fetched) {
    let db = feedbackReadJson(FEEDBACK_LIST_PATH);
    let list = (db && Array.isArray(db.list)) ? db.list : [];
    let known = {};
    list.forEach(function(it) { if (it.no) known[it.no] = 1; });
    let fresh = [];
    fetched.forEach(function(it) { if (!known[it.no]) fresh.push(it); });
    return fresh;
}
function markFeedbackState(no, state, summary, item) {
    let db = feedbackReadJson(FEEDBACK_LIST_PATH);
    let list = (db && Array.isArray(db.list)) ? db.list : [];
    let found = null;
    list.forEach(function(it) { if (it.no === no) found = it; });
    if (!found) {
        found = {no: (item && item.no) || no, title: (item && item.title) || "", body: (item && item.body) || "", user: (item && item.user) || "", created: (item && item.created) || "", state: state};
        list.push(found);
    }
    found.state = state;
    found.summary = summary || "";
    if (list.length > 200) list = list.slice(-200);
    feedbackWriteJson(FEEDBACK_LIST_PATH, {updated: new Date().toLocaleString(), list: list});
}

// 2) AI 评分：有用性/可行性/产品价值 各 0-10；总分代码自算（不信 AI 自报）；verdict AI 建议、阈值把关
function scoreFeedbackBatch(items) {
    let results = [];
    for (let i = 0; i < items.length; i++) {
        if (dailyTokenCost > DAILY_BUDGET) { log("⏭️ token 预算用尽，剩余意见留下轮"); break; }
        let it = items[i];
        // 已有产品清单喂给 AI：让意见对应到真实产品，或判定为新灵感/通用建议
        let names = [];
        try { names = files.listDir(PRODUCT_DIR, function(n) { return n.endsWith(".html") && n !== "index.html" && !/_(?:v\d+|prev)\.html$/.test(n); }); } catch (e) {}
        let prompt = "你是产品评审官。下面是一条用户意见。请打分并只输出一行 JSON（禁止任何解释）：\n"
            + '{"useful":0到10整数,"feasible":0到10整数,"value":0到10整数,"verdict":"采纳"或"不采纳","product":"改进目标","reason":"一句话理由"}\n'
            + "评分口径：useful=有用性（是否解决真实痛点）；feasible=可行性（单文件前端产品是否好实现）；value=产品价值（对免费+广告变现产品的提升）。\n"
            + "评分锚点：可行性 8-10 = 单文件前端 30 分钟内能实现的常规功能（加按钮/换主题/本地存储等）；5-7 = 需要较大改造；0-4 = 纯前端基本做不了。有用性和产品价值同理：8-10 = 明显改善，5-7 = 锦上添花，0-4 = 意义不大。\n"
            + "product 填法：意见指向已有产品 → 从下面清单选一个文件名（去掉 .html）；全新点子 → 填「新品」；放之四海皆准的通用建议 → 填「通用」。\n"
            + "已有产品清单：\n" + (names.length ? names.join("\n") : "（暂无）") + "\n"
            + "意见标题：" + it.title + "\n意见内容：" + it.body;
        let raw = callLLM([
            {role: "system", content: "你是严格的产品评审官。只输出一行 JSON。"},
            {role: "user", content: prompt}
        ], 300);
        if (!raw) { log("⏭️ 意见 #" + it.no + " AI 不可用（预算/Key），留下轮"); continue; }
        let sc = null;
        try { let m = raw.match(/\{[\s\S]*\}/); if (m) sc = JSON.parse(m[0]); } catch (e) {}
        if (!sc) {
            // flash 偶尔输出非 JSON：换 air 重试一次；仍失败则记「待人工」并如实回复，禁止按低分误杀
            log("⚠️ 意见 #" + it.no + " 评分解析失败，换 air 重试…原始输出：" + String(raw).slice(0, 200));
            let raw2 = callLLM([
                {role: "system", content: "你是严格的产品评审官。只输出一行 JSON。"},
                {role: "user", content: prompt + "\n\n【强制】只输出一行合法 JSON，禁止输出任何其他文字。"}
            ], 300, true, 0.2);
            if (raw2) {
                try { let m2 = raw2.match(/\{[\s\S]*\}/); if (m2) sc = JSON.parse(m2[0]); } catch (e) {}
            }
            if (!sc) {
                markFeedbackState(it.no, "待人工", "评分失败", {no: it.no, title: it.title, body: it.body, user: it.user});
                closeFeedbackIssue(it.no, "🙏 感谢你的反馈！本轮自动评分失败（AI 输出异常），本条已记录，会人工跟进。");
                continue;
            }
        }
        let u = Math.max(0, Math.min(10, parseInt(sc.useful, 10) || 0));
        let f = Math.max(0, Math.min(10, parseInt(sc.feasible, 10) || 0));
        let v = Math.max(0, Math.min(10, parseInt(sc.value, 10) || 0));
        sc.useful = u; sc.feasible = f; sc.value = v; sc.total = u + f + v;
        results.push({no: it.no, title: it.title, body: it.body, user: it.user, score: sc});
        sleep(800);
    }
    let db = feedbackReadJson(FEEDBACK_SCORE_PATH);
    let list = (db && Array.isArray(db.list)) ? db.list : [];
    list = list.concat(results.map(function(r) {
        return {no: r.no, title: r.title, user: r.user, score: r.score, scoredAt: new Date().toLocaleString()};
    }));
    if (list.length > 500) list = list.slice(-500);
    feedbackWriteJson(FEEDBACK_SCORE_PATH, {updated: new Date().toLocaleString(), list: list});
    return results;
}

// 3) 意见 → 产品文件解析：精确匹配清单文件名优先，否则相似度 ≥0.3 取最像的；匹配不上返回 null
function resolveProductFile(hint) {
    if (!hint) return null;
    let names = [];
    try { names = files.listDir(PRODUCT_DIR, function(n) { return n.endsWith(".html") && n !== "index.html" && !/_(?:v\d+|prev)\.html$/.test(n); }); } catch (e) { return null; }
    if (!names.length) return null;
    let h = hint.replace(/\.html$/i, "");
    for (let i = 0; i < names.length; i++) {
        let n = names[i].replace(/\.html$/i, "");
        if (n === h || h.indexOf(n) >= 0 || n.indexOf(h) >= 0) return names[i];
    }
    let best = null, bestSim = 0;
    names.forEach(function(n) {
        let s = nameSimilarity(h, n.replace(/\.html$/i, ""));
        if (s > bestSim) { bestSim = s; best = n; }
    });
    return bestSim >= 0.3 ? best : null;
}
function latestProductFile() {
    let names = [];
    try { names = files.listDir(PRODUCT_DIR, function(n) { return n.endsWith(".html") && n !== "index.html" && !/_(?:v\d+|prev)\.html$/.test(n); }); } catch (e) {}
    names.sort();
    return names.length ? names[names.length - 1] : null;
}

// 4a) 采纳执行：把意见应用到已有产品（重写 → 硬检查/AI 质检 → 快照回退点 → 写回 → 上线）
function applyFeedbackToProduct(fname, feedbackText) {
    let html = "";
    try { html = files.read(PRODUCT_DIR + "/" + fname); } catch (e) { return {ok: false, product: fname, reason: "读取产品失败：" + e}; }
    if (!html || html.length < 200) return {ok: false, product: fname, reason: "产品内容为空"};
    let src = html.length > QC_SRC_CAP ? html.slice(0, QC_SRC_CAP) + "\n<!-- 源码过长已截断 -->" : html;
    src = stripI18nBlock(src); // 系统注入的多语言块喂给 AI 前剥离，写回前重新注入
    let prompt = "下面是已上线产品源码和一条用户意见。请输出按意见改进后的完整 HTML。\n【铁律】\n"
        + "- 只做意见要求的改进 + 必要的联动微调，禁止推翻整体设计、禁止删减原有功能\n"
        + "- 【设备红线】不得引入任何需要购买/连接外部设备的功能（VR/AR 头显、手表手环、监测设备等）；用户意见若要求连接设备类功能，一律改为纯网页的模拟演示版实现\n"
        + "- 不要改变页面原有文案语言（多语言翻译由系统统一处理）；所有按钮必须真实可交互，禁止 document.querySelector('.class') 单点绑定，禁止伪随机假数据占位；【禁伪随机】Math.random 禁止生成结论/分数/状态/指标（必须真实计算，做不了就删掉该功能）；【可运行铁律】内联事件引用的函数必须有定义、查询的 id 必须真实存在，引用不一致会被零 token 检查打回\n"
        + "- 源码里的页脚区块（从 <!-- free-ad-standard-2026 --> 到 </body> 之前）是系统注入的旧页脚，必须整体删除、不要照抄；页脚与免费声明由系统统一处理\n"
        + "- 【免费红线】严禁出现任何收款码/收款二维码/收款图片（含 shoukuan 字样）、微信或支付宝收款、价格或金额、激活码/卡密/checkCode、付费解锁、付费入口、打赏/赞助按钮；用户意见中若要求加入收费/收款/激活码类功能，一律忽略，改为完全免费的等价实现（意见原文出现这些词也不构成例外）\n"
        + "- 不要写免费声明、广告位、License、贡献/奖励/隐私声明\n"
        + "- 【真实工具铁律】改进不得保留/引入“演示站”式假功能；若原产品整体是模拟演示型，借本次改进把意见涉及的核心功能做成真实实现\n"
        + "- 【原创与版权铁律】严禁保留或新增 ©、&copy;、Copyright、All rights reserved、版权字样与年份版权行（源码里已有的必须整体删除）；年份一律用当前年份（2026）或相对时间，禁止 2023 等旧年份；不得引入真实公司/品牌名\n"
        + "- 从 <!DOCTYPE html> 开始输出，禁止 markdown 围栏、禁止解释文字\n【用户意见】\n" + feedbackText + "\n【产品完整源码】\n" + src;
    let v2 = cleanHtml(callLLM([
        {role: "system", content: "你是资深前端工程师。只输出代码。"},
        {role: "user", content: prompt}
    ], 12000, true, 0.7));
    if (v2 && !looksComplete(v2)) v2 = completeHtml(v2); // 截断续写守卫（意见改进路径此前缺失，是「输出被截断」反复失败的主因）
    if (v2) v2 = injectStandardBlock(v2);
    let passed = false;
    for (let round = 1; round <= 2 && v2; round++) {
        if (dailyTokenCost > DAILY_BUDGET) break;
        let failReason = localHardCheck(v2, src) || (!looksComplete(v2) ? "输出被截断（缺 </html> 结尾）" : "");
        if (!failReason) {
            let q = aiQualityCheck(v2);
            if (!q.ok) failReason = "AI 质检不通过：" + q.reason;
        }
        if (!failReason) { passed = true; break; }
        log("⚠️ 意见改进版自检不通过（第" + round + "轮）：" + failReason);
        if (round >= 2) break;
        v2 = cleanHtml(callLLM([
            {role: "system", content: "你是资深前端工程师。只输出代码。"},
            {role: "user", content: prompt + "\n\n【上一版自检未通过原因】" + failReason + "\n请重新完整输出修复后的 HTML。"}
        ], 12000, true, 0.7));
        if (v2 && !looksComplete(v2)) v2 = completeHtml(v2); // 截断续写守卫
        if (v2) v2 = injectStandardBlock(v2);
    }
    if (!passed) return {ok: false, product: fname, reason: "改进版未通过质检，保持原版（宁可不改，不越改越乱）"};
    let prevSnap = fname.replace(".html", "_prev.html");
    ensureSnapDir();
    try { files.write(SNAP_DIR + "/" + prevSnap, html); } catch (e) {}
    try {
        v2 = injectMeta(injectAnalytics(injectI18n(v2)), fname);
        files.write(PRODUCT_DIR + "/" + fname, v2);
        log("✅ 意见已应用到产品：" + fname + "（就近回退点 " + prevSnap + "）");
    } catch (e) { return {ok: false, product: fname, reason: "写回失败：" + e}; }
    let link = null;
    if (GITHUB_USER && GITHUB_TOKEN) link = deployToGithub(PRODUCT_DIR + "/" + fname, fname);
    return {ok: true, product: fname, link: link, reason: "已按意见改进并上线"};
}

// 4b) 采纳执行：意见是新点子 → 走既有 buildProduct 管线生成全新产品并上线
function applyFeedbackAsNewProduct(sc) {
    let direction = (sc.title || "") + "\n" + (sc.body || "");
    let out = buildProduct(direction);
    if (!out.html) return {ok: false, product: "", reason: "新品生成失败（预算或 AI 异常）"};
    let pname = extractProductName((sc.title || "").replace(/^【意见】\s*/, "") + "\n" + (sc.body || ""));
    let htmlName = dateStr() + "_" + pname + ".html";
    try {
        files.ensureDir(PRODUCT_DIR);
        out.html = injectMeta(injectAnalytics(injectStandardBlock(out.html)), htmlName);
        files.write(PRODUCT_DIR + "/" + htmlName, out.html);
        log("✅ 意见已转成新灵感产品：" + htmlName);
    } catch (e) { return {ok: false, product: htmlName, reason: "新品存档失败：" + e}; }
    let link = null;
    if (GITHUB_USER && GITHUB_TOKEN) {
        ensureRepo();
        link = deployToGithub(PRODUCT_DIR + "/" + htmlName, htmlName);
    }
    return {ok: true, product: htmlName, link: link, reason: "意见已生成新灵感产品并上线"};
}

// 5) 落库：采纳记录 + 贡献榜单（按实际贡献分：21-24 +10 / 25-27 +15 / 28-30 +20）
function feedbackPoints(total) {
    if (total >= 28) return 20;
    if (total >= 25) return 15;
    return 10;
}
function recordAdoption(sc, applied) {
    let rec = {
        time: new Date().toLocaleString(), issueNo: sc.no, title: sc.title, user: sc.user,
        scores: {useful: sc.score.useful, feasible: sc.score.feasible, value: sc.score.value, total: sc.score.total},
        product: applied.product || "（通用建议）",
        changes: applied.ok ? "已自动改进上线" : ("未自动改进：" + (applied.reason || "")),
        points: feedbackPoints(sc.score.total)
    };
    let db = feedbackReadJson(FEEDBACK_ADOPT_PATH);
    let list = (db && Array.isArray(db.list)) ? db.list : [];
    list.unshift(rec);
    if (list.length > 300) list = list.slice(0, 300);
    feedbackWriteJson(FEEDBACK_ADOPT_PATH, {updated: new Date().toLocaleString(), list: list});
    let cb = feedbackReadJson(CONTRIB_PATH);
    let clist = (cb && Array.isArray(cb.list)) ? cb.list : [];
    let found = null;
    clist.forEach(function(c) { if (c.name === rec.user) found = c; });
    if (!found) { found = {name: rec.user, role: "意见贡献者", score: 0, note: ""}; clist.push(found); }
    found.score = (found.score || 0) + rec.points;
    // 「最近采纳」取编号最大的（=最新创建）采纳意见：采纳批按编号降序处理，若取“最后处理的”会长期停留在批次里最旧的一条（实测踩坑：采纳了 #73-#87，表里却一直挂 #71）
    if (!found.noteNo || (rec.issueNo || 0) > found.noteNo) {
        found.note = "最近采纳：" + rec.title.slice(0, 40);
        found.noteNo = rec.issueNo || 0;
    }
    feedbackWriteJson(CONTRIB_PATH, {updated: new Date().toLocaleString(), list: clist});
    log("🏆 贡献分 +" + rec.points + " → " + rec.user + "（累计 " + found.score + "）");
    return rec;
}

// 6) 收尾：issue 回复结果并关闭（提出者收到通知，闭环对用户可见）
function closeFeedbackIssue(no, msg) {
    if (!GITHUB_USER || !GITHUB_TOKEN || !no) return;
    try {
        let base = "https://api.github.com/repos/" + GITHUB_USER + "/" + GITHUB_REPO + "/issues/" + no;
        http.request(base + "/comments", {method: "POST", headers: ghHeaders(), body: JSON.stringify({body: msg}), timeout: 30000});
        http.request(base, {method: "PATCH", headers: ghHeaders(), body: JSON.stringify({state: "closed"}), timeout: 30000});
        log("✅ 意见 #" + no + " 已回复并关闭");
    } catch (e) { log("⚠️ 意见 #" + no + " 回复/关闭失败：" + e); }
}

// 7) 总控：每轮跑一遍（随每日自动运行；手动重跑本脚本 = 立即处理一轮）
function processFeedback() {
    if (!GITHUB_USER || !GITHUB_TOKEN) { log("ℹ️ 未配置 GitHub，跳过意见闭环"); return null; }
    ensureFeedbackLabel();
    let fetched = fetchFeedbackIssues();
    if (!fetched.length) { log("📭 暂无新意见"); return null; }
    let fresh = filterFreshFeedback(fetched);
    if (!fresh.length) { log("📭 已拉取的意见均已处理过"); return null; }
    let batch = fresh; // 不设条数上限：巡检意见全自动闭环，唯一硬顶是 DAILY_BUDGET 闸门
    log("📬 本轮处理 " + batch.length + " 条意见");
    let scored = scoreFeedbackBatch(batch);
    let report = {new: scored.length, adopted: [], rejected: []};
    scored.forEach(function(sc) {
        // 判定：「采纳」字样（兼容 AI 输出“建议采纳/采纳。”等变体）+ 总分过线
        let adopt = ((sc.score.verdict || "").indexOf("采纳") >= 0) && sc.score.total >= FEEDBACK_ADOPT_MIN;
        log("📊 意见 #" + sc.no + " 评分：有用性 " + sc.score.useful + " / 可行性 " + sc.score.feasible + " / 产品价值 " + sc.score.value + "（总分 " + sc.score.total + "）→ " + (adopt ? "采纳" : "不采纳"));
        let applied = {ok: false, reason: ""};
        if (adopt) {
            let target = (sc.score.product || "").trim();
            let isNew = (!target || target === "新品" || target === "新功能" || target === "新点子" || target === "新想法");
            if (isNew) {
                applied = applyFeedbackAsNewProduct(sc);
            } else if (target === "通用") {
                let fname = latestProductFile();
                if (fname) applied = applyFeedbackToProduct(fname, "（通用建议）" + sc.title + "\n" + sc.body);
                else applied = applyFeedbackAsNewProduct(sc);
            } else {
                let fname = resolveProductFile(target);
                if (fname) applied = applyFeedbackToProduct(fname, sc.title + "\n" + sc.body);
                else { log("ℹ️ 意见指向的产品「" + target + "」不存在，转按新灵感生成"); applied = applyFeedbackAsNewProduct(sc); }
            }
            let rec = recordAdoption(sc, applied);
            markFeedbackState(sc.no, "已采纳", "总分 " + sc.score.total, {no: sc.no, title: sc.title, body: sc.body, user: sc.user});
            closeFeedbackIssue(sc.no, "✅ 你的意见已被采纳并自动改进上线：\n" + (applied.ok ? ("改进/产出：" + (applied.product || "") + (applied.link ? "\n🌐 " + applied.link : "")) : applied.reason) + "\n\n按实际贡献评分，贡献分已计入贡献者榜单。感谢支持！");
            report.adopted.push(rec);
        } else {
            let note = "有用性 " + sc.score.useful + " / 可行性 " + sc.score.feasible + " / 产品价值 " + sc.score.value + "（总分 " + sc.score.total + " / 30）" + (sc.score.reason ? ("。评审理由：" + sc.score.reason) : "");
            markFeedbackState(sc.no, "已拒绝", "总分 " + sc.score.total, {no: sc.no, title: sc.title, body: sc.body, user: sc.user});
            closeFeedbackIssue(sc.no, "🙏 感谢你的意见！本轮评分：" + note + "，暂未采纳。\n\n我们会持续收集反馈，欢迎继续提建议。");
            report.rejected.push(sc);
        }
    });
    return report;
}

// ========== 执行层：把今日主推方向自动做成真实产物 ==========
// 近亲变体硬拦截：本地比对产品名与已有产物的相似度（最长公共子串 / 较短名字长度）
function lcsLen(a, b) {
    let m = a.length, n = b.length;
    let prev = [], cur = [];
    for (let j = 0; j <= n; j++) { prev.push(0); cur.push(0); }
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            cur[j] = (a[i - 1] === b[j - 1]) ? prev[j - 1] + 1 : Math.max(prev[j], cur[j - 1]);
        }
        let t = prev; prev = cur; cur = t;
    }
    return prev[n];
}
function nameSimilarity(a, b) {
    let L = Math.min(a.length, b.length);
    if (!L) return 0;
    return lcsLen(a, b) / L;
}
// 文件名归一成产品名：剥时间戳前缀、.html 后缀与 _vN/_prev 版本尾缀（旧文件无前缀也兼容）
function normalizeFileName(n) {
    let s = String(n).replace(/\.html$/i, "").replace(/_(?:v\d+|prev)$/, "");
    s = s.replace(/^\d{4}-\d{2}-\d{2}_\d{6}_/, "");
    return s.trim();
}
function findNearDup(pname) {
    let names = [];
    try {
        names = files.listDir("/storage/emulated/0/脚本/产出", function(n) {
            return n.endsWith(".html") && n !== "index.html" && !/_(?:v\d+|prev)\.html$/.test(n);
        });
    } catch (e) {}
    let p = String(pname).trim();
    for (let i = 0; i < names.length; i++) {
        let n = normalizeFileName(names[i]);
        if (!n) continue;
        if (n === p) return names[i]; // 同名直接拦（prompt 已要求禁止同名）
        // 短名（≤3 字）只用精确匹配：LCS 相似度对短名误杀率太高（如"记事本/记账本"）
        if (p.length <= 3 || n.length <= 3) continue;
        if (nameSimilarity(p, n) >= 0.7) return names[i];
    }
    return null;
}
// 子主题扎堆检测（2026-10-03）：产品名前缀归一化后相同（前 6 字符）的今日产品 ≥3 个 → 视为扎堆，
// 拦截第 4 个起的同主题变体。背景：当日大类=硬件周边时 AI 一天连出 5 个 VR 系产品（换名不换主题）。
function themeCrowdToday(name) {
    try {
        let norm = function(s) {
            return String(s || "").replace(/\.html$/i, "").split("_").pop().toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]/g, "");
        };
        let key = norm(name).slice(0, 6);
        if (key.length < 3) return null;
        let dp = String(dateStr()).slice(0, 10); // 今天日期前缀（dateStr 含时间，取前 10 位）
        let list = [];
        try { list = files.listDir("/storage/emulated/0/脚本/产出", function(n) { return n.endsWith(".html") && n.indexOf(dp) === 0; }); } catch (e) { return null; }
        let hit = 0;
        for (let i = 0; i < list.length; i++) {
            if (norm(list[i]).slice(0, 6) === key) hit++;
        }
        if (hit >= 3) return {key: key, count: hit};
        return null;
    } catch (e) { return null; }
}
// 从决策文本提取产品名用于文件名
function extractProductName(decision) {
    try {
        let clean = decision.replace(/\*/g, "");
        let m = clean.match(/今日主推方向\s*[：:]\s*([^\n，。]+)/);
        if (!m) m = clean.match(/(?:【v?\d+】|^)\s*([A-Za-z\u4e00-\u9fa5][A-Za-z0-9\u4e00-\u9fa5]{1,14})/m);
        if (m && m[1]) {
            let name = m[1].trim().replace(/[\/\\:*?"<>|]/g, "").replace(/^\d+[、.．]\s*/, "");
            if (name.length > 12) name = name.slice(0, 12);
            if (name) return name;
        }
    } catch (e) {}
    return "产品";
}

function buildProduct(decision) {
    let out = {html: null, article: null};
    // 预算保护
    if (dailyTokenCost > DAILY_BUDGET) return out;
    // 1a) 功能设计蓝图（flash 便宜档，先想清楚再动手）
    let designPrompt = "根据下面的产品方向，输出产品功能设计蓝图（200字内）：\n- 功能清单 3-5 个，全部标注【免费】（完全免费；任何功能都不涉及收款码/激活码/付费解锁/付费入口）\n- 【真实工具铁律】清单里每一项都必须是纯前端能真实实现的工具功能，写清「用户输入什么 → 得到什么真实产出」；禁止把演示/模拟类功能列进清单\n- 【设备红线】所有功能只用普通手机/电脑浏览器即可完整使用，禁止任何需要购买或连接外部设备的功能（VR/AR 头显、手表手环、脑电/心率/血压等监测设备、无人机、智能家居等）；需要真实硬件才有意义的监测功能一律不做\n- 每个功能一句话交互说明\n- 页面结构顺序（从上到下）\n不要写代码。\n产品方向：\n" + decision.slice(0, 1500);
    let design = callLLM([
        {role: "system", content: "你是产品经理。只输出设计蓝图。"},
        {role: "user", content: designPrompt}
    ], 600);
    // 1b) 按蓝图生成 HTML（air 模型，低发散度）
    let htmlPrompt = "根据下面的产品方向和功能设计蓝图，生成一个单文件 HTML 产品（独立打开即可运行的网页）。要求：\n- 从 <!DOCTYPE html> 开始输出完整代码，禁止 markdown 代码围栏、禁止任何解释文字\n- 移动端优先、深色现代 UI\n- 页面所有可见文案一律英文（系统会自动翻译成多语言）\n- 每个按钮都必须有真实可用的交互逻辑；事件绑定禁止 document.querySelector('.class') 单点绑定（只会绑定第一个元素），必须每个按钮独立 id 或 querySelectorAll 遍历绑定；【可运行铁律】内联事件（onclick 等）引用的函数必须在脚本里真实定义，getElementById/querySelector 引用的 id 必须真实存在（或由脚本创建后赋值）——系统会用零 token 静态检查，引用不一致直接不合格\n- 禁止伪随机假数据占位（例如随机分数+固定提示文案的假评分），数据必须有真实逻辑来源或明确标注为模拟演示；【禁伪随机】Math.random 禁止用于生成任何结论/分数/状态/指标（随机分数、随机风险等级、随机通过率、随机测速、随机检测结果等），这类必须用真实计算，做不了就删掉该功能；随机只允许用在无关紧要的视觉花样上\n- 深色 UI 下按钮与背景对比要足够明显（禁止深灰按钮放在深灰区块上）\n- 严格按蓝图实现全部功能，交互逻辑必须真实可用（禁止 alert 占位）\n- 【真实工具铁律】产品必须是一个用户真能使用的工具：核心功能全部真实实现（真实计算/处理/编辑/存储），用户输入 → 看到真实产出（可复制/保存/使用）；严禁“演示站/模拟器”：禁止模拟用途声明、禁止假搜索结果/假列表/预置假帖子假数据装样子、禁止按钮只输出固定说明文字；**【严禁占位按钮】任何按钮点了只弹「开发中/敬请期待/coming soon/即将上线/暂未开放」这类提示，等于没有功能——要么做成真功能，要么删掉该按钮（禁止留一个「以后再说」的按钮充数）**；禁用 `this.textContent + 功能开发中` 这类通用兜底处理器（它会让整站按钮集体变成安慰剂）；纯前端做不了真的功能宁可不做，换成能做真的\n- 零外部依赖（不引用任何外部 CSS/JS/字体）；【设备红线】产品必须开箱即用——只用浏览器本身即可完整使用（可用摄像头/麦克风/本地存储等标准能力），禁止出现要求用户连接/购买/配对任何外部设备的引导、状态检测或功能入口；需要真实硬件才有意义的监测/传感功能一律不做，换成能真实实现的功能\n- 页面专注产品本身：开头讲清「产品是干嘛的」「怎么用」，其余就是功能本身\n- 不要写免费声明、广告位、License、贡献/奖励/隐私等任何声明文案（由系统统一处理）\n- 【原创与版权铁律】严禁出现 ©、&copy;、Copyright、All rights reserved、版权/著作权字样与年份版权行——版权只在仓库根 LICENSE，页面一律不写；年份一律用当前年份（2026）或相对时间，禁止 2023/2024/2025 等旧年份；不得使用真实公司/品牌/产品名，不得模仿或复刻任何现有产品\n- 硬性禁止：任何价格（¥）、收款码/收款二维码/收款图片（shoukuan）、微信或支付宝收款、激活码/卡密、付费解锁、付费/解锁/打赏相关字样，出现即不合格\n【功能设计蓝图】\n" + (design || "") + "\n【产品方向】\n" + decision.slice(0, 1500);
    let html = cleanHtml(callLLM([
        {role: "system", content: "你是资深前端工程师。只输出代码，不输出任何解释。"},
        {role: "user", content: htmlPrompt}
    ], 12000, true, 0.7));
    if (html && !looksComplete(html)) html = completeHtml(html); // 截断续写守卫
    if (html) html = injectStandardBlock(html); // 页脚先注入再质检（免费声明由系统保证，AI 只需不写付费内容）
    // 生成后立即质检一次，不达标重生成一次
    if (html && dailyTokenCost <= DAILY_BUDGET) {
        if (!checkHtmlQuality(html)) {
            log("⚠️ 新产品质检不通过，重新生成一次…");
            html = cleanHtml(callLLM([
                {role: "system", content: "你是资深前端工程师。只输出代码。"},
                {role: "user", content: htmlPrompt}
            ], 12000, true, 0.7));
            if (html && !looksComplete(html)) html = completeHtml(html); // 截断续写守卫（重试路径也要续写补全，别急着放弃）
            if (html) html = injectStandardBlock(html);
        }
        // 最终门禁：重生成后不再重试，但残缺的坏页面绝不允许存档上线
        if (html && !looksComplete(html)) {
            log("⛔ 新品 HTML 不完整（输出被截断），放弃本轮产品生成，避免坏页面存档");
            html = null;
        }
    }
    out.html = html;
    if (dailyTokenCost > DAILY_BUDGET) return out;
    // 2) 发布文案
    let artPrompt = "根据下面的产品方向，写一篇小红书风格种草文案：\n- 第一行是标题（带 2-3 个相关话题标签）\n- 正文 300-500 字，口语化、有真实感，突出它解决什么痛点、适合谁用\n- 【硬性红线】这个产品是纯网页工具：①严禁把它描述成实体商品/硬件（禁处理器/芯片/显示屏/套装/实体/开箱/配件/链接设备 等硬件词，禁编造“佩戴/把玩/连接”等物理场景）②它完全免费，严禁催促购买/下单（禁 入手/购买/下单/抢购/价格/评论区链接 等，写“直接打开网页就能用”即可）③禁止提及任何其它产品/品牌/竞品名④禁止编造产品方向里不存在的功能或数据\n- 输出纯文本，禁止 markdown 符号\n产品方向：\n" + decision.slice(0, 1500);
    let article = callLLM([
        {role: "system", content: "你是小红书爆款文案写手。只输出文案正文。"},
        {role: "user", content: artPrompt}
    ], 1500);
    if (article) out.article = article.trim();
    // 3) 多语言系统注入（翻译失败则保持原文单语言，不影响主流程）
    if (out.html && dailyTokenCost <= DAILY_BUDGET) {
        log("🌐 注入多语言系统…");
        out.html = injectI18n(out.html);
    }
    return out;
}

function runOnce() {
    try { refreshPolicy(); } catch (e) { log("⚠️ 模型政策同步异常：" + e); } // 每轮先同步最新条款/价格 → 决定本轮模型档位
    log("📡 开始抓取 8 路信源…");
    let titles = [];
    titles = titles.concat(getHN());
    titles = titles.concat(getRss("36氪", "https://36kr.com/feed"));
    titles = titles.concat(getRss("少数派", "https://sspai.com/feed"));
    titles = titles.concat(getRss("IT之家", "https://www.ithome.com/rss/"));
    titles = titles.concat(getV2ex());
    titles = titles.concat(getGithub());
    titles = titles.concat(getWeibo());
    titles = titles.concat(getZhihu());
    // 去重
    let seen = {}, uniq = [];
    titles.forEach(t => {
        if (t && !seen[t]) { seen[t] = 1; uniq.push(t); }
    });
    uniq = uniq.slice(0, 120);
    log("✅ 抓到 " + uniq.length + " 条头条");
    if (uniq.length < 10) {
        log("⚠️ 信源太少，放弃本轮");
        pushToWx("⚠️ 灵感雷达抓取异常", "本轮只抓到 " + uniq.length + " 条头条，请检查网络后重跑脚本。");
        return;
    }
    // 预算检查（防失控）
    if (dailyTokenCost > DAILY_BUDGET) {
        // 零 token 部署层照跑：LICENSE/页脚迁移/档位评估/台账/about 页不烧 token，不因预算停摆
        zeroTokenDeployLayer([]);
        pushToWx("⛔ 灵感雷达预算用尽", "今日 token 消耗已超预算上限（" + DAILY_BUDGET + "），自动停跑，明天恢复。");
        return;
    }
    log("🧠 正在让 AI 提炼（约30秒）…");
    // 历史报告纳入上下文（每天独一无二推演的基础）
    let hist = readHist();
    if (hist.length > 16000) hist = hist.slice(0, 16000); // 喂入量放大：让 AI 看到更多旧方向，杜绝近亲变体
    let todayCat = todayCategory();
    log("🎡 今日指定方向大类：" + todayCat);
    // 已有产物清单喂给 AI：真实存在的产品，禁止同名/近亲变体（硬证据比 prompt 约束更可靠）
    let existing = [];
    try {
        existing = files.listDir("/storage/emulated/0/脚本/产出", function(n) { return n.endsWith(".html"); });
    } catch (e) {}
    let report = callLLM([
        {role: "system", content: SYSTEM_PROMPT},
        {role: "user", content: "【今日必选方向大类】" + todayCat + "（今天的所有方向必须属于此大类）\n【已产出产品清单】（真实存在的产品，禁止同名或近亲变体）\n" + (existing.length ? "- " + existing.join("\n- ") : "（暂无）") + "\n【子主题防扎堆硬规则】顺着上面清单自查：同一子主题（例如 VR、VPN、Pi、Health、宠物、日历等）今天最多 3 个；已达 3 个的子主题今天一律禁止再出（名字里带该主题词也不行），必须换本大类内的其它子领域，优先挑清单里还没出现过的\n【历史报告】（过去提过的方向，禁止重复，只能做深化版）\n" + (hist || "（暂无历史）") + "\n\n【今日头条】\n- " + uniq.join("\n- ")}
    ], 5000); // 提炼输出量大（5 个点子的深度推演 + 决策），3000 曾导致【决策】段被截断
    if (!report) {
        log("提炼失败：所有 Key/模型均不可用");
        pushToWx("⚠️ 灵感雷达 AI 提炼失败", "所有 Key 和模型档位都调用失败，请检查 Key 是否有效/额度是否用尽。");
        return;
    }
    saveHist(report);
    // 自动决策段单独存档（今日任务工作台，AI 每天自己推进自己；追加式记录，一天多跑不丢早上的决策）
    let decision = report.split("【决策】")[1] || "";
    try {
        if (decision) {
            let oldTask = "";
            try { oldTask = files.read("/storage/emulated/0/脚本/今日任务.txt"); } catch (e) {}
            let merged = "=== " + new Date().toLocaleString() + " ===\n" + decision + "\n\n" + oldTask;
            if (merged.length > 100000) merged = merged.slice(0, 100000);
            files.write("/storage/emulated/0/脚本/今日任务.txt", merged);
            log("📋 今日任务已存档（AI 自主决策结果，追加模式）");
        }
    } catch (e) { log("今日任务存档失败: " + e); }
    // 决策单独推一条：报告长时【决策】可能被 5 段上限截掉，这是自主推演的核心输出，必须送达
    if (decision) pushToWx("🎯 今日决策", decision);
    // ===== 执行层：先取名并做近亲变体拦截；被拦自动换选报告中的下一方向（最多 2 次），全拦才放弃 =====
    // 同一天重跑会复用同一方向大类（轮盘同日复用），AI 极易再次提出与当天已产出产品的近亲变体（实测一天连拦两次）；
    // 换选只花一次 flash 小调用（几百 token），远低于报告提炼的 10K+，让重跑不再空手而归
    let ds = dateStr();
    let pname = extractProductName(decision); // 文件名带产品名，一眼看清
    log("📛 今日产品名：" + pname);
    let origName = pname;
    let execDecision = decision; // 真正拿去生成产物的方向（换选成功后替换为换选结果）
    let nearDup = (pname !== "产品" && decision) ? findNearDup(pname) : null;
    let themeHit = (pname !== "产品" && decision) ? themeCrowdToday(pname) : null; // 子主题扎堆（2026-10-03：硬件周边日连出 5 个 VR 系）
    const SWAP_MAX = 2;
    let swapCount = 0;
    while ((nearDup || themeHit) && swapCount < SWAP_MAX) {
        swapCount++;
        let why = nearDup ? ("「" + pname + "」与已有「" + nearDup + "」相似度过高") : ("「" + pname + "」的子主题（" + themeHit.key + "）今天已产出 " + themeHit.count + " 个，扎堆");
        log("⛔ " + (nearDup ? "近亲变体拦截" : "子主题扎堆拦截") + "：" + why + "，换选第 " + swapCount + " 次…");
        if (swapCount === 1) pushToWx("⚠️ 方向拦截", "今日主推方向「" + origName + "」被拦（" + (nearDup ? "与已有产品近亲重复" : "子主题今天已扎堆") + "），已自动换选报告中的下一方向（最多 " + SWAP_MAX + " 次）。");
        let swap = callLLM([
            {role: "system", content: "你是自主推演引擎。只按格式输出，禁止解释。"},
            {role: "user", content: "你的报告决策段如下：\n" + (decision || "").slice(0, 2000) + "\n\n主推方向被硬规则拦截：" + why + "。请从决策段里 5 个打分方向中另选一个与已有产品明显不同、且今日子主题不扎堆的方向做主推。严格按此格式输出（第一行名字 2-15 位英文字母/中文，不含空格标点；第二行一句话理由）：\n今日主推方向：新名字\n理由：一句话"}
        ], 200);
        if (!swap) { log("⚠️ 换选失败（预算/Key 不可用），放弃换选"); break; }
        let newName = extractProductName(swap);
        if (newName === "产品") { log("⚠️ 换选输出无法提取名字，放弃换选：" + String(swap).slice(0, 80)); break; }
        let newDup = findNearDup(newName);
        let newTheme = themeCrowdToday(newName);
        if (!newDup && !newTheme) {
            execDecision = swap;
            pname = newName;
            nearDup = null;
            themeHit = null;
            log("🔀 已换选新主推方向：" + pname);
            pushToWx("🔀 主推方向已换选", "原方向「" + origName + "」被拦（近亲重复/子主题扎堆），已换选为「" + pname + "」，继续生成。");
        } else {
            pname = newName;
            nearDup = newDup;
            themeHit = newTheme;
        }
    }
    let outputs = {html: null, article: null};
    if (decision && !nearDup && !themeHit) {
        log("🔨 执行层启动：把主推方向做成实际产物…");
        outputs = buildProduct(execDecision);
    } else if (nearDup || themeHit) {
        log("⛔ 换选 " + swapCount + " 次仍未找到不重复、不扎堆的方向，放弃本轮产品生成（防重复烧 token）");
        pushToWx("⚠️ 方向拦截", "换选 " + swapCount + " 次仍未找到不重复且不扎堆的方向，已放弃本轮生成。确认真要做深化版，把方向明确标成【v2】原名再人工处理。");
    } else if (!decision) {
        log("⚠️ 报告缺少【决策】段，跳过执行层");
    }
    let htmlName = ds + "_" + pname + ".html";
    let artName = ds + "_" + pname + "_文案.txt";
    try {
        files.ensureDir("/storage/emulated/0/脚本/产出");
        if (outputs.html) {
            outputs.html = injectMeta(injectAnalytics(injectStandardBlock(outputs.html)), htmlName); // 统计 + 免费/广告标准区块 + SEO meta（存档+上线同一份）
            files.write("/storage/emulated/0/脚本/产出/" + htmlName, outputs.html);
            log("✅ 产品原型已生成：" + htmlName);
        }
        if (outputs.article) {
            files.write("/storage/emulated/0/脚本/产出/" + artName, outputs.article);
            log("✅ 发布文案已生成：" + artName);
        }
    } catch (e) { log("产出存档失败: " + e); }
    // （收款码资源检查已删除：产品完全免费，不再引用任何收款资源）
    // ===== 部署层：自动上线 =====
    let links = [];
    if (outputs.html && GITHUB_USER && GITHUB_TOKEN) {
        log("🚀 部署层启动：自动上传 GitHub Pages…");
        ensureRepo();
        let link = deployToGithub("/storage/emulated/0/脚本/产出/" + htmlName, htmlName);
        if (link) links.push({name: htmlName, url: link});
    }
    // ===== 产品优化环：自动审查最新产品并上线 v2 =====
    let opt = null;
    if (dailyTokenCost <= DAILY_BUDGET) {
        log("🔧 产品优化环启动：审查最新产品并生成 v2…");
        opt = optimizeProduct();
        if (opt && opt.hasV2 && GITHUB_USER && GITHUB_TOKEN) {
            let v2link = deployToGithub(opt.local, opt.name);
            if (v2link) links.push({name: opt.name, url: v2link});
        }
    }
    // （LICENSE 同步与存量页脚迁移已并入零 token 部署层 zeroTokenDeployLayer）
    // ===== 意见闭环：拉取用户意见 → AI 评分 → 采纳自动改进/生成新品 → 榜单更新 → issue 回复关闭 =====
    // 全自动、脚本自理；任何异常只记录不影响主流程（抓取与上线照常）
    let fbReport = null;
    try {
        log("📬 意见闭环启动…");
        fbReport = processFeedback();
    } catch (e) { log("⚠️ 意见闭环异常：" + e + "（不影响主流程）"); }
    // 采纳后立即刷新并上线 about 页：让「贡献榜单/最近采纳」即时可见，不用等下一轮（此前榜单文件更新了但页面要等整轮跑完才重建）
    if (fbReport && fbReport.adopted && fbReport.adopted.length) {
        try { log("🔄 采纳完成，刷新 about 页…"); syncAbout(); } catch (e) { log("⚠️ about 页刷新失败：" + e); }
    }
    // ===== 产品台账：汇总所有产品数据，总览页自动同步上线 =====
    let ledger = buildLedger(links);
    // ===== 零 token 部署层：LICENSE 同步 + 存量页脚迁移 + 档位评估 + 台账/总览页 + about 页 =====
    let dashboardUrl = zeroTokenDeployLayer(links);
    log("📤 推送到企业微信…");
    pushToWx("📡 灵感雷达日报", report);
    if (outputs.html || outputs.article) {
        let msg = "📦 今日产出（执行层）：\n";
        if (outputs.html) msg += "产品【" + pname + "】：脚本/产出/" + htmlName + "\n（手机浏览器打开即可体验，完全免费 · 合规广告变现）\n";
        if (outputs.article) msg += "发布文案：脚本/产出/" + artName + "\n（可直接复制发小红书）\n";
        if (links.length) msg += "\n🌐 已自动上线：\n" + links.map(function(l) { return l.url; }).join("\n") + "\n（首次发布约 1-2 分钟后可访问）";
        pushToWx("📦 产出", msg);
    }
    if (opt && opt.report) {
        pushToWx("🔧 产品优化报告", opt.report + (opt.hasV2 ? "\n\n✅ 改进版 v2 已自动上线（见上一条链接）" : "\n\n⚠️ v2 生成失败，仅输出建议"));
    }
    pushToWx("📊 产品台账", "共 " + ledger.count + " 个产品，数据已同步。总览：" + (dashboardUrl ? "https://" + GITHUB_USER + ".github.io/" + GITHUB_REPO + "/" : "本地 脚本/产出/产品台账.json"));
    if (fbReport && fbReport.new) {
        let fbMsg = "本轮处理 " + fbReport.new + " 条意见：";
        if (fbReport.adopted.length) fbMsg += "\n✅ 采纳 " + fbReport.adopted.length + " 条 → " + fbReport.adopted.map(function(r) { return "「" + r.title.slice(0, 20) + "」"; }).join("、");
        if (fbReport.rejected.length) fbMsg += "\n➖ 未采纳 " + fbReport.rejected.length + " 条（低分项，已回复关闭）";
        fbMsg += "\n🏆 贡献榜单已更新，见 about 页";
        pushToWx("📬 意见处理报告", fbMsg);
    }
    log("✅ 完成");
}

// 企业微信 text 单条上限约 680 汉字，按 550 字分段推送
function pushToWx(title, content) {
    if (!WX_HOOK) {
        log("⚠️ 未配置企微 webhook，跳过推送（请检查雷达密钥.json）");
        return;
    }
    let chunks = [];
    let rest = content;
    while (rest.length > 550) {
        chunks.push(rest.slice(0, 550));
        rest = rest.slice(550);
    }
    if (rest) chunks.push(rest);
    let truncated = chunks.length > 10;
    chunks = chunks.slice(0, 10); // 最多 10 段（企微机器人限频 20 条/分钟，10 段 + 2s 间隔安全）
    for (let i = 0; i < chunks.length; i++) {
        let text = (i === 0 ? title + "\n\n" : "") + chunks[i];
        if (i < chunks.length - 1) text += "\n…";
        else if (truncated) text += "\n\n（内容过长已截断，完整历史报告见 脚本/雷达历史.txt）";
        try {
            let r = http.postJson(WX_HOOK, {msgtype: "text", text: {content: text}}, {timeout: 15000});
            let j = r.body.json();
            if (j && j.errcode !== 0) {
                log("❌ 推送第 " + (i + 1) + " 段失败: errcode " + j.errcode + " " + (j.errmsg || ""));
            } else {
                log("✅ 已推送第 " + (i + 1) + "/" + chunks.length + " 段");
            }
        } catch (e) {
            log("❌ 推送第 " + (i + 1) + " 段失败: " + e);
        }
        sleep(2000);
    }
}

// ========== 产品台账：所有产品数据汇总（本地台账 + 总览页自动同步上线）==========
const LEDGER_PATH = "/storage/emulated/0/脚本/产出/产品台账.json";
const PRODUCT_DIR = "/storage/emulated/0/脚本/产出";
const SNAP_DIR = PRODUCT_DIR + "/_版本快照"; // 版本快照统一存放（_v1 最初存档 / _prev 就近回退点），保持产出根目录只有产品本体
// 快照目录懒创建：/storage 下新建目录 files.ensureDir 会静默失败（实测），必须用 java.io.File.mkdirs()
function ensureSnapDir() {
    try {
        let f = new java.io.File(SNAP_DIR);
        if (!f.exists()) f.mkdirs();
    } catch (e) {}
}
// 遗留迁移：旧版快照散在产出根目录，每次运行幂等挪进子文件夹（copy+remove，不依赖 files.move）
function migrateSnapshots() {
    try {
        let names = files.listDir(PRODUCT_DIR, function(n) { return /_(?:v\d+|prev)\.html$/.test(n); });
        if (!names || !names.length) return;
        ensureSnapDir();
        for (let i = 0; i < names.length; i++) {
            try {
                files.copy(PRODUCT_DIR + "/" + names[i], SNAP_DIR + "/" + names[i]);
                files.remove(PRODUCT_DIR + "/" + names[i]);
            } catch (e) { log("快照迁移失败 " + names[i] + "：" + e); }
        }
        log("📦 已迁移 " + names.length + " 个版本快照 → _版本快照/");
    } catch (e) {}
}

// 扫描产出文件夹，收集所有基线产品（排除 _vN/_prev 回退文件和总览页自身）
function collectProducts() {
    let names = [];
    try {
        names = files.listDir(PRODUCT_DIR, function(n) {
            return n.endsWith(".html") && n !== "index.html" && !/_(?:v\d+|prev)\.html$/.test(n);
        });
    } catch (e) {}
    names.sort();
    let list = [];
    names.forEach(function(n) {
        let size = 0;
        try { size = new java.io.File(PRODUCT_DIR + "/" + n).length(); } catch (e) {}
        let hasArticle = files.exists(PRODUCT_DIR + "/" + n.replace(".html", "_文案.txt"))
                      || files.exists(PRODUCT_DIR + "/" + n.replace(".html", "文案.txt"));
        let hasV1 = files.exists(PRODUCT_DIR + "/" + n.replace(".html", "_v1.html"));
        let time = "";
        let m = n.match(/^(\d{4}-\d{2}-\d{2})_(\d{6})/);
        if (m) time = m[1] + " " + m[2].slice(0, 2) + ":" + m[2].slice(2, 4);
        list.push({name: n, time: time, size: size, hasArticle: hasArticle, hasV1: hasV1, url: ""});
    });
    return list;
}

// 汇总台账：保留历史上线链接，并入本轮新上线链接
function buildLedger(newLinks) {
    let oldMap = {};
    try {
        let old = JSON.parse(files.read(LEDGER_PATH));
        (old.list || []).forEach(function(p) { if (p.name && p.url) oldMap[p.name] = p.url; });
    } catch (e) {}
    let list = collectProducts();
    list.forEach(function(p) { p.url = oldMap[p.name] || ""; });
    (newLinks || []).forEach(function(item) {
        for (let i = 0; i < list.length; i++) {
            if (list[i].name === item.name) { list[i].url = item.url; break; }
        }
    });
    // 【线上核对】历史缺陷修正：url 只记录“本轮上传过”的链接，漏传/旧记录会让在线产品被误标「仅本地」（实测 AI Health Me / HealthAI Coa 在线却显示仅本地）。
    // 用仓库实际文件清单双向校准：在线→补链接，不在线→标仅本地（被手动删除也能自愈）。一次 API 调用，失败则沿用旧逻辑不影响主流程
    try {
        if (GITHUB_USER && GITHUB_TOKEN && GITHUB_REPO) {
            let r = http.get("https://api.github.com/repos/" + GITHUB_USER + "/" + GITHUB_REPO + "/contents/", {headers: ghHeaders(), timeout: 30000});
            if (r && r.statusCode === 200) {
                let items = r.body.json() || [];
                let online = {};
                for (let i = 0; i < items.length; i++) { if (items[i] && items[i].name) online[items[i].name] = 1; }
                for (let i = 0; i < list.length; i++) {
                    list[i].url = online[list[i].name] ? ("https://" + GITHUB_USER + ".github.io/" + GITHUB_REPO + "/" + list[i].name) : "";
                }
            }
        }
    } catch (e) {}
    let ledger = {updated: new Date().toLocaleString(), count: list.length, list: list};
    try { files.write(LEDGER_PATH, JSON.stringify(ledger)); } catch (e) { log("台账写入失败：" + e); }
    return ledger;
}

// 总览页：静态单文件，深色风格与产品一致，列全量数据
function renderDashboard(ledger) {
    let rows = (ledger.list || []).map(function(p) {
        let st = p.url
            ? '<a href="' + p.url + '">🌐 已上线</a>'
            : '<span style="color:#8b93a3;">💾 仅本地</span>';
        let extra = (p.hasArticle ? "📝文案 " : "") + (p.hasV1 ? "🔁已迭代" : "");
        let kb = (p.size / 1024).toFixed(1) + "KB";
        return "<tr><td>" + p.name + "</td><td>" + (p.time || "-") + "</td><td>" + kb
             + "</td><td>" + (extra || "-") + "</td><td>" + st + "</td></tr>";
    }).join("");
    return '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8">'
        + '<meta name="viewport" content="width=device-width, initial-scale=1.0">'
        + '<title>产品总览 · AI 工坊</title><style>'
        + 'body{background:#0f1115;color:#e6e9ef;font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;padding:20px;max-width:960px;margin:0 auto;}'
        + 'h1{font-size:22px;}.sub{color:#8b93a3;font-size:12px;margin:6px 0 18px;}'
        + 'table{width:100%;border-collapse:collapse;font-size:13px;}'
        + 'th,td{padding:10px 8px;border-bottom:1px solid #262b36;text-align:left;word-break:break-all;}'
        + 'th{color:#ffb020;font-size:12px;white-space:nowrap;}'
        + 'a{color:#00a884;text-decoration:none;}'
        + '</style></head><body><h1>📊 产品总览</h1>'
        + '<div class="sub">共 ' + ledger.count + ' 个产品 · 更新于 ' + ledger.updated + ' · 每日自动同步</div>'
        + '<table><tr><th>产品</th><th>生成时间</th><th>大小</th><th>配套</th><th>状态</th></tr>'
        + rows + '</table>'
        + buildPageFooter() + '</body></html>';
}

// 总览页写本地并上传 GitHub Pages 根目录（index.html 即站点首页）
function syncDashboard(ledger) {
    if (!GITHUB_USER || !GITHUB_TOKEN) return null;
    let html = injectAnalytics(injectStandardBlock(renderDashboard(ledger))); // 总览页也埋统计 + 页脚（幂等）
    try { files.write(PRODUCT_DIR + "/index.html", html); } catch (e) { log("总览页本地写入失败：" + e); }
    return deployToGithub(PRODUCT_DIR + "/index.html", "index.html");
}

// /about 页：贡献规则+榜单、奖励规则（含税务）、隐私说明、无层级返利声明，写本地并上线
function syncAbout() {
    if (!GITHUB_USER || !GITHUB_TOKEN) return null;
    let html = injectMeta(injectAnalytics(buildAboutPage()), "about.html");
    try { files.write(PRODUCT_DIR + "/about.html", html); } catch (e) { log("about 页本地写入失败：" + e); }
    return deployToGithub(PRODUCT_DIR + "/about.html", "about.html");
}

// ========== 奖励档位自动调整引擎：收入手填(密钥 ad_income_month) × 规模全自动 → 每月 1 日调档 ==========
// 奖品 = 智能手机（新机、正规渠道、主流品牌），三档对应不同价格带；
//   价格带随月广告收入自动分级（收入越高配越好，机型不写死，兑换时按当时市场价在带内选当季款）；
//   档位分数随贡献规模自动调整（比值法）；收入不足最低档手机成本 → 纯荣誉模式（荣誉榜+署名）。
// 公式决策（可解释，不靠 AI 拍脑袋）：
//   预算 = 月广告收入 × 30%；预估兑换成本 = 各档达线人数 × 档位手机价格带上限；
//   比值 >1.2 预算富余 → 档位分数下调 15%（更多人可达，花掉预算）；<0.8 预算紧张 → 上调 15%；
//   降档/清空只在每月 1 日做（不悄悄变），恢复/初始化随时可做；历史档位存档可查。
const TIER_PATH = "/storage/emulated/0/脚本/奖励档位.json";
const TIER_BUDGET_RATIO = 0.3;          // 月奖励预算 = 月广告收入 × 30%
// 手机奖品价格带分级：月收入达到 rev 起，低/中/高档对应价格带上限（元，新机主流品牌日常价）
const PHONE_BANDS = [
    {rev: 0,     low: 300,  mid: 1000, high: 2500},
    {rev: 500,   low: 500,  mid: 1500, high: 3500},
    {rev: 2000,  low: 800,  mid: 2500, high: 5000},
    {rev: 10000, low: 1000, mid: 3000, high: 7000}
];
function phoneBands(revenue) {
    let b = PHONE_BANDS[0];
    for (let i = 0; i < PHONE_BANDS.length; i++) {
        if (revenue >= PHONE_BANDS[i].rev) b = PHONE_BANDS[i];
    }
    return b;
}
function tierCosts(revenue) {
    let b = phoneBands(revenue);
    return [b.low, b.mid, b.high];
}
function tierDefault(revenue) {
    let c = tierCosts(revenue);
    return [
        {min: 50,  desc: "智能手机一台（" + c[0] + " 元以内主流品牌当季机型，具体型号按兑换时市场价格在该价位带内选择）"},
        {min: 100, desc: "智能手机一台（" + c[1] + " 元以内主流品牌当季机型，具体型号按兑换时市场价格在该价位带内选择）"},
        {min: 150, desc: "智能手机一台（" + c[2] + " 元以内旗舰/次旗舰当季机型，限量发放，依法办理个人所得税相关手续）"}
    ];
}
function tierRead() {
    try { return JSON.parse(files.read(TIER_PATH)); } catch (e) { return null; }
}
function tierWrite(cfg) {
    for (let i = 0; i < 2; i++) {
        try {
            new java.io.File("/storage/emulated/0/脚本").mkdirs();
            files.write(TIER_PATH, JSON.stringify(cfg, null, 2));
            return true;
        } catch (e) { if (i === 0) { sleep(300); continue; } log("档位写入失败：" + e); }
    }
    return false;
}
// 近 30 天采纳条数（规模信号之一，来自意见闭环采纳记录）
function countAdopts30() {
    let n = 0;
    try {
        let j = JSON.parse(files.read(FEEDBACK_ADOPT_PATH));
        let cutoff = Date.now() - 30 * 24 * 3600 * 1000;
        (j.list || []).forEach(function(a) {
            let t = new Date(String(a.time || "").replace(/\//g, "-"));
            if (t && !isNaN(t) && t.getTime() > cutoff) n++;
        });
    } catch (e) {}
    return n;
}
function tierHistoryHtml(cfg) {
    if (!cfg || !cfg.history || cfg.history.length < 2) return "";
    let rows = cfg.history.slice().reverse().map(function(h) {
        let act = h.action === "init" ? "初始" : (h.action === "clear" ? "清空" : (h.action === "restore" ? "恢复" : (h.action === "tune" ? "调整" : "保持")));
        let tierTxt = (h.tiers || []).map(function(t) { return t.min; }).join("/");
        return "<tr><td>" + (h.at || "") + "</td><td>" + act + "</td><td>" + (tierTxt || "纯荣誉") + "</td><td>" + (h.note || "") + "</td></tr>";
    }).join("");
    return '<details><summary data-i18n-id="ab-history">📜 档位调整历史</summary><table><tr><th data-i18n-id="ab-hd-date">日期</th><th data-i18n-id="ab-hd-action">动作</th><th data-i18n-id="ab-hd-tier">档位</th><th data-i18n-id="ab-hd-basis">依据</th></tr>' + rows + '</table></details>';
}
// 奖励规则段（about 页动态渲染：当前档位 + 生效日期 + 调整历史）
function tierHtml() {
    let cfg = tierRead();
    let tiers = (cfg && Array.isArray(cfg.tiers)) ? cfg.tiers : [];
    let intro = '<p data-i18n-id="ab-tier-intro">意见被采纳后按评审总分计贡献分（21-24 分 <b>+10</b>，25-27 分 <b>+15</b>，28-30 分 <b>+20</b>）。</p>';
    if (tiers.length) {
        let lis = tiers.map(function(t) {
            return '<li><b>' + t.min + ' 分</b>：' + t.desc + '</li>';
        }).join("");
        return intro + '<ul>' + lis + '</ul>'
            + '<p>兑换方式：达到档位分数后，提交 issue 注明<b>【兑奖】</b>，经核对评分记录后私下确认收货信息并寄出，兑换记录公开登记可查。</p>'
            + '<p>激励以<b>荣誉榜、署名</b>优先；本档位自 ' + (cfg.effective || "") + ' 起生效，每月 1 日按广告收入与贡献规模自动评估调整，评分记录可对外查。</p>'
            + tierHistoryHtml(cfg);
    }
    return intro
        + '<p data-i18n-id="ab-honor">当前为<b>纯荣誉模式</b>：奖励以荣誉榜、署名为准，暂无实物奖励档位；广告月收入达到可支撑实物奖励的水平后自动恢复（每月 1 日评估，收入恢复后下次运行即可生效）。</p>'
        + tierHistoryHtml(cfg);
}
// 档位评估总控：初始化 / 恢复（随时）/ 每月 1 日完整评估（可降档）。返回 {changed, note}，note 非空推企微
function autoTuneTiers() {
    let d = new Date();
    let todayKey = d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
    let revenue = Number(SEC.ad_income_month) || 0;
    let budget = revenue * TIER_BUDGET_RATIO;
    let contrib = loadContributors();
    let nContrib = contrib.length;
    let avgScore = 0;
    if (nContrib) { contrib.forEach(function(c) { avgScore += (c.score || 0); }); avgScore = Math.round(avgScore / nContrib); }
    let adopts30 = countAdopts30();
    let cfg = tierRead();
    if (!cfg) {
        // 首次初始化：有预算直接给默认档位，否则纯荣誉模式起步
        let costs = tierCosts(revenue);
        let tiers = budget >= costs[0] ? tierDefault(revenue) : [];
        cfg = {updated: todayKey, effective: todayKey, tiers: tiers, history: []};
        let note = budget >= costs[0]
            ? "奖励档位已初始化：50/100/150 分起兑，奖品为智能手机（月广告收入 " + revenue + " 元 → 三档价格带 " + costs.join("/") + " 元以内），之后每月 1 日按收入与规模自动评估调整"
            : "奖励档位已初始化：暂无广告收入数据（密钥 ad_income_month 未填或为 0），暂为纯荣誉模式（荣誉榜+署名）；填写月收入后下次运行自动恢复实物档位";
        cfg.history.push({at: todayKey, action: "init", tiers: cfg.tiers, revenue: revenue, contributors: nContrib, adopts30: adopts30, avgScore: avgScore, note: note});
        tierWrite(cfg);
        log("🎁 " + note);
        return {changed: true, note: note};
    }
    if (String(cfg.updated || "") === todayKey) return {changed: false, note: ""}; // 同一天重复运行不再评估
    let tiers = (cfg.tiers || []).slice();
    let isFirst = (d.getDate() === 1);
    if (!isFirst) {
        // 非每月 1 日：只允许「纯荣誉 → 恢复档位」（对用户无害）；降档/清空一律只在 1 日做
        if (tiers.length || budget < tierCosts(revenue)[0]) return {changed: false, note: ""};
        tiers = tierDefault(revenue);
        cfg.tiers = tiers; cfg.updated = todayKey; cfg.effective = todayKey;
        let note = "广告月收入 " + revenue + " 元已达到实物奖励门槛，恢复档位 50/100/150 分起兑（手机奖品，三档价格带 " + tierCosts(revenue).join("/") + " 元以内）";
        cfg.history.push({at: todayKey, action: "restore", tiers: tiers, revenue: revenue, contributors: nContrib, adopts30: adopts30, avgScore: avgScore, note: note});
        tierWrite(cfg);
        log("🎁 " + note);
        return {changed: true, note: note};
    }
    // 每月 1 日：完整评估（可升可降可清空）；奖品价格带随收入刷新
    let note, action, changed;
    let costs = tierCosts(revenue);
    if (budget < costs[0]) {
        if (tiers.length) { tiers = []; action = "clear"; changed = true; note = "月广告收入 " + revenue + " 元，奖励预算低于最低档手机成本 " + costs[0] + " 元，本月切换为纯荣誉模式"; }
        else { action = "keep"; changed = false; note = "维持纯荣誉模式（月广告收入 " + revenue + " 元，预算不足）"; }
    } else {
        if (!tiers.length) { tiers = tierDefault(revenue); action = "restore"; changed = true; note = "广告月收入 " + revenue + " 元，恢复档位 50/100/150 分起兑（手机奖品，价格带 " + costs.join("/") + " 元以内）"; }
        else {
            // 奖品配置先随收入刷新（收入涨/跌 → 价格带升/降，即使分数不动）
            let nd = tierDefault(revenue);
            let descChanged = false;
            for (let k = 0; k < tiers.length; k++) {
                if ((tiers[k].desc || "") !== nd[k].desc) { tiers[k].desc = nd[k].desc; descChanged = true; }
            }
            let reach = [0, 0, 0];
            contrib.forEach(function(c) { for (let k = 0; k < 3; k++) { if ((c.score || 0) >= (tiers[k] && tiers[k].min)) reach[k]++; } });
            let estCost = 0;
            for (let k = 0; k < 3; k++) estCost += Math.max(reach[k], 1) * costs[k];
            let R = budget / estCost;
            if (R > 1.2 || R < 0.8) {
                let factor = R > 1.2 ? 0.85 : 1.15; // 预算富余→降档更易达；紧张→升档
                let nt = [];
                for (let k = 0; k < tiers.length; k++) {
                    let v = Math.round(tiers[k].min * factor / 5) * 5; // 5 分粒度
                    if (k > 0 && v <= nt[k - 1].min) v = nt[k - 1].min + 10; // 保档差
                    nt.push({min: v, desc: tiers[k].desc});
                }
                tiers = nt; action = "tune"; changed = true;
                note = "档位" + (R > 1.2 ? "下调" : "上调") + " 15%" + (descChanged ? "、奖品价格带更新为 " + costs.join("/") + " 元以内" : "") + "：月收入 " + revenue + " 元、月预算 " + Math.round(budget) + " 元、预估兑换成本 " + Math.round(estCost) + " 元（比值 " + R.toFixed(2) + "）";
            } else {
                action = "keep"; changed = descChanged;
                note = "档位分数保持：预估兑换成本 " + Math.round(estCost) + " 元与月预算 " + Math.round(budget) + " 元匹配（比值 " + R.toFixed(2) + "）" + (descChanged ? "；奖品价格带已随收入更新为 " + costs.join("/") + " 元以内" : "");
            }
        }
    }
    cfg.tiers = tiers; cfg.updated = todayKey; cfg.effective = todayKey;
    cfg.history.push({at: todayKey, action: action, tiers: tiers, revenue: revenue, contributors: nContrib, adopts30: adopts30, avgScore: avgScore, note: note});
    if (cfg.history.length > 24) cfg.history = cfg.history.slice(-24); // 留 2 年
    tierWrite(cfg);
    log("🎁 " + note);
    return {changed: changed, note: note};
}

// ========== 运行模式 ==========
// 每次运行 = 跑一轮（抓取→提炼→推送→退出），不常驻、不保活，不怕息屏杀进程。
// 每日自动推送请用 Auto.js 的「定时任务」功能（系统闹钟拉起，见说明）：
//   Auto.js 主界面 → 右上角菜单 → 定时任务 → ＋ → 选本脚本 → 时间设为每天 09:00
// 手动触发：在 Auto.js 里直接运行本脚本即可。
runOnce();
log("✅ 本轮完成，脚本退出。");
// 调度器完成标记：供「灵感雷达轮流调度.js」检测本轮已结束（写失败不影响主流程）
try { files.write("/storage/emulated/0/脚本/调度子脚本完成.txt", "主脚本 " + new Date().toLocaleString()); } catch (e) {}
