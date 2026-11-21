# ============================================================================
# 两台手机之间的「交接板」—— 不用人肉传文件（2026-11-11）
# ============================================================================
# 干什么：把文件/消息推到一个 GitHub 仓库目录（handover/），另一台手机随时能取。
# 为什么用 GitHub 而不是云函数：云函数归另一台手机维护，我这边是旧版，
# 一部署就会冲掉它的改动。GitHub 两边 token 都有，互不影响。
#
# 用法（两台手机都能用，需要装 python3）：
#   发文件：  python3 handover.py send /storage/emulated/0/脚本/xxx.md
#             落地名自动带手机前缀 → 20261113-123456-小米_xxx.md
#   盖固定件：python3 handover.py put /storage/emulated/0/脚本/小米_只我管.md
#             → 原地覆盖 handover/小米_只我管.md（不建时间戳副本）
#   看信箱：  python3 handover.py list
#   取文件：  python3 handover.py get 20261113-123456-小米_xxx.md
#   发消息：  python3 handover.py say "云函数已加 price_report，可以测了"
#
# 失败表现：
#   - 「读不到密钥」→ 检查 /storage/emulated/0/脚本/雷达密钥.json 在不在
#   - 「401」→ token 过期
#   - 「422」→ 同名文件已存在（会提示换名或加 覆盖 参数）
#
# 【返回码表】2026-11-20 加 —— 荣耀提醒：两台 handover.py 口径**不同**，
#   互相抄工装、或有人写 if rc == 2 的调度逻辑时会按错含义分支，所以各自写清楚。
#   本机（小米）：
#     0 = 成功
#     1 = 参数错 / 本地文件不存在 / 读远端失败
#     2 = 写失败（含 409 三次全撞、或「文件被别人改过 → 拒绝覆盖」）
#     3 = 固定件在线上还不存在（要用 send 建，或先确认名字对）
#         / get 到 0 字节（2026-11-20 08:4x 加，0 字节绝不算是成功）
#   荣耀那台：0 成功 / 1 写失败 / 2 拒绝覆盖 —— 2 的含义**正好相反**，别混。
# ============================================================================
import base64
import json
import os
import sys
import time
import urllib.request
from urllib.parse import quote

KEY_FILE = '/storage/emulated/0/脚本/雷达密钥.json'
REPO = 'yezhong2/studio'
DIR = 'handover'          # 仓库里的目录名


def token():
    try:
        return json.load(open(KEY_FILE, encoding='utf-8'))['github_token']
    except Exception:
        print('读不到密钥：%s' % KEY_FILE)
        sys.exit(1)


def gh(method, path, body=None):
    url = 'https://api.github.com' + path
    data = json.dumps(body).encode('utf-8') if body is not None else None
    rq = urllib.request.Request(url, data=data, method=method, headers={
        'Authorization': 'token ' + token(),
        'User-Agent': 'handover',
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(rq, timeout=40) as r:
            return json.loads(r.read().decode('utf-8', 'ignore'))
    except urllib.error.HTTPError as e:
        return {'_err': e.code, '_body': e.read().decode('utf-8', 'ignore')[:200]}


def device_tag():
    """这台手机是谁（2026-11-11 小老弟要求：两台要在信箱里认出彼此）。

    用系统属性的品牌+型号，翻成中文简称：Xiaomi → 小米、HONOR → 荣耀…
    型号保留（两台都是小米时靠型号区分）。区分不出来就退回「手机」。
    """
    try:
        import subprocess
        b = subprocess.check_output(['getprop', 'ro.product.brand']).decode('utf-8', 'ignore').strip()
        m = subprocess.check_output(['getprop', 'ro.product.model']).decode('utf-8', 'ignore').strip()
        cn = {
            'xiaomi': '小米', 'redmi': '红米', 'poco': 'POCO',
            'honor': '荣耀', 'huawei': '华为',
            'oppo': 'OPPO', 'realme': '真我', 'oneplus': '一加',
            'vivo': 'vivo', 'iqoo': 'iQOO',
            'samsung': '三星', 'meizu': '魅族', 'lenovo': '联想', 'motorola': '摩托罗拉',
        }
        name = cn.get(b.lower(), b) if b else ''
        t = (name + ' ' + m).strip()
        return t if t else '手机'
    except Exception:
        return '手机'


def dev_short():
    """品牌短名（小米 / 荣耀 / 华为…），只用在交接文件名前缀上。

    2026-11-13 加：荣耀指出两台都有 jc_tool/publish_web.py、**同名不同内容**，
    谁传给谁就是静默覆盖、还不报错。约定交接文件一律带手机前缀，
    **由 send 侧自动加**，不靠人记（人来记迟早漏）。

    失败表现：返回「手机」说明 getprop 读不到品牌 —— 不影响发文件，只是前缀不精确。
    """
    t = device_tag()
    return (t.split(' ')[0] if t else '') or '手机'


def cmd_send(path):
    if not os.path.exists(path):
        print('文件不存在：%s' % path)
        return 1
    data = open(path, 'rb').read()
    name = '%s-%s_%s' % (time.strftime('%Y%m%d-%H%M%S'), dev_short(), os.path.basename(path))
    body = {
        'message': '交接：%s（来自 %s）' % (os.path.basename(path), device_tag()),
        'content': base64.b64encode(data).decode('ascii'),
    }
    r = gh('PUT', '/repos/%s/contents/%s/%s' % (REPO, DIR, quote(name)), body)
    if isinstance(r, dict) and r.get('content'):
        print('已发出：%s（%d 字节，来自 %s）' % (name, len(data), device_tag()))
        print('另一台取：python3 handover.py get %s' % name)
        return 0
    print('发失败：', str(r)[:300])
    return 2


def cmd_put(path):
    """把本地文件**原地覆盖**到 handover/<同名>（固定路径），不建时间戳副本。

    2026-11-13 加：荣耀指出根因——`send` 只会建「时间戳-前缀_原名」的新文件，
    根本没有「覆盖固定路径」这个动作。于是 分工.md / 小米_只我管.md /
    荣耀_只我管.md / tasks.md 这四个固定件永远 get 到旧版，双方会反复挑已经
    改过的毛病（我自己 12:34 写临时脚本干了两次）。

    失败表现：
      「线上还没有这个文件」→ 名字不对，或者它本该用 send 建
      「409」→ 刚被对方改过，重跑一次即可（会重新取 sha，安全）
    """
    if not os.path.exists(path):
        print('文件不存在：%s' % path)
        return 1
    name = os.path.basename(path)
    p = '/repos/%s/contents/%s/%s' % (REPO, DIR, quote(name))
    data = open(path, 'rb').read()
    content_b64 = base64.b64encode(data).decode('ascii')
    # 2026-11-20 01:5x（荣耀 01:54 指出真因）：两台设备共用同一个仓库，
    #   GitHub contents API 的提交是**分支 head 的比较并交换（CAS）** ——
    #   **改的是不同文件也会撞**：谁先提交谁赢，后到的回 409。
    #   旧写法 GET 一次 sha 就 PUT，撞上整次写入就白丢（我 01:5x 写 tasks.md 撞过一次，
    #   手工重跑才成，当时还以为是自己改坏了）。
    #   现在：409 → 重取 sha → 重试，最多 3 次；3 次都撞仍打印「写失败」并返回非 0
    #   —— **绝不假装成功**（11-18「打印 DONE ≠ 真写成」立的规矩）。
    baseline_sha = None      # 第一次读到的 sha（2026-11-20 荣耀 02:31 加的硬闸）
    for attempt in range(3):
        cur = gh('GET', p)
        if not isinstance(cur, dict) or not cur.get('sha'):
            print('线上还没有这个文件，用 send 建，或先确认名字：%s' % name)
            return 3
        cur_sha = cur['sha']
        if baseline_sha is None:
            baseline_sha = cur_sha
        elif cur_sha != baseline_sha:
            # **这个文件本身**在两次 GET 之间被改过 —— 重试就是拿旧内容盖新内容，拒写。
            # 注意：分支被别的提交推动（sha 不变）是安全的重试场景，这里不管那种。
            print('⛔ %s 被别人改过（%s → %s），拒绝覆盖。请重读最新内容再 put。'
                  % (name, baseline_sha[:12], cur_sha[:12]))
            return 2
        r = gh('PUT', p, {'message': '覆盖固定件：%s（来自 %s）' % (name, device_tag()),
                          'content': content_b64,
                          'sha': cur_sha})
        if isinstance(r, dict) and r.get('content'):
            print('已覆盖：%s（%d 字节，commit %s）' % (name, len(data), r['commit']['sha'][:10]))
            return 0
        if isinstance(r, dict) and r.get('_err') == 409 and attempt < 2:
            print('⚠ 409 撞车（对面同时提交），重取 sha 重试 %d/2' % (attempt + 1))
            continue
        print('写失败：', str(r)[:200])
        return 2
    return 2


def cmd_say(msg, to=''):
    """发一句话。to 里填 @谁（小米/荣耀/小老弟），不填就是所有人。

    2026-11-11 小老弟要求：要能 @ 指定某一台，不然两台都回、都在猜是不是找自己。
    消息格式：[时间] [发送方] → @目标 内容

    2026-11-11 加：把字面量 \\n 转成真换行（荣耀那台踩过：say 不解释转义，
    结果信箱里看到一串「\\n\\n」，误以为是信箱坏了）。
    """
    msg = (msg or '').replace('\\n', '\n').replace('\\t', '\t')
    to = (to or '').strip().lstrip('@')
    tag = device_tag()
    at = (' → @' + to) if to else ''
    text = '[%s] [%s]%s %s' % (time.strftime('%m-%d %H:%M'), tag, at, msg)
    body = {
        'message': '交接消息（来自 %s%s）' % (tag, (' → ' + to) if to else ''),
        'content': base64.b64encode(text.encode('utf-8')).decode('ascii'),
    }
    name = 'msg-%s.txt' % time.strftime('%Y%m%d-%H%M%S')
    r = gh('PUT', '/repos/%s/contents/%s/%s' % (REPO, DIR, quote(name)), body)
    if isinstance(r, dict) and r.get('content'):
        print('消息已发出（署名：%s%s）' % (tag, ('，指定给 ' + to) if to else ''))
        return 0
    print('发失败：', str(r)[:300])
    return 2


def cmd_list():
    r = gh('GET', '/repos/%s/contents/%s' % (REPO, DIR))
    if isinstance(r, dict) and '_err' in r:
        if r['_err'] == 404:
            print('信箱还是空的（还没人发过）')
            return 0
        print('读不到：', str(r)[:200])
        return 1
    # 2026-11-18 修（小老弟：「为啥不排信箱最上面让老子能看到」）：
    #   原来按**文件名**倒序，而『msg-…』的 m 比『2026…』的 2 大，
    #   所以所有消息永远压在文件上面，刚发出去的文件被挤到第 20 条之后，
    #   在 `list` 里根本看不到（他当时就找不到我发的那份）。
    #   现在统一按**文件名里的时间戳**排：msg-YYYYMMDD-HHMMSS 和 YYYYMMDD-HHMMSS
    #   抽成同一个 key，谁新谁在上面。
    def _tkey(x):
        n = x.get('name') or ''
        if n.startswith('msg-'):
            n = n[4:]
        head = n[:15]          # YYYYMMDD-HHMMSS
        # 只有「带时间戳」的才是新内容（消息/发出的文件），这些必须排最上面。
        # 固定件（荣耀_只我管.md / tasks.md / 分工.md 这类名字固定的）沉到底部 ——
        # 它们是长期存档，不该压住刚发的东西（上一版就是中文名比数字大，
        # 固定件反而全排前面，我发的那份还是看不到）。
        if (len(head) == 15 and head[:8].isdigit()
                and head[8] == '-' and head[9:].isdigit()):
            return (1, head)
        return (0, n)

    rows = sorted(r, key=_tkey, reverse=True)
    if not rows:
        print('信箱是空的')
        return 0
    print('信箱里最近 %d 个（新的在上面）：' % len(rows))
    for x in rows[:30]:
        k = _tkey(x)
        when = k[1][:11].replace('-', ' ') if k[0] else '固定件'
        print('  %-46s %5d 字节  %s' % (x['name'], x.get('size') or 0, when))
    print()
    print('取哪个：python3 handover.py get <名字>')
    return 0


def _get_blob(sha):
    """按 blob sha 把文件内容取回来（base64 内联，上限 100MB）。

    2026-11-22 01:0x（真机踩到）加的兜底：contents API 对大文件只给 download_url，
    而 download_url 指向 raw.githubusercontent.com —— 这台机上实测被
    **Connection reset by peer**（荣耀发来的 7,858,309 字节 bundle 连拉两次都失败）。
    走 api.github.com 的 git/blobs 接口取同一份内容，不碰 raw 域名。
    失败表现：返回 None（调用方按失败处理，绝不落地 0 字节）。
    """
    if not sha:
        print('拿不到 blob sha，兜底也没法用')
        return None
    r = gh('GET', '/repos/%s/git/blobs/%s' % (REPO, sha))
    if isinstance(r, dict) and '_err' in r:
        print('blobs API 也失败：', str(r)[:200])
        return None
    try:
        data = base64.b64decode(r['content'])
    except Exception as e:
        print('blobs 解码失败：', e)
        return None
    print('（改走 git blobs API，%d 字节）' % len(data))
    return data


def cmd_get(name):
    r = gh('GET', '/repos/%s/contents/%s/%s' % (REPO, DIR, quote(name)))
    if isinstance(r, dict) and '_err' in r:
        print('取不到：', str(r)[:200])
        return 1
    # 2026-11-20 07:1x 修（真机踩到）：**GitHub contents API 对大于 1MB 的文件不返回 content**，
    # 只给一个 download_url。原来这里直接 base64.b64decode(r['content']) —— content 是空串，
    # 解出来就是 b''，于是文件落地 **0 字节，而且不报错**（print 那句只在异常时触发）。
    # 实测：荣耀发的 1,555,711 字节的 whisper .so zip，连续 get 两次都是 0 字节。
    # 现在：content 为空就走 download_url 直接拉字节流。
    if not r.get('content'):
        dl = r.get('download_url')
        if not dl:
            print('取不到内容：GitHub 没给 content 也没给 download_url（文件可能 >100MB）')
            return 1
        try:
            import urllib.request
            # download_url 里的中文文件名是**没编码**的（GitHub 原样返回），
            # urllib 拼请求行时按 ascii 编，直接报 "can't encode characters in position 53-54"。
            # 这里只保留 URL 结构字符，其余（含中文）全部百分号编码。
            from urllib.parse import quote as _q
            dl_safe = _q(dl, safe=':/?&=%#')
            req = urllib.request.Request(dl_safe, headers={'User-Agent': 'handover'})
            with urllib.request.urlopen(req, timeout=180) as resp:
                data = resp.read()
            print('（大文件走 download_url，%d 字节）' % len(data))
        except Exception as e:
            print('下载失败：', e)
            # 2026-11-22 01:0x：raw.githubusercontent 这条在这台机上会被 reset，
            # 改用 git blobs API 兜底（同一个文件、同一条 api.github.com 链路）。
            data = _get_blob(r.get('sha'))
            if data is None:
                return 2
    else:
        try:
            data = base64.b64decode(r['content'])
        except Exception as e:
            print('解码失败：', e)
            return 2
    # 2026-11-20 08:4x（荣耀 08:40 报的同族 bug）：**0 字节不能当成功**。
    #   GitHub contents API 对大文件不给 content，旧代码 b64decode('') 得 b''，
    #   落地 0 字节还打印「已取到」——对方会拿空文件继续干活。
    #   这里在写盘前拦一道，返回 3（和 put 的「线上还没有」同一段码，都是「东西不在这」）。
    if not data:
        print('取到 0 字节，按失败处理（GitHub 没给 content 或下载被截断）：%s' % name)
        return 3
    out = os.path.join('/storage/emulated/0/脚本', name)
    open(out, 'wb').write(data)
    if name.endswith('.txt') or name.endswith('.md'):
        print('已取到：%s（%d 字节）' % (out, len(data)))
        print('---')
        try:
            print(data.decode('utf-8')[:2000])
        except Exception:
            pass
    else:
        print('已取到：%s（%d 字节）' % (out, len(data)))
    return 0


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return 1
    cmd = sys.argv[1]
    if cmd == 'send' and len(sys.argv) > 2:
        return cmd_send(sys.argv[2])
    if cmd == 'put' and len(sys.argv) > 2:
        return cmd_put(sys.argv[2])
    if cmd == 'say' and len(sys.argv) > 2:
        # 用法：say "内容"            发给所有人
        #       say "内容" 小米       只给小米（也接受 @小米）
        to = sys.argv[3] if len(sys.argv) > 3 else ''
        return cmd_say(' '.join(sys.argv[2:3]) if len(sys.argv) > 3 else ' '.join(sys.argv[2:]), to)
    if cmd == 'list':
        return cmd_list()
    if cmd == 'get' and len(sys.argv) > 2:
        return cmd_get(sys.argv[2])
    print(__doc__)
    return 1


if __name__ == '__main__':
    sys.exit(main())
