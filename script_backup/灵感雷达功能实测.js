"ui";
// ========== 灵感雷达 · 功能实测器 v1（真实 WebView 加载产品 → 自动点击全部按钮 → 收集运行时错误） ==========
// 由「灵感雷达产品巡检.js」通过 engines.execScriptFile 调用；任务/结果走文件（本机 waitFor 不可靠——调度器同理用完成文件）
// 任务：/storage/emulated/0/脚本/功能实测_任务.json {"target":"<产品绝对路径>","label":"<文件名>"}
// 结果：/storage/emulated/0/脚本/功能实测_结果.json {"label":..,"buttons":..,"clicked":..,"errs":[..],"fatal":..,"timeout":..,"step":..,"ts":..}
// 兼容性策略：结果经 location.hash → doUpdateVisitedHistory 回传（不依赖 evaluateJavascript 回调）；
// 实测器自身逐步记日志，万一魔改版 ui/WebView 有兼容问题，日志能精确定位卡在哪一步。
var LOG_FILE = "/storage/emulated/0/脚本/巡检_日志.log";
function log(msg) {
    try {
        var fa = new java.io.FileOutputStream(LOG_FILE, true);
        fa.write(new java.lang.String("[" + new Date().toLocaleString() + "] 🧪 " + msg + "\n").getBytes("UTF-8"));
        fa.flush();
        fa.close();
    } catch (e) {}
}
var TASK_PATH = "/storage/emulated/0/脚本/功能实测_任务.json";
var RESULT_PATH = "/storage/emulated/0/脚本/功能实测_结果.json";
var TMP_HTML = "/storage/emulated/0/脚本/_功能实测临时页.html"; // 放脚本根目录（不进产出/，不污染产品列表）

var task = null;
try { task = JSON.parse(files.read(TASK_PATH)); } catch (e) {}
if (!task || !task.target) { log("功能实测·无任务，退出"); exit(); }
var label = task.label || task.target;
log("功能实测·开测 " + label);

var step = "boot";
var finished = false;
function finish(rep) {
    if (finished) return;
    finished = true;
    rep = rep || {};
    rep.label = label;
    rep.step = step;
    rep.ts = new Date().toLocaleString();
    try { files.write(RESULT_PATH, JSON.stringify(rep)); } catch (e) {}
    try { files.remove(TMP_HTML); } catch (e) {}
    log("功能实测·结束：" + JSON.stringify(rep).slice(0, 380));
    try { exit(); } catch (e) {}
}

// 1) 注入测试钩子（onerror 收集 + __runTest 驱动）到临时副本
var html = "";
try { html = files.read(task.target); } catch (e) { finish({fatal: "读取产品失败：" + e}); }
var HOOK = "<script>window.__tErr=[];" +
    "window.onerror=function(m,s,l){try{window.__tErr.push(String(m).slice(0,120));}catch(e){}return false;};" +
    "window.__runTest=function(){" +
    "var rep={buttons:0,clicked:0,errs:[],errAfter:0};" +
    "try{" +
    "var els=document.querySelectorAll('button,[onclick],input[type=button],input[type=submit]');" +
    "rep.buttons=els.length;" +
    "var n=Math.min(els.length,20);" +
    "for(var i=0;i<n;i++){try{els[i].click();rep.clicked++;}catch(e){}}" +
    "}catch(e){rep.fatal='驱动异常:'+String(e).slice(0,120);}" +
    "setTimeout(function(){" +
    "rep.errs=window.__tErr.slice(0,8);" +
    "rep.errAfter=window.__tErr.length;" +
    "try{location.hash='__t='+encodeURIComponent(JSON.stringify(rep));}catch(e){}" +
    "},1500);" +
    "};</script>";
html = html.replace(/<head[^>]*>/i, function(m) { return m + HOOK; });
if (html.indexOf("__runTest") < 0) html = HOOK + html;
try { files.write(TMP_HTML, html); } catch (e) { finish({fatal: "临时页写入失败：" + e}); }
step = "temp-written";

// 2) WebView 加载 + 自动点击 + 收结果
try { ui.layout("<vertical><webview id=\"wv\" layout_weight=\"1\"/></vertical>"); } catch (e) { finish({fatal: "ui 布局失败：" + e}); }
var wv = ui.wv;
try {
    wv.getSettings().setJavaScriptEnabled(true);
    wv.getSettings().setAllowFileAccess(true);
    try { wv.getSettings().setAllowFileAccessFromFileURLs(true); } catch (e) {}
    try { wv.getSettings().setAllowUniversalAccessFromFileURLs(true); } catch (e) {}
} catch (e) { finish({fatal: "WebSettings 设置失败：" + e}); }
step = "settings-ok";

try {
    wv.setWebChromeClient(new JavaAdapter(android.webkit.WebChromeClient, {
        onJsAlert: function(view, url, message, result) { try { result.confirm(); } catch (e) {} return true; },
        onJsConfirm: function(view, url, message, result) { try { result.confirm(); } catch (e) {} return true; },
        onJsPrompt: function(view, url, message, defaultValue, result) { try { result.confirm(""); } catch (e) {} return true; }
    }));
    wv.setWebViewClient(new JavaAdapter(android.webkit.WebViewClient, {
        onPageFinished: function(view, url) {
            step = "page-finished";
            setTimeout(function() {
                step = "driving";
                try { view.loadUrl("javascript:__runTest()"); } catch (e) { finish({fatal: "驱动注入失败：" + e}); }
            }, 1500);
        },
        doUpdateVisitedHistory: function(view, url, isReload) {
            var s = String(url);
            var i = s.indexOf("__t=");
            if (i >= 0) {
                step = "result-received";
                var rep = null;
                try { rep = JSON.parse(decodeURIComponent(s.slice(i + 4))); } catch (e) { rep = {fatal: "结果解析失败"}; }
                finish(rep);
            }
        },
        shouldOverrideUrlLoading: function(view, url) {
            return true; // 阻止产品内链接把测试页带跳走（本测试只点击按钮类元素，不该有真跳转）
        }
    }));
} catch (e) { finish({fatal: "WebViewClient 挂载失败：" + e}); }
step = "client-ok";

try { wv.loadUrl("file://" + TMP_HTML); } catch (e) { finish({fatal: "加载临时页失败：" + e}); }
step = "loading";

// 3) 兜底超时：25 秒没收到结果就按超时上报（附卡住的步骤，便于迭代排查）
setTimeout(function() { finish({timeout: true, errs: []}); }, 25000);
