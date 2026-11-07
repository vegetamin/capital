# ALICE-MARKET-1 数据契约

市场数据由 Worker 规范化后再交给浏览器。浏览器不接受上游 API 地址，也不保存供应商密钥。

```json
{
  "version": "ALICE-MARKET-1",
  "asOf": "2026-11-07T08:00:00Z",
  "fetchedAt": "2026-11-07T08:01:00Z",
  "observations": [
    {
      "id": "provider-series-id",
      "group": "global",
      "label": "指标名称",
      "value": 4.25,
      "unit": "%",
      "change": -0.1,
      "signal": 0,
      "cadence": "daily",
      "observedAt": "2026-11-06T23:59:59Z",
      "fetchedAt": "2026-11-07T08:01:00Z",
      "source": "官方或授权来源",
      "sourceUrl": "https://example.com/official-source",
      "note": "延迟、口径和许可说明"
    }
  ],
  "events": [
    {
      "id": "event-id",
      "title": "事件名称",
      "at": "2026-11-09T12:30:00Z",
      "importance": "high",
      "source": "官方日历",
      "note": "需要复核的原因"
    }
  ],
  "errors": []
}
```

`group` 只能是 `global`、`industry`、`equity`、`bond`、`futures`、`events`。`cadence` 只能是 `realtime`、`intraday`、`daily`、`weekly`、`monthly`、`quarterly`、`event`。`signal` 范围为 -1 至 1，只表达对执行环境的风险方向，不是买卖信号。

前端会重新验证时间、来源、组别和频率。过期数据仍保留用于追溯，但不会进入当前态势得分；更新失败不会清空上一份快照。
