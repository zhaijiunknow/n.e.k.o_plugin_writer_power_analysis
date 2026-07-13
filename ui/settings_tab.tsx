import { Button, Card, Grid, Stack, Text } from "@neko/plugin-ui"
import type { TabSharedProps } from "./types"

export function SettingsTab(p: TabSharedProps) {
  return (
    <Stack>
      <Card title="模型信息">
        <Stack>
          <Text>模型来源：{p.useNekoModel ? "N.E.K.O 内置" : p.modelSource}</Text>
          <Text>实际模型：{p.result?.model || (p.useNekoModel ? (p.nekoModelInfo?.model || "Neko 未知") : p.effectiveModel) || "-"}</Text>
          <Text>请求端点：{p.result?.endpoint || (p.useNekoModel ? (p.nekoModelInfo?.base_url || "Neko 内置端点") : (p.baseUrl || "-"))}</Text>
          <Text>评分模式：{p.selectedModeMeta?.label || p.selectedMode}</Text>
          <Text>提示词：Ink Battles 三段完整系统提示词 + 模式指令注入。</Text>
          <Button disabled={p.loadingModels || p.useNekoModel} onClick={p.loadModels}>
            {p.loadingModels ? "刷新中..." : "刷新模型列表"}
          </Button>
        </Stack>
      </Card>
      <Card title="已保存平台预设">
        <Stack>
          {p.savedPlatforms.length === 0 ? (
            <Text>暂无保存的预设。在「分析」页面填写自定义 API 后点「保存为预设」即可。</Text>
          ) : (
            p.savedPlatforms.map((preset) => (
              <Card key={preset.id} title={preset.label}>
                <Stack>
                  <Text>URL: {preset.baseUrl}</Text>
                  <Text>模型: {preset.model || "-"}</Text>
                  <Text>列表路径: {preset.modelListPath || "/v1/models"}</Text>
                  <Grid cols={2}>
                    <Button onClick={() => { p.switchPlatform(preset.id); p.setActiveTab("analyze") }}>切换并开始分析</Button>
                    <Button onClick={() => p.removePlatformPreset(preset.id)}>删除</Button>
                  </Grid>
                </Stack>
              </Card>
            ))
          )}
        </Stack>
      </Card>
    </Stack>
  )
}
