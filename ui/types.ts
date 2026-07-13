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

export type MermaidDiagram = {
  type?: string
  title?: string
  code?: string
}

export type ExcellentSentence = {
  content?: string
  reason?: string
}

export type AuthorMatch = {
  name?: string
  styleLabel?: string
  description?: string
  confidence?: number
  reasons?: string[]
}

export type ArticleStyleProfile = {
  storyContent?: string
  coreExpression?: string
  genreType?: string
  languageHabits?: string[]
  sentenceStructures?: string[]
  expressionRhythm?: string
  imageryPreferences?: string[]
  emotionalTendency?: string
  narrativeMode?: string
  spiritualCore?: string
  styleLabel?: string
  summary?: string
  keywords?: string[]
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
  excellentSentences?: ExcellentSentence[]
  articleStyleProfile?: ArticleStyleProfile
  authorMatches?: AuthorMatch[]
  mermaid_diagrams?: MermaidDiagram[]
}

export type AnalyzeResult = {
  analysis?: WriterAnalysis
  report_markdown?: string
  overallScore?: number
  ratingTag?: string
  summary?: string
  model?: string
  mode?: string
  modeLabel?: string
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

export type AuthorStyleTerm = {
  text: string
  count: number
}

export type AuthorStyleProfile = {
  sampleCount: number
  source?: string
  dominantStyle: string
  dominantGenre: string
  summary?: string
  styleLabels: AuthorStyleTerm[]
  genres: AuthorStyleTerm[]
  languageHabits: AuthorStyleTerm[]
  sentenceStructures: AuthorStyleTerm[]
  imageryPreferences: AuthorStyleTerm[]
  keywords: AuthorStyleTerm[]
  rhythms: AuthorStyleTerm[]
  coreExpressions: AuthorStyleTerm[]
  topicPreferences?: string[]
  narrativeTendencies?: string[]
  strengths?: string[]
  risks?: string[]
  evolutionAdvice?: string[]
  confidence?: number
}

export type RunningTask = {
  task_id: string
  status: string
  mode: string
  modeLabel: string
  model: string
  articleText: string
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
  platformName: string
  apiKey: string
  baseUrl: string
  modelListPath: string
  models: WriterModel[]
  modelSource: string
  loadingModels: boolean
  analyzing: boolean
  analyzingStatus: string
  runningTasks: RunningTask[]
  activeTab: string
  errorText: string
  result: AnalyzeResult | null
  history: HistoryEntry[]
  authorStyleProfile: AuthorStyleProfile | null
  authorStyleSynthesizing: boolean
  authorStyleSynthesisError: string
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
  setPlatformName: (v: string) => string
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
