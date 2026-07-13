import {
  Page,
  StatusBadge,
  Tabs,
  Toolbar,
  ToolbarGroup,
  useEffect,
  useToast,
} from "@neko/plugin-ui"
import type { PluginSurfaceProps } from "@neko/plugin-ui"

import { AnalyzeTab } from "./analyze_tab"
import { HistoryTab } from "./history_tab"
import { SettingsTab } from "./settings_tab"
import type {
  AnalyzeResult,
  HistoryEntry,
  ModelInputMode,
  ModelListResult,
  ModeOption,
  NekoModelInfo,
  SavedPlatform,
  TabSharedProps,
  WriterModel,
  WriterPanelState,
} from "./types"

// ── constants ────────────────────────────────────────────────

const modes: ModeOption[] = [
  { id: "standard", label: "标准模式", description: "客观、中立、完整地按后端全维度评分。" },
  { id: "beginner", label: "初窥门径", description: "针对未出版或未获公认的作品设置更保守的上限。" },
  { id: "strict", label: "严苛编辑", description: "收紧评分标准，用于压力测试和找短板。" },
  { id: "reader", label: "宽容读者", description: "放大作品亮点，适合创作早期反馈。" },
  { id: "judge", label: "文本法官", description: "要求评价尽量基于可引用的文本证据。" },
  { id: "fan", label: "热血粉丝", description: "允许明显情感偏好参与评价。" },
  { id: "anti-modern", label: "反现代主义者", description: "降低实验性和形式主义创新权重。" },
  { id: "quick", label: "速写视角", description: "聚焦少数核心维度，快速形成判断。" },
  { id: "fragment", label: "碎片主义护法", description: "强化先锋性、语言原创性和结构实验。" },
]

const fallbackModels: WriterModel[] = [
  { id: "gpt-4.1-mini", owned_by: "openai" },
  { id: "deepseek-v3", owned_by: "deepseek" },
  { id: "glm-4.1", owned_by: "zhipu" },
  { id: "gpt-4.1", owned_by: "openai" },
  { id: "claude-sonnet-5", owned_by: "anthropic" },
]

// ── helpers ──────────────────────────────────────────────────

function unwrapActionResult<T>(envelope: unknown): T {
  if (!envelope || typeof envelope !== "object") return envelope as T
  const data = envelope as Record<string, unknown>
  if ("data" in data && data.data !== undefined) return data.data as T
  if ("result" in data && data.result !== undefined) return data.result as T
  if ("payload" in data && data.payload !== undefined) return data.payload as T
  return envelope as T
}

function normalizeError(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error || "操作失败")
}

function compact(value: unknown, fallback = "-"): string {
  const text = String(value || "").trim()
  return text || fallback
}

function scoreTone(score: number | undefined): "success" | "primary" | "warning" | "danger" | "default" {
  if (typeof score !== "number") return "default"
  if (score >= 80) return "success"
  if (score >= 60) return "primary"
  if (score >= 40) return "warning"
  return "danger"
}

function maxScoreForDimension(name: string | undefined): number {
  const value = String(name || "")
  if (value.includes("经典")) return 2
  if (value.includes("新锐")) return 1.5
  return 5
}

function modelOptions(models: WriterModel[]) {
  return models.map((m) => String(m.id || "").trim()).filter(Boolean).map((id) => ({ value: id, label: id }))
}

// ── main component ──────────────────────────────────────────

export default function WriterPowerAnalysisPanel(props: PluginSurfaceProps<WriterPanelState>) {
  const toast = useToast()
  const safeState = props.state || {}

  // state
  const [articleText, setArticleText] = props.useLocalState("writerArticleText", "")
  const [selectedModel, setSelectedModel] = props.useLocalState("writerSelectedModel", compact(safeState.default_model, "gpt-4.1-mini"))
  const [customModel, setCustomModel] = props.useLocalState("writerCustomModel", compact(safeState.default_model, "gpt-4.1-mini"))
  const [modelInputMode, setModelInputMode] = props.useLocalState<ModelInputMode>("writerModelInputMode", "list")
  const [platformMode, setPlatformMode] = props.useLocalState<string>("writerPlatformMode", "neko")
  const [savedPlatforms, setSavedPlatforms] = props.useLocalState<SavedPlatform[]>("writerSavedPlatforms", [])
  const [selectedMode, setSelectedMode] = props.useLocalState("writerSelectedMode", "standard")
  const [apiKey, setApiKey] = props.useLocalState("writerApiKey", "")
  const [baseUrl, setBaseUrl] = props.useLocalState("writerBaseUrl", compact(safeState.base_url, ""))
  const [modelListPath, setModelListPath] = props.useLocalState("writerModelListPath", compact(safeState.model_list_path, "/v1/models"))
  const [models, setModels] = props.useLocalState<WriterModel[]>("writerModels", fallbackModels)
  const [modelSource, setModelSource] = props.useLocalState("writerModelSource", "builtin_fallback")
  const [loadingModels, setLoadingModels] = props.useLocalState("writerLoadingModels", false)
  const [analyzing, setAnalyzing] = props.useLocalState("writerAnalyzing", false)
  const [analyzingTaskId, setAnalyzingTaskId] = props.useLocalState("writerAnalyzingTaskId", "")
  const [analyzingStatus, setAnalyzingStatus] = props.useLocalState("writerAnalyzingStatus", "")
  const [activeTab, setActiveTab] = props.useLocalState("writerActiveTab", "analyze")
  const [errorText, setErrorText] = props.useLocalState("writerError", "")
  const [result, setResult] = props.useLocalState<AnalyzeResult | null>("writerResult", null)
  const [history, setHistory] = props.useLocalState<HistoryEntry[]>("writerHistory", [])
  const [nekoModelInfo, setNekoModelInfo] = props.useLocalState<NekoModelInfo | null>("writerNekoModelInfo", null)
  const [loadingNekoModel, setLoadingNekoModel] = props.useLocalState("writerLoadingNekoModel", false)

  // computed
  const modelList = models.length > 0 ? models : fallbackModels
  const analysis = result?.analysis
  const dimensions = Array.isArray(analysis?.dimensions) ? analysis.dimensions : []
  const articleChars = String(articleText || "").length
  const selectedModeMeta = modes.find((m) => m.id === selectedMode)
  const useNekoModel = platformMode === "neko"
  const isCustomMode = platformMode === "custom"
  const effectiveModel = compact(modelInputMode === "custom" ? customModel : selectedModel, "gpt-4.1-mini")

  // ── actions ──────────────────────────────────────────────

  function applyPlatformPreset(preset: SavedPlatform) {
    setBaseUrl(preset.baseUrl)
    setModelListPath(preset.modelListPath || "/v1/models")
    if (preset.model) {
      setSelectedModel(preset.model)
      setCustomModel(preset.model)
    }
  }

  async function loadModels() {
    setLoadingModels(true)
    setErrorText("")
    try {
      const payload = unwrapActionResult<ModelListResult>(await props.api.call("list_models", {
        api_key: apiKey.trim(), base_url: baseUrl.trim(), model_list_path: modelListPath.trim(),
      }))
      const nextModels = Array.isArray(payload.models) && payload.models.length > 0 ? payload.models : fallbackModels
      setModels(nextModels)
      setModelSource(compact(payload.source, "builtin_fallback"))
      const current = String(selectedModel || "")
      if (!nextModels.some((m) => m.id === current)) setSelectedModel(String(nextModels[0]?.id || "gpt-4.1-mini"))
      if (payload.message) toast.info(payload.message)
    } catch (error) {
      setErrorText(normalizeError(error))
      toast.error(normalizeError(error))
    } finally { setLoadingModels(false) }
  }

  async function loadNekoModel() {
    setLoadingNekoModel(true)
    try {
      const payload = unwrapActionResult<NekoModelInfo>(await props.api.call("get_neko_model", {}))
      setNekoModelInfo(payload)
      if (!payload.available) toast.warning("未能获取 Neko 当前模型信息，请检查 Neko 的 LLM 配置")
    } catch (error) { toast.error(normalizeError(error)) }
    finally { setLoadingNekoModel(false) }
  }

  function switchPlatform(mode: string) {
    setPlatformMode(mode)
    if (mode === "neko" && !nekoModelInfo) loadNekoModel()
    if (mode !== "neko" && mode !== "custom") {
      const preset = savedPlatforms.find((p) => p.id === mode)
      if (preset) applyPlatformPreset(preset)
    }
  }

  async function savePlatformPreset() {
    const url = baseUrl.trim()
    if (!url) { toast.error("请先填写 Base URL"); return }
    let hostname = url
    try { hostname = new URL(url).hostname } catch (_) { /* raw */ }
    const id = "preset-" + Date.now()
    const preset: SavedPlatform = { id, label: hostname, baseUrl: url, modelListPath: modelListPath.trim() || "/v1/models", model: effectiveModel }
    try {
      const payload = unwrapActionResult<{ presets: SavedPlatform[] }>(await props.api.call("save_platform_preset", preset))
      if (Array.isArray(payload.presets)) setSavedPlatforms(payload.presets)
      setPlatformMode(id)
      toast.success(`已保存预设: ${preset.label}`)
    } catch (_) {
      const next = [...savedPlatforms.filter((p) => p.baseUrl !== preset.baseUrl), preset]
      setSavedPlatforms(next)
      setPlatformMode(id)
      toast.success(`已保存预设（仅本地）: ${preset.label}`)
    }
  }

  async function removePlatformPreset(id: string) {
    try {
      const payload = unwrapActionResult<{ presets: SavedPlatform[] }>(await props.api.call("delete_platform_preset", { preset_id: id }))
      if (Array.isArray(payload.presets)) setSavedPlatforms(payload.presets)
    } catch (_) { setSavedPlatforms(savedPlatforms.filter((p) => p.id !== id)) }
    if (platformMode === id) setPlatformMode("neko")
  }

  async function analyze() {
    const text = String(articleText || "").trim()
    if (!text) { toast.error("请先输入要分析的作品正文"); return }
    setAnalyzing(true)
    setAnalyzingStatus("正在提交分析任务...")
    setErrorText("")
    try {
      const submitResult = unwrapActionResult<{ task_id: string; status: string }>(
        await props.api.call("analyze_text", {
          article_text: text, mode: selectedMode, model: effectiveModel,
          api_key: apiKey.trim(), base_url: baseUrl.trim(),
          model_list_path: modelListPath.trim(), use_neko_model: useNekoModel,
        })
      )
      setAnalyzingTaskId(submitResult.task_id)
      setAnalyzingStatus("分析中...")
      toast.success("任务已提交，后台分析中")
    } catch (error) {
      setErrorText(normalizeError(error))
      toast.error(normalizeError(error))
      setAnalyzing(false)
      setAnalyzingStatus("")
    }
  }

  function reset() {
    setArticleText(""); setResult(null); setErrorText("")
    setAnalyzingTaskId(""); setAnalyzingStatus(""); setAnalyzing(false)
  }

  function clearHistory() { setHistory([]); toast.success("历史记录已清空") }
  function removeHistoryEntry(id: string) { setHistory(history.filter((h) => h.id !== id)) }
  function loadHistoryEntry(entry: HistoryEntry) {
    setResult({
      analysis: entry.analysis, report_markdown: entry.report_markdown,
      overallScore: entry.overallScore, ratingTag: entry.ratingTag,
      summary: entry.summary, model: entry.model, endpoint: entry.endpoint,
      fallback_used: entry.fallback_used,
    })
  }

  // ── effects ───────────────────────────────────────────────

  async function loadSavedPresets() {
    try {
      const payload = unwrapActionResult<{ presets: SavedPlatform[] }>(await props.api.call("load_platform_presets", {}))
      if (Array.isArray(payload.presets)) setSavedPlatforms(payload.presets)
    } catch (_) { /* use LocalStorage cache */ }
  }

  useEffect(() => { switchPlatform("neko"); loadSavedPresets() }, [])

  // poll analysis task
  useEffect(() => {
    if (!analyzingTaskId || !analyzing) return
    let cancelled = false
    const poll = async () => {
      if (cancelled) return
      try {
        const s = unwrapActionResult<{ task_id: string; status: string; result?: AnalyzeResult | null; error?: string | null }>(
          await props.api.call("get_analysis_status", { task_id: analyzingTaskId })
        )
        if (cancelled) return
        if (s.status === "done" && s.result) {
          setResult(s.result)
          setHistory([{ ...s.result, id: "hist-" + Date.now(), time: new Date().toLocaleString(), articleChars }, ...history])
          setAnalyzing(false); setAnalyzingTaskId(""); setAnalyzingStatus("")
          setActiveTab("history")
          toast.success("分析完成")
        } else if (s.status === "error") {
          setErrorText(s.error || "分析失败")
          setAnalyzing(false); setAnalyzingTaskId(""); setAnalyzingStatus("")
          toast.error(s.error || "分析失败")
        } else {
          setAnalyzingStatus(s.status === "running" ? "分析中..." : "排队中...")
          setTimeout(() => { if (!cancelled) poll() }, 3000)
        }
      } catch (_) {
        if (!cancelled) { setAnalyzingStatus("轮询失败，重试中..."); setTimeout(() => { if (!cancelled) poll() }, 5000) }
      }
    }
    poll()
    return () => { cancelled = true }
  }, [analyzingTaskId, analyzing])

  // ── shared props ──────────────────────────────────────────

  const shared: TabSharedProps = {
    articleText, effectiveModel, customModel, selectedModel, modelInputMode,
    platformMode, savedPlatforms, selectedMode, apiKey, baseUrl, modelListPath,
    models, modelSource, loadingModels, analyzing, analyzingStatus, activeTab,
    errorText, result, history, nekoModelInfo, loadingNekoModel, modelList,
    useNekoModel, isCustomMode, analysis, dimensions, articleChars, selectedModeMeta,
    setArticleText, setSelectedModel, setCustomModel, setModelInputMode,
    setSelectedMode, setApiKey, setBaseUrl, setModelListPath, setActiveTab, setErrorText,
    switchPlatform, savePlatformPreset, removePlatformPreset,
    loadModels, loadNekoModel, analyze, reset,
    clearHistory, removeHistoryEntry, loadHistoryEntry,
    modelOptions, scoreTone, maxScoreForDimension, modes,
  }

  // ── tabs ──────────────────────────────────────────────────

  const tabItems = [
    { id: "analyze", label: "分析", content: <AnalyzeTab {...shared} /> },
    { id: "history", label: `历史${history.length > 0 ? ` (${history.length})` : ""}`, content: <HistoryTab {...shared} /> },
    { id: "settings", label: "设置", content: <SettingsTab {...shared} /> },
  ]

  return (
    <Page title="作家战力分析" subtitle="基于 Ink Battles 提示词链路的 AI 写作评分">
      <Toolbar>
        <ToolbarGroup>
          <StatusBadge tone={useNekoModel ? "success" : (apiKey ? "success" : "warning")}>
            {useNekoModel ? "Neko 内置模型" : (apiKey ? "API Key 已就绪" : "需要 API Key")}
          </StatusBadge>
          {analyzing ? <StatusBadge tone="primary">{analyzingStatus || "分析中"}</StatusBadge> : null}
          <StatusBadge tone={result?.fallback_used ? "warning" : "primary"}>
            {result?.fallback_used ? "备用模型" : "完整提示词"}
          </StatusBadge>
        </ToolbarGroup>
      </Toolbar>
      <Tabs activeId={activeTab} items={tabItems} onChange={(id) => setActiveTab(String(id))} />
    </Page>
  )
}
