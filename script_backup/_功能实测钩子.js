// ============================================================================
// 灵感雷达 · 功能实测钩子（2026-10-03 重写）
// ----------------------------------------------------------------------------
// 由「灵感雷达功能实测.js」读入本文件，整段注入到被测产品页的 <head> 顶部。
// 注入后页面提供 window.__runTest()，逐个点击按钮类元素并记录三维结果：
//
//   errs      —— 未捕获的 JS 异常（window.onerror + unhandledrejection 两路）
//   alerts    —— 点击过程中弹出的 alert / confirm / prompt 文本（旧版直接丢弃）
//   noeffect  —— 点了之后「页面毫无变化、也没弹任何东西」的按钮（标签）
//   alertonly —— 点了之后「页面没变化、只弹了个提示」的按钮（标签）
//
// 三维的分工：errs 抓「崩」，alertonly 抓「占位按钮/只弹提示」，noeffect 抓「彻底哑火」。
// 旧版的盲区正在后者：只数异常，不测效果 —— 写死结果、弹「开发中」都算「0 报错」。
//
// 为什么独立成文件：旧版把这段代码用字符串拼接硬塞在 AutoJs 源码里，
// 引号转义极易写错且无法单独校验。独立成文件后可直接 `node --check` 验语法。
// ============================================================================
window.__tErr = [];
window.__tAlerts = [];

// 第一路：同步/异步抛出的未捕获异常
window.onerror = function (m, s, l) {
    try { window.__tErr.push(String(m).slice(0, 120)); } catch (e) {}
    return false;
};

// 第二路：Promise 里 reject 而未 catch（旧版完全没抓）
window.addEventListener("unhandledrejection", function (ev) {
    try {
        var r = (ev && ev.reason) || ev;
        window.__tErr.push("未处理的 Promise 拒绝: " + String(r).slice(0, 100));
    } catch (e) {}
});

// 页面「指纹」：可见文字长度 + HTML 长度 + 元素总数。任一变化都算「页面动过了」
window.__sig = function () {
    try {
        var b = document.body;
        return (b.innerText || "").length + "|" + b.innerHTML.length + "|" + document.getElementsByTagName("*").length;
    } catch (e) { return "?"; }
};

// 【2026-10-03 新增】捕获「点击后新冒出来的文字」——页内 toast / 通知条 / 提示条靠它现形。
// 为什么需要：旧版只靠 __sig() 看 DOM 变没变，而**弹一句提示本身就会改变 DOM** → 于是
// 「点了只弹个『开发中/Coming soon』」被判成「有变化、无问题」，全站安慰剂按钮集体漏网。
// （浏览器 alert 有 __tAlerts 单独通道；这里管的是页面自己画的提示。）
window.__tAdded = [];
var PLACEHOLDER_RE = /开发中|敬请期待|敬请关注|即将上线|暂未开放|尚未开放|尚未实现|待实现|暂不支持|暂不可用|coming\s*soon|not\s+implemented|not\s+available|not\s+supported|under\s+development|under\s+construction|not\s+yet\s+(available|implemented|supported)|work\s+in\s+progress|to\s+be\s+implemented|coming\s+in\s+a\s+future|placeholder|dummy\s+data/i;
try {
    window.__tObs = new MutationObserver(function (muts) {
        for (var i = 0; i < muts.length; i++) {
            var m = muts[i];
            if (m.type === "characterData" && m.target) {
                try {
                    var t0 = String(m.target.textContent || "").replace(/\s+/g, " ").trim();
                    if (t0 && t0.length < 120) window.__tAdded.push(t0.slice(0, 80));
                } catch (e) {}
                continue;
            }
            var nodes = m.addedNodes || [];
            for (var j = 0; j < nodes.length; j++) {
                try {
                    var t = String(nodes[j].textContent || "").replace(/\s+/g, " ").trim();
                    if (t && t.length < 120) window.__tAdded.push(t.slice(0, 80));
                } catch (e) {}
            }
        }
    });
    window.__tObs.observe(document.body, {childList: true, subtree: true, characterData: true});
} catch (e) {}

window.__runTest = function () {
    var rep = { buttons: 0, clicked: 0, errs: [], errAfter: 0, alerts: [], noeffect: [], alertonly: [], placeholder: [], msgs: [], msgonly: 0 };
    // 选择器补上 a[href='#']：旧版不含导航链接，导致「点不动的导航」完全不在测试范围内
    var SEL = "button,[onclick],input[type=button],input[type=submit],a[href='#']";
    var els = [];
    try { els = document.querySelectorAll(SEL); } catch (e) { els = []; }
    rep.buttons = els.length;
    var n = Math.min(els.length, 30); // 旧版上限 20，超出的按钮从不被点
    var i = 0;
    var msgOnly = 0; // 点了之后只冒出一句短文本、且话术不像占位词的按钮数（信息性指标，供聚合参考）

    function label(el) {
        try {
            var t = (el.textContent || el.value || el.getAttribute("title") || el.id || "").replace(/\s+/g, " ").trim();
            return t ? t.slice(0, 24) : ("<" + String(el.tagName).toLowerCase() + ">");
        } catch (e) { return "?"; }
    }

    function finish() {
        try {
            rep.errs = window.__tErr.slice(0, 8);
            rep.errAfter = window.__tErr.length;
            rep.alerts = window.__tAlerts.slice(0, 8);
            rep.msgonly = msgOnly;
            location.hash = "__t=" + encodeURIComponent(JSON.stringify(rep));
        } catch (e) {}
    }

    // 逐个点、逐个比：每个按钮点完等 350ms 看页面指纹变没变、有没有弹东西
    function step() {
        if (i >= n) { setTimeout(finish, 1200); return; }
        var el = els[i];
        var before = window.__sig();
        var al0 = window.__tAlerts.length;
        window.__tAdded = []; // 清空「点击后新出现的文字」收集器
        try { el.click(); rep.clicked++; } catch (e) {}
        setTimeout(function () {
            var after = window.__sig();
            var alerted = window.__tAlerts.length > al0;
            var added = window.__tAdded.slice(0, 4);
            if (before === after) {
                // 页面毫无变化：弹了提示算「只弹提示」，什么都没弹算「彻底哑火」
                if (alerted) rep.alertonly.push(label(el));
                else rep.noeffect.push(label(el));
            } else if (added.length) {
                // 页面变了，但变的全是一句短文本 → 很可能是「弹个提示就完事」
                var joined = added.join(" | ");
                if (rep.msgs.length < 12) rep.msgs.push(label(el) + " → " + joined.slice(0, 60));
                if (PLACEHOLDER_RE.test(joined)) {
                    if (rep.placeholder.length < 8) rep.placeholder.push(label(el) + " → " + joined.slice(0, 60));
                } else {
                    msgOnly++;
                }
            }
            i++;
            step();
        }, 350);
    }
    step();
};
