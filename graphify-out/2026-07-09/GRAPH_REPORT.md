# Graph Report - .  (2026-07-09)

## Corpus Check
- Large corpus: 336 files · ~669,164 words. Semantic extraction will be expensive (many Claude tokens). Consider running on a subfolder.

## Summary
- 1963 nodes · 5561 edges · 114 communities (93 shown, 21 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 148 edges (avg confidence: 0.76)
- Token cost: 243,900 input · 9,500 output

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
- UI Primitives & Motion Tokens
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
- OpenAI Card Provider
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
- APKG Extraction Script
- Settings UI Widgets
- Landing Hero Imagery
- Package Metadata
- App Context Providers
- Sync Opt-In Illustration
- Data Pipeline Illustration
- Positioning & Structure Docs
- Card Pipeline Docs
- Waitlist Demand Test
- Vercel Deploy Config
- Product Identity & ICP
- Electron App Icon
- Linux Build Script
- Linux Packaging Config
- App Logo Brand Mark
- Waitlist API Route
- App Favicon
- Activation Event Model
- Learning Plan Docs
- Loading Splash Screen
- Electron Run Script
- Ollama Models Hook
- Graphify Usage Rules
- Landing ESLint Config
- Landing Next Config
- Landing PostCSS Config
- Window Icon Asset
- Mac Build Script
- Windows Build Script
- Root ESLint Config
- Root Next Config
- Root PostCSS Config
- File Icon Asset
- Globe Icon Asset
- Vercel Logo Asset
- Apple Touch Icon
- Start Script
- Next.js Logo Asset
- Pluggable Providers Note

## God Nodes (most connected - your core abstractions)
1. `cn()` - 59 edges
2. `useT()` - 50 edges
3. `Card` - 47 edges
4. `GenerationRunOptions` - 41 edges
5. `ProviderKind` - 41 edges
6. `ErrorEvent` - 33 edges
7. `StudyTab()` - 32 edges
8. `getLearningProfile()` - 31 edges
9. `readJsonObject()` - 31 edges
10. `Card()` - 27 edges

## Surprising Connections (you probably didn't know these)
- `Codex spawn_agent Dispatch` --semantically_similar_to--> `Parallel Semantic Extraction Subagents`  [INFERRED] [semantically similar]
  .codex/skills/graphify/SKILL.md → .claude/skills/graphify/SKILL.md
- `Extraction Subagent Prompt Spec (Compact, Codex)` --semantically_similar_to--> `Extraction Subagent Prompt Spec`  [INFERRED] [semantically similar]
  .codex/skills/graphify/references/extraction-spec.md → .claude/skills/graphify/references/extraction-spec.md
- `Query, Path, Explain Flows (Codex)` --semantically_similar_to--> `Query, Path, Explain Flows`  [INFERRED] [semantically similar]
  .codex/skills/graphify/references/query.md → .claude/skills/graphify/references/query.md
- `Whisper Video Transcription (Codex)` --semantically_similar_to--> `Whisper Video Transcription`  [INFERRED] [semantically similar]
  .codex/skills/graphify/references/transcribe.md → .claude/skills/graphify/references/transcribe.md
- `Incremental Update and Cluster-Only (Codex)` --semantically_similar_to--> `Incremental Update and Cluster-Only`  [INFERRED] [semantically similar]
  .codex/skills/graphify/references/update.md → .claude/skills/graphify/references/update.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Graphify Pipeline Documentation (Claude Code)** — _claude_skills_graphify_skill_graphify_skill, _claude_skills_graphify_references_add_watch_add_and_watch, _claude_skills_graphify_references_exports_export_formats, _claude_skills_graphify_references_extraction_spec_subagent_prompt, _claude_skills_graphify_references_github_and_merge_clone_and_merge, _claude_skills_graphify_references_hooks_commit_hook, _claude_skills_graphify_references_query_query_flows, _claude_skills_graphify_references_transcribe_whisper_transcription, _claude_skills_graphify_references_update_incremental_update [EXTRACTED 1.00]
- **Animation Craft Review System** — _agents_skills_animation_vocabulary_skill_animation_vocabulary, _agents_skills_review_animations_skill_review_animations, _agents_skills_review_animations_standards_animation_standards, _agents_skills_review_animations_skill_emil_kowalski_philosophy [INFERRED 0.85]
- **Graphify Two-Track Extraction Flow** — _claude_skills_graphify_skill_ast_extraction, _claude_skills_graphify_skill_semantic_subagents, _claude_skills_graphify_skill_extraction_cache, _claude_skills_graphify_references_extraction_spec_node_id_format, _claude_skills_graphify_references_extraction_spec_confidence_rubric [INFERRED 0.85]
- **W5 Run Kit (Printable Session Materials)** — docs_w5_validation_protocol_protocol, docs_w5_recruiting_message_message, docs_w5_consent_script_script, docs_w5_moderator_run_sheet_sheet, docs_w5_followup_messages_messages, docs_w5_capture_table_table [EXTRACTED 1.00]
- **Card Pipeline Quality Stages (mine → generate → ground → critique → dedup)** — docs_readme_discovery_ingestion, docs_readme_provider_contract, docs_readme_grounding, docs_readme_critique_gate, docs_readme_semantic_dedup, docs_readme_native_clip_slicing [EXTRACTED 1.00]
- **Tutor Loop (SRS → weakness detection → reinforcement → directed generation)** — docs_readme_srs_engine, docs_readme_weakness_detection, docs_readme_reinforcement_loop, docs_readme_directed_generation [EXTRACTED 1.00]
- **Device -> Toggle -> Cloud Sync Flow** — apps_landing_public_image_1_device, apps_landing_public_image_1_toggle_check, apps_landing_public_image_1_cloud [INFERRED 0.85]
- **Data-to-Structured-Content Pipeline depicted in landing hero** — apps_landing_public_image_2_input_sources, apps_landing_public_image_2_processing_engine, apps_landing_public_image_2_data_streams, apps_landing_public_image_2_output_cards [EXTRACTED 1.00]
- **Icons form a text-to-audio pipeline motif around the product core** — apps_landing_public_image_3_document_icon, apps_landing_public_image_3_audio_waveform_icons, apps_landing_public_image_3_headphones_icon, apps_landing_public_image_3_shield_cube_core [INFERRED 0.85]
- **App Icon Visual Composition: waveform flowing into a document via conversion arrow** — electron_assets_icon_appicon, electron_assets_icon_audio_waveform, electron_assets_icon_text_document, electron_assets_icon_speech_text_conversion [EXTRACTED 1.00]
- **Waveform, Document, and Correction Arrow Form the Brand Mark** — public_logo_audio_waveform_motif, public_logo_document_motif, public_logo_correction_arrow_motif, public_logo_applogo [EXTRACTED 1.00]
- **Waveform, Document, and Conversion Concept Form the App Brand Mark** — src_app_icon_appicon, src_app_icon_audio_waveform, src_app_icon_text_document, src_app_icon_speech_text_conversion [INFERRED 0.85]

## Communities (114 total, 21 thin omitted)

### Community 0 - "Study Plan Adaptation"
Cohesion: 0.06
Nodes (70): AdaptationKind, AdaptationSuggestion, buildWeekSummary(), evaluateAdaptation(), PlanCalendar(), PlanOnboardingProps, PlanTaskRow(), TodayCard() (+62 more)

### Community 1 - "Demo Fixture Data"
Cohesion: 0.06
Nodes (48): DEMO_CARD_IDS, DEMO_PHRASES, demoDeckFor(), DemoPhrase, demoResult, isLevelAtLeast(), LEVEL_RANK, EnglishLevel (+40 more)

### Community 2 - "Shared Feature UI Widgets"
Cohesion: 0.08
Nodes (35): ProviderBadge(), ProviderBadgeProps, Segmented(), SegmentedOption, SegmentedProps, ProviderPicker(), Selection, DeckGeneration (+27 more)

### Community 3 - "First-Run Activation"
Cohesion: 0.08
Nodes (39): ActivationTiming, FirstRunActivation, FirstRunActivationSource, getStorage(), markFirstRunPhrasesSaved(), markFirstRunReviewCompleted(), read(), startFirstRunActivation() (+31 more)

### Community 4 - "Learn Audio Generation Script"
Cohesion: 0.09
Nodes (41): args, buildCoverage(), collectNativeRecordings(), createTts(), currentPath, dataDir(), defaultNativeDir, defaultPublicDir (+33 more)

### Community 5 - "Graphify Skill Docs"
Cohesion: 0.06
Nodes (44): Graphify Add URL and Watch Mode, Graphify Export Formats, Graphify MCP Server, Discrete Confidence Rubric, Node ID Format (Full-Path Stem), Extraction Subagent Prompt Spec, GitHub Clone and Cross-Repo Merge, Commit Hook and CLAUDE.md Integration (+36 more)

### Community 6 - "App Layout & AI Settings"
Cohesion: 0.08
Nodes (34): fontVariables, metadata, fontVariables, metadata, AppHeader(), AppHeaderProps, emptySubscribe(), useIsClient() (+26 more)

### Community 7 - "Electron Main Process"
Cohesion: 0.07
Nodes (39): AI_SETTINGS_FALLBACK_FILE, APKG_DEBUG_LOG_FILE, { app, BrowserWindow, ipcMain, Menu, shell, utilityProcess }, APP_ICON_PNG, boot(), children, clearOwnQuarantine(), crypto (+31 more)

### Community 8 - "Local Store Repository"
Cohesion: 0.09
Nodes (36): SettingsScreen(), statusLabel(), subscribeToProfile(), del(), put(), putMany(), StoreName, BackupValidationResult (+28 more)

### Community 9 - "Landing Site UI"
Cohesion: 0.06
Nodes (33): AsciiLoop(), buildTrack(), Cell, COMET, COMET_HEAD, renderFrame(), appStageStyle, cardHover (+25 more)

### Community 10 - "Home Page Shell"
Cohesion: 0.11
Nodes (29): HomeContent(), Overlay, recommendedLessonId(), resolveLessonId(), HOME_TABS, HomeTab, useDockDueBadge(), computeUnlockedTabTier() (+21 more)

### Community 11 - "Study Transcript Review"
Cohesion: 0.10
Nodes (30): Disclosure(), DisclosureProps, CorrectionList(), formatTime(), SegmentRow(), TranscriptReview(), KokoroModelNotice(), ExposureMeter() (+22 more)

### Community 12 - "Speech Input UI"
Cohesion: 0.10
Nodes (29): Field(), FieldProps, Input, Label(), Textarea, JsonImportForm(), JsonImportFormProps, AnkiExporter() (+21 more)

### Community 13 - "AI Settings API"
Cohesion: 0.15
Nodes (28): GET(), GET(), GET(), LABELS, PATCH(), provider(), PUT(), value() (+20 more)

### Community 14 - "Native Audio Decoding"
Cohesion: 0.11
Nodes (31): decodeAudio(), DecodedAudio, mono(), resample(), sliceAudio(), sliceDecodedAudio(), wav(), assessPronunciation() (+23 more)

### Community 15 - "Ingestion API Routes"
Cohesion: 0.13
Nodes (24): POST(), safeLevel(), safeSourceKind(), toSegment(), POST(), POST(), safeLang(), clamp() (+16 more)

### Community 16 - "Local Server Routes"
Cohesion: 0.15
Nodes (32): error(), audioPathFor(), kokoroInstalled(), modelStatus, whisperInstalled(), ANY_ROUTES, dispatch(), handleAnkiApkg() (+24 more)

### Community 17 - "Card API Integration Tests"
Cohesion: 0.08
Nodes (18): generateDeck, localJson, localRequest, NaturalnessReviewProps, Embedder, phraseSource, CardGenerationProvider, DeckResult (+10 more)

### Community 18 - "Discover & Provider Selection"
Cohesion: 0.14
Nodes (25): Modal(), Select(), SelectOption, SelectProps, useProviderSelection(), curateDiscoverSegments(), extractDiscoverSource(), generateDiscoverDeck() (+17 more)

### Community 19 - "UI Primitives & Motion Tokens"
Cohesion: 0.14
Nodes (19): steps, Button, ButtonProps, buttonVariants, Chip, ChipProps, IconButtonProps, ModalProps (+11 more)

### Community 20 - "W5 Decision-Gate Scorer"
Cohesion: 0.14
Nodes (29): countTrue(), currentPath, formatCount(), formatDuration(), formatPercent(), GATE_DEFS, isSeparatorRow(), isTemplateRow() (+21 more)

### Community 21 - "Plan Generation API"
Cohesion: 0.12
Nodes (24): adaptProviderKind(), POST(), planProviderKind(), POST(), PLAN_TASK_TYPES, extractJsonObject(), GeneratedDay, GeneratedTask (+16 more)

### Community 22 - "SRS Analytics Dashboard"
Cohesion: 0.13
Nodes (24): HomeDashboard(), ProgressOverview(), StudyTab(), computePerformance(), computeReturnAfterMiss(), computeWeeklyActivity(), dayIndex(), dayKey() (+16 more)

### Community 23 - "Package Dependencies"
Cohesion: 0.07
Nodes (28): dependencies, ankipack, @anthropic-ai/sdk, audio-decode, class-variance-authority, clsx, csv-parse, @kutalia/whisper-node-addon (+20 more)

### Community 24 - "Card Export API"
Cohesion: 0.27
Nodes (21): POST(), POST(), cardProviderKind(), readExportError(), POST(), POST(), conversationProviderKind(), parseTurns() (+13 more)

### Community 25 - "APKG Export Handling"
Cohesion: 0.14
Nodes (25): RFC-5987, RFC-6266, ApkgErrorPayload, csvEscapeCell(), isProbablyJsonUpload(), isTimeoutOrAbort(), jsonToCsvBytes(), jsonToCsvBytesFromParsed() (+17 more)

### Community 26 - "Anki Deck Builder"
Cohesion: 0.15
Nodes (26): jszip, abortError(), basicModel(), buildCardsDeck(), buildCsvDeck(), cardModel(), column(), digestAlgorithmName() (+18 more)

### Community 27 - "Correction Input Forms"
Cohesion: 0.15
Nodes (20): ManualEntryForm(), ManualEntryFormProps, CORRECTION_ERROR_TYPES, CORRECTION_INPUT_OPTIONS, CorrectionDraft, CorrectionInputMode, ERROR_TYPE_SET, newDraft() (+12 more)

### Community 28 - "Card Prompt Builders"
Cohesion: 0.11
Nodes (26): AdvancedReviewResult, buildAdvancedReviewRequest(), buildCorrectRequest(), buildCritiqueRequest(), buildGenerateRequest(), CEFR_LANGUAGE_PROFILE, cefrLanguageLine(), coerceErrorType() (+18 more)

### Community 29 - "SRS Cycle Planner"
Cohesion: 0.13
Nodes (19): CycleInputs, CycleOption, CyclePath, CyclePlan, deriveCyclePlan(), minutesLabel(), states(), weighted() (+11 more)

### Community 30 - "Runtime Status API"
Cohesion: 0.17
Nodes (14): GET(), GET(), POST(), POST(), POST(), formText(), POST(), GET() (+6 more)

### Community 31 - "Native Data Directories"
Cohesion: 0.16
Nodes (21): DELETE(), GET(), dataDir(), discoverCacheDir(), linuxDataDirs(), modelDirs(), modelsDir(), active (+13 more)

### Community 32 - "Landing Package Config"
Cohesion: 0.08
Nodes (23): dependencies, motion, next, next-themes, react, react-dom, devDependencies, eslint (+15 more)

### Community 33 - "Progress Scoring Model"
Cohesion: 0.21
Nodes (22): activeDayCount(), avg(), buildMilestones(), clampScore(), computeProgressSnapshot(), confidenceFor(), errorTrend(), estimatedBand() (+14 more)

### Community 34 - "Study Session Modes"
Cohesion: 0.19
Nodes (19): buildLightQueue(), hasAudio(), isSaturated(), SessionMode, card(), freshCard(), stableCard(), bandGateMetrics (+11 more)

### Community 35 - "Provider Selection Constants"
Cohesion: 0.21
Nodes (17): PROVIDER_FALLBACK_LABELS, ProviderSelection, abortError(), debug(), generateDeck(), generateVettedCards(), isAbortError(), isSourceGrounded() (+9 more)

### Community 36 - "Landing TypeScript Config"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 37 - "Electron Builder Config"
Cohesion: 0.10
Nodes (20): build, appId, dmg, extraResources, files, mac, nsis, productName (+12 more)

### Community 38 - "Ollama Card Provider"
Cohesion: 0.23
Nodes (6): GenerationRunOptions, OllamaProvider, requestOptions(), OpenAIProvider, requestOptions(), CardSource

### Community 39 - "Root TypeScript Config"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 40 - "OpenRouter Card Provider"
Cohesion: 0.19
Nodes (10): CorrectOptions, extractJson(), OpenRouterProvider, OpenRouterProviderOptions, requestOptions(), ErrorEvent, JsonRequest, normalizeAdvancedReview() (+2 more)

### Community 41 - "NPM Build Scripts"
Cohesion: 0.11
Nodes (18): scripts, app, app:dist, app:download, app:linux, app:windows, build, dev (+10 more)

### Community 42 - "Card Deck Preview UI"
Cohesion: 0.25
Nodes (14): Card(), CardProps, basename(), DeckPreview(), DeckPreviewProps, ankiConnect(), browserDownload(), csvCell() (+6 more)

### Community 43 - "CEFR Band Gating"
Cohesion: 0.20
Nodes (14): orderDueQueue(), BandVerdict, CardLike, clamp01(), gateVerdict(), orderByBand(), scoreCard(), simulateBandGate() (+6 more)

### Community 44 - "IndexedDB Access Layer"
Cohesion: 0.24
Nodes (16): clearAll(), count(), countFromIndex(), get(), getAll(), getAllFromIndex(), getMany(), makeCard() (+8 more)

### Community 45 - "Content Discovery Pipeline"
Cohesion: 0.23
Nodes (16): dedupeSegments(), discoverArticle(), discoverPdf(), DiscoverResult, discoverYouTube(), downloadedAudio(), execFileAsync, ffmpegDir() (+8 more)

### Community 46 - "Animation Review Skills"
Cohesion: 0.20
Nodes (16): Animation Vocabulary Skill, Motion Effect Glossary, Project /vocabulary Page, Emil Kowalski Animation Philosophy (animations.dev), Aggressive Escalation Triggers, Remedial Preference Hierarchy, Review Animations Skill, Ten Non-Negotiable Animation Standards (+8 more)

### Community 47 - "Pronunciation Practice UI"
Cohesion: 0.19
Nodes (10): Spinner(), synthesizeSpeech(), AiEvaluateForm(), AiEvaluateFormProps, assessPronunciation(), PronunciationCoach(), PronunciationCoachProps, Score() (+2 more)

### Community 48 - "Conversation Providers"
Cohesion: 0.26
Nodes (9): ConversationTurn, ConverseOptions, ClaudeProviderOptions, extractJson(), ollamaBaseUrl(), OllamaProviderOptions, buildConverseSystem(), conversationMessages() (+1 more)

### Community 49 - "Dev Dependencies"
Cohesion: 0.13
Nodes (15): devDependencies, electron, electron-builder, eslint, eslint-config-next, fake-indexeddb, tailwindcss, @tailwindcss/postcss (+7 more)

### Community 50 - "Audio Player & History"
Cohesion: 0.20
Nodes (10): AudioPlayer(), AudioPlayerProps, ENGINE_LABELS, HistoryItem(), HistoryItemProps, HistoryPanelProps, VOICE_LABELS, AudioState (+2 more)

### Community 51 - "Progress Model Tests"
Cohesion: 0.20
Nodes (10): ProgressData, ProgressInput, attempt(), NOW, PronunciationAssessment, PronunciationAttempt, PronunciationScores, PronunciationWordStatus (+2 more)

### Community 52 - "Study Card Scaffolding"
Cohesion: 0.30
Nodes (11): SessionResult, ScaffoldControls(), ScaffoldTelemetry, StudyCard(), StudyCardProps, buildHint(), isStable(), recentFailureCount() (+3 more)

### Community 53 - "Card Language Orientation"
Cohesion: 0.30
Nodes (14): containsPortugueseAccent(), ENGLISH_MARKERS, isLikelyEnglish(), isLikelyPortuguese(), normalized(), orientCardsForTargetFront(), PORTUGUESE_MARKERS, sameOrContainedInTarget() (+6 more)

### Community 54 - "Lesson View UI"
Cohesion: 0.29
Nodes (11): Notice(), NoticeProps, toneClass, LessonViewContent(), resultForLesson(), waitForAudioEvent(), MistakeStep(), LessonPhrase (+3 more)

### Community 55 - "Pronunciation Scoring"
Cohesion: 0.27
Nodes (12): alignWords(), assessPronunciationText(), clampScore(), CONTRACTIONS, editDistance(), escapeRegExp(), fluencyScore(), normalizePronunciationWords() (+4 more)

### Community 56 - "OpenAI Card Provider"
Cohesion: 0.38
Nodes (7): ThemeResponse, OpenAIProviderOptions, DiscoveryRequest, PhraseCandidate, TranscriptSegment, buildMineRequest(), normalizeMined()

### Community 57 - "Fatigue-Aware Band Queue"
Cohesion: 0.24
Nodes (11): BandQueueResult, fatigueByCard(), adoptLog(), due(), NOW, NOW_MS, review(), srs() (+3 more)

### Community 58 - "Theme Generation API"
Cohesion: 0.35
Nodes (9): POST(), ExportErrorPayload, combinedSignal(), fallbackThemePhrases(), linesFromText(), parseThemePhraseCount(), timeoutError(), uniquePhrases() (+1 more)

### Community 59 - "Installer Build Script"
Cohesion: 0.36
Nodes (9): build_linux_download(), build_macos_download(), build_windows_download(), clean_macos_install(), clean_to_artifact(), install_linux_appimage(), kokoro_is_ready(), remove_path_if_exists() (+1 more)

### Community 60 - "Turborepo Config"
Cohesion: 0.18
Nodes (10): turbo, dependsOn, outputs, cache, persistent, $schema, tasks, build (+2 more)

### Community 61 - "Progress Overview UI"
Cohesion: 0.27
Nodes (10): EMPTY_DATA, formatDate(), ProgressCheckInCard(), ProgressSnapshotCard(), SkillBar(), ProgressSnapshot, StoredProgressAssessment, DEFAULT_LEARNING_PROFILE (+2 more)

### Community 62 - "Semantic Card Dedup"
Cohesion: 0.33
Nodes (10): contentHash(), cosine(), dedupeCards(), embeddingCache, embedWithCache(), fingerprint(), isAbortError(), lexicalVectors() (+2 more)

### Community 63 - "Claude Card Provider"
Cohesion: 0.27
Nodes (3): ClaudeProvider, requestOptions(), AdvancedReview

### Community 64 - "C1 Phase Proposal"
Cohesion: 0.20
Nodes (10): C1 Post-B1/B2 Plateau Phase Proposal, C1 Diagnosis Instrument, Write → Feedback → Speak Pipeline, Critique Gate (keep / rewrite / drop), Directed Generation (Gerar +), Card Grounding, Provider-Agnostic Generation Contract, Reinforcement Loop (Reforçar) (+2 more)

### Community 65 - "W5 Validation Protocol"
Cohesion: 0.38
Nodes (10): W5 Decision Record, W5 Decision-Gate Scorer (yarn w5:score), W5 Capture Table, W5 Consent Script, D+1/D+7 Follow-Up Messages, W5 Moderator Run-Sheet, W5 Gate Metrics (7 Gates), Hear → Review → Fix Loop (+2 more)

### Community 66 - "Product Strategy Docs"
Cohesion: 0.22
Nodes (9): Feature Freeze (Phase 0), Frozen Surfaces List, Adaptive Cycle Shipped Infrastructure, Applied Research Principles (Flow, ZDP, Challenge Point, Desirable Difficulties), SRS Engine (ts-fsrs), Validation Action Plan (Phases 0–6), Backup/Restore Moderated Validation Protocol, Pedagogical Method: Governed Adaptive Cycles (+1 more)

### Community 67 - "Native Audio Clip Docs"
Cohesion: 0.31
Nodes (9): Discovery Ingestion (Extract → Curate → Review), Native Clip Slicing, Native Clips W5 Blocker, Native Audio Clip Library (native-audio/), First-Run Audio Gate (yarn learn:audio:verify), Provenance Manifest (manifest.json), Local Speech Runtime (Kokoro + Whisper), Native Source Audio Differentiator (+1 more)

### Community 69 - "Demo Fixture Builder"
Cohesion: 0.25
Nodes (8): baseUrl, here, LESSONS_JSON, main(), OUT_DIR, PHRASES_JSON, root, synth()

### Community 70 - "APKG Extraction Script"
Cohesion: 0.28
Nodes (8): apkgNames, assetsDir, extractDeck(), initSqlJs, modelFieldIndexes(), require, rootDir, textFromField()

### Community 71 - "Settings UI Widgets"
Cohesion: 0.28
Nodes (6): IconButton, StatusPill(), StatusPillProps, toneClass, PROVIDER_COPY, StatusTone

### Community 72 - "Landing Hero Imagery"
Cohesion: 0.43
Nodes (8): Audio Waveform Icons (blue and orange, speech/audio motif), Text Document Icon (text input motif), Headphones Icon (listening motif), Landing Hero Illustration (image-3.png), Network Graph Icon (connected concepts motif), Orbital Ring Composition (icons connected by dotted paths around core), Central Shield with Glowing Cube (product core motif), Text-to-Speech Pipeline (product value proposition)

### Community 73 - "Package Metadata"
Cohesion: 0.25
Nodes (7): desktopName, main, name, packageManager, private, version, workspaces

### Community 74 - "App Context Providers"
Cohesion: 0.36
Nodes (6): AppProviders(), TtsSettingsProvider(), I18nContext, I18nProvider(), subscribe(), useInterfaceLang()

### Community 75 - "Sync Opt-In Illustration"
Cohesion: 0.43
Nodes (7): Gray Dotted Path Ending in X (Blocked/Disabled Route), Cloud with Active Sync Indicator, Concept: User-Controlled Data Sync (Opt-In Cloud Connection), Dark Rounded Device on Pedestal, Landing Illustration: Device-to-Cloud Sync, Soft Pastel 3D Illustration Style (Cream/Orange/Green Palette), Toggle Switch with Orange Checkmark (Enabled State)

### Community 76 - "Data Pipeline Illustration"
Cohesion: 0.52
Nodes (7): Calm Landscape Motif (sun over hills in circular frame, muted warm palette), Flowing Data Streams (orange, blue, green curved lines with node dots), Knowledge Graph Card (rightmost card showing a connected node diagram), Landing Hero Illustration: Data-to-Cards Pipeline, Input Sources (database cylinders, keypad device, raw sphere), Structured Output Cards (four content cards with text lines and highlights), Processing Engine (dark device with glowing orange core)

### Community 77 - "Positioning & Structure Docs"
Cohesion: 0.33
Nodes (6): Intercom-Inspired Design Language, Competitive Positioning (The Step Before Anki), App Boundaries and Runtime Shape, Source Directory Rules, PhraseLoop, Closed Loop Thesis (capturar → estudar → produzir → reforçar)

### Community 78 - "Card Pipeline Docs"
Cohesion: 0.33
Nodes (6): Card Pipeline (Two Ingestion Paths, One Output), Conversation Practice (Converse), Correction Ingestion (ErrorEvent Path), Semantic Dedup (Embedding Cosine), Mistakes Become Drills Differentiator, Guided First-Run Loop

### Community 79 - "Waitlist Demand Test"
Cohesion: 0.40
Nodes (5): Qualified Waitlist (W5 Demand Test), POST /api/waitlist Endpoint, Landing Demand Test, Demo Honesty Gate, 90-Second Demo Video Script & Shot List

### Community 80 - "Vercel Deploy Config"
Cohesion: 0.40
Nodes (4): framework, installCommand, regions, $schema

### Community 81 - "Product Identity & ICP"
Cohesion: 0.40
Nodes (5): Central Identity Decision (Local-First Tutor, Depth Hidden), Product One-Sentence (Fonte de Verdade), W5 Recruiting Message, Five-Second Promise, ICP: A2–B1 Brazilian Self-Study / Anki-Adjacent Learner

### Community 82 - "Electron App Icon"
Cohesion: 0.70
Nodes (5): PhraseLoop Electron App Icon, Audio Waveform Motif, Brand Palette (Cream, Black, Orange), Speech-Text Conversion Arrow, Text Document Motif

### Community 84 - "Linux Packaging Config"
Cohesion: 0.40
Nodes (5): linux, category, icon, syncDesktopName, target

### Community 85 - "App Logo Brand Mark"
Cohesion: 0.70
Nodes (5): App Logo (Speech-to-Text Brand Mark), Audio Waveform Motif, Orange Correction / Loop Arrow Motif, Document / Transcript Motif, Speech-to-Text Transformation Concept

### Community 86 - "Waitlist API Route"
Cohesion: 0.67
Nodes (3): isEmail(), platforms, POST()

### Community 87 - "App Favicon"
Cohesion: 0.67
Nodes (4): App Icon (Waveform-to-Document Logo), Audio Waveform Motif, Speech-Text Conversion Concept, Text Document Motif

### Community 88 - "Activation Event Model"
Cohesion: 0.67
Nodes (3): Activation Event Model (product.md), Own-Source Funnel, W5 Event Model

### Community 89 - "Learning Plan Docs"
Cohesion: 1.00
Nodes (3): Activity Log, EffortSnapshot (Weekly Effort Measurement), Structured 90-Day Learning Plan

### Community 90 - "Loading Splash Screen"
Cohesion: 0.67
Nodes (3): Electron Loading Splash Screen, renderNextStatus, window.setStatus

## Ambiguous Edges - Review These
- `Landing Illustration: Device-to-Cloud Sync` → `Concept: User-Controlled Data Sync (Opt-In Cloud Connection)`  [AMBIGUOUS]
  apps/landing/public/image-1.png · relation: rationale_for
- `Network Graph Icon (connected concepts motif)` → `Text-to-Speech Pipeline (product value proposition)`  [AMBIGUOUS]
  apps/landing/public/image-3.png · relation: conceptually_related_to

## Knowledge Gaps
- **451 isolated node(s):** `eslintConfig`, `nextConfig`, `name`, `version`, `private` (+446 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **21 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Landing Illustration: Device-to-Cloud Sync` and `Concept: User-Controlled Data Sync (Opt-In Cloud Connection)`?**
  _Edge tagged AMBIGUOUS (relation: rationale_for) - confidence is low._
- **What is the exact relationship between `Network Graph Icon (connected concepts motif)` and `Text-to-Speech Pipeline (product value proposition)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `dependencies` connect `Package Dependencies` to `Package Metadata`, `Anki Deck Builder`?**
  _High betweenness centrality (0.109) - this node is a cross-community bridge._
- **Why does `openai` connect `Package Dependencies` to `OpenAI Card Provider`?**
  _High betweenness centrality (0.041) - this node is a cross-community bridge._
- **Why does `motion` connect `Package Dependencies` to `UI Primitives & Motion Tokens`?**
  _High betweenness centrality (0.040) - this node is a cross-community bridge._
- **What connects `eslintConfig`, `nextConfig`, `name` to the rest of the system?**
  _454 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Study Plan Adaptation` be split into smaller, more focused modules?**
  _Cohesion score 0.06308473670141673 - nodes in this community are weakly interconnected._