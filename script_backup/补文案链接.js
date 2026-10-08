// _backfill.js —— 给存量文案补「产品直达链接」
// 规则：① 只给【已上线】的产品补（台账里有 url），未上线的不补——加了就是死链，比没有更糟
//       ② 已经有链接的跳过（幂等，可重复执行）
//       ③ 改之前先把所有文案原样备份到 产出/_文案备份_20261003_加链接前/
// URL 用 encodeURI 编码（空格→%20、中文→%E9…），否则在企微/微信里会被空格截断点不动
var fs = require("fs");
var DIR = "/storage/emulated/0/脚本/产出";
var led = JSON.parse(fs.readFileSync(DIR + "/产品台账.json", "utf8"));
var map = {};
(led.list || []).forEach(function (p) { map[p.name] = p; });

// 文案文件有两种命名（带下划线 / 不带），系统两处代码都认，这里也两种都收
var arts = fs.readdirSync(DIR).filter(function (n) { return /_?文案\.txt$/.test(n); });

// 先全量备份
var BK = DIR + "/_文案备份_20261003_加链接前";
try { fs.mkdirSync(BK); } catch (e) {}
var bk = 0;
arts.forEach(function (a) { try { fs.copyFileSync(DIR + "/" + a, BK + "/" + a); bk++; } catch (e) {} });

var done = [], already = 0, offline = [], noLedger = [], errs = [];
arts.forEach(function (a) {
    var html = a.replace(/_?文案\.txt$/, ".html");
    var p = map[html];
    if (!p) { noLedger.push(html); return; }
    if (!p.url) { offline.push(html); return; }
    var url = "https://yezhong2.github.io/apps/" + encodeURI(html);
    var path = DIR + "/" + a;
    var t;
    try { t = fs.readFileSync(path, "utf8"); } catch (e) { errs.push(a + " 读取失败"); return; }
    if (t.indexOf(url) >= 0) { already++; return; }
    try {
        fs.writeFileSync(path, t.replace(/\s+$/, "") + "\n\n🔗 直达链接（完全免费，打开即用）：\n" + url + "\n");
        done.push(a);
    } catch (e) { errs.push(a + " 写入失败：" + e.message); }
});

console.log("文案总数：" + arts.length + "（已备份 " + bk + " 份到 _文案备份_20261003_加链接前/）");
console.log("");
console.log("✅ 已补链接：" + done.length + " 份");
done.forEach(function (n) { console.log("   " + n); });
console.log("");
console.log("⏭️ 本来就有链接（跳过）：" + already + " 份");
console.log("");
console.log("⚠️ 未上线、故意没补（补了是死链）：" + offline.length + " 份");
offline.forEach(function (n) { console.log("   " + n); });
console.log("");
console.log("⚠️ 台账里查不到： " + noLedger.length + " 份");
noLedger.forEach(function (n) { console.log("   " + n); });
if (errs.length) { console.log(""); console.log("❌ 出错：" + errs.join(" / ")); }
