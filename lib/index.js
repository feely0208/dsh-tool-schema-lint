/**
 * dsh-tool-schema-lint —— 工具定义安检内核
 *
 * 模型靠 description 选工具——定义写得差，工具就会被选错或被忽略。
 * 10 条规则；输入接受 数组 / {tools:[]} / {functions:[]} 三种形态。
 */
const OFFICIAL_TOOLS = ['deepseek_web_search', 'deepseek_read_url']; // DeepSeek 官方服务端工具（2026-11-13 全家桶 API）
const STD_TYPES = new Set(['string', 'number', 'boolean', 'object', 'array', 'integer']);
const DANGEROUS_RE = /delete|drop\b|exec|remove_all|清空|删除全部|格式化|rm\s+-rf/i;

function severityOf(id) {
  return { 'TSL-DESC-MISSING': 'high', 'TSL-SCHEMA-MISSING': 'high', 'TSL-DUP': 'high', 'TSL-NAME-OFFICIAL': 'medium', 'TSL-DANGEROUS': 'medium', 'TSL-DESC-PLACEHOLDER': 'medium', 'TSL-PARAM-DESC': 'medium', 'TSL-DESC-SHORT': 'low', 'TSL-NAME-CASE': 'low', 'TSL-COUNT': 'low', 'TSL-TYPE': 'low' }[id] || 'low';
}

/** 归一化输入 → [{name, description, schema}] */
export function normalize(raw) {
  let list = Array.isArray(raw) ? raw : (raw.tools || raw.functions || null);
  if (!Array.isArray(list)) throw new Error('输入里找不到工具清单：应为数组或含 tools/functions 字段的对象');
  return list.map((t, i) => ({
    index: i,
    name: String(t?.name ?? t?.id ?? `(第 ${i + 1} 项无名)`),
    description: typeof t?.description === 'string' ? t.description : (t?.description ? JSON.stringify(t.description) : ''),
    schema: t?.inputSchema || t?.parameters || t?.schema || null,
  }));
}

export function lint(raw) {
  const tools = normalize(raw);
  const findings = [];
  const seen = new Map();
  for (const t of tools) {
    const add = (id, msg) => findings.push({ id, severity: severityOf(id), tool: t.name, msg });

    // 1. 描述
    if (!t.description.trim()) add('TSL-DESC-MISSING', '工具没有 description —— 模型只能靠名字猜');
    else if (/TODO|待定|占位|xxx/i.test(t.description)) add('TSL-DESC-PLACEHOLDER', 'description 里还有占位符');
    else if (t.description.trim().length < 15) add('TSL-DESC-SHORT', `description 过短（${t.description.trim().length} 字符）：写清用途、参数含义与返回内容`);

    // 2. schema
    if (!t.schema) add('TSL-SCHEMA-MISSING', '没有 inputSchema/parameters —— 模型生成参数时不受任何约束');
    else {
      const props = t.schema.properties || {};
      const names = Object.keys(props);
      if (names.length) {
        const noDesc = names.filter((k) => !props[k]?.description);
        if (noDesc.length / names.length > 0.5) add('TSL-PARAM-DESC', `超过一半参数缺 description（${noDesc.join(', ')}）`);
        const badType = names.filter((k) => props[k]?.type && !STD_TYPES.has(props[k].type));
        if (badType.length) add('TSL-TYPE', `参数类型不在标准集（${badType.map((k) => k + ':' + props[k].type).join(', ')}）`);
      }
    }

    // 3. 命名
    if (!/^[a-z][a-z0-9_]*$/.test(t.name)) add('TSL-NAME-CASE', `工具名「${t.name}」不是 snake_case（小写字母/数字/下划线）`);
    if (OFFICIAL_TOOLS.includes(t.name)) add('TSL-NAME-OFFICIAL', `「${t.name}」是官方服务端工具名——若为启用官方工具请忽略本条；若为自定义工具则与官方冲突`);

    // 4. 危险操作无确认说明
    if (DANGEROUS_RE.test(t.name + ' ' + t.description) && !/(confirm|audit|审批|确认|审计|dry[-_ ]?run)/i.test(t.description)) {
      add('TSL-DANGEROUS', '名字/描述涉及删除、执行类危险操作，但描述里没有确认/审计/dry-run 说明');
    }

    // 5. 重复
    seen.set(t.name, (seen.get(t.name) || 0) + 1);
  }
  for (const [name, n] of seen) if (n > 1) findings.push({ id: 'TSL-DUP', severity: severityOf('TSL-DUP'), tool: name, msg: `同名工具定义了 ${n} 次（后一次会覆盖前一次的语义）` });
  if (tools.length > 40) findings.push({ id: 'TSL-COUNT', severity: severityOf('TSL-COUNT'), tool: '(整体)', msg: `工具数量 ${tools.length} > 40：模型选择准确率随数量下降，建议按场景拆分 server 或分组` });

  const order = { high: 0, medium: 1, low: 2 };
  findings.sort((a, b) => (order[a.severity] ?? 9) - (order[b.severity] ?? 9));
  return { findings, stats: { tools: tools.length, findings: findings.length } };
}

// ── DSH 插件接入（方案 A 薄壳：注册 skill 与 CLI 入口；业务逻辑仍在 lib/bin）──
import { createPlugin, pkgRootFrom } from '@deepwhale-cn/dsh-guard-core/plugin';

export const { name, inject, apply } = createPlugin({
  name: 'tool-schema-lint',
  pkgRoot: pkgRootFrom(import.meta.url),
  skillFile: 'skill/tool-schema-lint.md',
  binFile: 'bin/cli.mjs',
  description: "检查暴露给大模型的工具定义（tools 数组 / MCP 工具清单）：描述质量、schema 完整性、命名规范、与官方工具冲突、危险工具无确认说明——模型靠描述选工具，定义写得差=选错工具",
  whenToUse: "给大模型应用/MCP server 定义 tools 之后、发布前的定义质检。用户会说：我的 tools 定义写得好不好。",
});
