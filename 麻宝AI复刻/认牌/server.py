#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
麻宝AI 复刻·认牌服务（P3，2026-11-17）

干什么：手机浏览器打开 http://127.0.0.1:19201/ ，选一张对局截图 → 用**原包的认牌模型**
  `5s_640.ptl`（YOLOv5s torchscript，62 类）识别出「自己手牌 13 张」和「屏幕上的按钮/其他牌」，
  页面直接显示手牌和标注图。

与「原版」的差异（必须写明，不许假装一样）：
  ① 原版 Java 层被 360 加固拿不到，所以截屏、悬浮窗、自动点牌都没有复刻；本服务只做「图 → 识别结果」。
  ② 原版走 libpytorch_jni_lite.so + org.pytorch；这里走 Python 的 torch.jit（同一个 .ptl 权重，一字未改）。
  ③ 后处理是自己写的：模型 forward 只输出 1x25200x66（xywh + 62 类分数，已 sigmoid），NMS 要自己做。
     实测同一张牌会被检成「整张」和「上半截」两框（IoU 只有 0.25），所以用 IoU+IoA 双判据，
     再按 x 聚类去重 —— 这是几何后处理，不改模型的任何判断。

为什么输入只能用 640x640：Detect 模块里的 grid 常量在 trace 时被固化成 80x80/40x40/20x20，
  喂 960 会直接抛 "size of tensor a (120) must match the size of tensor b (80)"。试过，不行。

怎么起：proot-distro login ubuntu2004 -- python3 /storage/emulated/0/脚本/麻宝AI复刻/认牌/server.py
  （或用同目录 start.sh，setsid 常驻，ccode 会话被重开也不死）

失败表现：
  - ImportError: No module named 'torch' → 没在容器里跑，或容器里的 torch 被删了
  - 页面一直转圈 → 看日志；推理约 1.2 秒，超过 10 秒说明进程被系统冻结（切前台一下）
  - 手牌数量不是 13 → 见 CONF/IOA 两个阈值；std 截图 2388x1080 下 0.9/0.5 实测稳定 13 张
"""
import base64
import io
import json
import os
import sys
import time
from http.server import BaseHTTPRequestHandler, HTTPServer

import numpy as np
import torch
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import test_detect as td  # noqa: E402

PORT = int(os.environ.get('RENPAI_PORT', '19201'))
CONF_THRES = float(os.environ.get('CONF', '0.9'))
IOA_THRES = float(os.environ.get('IOA', '0.5'))

DECK = set()
for _r in range(1, 10):
    DECK.update(['%dto' % _r, '%dti' % _r, '%dw' % _r])

# 牌名转中文（原包 classes.txt 用拼音缩写；这里给页面显示用，不影响识别）
CN = {}
for _r in range(1, 10):
    CN['%dw' % _r] = '%d万' % _r
    CN['%dto' % _r] = '%d筒' % _r
    CN['%dti' % _r] = '%d条' % _r
for _k, _v in {'dong': '东', 'nan': '南', 'xi': '西', 'bei': '北', 'zhong': '中',
               'fa': '发', 'bai': '白', 'hu': '胡', 'peng': '碰', 'gang': '杠',
               'chi': '吃', 'guo': '过', 'zimo': '自摸', 'ting': '听', 'done': '完成',
               'back': '返回', 'cancel': '取消', 'close': '关闭', 'confirm': '确定',
               'continue': '继续', 'change': '换', 'dealer': '庄', 'remain': '剩余',
               'laizi': '赖子', 'hua': '花', 'ming': '明', 'piao': '飘', 'qiao': '敲',
               'liang': '亮', 'lv': '绿', 'niu': '牛', 'tong': '筒', 'tiao': '条', 'wan': '万'}.items():
    CN[_k] = _v


def nms_ioa(boxes, scores, iou_thres, ioa_thres):
    """
    IoU 或 IoA 任一超阈即压制。
    IoA = 交集 / 较小框面积 —— 专治「整张牌」和「牌的上半截」这种大小不一致的重复检出
    （它们的 IoU 只有 0.25，纯 IoU 的 NMS 压不住，会一张牌报两个框）。
    """
    order = scores.argsort()[::-1]
    keep = []
    while order.size > 0:
        i = order[0]
        keep.append(int(i))
        if order.size == 1:
            break
        rest = order[1:]
        xx1 = np.maximum(boxes[i, 0], boxes[rest, 0])
        yy1 = np.maximum(boxes[i, 1], boxes[rest, 1])
        xx2 = np.minimum(boxes[i, 2], boxes[rest, 2])
        yy2 = np.minimum(boxes[i, 3], boxes[rest, 3])
        inter = np.maximum(0.0, xx2 - xx1) * np.maximum(0.0, yy2 - yy1)
        ai = (boxes[i, 2] - boxes[i, 0]) * (boxes[i, 3] - boxes[i, 1])
        ar = (boxes[rest, 2] - boxes[rest, 0]) * (boxes[rest, 3] - boxes[rest, 1])
        iou = inter / np.maximum(ai + ar - inter, 1e-9)
        ioa = inter / np.maximum(np.minimum(ai, ar), 1e-9)
        order = rest[(iou <= iou_thres) & (ioa <= ioa_thres)]
    return keep


def detect_ioa(pred, names):
    """按类分组 + IoU/IoA 双判据 NMS，返回 [{cls,name,conf,box}]（坐标在 640 尺度）"""
    p = pred[0].cpu().numpy()
    scores_all = p[:, 4:]
    cls_ids = scores_all.argmax(1)
    scores = scores_all[np.arange(len(cls_ids)), cls_ids]
    mask = scores > CONF_THRES
    b = p[mask][:, :4]
    s = scores[mask]
    c = cls_ids[mask]
    if len(s) == 0:
        return []
    boxes = np.stack([b[:, 0] - b[:, 2] / 2, b[:, 1] - b[:, 3] / 2,
                      b[:, 0] + b[:, 2] / 2, b[:, 1] + b[:, 3] / 2], 1)
    out = []
    for cid in np.unique(c):
        idx = np.where(c == cid)[0]
        for k in nms_ioa(boxes[idx], s[idx], 0.45, IOA_THRES):
            j = idx[k]
            out.append({'cls': int(c[j]), 'name': names[int(c[j])], 'conf': float(s[j]),
                        'box': [float(v) for v in boxes[j]]})
    out.sort(key=lambda d: -d['conf'])
    return out


def filter_by_size(dets, lo=0.55, hi=1.8):
    """
    去掉「碎片框」：模型对同一位置会输出一些只有大半个牌大的框（实测宽度 20~47px，
    而完整牌宽约 105px、高约 172px）。碎片框宽度/高度中只要有一个不到中位数的一半就丢。
    依据是物理约束：一张牌被看见就是整张，碎片不可能是「另一张牌」。
    """
    if len(dets) < 3:
        return dets
    ws = sorted(d['box'][2] - d['box'][0] for d in dets)
    hs = sorted(d['box'][3] - d['box'][1] for d in dets)
    mw, mh = ws[len(ws) // 2], hs[len(hs) // 2]
    keep = []
    for d in dets:
        w = d['box'][2] - d['box'][0]
        h = d['box'][3] - d['box'][1]
        if w < mw * lo or h < mh * lo or w > mw * hi or h > mh * hi:
            continue
        keep.append(d)
    return keep or dets


def cluster_by_x(dets, frac=0.55):
    """
    同一排里按 x 聚类去重：相邻 x 中心差 < 0.55 个中位牌宽 → 认为是同一张牌，留置信度高的。
    依据是物理约束（一张牌在屏幕上只占一个位置，不可能并排两份），不是调出来的魔法数字。
    """
    if not dets:
        return []
    med_w = float(np.median([d['box'][2] - d['box'][0] for d in dets]))
    dets = sorted(dets, key=lambda d: (d['box'][0] + d['box'][2]) / 2)
    out = []
    group = [dets[0]]
    for d in dets[1:]:
        cx_prev = (group[-1]['box'][0] + group[-1]['box'][2]) / 2
        cx = (d['box'][0] + d['box'][2]) / 2
        if cx - cx_prev < med_w * frac:
            group.append(d)
        else:
            out.append(max(group, key=lambda z: z['conf']))
            group = [d]
    out.append(max(group, key=lambda z: z['conf']))
    return out


def pick_hand_row(dets):
    """
    从整图检出里挑出「自己手牌那一排」。

    为什么不写死高度阈值：原来是 `y中心 > 0.78*图高`，只在「横屏整屏对局图」上成立。
    2026-11-17 主人用微信发来一张竖版比例的对局图（1706x1279，手牌在 0.66 图高），
    那条阈值把整整 10 张手牌全挡在外面，页面只报「自己手牌 1 张」。
    改按物理约束找：自己的手牌是**最下面那一条等高、成排**的牌排。
      ① 先按 y 中心分行（容差 0.6 个中位牌高，一行的牌高度相近）
      ② 行内按 x 去重（cluster_by_x）＋丢碎片框（filter_by_size）
      ③ 取「去重后张数最多」的那一行；张数并列时取更靠下的（自己的手牌在最下面）
    这样整屏横图（sc01：手牌 0.89 图高）和竖版图（0.66 图高）都能选对。
    失败表现：如果一副牌局里别的牌排（弃牌堆）比手牌还长，会选错行——那时要在行打分里加权重。
    """
    deck = [d for d in dets if d['name'] in DECK]
    if not deck:
        return []
    hs = sorted(d['box'][3] - d['box'][1] for d in deck)
    mh = hs[len(hs) // 2]
    deck.sort(key=lambda d: (d['box'][1] + d['box'][3]) / 2)
    rows, cur = [], [deck[0]]
    for d in deck[1:]:
        yc_prev = sum((z['box'][1] + z['box'][3]) / 2 for z in cur) / len(cur)
        yc = (d['box'][1] + d['box'][3]) / 2
        if yc - yc_prev < mh * 0.6:
            cur.append(d)
        else:
            rows.append(cur)
            cur = [d]
    rows.append(cur)

    best, best_key = [], None
    for r in rows:
        rr = cluster_by_x(filter_by_size(r))
        yc = sum((z['box'][1] + z['box'][3]) / 2 for z in r) / len(r)
        # 先比张数，再比「更靠下」（yc 大的赢）——用 sort key 让 tie-break 显式化
        key = (len(rr), yc)
        if best_key is None or key > best_key:
            best, best_key = rr, key
    best.sort(key=lambda d: (d['box'][0] + d['box'][2]) / 2)
    return best


_names = td.load_classes()
_model = None


def get_model():
    """惰性加载：首次请求才载入（省内存），之后常驻"""
    global _model
    if _model is None:
        _model = torch.jit.load(td.MODEL_PATH, map_location='cpu')
        _model.eval()
        torch.set_num_threads(4)
    return _model


def analyze(im):
    """核心：图 -> (结果 dict, 标注图 PIL)"""
    model = get_model()
    td.LETTERBOX = True
    w, h = im.size
    im640, rxry, pad = td.preprocess(im, 640)
    t0 = time.time()
    with torch.no_grad():
        out = model(td.to_tensor(im640))
    pred = out[0] if isinstance(out, (tuple, list)) else out

    dets = detect_ioa(pred, _names)
    dets = td.unproject(dets, rxry, pad, im.size)

    hand = pick_hand_row(dets)

    keep = set(id(x) for x in hand)
    others = {}
    for d in dets:
        if id(d) not in keep:
            others[d['name']] = others.get(d['name'], 0) + 1

    vis = im.copy()
    dr = ImageDraw.Draw(vis)
    for d in dets:
        b = d['box']
        if id(d) in keep:
            dr.rectangle(b, outline=(0, 255, 0), width=5)
            dr.text((b[0] + 6, b[1] + 4), d['name'], fill=(255, 255, 0))
        else:
            dr.rectangle(b, outline=(0, 140, 255), width=2)

    res = {
        'size': [w, h],
        'infer_s': round(time.time() - t0, 2),
        'hand_count': len(hand),
        'hand': [d['name'] for d in hand],
        'hand_cn': [CN.get(d['name'], d['name']) for d in hand],
        'hand_detail': [{'name': d['name'], 'cn': CN.get(d['name'], d['name']),
                         'conf': round(d['conf'], 3),
                         'x': round((d['box'][0] + d['box'][2]) / 2),
                         'y': round((d['box'][1] + d['box'][3]) / 2),
                         'box': [round(v) for v in d['box']]} for d in hand],
        'other_det': dict(sorted(others.items(), key=lambda kv: -kv[1])),
        'conf_thres': CONF_THRES,
        'ioa_thres': IOA_THRES,
    }
    return res, vis


PAGE = """<!doctype html><html lang="zh"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>麻宝AI 认牌</title>
<style>
 body{font-family:system-ui,-apple-system,sans-serif;margin:0;padding:14px;background:#12211a;color:#e8f5ee}
 h1{font-size:19px;margin:0 0 12px}
 .card{background:#1b3128;border-radius:12px;padding:14px;margin-bottom:12px}
 button{background:#37c07a;color:#06150e;border:0;border-radius:9px;padding:12px 18px;font-size:16px;font-weight:600}
 input[type=file]{display:none}
 .tile{display:inline-block;background:#fff;color:#111;border-radius:7px;padding:9px 11px;margin:3px;font-size:19px;font-weight:700}
 .tile.g{background:#d6ffe8}
 .dim{color:#8fb3a2;font-size:13px}
 img{max-width:100%;border-radius:9px;margin-top:10px}
 .warn{color:#ffd166;font-size:13px}
</style></head><body>
<h1>麻宝AI 认牌 · 截图识别</h1>
<div class="card">
  <input id="f" type="file" accept="image/*">
  <button onclick="document.getElementById('f').click()">选截图 / 拍照</button>
  <div class="dim" id="st" style="margin-top:8px">选一张对局截图（横屏整屏最好）</div>
</div>
<div class="card" id="res" style="display:none">
  <div><b>自己手牌 <span id="n"></span> 张</b> <span class="dim" id="cost"></span></div>
  <div id="tiles" style="margin-top:8px"></div>
  <div class="dim" id="other" style="margin-top:10px"></div>
</div>
<div class="card" id="visw" style="display:none"><div class="dim">绿框=手牌　蓝框=其他检出</div><img id="vis"></div>
<script>
document.getElementById('f').onchange = async e => {
  const file = e.target.files[0]; if(!file) return;
  const st = document.getElementById('st'); st.textContent = '读取图片…';
  const img = new Image();
  img.src = URL.createObjectURL(file);
  await img.decode();
  // 缩到长边 2400 以内再上传（原图 1.5MB，base64 后 2MB，没必要传更大）
  const max = 2400, sc = Math.min(1, max / Math.max(img.width, img.height));
  const cv = document.createElement('canvas');
  cv.width = Math.round(img.width * sc); cv.height = Math.round(img.height * sc);
  cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
  const b64 = cv.toDataURL('image/jpeg', 0.92);
  st.textContent = '识别中…（约 1-2 秒）';
  const r = await fetch('/detect', {method:'POST', body: b64});
  const j = await r.json();
  if (j.error) { st.textContent = '出错：' + j.error; return; }
  st.textContent = '完成，图片 ' + j.size[0] + 'x' + j.size[1];
  document.getElementById('res').style.display = 'block';
  document.getElementById('visw').style.display = 'block';
  document.getElementById('n').textContent = j.hand_count;
  document.getElementById('cost').textContent = '推理 ' + j.infer_s + 's';
  document.getElementById('tiles').innerHTML = j.hand_detail.map(
    d => '<span class="tile g" title="' + d.name + ' ' + d.conf + '">' + d.cn + '</span>').join('');
  const o = Object.entries(j.other_det);
  document.getElementById('other').textContent = o.length ?
    '其他检出（按钮/他家牌）：' + o.slice(0, 18).map(([k,v]) => k + '×' + v).join('　') : '没有其他检出';
  document.getElementById('vis').src = 'data:image/jpeg;base64,' + j.vis;
};
</script></body></html>"""


class H(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        sys.stderr.write('[%s] %s\n' % (time.strftime('%F %T'), fmt % args))

    def _send(self, code, ctype, body):
        self.send_response(code)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path in ('/', '/index.html'):
            self._send(200, 'text/html; charset=utf-8', PAGE.encode('utf-8'))
        elif self.path == '/health':
            self._send(200, 'application/json', json.dumps(
                {'ok': True, 'model': '5s_640.ptl', 'classes': len(_names),
                 'loaded': _model is not None, 'conf': CONF_THRES, 'ioa': IOA_THRES}).encode())
        else:
            self._send(404, 'text/plain', b'not found')

    def do_POST(self):
        if self.path != '/detect':
            self._send(404, 'text/plain', b'not found')
            return
        try:
            n = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(n).decode('ascii', 'replace')
            if ',' in body and body.startswith('data:'):
                body = body.split(',', 1)[1]
            raw = base64.b64decode(body)
            im = Image.open(io.BytesIO(raw)).convert('RGB')
            res, vis = analyze(im)
            buf = io.BytesIO()
            vis.save(buf, 'JPEG', quality=85)
            res['vis'] = base64.b64encode(buf.getvalue()).decode()
            self._send(200, 'application/json; charset=utf-8', json.dumps(res, ensure_ascii=False).encode())
        except Exception as e:
            import traceback
            traceback.print_exc()
            self._send(500, 'application/json; charset=utf-8',
                       json.dumps({'error': '%s: %s' % (type(e).__name__, e)}, ensure_ascii=False).encode())


if __name__ == '__main__':
    print('认牌服务 %d  模型 %s  类别 %d' % (PORT, td.MODEL_PATH, len(_names)))
    get_model()  # 启动即加载，避免第一个请求等太久（也让启动失败立刻暴露）
    HTTPServer(('127.0.0.1', PORT), H).serve_forever()
