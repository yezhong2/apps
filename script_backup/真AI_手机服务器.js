// 真AI_手机服务器.js — 把手机当 AI 服务器（CommonJS，Termux node 直跑）
// 产品页 → 本机 127.0.0.1:8787 → GLM（密钥只在本机文件中读取，绝不出手机）
// 启动：node /storage/emulated/0/脚本/真AI_手机服务器.js
// 只监听 127.0.0.1（本机浏览器可用）；要对外服务需另配隧道（cloudflared 等）
const http = require('http');
const fs = require('fs');

const KEY_FILE = '/storage/emulated/0/脚本/雷达密钥.json';
const PORT = 8787;
const DAILY_CAP = 100; // 全局日上限（与 IP 数无关的先关门）

const TASKS = {
  story:    '你是故事开发助手。根据用户给的关键词，用英文写一份完整故事大纲：Setting / Main Character / Plot / Central Conflict / Themes，200-300 词。',
  plot:     '你是故事顾问。针对用户给的情节点，给出 3 条具体的剧情走向建议，英文，150-250 词。',
  refine:   '你是文字编辑。把用户给的英文文本润色得更通顺、更清晰（语法、流畅度），保持原意，只输出润色后的文本。',
  conflict: '你是编剧。用英文写一个原创的故事冲突（障碍/转折），80-150 词。',
  dialogue: '你是对白教练。把用户给的英文对白改写得更自然、有潜台词和节奏感，保持角色口吻，只输出改写后的对白。'
};

let keys = [];
try { keys = JSON.parse(fs.readFileSync(KEY_FILE, 'utf8')).zp_keys || []; } catch (e) {}
if (!keys.length) { console.error('没有可用密钥：' + KEY_FILE); process.exit(1); }

// 每 IP 3 次/分、10 次/天 + 全局日上限
const PER_IP_MIN = 3, PER_IP_DAY = 10;
const rl = new Map();
const globalCounter = { day: 0, dayStart: Date.now() };
function limited(ip) {
  const now = Date.now();
  const rec = rl.get(ip) || { min: [], day: 0, dayStart: now };
  if (now - rec.dayStart > 86400000) { rec.day = 0; rec.dayStart = now; }
  rec.min = rec.min.filter(t => now - t < 60000);
  if (rec.min.length >= PER_IP_MIN || rec.day >= PER_IP_DAY) { rl.set(ip, rec); return true; }
  rec.min.push(now);
  rec.day++;
  rl.set(ip, rec);
  if (rl.size > 2000) rl.clear();
  return false;
}
function globalLimited() {
  const now = Date.now();
  if (now - globalCounter.dayStart > 86400000) { globalCounter.day = 0; globalCounter.dayStart = now; }
  if (globalCounter.day >= DAILY_CAP) return true;
  globalCounter.day++;
  return false;
}

// 多钥匙轮换：某把失败（限流/超时）自动换下一把，最多 3 把
async function askGLM(task, input) {
  let lastErr = 'unknown';
  for (let i = 0; i < keys.length; i++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    try {
      const r = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + keys[i], 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'glm-4-flash', temperature: 0.8, max_tokens: 700,
          messages: [{ role: 'system', content: TASKS[task] }, { role: 'user', content: input }]
        }),
        signal: controller.signal
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) {
        return { result: String(j.choices[0].message.content).trim() };
      }
      lastErr = (j && j.error && (j.error.message || j.error.code)) || ('HTTP ' + r.status);
    } catch (e) {
      lastErr = 'timeout or network error';
    } finally { clearTimeout(timer); }
  }
  return { error: 'model error: ' + lastErr };
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json; charset=utf-8'
};
const server = http.createServer((req, res) => {
  const reply = (code, obj) => { res.writeHead(code, CORS); res.end(JSON.stringify(obj)); };
  if (req.method === 'OPTIONS') { res.writeHead(204, CORS); res.end(); return; }
  if (req.method === 'GET') { reply(200, { ok: true, service: 'phone-ai', tasks: Object.keys(TASKS), cap: DAILY_CAP, used: globalCounter.day }); return; }
  if (req.method !== 'POST') { reply(405, { error: 'method not allowed' }); return; }
  const ip = req.socket.remoteAddress || 'local';
  if (limited(ip)) { reply(429, { error: 'rate limited, try again later' }); return; }
  if (globalLimited()) { reply(429, { error: 'daily quota reached, try again tomorrow' }); return; }
  let body = '';
  req.on('data', c => { body += c; if (body.length > 100000) req.destroy(); });
  req.on('end', async () => {
    let parsed;
    try { parsed = JSON.parse(body); } catch (e) { reply(400, { error: 'bad json' }); return; }
    const task = parsed && parsed.task;
    const input = parsed && typeof parsed.input === 'string' ? parsed.input : '';
    if (!TASKS[task]) { reply(400, { error: 'unknown task' }); return; }
    if (!input || input.length > 1500) { reply(400, { error: 'input must be 1-1500 chars' }); return; }
    const out = await askGLM(task, input);
    console.log(new Date().toLocaleTimeString() + ' ' + task + ' → ' + (out.result ? 'OK(' + out.result.length + ' chars)' : out.error));
    reply(out.result ? 200 : 502, out);
  });
});
server.listen(PORT, '127.0.0.1', () => {
  console.log('✅ 真AI 手机服务器已启动：http://127.0.0.1:' + PORT + ' （密钥只在本机文件中读取）');
});
