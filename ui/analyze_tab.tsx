import {
  Alert,
  Button,
  Card,
  Field,
  Grid,
  Input,
  Progress,
  Select,
  Stack,
  StatCard,
  StatusBadge,
  Switch,
  Text,
  Textarea,
  Tip,
} from "@neko/plugin-ui"
import type { TabSharedProps } from "./types"

export function AnalyzeTab(p: TabSharedProps) {
  return (
    <Stack>
      {p.errorText ? <Alert tone="danger">{p.errorText}</Alert> : null}

      <Grid cols={4}>
        <StatCard label="当前平台" value={p.useNekoModel ? "N.E.K.O 内置" : (p.isCustomMode ? "自定义" : (p.savedPlatforms.find(x => x.id === p.platformMode)?.label || "自定义"))} />
        <StatCard label="当前模型" value={p.useNekoModel ? (p.nekoModelInfo?.model || "Neko 当前模型") : (p.effectiveModel || "-")} />
        <StatCard label="输入字数" value={p.articleChars} />
        <StatCard label="综合评分" value={p.result?.overallScore ?? p.analysis?.overallScore ?? "-"} />
      </Grid>

      <Card title="作品正文">
        <Stack>
          <Field label="输入文本" help="粘贴完整章节、片段或样章。">
            <Textarea value={p.articleText} placeholder="在这里粘贴要分析的作品正文..." onChange={p.setArticleText} />
          </Field>
          <Field label="使用平台" help="选择「跟随 Neko」使用内置模型，或「自定义」手动填写 API 端点。">
            <Stack>
              <Switch checked={p.useNekoModel} label={p.useNekoModel ? "跟随 Neko · N.E.K.O 内置" : "跟随 Neko"} onChange={(v) => { if (Boolean(v)) p.switchPlatform("neko") }} />
              {p.useNekoModel && p.nekoModelInfo ? (
                <StatusBadge tone={p.nekoModelInfo.available ? "success" : "warning"}>{p.nekoModelInfo.available ? `当前: ${p.nekoModelInfo.model}` : "Neko 模型不可用"}</StatusBadge>
              ) : null}
              {p.useNekoModel && !p.nekoModelInfo ? (
                <Button disabled={p.loadingNekoModel} onClick={p.loadNekoModel}>{p.loadingNekoModel ? "获取中..." : "获取 Neko 模型信息"}</Button>
              ) : null}
              <Switch checked={p.isCustomMode} label="自定义" onChange={(v) => { if (Boolean(v)) p.switchPlatform("custom") }} />
              {p.savedPlatforms.map((preset) => (
                <Switch key={preset.id} checked={p.platformMode === preset.id} label={preset.label} onChange={(v) => { if (Boolean(v)) p.switchPlatform(preset.id) }} />
              ))}
            </Stack>
          </Field>
          {!p.useNekoModel ? (
            <>
              <Grid cols={2}>
                <Field label="Base URL"><Input value={p.baseUrl} placeholder="https://api.openai.com" onChange={p.setBaseUrl} /></Field>
                <Field label="API key" help="不会在结果中显示。"><Input value={p.apiKey} placeholder="sk-..." onChange={p.setApiKey} /></Field>
              </Grid>
              <Grid cols={2}>
                <Field label="模型列表路径"><Input value={p.modelListPath} placeholder="/v1/models" onChange={p.setModelListPath} /></Field>
                <Field label="模型输入方式">
                  <Select value={p.modelInputMode} options={[{ value: "list", label: "从列表选择" }, { value: "custom", label: "手动输入" }]} onChange={(v) => p.setModelInputMode(String(v) === "custom" ? "custom" : "list")} />
                </Field>
              </Grid>
              <Grid cols={2}>
                {p.modelInputMode === "custom" ? (
                  <Field label="自定义模型 ID"><Input value={p.customModel} placeholder="gpt-4.1-mini / your-model" onChange={p.setCustomModel} /></Field>
                ) : (
                  <Field label="评分模型"><Select value={p.selectedModel} options={p.modelOptions(p.modelList)} onChange={(v) => p.setSelectedModel(String(v))} /></Field>
                )}
                <Field label="保存配置" help="保存当前平台为预设。"><Button onClick={p.savePlatformPreset}>保存为预设</Button></Field>
              </Grid>
            </>
          ) : null}
          <Grid cols={2}>
            <Field label="评分模式">
              <Select value={p.selectedMode} options={p.modes.map((m) => ({ value: m.id, label: m.label }))} onChange={(v) => p.setSelectedMode(String(v))} />
            </Field>
          </Grid>
          <Tip>{p.selectedModeMeta?.description || "标准模式会使用完整评分体系。"}</Tip>
          <Stack>
            <Button tone="primary" disabled={p.analyzing || !p.articleText.trim() || (!p.useNekoModel && !p.effectiveModel)} onClick={p.analyze}>
              {p.analyzing ? (p.analyzingStatus || "分析中...") : "开始战力分析"}
            </Button>
            <Button disabled={p.loadingModels || p.useNekoModel} onClick={p.loadModels}>{p.loadingModels ? "刷新中..." : "刷新模型列表"}</Button>
            <Button disabled={p.analyzing} onClick={p.reset}>清空</Button>
          </Stack>
          {p.analyzing ? <Progress label={p.analyzingStatus || "分析中"} value={p.analyzingStatus === "排队中..." ? 10 : 50} /> : null}
        </Stack>
      </Card>

      {p.analysis ? (
        <Card title="分析结果">
          <Stack>
            <Grid cols={3}>
              <StatCard label="作品标题" value={p.analysis.title || "未命名评价"} />
              <StatCard label="最终标签" value={p.analysis.finalTag || "-"} />
              <StatCard label="分数区间" value={<StatusBadge tone={p.scoreTone(p.analysis.overallScore) as any}>{String(p.analysis.overallScore ?? "-")}</StatusBadge>} />
            </Grid>
            <Grid cols={2}>
              <Card title="概述"><Text>{p.analysis.summary || p.result?.summary || "-"}</Text></Card>
              <Card title="综合评价"><Text>{p.analysis.overallAssessment || "-"}</Text></Card>
            </Grid>
            {p.dimensions.length > 0 ? (
              <Card title="维度评分">
                <Stack>
                  {p.dimensions.map((d, i) => {
                    const max = p.maxScoreForDimension(d.name)
                    const raw = typeof d.score === "number" ? d.score : 0
                    return (
                      <Stack key={`${d.name || "dim"}-${i}`}>
                        <Text>{`${d.name || "未命名"} · ${raw}/${max}`}</Text>
                        <Progress label="得分比例" value={Math.max(0, Math.min(100, Math.round((raw / max) * 100)))} />
                        <Text>{d.description || "-"}</Text>
                      </Stack>
                    )
                  })}
                </Stack>
              </Card>
            ) : null}
            <Grid cols={2}>
              <Card title="优势"><Stack>{(p.analysis.strengths || []).length > 0 ? (p.analysis.strengths || []).map((s, i) => <Text key={`s-${i}`}>- {s}</Text>) : <Text>-</Text>}</Stack></Card>
              <Card title="改进建议"><Stack>{(p.analysis.improvements || []).length > 0 ? (p.analysis.improvements || []).map((s, i) => <Text key={`i-${i}`}>- {s}</Text>) : <Text>-</Text>}</Stack></Card>
            </Grid>
            <Card title="Markdown 报告"><Textarea value={p.result?.report_markdown || ""} onChange={() => undefined} /></Card>
          </Stack>
        </Card>
      ) : null}
    </Stack>
  )
}
