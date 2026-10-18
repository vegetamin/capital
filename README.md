# Alice Life Capital OS 2.0 — 完整源码仓库

**这是多文件项目源码，不是单页 HTML 打包。** 根目录 `index.html` 为 2.0 网页入口，`css/`、`js/core/`、`js/modules/`、`js/importers/` 包含可编辑源文件。`legacy/capital-main/` 保留从用户旧版压缩包提取的完整源代码，供迁移与参考，**不会自动读取或迁移其中的数据**。

## 部署

1. 把仓库根目录的全部文件上传至 GitHub 仓库（不是只上传 index.html）。
2. Settings → Pages → Deploy from a branch → main / (root)。
3. 页面数据保存在当前浏览器的 IndexedDB 中，GitHub 不托管私有账本。
4. 在数据中心定期导出 JSON 备份，离线安全保存。不要把真实账本和备份提交到公开仓库。

## 2.0 入口模块

- `js/core/state.js`：数据库与状态；使用 IndexedDB。
- `js/core/navigation.js`：导航、页面渲染。
- `js/core/finance.js`：余额、净值、收支统计。
- `js/modules/accounts.js`：账户、余额录入。
- `js/modules/ledger.js`：收入、支出、转账流水。
- `js/modules/consumption.js`：消费分析、分类及预算。
- `js/modules/investment.js`：投资持仓及交易决策。
- `js/modules/policy.js`：政策与预算。
- `js/modules/data-center.js`：JSON备份与恢复。
- `js/importers/qianji.js`：钱迹 CSV 解析、预览与批次导入。
- `legacy/capital-main/`：原始 2.2.0 网站源代码，含旧版阅读、研究、周报等模块，供迁移参考；不是 2.0 活跃模块。

## 注意事项

- 起始业务数据为空，不会假装历史财务数据已迁移。
- 这套功能代码可以部署，但**不保证金融级正确性/生产验收**；需要用真实交易样本核对计算与导入、恢复。
- 旧版阅读、研究、复盘等功能仍在 `legacy/`，**尚未移植成 2.0 页面**。不能因此称为百分之百旧功能全覆盖。
- 2.0 尚没有自动迁移旧版浏览器 localStorage 的机制。保留原仓库与浏览器数据，迁移前先备份。
- 同一账户同一笔钱迹流水与手工流水，自动去重只能覆盖部分情况，需人工核对。
- 目前采用普通 script 多文件组织，避免依赖安装构建工具，适配静态 GitHub Pages。

## 本地启动

在仓库根目录运行 `python -m http.server 8000`，访问 `http://localhost:8000`。

## 验证

`node --check js/core/state.js` 等脚本均可单独做语法验证。`tests/structure-check.py` 对资源引用和文件结构作静态验证。
