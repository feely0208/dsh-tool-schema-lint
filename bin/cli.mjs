#!/usr/bin/env node
/**
 * dsh-tool-schema-lint —— 工具定义安检（离线）
 * 输入：暴露给大模型的工具定义清单 JSON。接受三种形态：
 *   1. 数组 [{name, description, inputSchema|parameters}]
 *   2. { tools: [...] }        （MCP tools/list 或 DeepSeek tools 配置）
 *   3. { functions: [...] }
 * 用法：
 *   dsh-tool-schema-lint --file tools.json [--json] [--html 报告.html]
 * 退出码：有 high → 1。
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { lint } from '../lib/index.js';

const args = process.argv.slice(2);
const has = (k) => args.includes('--' + k);
const val = (k, d = '') => {
  const i = args.indexOf('--' + k);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : d;
};

if (has('help') || !has('file')) {
  console.log(`dsh-tool-schema-lint —— 工具定义安检

用法：dsh-tool-schema-lint --file tools.json [--json] [--html 报告.html]
输入：暴露给大模型的工具定义 JSON（数组 / {tools:[...]} / {functions:[...]}）。
10 条规则：描述缺失/占位/过短、schema 缺失、参数缺描述、类型不合法、命名不规范、
与官方工具同名、重复定义、数量过多（>40）、危险操作无确认说明。
模型靠描述选工具——定义写得差，工具就会被选错或被忽略。`);
  process.exit(0);
}

let raw;
try { raw = JSON.parse(readFileSync(resolve(val('file')), 'utf-8')); }
catch (e) { console.error('❌ 输入不是合法 JSON：' + e.message); process.exit(2); }

const { findings, stats } = lint(raw);
if (has('json')) {
  console.log(JSON.stringify({ stats, findings }, null, 2));
} else {
  console.log(`\n  深鲸 · 工具定义安检\n  ${'─'.repeat(60)}`);
  console.log(`  工具数     ${stats.tools} · findings ${findings.length}\n`);
  for (const f of findings) console.log(`  【${f.severity}】${f.id} · ${f.tool}${f.msg ? ' —— ' + f.msg : ''}`);
  if (!findings.length) console.log('  未命中任何规则 ✓（描述/schema/命名/冲突全过）');
  console.log('');
}
if (has('html')) {
  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const rows = findings.map((f) => `<tr><td>${f.severity}</td><td>${f.id}</td><td>${esc(f.tool)}</td><td>${esc(f.msg)}</td></tr>`).join('');
  writeFileSync(val('html'), `<!doctype html><meta charset="utf-8"><title>工具定义安检报告</title><style>body{font:14px/1.6 -apple-system,sans-serif;margin:24px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ddd;padding:6px 10px;text-align:left;vertical-align:top}th{background:#f5f5f5}</style><h1>工具定义安检报告</h1><p>${stats.tools} 个工具 · findings ${findings.length}</p><table><tr><th>级别</th><th>规则</th><th>工具</th><th>说明</th></tr>${rows}</table>`, 'utf-8');
  console.log(`HTML 报告已写入：${val('html')}`);
}
process.exitCode = findings.some((f) => f.severity === 'high') ? 1 : 0;
