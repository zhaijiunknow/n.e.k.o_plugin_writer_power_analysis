import { Button, Card, Grid, Stack, StatusBadge, Text } from "@neko/plugin-ui"
import type { TabSharedProps } from "./types"

export function HistoryTab(p: TabSharedProps) {
  if (p.history.length === 0) {
    return (
      <Card title="暂无记录">
        <Text>完成分析后，结果会自动出现在这里。可点击卡片查看详情。</Text>
      </Card>
    )
  }

  return (
    <Card title={`分析历史（${p.history.length}）`}>
      <Stack>
        <Button onClick={p.clearHistory}>清空全部历史</Button>
        <Stack>
          {p.history.map((entry) => (
            <Card key={entry.id} title={entry.analysis?.title || "未命名分析"}>
              <Stack>
                <Grid cols={4}>
                  <Text>{entry.time}</Text>
                  <StatusBadge tone={p.scoreTone(entry.overallScore) as any}>{entry.overallScore ?? "-"} 分</StatusBadge>
                  <Text>{entry.model || "-"}</Text>
                  <Text>{entry.articleChars} 字</Text>
                </Grid>
                <Text>{entry.ratingTag || "-"}</Text>
                <Grid cols={2}>
                  <Button tone="primary" onClick={() => { p.loadHistoryEntry(entry); p.setActiveTab("analyze") }}>查看详情</Button>
                  <Button onClick={() => p.removeHistoryEntry(entry.id)}>删除</Button>
                </Grid>
              </Stack>
            </Card>
          ))}
        </Stack>
      </Stack>
    </Card>
  )
}
