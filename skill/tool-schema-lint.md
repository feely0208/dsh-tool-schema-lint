# 工具定义安检（dsh-tool-schema-lint）

**什么时候用**：给大模型应用/MCP server 定义 tools 之后、发布之前。模型靠 description 选工具——定义写得差，工具就会被选错或被忽略。
用户会说：「我的 tools 定义写得好不好」「为什么模型老不用这个工具」。

## 怎么用

```bash
<cli 路径> --file tools.json [--json] [--html 报告.html]
```

输入：数组 / {tools:[...]} / {functions:[...]}。

## 它查什么（10 条）

| 规则 | 级别 |
|---|---|
| TSL-DESC-MISSING（无描述）/ TSL-DESC-PLACEHOLDER（占位符）/ TSL-DESC-SHORT（<15 字符） | high/medium/low |
| TSL-SCHEMA-MISSING（无 inputSchema） | high |
| TSL-PARAM-DESC（超半数参数缺描述）/ TSL-TYPE（类型不在标准集） | medium/low |
| TSL-NAME-CASE（非 snake_case）/ TSL-NAME-OFFICIAL（与官方服务端工具同名） | low/medium |
| TSL-DUP（同名重复）/ TSL-COUNT（>40 个建议拆分）/ TSL-DANGEROUS（危险操作无确认说明） | high/low/medium |

## 边界

纯静态检查；官方工具（deepseek_web_search 等）同名命中为提示项——若为启用官方工具请忽略该条。
