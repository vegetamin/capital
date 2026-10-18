# Alice OS2 资产与消费 AI 分析说明

## 本地功能（无需任何 API）
1. 在“资产账户”导入资产 Excel 并确认；在“数据中心”导入钱迹 Excel/CSV，选择关联账户并确认。
2. 进入“AI 财务分析”，选择分析范围（资产 / 消费 / 综合），点击“重新分析最新账本”。
3. 查看本地核算报告及“发送内容预览”。支持复制 AI 提示词，或导出 JSON。

## 私有 AI 连接（可选）
GitHub Pages 无服务端，不得将 API Key 放进 GitHub 仓库、HTML、JS 或 URL。`worker/ai-proxy.js` 是单独部署的 Cloudflare Worker 后端，不能靠上传静态站点自动启用。

1. 在 Cloudflare Workers 创建 Worker，把 `worker/ai-proxy.js` 作为 Worker 代码部署；或复制 worker 目录并按 `wrangler.toml.example` 配置。
2. 配置 Secret `OPENAI_API_KEY` 为自己的 OpenAI API Key；配置 Secret `ALICE_ACCESS_TOKEN` 为随机高强度访问口令（不要与 API Key 相同）。
3. 配置 `ALLOWED_ORIGIN` 为 GitHub Pages 精确来源，例如 `https://username.github.io`，不包含路径和结尾 `/`；如果使用自定义域名则填写该域名来源。配置 `OPENAI_MODEL` 为账户有权使用的模型。
4. 部署后，进入网站 AI 页面，填 Worker HTTPS URL 和访问口令，审核所要传输的 JSON，勾选同意后手动点击发送。

## 数据安全和边界
- 只在主动点击时联网。按范围选择数据；默认不发送消费商户、备注和原始逐笔交易。
- **资产范围包含账户名称、余额、持仓名称及市值**，属于敏感财务信息。可选复制提示词后自己脱敏。
- 口令只在本次输入中使用；站点仅在 sessionStorage 记录 Worker URL，不存储口令或 API Key。
- 访问口令和 CORS 不能完全抵御恶意滥用公开 Worker；建议在 Cloudflare 设置访问控制和速率限制、费用预算。不能把公开 Worker 视为银行级安全系统。
- AI 是解释性分析，不自动改变账户、持仓或订单。AI可能出错，任何结论须核对原始账本。
- AI 报告目前只在内存中显示，可复制；不自动存储，以免增加敏感数据留存。

## 已知限制
- 月度预算仅基于当前已录入记录；没有历史完整账单时不应声称掌握消费规律。
- 资产账户和证券持仓的重复计量尚须人工核对；报告会提示此项风险。
- 这是一套真实可运行的本地统计与可选 AI 接入代码，部署后的 API 调用仍需用户配置 Worker 并验证。


## 页面内 OpenAI API Key 配置（新增）
1. 进入「AI 财务分析」→「连接 ChatGPT」→ 选择「浏览器直接连接」。
2. 模型默认 `gpt-4.1-mini`，可修改为您的 API 项目有权限使用的模型。
3. 输入从 https://platform.openai.com/api-keys 创建的 API Key，点击「保存连接设置」，可点击「测试API连接」。
4. 默认只保存到 sessionStorage（本次浏览器会话）。勾选「记住密钥」并确认后，才会明文保存到此浏览器的 localStorage。可随时点「清除密钥」。
5. 选择财务分析范围，查看 JSON 摘要并确认后，点击「向AI发送并分析」。仅此时发送数据至 OpenAI。

### 严肃安全提示
- OpenAI 官方不建议前端直接使用 API Key。本功能是应用户指定提供的个人设备模式，并非安全的生产级密钥管理方案；明文 localStorage 容易受到恶意脚本、浏览器扩展和共用电脑风险影响。
- 前端直连可能被浏览器 CORS 策略拦截，届时请切换到安全代理模式；不能靠关闭浏览器安全功能绕过。
- 用户的 ChatGPT Plus 订阅不包含 API 额度，API 在 platform.openai.com 单独计费。
- 密钥不进入网站源码、GitHub 提交和 Alice 财务备份；浏览器里的保存并不代表密钥已加密。
- 请求使用 OpenAI Chat Completions API，`store:false`；使用量和数据处理仍受 API 平台适用条款约束。


## 多 AI 服务商配置（V2）

进入「AI 财务分析」，选择 AI 引擎：OpenAI、DeepSeek、阿里云百炼/通义千问、Moonshot/Kimi、智谱 GLM 或自定义 OpenAI 兼容接口。每个服务商分别保存模型 ID、完整 HTTPS Chat Completions 地址和 API Key；默认密钥保留在浏览器 sessionStorage，选择长期保存才写入明文 localStorage。

浏览器直连请求使用标准 Chat Completions (`model`, `messages`, `max_tokens`)。仅当服务商允许浏览器跨域调用时可用；密钥在客户端不安全，不推荐长期用于真实财务数据。自定义接口请仔细核对域名，防止将密钥发送给恶意服务。

安全代理模式：Cloudflare Worker 支持 `openai`、`deepseek`、`qwen`、`moonshot`、`zhipu` 五个预置路由，前端只传服务商标识，不允许传任意 URL。请为要用的服务商分别配置 Secret：`OPENAI_API_KEY`、`DEEPSEEK_API_KEY`、`QWEN_API_KEY`、`MOONSHOT_API_KEY`、`ZHIPU_API_KEY`；配套模型变量为 `OPENAI_MODEL` 等。`ALICE_ACCESS_TOKEN` 和 `ALLOWED_ORIGIN` 仍为必填。**自定义兼容服务在代理模式下不受支持**，需自行在 Worker 添加经过审核的固定路由，避免开放代理遭到滥用。

服务商接口和可用模型可能调整；使用前请核对对应服务商官方 API 文档、权限、区域与计费。ChatGPT Plus 订阅不含 OpenAI API 额度，其他服务商也独立申请密钥与计费。
