package org.yezhong2.mabao;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.drawable.GradientDrawable;
import android.hardware.display.DisplayManager;
import android.hardware.display.VirtualDisplay;
import android.media.Image;
import android.media.ImageReader;
import android.media.projection.MediaProjection;
import android.media.projection.MediaProjectionManager;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.util.Base64;
import android.util.DisplayMetrics;
import android.util.Log;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;
import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.ByteBuffer;
import java.util.ArrayList;
import java.util.List;

/**
 * 麻宝AI · 实时悬浮分析（P4b 的核心）
 *
 * ## 干什么（这就是原版「实时自动分析」那条链）
 *   悬浮窗常驻 → 每 0.9 秒抓一屏 → 把整屏发给本机 127.0.0.1:19201/detect 认手牌
 *   → 认出 13/14 张 → 把牌码发给 127.0.0.1:19200/analyze 跑原版算法
 *   → 结果（建议打哪张 + 向听 + 手牌）直接显示在悬浮窗里。牌没变就不重复分析。
 *
 * ## 为什么算牌/认牌不写进 App
 *   P1～P3 已经把原版 65 个 pyc 和 5s_640.ptl 跑通并在本机常驻（proot Ubuntu 的 python3.8），
 *   App 只当「眼睛 + 嘴巴 + 手」：抓屏、发请求、显示。这样算法与原件一字不差，
 *   也避免把 29MB 模型和 torch 塞进 25KB 的壳里（那是另一个工程）。
 *   **代价（如实记）**：这两个服务必须在本机跑着（脚本/麻宝AI复刻/分析器|认牌 的 start.sh），
 *   服务一停悬浮窗就会显式写「服务连不上」，不会假装在算。
 *
 * ## 关键坑（都踩过或写在原版行为里）
 *   1. Android 10+ 录屏必须**前台服务 + foregroundServiceType=mediaProjection**；
 *      14 起还要求先 startForeground 再 getMediaProjection，并且**必须先 registerCallback**
 *      再 createVirtualDisplay，否则直接抛 SecurityException。
 *   2. VirtualDisplay 的 ImageReader 用 RGBA_8888 时行宽会被对齐，必须按 rowStride/pixelStride
 *      还原真实宽度，否则画面会斜着撕裂（这是最经典的抓屏 bug）。
 *   3. 悬浮窗自己也会被录进去 → 面板固定放左上角、不做大蒙层；认牌只取「张数最多的那一行」，
 *      不会被顶部的小面板带偏（P3.1 的 pick_hand_row 就是干这个的）。
 *   4. 网络全在本机 127.0.0.1，不走外网；截图缩到 720 宽再 JPEG 85，约 80~150KB，省 1 秒。
 *   5. 失败一律写进悬浮窗的第三行状态（不弹框、不静默）：抓屏为空 / 没认出牌 / 服务连不上 / 算法报错
 *      —— 四种说法要分开，否则排障时全靠猜。
 *
 * ## 变更记录
 *   2026-11-17 09:4x 新建：悬浮窗 + MediaProjection 抓屏 + 认牌 + 分析 + 显示，一个循环。
 */
public class FloatService extends Service {

    private static final String TAG = "MABAO_FLOAT";

    public static final String ACTION_START = "org.yezhong2.mabao.START";
    public static final String ACTION_STOP = "org.yezhong2.mabao.STOP";

    private static final String DETECT_URL = "http://127.0.0.1:19201/detect";
    private static final String ANALYZE_URL = "http://127.0.0.1:19200/analyze";

    /** 一轮的最小间隔：抓屏＋上传＋YOLO 推理本身约 1.1~1.6 秒，这里只是不让它空转太密 */
    private static final int TICK_MS = 900;

    private static final String CH = "mabao_float";
    private static final int NOTIF_ID = 4321;

    private WindowManager wm;
    private View panel;
    private ImageView ivBall;
    private TextView tvHand, tvAdvice, tvSy, tvErr;
    /** 「点这张」按钮：P4b 无障碍点牌的入口（自动点牌开关在 App 菜单里） */
    private TextView tvTap;
    private LinearLayout llSemi;
    private WindowManager.LayoutParams lp;

    private MediaProjection mp;
    private ImageReader reader;
    private VirtualDisplay vd;
    private int sw, sh, sdpi;

    private final Handler ui = new Handler(Looper.getMainLooper());

    private volatile boolean running = false;
    private volatile boolean busy = false;
    private volatile boolean paused = false;

    /** 玩法代号（分析器 /health 里的 rules 之一），从设置里来，默认杭州 */
    private String rule = "HAZ";

    /** 上次分析时的手牌指纹：牌没变就不重复跑算法（省时间，也避免结果乱跳） */
    private String lastHandKey = "";

    /** 建议那张牌在**屏幕**上的坐标；-1 = 这一轮没有可点的目标（别拿 0,0 去乱点） */
    private volatile int tapX = -1;
    private volatile int tapY = -1;
    /** 自动点牌：同一手牌只点一次，两次点击至少隔 2.5 秒（否则 0.9 秒一轮会连点） */
    private String lastTapKey = "";
    private long lastTapAt = 0;

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        wm = (WindowManager) getSystemService(Context.WINDOW_SERVICE);
        SharedPreferences sp = getSharedPreferences("mabao", MODE_PRIVATE);
        rule = sp.getString("rule", "HAZ");
    }

    @Override
    public int onStartCommand(Intent it, int flags, int startId) {
        if (it != null && ACTION_STOP.equals(it.getAction())) {
            shutdown();
            return START_NOT_STICKY;
        }

        // ── 1) 先变前台服务（Android 14 要求录屏服务在 getMediaProjection 之前就前台化）──
        goForeground();

        // ── 2) 拿到录屏授权句柄（只在第一次 START 时带 data 进来）──
        if (mp == null && it != null && it.hasExtra("data")) {
            try {
                int code = it.getIntExtra("code", 0);
                Intent data = (Intent) it.getParcelableExtra("data");
                MediaProjectionManager mpm = (MediaProjectionManager)
                        getSystemService(Context.MEDIA_PROJECTION_SERVICE);
                mp = mpm.getMediaProjection(code, data);
                if (mp == null) {
                    Log.w(TAG, "getMediaProjection 返回 null（授权被撤了？）");
                } else {
                    // 必须先注册回调再建 VirtualDisplay：Android 14 起不注册直接抛 SecurityException
                    mp.registerCallback(new MediaProjection.Callback() {
                        @Override public void onStop() {
                            Log.w(TAG, "系统停止了录屏（用户点了停止/切走）");
                            ui.post(new Runnable() { @Override public void run() {
                                setState("录屏被系统停了，点「开」重新授权");
                                running = false;
                            }});
                        }
                    }, ui);
                    setupVirtualDisplay();
                }
            } catch (Throwable t) {
                Log.w(TAG, "建立录屏失败：" + t);
            }
        }

        showPanel();
        startLoop();
        return START_STICKY;
    }

    // ==================== 前台通知 ====================

    private void goForeground() {
        try {
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                NotificationChannel ch = new NotificationChannel(CH, "实时分析", NotificationManager.IMPORTANCE_LOW);
                ch.setShowBadge(false);
                nm.createNotificationChannel(ch);
            }
            Notification.Builder b = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                    ? new Notification.Builder(this, CH)
                    : new Notification.Builder(this);
            b.setContentTitle("麻宝AI 正在实时分析")
                    .setContentText("悬浮窗显示每一步建议；点悬浮窗右上角「✕」停止")
                    .setSmallIcon(R.drawable.ic_launcher)
                    .setOngoing(true);
            Notification n = b.build();
            if (Build.VERSION.SDK_INT >= 29) {
                // 声明了 foregroundServiceType=mediaProjection，就必须按这个类型前台化
                startForeground(NOTIF_ID, n, android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION);
            } else {
                startForeground(NOTIF_ID, n);
            }
        } catch (Throwable t) {
            Log.w(TAG, "前台化失败（不影响悬浮窗，但系统可能随时收掉）：" + t);
        }
    }

    // ==================== 录屏 ====================

    private void setupVirtualDisplay() {
        DisplayMetrics dm = getResources().getDisplayMetrics();
        sw = dm.widthPixels;
        sh = dm.heightPixels;
        sdpi = dm.densityDpi;
        reader = ImageReader.newInstance(sw, sh, PixelFormat.RGBA_8888, 2);
        vd = mp.createVirtualDisplay("mabao-cap", sw, sh, sdpi,
                DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
                reader.getSurface(), null, ui);
        Log.i(TAG, "录屏已建立 " + sw + "x" + sh);
    }

    /** 抓一帧；拿不到返回 null（系统冻结/录屏被停都会是 null，别当崩溃） */
    private Bitmap grab() {
        if (reader == null) return null;
        Image img = null;
        try {
            img = reader.acquireLatestImage();
            if (img == null) return null;
            Image.Plane p = img.getPlanes()[0];
            ByteBuffer buf = p.getBuffer();
            int w = img.getWidth(), h = img.getHeight();
            int rowStride = p.getRowStride();
            int pixStride = p.getPixelStride();
            // 行宽会被对齐到 pixStride 的整数倍：不还原真实宽度，画面会斜着撕裂
            int paddedW = rowStride / pixStride;
            Bitmap raw = Bitmap.createBitmap(paddedW, h, Bitmap.Config.ARGB_8888);
            raw.copyPixelsFromBuffer(buf);
            if (paddedW == w) return raw;
            Bitmap cut = Bitmap.createBitmap(raw, 0, 0, w, h);
            raw.recycle();
            return cut;
        } catch (Throwable t) {
            Log.w(TAG, "抓帧失败：" + t);
            return null;
        } finally {
            if (img != null) {
                try { img.close(); } catch (Throwable ig) { }
            }
        }
    }

    /** 缩到 720 宽：认牌模型本来就 letterbox 到 640，传大图只是多花一秒 */
    private Bitmap shrink(Bitmap src) {
        try {
            if (src.getWidth() <= 720) return src;
            float k = 720f / src.getWidth();
            int h = Math.max(2, (int) (src.getHeight() * k));
            Bitmap s = Bitmap.createScaledBitmap(src, 720, h, true);
            src.recycle();
            return s;
        } catch (Throwable t) {
            return src;
        }
    }

    // ==================== 主循环 ====================

    private void startLoop() {
        if (running) return;
        running = true;
        ui.post(tick);
        setState("循环已开，正在抓屏…");
    }

    private final Runnable tick = new Runnable() {
        @Override public void run() {
            if (!running) return;
            if (!paused && !busy) {
                busy = true;
                new Thread(work).start();
            }
            ui.postDelayed(this, TICK_MS);
        }
    };

    /** 一轮：抓屏 → 认牌 → 认得的牌没变就跳过算法 → 变了才跑分析 → 更新面板 */
    private final Runnable work = new Runnable() {
        @Override public void run() {
            long t0 = System.currentTimeMillis();
            try {
                if (mp == null || reader == null) {
                    setState("还没录屏授权：点面板上的「开」授权一次");
                    return;
                }
                Bitmap b = grab();
                if (b == null) {
                    setState("抓屏拿不到画面（录屏可能被系统停了）");
                    return;
                }
                b = shrink(b);
                ByteArrayOutputStream bo = new ByteArrayOutputStream();
                b.compress(Bitmap.CompressFormat.JPEG, 85, bo);
                b.recycle();

                String detBody = httpPost(DETECT_URL, Base64.encodeToString(bo.toByteArray(), Base64.NO_WRAP), false);
                if (detBody == null) {
                    setState("认牌服务连不上（19201）—— 服务没起来？");
                    return;
                }
                JSONObject det = new JSONObject(detBody);
                if (det.has("error")) {
                    setState("认牌出错：" + det.optString("error"));
                    return;
                }
                int n = det.optInt("hand_count", 0);
                JSONArray cnArr = det.optJSONArray("hand_cn");
                JSONArray nameArr = det.optJSONArray("hand");

                if (n <= 0 || nameArr == null) {
                    setState("这一屏没认出牌（" + det.optDouble("infer_s", 0) + "s）—— 牌桌没在手牌区？");
                    lastHandKey = "";
                    return;
                }

                List<Integer> codes = new ArrayList<>();
                for (int i = 0; i < nameArr.length(); i++) {
                    int c = tileCode(nameArr.optString(i));
                    if (c >= 0) codes.add(c);
                }

                // 原版那颗 tv_auto_result 只有 40dp 宽，放不下整手牌 —— 这里只报张数，
                // 完整手牌看 App 里的「认牌」页（同样的图、带标注）
                setHand(n + "张");

                final String key = codes.toString();
                if (key.equals(lastHandKey)) {
                    setState(codes.size() + " 张 · 牌没变，等下一张 · " + det.optDouble("infer_s", 0) + "s");
                    return;
                }

                String req = "{\"rule\":\"" + rule + "\",\"hand\":" + codes.toString() + "}";
                String anaBody = httpPost(ANALYZE_URL, req, true);
                if (anaBody == null) {
                    setState("分析服务连不上（19200）—— 服务没起来？");
                    return;
                }
                JSONObject ana = new JSONObject(anaBody);
                if (!ana.optBoolean("ok")) {
                    setState("分析报错：" + ana.optString("err"));
                    return;
                }
                String tn = ana.optString("targetName");
                if (tn.length() == 0) tn = ana.optString("target");
                String sy = ana.isNull("syanten") ? "" : String.valueOf(ana.opt("syanten"));
                String note = ana.optString("note");

                lastHandKey = key;
                // 先把「建议那张牌」在图里的位置换成屏幕坐标（点牌要靠它），再更新面板
                pickTarget(det, tn);
                setAdvice("打 " + (tn.length() == 0 ? "（无明确建议）" : tn),
                        sy.length() == 0 ? "" : "向听 " + sy);
                maybeAutoTap(key, tn);
                setState("");   // 成功一轮就把错误行清掉（不然残留误报会让人白查半天）
            } catch (Throwable t) {
                Log.w(TAG, "一轮失败：" + t);
                setState("出错了：" + t.getClass().getSimpleName());
            } finally {
                busy = false;
            }
        }
    };

    /** 牌名 → 原版 34 种牌码（0-8万 9-17筒 18-26条 27东 28南 29西 30北 31白 32发 33中） */
    static int tileCode(String name) {
        if (name == null || name.length() == 0) return -1;
        try {
            if (name.endsWith("w")) return Integer.parseInt(name.substring(0, name.length() - 1)) - 1;
            if (name.endsWith("to")) return 8 + Integer.parseInt(name.substring(0, name.length() - 2));
            if (name.endsWith("ti")) return 17 + Integer.parseInt(name.substring(0, name.length() - 2));
        } catch (Throwable ig) { }
        switch (name) {
            case "dong": return 27;
            case "nan": return 28;
            case "xi": return 29;
            case "bei": return 30;
            case "bai": return 31;
            case "fa": return 32;
            case "zhong": return 33;
            default: return -1;
        }
    }

    // ==================== 点牌（无障碍） ====================

    /**
     * 从认牌结果里找出「建议打出的那张牌」，把它的坐标换成**屏幕**坐标存进 tapX/tapY。
     *
     * 为什么要换：认牌服务回的是「发过去那张图」上的像素坐标（已 unproject 回原图）；
     *   图是缩到 720 宽后发的，屏幕是 sw×sh，所以要按比例放大回去。
     * 找不到就置 -1 —— 宁可这颗钮不出现，也不拿 0,0 去点（那是左上角，会乱点）。
     */
    private void pickTarget(JSONObject det, String targetCn) {
        tapX = -1;
        tapY = -1;
        if (targetCn == null || targetCn.length() == 0) return;
        JSONArray arr = det.optJSONArray("hand_detail");
        JSONArray sz = det.optJSONArray("size");
        if (arr == null || sz == null || sz.length() < 2) return;
        int iw = sz.optInt(0), ih = sz.optInt(1);
        if (iw <= 0 || ih <= 0 || sw <= 0 || sh <= 0) return;
        for (int i = 0; i < arr.length(); i++) {
            JSONObject d = arr.optJSONObject(i);
            if (d == null) continue;
            if (!targetCn.equals(d.optString("cn"))) continue;
            int ix = d.optInt("x", -1);
            int iy = d.optInt("y", -1);
            if (ix < 0 || iy < 0) return;
            tapX = Math.round(ix * (float) sw / iw);
            tapY = Math.round(iy * (float) sh / ih);
            return;
        }
    }

    /** 点一下建议那张牌。无障碍没开就如实说「点不动」，不假装点过 */
    private void doTap() {
        final int x = tapX, y = tapY;
        if (x < 0 || y < 0) {
            setState("这一轮没有可点的目标（得先认出牌、算法给出建议）");
            return;
        }
        if (!MjAccess.isOn()) {
            setState("点不动：无障碍没开（设置→无障碍→「麻宝AI 点牌」打开一次）");
            return;
        }
        if (MjAccess.tap(x, y)) setState("已点 (" + x + "," + y + ")");
        else setState("点不动：手势被系统拒了（切屏/录屏授权没了？）");
    }

    /**
     * 自动点牌：默认关，跟着 App 菜单里那个开关走。
     * 只有「换了一手牌」且距上次点击 ≥2.5 秒才点 —— 否则 0.9 秒一轮的循环会把同一张牌连点几十下。
     */
    private void maybeAutoTap(String key, String tn) {
        if (!getSharedPreferences("mabao", MODE_PRIVATE).getBoolean("autotap", false)) return;
        if (tn == null || tn.length() == 0 || tapX < 0) return;
        if (key.equals(lastTapKey)) return;
        long now = System.currentTimeMillis();
        if (now - lastTapAt < 2500) return;
        lastTapKey = key;
        lastTapAt = now;
        // 等 0.5 秒再点：刚抓的那帧里如果有出牌动画，让它落定，不然点在动画上
        ui.postDelayed(new Runnable() {
            @Override public void run() { doTap(); }
        }, 500);
    }

    // ==================== 悬浮窗 ====================

    private void showPanel() {
        if (panel != null) return;
        try {
            // ── 照原版 res/layout/layout_widget_floatview.xml 摆：竖排居中、50dp 球 + 结果区 ──
            //    原版结构：iv_controller(50dp) + tv_auto_result(10sp/最大40dp) + ll_semi_result(横排/最大80dp×330dp)
            LinearLayout box = new LinearLayout(this);
            box.setOrientation(LinearLayout.VERTICAL);
            box.setGravity(Gravity.CENTER);

            ivBall = new ImageView(this);
            ivBall.setImageResource(R.drawable.controller_analyzing);
            box.addView(ivBall, new LinearLayout.LayoutParams(dp(50), dp(50)));

            // 原版 tv_auto_result：10sp、浅桃圆角底、最大 40dp，默认隐藏
            tvHand = new TextView(this);
            tvHand.setTextSize(10);
            tvHand.setTextColor(0xFF5A4A3A);
            tvHand.setBackgroundResource(R.drawable.bg_gray_rounded);
            tvHand.setVisibility(View.GONE);
            tvHand.setMaxWidth(dp(40));
            tvHand.setMaxHeight(dp(40));
            box.addView(tvHand);

            // 原版 ll_semi_result：横排、浅桃圆角底
            llSemi = new LinearLayout(this);
            llSemi.setOrientation(LinearLayout.HORIZONTAL);
            llSemi.setGravity(Gravity.CENTER_VERTICAL);
            llSemi.setBackgroundResource(R.drawable.bg_gray_rounded);
            llSemi.setVisibility(View.GONE);

            LinearLayout col = new LinearLayout(this);
            col.setOrientation(LinearLayout.VERTICAL);
            col.setPadding(dp(3), dp(2), dp(3), dp(2));

            tvAdvice = new TextView(this);
            tvAdvice.setTextSize(13);
            tvAdvice.setTextColor(0xFF005E3A);
            col.addView(tvAdvice);

            tvSy = new TextView(this);
            tvSy.setTextSize(9);
            tvSy.setTextColor(0xFF8A6A4A);
            tvSy.setVisibility(View.GONE);
            col.addView(tvSy);
            llSemi.addView(col);

            // 原版那颗「收起结果」：controller_close_result
            ImageView close = new ImageView(this);
            close.setImageResource(R.drawable.controller_close_result);
            close.setPadding(dp(2), dp(2), dp(2), dp(2));
            LinearLayout.LayoutParams clp = new LinearLayout.LayoutParams(dp(16), dp(16));
            clp.leftMargin = dp(2);
            llSemi.addView(close, clp);
            close.setOnClickListener(new View.OnClickListener() {
                @Override public void onClick(View v) { hideResult(); }
            });
            box.addView(llSemi);

            // 「👆 点这张」：原版没有这颗钮（原版是把球拖到牌上自己点）；这里给一颗明确的手势钮，
            // 点它 = 用无障碍在建议那张牌的位置点一下。自动点牌开关在 App 菜单里，默认关。
            tvTap = new TextView(this);
            tvTap.setTextSize(11);
            tvTap.setTextColor(0xFFFFFFFF);
            tvTap.setPadding(dp(6), dp(3), dp(6), dp(3));
            GradientDrawable tbg = new GradientDrawable();
            tbg.setColor(0xFF2E7D32);
            tbg.setCornerRadius(dp(8));
            tvTap.setBackground(tbg);
            tvTap.setText("👆 点这张");
            tvTap.setVisibility(View.GONE);
            tvTap.setOnClickListener(new View.OnClickListener() {
                @Override public void onClick(View v) { doTap(); }
            });
            box.addView(tvTap);

            // 原版没有这一行；加它是因为「服务没起来/没认出牌」必须能在屏幕上看见（不弹框、不静默）
            tvErr = new TextView(this);
            tvErr.setTextSize(9);
            tvErr.setTextColor(0xFFB03028);
            tvErr.setMaxWidth(dp(90));
            tvErr.setVisibility(View.GONE);
            box.addView(tvErr);

            lp = new WindowManager.LayoutParams(
                    WindowManager.LayoutParams.WRAP_CONTENT, WindowManager.LayoutParams.WRAP_CONTENT,
                    Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                            ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                            : WindowManager.LayoutParams.TYPE_PHONE,
                    WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                            | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
                    PixelFormat.TRANSLUCENT);
            lp.gravity = Gravity.TOP | Gravity.START;
            lp.x = dp(8);
            lp.y = dp(60);

            // 拖动 + 点击：按住球拖动；轻点一下 = 暂停/继续（原版点球也是这个意思）
            ivBall.setOnTouchListener(new View.OnTouchListener() {
                float downX, downY;
                int startX, startY;
                boolean moved;
                @Override public boolean onTouch(View v, MotionEvent e) {
                    switch (e.getActionMasked()) {
                        case MotionEvent.ACTION_DOWN:
                            downX = e.getRawX(); downY = e.getRawY();
                            startX = lp.x; startY = lp.y;
                            moved = false;
                            return true;
                        case MotionEvent.ACTION_MOVE:
                            if (Math.abs(e.getRawX() - downX) > dp(6) || Math.abs(e.getRawY() - downY) > dp(6)) {
                                moved = true;
                            }
                            if (moved) {
                                lp.x = startX + (int) (e.getRawX() - downX);
                                lp.y = startY + (int) (e.getRawY() - downY);
                                try { wm.updateViewLayout(panel, lp); } catch (Throwable ig) { }
                            }
                            return true;
                        case MotionEvent.ACTION_UP:
                            if (!moved) togglePause();
                            return true;
                        default:
                            return false;
                    }
                }
            });

            panel = box;
            wm.addView(panel, lp);
        } catch (Throwable t) {
            Log.w(TAG, "悬浮窗加不上去（有没有给「显示在其他应用上层」）：" + t);
        }
    }

    private void setHand(final String s) {
        ui.post(new Runnable() { @Override public void run() {
            if (tvHand != null) {
                tvHand.setText(s);
                tvHand.setVisibility(s.length() == 0 ? View.GONE : View.VISIBLE);
            }
        }});
    }

    /** 主结果：原版那颗球旁边就是这一小块（球亮=有新建议，球灰=等牌） */
    private void setAdvice(final String s, final String sy) {
        ui.post(new Runnable() { @Override public void run() {
            if (tvAdvice == null) return;
            tvAdvice.setText(s);
            if (tvSy != null) {
                tvSy.setText(sy);
                tvSy.setVisibility(sy == null || sy.length() == 0 ? View.GONE : View.VISIBLE);
            }
            if (llSemi != null) llSemi.setVisibility(View.VISIBLE);
            // 有目标牌才露出「点这张」，没目标就藏着（避免一颗点了没用的假按钮，10-18 教训）
            if (tvTap != null) tvTap.setVisibility(tapX >= 0 ? View.VISIBLE : View.GONE);
            if (tvErr != null) tvErr.setVisibility(View.GONE);
            if (ivBall != null) ivBall.setImageResource(R.drawable.controller_running);
        }});
    }

    private void hideResult() {
        ui.post(new Runnable() { @Override public void run() {
            if (llSemi != null) llSemi.setVisibility(View.GONE);
            if (tvTap != null) tvTap.setVisibility(View.GONE);
        }});
    }

    private void togglePause() {
        paused = !paused;
        ui.post(new Runnable() { @Override public void run() {
            if (ivBall != null) {
                ivBall.setImageResource(paused ? R.drawable.controller_running : R.drawable.controller_analyzing);
            }
        }});
        if (paused) setState("已暂停（点球继续）");
    }

    /** 状态/报错：只在出错时占位，平常不抢结果区的位置 */
    private void setState(final String s) {
        ui.post(new Runnable() { @Override public void run() {
            if (tvErr == null) return;
            tvErr.setText(s);
            tvErr.setVisibility(s == null || s.length() == 0 ? View.GONE : View.VISIBLE);
            if (ivBall != null && tvErr.getVisibility() == View.VISIBLE) {
                ivBall.setImageResource(R.drawable.controller_analyzing);
            }
        }});
    }

    private int dp(int v) {
        return (int) TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v,
                getResources().getDisplayMetrics());
    }

    // ==================== 收尾 ====================

    private void shutdown() {
        running = false;
        paused = false;
        try { ui.removeCallbacksAndMessages(null); } catch (Throwable ig) { }
        try { if (vd != null) vd.release(); } catch (Throwable ig) { }
        vd = null;
        try { if (reader != null) reader.close(); } catch (Throwable ig) { }
        reader = null;
        try { if (mp != null) mp.stop(); } catch (Throwable ig) { }
        mp = null;
        try {
            if (panel != null) wm.removeView(panel);
        } catch (Throwable ig) { }
        panel = null;
        stopForeground(true);
        stopSelf();
    }

    @Override
    public void onDestroy() {
        shutdown();
        super.onDestroy();
    }

    // ==================== HTTP ====================

    /** plain=false 时把 body 原样当字符串发（认牌接口收的是纯 base64），json=true 时加 JSON 头 */
    private String httpPost(String url, String body, boolean json) {
        HttpURLConnection c = null;
        try {
            c = (HttpURLConnection) new URL(url).openConnection();
            c.setConnectTimeout(4000);
            c.setReadTimeout(15000);
            c.setRequestMethod("POST");
            c.setDoOutput(true);
            c.setRequestProperty("Content-Type", json ? "application/json; charset=utf-8" : "text/plain; charset=utf-8");
            OutputStream os = c.getOutputStream();
            try {
                os.write(body.getBytes("UTF-8"));
                os.flush();
            } finally {
                try { os.close(); } catch (Throwable ig) { }
            }
            int code = c.getResponseCode();
            InputStream in = code >= 400 ? c.getErrorStream() : c.getInputStream();
            if (in == null) return null;
            ByteArrayOutputStream bo = new ByteArrayOutputStream();
            byte[] buf = new byte[8192];
            int n;
            while ((n = in.read(buf)) > 0) bo.write(buf, 0, n);
            try { in.close(); } catch (Throwable ig) { }
            return new String(bo.toByteArray(), "UTF-8");
        } catch (Throwable t) {
            Log.w(TAG, "HTTP 失败 " + url + " : " + t);
            return null;
        } finally {
            if (c != null) try { c.disconnect(); } catch (Throwable ig) { }
        }
    }
}
