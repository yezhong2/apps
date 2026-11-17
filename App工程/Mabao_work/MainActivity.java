package org.yezhong2.mabao;

import android.app.Activity;
import android.app.AlertDialog;
import android.app.ProgressDialog;
import android.content.DialogInterface;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.media.projection.MediaProjectionManager;
import android.net.Uri;
import android.provider.Settings;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Base64;
import android.util.Log;
import android.util.TypedValue;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * 麻宝AI（自用复刻版）主界面 —— WebView 壳 + 四样（下载安装/自更新/设备上报/停用）
 *
 * ## 现状（2026-11-17 09:xx 建，P4a）
 *   界面＝原生顶栏两颗页签 + 一个 WebView，直接载入本机已经跑通的两个服务：
 *     · 牌局分析 http://127.0.0.1:19200/  （原版 65 个 pyc 一字未改，卡密校验已摘）
 *     · 认牌识别 http://127.0.0.1:19201/  （原版 5s_640.ptl，TorchScript 直读）
 *   服务在 Termux/proot Ubuntu 里常驻（脚本/麻宝AI复刻/分析器|认牌 的 start.sh）。
 *   **服务没起来时**会落到 assets/offline.html 一页人话说明（不白屏、不假装自己能算）。
 *
 * ## 为什么不把页面打进 assets 里 iframe
 *   file:// 页 iframe 住 http://127.0.0.1 要靠 allowUniversalAccessFromFileURLs 等一串开关，
 *   任何一处没开就静默失败，排查成本高；直接 loadUrl(http) 跟 Chrome 里点开一模一样，
 *   只有一条路要保证。离线/出错页才用 file://（它不联网，没有那类问题）。
 *
 * ## 为什么 P4a 只做壳
 *   截图（MediaProjection）/悬浮窗/无障碍自动点牌是 P4b 的事，一次只改一处：
 *   先让「装得上、打得开、四样齐全」有真机证据，再叠自动打牌那条链（那条链一旦写错
 *   会自己乱点牌桌，代价是主人的一局牌）。
 *
 * ## 四样（缺一不可，见 memory app-four-must-haves）
 *   ①下载安装：ApkProvider + ACTION_VIEW（不走 PackageInstaller.Session，小米安全中心会吞）
 *   ②自更新：checkForceUpdate()，时间戳节流 30 秒 + onResume 也查（不许 static boolean 只查一次）
 *   ③设备上报：reportDevice()，24 小时最多一次，action=device_report
 *   ④停用：checkBlocked()，onCreate + onResume + 前台每 30 秒轮询，内部 5 秒节流
 *
 * ## 注意（踩过就知道）
 *   - 停用弹框必须 setCancelable(false) **且** setCanceledOnTouchOutside(false)，弹不出来要 catch 后 finish()
 *   - 自更新「点了没反应」先查权限：Manifest 的 REQUEST_INSTALL_PACKAGES + MIUI appops，
 *     卸载重装会把 appops 重置成 deny —— 这不是代码问题，别去改代码
 *   - targetSdk 34 起 http 明文默认被拦：Manifest 必须 usesCleartextTraffic="true"，
 *     否则 127.0.0.1 的页面一律 ERR_CLEARTEXT_NOT_PERMITTED
 *   - 认牌页要「选一张截图」，WebView 默认不弹文件选择器 → 必须实现 onShowFileChooser，
 *     少了这一环，页面上的「选择图片」按钮点了完全没反应（不是服务的问题）
 *   - 失败表现：App 起来一直停在 offline.html → 先 curl 一下 127.0.0.1:19200，别去改 App
 *
 * ## 变更记录
 *   2026-11-17 09:xx 新建（P4a）：原生页签 + WebView 直连两个服务 + 四样 + 文件选择器。
 *                     不含截图/悬浮窗/无障碍。
 */
public class MainActivity extends Activity {

    private static final String TAG = "MABAO";

    /** 版本号：三处必须一致（build.sh 的 VERSION_NAME、Manifest 的 versionName、这里） */
    private static final String VER = "0.2.0";
    private static final String APP = "mabao";

    /** 工作台云函数（自更新/停用/上报都走它，与其他 App 同一入口） */
    private static final String BH_FC = "https://studio-proxy-fqnkglmqva.cn-hangzhou.fcapp.run";

    private static final String URL_ANALYZE = "http://127.0.0.1:19200/";
    private static final String URL_DETECT = "http://127.0.0.1:19201/";
    private static final String URL_OFFLINE = "file:///android_asset/offline.html";

    private static final int REQ_FILE = 1001;
    /** 录屏授权（实时悬浮分析要的那次系统弹窗） */
    private static final int REQ_CAP = 1002;

    private WebView web;
    private ProgressDialog pd;

    /** 当前页面的地址；「重载」用它，onReceivedError 也用它判断是不是主框架出错 */
    private String curUrl = URL_ANALYZE;

    /** 文件选择器的回调句柄；onShowFileChooser 之后必须且只能回一次值，否则页面永远转圈 */
    private ValueCallback<Uri[]> fileCb;

    /** 节流时间戳（**不用 boolean 标志**：装完只查一次会让之后永不生效，10-27 血泪） */
    private long lastBlockedAt = 0;
    private long lastUpdateAt = 0;

    private final Handler ui = new Handler(Looper.getMainLooper());
    private Runnable pollTask;

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);

        // ── 顶栏：两颗页签 + 重载（原生按钮，不依赖页面里的 JS） ──
        LinearLayout bar = new LinearLayout(this);
        bar.setOrientation(LinearLayout.HORIZONTAL);
        bar.setBackgroundColor(0xFF151922);
        bar.setPadding(dp(6), dp(4), dp(6), dp(4));
        root.addView(bar, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        bar.addView(mkTab("牌局分析", URL_ANALYZE));
        bar.addView(mkTab("认牌", URL_DETECT));
        bar.addView(mkTab("重载", null));
        Button setBtn = mkTab("⚙", null);
        setBtn.setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) { showMenu(); }
        });
        bar.addView(setBtn);

        TextView hint = new TextView(this);
        hint.setText("白屏/连不上＝本机服务没起来（19200 分析 / 19201 认牌），不是这个 App 坏了");
        hint.setTextSize(11f);
        hint.setTextColor(0xFF8B97A7);
        hint.setBackgroundColor(0xFF12161D);
        hint.setPadding(dp(10), dp(5), dp(10), dp(5));
        root.addView(hint, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        // ── 主体 ──
        web = new WebView(this);
        root.addView(web, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));
        setContentView(root);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(true);
        s.setCacheMode(WebSettings.LOAD_NO_CACHE);
        // 服务页自己就是 http 源，页内 fetch 是同源请求，不需要放开跨源/混合内容

        web.setWebViewClient(new WebViewClient() {
            @Override
            public void onReceivedError(WebView v, int code, String desc, String failing) {
                // 只处理主框架：页面里的 favicon / 子资源失败不该把人踢到离线页
                if (failing != null && failing.startsWith("http://127.0.0.1")) {
                    Log.w(TAG, "主页面打不开：" + failing + " " + desc);
                    v.loadUrl(URL_OFFLINE);
                }
            }
        });

        // 认牌页「选一张截图」靠它：没有这一段，文件选择器根本不弹
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb,
                                             FileChooserParams params) {
                if (fileCb != null) {
                    try { fileCb.onReceiveValue(null); } catch (Throwable ig) { }
                    fileCb = null;
                }
                fileCb = cb;
                try {
                    Intent i = new Intent(Intent.ACTION_GET_CONTENT);
                    i.addCategory(Intent.CATEGORY_OPENABLE);
                    i.setType("image/*");
                    startActivityForResult(Intent.createChooser(i, "选一张对局截图"), REQ_FILE);
                    return true;
                } catch (Throwable t) {
                    Log.w(TAG, "打不开图片选择器：" + t);
                    fileCb = null;
                    return false;   // 交回给 WebView 的默认行为，别把回调丢在半空
                }
            }
        });

        web.loadUrl(curUrl);

        // 四样：④停用 ②自更新 ③上报 各查一次（onResume 还会再查，不是"查一次就锁死"）
        checkBlocked();
        checkForceUpdate();
        reportDevice();
        startPoll();
    }

    /** 顶栏按钮：url 为 null 表示「重载当前页」 */
    private Button mkTab(String text, final String url) {
        Button btn = new Button(this);
        btn.setText(text);
        btn.setTextSize(13f);
        btn.setAllCaps(false);
        btn.setTextColor(Color.WHITE);
        GradientDrawable bg = new GradientDrawable();
        bg.setColor(0xFF1E2530);
        bg.setCornerRadius(dp(16));
        btn.setBackground(bg);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        lp.rightMargin = dp(6);
        btn.setLayoutParams(lp);
        btn.setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) {
                if (url == null) {
                    web.loadUrl(curUrl);          // 服务刚起来时点一下就能重新载入
                } else {
                    curUrl = url;
                    web.loadUrl(url);
                }
            }
        });
        return btn;
    }

    private int dp(int v) {
        return (int) TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v,
                getResources().getDisplayMetrics());
    }

    @Override
    protected void onResume() {
        super.onResume();
        // 从后台回来必须再查：期间可能被停用/发了新版（只靠 onCreate 查一次等于漏掉整段）
        checkBlocked();
        checkForceUpdate();
        startPoll();
    }

    @Override
    protected void onPause() {
        super.onPause();
        stopPoll();   // 后台不轮询，省电也避免和系统限制打架
    }

    @Override
    protected void onActivityResult(int req, int res, Intent data) {
        if (req == REQ_CAP) {
            if (res == RESULT_OK && data != null) {
                startFloatService(res, data);
            } else {
                toast("没给录屏权限，悬浮分析开不起来");
            }
            return;
        }
        if (req == REQ_FILE) {
            Uri[] out = null;
            if (res == RESULT_OK && data != null) {
                Uri u = data.getData();
                if (u != null) out = new Uri[]{u};
            }
            if (fileCb != null) {
                try { fileCb.onReceiveValue(out); } catch (Throwable ig) { }
                fileCb = null;      // 必须置空：第二次选图还要能再弹
            }
            return;
        }
        super.onActivityResult(req, res, data);
    }

    /** 返回键先在页面内后退，到底了才退出 App */
    @Override
    public boolean onKeyDown(int code, KeyEvent e) {
        if (code == KeyEvent.KEYCODE_BACK && web != null && web.canGoBack()) {
            web.goBack();
            return true;
        }
        return super.onKeyDown(code, e);
    }

    // ==================== 实时悬浮分析（P4b） ====================

    /** 分析器 /health 里真实可用的玩法（DB 被原版 load_ai 直接返回 None，所以不列） */
    private static final String[] RULE_CODES = {"HAZ", "XZDD", "KWX", "SD", "BB", "DZ"};
    private static final String[] RULE_NAMES = {"杭州麻将", "血战到底", "卡五星", "山东麻将", "蚌埠麻将", "全国地方"};

    private void showMenu() {
        final String[] items = new String[]{
                "▶ 开始实时悬浮分析",
                "■ 停止悬浮分析",
                "玩法：" + ruleCn(getRule()),
                "自动点牌：" + (isAutoTap() ? "开" : "关") + "（点一下切换）",
                "无障碍：" + (MjAccess.isOn() ? "已打开" : "还没打开") + "（点一下看开法）",
                "说明：这两个页面/悬浮窗靠什么活着"
        };
        try {
            AlertDialog.Builder b = new AlertDialog.Builder(this);
            b.setTitle("麻宝AI");
            b.setItems(items, new DialogInterface.OnClickListener() {
                @Override public void onClick(DialogInterface d, int which) {
                    if (which == 0) askScreenCapture();
                    else if (which == 1) stopFloatService();
                    else if (which == 2) pickRule();
                    else if (which == 3) toggleAutoTap();
                    else if (which == 4) showAccHelp();
                    else showHelp();
                }
            });
            b.show();
        } catch (Throwable t) {
            Log.w(TAG, "菜单打不开：" + t);
        }
    }

    private String getRule() {
        return getSharedPreferences("mabao", MODE_PRIVATE).getString("rule", "HAZ");
    }

    private String ruleCn(String code) {
        for (int i = 0; i < RULE_CODES.length; i++) {
            if (RULE_CODES[i].equals(code)) return RULE_NAMES[i];
        }
        return code;
    }

    private void pickRule() {
        final String cur = getRule();
        int sel = 0;
        for (int i = 0; i < RULE_CODES.length; i++) if (RULE_CODES[i].equals(cur)) sel = i;
        try {
            AlertDialog.Builder b = new AlertDialog.Builder(this);
            b.setTitle("打的是哪个玩法（选对算得才准）");
            b.setSingleChoiceItems(RULE_NAMES, sel, new DialogInterface.OnClickListener() {
                @Override public void onClick(DialogInterface d, int which) {
                    getSharedPreferences("mabao", MODE_PRIVATE).edit()
                            .putString("rule", RULE_CODES[which]).apply();
                    d.dismiss();
                    toast("已选：" + RULE_NAMES[which]);
                }
            });
            b.show();
        } catch (Throwable t) {
            Log.w(TAG, "玩法选择打不开：" + t);
        }
    }

    // ==================== 无障碍点牌（P4b） ====================

    /** 自动点牌现在开着没（真正点牌的是悬浮服务，这里只管那个开关） */
    private boolean isAutoTap() {
        return getSharedPreferences("mabao", MODE_PRIVATE).getBoolean("autotap", false);
    }

    /**
     * 自动点牌开关，**默认关**。
     *
     * 为什么默认关：开着就是「算完自己点」，牌桌上真会动牌 —— 开不开由主人拿主意。
     * 为什么这里不跳无障碍设置页：安卓规定这类权限只能本人去系统设置里点，
     *   而且拉起那个页面会挡屏幕、还得手动关（2026-10-10 明令：不许拉无障碍设置界面）。
     *   所以这里只提示路径文字，绝不 startActivity 到那页。
     */
    private void toggleAutoTap() {
        boolean on = !isAutoTap();
        getSharedPreferences("mabao", MODE_PRIVATE).edit().putBoolean("autotap", on).apply();
        toast(on ? "自动点牌：开（每认出新的一手就点建议那张）"
                 : "自动点牌：关（只显示建议，点不点你自己决定）");
        if (on && !MjAccess.isOn()) {
            toast("还差一步：设置→无障碍→「" + getString(R.string.acc_label) + "」打开一次");
        }
    }

    /** 无障碍怎么开、为什么 App 不替你去开 */
    private void showAccHelp() {
        try {
            AlertDialog.Builder b = new AlertDialog.Builder(this);
            b.setTitle("无障碍点牌");
            b.setMessage("现在：" + (MjAccess.isOn() ? "已打开，能点牌" : "还没打开，点不动") + "\n\n"
                    + "开法（只需一次）：设置 → 无障碍 → 已下载的服务 → 「"
                    + getString(R.string.acc_label) + "」→ 打开。\n\n"
                    + "为什么不替你开：安卓规定这类权限只能本人在系统设置里点；这个 App 也不会自己去拉"
                    + "那个设置页（拉起来挡屏幕、还得你手动关）。\n\n"
                    + "它只做一件事：在「建议打出的那张牌」的位置点一下，读不到任何页面内容。");
            b.setPositiveButton("知道", null);
            b.show();
        } catch (Throwable t) {
            Log.w(TAG, "无障碍说明打不开：" + t);
        }
    }

    /** 两道门：①悬浮窗权限（没它连面板都加不上） ②录屏授权（没它抓不了屏） */
    private void askScreenCapture() {
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M
                && !Settings.canDrawOverlays(this)) {
            toast("先允许「显示在其他应用上层」，再点一次「开始」");
            try {
                Intent i = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                        Uri.parse("package:" + getPackageName()));
                startActivity(i);
            } catch (Throwable t) {
                Log.w(TAG, "打不开悬浮窗设置页：" + t);
            }
            return;
        }
        try {
            MediaProjectionManager mpm = (MediaProjectionManager) getSystemService(MEDIA_PROJECTION_SERVICE);
            startActivityForResult(mpm.createScreenCaptureIntent(), REQ_CAP);
        } catch (Throwable t) {
            Log.w(TAG, "录屏授权拉不起来：" + t);
            toast("这次拉不起录屏授权，过一会儿再点");
        }
    }

    private void startFloatService(int code, Intent data) {
        try {
            Intent i = new Intent(this, FloatService.class);
            i.setAction(FloatService.ACTION_START);
            i.putExtra("code", code);
            i.putExtra("data", data);
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                startForegroundService(i);   // O 以上必须用这个，不然系统 5 秒内收掉
            } else {
                startService(i);
            }
            toast("悬浮窗要起来了：拖到不挡手牌的位置，牌一变就重算");
        } catch (Throwable t) {
            Log.w(TAG, "起不来悬浮服务：" + t);
            toast("悬浮分析没起来（看日志）");
        }
    }

    private void stopFloatService() {
        try {
            Intent i = new Intent(this, FloatService.class);
            i.setAction(FloatService.ACTION_STOP);
            startService(i);
            toast("已让它停");
        } catch (Throwable t) {
            Log.w(TAG, "停不下来：" + t);
        }
    }

    private void showHelp() {
        try {
            AlertDialog.Builder b = new AlertDialog.Builder(this);
            b.setTitle("靠什么活着");
            b.setMessage("牌局分析 / 认牌 / 悬浮窗里的算牌，都跑在本机两个服务上：\n"
                    + "· 牌局分析 127.0.0.1:19200\n"
                    + "· 认牌识别 127.0.0.1:19201\n\n"
                    + "它们没在跑的时候：页面会是白的、悬浮窗第三行会写「服务连不上」。\n"
                    + "这两个服务跑在手机的 Linux 环境里（不是这个 App 里），所以要单独启动。");
            b.setPositiveButton("知道", null);
            b.show();
        } catch (Throwable t) {
            Log.w(TAG, "说明打不开：" + t);
        }
    }

    // ==================== ④ 停用 ====================

    /** 前台每 30 秒一轮；内部 5 秒节流（onCreate 紧跟 onResume，不节流会连发两次） */
    private void startPoll() {
        if (pollTask != null) return;
        pollTask = new Runnable() {
            @Override public void run() {
                checkBlocked();
                ui.postDelayed(this, 30000);
            }
        };
        ui.postDelayed(pollTask, 30000);
    }

    private void stopPoll() {
        if (pollTask != null) {
            ui.removeCallbacks(pollTask);
            pollTask = null;
        }
    }

    private void checkBlocked() {
        long now = System.currentTimeMillis();
        if (now - lastBlockedAt < 5000) return;
        lastBlockedAt = now;
        new Thread(new Runnable() {
            @Override public void run() {
                try {
                    String aid = android.provider.Settings.Secure.getString(
                            getContentResolver(), android.provider.Settings.Secure.ANDROID_ID);
                    if (aid == null || aid.length() == 0) return;
                    String body = httpPost(BH_FC,
                            "{\"action\":\"blocked_status\",\"device\":{\"aid\":\"" + aid + "\"}}");
                    if (body == null || body.isEmpty()) return;
                    JSONObject o = new JSONObject(body);
                    if (!o.optBoolean("blocked")) return;
                    final String why = o.optString("why");
                    runOnUiThread(new Runnable() {
                        @Override public void run() { showBlockedDlg(why); }
                    });
                } catch (Exception e) {
                    Log.w(TAG, "停用检查失败：" + e);
                }
            }
        }).start();
    }

    /** 停用框：两个"不能关"都要设，且弹出失败必须 finish（弹不出来也得退） */
    private void showBlockedDlg(String why) {
        if (isFinishing()) return;
        try {
            AlertDialog.Builder bld = new AlertDialog.Builder(this);
            bld.setTitle("这个 App 现在不能用了");
            bld.setMessage("原因：" + (why == null || why.length() == 0 ? "管理员已停用" : why)
                    + "\n\n如果是误会，请联系管理员。");
            bld.setCancelable(false);
            bld.setPositiveButton("退出", new DialogInterface.OnClickListener() {
                @Override public void onClick(DialogInterface d, int w) { finish(); }
            });
            AlertDialog dlg = bld.create();
            dlg.setCanceledOnTouchOutside(false);   // 少这一行＝点框外就关了，人还在用
            dlg.show();
        } catch (Throwable t) {
            Log.w(TAG, "停用框弹不出来，直接退出：" + t);
            finish();
        }
    }

    // ==================== ② 自更新 ====================

    private void checkForceUpdate() {
        long now = System.currentTimeMillis();
        if (now - lastUpdateAt < 30000) return;   // 30 秒节流；不是"只查一次"
        lastUpdateAt = now;
        new Thread(new Runnable() {
            @Override public void run() {
                try {
                    String body = httpPost(BH_FC,
                            "{\"action\":\"check_update\",\"app\":\"" + APP + "\",\"ver\":\"" + VER + "\"}");
                    if (body == null || body.isEmpty()) return;
                    JSONObject o = new JSONObject(body);
                    if (!o.optBoolean("update")) return;
                    final String latest = o.optString("latest");
                    runOnUiThread(new Runnable() {
                        @Override public void run() { showUpdateDlg(latest); }
                    });
                } catch (Exception e) {
                    Log.w(TAG, "检查更新失败：" + e);   // 网络不好不能把人挡在外面
                }
            }
        }).start();
    }

    private void showUpdateDlg(String latest) {
        if (isFinishing()) return;
        try {
            AlertDialog.Builder b = new AlertDialog.Builder(this);
            b.setTitle("有新版本了");
            b.setMessage("当前版本 " + VER + "，最新 " + (latest == null ? "" : latest)
                    + "\n\n点「立即更新」：①自动下载 ②弹出安装界面时点一下「安装」就成。");
            b.setCancelable(false);
            b.setPositiveButton("立即更新", new DialogInterface.OnClickListener() {
                @Override public void onClick(DialogInterface d, int w) { startSelfUpdate(); }
            });
            b.setNegativeButton("以后再说", new DialogInterface.OnClickListener() {
                @Override public void onClick(DialogInterface d, int w) { }
            });
            AlertDialog dlg = b.create();
            dlg.setCanceledOnTouchOutside(false);
            dlg.show();
        } catch (Throwable t) {
            Log.w(TAG, "更新框弹不出来：" + t);
        }
    }

    private void startSelfUpdate() {
        showPd("正在下载新版本…\n下载完会自动弹出安装");
        new Thread(new Runnable() {
            @Override public void run() {
                try {
                    String resp = httpPost(BH_FC,
                            "{\"action\":\"download_apk\",\"app\":\"" + APP + "\"}");
                    if (resp == null || resp.isEmpty()) {
                        hidePd();
                        toast("没网，等有网了再点一次");
                        return;
                    }
                    JSONObject o = new JSONObject(resp);
                    if (!o.optBoolean("ok")) {
                        Log.w(TAG, "下载失败：" + o.optString("error"));
                        hidePd();
                        toast("没下载下来，过一会儿再点一次");
                        return;
                    }
                    byte[] apk = Base64.decode(o.optString("b64"), Base64.DEFAULT);
                    if (apk.length < 10000) {
                        Log.w(TAG, "包太小：" + apk.length);
                        hidePd();
                        toast("下载的文件不对，过一会儿再点一次");
                        return;
                    }
                    hidePd();
                    installBytes(apk);
                } catch (Exception e) {
                    Log.w(TAG, "自更新失败：" + e);
                    hidePd();
                    toast("更新没成，过一会儿再点一次");
                }
            }
        }).start();
    }

    /** ① 下载安装：写 cacheDir/dl → content:// → 系统安装器（不走 Session，小米会吞） */
    private void installBytes(final byte[] apk) {
        try {
            File dir = ApkProvider.dir(this);
            File f = new File(dir, "update.apk");
            FileOutputStream fo = new FileOutputStream(f);
            try {
                fo.write(apk);
                fo.flush();
            } finally {
                try { fo.close(); } catch (Exception ig) { }
            }
            Uri uri = ApkProvider.uriFor(f);
            Intent i = new Intent(Intent.ACTION_VIEW);
            i.setDataAndType(uri, "application/vnd.android.package-archive");
            i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(i);
            toast("马上会弹出安装界面，点一下「安装」就成");
        } catch (Exception e) {
            Log.w(TAG, "安装失败：" + e);
            toast("这次没装上，过一会儿再点一次");
        }
    }

    // ==================== ③ 设备上报 ====================

    /** 24 小时最多一次；启动时打一次就够（服务端按 aid 去重） */
    private void reportDevice() {
        String aid = android.provider.Settings.Secure.getString(
                getContentResolver(), android.provider.Settings.Secure.ANDROID_ID);
        if (aid == null || aid.length() == 0) return;
        SharedPreferences sp = getSharedPreferences("mabao", MODE_PRIVATE);
        long last = sp.getLong("lastReportAt", 0);
        if (System.currentTimeMillis() - last < 24L * 3600 * 1000) return;
        final String aidF = aid;
        final String model = android.os.Build.MANUFACTURER + " " + android.os.Build.MODEL;
        final String rel = android.os.Build.VERSION.RELEASE;
        new Thread(new Runnable() {
            @Override public void run() {
                try {
                    String body = httpPost(BH_FC, "{\"action\":\"device_report\",\"app\":\"" + APP
                            + "\",\"device\":{\"aid\":\"" + aidF + "\",\"model\":\"" + model
                            + "\",\"os\":\"" + rel + "\",\"ver\":\"" + VER + "\"}}");
                    if (body != null && body.indexOf("\"ok\":true") >= 0) {
                        getSharedPreferences("mabao", MODE_PRIVATE).edit()
                                .putLong("lastReportAt", System.currentTimeMillis()).apply();
                        Log.i(TAG, "设备已上报");
                    }
                } catch (Exception e) {
                    Log.w(TAG, "上报失败：" + e);
                }
            }
        }).start();
    }

    // ==================== 工具 ====================

    private String httpPost(String url, String json) {
        HttpURLConnection c = null;
        try {
            c = (HttpURLConnection) new URL(url).openConnection();
            c.setConnectTimeout(8000);
            c.setReadTimeout(20000);
            c.setRequestMethod("POST");
            c.setDoOutput(true);
            c.setRequestProperty("Content-Type", "application/json; charset=utf-8");
            OutputStream os = c.getOutputStream();
            try {
                os.write(json.getBytes("UTF-8"));
                os.flush();
            } finally {
                try { os.close(); } catch (Exception ig) { }
            }
            int code = c.getResponseCode();
            InputStream in = code >= 400 ? c.getErrorStream() : c.getInputStream();
            if (in == null) return null;
            ByteArrayOutputStream bo = new ByteArrayOutputStream();
            byte[] buf = new byte[8192];
            int n;
            while ((n = in.read(buf)) > 0) bo.write(buf, 0, n);
            try { in.close(); } catch (Exception ig) { }
            return new String(bo.toByteArray(), "UTF-8");
        } catch (Exception e) {
            Log.w(TAG, "HTTP 失败：" + e);
            return null;
        } finally {
            if (c != null) c.disconnect();
        }
    }

    private void showPd(final String msg) {
        runOnUiThread(new Runnable() {
            @Override public void run() {
                try {
                    if (pd == null) pd = new ProgressDialog(MainActivity.this);
                    pd.setMessage(msg);
                    pd.setCancelable(false);
                    pd.setCanceledOnTouchOutside(false);
                    if (!pd.isShowing()) pd.show();
                } catch (Throwable t) { Log.w(TAG, "进度框打不开：" + t); }
            }
        });
    }

    private void hidePd() {
        runOnUiThread(new Runnable() {
            @Override public void run() {
                try { if (pd != null && pd.isShowing()) pd.dismiss(); } catch (Throwable t) { }
            }
        });
    }

    private void toast(final String s) {
        runOnUiThread(new Runnable() {
            @Override public void run() {
                Toast.makeText(MainActivity.this, s, Toast.LENGTH_LONG).show();
            }
        });
    }
}
