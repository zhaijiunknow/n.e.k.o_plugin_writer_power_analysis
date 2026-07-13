/** Shared types for writer_power_analysis panel tabs. */

export type WriterModel = {
  id?: string
  owned_by?: string
}

export type WriterDimension = {
  name?: string
  score?: number
  description?: string
}

export type WriterAnalysis = {
  overallScore?: number
  overallAssessment?: string
  title?: string
  ratingTag?: string
  finalTag?: string
  summary?: string
  tags?: string[]
  dimensions?: WriterDimension[]
  strengths?: string[]
  improvements?: string[]
}

export type AnalyzeResult = {
  analysis?: WriterAnalysis
  report_markdown?: string
  overallScore?: number
  ratingTag?: string
  summary?: string
  model?: string
  endpoint?: string
  fallback_used?: boolean
}

export type ModelListResult = {
  source?: string
  count?: number
  models?: WriterModel[]
  message?: string
}

export type NekoModelInfo = {
  available?: boolean
  model?: string
  base_url?: string
  has_api_key?: boolean
}

export type HistoryEntry = AnalyzeResult & {
  id: string
  time: string
  articleChars: number
}

export type SavedPlatform = {
  id: string
  label: string
  baseUrl: string
  modelListPath: string
  model: string
}

export type WriterPanelState = {
  status?: string
  default_model?: string
  base_url?: string
  model_list_path?: string
  has_api_key?: boolean
}

export type ModeOption = {
  id: string
  label: string
  description: string
}

export type ModelInputMode = "list" | "custom"

/** All state + callbacks shared across tabs. */
export interface TabSharedProps {
  // state getters (values)
  articleText: string
  effectiveModel: string
  customModel: string
  selectedModel: string
  modelInputMode: ModelInputMode
  platformMode: string
  savedPlatforms: SavedPlatform[]
  selectedMode: string
  apiKey: string
  baseUrl: string
  modelListPath: string
  models: WriterModel[]
  modelSource: string
  loadingModels: boolean
  analyzing: boolean
  analyzingStatus: string
  activeTab: string
  errorText: string
  result: AnalyzeResult | null
  history: HistoryEntry[]
  nekoModelInfo: NekoModelInfo | null
  loadingNekoModel: boolean
  modelList: WriterModel[]
  // computed
  useNekoModel: boolean
  isCustomMode: boolean
  analysis: WriterAnalysis | undefined
  dimensions: WriterDimension[]
  articleChars: number
  selectedModeMeta: ModeOption | undefined
  // state setters
  setArticleText: (v: string) => string
  setSelectedModel: (v: string) => string
  setCustomModel: (v: string) => string
  setModelInputMode: (v: ModelInputMode) => ModelInputMode
  setSelectedMode: (v: string) => string
  setApiKey: (v: string) => string
  setBaseUrl: (v: string) => string
  setModelListPath: (v: string) => string
  setActiveTab: (v: string) => string
  setErrorText: (v: string) => string
  // actions
  switchPlatform: (mode: string) => void
  savePlatformPreset: () => Promise<void>
  removePlatformPreset: (id: string) => Promise<void>
  loadModels: () => Promise<void>
  loadNekoModel: () => Promise<void>
  analyze: () => Promise<void>
  reset: () => void
  clearHistory: () => void
  removeHistoryEntry: (id: string) => void
  loadHistoryEntry: (entry: HistoryEntry) => void
  // helpers
  modelOptions: (models: WriterModel[]) => { value: string; label: string }[]
  scoreTone: (s: number | undefined) => string
  maxScoreForDimension: (name: string | undefined) => number
  modes: ModeOption[]
}
