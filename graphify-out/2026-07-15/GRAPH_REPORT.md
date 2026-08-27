# Graph Report - text-to-speech  (2026-07-15)

## Corpus Check
- 389 files · ~782,362 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2600 nodes · 7393 edges · 224 communities (112 shown, 112 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 111 edges (avg confidence: 0.7)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `a7c81658`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Study Plan Adaptation
- Demo Fixture Data
- Shared Feature UI Widgets
- First-Run Activation
- Learn Audio Generation Script
- Graphify Skill Docs
- App Layout & AI Settings
- Electron Main Process
- Local Store Repository
- Landing Site UI
- Home Page Shell
- Study Transcript Review
- Speech Input UI
- AI Settings API
- Native Audio Decoding
- Ingestion API Routes
- Local Server Routes
- Card API Integration Tests
- Discover & Provider Selection
- provider.ts
- W5 Decision-Gate Scorer
- Plan Generation API
- SRS Analytics Dashboard
- Package Dependencies
- Card Export API
- APKG Export Handling
- Anki Deck Builder
- Correction Input Forms
- Card Prompt Builders
- SRS Cycle Planner
- Runtime Status API
- Native Data Directories
- Landing Package Config
- Progress Scoring Model
- Study Session Modes
- Provider Selection Constants
- Landing TypeScript Config
- Electron Builder Config
- Ollama Card Provider
- Root TypeScript Config
- OpenRouter Card Provider
- NPM Build Scripts
- Card Deck Preview UI
- CEFR Band Gating
- IndexedDB Access Layer
- Content Discovery Pipeline
- Animation Review Skills
- Pronunciation Practice UI
- Conversation Providers
- Dev Dependencies
- Audio Player & History
- Progress Model Tests
- Study Card Scaffolding
- Card Language Orientation
- Lesson View UI
- Pronunciation Scoring
- effort.ts
- Fatigue-Aware Band Queue
- Theme Generation API
- Installer Build Script
- Turborepo Config
- Progress Overview UI
- Semantic Card Dedup
- Claude Card Provider
- C1 Phase Proposal
- W5 Validation Protocol
- Product Strategy Docs
- Native Audio Clip Docs
- Electron Preload Bridge
- Demo Fixture Builder
- schema.ts
- shared.ts
- Landing Hero Imagery
- Package Metadata
- App Context Providers
- Sync Opt-In Illustration
- Data Pipeline Illustration
- Positioning & Structure Docs
- Card Pipeline Docs
- Waitlist Demand Test
- ollama.ts
- Product Identity & ICP
- Electron App Icon
- useStageTimer
- ErrorEvent
- App Logo Brand Mark
- Waitlist API Route
- App Favicon
- classifyProviderFailure
- Learning Plan Docs
- Loading Splash Screen
- audio.ts
- studySession.ts
- Graphify Usage Rules
- Landing ESLint Config
- Landing Next Config
- route.ts
- Window Icon Asset
- Mac Build Script
- Windows Build Script
- Root Next Config
- Root PostCSS Config
- File Icon Asset
- Globe Icon Asset
- Vercel Logo Asset
- Apple Touch Icon
- Root Page
- Next.js Logo Asset
- Pluggable Providers Note
- Native RPath Fix Script
- graphify reference: query, path, explain
- cyclePlanner.ts
- graphify reference: add a URL and watch a folder
- graphify reference: incremental update and cluster-only
- Exact 64-lesson backlog
- graphify reference: GitHub clone and cross-repo merge
- graphify reference: transcribe video and audio
- CLAUDE.md
- extraction-spec.md
- Motion Effect Glossary
- Project /vocabulary Page
- Emil Kowalski Animation Philosophy (animations.dev)
- Review Animations Skill
- Ten Non-Negotiable Animation Standards
- Per-Element Duration Budgets
- Easing Decision Rules
- Animation Frequency Table
- GPU-Only Property Rule
- Interruptibility (Transitions vs Keyframes)
- Reduced Motion Accessibility
- Spring Animation Configuration
- Graphify Export Formats
- Graphify MCP Server
- Discrete Confidence Rubric
- Node ID Format (Full-Path Stem)
- Extraction Subagent Prompt Spec
- GitHub Clone and Cross-Repo Merge
- Commit Hook and CLAUDE.md Integration
- Constrained Query Expansion
- Query, Path, Explain Flows
- Work Memory Feedback Loop (save-result / reflect)
- Whisper Domain-Hint Prompt
- Whisper Video Transcription
- build_merge Replace-on-Re-extract
- Incremental Update and Cluster-Only
- Structural AST Extraction
- Community Detection and Labeling
- Cumulative Cost Tracker
- Semantic Extraction Cache
- Fast Path: Query Existing Graph
- Graph Health Check
- Graphify Build Pipeline
- Graphify Skill (Claude Code)
- Graphify Honesty Rules
- Parallel Semantic Extraction Subagents
- Shrink Guard (#479)
- PhraseLoop API Surfaces
- PHRASELOOP_DATA_DIR Isolation
- Kokoro TTS Model
- PhraseLoop App
- Playwright GUI Drive
- Verify PhraseLoop Skill
- Whisper Speech Recognition Model (PhraseLoop)
- Frozen Surfaces List
- Qualified Waitlist (W5 Demand Test)
- POST /api/waitlist Endpoint
- Graphify /graphify Trigger Instruction
- Graphify Usage Rules (CLAUDE.md)
- Activation Event Model (product.md)
- Adaptive Cycle Shipped Infrastructure
- Applied Research Principles (Flow, ZDP, Challenge Point, Desirable Difficulties)
- Competitive Positioning (The Step Before Anki)
- Product One-Sentence (Fonte de Verdade)
- AnkiExporter.tsx
- Conversation Practice (Converse)
- Correction Ingestion (ErrorEvent Path)
- Critique Gate (keep / rewrite / drop)
- Directed Generation (Gerar +)
- EffortSnapshot (Weekly Effort Measurement)
- Card Grounding
- Structured 90-Day Learning Plan
- Native Clip Slicing
- Provider-Agnostic Generation Contract
- Reinforcement Loop (Reforçar)
- Semantic Dedup (Embedding Cosine)
- SRS Engine (ts-fsrs)
- Weakness Detection (The Tutor)
- returnMoment.test.ts
- route.ts
- bandQueue.test.ts
- useDockDueBadge.ts
- 008 — Remove the redundant FLIP `layout` prop from CorrectionList's list items
- 009 — Convert Disclosure's expand/collapse to a CSS grid-rows reveal
- 3. Card pipeline — build status
- useUnlockedTabs.ts
- Critica De Produto
- 010 — Add a focus trap and focus-return to the shared Modal
- mac
- Native Audio Clip Library (native-audio/)
- First-Run Audio Gate (yarn learn:audio:verify)
- Provenance Manifest (manifest.json)
- Five-Second Promise
- Local Speech Runtime (Kokoro + Whisper)
- Mistakes Become Drills Differentiator
- Native Source Audio Differentiator
- YouTube Audio Import Pipeline (yt-dlp + whisper.cpp)
- store.ts
- 003 — Stop re-fetching the entire reviews store on every card grade
- 005 — Adopt `LazyMotion` + `m` for the always-mounted shared UI and app shell
- band.ts
- Exact 64-lesson backlog
- route.integration.test.ts
- useUnlockedTabs.ts
- Release gates and waves
- lessonFlow.ts
- nsis
- dedupe.ts
- LevelTestFlow.tsx
- inputOutput.integration.test.ts
- TabErrorBoundary

## God Nodes (most connected - your core abstractions)
1. `useT()` - 100 edges
2. `cn()` - 70 edges
3. `Card` - 55 edges
4. `ErrorEvent` - 54 edges
5. `GenerationRunOptions` - 42 edges
6. `ProviderKind` - 42 edges
7. `getLearningProfile()` - 38 edges
8. `Card()` - 36 edges
9. `Button` - 35 edges
10. `readJsonObject()` - 35 edges

## Surprising Connections (you probably didn't know these)
- `lessonAudioItems()` --indirect_call--> `line()`  [INFERRED]
  scripts/generate-learn-audio.mjs → src/features/study/components/SessionSummary.test.ts
- `lessonClipMap()` --indirect_call--> `line()`  [INFERRED]
  scripts/generate-learn-audio.mjs → src/features/study/components/SessionSummary.test.ts
- `extractTranslatedMessageKeys()` --indirect_call--> `line()`  [INFERRED]
  scripts/validate-lesson-content.mjs → src/features/study/components/SessionSummary.test.ts
- `addDuplicateErrors()` --indirect_call--> `value()`  [INFERRED]
  scripts/validate-lesson-content.mjs → src/app/api/settings/runtime/route.ts
- `POST()` --references--> `jszip`  [EXTRACTED]
  src/app/api/tts/route.ts → package.json

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Device -> Toggle -> Cloud Sync Flow** — apps_landing_public_image_1_device, apps_landing_public_image_1_toggle_check, apps_landing_public_image_1_cloud [INFERRED 0.85]
- **Data-to-Structured-Content Pipeline depicted in landing hero** — apps_landing_public_image_2_input_sources, apps_landing_public_image_2_processing_engine, apps_landing_public_image_2_data_streams, apps_landing_public_image_2_output_cards [EXTRACTED 1.00]
- **Icons form a text-to-audio pipeline motif around the product core** — apps_landing_public_image_3_document_icon, apps_landing_public_image_3_audio_waveform_icons, apps_landing_public_image_3_headphones_icon, apps_landing_public_image_3_shield_cube_core [INFERRED 0.85]
- **App Icon Visual Composition: waveform flowing into a document via conversion arrow** — electron_assets_icon_appicon, electron_assets_icon_audio_waveform, electron_assets_icon_text_document, electron_assets_icon_speech_text_conversion [EXTRACTED 1.00]
- **Waveform, Document, and Correction Arrow Form the Brand Mark** — public_logo_audio_waveform_motif, public_logo_document_motif, public_logo_correction_arrow_motif, public_logo_applogo [EXTRACTED 1.00]
- **Waveform, Document, and Conversion Concept Form the App Brand Mark** — src_app_icon_appicon, src_app_icon_audio_waveform, src_app_icon_text_document, src_app_icon_speech_text_conversion [INFERRED 0.85]

## Communities (224 total, 112 thin omitted)

### Community 0 - "Study Plan Adaptation"
Cohesion: 0.06
Nodes (61): POST(), validEntry, metadata, structuredData, AppMockup(), HeroSection(), HeroSectionProps, InsideSection() (+53 more)

### Community 1 - "Demo Fixture Data"
Cohesion: 0.11
Nodes (24): actionForStage(), activityMinutes(), add(), AREA_LABEL, balanceFor(), DEFAULT_TARGET, deriveMethodPlan(), lastStageAt() (+16 more)

### Community 2 - "Shared Feature UI Widgets"
Cohesion: 0.08
Nodes (44): TabErrorBoundaryProps, TabErrorBoundaryState, TabErrorFallback(), ButtonProps, buttonVariants, Card(), CardProps, WorkflowSteps() (+36 more)

### Community 3 - "First-Run Activation"
Cohesion: 0.05
Nodes (97): useDockDueBadge(), computeUnlockedTabTier(), highestNewTab(), tabsForUnlockTier(), UnlockSignals, useUnlockedTabs(), LessonViewContent(), resultForLesson() (+89 more)

### Community 4 - "Learn Audio Generation Script"
Cohesion: 0.11
Nodes (40): Segmented(), SegmentedOption, SegmentedProps, C1Tab(), DeckGeneration, DeckGenerationOptions, GenerationStage, useDeckGeneration() (+32 more)

### Community 6 - "App Layout & AI Settings"
Cohesion: 0.12
Nodes (16): RetryStepProps, production(), ProgressData, ProgressInput, StoredProgressAssessment, NOW, buildTransferActivities(), TransferActivity (+8 more)

### Community 7 - "Electron Main Process"
Cohesion: 0.07
Nodes (54): args, AUDIO_DELIVERIES, AUDIO_KINDS, audioMetadataForClip(), buildCoverage(), CEFR_AUDIO_COVERAGE_RULES, collectNativeRecordings(), createTts() (+46 more)

### Community 8 - "Local Store Repository"
Cohesion: 0.13
Nodes (19): POST(), GET(), GET(), POST(), POST(), safeLang(), POST(), POST() (+11 more)

### Community 9 - "Landing Site UI"
Cohesion: 0.19
Nodes (19): MethodArea, MethodBalance, MethodRoute, WeeklyMethodDay, weeklyMethodDayForDate(), WeeklyMethodFocus, weeklyMethodTemplate(), weeklyRhythm (+11 more)

### Community 10 - "Home Page Shell"
Cohesion: 0.15
Nodes (13): 6. Structured 90-day learning plan — shipped, Activity log (camada nova necessária), Adaptação do plano, Conceito central, Estrutura do plano, Inputs do usuário (onboarding do plano), Integração com o que já existe, Medição de esforço (+5 more)

### Community 11 - "Study Transcript Review"
Cohesion: 0.07
Nodes (39): AI_SETTINGS_FALLBACK_FILE, APKG_DEBUG_LOG_FILE, { app, BrowserWindow, ipcMain, Menu, shell, utilityProcess }, APP_ICON_PNG, boot(), children, clearOwnQuarantine(), crypto (+31 more)

### Community 12 - "Speech Input UI"
Cohesion: 0.17
Nodes (19): GOAL_OPTIONS, OnboardingDialog(), subscribe(), clampGoal(), completeOnboarding(), isEnglishLevel(), isOnboardingComplete(), LearningTrack (+11 more)

### Community 13 - "AI Settings API"
Cohesion: 0.12
Nodes (29): GRADE_TONE, GradeButtons(), card(), freshCard(), stableCard(), bandGateMetrics, BandVerdict, CardLike (+21 more)

### Community 14 - "Native Audio Decoding"
Cohesion: 0.19
Nodes (16): HomeContent(), Overlay, recommendedLessonId(), resolveLessonId(), HojeHome(), NextAction, resolveNextAction(), routeHandler() (+8 more)

### Community 15 - "Ingestion API Routes"
Cohesion: 0.17
Nodes (36): POST(), cardProviderKind(), POST(), conversationProviderKind(), parseTurns(), POST(), POST(), toEnglishLevel() (+28 more)

### Community 16 - "Local Server Routes"
Cohesion: 0.14
Nodes (26): PROVIDER_FALLBACK_LABELS, GET(), GET(), GET(), LABELS, PATCH(), POST(), ollamaApiRoot() (+18 more)

### Community 17 - "Card API Integration Tests"
Cohesion: 0.09
Nodes (30): ActivationTiming, FirstRunActivationSource, ActivationDropoffStep, ActivationMetrics, computeActivationMetrics(), emptyMetrics(), formatActivationDuration(), isCorrectionSavedEvent() (+22 more)

### Community 18 - "Discover & Provider Selection"
Cohesion: 0.17
Nodes (21): ComprehensionQuestion, evaluateAttempt(), FillInQuestion, gradeObjectiveSections(), LevelTest, LevelTestContent, nonEmptyStr(), normalizeAnswer() (+13 more)

### Community 19 - "provider.ts"
Cohesion: 0.12
Nodes (22): BRACKETED_NON_SPEECH_RE, collapseWhisperOverlaps(), createAsync(), GeneratedAudio, getTts(), NON_SPEECH_MARKER, normalizeKey(), normalizeWhisper() (+14 more)

### Community 20 - "W5 Decision-Gate Scorer"
Cohesion: 0.23
Nodes (12): evaluateCorrectionText(), RetryStep(), focusFeedback(), prioritizeFeedback(), FeedbackIssues(), MethodProgressionState, EMPTY_DATA, FeedbackPriorityCard() (+4 more)

### Community 21 - "Plan Generation API"
Cohesion: 0.07
Nodes (42): AppProviders(), DEMO_CARD_IDS, DEMO_PHRASES, demoDeckFor(), DemoPhrase, demoResult, isLevelAtLeast(), LEVEL_RANK (+34 more)

### Community 22 - "SRS Analytics Dashboard"
Cohesion: 0.26
Nodes (10): generateLevelTest(), gradeLevelWriting(), LevelTestFlow(), LevelTestFlowProps, Stage, AttemptEvaluation, LevelTestAnswers, WritingGradeSummary (+2 more)

### Community 23 - "Package Dependencies"
Cohesion: 0.18
Nodes (16): CATEGORY_BY_ERROR, FeedbackCategory, feedbackIssue, FeedbackIssueBase, feedbackKey(), FeedbackPriority, FeedbackPriorityOptions, IMPACT_BY_CATEGORY (+8 more)

### Community 24 - "Card Export API"
Cohesion: 0.12
Nodes (26): ReadinessCoachProps, BandThresholds, clamp01(), computeLevelReadiness(), gapEvidence(), isBlocking(), LADDER, LevelReadiness (+18 more)

### Community 25 - "APKG Export Handling"
Cohesion: 0.14
Nodes (34): createApkgDebugId(), audioPathFor(), ensureKokoroModel(), ensureOnce(), ensureWhisperModel(), kokoroInstalled(), modelStatus, whisperInstalled() (+26 more)

### Community 26 - "Anki Deck Builder"
Cohesion: 0.07
Nodes (28): dependencies, ankipack, @anthropic-ai/sdk, audio-decode, class-variance-authority, clsx, csv-parse, @kutalia/whisper-node-addon (+20 more)

### Community 27 - "Correction Input Forms"
Cohesion: 0.15
Nodes (26): RFC-5987, RFC-6266, ApkgErrorPayload, csvEscapeCell(), isProbablyJsonUpload(), isTimeoutOrAbort(), jsonToCsvBytes(), jsonToCsvBytesFromParsed() (+18 more)

### Community 28 - "Card Prompt Builders"
Cohesion: 0.19
Nodes (18): DELETE(), GET(), dataDir(), discoverCacheDir(), linuxDataDirs(), modelDirs(), modelsDir(), active (+10 more)

### Community 29 - "SRS Cycle Planner"
Cohesion: 0.44
Nodes (6): ThemeResponse, DiscoveryRequest, PhraseCandidate, TranscriptSegment, buildMineRequest(), normalizeMined()

### Community 30 - "Runtime Status API"
Cohesion: 0.16
Nodes (25): abortError(), basicModel(), buildCardsDeck(), buildCsvDeck(), cardModel(), column(), digestAlgorithmName(), digestData() (+17 more)

### Community 31 - "Native Data Directories"
Cohesion: 0.07
Nodes (25): Aggressive Escalation Triggers, Guidelines, Operating Posture, Part 1 — Findings table (REQUIRED), Part 2 — Verdict (REQUIRED), Remedial Preference Hierarchy, Required Output Format, Reviewing Animations (+17 more)

### Community 32 - "Landing Package Config"
Cohesion: 0.06
Nodes (41): archivoBlack, fontVariables, metadata, viewport, fontVariables, metadata, AppHeader(), AppHeaderProps (+33 more)

### Community 33 - "Progress Scoring Model"
Cohesion: 0.12
Nodes (19): AudioPlayer(), AudioPlayerProps, ENGINE_LABELS, HistoryItem(), HistoryItemProps, HistoryPanelProps, VOICE_LABELS, SpeechTab() (+11 more)

### Community 34 - "Study Session Modes"
Cohesion: 0.38
Nodes (9): decodeAudio(), DecodedAudio, mono(), resample(), sliceAudio(), sliceDecodedAudio(), wav(), assessPronunciation() (+1 more)

### Community 35 - "Provider Selection Constants"
Cohesion: 0.14
Nodes (22): addDuplicateErrors(), buildCoverageReport(), currentPath, exists(), extractMessageKeys(), extractTranslatedMessageKeys(), findChunk(), inspectWav() (+14 more)

### Community 36 - "Landing TypeScript Config"
Cohesion: 0.08
Nodes (24): For /graphify add and --watch, For /graphify query, For the commit hook and native CLAUDE.md integration, For --update and --cluster-only, /graphify, Honesty Rules, Interpreter guard for subcommands, Part A - Structural extraction for code files (+16 more)

### Community 37 - "Electron Builder Config"
Cohesion: 0.09
Nodes (23): Arquitetura Resumida, Ciclo Adaptativo Shipped, Decisao Central De Identidade, Decisao Final, Diferenciais, Estado Atual, Fase C1 Experimental, Guardrails De Launch (+15 more)

### Community 38 - "Ollama Card Provider"
Cohesion: 0.13
Nodes (20): ScaffoldTelemetry, buildLightQueue(), hasAudio(), isSaturated(), SessionMode, computePerformance(), computeReturnAfterMiss(), computeWeeklyActivity() (+12 more)

### Community 39 - "Root TypeScript Config"
Cohesion: 0.10
Nodes (28): HojeHomeProps, AVAILABILITY_OPTIONS, CALENDAR_STATUS_DOT, CALENDAR_STATUS_RING, MONTH_NAMES, PLAN_DAYS_OPTIONS, TASK_COLORS, TASK_LABELS (+20 more)

### Community 40 - "OpenRouter Card Provider"
Cohesion: 0.08
Nodes (23): dependencies, motion, next, next-themes, react, react-dom, devDependencies, eslint (+15 more)

### Community 42 - "Card Deck Preview UI"
Cohesion: 0.19
Nodes (6): CorrectOptions, GenerationRunOptions, ClaudeProvider, OllamaProvider, OpenRouterProvider, CardSource

### Community 43 - "CEFR Band Gating"
Cohesion: 0.09
Nodes (20): 1. Bugs & correctness, 2. Performance, 3. Accessibility, 4. Security, 5. Maintainability & architecture, React Audit Playbook, Working rule, Notes for the plan author (+12 more)

### Community 44 - "IndexedDB Access Layer"
Cohesion: 0.13
Nodes (27): ManualEntryFormProps, CORRECTION_ERROR_TYPES, CORRECTION_INPUT_OPTIONS, CorrectionDraft, CorrectionInputMode, ERROR_TYPE_SET, newDraft(), parseErrorsJson() (+19 more)

### Community 45 - "Content Discovery Pipeline"
Cohesion: 0.20
Nodes (24): activeDayCount(), avg(), buildMilestones(), clampScore(), computeProgressSnapshot(), confidenceFor(), ConfidenceIndicators, errorTrend() (+16 more)

### Community 47 - "Pronunciation Practice UI"
Cohesion: 0.13
Nodes (16): ProviderBadge(), ProviderBadgeProps, StatusPill(), StatusPillProps, toneClass, FlaggedItem, GrammarGap, ProviderPicker() (+8 more)

### Community 48 - "Conversation Providers"
Cohesion: 0.11
Nodes (16): generateDeck, localJson, localRequest, groupRefinementsByDimension(), RegisterGap, refinement(), C1Diagnosis, NaturalnessReviewProps (+8 more)

### Community 49 - "Dev Dependencies"
Cohesion: 0.23
Nodes (13): PlanOnboardingProps, countTaskEvidence(), EvidencePayload, payload(), PlanEvidenceTask, taskEvidenceMeetsTarget(), TodayPlanState, useTodayPlan() (+5 more)

### Community 50 - "Audio Player & History"
Cohesion: 0.22
Nodes (9): 3. Card pipeline — build status, Active product priority, ✅ Close the loop — ingestion → card → Anki, ✅ Done — foundation, Historical build order, ✅ More material sources, ✅ Persistence & study (the long-game), ✅ The brain — quality generation (the differentiator) (+1 more)

### Community 51 - "Progress Model Tests"
Cohesion: 0.10
Nodes (20): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+12 more)

### Community 52 - "Study Card Scaffolding"
Cohesion: 0.27
Nodes (12): alignWords(), assessPronunciationText(), clampScore(), CONTRACTIONS, editDistance(), escapeRegExp(), fluencyScore(), normalizePronunciationWords() (+4 more)

### Community 53 - "Card Language Orientation"
Cohesion: 0.10
Nodes (20): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+12 more)

### Community 54 - "Lesson View UI"
Cohesion: 0.16
Nodes (18): DeckGenerationResult, Embedder, abortError(), CardGenerationProvider, debug(), DeckResult, generateDeck(), generateVettedCards() (+10 more)

### Community 55 - "Pronunciation Scoring"
Cohesion: 0.19
Nodes (20): SessionResult, SessionSummary(), summarize(), line(), makeResult(), makeSrs(), t(), tomorrowLine() (+12 more)

### Community 56 - "effort.ts"
Cohesion: 0.21
Nodes (10): DueCardLike, endOfTomorrowLocal(), localDayIndex(), mistakeCardStats(), ReturnMoment, returnMomentFor(), NOW, TWO_DAYS_AGO (+2 more)

### Community 57 - "Fatigue-Aware Band Queue"
Cohesion: 0.12
Nodes (16): build, appId, dmg, extraResources, files, mac, productName, win (+8 more)

### Community 58 - "Theme Generation API"
Cohesion: 0.10
Nodes (20): scripts, app, app:dist, app:download, app:linux, app:windows, build, dev (+12 more)

### Community 59 - "Installer Build Script"
Cohesion: 0.11
Nodes (17): Animation Vocabulary, Easing — how speed changes over an animation, Entrances & Exits — how elements appear and disappear, Examples, Feedback & Interaction — responding to the user's actions, Glossary, Instructions, Looping & Ambient Motion — animations that run on their own (+9 more)

### Community 60 - "Turborepo Config"
Cohesion: 0.08
Nodes (47): Button, Field(), FieldProps, Input, Label(), Textarea, Modal(), Notice() (+39 more)

### Community 61 - "Progress Overview UI"
Cohesion: 0.21
Nodes (17): dedupeSegments(), discoverArticle(), discoverPdf(), DiscoverResult, discoverYouTube(), downloadedAudio(), execFileAsync, ffmpegDir() (+9 more)

### Community 62 - "Semantic Card Dedup"
Cohesion: 0.36
Nodes (7): isLanguageCode(), isNativeLanguageCode(), isTargetLanguageCode(), Language, LANGUAGES, NATIVE_LANGUAGES, TARGET_LANGUAGES

### Community 63 - "Claude Card Provider"
Cohesion: 0.29
Nodes (7): 1. What this is, 7. Method implementation status, 8. Design and UX rules, 9. Technical backlog, Linguagem visual, PhraseLoop — Architecture & Build Record, Regras de jornada

### Community 64 - "C1 Phase Proposal"
Cohesion: 0.35
Nodes (9): FirstRunActivation, getStorage(), markFirstRunPhrasesSaved(), markFirstRunReviewCompleted(), read(), startFirstRunActivation(), StorageLike, timing() (+1 more)

### Community 65 - "W5 Validation Protocol"
Cohesion: 0.39
Nodes (7): PLAN_METRIC_ACTIONS, PLAN_TASK_TYPES, GeneratedDay, GeneratedTask, validateGeneratedDays(), validatePlanResult(), validateTask()

### Community 68 - "Electron Preload Bridge"
Cohesion: 0.29
Nodes (7): 2. The card pipeline — architecture, Discovery flow: extract → curate → review, Provider matrix, Two design commitments (from product decisions), Two ingestion paths, one output, What changes in the existing `.apkg` engine, YouTube: audio only, with per-phrase native clips

### Community 69 - "Demo Fixture Builder"
Cohesion: 0.13
Nodes (15): devDependencies, electron, electron-builder, eslint, eslint-config-next, fake-indexeddb, tailwindcss, @tailwindcss/postcss (+7 more)

### Community 70 - "schema.ts"
Cohesion: 0.13
Nodes (15): Advanced AI Providers, Advanced Anki Export, Building the macOS app, Deploying to Vercel, Distributing the app, Features, Head to head, PhraseLoop (+7 more)

### Community 71 - "shared.ts"
Cohesion: 0.10
Nodes (25): buildLevelTestPrompt(), buildWritingGradePrompt(), AdvancedReviewResult, buildCritiqueRequest(), CEFR_LANGUAGE_PROFILE, cefrLanguageLine(), coerceErrorType(), CorrectedError (+17 more)

### Community 72 - "Landing Hero Imagery"
Cohesion: 0.43
Nodes (8): Audio Waveform Icons (blue and orange, speech/audio motif), Text Document Icon (text input motif), Headphones Icon (listening motif), Landing Hero Illustration (image-3.png), Network Graph Icon (connected concepts motif), Orbital Ring Composition (icons connected by dotted paths around core), Central Shield with Glowing Cube (product core motif), Text-to-Speech Pipeline (product value proposition)

### Community 73 - "Package Metadata"
Cohesion: 0.30
Nodes (12): basename(), DeckPreview(), DeckPreviewProps, ankiConnect(), browserDownload(), csvCell(), DeckPayload, exportAndSaveDeck() (+4 more)

### Community 74 - "App Context Providers"
Cohesion: 0.29
Nodes (7): 4. Pre-launch TODO, Critical Fixes (blockers), Features to Transform, Future (post-v1), High-Impact (v1 scope), Nice-to-Have, UX States (missing)

### Community 75 - "Sync Opt-In Illustration"
Cohesion: 0.43
Nodes (7): Gray Dotted Path Ending in X (Blocked/Disabled Route), Cloud with Active Sync Indicator, Concept: User-Controlled Data Sync (Opt-In Cloud Connection), Dark Rounded Device on Pedestal, Landing Illustration: Device-to-Cloud Sync, Soft Pastel 3D Illustration Style (Cream/Orange/Green Palette), Toggle Switch with Orange Checkmark (Enabled State)

### Community 76 - "Data Pipeline Illustration"
Cohesion: 0.52
Nodes (7): Calm Landscape Motif (sun over hills in circular frame, muted warm palette), Flowing Data Streams (orange, blue, green curved lines with node dots), Knowledge Graph Card (rightmost card showing a connected node diagram), Landing Hero Illustration: Data-to-Cards Pipeline, Input Sources (database cylinders, keypad device, raw sphere), Structured Output Cards (four content cards with text lines and highlights), Processing Engine (dark device with glowing orange core)

### Community 77 - "Positioning & Structure Docs"
Cohesion: 0.30
Nodes (14): containsPortugueseAccent(), ENGLISH_MARKERS, isLikelyEnglish(), isLikelyPortuguese(), normalized(), orientCardsForTargetFront(), PORTUGUESE_MARKERS, sameOrContainedInTarget() (+6 more)

### Community 79 - "Waitlist Demand Test"
Cohesion: 0.29
Nodes (7): 5. Conversation practice — shipped, Cross-cutting decisions, Phase 0: Context primitive, Phase 1: Conversation core, Phase 2: Close the loop, Phase 3: Exposure meter, What gets reused

### Community 80 - "ollama.ts"
Cohesion: 0.23
Nodes (10): targetForProfile(), applyObjectiveDistribution(), AREA_TASKS, countTaskAreas(), nextArea(), task(), TASK_AREA, TASK_COPY (+2 more)

### Community 82 - "Electron App Icon"
Cohesion: 0.70
Nodes (5): PhraseLoop Electron App Icon, Audio Waveform Motif, Brand Palette (Cream, Black, Orange), Speech-Text Conversion Arrow, Text Document Motif

### Community 83 - "useStageTimer"
Cohesion: 0.35
Nodes (11): MethodStage, createTimer(), creditedMs(), pauseTimer(), resumeTimer(), segmentMs(), stageMinutes(), StageTimerState (+3 more)

### Community 84 - "ErrorEvent"
Cohesion: 0.50
Nodes (4): Avancados, Critica De Produto, Iniciantes, Transversal

### Community 85 - "App Logo Brand Mark"
Cohesion: 0.70
Nodes (5): App Logo (Speech-to-Text Brand Mark), Audio Waveform Motif, Orange Correction / Loop Arrow Motif, Document / Transcript Motif, Speech-to-Text Transformation Concept

### Community 86 - "Waitlist API Route"
Cohesion: 0.67
Nodes (3): Backlog original incorporado pelo validador, Curriculo De 100 Licoes, Gates editoriais

### Community 87 - "App Favicon"
Cohesion: 0.67
Nodes (4): App Icon (Waveform-to-Document Logo), Audio Waveform Motif, Speech-Text Conversion Concept, Text Document Motif

### Community 88 - "classifyProviderFailure"
Cohesion: 0.24
Nodes (18): ConversationTurn, ConverseOptions, ClaudeProviderOptions, OllamaProviderOptions, OpenAIProviderOptions, OpenRouterProviderOptions, extractJson(), requestOptions() (+10 more)

### Community 90 - "Loading Splash Screen"
Cohesion: 0.67
Nodes (3): Electron Loading Splash Screen, renderNextStatus, window.setStatus

### Community 92 - "studySession.ts"
Cohesion: 0.33
Nodes (7): ExposureMeter(), ZONE, exposureZone, getWeeklyGoal(), setWeeklyGoal(), subscribeWeeklyGoal(), WeeklyActivity

### Community 94 - "Landing ESLint Config"
Cohesion: 0.18
Nodes (10): turbo, dependsOn, outputs, cache, persistent, $schema, tasks, build (+2 more)

### Community 95 - "Landing Next Config"
Cohesion: 0.36
Nodes (9): build_linux_download(), build_macos_download(), build_windows_download(), clean_macos_install(), clean_to_artifact(), install_linux_appimage(), kokoro_is_ready(), remove_path_if_exists() (+1 more)

### Community 96 - "route.ts"
Cohesion: 0.18
Nodes (17): POST(), clamp(), extractLinesFromJson(), normalizeLines(), POST(), PublicRouteError, runtimeErrorMessage(), safeSpeed() (+9 more)

### Community 99 - "Mac Build Script"
Cohesion: 0.24
Nodes (9): jszip, apkgNames, assetsDir, extractDeck(), initSqlJs, modelFieldIndexes(), require, rootDir (+1 more)

### Community 100 - "Windows Build Script"
Cohesion: 0.12
Nodes (28): EnglishLevel, AdaptationKind, AdaptationSuggestion, evaluateAdaptation(), buildDefaultPlanMeta(), DEFAULT_PLANS, DefaultPlanId, defaultPlanIdForLevel() (+20 more)

### Community 102 - "Root Next Config"
Cohesion: 0.22
Nodes (8): graphify reference: extra exports and benchmark, Step 6b - Wiki (only if --wiki flag), Step 7 - Neo4j export (only if --neo4j or --neo4j-push flag), Step 7a - FalkorDB export (only if --falkordb or --falkordb-push flag), Step 7b - SVG export (only if --svg flag), Step 7c - GraphML export (only if --graphml flag), Step 7d - MCP server (only if --mcp flag), Step 8 - Token reduction benchmark (only if total_words > 5000)

### Community 108 - "Root Page"
Cohesion: 0.25
Nodes (8): baseUrl, here, LESSONS_JSON, main(), OUT_DIR, PHRASES_JSON, root, synth()

### Community 112 - "Native RPath Fix Script"
Cohesion: 0.25
Nodes (7): desktopName, main, name, packageManager, private, version, workspaces

### Community 121 - "graphify reference: query, path, explain"
Cohesion: 0.29
Nodes (6): API surfaces (curl), Flows worth driving, Gotchas, GUI drive (Playwright), Launch, Verifying PhraseLoop changes

### Community 122 - "cyclePlanner.ts"
Cohesion: 0.08
Nodes (36): BandQueueResult, fatigueByCard(), orderDueQueue(), adoptLog(), due(), NOW, NOW_MS, review() (+28 more)

### Community 126 - "graphify reference: add a URL and watch a folder"
Cohesion: 0.33
Nodes (5): For /graphify explain, For /graphify path, graphify reference: query, path, explain, Step 0 — Constrained query expansion (REQUIRED before traversal), Step 1 — Traversal

### Community 129 - "Exact 64-lesson backlog"
Cohesion: 0.15
Nodes (23): POST(), ExportErrorPayload, combinedSignal(), linesFromText(), parseThemePhraseCount(), timeoutError(), uniquePhrases(), POST() (+15 more)

### Community 130 - "graphify reference: GitHub clone and cross-repo merge"
Cohesion: 0.28
Nodes (5): Deploying to Vercel, Local development, PhraseLoop landing — demand test, Post-deploy verification (before posting to any community), Waitlist storage

### Community 131 - "graphify reference: transcribe video and audio"
Cohesion: 0.40
Nodes (4): framework, installCommand, regions, $schema

### Community 134 - "extraction-spec.md"
Cohesion: 0.40
Nodes (5): linux, category, icon, syncDesktopName, target

### Community 192 - "AnkiExporter.tsx"
Cohesion: 0.50
Nodes (3): Current Scope, graphify, This is NOT the Next.js you know

### Community 206 - "returnMoment.test.ts"
Cohesion: 0.50
Nodes (3): For /graphify add, For --watch, graphify reference: add a URL and watch a folder

### Community 207 - "route.ts"
Cohesion: 0.50
Nodes (3): For git commit hook, For native CLAUDE.md integration, graphify reference: commit hook and native CLAUDE.md integration

### Community 208 - "bandQueue.test.ts"
Cohesion: 0.50
Nodes (3): For --cluster-only, For --update (incremental re-extraction), graphify reference: incremental update and cluster-only

### Community 209 - "useDockDueBadge.ts"
Cohesion: 0.10
Nodes (26): average(), deriveListeningStage(), deriveReadingWritingStage(), deriveSpeakingStage(), FAMILIAR_TOPICS, FamiliarTopic, FamiliarTopicHistoryItem, LISTENING_STAGE_CRITERIA (+18 more)

### Community 238 - "nsis"
Cohesion: 0.50
Nodes (4): nsis, artifactName, oneClick, perMachine

### Community 239 - "dedupe.ts"
Cohesion: 0.33
Nodes (10): contentHash(), cosine(), dedupeCards(), embeddingCache, embedWithCache(), fingerprint(), isAbortError(), lexicalVectors() (+2 more)

### Community 241 - "LevelTestFlow.tsx"
Cohesion: 0.10
Nodes (22): Chip, ChipProps, Disclosure(), DisclosureProps, ModalProps, CorrectionList(), CorrectionListProps, JsonImportForm() (+14 more)

### Community 242 - "inputOutput.integration.test.ts"
Cohesion: 0.15
Nodes (14): AudioCoverageRule, AudioDelivery, AudioRecordingKind, coverageForBatch(), LessonAudioMetadata, syntheticAudioMetadata(), validateLessonAudioMetadata(), ListeningChallenge (+6 more)

## Ambiguous Edges - Review These
- `Landing Illustration: Device-to-Cloud Sync` → `Concept: User-Controlled Data Sync (Opt-In Cloud Connection)`  [AMBIGUOUS]
  apps/landing/public/image-1.png · relation: rationale_for
- `Network Graph Icon (connected concepts motif)` → `Text-to-Speech Pipeline (product value proposition)`  [AMBIGUOUS]
  apps/landing/public/image-3.png · relation: conceptually_related_to

## Knowledge Gaps
- **747 isolated node(s):** `eslintConfig`, `nextConfig`, `name`, `version`, `private` (+742 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **112 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Landing Illustration: Device-to-Cloud Sync` and `Concept: User-Controlled Data Sync (Opt-In Cloud Connection)`?**
  _Edge tagged AMBIGUOUS (relation: rationale_for) - confidence is low._
- **What is the exact relationship between `Network Graph Icon (connected concepts motif)` and `Text-to-Speech Pipeline (product value proposition)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `dependencies` connect `Anki Deck Builder` to `Native RPath Fix Script`, `Mac Build Script`?**
  _High betweenness centrality (0.062) - this node is a cross-community bridge._
- **Why does `line()` connect `Pronunciation Scoring` to `Provider Selection Constants`, `Electron Main Process`?**
  _High betweenness centrality (0.051) - this node is a cross-community bridge._
- **Why does `motion` connect `Anki Deck Builder` to `LevelTestFlow.tsx`?**
  _High betweenness centrality (0.032) - this node is a cross-community bridge._
- **What connects `eslintConfig`, `nextConfig`, `name` to the rest of the system?**
  _761 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Study Plan Adaptation` be split into smaller, more focused modules?**
  _Cohesion score 0.06471306471306472 - nodes in this community are weakly interconnected._