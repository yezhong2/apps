// ai_backend_worker.mjs — AI 后端（Cloudflare Worker）：给灵感雷达产品页提供真实 AI 能力
// 部署：dash.cloudflare.com → Workers & Pages → Create → Worker → 粘贴本文件 → 设置环境变量 GLM_KEY → Deploy
// 端点约定：POST /  body:{task, input} → {result} 或 {error}；GET / 返回健康检查
// 已内置：CORS、输入校验、限流（尽力而为的内存版）、30 秒超时、错误如实返回；密钥只存在云端环境变量，永不进页面。
const GLM_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';

const TASKS = {
  story:    '你是故事开发助手。根据用户给的关键词，用英文写一份完整故事大纲：Setting / Main Character / Plot / Central Conflict / Themes，200-300 词。',
  plot:     '你是故事顾问。针对用户给的情节点，给出 3 条具体的剧情走向建议，英文，150-250 词。',
  refine:   '你是文字编辑。把用户给的英文文本润色得更通顺、更清晰（语法、流畅度），保持原意，只输出润色后的文本。',
  conflict: '你是编剧。用英文写一个原创的故事冲突（障碍/转折），80-150 词。',
  dialogue: '你是对白教练。把用户给的英文对白改写得更自然、有潜台词和节奏感，保持角色口吻，只输出改写后的对白。'
};

// ===== 三层限额（核心设计：密钥是账号主人的，绝不能被陌生人免费无上限蹭）=====
// ① 每 IP：3 次/分、10 次/天（单个人薅不动；10 次 ≈ 把 5 个功能各试两遍）
// ② 全局日上限：默认 100 次/天（env.DAILY_CAP 可改；不管来多少 IP，总次数先被此闸卡死）
// ③ 一键关停：删掉 GLM_KEY 密钥或停用本 Worker → 全部产品立刻显示「AI 未接通」（真诚态，不演假结果）
// 单次成本上限：输入≤1500 字符 + 输出≤700 token ≈ 单次最多约 2000 token。
// 计数器为内存版（每实例独立、重启清零），标注流量下够用；要 100% 不失手的严格版可升级 KV（多 2 分钟配置）。
const PER_IP_MIN = 3, PER_IP_DAY = 10;
const globalCounter = { day: 0, dayStart: Date.now() };
function globalLimited(cap) {
  const now = Date.now();
  if (now - globalCounter.dayStart > 86400000) { globalCounter.day = 0; globalCounter.dayStart = now; }
  if (globalCounter.day >= cap) return true;
  globalCounter.day++;
  return false;
}
const rl = new Map();
function limited(ip) {
  const now = Date.now();
  const rec = rl.get(ip) || { min: [], day: 0, dayStart: now };
  if (now - rec.dayStart > 86400000) { rec.day = 0; rec.dayStart = now; }
  rec.min = rec.min.filter(t => now - t < 60000);
  if (rec.min.length >= PER_IP_MIN || rec.day >= PER_IP_DAY) { rl.set(ip, rec); return true; }
  rec.min.push(now);
  rec.day++;
  rl.set(ip, rec);
  if (rl.size > 2000) rl.clear(); // 防内存无限增长
  return false;
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};
function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, CORS)
  });
}

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    const url = new URL(req.url);
    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/health')) {
      return json({ ok: true, service: 'inspiration-radar-ai', tasks: Object.keys(TASKS) });
    }
    if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

    const ip = req.headers.get('CF-Connecting-IP') || 'unknown';
    const dailyCap = Number(env.DAILY_CAP) > 0 ? Number(env.DAILY_CAP) : 100;
    if (limited(ip)) return json({ error: 'rate limited, try again later' }, 429);
    if (globalLimited(dailyCap)) return json({ error: 'daily quota reached, try again tomorrow' }, 429);

    let body;
    try { body = await req.json(); } catch (e) { return json({ error: 'bad json' }, 400); }
    const task = body && body.task;
    const input = body && typeof body.input === 'string' ? body.input : '';
    if (!TASKS[task]) return json({ error: 'unknown task' }, 400);
    if (!input || input.length > 1500) return json({ error: 'input must be 1-1500 chars' }, 400);
    if (!env.GLM_KEY) return json({ error: 'server not configured (missing GLM_KEY)' }, 500);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    try {
      const r = await fetch(GLM_URL, {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + env.GLM_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: env.MODEL || 'glm-4-flash',
          temperature: 0.8,
          max_tokens: 700,
          messages: [
            { role: 'system', content: TASKS[task] },
            { role: 'user', content: input }
          ]
        }),
        signal: controller.signal
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        const msg = (j && j.error && (j.error.message || j.error.code)) || ('upstream HTTP ' + r.status);
        return json({ error: 'model error: ' + msg }, 502);
      }
      const text = j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
      if (!text) return json({ error: 'empty model reply' }, 502);
      return json({ result: String(text).trim() });
    } catch (e) {
      return json({ error: 'timeout or network error' }, 504);
    } finally {
      clearTimeout(timer);
    }
  }
};
