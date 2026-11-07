# Alice Capital 市场情报数据源评估

> 调研日期：2026-11-07。本文只引用数据拥有方或发布机构的一手文档。这里的“实时”严格指交易时段内持续或逐笔/准逐笔更新；网页上能立即查询，不等于数据本身实时。

## 结论先行

Alice Capital 应把数据分为三条管线，而不是用一个“实时”标签混在一起：

1. **宏观与政策数据**：IMF、FRED、ECB、World Bank，频率通常为年度、季度、月度、周度或日度，按官方发布时间更新，不是盘中行情。
2. **监管持仓数据**：CFTC COT，目前仍以周报为主，报告日与发布日期有数日时差，也不是实时数据。
3. **市场行情数据**：Twelve Data 可统一接股票、外汇和商品；真正的 CME 期货实时行情应单独采购交易所授权的数据。行情是否实时取决于交易所、品种、套餐和最终用途，不能只看 API 名称。

生产环境建议统一走 Alice 后端/边缘 Worker：保护 API Key、集中缓存与限流、记录发布时间和修订版本，并避免依赖供应商未承诺的浏览器 CORS 行为。只有 World Bank 明确说明示例 API URL 可直接放入浏览器；“能在浏览器打开”仍不代表适合生产前端直连。

## 时效性总表

| 来源 | 适合内容 | 真实时效 | 是否真正实时 | 授权 | 推荐接入 |
| --- | --- | --- | --- | --- | --- |
| IMF Data API | 全球 GDP、通胀、财政、国际收支、WEO 预测 | 因数据集而异，常见年/季/月 | 否 | API 探索页要求 beta portal 账户登录 | 服务端 SDMX 采集、按发布日刷新 |
| FRED API | 全球/美国宏观聚合、利率与金融条件、修订历史 | 年/季/月/周/日，随原发布机构更新 | 否；`realtime_*` 指数据版本区间，不是行情流 | 必需 API Key | 服务端代理、缓存、保留 vintage |
| U.S. Treasury | 官方美债票面收益率曲线、实际收益率曲线、Bill rates | 每个工作日一次；输入报价约为美东 15:30 | 否 | 无 API Key | 服务端拉 XML，按日缓存 |
| ECB Data Portal | 欧元区政策利率、HICP、货币、信贷、欧元参考汇率 | 数据集可为年/季/月/周/日 | 否 | API 文档未要求 Key | 服务端 SDMX；公开只读页可酌情直连 |
| World Bank Indicators API | WDI、人口、发展与债务宏观指标 | 多数年频或更低；部分月/季 | 否 | 无 Key/认证 | 可浏览器查询；生产仍建议服务端缓存 |
| CFTC COT PRE | 期货/期权分类持仓、净头寸与集中度 | 通常周二截面、周五 15:30 ET 发布 | 否，约 3 天滞后 | 当前无需 token，避免过度调用 | 服务端按发布日期增量同步 |
| Twelve Data | 股票、FX、现货商品、ETF 等统一行情 | REST 1 分钟至日线；WebSocket 对获授权标的推送报价 | **部分是**；按交易所/套餐逐标的确认 | API Key | 只从服务端连接，向前端转发最少字段 |
| CME Group | CME/CBOT/NYMEX/COMEX 期货与期权 | WebSocket 实时；Top of Book 以 500ms 合并发送 | **是**，但并非逐订单簿最低延迟 | 自助门户/合同、ILA 及适用费用 | 独立受控服务端行情网关 |

## 1. 全球宏观

### 1.1 IMF Data API：全球宏观主源

- **覆盖**：IMF 新 Data Portal 提供 WEO、财政、国际收支、CPI、货币金融统计等数据；官方说明数据可通过 SDMX 2.1 与 SDMX 3.0 API 导入应用。[IMF Data APIs](https://data.imf.org/en/Resource-Pages/IMF-API)；[IMF Data 总览](https://www.imf.org/en/Data)
- **节奏**：由数据集自己的发布日历决定，通常是年、季或月频。WEO 数据库按半年期报告周期更新；它是预测/宏观发布数据，不是盘中流。[WEO transition guide](https://data.imf.org/-/media/iData/External-Storage/Documents/2C2B2F3E671A4B11ABE756E2441FD6F0/en/WEO-Database-Transition-Guide.pdf)
- **认证**：官方 API 页要求使用 beta portal 账户登录 Swagger 探索页。实施前应创建机构账户并从 Swagger 固化实际数据流、维度顺序和认证方式，不应依赖旧版 IMF endpoint。[IMF Data APIs](https://data.imf.org/en/Resource-Pages/IMF-API)
- **浏览器/CORS**：官方只说明 API 可导入应用，没有承诺跨域策略。建议服务端 SDMX 适配器；这也避免浏览器暴露账户信息，并能统一处理大响应、分页和维度元数据。
- **许可**：IMF 允许下载、派生、发布和分发其统计数据，但要求准确呈现、标注 IMF 与数据库链接，并披露重大转换；同时其条款要求潜在商业再利用联系 `copyright@imf.org`。Alice 若作为商业产品，应在上线前书面确认。[IMF Copyright and Usage](https://www.imf.org/en/About/copyright-and-terms)
- **建议规范字段**：`provider=IMF`、`dataset_id`、`series_key`、`economy_iso3`、`indicator_code`、`frequency`、`period`、`value`、`unit`、`status_flag`、`source_updated_at`、`release_id`、`retrieved_at`。

### 1.2 FRED API：易用的宏观聚合与修订补充源

- **覆盖**：FRED 聚合来自多家机构的宏观和区域时间序列，官方列明年、季、月、周、日等频率；可获取序列元数据、观测值、更新和 vintage dates。[FRED API](https://fred.stlouisfed.org/docs/api/fred/)；[FRED 说明](https://fred.stlouisfed.org/docs/api/fred/fred.html)
- **节奏**：随底层发布机构更新，不是报价流。API 返回的 `realtime_start` / `realtime_end` 是“实时期间/数据版本”语义，不能标为市场实时；`frequency` 和 `last_updated` 才是前端新鲜度提示的基础。[series metadata](https://fred.stlouisfed.org/docs/api/fred/series.html)；[series observations](https://fred.stlouisfed.org/docs/api/fred/series_observations.html)
- **认证**：所有 Web Service 请求都要 32 位小写字母数字 API Key；官方要求每个应用使用独立 Key，并写明应用的每名用户应使用自己的 Key。默认上限是每分钟 120 次，超限返回 429。Alice 不能未经确认就用一个服务端 Key 代替所有用户，应让用户提供自己的 Key，或先向 FRED 书面确认服务端聚合模式。[API Keys](https://fred.stlouisfed.org/docs/api/api_key.html)；[rate limits](https://fred.stlouisfed.org/docs/api/fred/errors.html)
- **浏览器/CORS**：Key 不应进入公开静态代码或 URL；官方也没有承诺浏览器 CORS。若采用用户自带 Key，可在一次会话内交给受控 Worker，代理做白名单 series 映射、缓存和限流，不把 Key 写入仓库或日志。
- **许可**：FRED API 条款不覆盖各数据序列所有者的版权和限制；面向用户的应用还需展示 FRED API 条款链接，并在自己的条款中说明用户受其约束。逐序列检查 `source`/notes，不能把“FRED 可访问”当成统一再分发授权。[FRED API Terms](https://fred.stlouisfed.org/docs/api/terms_of_use.html)
- **建议规范字段**：`provider=FRED`、`series_id`、`title`、`observation_date`、`value`、`frequency`、`units`、`seasonal_adjustment`、`vintage_start`、`vintage_end`、`source_updated_at`、`retrieved_at`。

## 2. 美国国债与收益率曲线

### U.S. Treasury Daily Interest Rate Feed

- **覆盖**：官方 XML feed 包含 Daily Treasury Par Yield Curve、Bill Rates、Long-Term Rates、Real Par Yield Curve 和 Real Long-Term Rates，可按年、月或全量分页查询。[Treasury XML feed](https://home.treasury.gov/treasury-daily-interest-rate-xml-feed)
- **节奏**：每日一次。官方解释票面收益率基于场外市场最近发行证券的收盘买方报价，输入为纽约联储约在每个工作日 15:30 ET 取得的指示性报价。因此它是**日终官方曲线**，不是盘中可交易报价。[Interest Rate Statistics](https://home.treasury.gov/policy-issues/financing-the-government/interest-rate-statistics)
- **认证**：GET XML，无 API Key。全量查询默认首 300 行，并使用从 0 开始的 `page` 分页。[Treasury XML feed](https://home.treasury.gov/treasury-daily-interest-rate-xml-feed)
- **浏览器/CORS**：Treasury 的开发者公告明确称 XML feed 不再可在浏览器中访问，但仍供开发者通过 API 使用；因此必须按**服务端采集**设计，不要让前端直接抓取。[Developer Notice](https://home.treasury.gov/developer-notice-xml-changes)
- **许可**：官方页面没有为该 feed 单列再分发许可证；Treasury 同时声明不保证信息准确、完整或适用。产品应标注来源和原始观测日期，不暗示 Treasury 背书；商业上线前保留一次法律复核。[Treasury Privacy Policy / Legal Disclaimers](https://home.treasury.gov/footer/privacy-act/privacy-policy)
- **建议规范字段**：`curve_type`、`as_of_date`、`tenor`（`1M/1.5M/2M/3M/4M/6M/1Y/.../30Y`）、`rate_percent`、`quote_basis=par|bill|real_par|long_term`、`source_time≈15:30 America/New_York`、`published_at`、`retrieved_at`。

## 3. 欧洲央行

### ECB Data Portal SDMX API

- **覆盖**：ECB 的 SDMX 2.1 REST 服务提供统计数据和元数据发现；入口为 `https://data-api.ecb.europa.eu/service/`。查询由 dataflow、series key 和时间参数组成，支持 CSV、JSON 与 SDMX-ML。[API overview](https://data.ecb.europa.eu/help/api/overview)；[data queries](https://data.ecb.europa.eu/help/api/data)
- **节奏**：频率是 series key 的维度，可为年、半年、季、月、周或日。日频欧元参考汇率仍是每日参考值，不是流式 FX 报价。用 `updatedAfter` 拉取新增、修订和删除，或用 `If-Modified-Since` 获取 304。[data queries](https://data.ecb.europa.eu/help/api/data)
- **认证**：公开 API 文档没有 API Key 参数，也未要求账户；Portal 账户用于保存内容、仪表板和订阅，不应误作 API 必需认证。[account purpose](https://data.ecb.europa.eu/help/account/how-do-i-create-account)
- **浏览器/CORS**：文档提供可直接打开的 HTTPS 示例，但没有给出稳定 CORS 契约。小型无密钥查询可作为前端降级方案；生产同步、通配符查询和修订跟踪应走服务端。[data examples](https://data.ecb.europa.eu/help/api/data-examples)
- **许可**：公开 ESCB 统计可免费用于商业或非商业用途，但必须标注来源且不得修改统计及元数据；第三方数据不在免费复用范围内。若 Alice 计算同比、标准化或其他派生值，另按 ECB 网站版权条款明确标注“已修改/计算”。[ESCB reuse policy](https://www.ecb.europa.eu/stats/ecb_statistics/governance_and_quality_framework/html/usage_policy.en.html)；[ECB copyright](https://www.ecb.europa.eu/services/using-our-site/disclaimer/html/index.en.html)
- **建议规范字段**：`provider=ECB`、`flow_ref`、`series_key`、`frequency`、`reference_area`、`instrument_or_indicator`、`currency`、`period`、`value`、`unit`、`unit_multiplier`、`seasonal_adjustment`、`obs_status`、`source_updated_at`、`retrieved_at`。

## 4. World Bank 全球发展宏观

### Indicators API v2

- **覆盖**：Indicators API 提供近 16,000 条时间序列、45 个以上数据库，含 World Development Indicators、International Debt Statistics 等；使用 `/v2/` endpoint。[Indicators API](https://datahelpdesk.worldbank.org/knowledgebase/articles/889392)
- **节奏**：World Bank 明确说明多数社会与经济数据为年频或更低；部分经济金融数据（如 GEM）为月或季频。应从 metadata 读取 periodicity 和 source 的 `lastupdated`，不得把 API 查询时间当成数据时间。[higher-frequency FAQ](https://datahelpdesk.worldbank.org/knowledgebase/articles/77928-do-you-have-quarterly-monthly-or-higher-frequency)；[Metadata API](https://datahelpdesk.worldbank.org/knowledgebase/articles/1886695-metadata-api-queries)
- **认证**：不需要 API Key 或其他认证。[Indicators API authentication](https://datahelpdesk.worldbank.org/knowledgebase/articles/889392)
- **浏览器/CORS**：官方明确说示例或自定义 API URL 可直接放进浏览器查看。前端可做只读原型；生产仍建议服务端缓存、分页、空值处理，并避免把 World Bank 的可用性变成页面单点故障。[Indicators API](https://datahelpdesk.worldbank.org/knowledgebase/articles/889392)
- **许可**：除 metadata 另有说明外，数据可在 CC BY 4.0 下免费复制、分发、改编和展示，商业与非商业均可；必须归属 World Bank 和数据提供方。第三方数据可能另有限制，必须逐 indicator 检查 metadata。[World Bank summary terms](https://data.worldbank.org/summary-terms-of-use)
- **建议规范字段**：`provider=WB`、`source_id`、`indicator_id`、`economy_iso3`、`period`、`frequency`、`value`、`unit`、`decimal`、`obs_status`、`footnote`、`source_updated_at`、`retrieved_at`。

## 5. CFTC Commitments of Traders

### COT Public Reporting Environment (PRE)

- **覆盖**：Legacy、Disaggregated、Traders in Financial Futures、Supplemental 等持仓数据；PRE 可按报告日期、商品组和合约市场筛选，并通过 API 导出 CSV、RDF、RSS、TSV 或 XML。[COT overview and API](https://www.cftc.gov/MarketReports/CommitmentsofTraders/index.htm)；[PRE User Guide](https://publicreporting.cftc.gov/stories/s/COT-Help/p2fg-u73y/)
- **节奏**：当前官方说明通常取周二收盘持仓，周五 15:30 ET 发布，即约三天滞后；节假日可能延后。2026-10-27 的官方公告表示计划在 2026 年底前改为每周两次、滞后两天，但在 CFTC 正式切换前不得提前把产品标成半周频。[Release Schedule](https://www.cftc.gov/MarketReports/CommitmentsofTraders/ReleaseSchedule/index.htm)；[planned semiweekly change](https://www.cftc.gov/PressRoom/PressReleases/9316-26)
- **认证**：CFTC 当前不发 PRE API token；官方 FAQ 称不过度调用时通常可无 token 使用。[COT API access FAQ](https://www.cftc.gov/MarketReports/CommitmentsofTraders/index.htm)
- **浏览器/CORS**：PRE 提供网页与 API，但 CFTC 没有在上述文档中承诺跨域 SLA。服务端同步更适合限流、固定 schema 和发布时点校验。
- **许可/边界**：PRE 数据可自由下载，但 CFTC 因法律限制不公开单个交易者分类；产品只能显示公开聚合结果，不能声称能识别具体机构，或把分类解释成交易动机。[COT methodology and confidentiality](https://www.cftc.gov/MarketReports/CommitmentsofTraders/index.htm)
- **政府信息复用**：CFTC 的网站政策说明其创建的信息属于公共领域，可自由复制和分发并请求适当署名；第三方版权材料除外。仍应保留来源、报告类型和报告日期。[CFTC Web Policy](https://www.cftc.gov/sites/default/files/cftc/cftcprivacy.htm)
- **建议规范字段**：`report_type`、`futures_or_combined`、`report_as_of_date`、`released_at`、`contract_market_name`、`cftc_contract_market_code`、`commodity_group`、`category`、`long_positions`、`short_positions`、`spreading_positions`、`open_interest`、`trader_count`、`change_week_over_week`、`retrieved_at`。

推荐派生字段使用可复算公式并标注为 Alice 计算值，例如 `net_positions = long_positions - short_positions`、`net_pct_open_interest = net_positions / open_interest`、`zscore_3y`；不要覆盖原始 CFTC 列。

## 6. 股票、外汇、商品统一行情供应商

### Twelve Data

- **覆盖**：官方宣称一个 REST API 与 WebSocket 覆盖股票、FX、加密、ETF/基金，并另有商品数据。`/time_series` 提供 OHLC（非货币工具通常含 volume），`/quote`、`/price` 提供最新值；WebSocket `quotes/price` 推送价格、时间戳和日成交量。[API docs](https://twelvedata.com/docs)；[commodity endpoints](https://twelvedata.com/exchanges/commodity?group=reference)；[WebSocket docs](https://twelvedata.com/docs/websocket/websocket-getting-started)
- **节奏**：WebSocket 会在交易所产生新数据时推送，被授权的标的可是真实时；但不同市场可能是实时、延迟或仅 EOD，必须从 exchange/plan entitlement 逐标的确认。REST `time_series` 可从 1 分钟到月线；WebSocket 目前不提供 OHLC 或技术指标流。[WebSocket FAQ](https://support.twelvedata.com/en/articles/5194610-websocket-faq)；[pricing and entitlements](https://twelvedata.com/pricing)
- **认证**：所有 REST/WebSocket 请求使用 API Key，官方推荐 HTTP header；套餐同时限制每分钟 API credits、WebSocket 订阅数和连接数。[authentication](https://twelvedata.com/docs/markets/market-state)；[WebSocket docs](https://twelvedata.com/docs/websocket/websocket-getting-started)
- **浏览器/CORS**：官方明确要求安全保存 Key、不要暴露在客户端代码或公共仓库，所以 Alice 不应从静态前端直连 REST/WS。由服务端持有 Key，再通过 Alice 自己的已认证接口向浏览器发最少数据。[authentication best practices](https://twelvedata.com/docs/markets/market-state)
- **许可**：个人套餐、商业内部使用、外部分发和白标权限不同；官方明确称外部分发取决于商业套餐层级，FX API 的 API 式再分发需要单独许可。展示给 Alice 用户前，应让 Twelve Data 书面确认具体交易所、标的、延迟级别、用户类型和 redistribution 权限。[EOD usage guidelines](https://support.twelvedata.com/en/articles/12682324-end-of-day-eod-pricing-market-data)；[Forex v2 licensing](https://support.twelvedata.com/en/articles/12520817-forex-api-v2)
- **美国股票覆盖限制**：默认实时源虽然覆盖上市股票代码，但成交来源约占全美总成交量的 5%，不是 SIP/全市场合并行情；下一交易日午夜后提供的 EOD 数据才覆盖 100% 成交量。若资产估值要求完整实时成交覆盖，需另谈 full-market licensed access。[US equities market data](https://support.twelvedata.com/en/articles/9935903-us-equities-market-data)
- **套餐用途限制**：个人套餐只适合个人/内部、教育、开发测试等非商业外显用途；商业展示使用 Business plan，向第三方再分发还需单独协议，派生数据也必须无法反推出原始行情。[commercial and personal usage](https://support.twelvedata.com/en/articles/5332349-commercial-and-personal-usage)
- **建议规范字段**：`provider=TWELVEDATA`、`instrument_id`、`vendor_symbol`、`asset_class`、`exchange`、`mic`、`currency`、`event_time`、`open/high/low/close`、`last_price`、`bid`、`ask`、`volume`、`interval`、`market_state`、`delay_seconds`、`entitlement_level`、`retrieved_at`。

Twelve Data 的“commodity”有相当部分是现货/货币对式商品报价（例如 `XAU/USD`）；它不能自动替代交易所期货连续合约、到期月、结算价和换月规则。

## 7. 真正实时期货：许可和技术限制

### CME Group Real-Time Futures & Options Data API

- **技术能力**：CME 的云 WebSocket API 直接提供实时 trades、top of book 与每日统计，JSON 传输。官方说明 top-of-book 消息为节省带宽会按 **500ms conflation**，因此属于实时展示/分析数据，但不是完整深度订单簿或最低延迟共址行情。[Real-Time API](https://www.cmegroup.com/market-data/real-time-futures-and-options-data-api.html)
- **认证/开通**：通过 CME Data Services Portal 自助接入或联系数据团队；技术订阅之外仍有适用 ILA 费用。[Market Data APIs](https://www.cmegroup.com/market-data/market-data-api.html)；[Data Services Portal](https://www.cmegroup.com/tools-information/webhelp/data-services-portal/Content/GettingStarted.html)
- **许可不是可选项**：CME 明确把 Real Time、Delayed、End of Day、Display、Non-Display 与 Distribution 分开授权。即便从授权 distributor 而非 CME 直采，应用对实时或延迟数据做 non-display 使用仍可能需要许可；延迟 15 分钟也不自动免除 non-display 许可。[CME licensing FAQ](https://www.cmegroup.com/market-data/distributor/files/cme-group-data-licensing-policy-guidelines-and-non-display-licensing-faq.pdf)
- **免费网页不是实时接口**：CME 官网期货和期权报价至少延迟 10 分钟，且官方明确说网页数据只供参考，不能拿来校验或补充 MDP 实时 feed；不得抓取网页替代已授权数据源。[About Market Data](https://www.cmegroup.com/trading/about-quotes.html)
- **费用会变化**：2026 fee list 对实时/延迟分发、每设备显示、数据 feed 和 non-display 应用分别计费，且通常按交易所评估。实现前必须以签约时的最新 fee list 和 ILA 为准，本文不把具体价格写入产品假设。[CME 2026 fee list](https://www.cmegroup.com/market-data/files/june-2026-market-data-fee-list.pdf)
- **访问控制与审计**：CME Information Policies 要求 entitlement 系统统计所有被技术授权访问的设备，保留历史审计轨迹并防止共享凭证；不能用“实际是否看过”代替已授权设备计数。[Information Policies](https://www.cmegroup.com/market-data/license-data/information-policies.html)
- **浏览器架构**：不从浏览器直连交易所。服务端行情网关负责 CME 凭证、合约映射、entitlement、设备/用户计数、审计、断线重连和授权过滤；前端只能订阅其账户被允许看到的字段与合约。
- **建议规范字段**：`provider=CME`、`exchange`、`product_code`、`security_id`、`contract_month`、`expiration_date`、`event_time`、`sequence`、`trade_price`、`trade_size`、`bid_price`、`bid_size`、`ask_price`、`ask_size`、`settlement_price`、`open_interest`、`is_conflated`、`delay_seconds`、`display_or_non_display`、`entitlement_id`、`retrieved_at`。

### 上线前必须向供应商/交易所书面确认

1. Alice 是个人工具、内部商业工具还是向第三方用户提供的 SaaS。
2. 数据用于屏幕显示、告警、估值、AI 分析、自动决策还是交易；一个产品可能同时触发 display 与 non-display。
3. 用户是否专业投资者，以及设备、用户、应用如何计数和申报。
4. 是否允许缓存、历史回放、派生指标、截图/报告导出及 API 再分发。
5. “实时”“延迟”“EOD”的逐交易所定义、延迟秒数与 attribution 文案。

## 8. 建议的统一数据模型

所有记录至少保留四个时间，避免把“新抓到”误认为“新数据”：

```text
period_start / event_time   数据代表的经济期间或行情事件时间
as_of_time                  统计截面时间，例如 COT 的周二、收益率曲线的业务日
released_at                 发布机构允许公众看到数据的时间
retrieved_at                Alice 实际抓取时间
```

公共 envelope：

```json
{
  "provider": "ECB",
  "dataset": "EXR",
  "series_id": "D.USD.EUR.SP00.A",
  "frequency": "D",
  "latency_class": "official_daily",
  "is_realtime": false,
  "period": "2026-11-06",
  "as_of_time": "2026-11-06",
  "released_at": null,
  "retrieved_at": "2026-11-07T02:00:00Z",
  "value": 1.0,
  "unit": "USD per EUR",
  "revision": null,
  "source_url": "https://data-api.ecb.europa.eu/...",
  "license_tag": "ECB-public-statistics",
  "quality_flags": []
}
```

`latency_class` 建议限制为：

- `streaming_realtime`
- `streaming_conflated`
- `delayed_market`
- `end_of_day`
- `official_daily`
- `weekly_release`
- `monthly_release`
- `quarterly_release`
- `annual_release`
- `irregular`

另外保留 `raw_payload_hash`、`adapter_version` 和不可变的原始响应归档，以便来源修订或字段变化时追溯；对 FRED、ECB、World Bank 和 IMF，派生指标不得覆盖官方原值。

## 9. 推荐实施顺序

1. **第一阶段（低许可风险）**：World Bank、Treasury、ECB；做日/周/月级缓存、来源链接、新鲜度标签和修订处理。
2. **第二阶段（宏观增强）**：FRED 与 IMF；先固化系列白名单、归属文案和商业复用确认，再接发布日历与 vintage。
3. **第三阶段（监管情绪）**：CFTC COT；以 `report_as_of_date` 与 `released_at` 双时间轴展示，不出现“实时资金流”措辞。
4. **第四阶段（市场行情）**：用 Twelve Data 做股票/FX/现货商品的供应商验证；建立逐标的 entitlement 表。
5. **第五阶段（期货实时）**：在 CME/供应商合同、用户分类、display/non-display 和再分发权全部确认后，才上线实时期货流。

任何前端卡片都应同时显示 `数据截至`、`发布/更新时间` 和 `实时/延迟/日频/周频` 标签。对个人财富管理，官方日频与低频宏观数据通常足以支持资产配置和风险解释；没有明确授权时，不要用抓取公开网页或通用行情 API 冒充可再分发的实时期货数据。
