# @deepwhale-cn/dsh-tool-schema-lint

工具定义安检：检查暴露给大模型的 tools 定义——描述质量、schema 完整性、命名规范、官方工具冲突、危险操作无确认说明。模型靠描述选工具，定义写得差 = 工具被选错或忽略。

```bash
npx @deepwhale-cn/dsh-tool-schema-lint --file tools.json [--html 报告.html]
```

输入：数组 / {tools:[...]} / {functions:[...]}。10 条规则；退出码有 high → 1。MCP server 开发者与全家桶应用开发者的 publish 前检查。

## 安装（DSH）

```bash
dsh plugin --profile web add @deepwhale-cn/dsh-tool-schema-lint
```

也可以 `npm i @deepwhale-cn/dsh-tool-schema-lint`，或从本仓库直接 `dsh plugin install ./`。
