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

window.__runTest = function () {
    var rep = { buttons: 0, clicked: 0, errs: [], errAfter: 0, alerts: [], noeffect: [], alertonly: [] };
    // 选择器补上 a[href='#']：旧版不含导航链接，导致「点不动的导航」完全不在测试范围内
    var SEL = "button,[onclick],input[type=button],input[type=submit],a[href='#']";
    var els = [];
    try { els = document.querySelectorAll(SEL); } catch (e) { els = []; }
    rep.buttons = els.length;
    var n = Math.min(els.length, 30); // 旧版上限 20，超出的按钮从不被点
    var i = 0;

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
            location.hash = "__t=" + encodeURIComponent(JSON.stringify(rep));
        } catch (e) {}
    }

    // 逐个点、逐个比：每个按钮点完等 350ms 看页面指纹变没变、有没有弹东西
    function step() {
        if (i >= n) { setTimeout(finish, 1200); return; }
        var el = els[i];
        var before = window.__sig();
        var al0 = window.__tAlerts.length;
        try { el.click(); rep.clicked++; } catch (e) {}
        setTimeout(function () {
            var after = window.__sig();
            var alerted = window.__tAlerts.length > al0;
            if (before === after) {
                // 页面毫无变化：弹了提示算「只弹提示」，什么都没弹算「彻底哑火」
                if (alerted) rep.alertonly.push(label(el));
                else rep.noeffect.push(label(el));
            }
            i++;
            step();
        }, 350);
    }
    step();
};
