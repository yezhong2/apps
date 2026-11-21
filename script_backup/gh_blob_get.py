# 从 GitHub 取 handover/ 里的大文件（>1MB 时 handover.py 走 download_url = raw.githubusercontent，
# 这台机器上会被 reset）。改走 git blobs API：base64 内联，不碰 raw 域名，上限 100MB。
# 用法：python3 tmp/gh_blob_get.py "20261122-005937-荣耀_huahuar_master_0153.bundle"
import base64, json, os, sys, urllib.error, urllib.parse, urllib.request

KEY_FILE = '/storage/emulated/0/脚本/雷达密钥.json'
REPO = 'yezhong2/studio'
DIR = 'handover'
TOKEN = json.load(open(KEY_FILE, encoding='utf-8'))['github_token']


def gh(url):
    rq = urllib.request.Request(url, headers={
        'Authorization': 'token ' + TOKEN,
        'User-Agent': 'blobget',
        'Accept': 'application/vnd.github+json'})
    try:
        with urllib.request.urlopen(rq, timeout=120) as r:
            return json.loads(r.read().decode('utf-8', 'ignore'))
    except urllib.error.HTTPError as e:
        return {'_err': e.code, '_body': e.read().decode('utf-8', 'ignore')[:300]}


name = sys.argv[1]
meta = gh('https://api.github.com/repos/%s/contents/%s/%s' % (REPO, DIR, urllib.parse.quote(name)))
if isinstance(meta, dict) and '_err' in meta:
    print('取元数据失败：', str(meta)[:200])
    raise SystemExit(1)
sha = meta['sha']
size = meta['size']
print('线上: %s  %d 字节  blob=%s' % (name, size, sha[:12]))

blob = gh('https://api.github.com/repos/%s/git/blobs/%s' % (REPO, sha))
if isinstance(blob, dict) and '_err' in blob:
    print('取 blob 失败：', str(blob)[:200])
    raise SystemExit(2)
data = base64.b64decode(blob['content'])
print('解出: %d 字节  encoding=%s' % (len(data), blob.get('encoding')))
if len(data) != size:
    print('⚠ 大小不一致，按失败处理')
    raise SystemExit(3)

out = os.path.join('/storage/emulated/0/脚本', name)
with open(out, 'wb') as f:
    f.write(data)
print('已写: %s' % out)
os.system('ls -la "%s"' % out)
