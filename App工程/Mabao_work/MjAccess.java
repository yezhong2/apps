package org.yezhong2.mabao;

import android.accessibilityservice.AccessibilityService;
import android.accessibilityservice.GestureDescription;
import android.content.Intent;
import android.graphics.Path;
import android.os.Build;
import android.util.Log;
import android.view.accessibility.AccessibilityEvent;

/**
 * 麻宝AI · 无障碍「点牌」（P4b 最后一块，2026-11-17）
 *
 * ## 干什么
 *   悬浮窗算出「打哪张」以后，需要真的用手指点一下那张牌。本类只提供**一个动作**：
 *   `tap(x, y)` —— 在屏幕坐标 (x,y) 点一下（60ms 的短按手势）。
 *   点哪儿由 FloatService 算（它手里有认牌服务回来的每张牌坐标），本类不自己找控件。
 *
 * ## 为什么不用「点控件」而用手势坐标
 *   麻将桌是游戏自绘画面（Unity/Cocos 之类），无障碍树上根本没有「一张牌」这种节点，
 *   找控件必然找不到。唯一可行的是按坐标点（原版同样是这个思路：截图 → 认牌 → 点位置）。
 *
 * ## 边界（如实记，别当成万能）
 *   - `canRetrieveWindowContent="false"`：本服务**读不到任何页面内容**，也不记录任何文字，
 *     只做「按坐标点一下」这一件事 —— 少一个能力就少一份被系统/别的 App 拦的理由。
 *   - Android 7.0（API 24）以下没有 dispatchGesture，`tap()` 会直接返回 false（不假装成功）。
 *   - 服务必须由主人自己在「设置 → 无障碍 → 麻宝AI 点牌」里打开一次；
 *     **App 绝不自己拉设置页**（2026-10-10 教训：拉起无障碍设置页 = 骚扰）。
 *
 * ## 失败表现
 *   - `tap()` 返回 false 且日志有「无障碍没连上」→ 主人没在系统设置里打开，或刚被系统关了
 *   - 返回 true 但游戏没反应 → 坐标不对（悬浮窗位置/分辨率变了）或游戏不吃合成手势
 */
public class MjAccess extends AccessibilityService {

    public static final String TAG = "MABAO_ACC";

    /** 连上时非空。用 volatile：横跨 UI 线程与工作线程读写 */
    private static volatile MjAccess inst;

    /** 无障碍现在是不是开着（全 App 只认这一个判断） */
    public static boolean isOn() {
        return inst != null;
    }

    @Override
    protected void onServiceConnected() {
        super.onServiceConnected();
        inst = this;
        Log.i(TAG, "无障碍已连上：可以点牌了");
    }

    @Override
    public boolean onUnbind(Intent intent) {
        inst = null;
        Log.i(TAG, "无障碍断开（被系统或主人关了）");
        return super.onUnbind(intent);
    }

    @Override
    public void onDestroy() {
        inst = null;
        super.onDestroy();
    }

    /** 本服务不关心任何事件：来什么都是空的（读不到内容也不需要读） */
    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
    }

    @Override
    public void onInterrupt() {
    }

    /**
     * 在屏幕坐标点一下。
     *
     * @return true=手势已交给系统；false=没连上 / 系统太老，调用方要如实告诉用户
     */
    public static boolean tap(int x, int y) {
        final MjAccess s = inst;
        if (s == null) {
            Log.w(TAG, "点牌失败：无障碍没连上（没在系统设置里打开？）");
            return false;
        }
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N) {
            Log.w(TAG, "点牌失败：Android 7.0 以下没有 dispatchGesture");
            return false;
        }
        try {
            Path p = new Path();
            p.moveTo(x, y);
            GestureDescription.Builder b = new GestureDescription.Builder();
            // 60ms：短按。太长会被游戏当成「按住」拖牌，太短有的引擎会丢
            b.addStroke(new GestureDescription.StrokeDescription(p, 0, 60));
            boolean ok = s.dispatchGesture(b.build(), null, null);
            Log.i(TAG, "点牌 (" + x + "," + y + ") -> " + ok);
            return ok;
        } catch (Throwable t) {
            Log.w(TAG, "点牌异常：" + t);
            return false;
        }
    }
}
