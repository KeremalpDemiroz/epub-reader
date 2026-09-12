# Graph Report - epub-reader  (2026-09-12)

## Corpus Check
- 2 files · ~104,017 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 359 nodes · 547 edges · 54 communities (12 shown, 42 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 9 edges (avg confidence: 0.87)
- Token cost: 65,000 input · 6,230 output

## Community Hubs (Navigation)
- Roadmap V2 Mimarisi ve Servis Kavramlari
- App Navigation, Drawer ve Theme
- Reader Components ve WebView Hooks
- Expo Android App Config
- GitNexus CLI Tooling
- EPUB Storage, Merge ve Library Store
- Package Build ve Lint Config
- Core RN/Expo Navigation Dependencies
- Expo Media/Status Plugin Dependencies
- TypeScript Config
- Android Adaptive Icon Spec (Monochrome)
- ESLint Config
- Native Android Volume Key Integration
- Diff-Match-Patch Dependency
- Android Icon Background Guideline
- Expo Battery Dependency
- Expo Constants Dependency
- Document Picker Dependency
- Expo File System Dependency
- Expo Haptics Dependency
- Intent Launcher Dependency
- Keep Awake Dependency
- Media Library Dependency
- Navigation Bar Dependency
- Splash Screen Dependency
- Expo Symbols Dependency
- System UI Dependency
- Vector Icons Dependency
- Fflate Compression Dependency
- React Dependency
- React DOM Dependency
- React Native Dependency
- Draggable FlatList Dependency
- Reanimated Dependency
- Safe Area Context Dependency
- React Native Screens Dependency
- WebView Dependency
- React Native Worklets Dependency
- Bottom Tabs Navigation Dependency
- Drawer Navigation Dependency
- Navigation Elements Dependency
- Native Stack Navigation Dependency
- Sanitize HTML Dependency
- Sanitize HTML Types Dependency
- Expo Project Scaffold
- Android Icon Foreground Artwork
- App Favicon
- App Icon Artwork
- Icon Demo Artwork
- Partial React Logo Asset
- React Logo Asset 2x
- React Logo Asset 3x
- React Logo Asset
- Splash Icon Artwork

## God Nodes (most connected - your core abstractions)
1. `gitnexus-guide skill` - 24 edges
2. `useThemeStore` - 17 edges
3. `expo` - 16 edges
4. `gitnexus-cli skill` - 13 edges
5. `Faz 1: Divide and Conquer` - 11 edges
6. `decodeBase64()` - 10 edges
7. `useLibraryStore` - 10 edges
8. `gitnexus-refactoring skill` - 10 edges
9. `MergeOrderScreen()` - 9 edges
10. `gitnexus-debugging skill` - 9 edges

## Surprising Connections (you probably didn't know these)
- `State Yönetiminin Dağınıklığı` --references--> `zustand`  [EXTRACTED]
  system_architecture_roadmap.md → epub-reader/package.json
- `zustand` --shares_data_with--> `Library Store`  [EXTRACTED]
  epub-reader/package.json → system_architecture_roadmap.md
- `zustand` --shares_data_with--> `Progress Store`  [EXTRACTED]
  epub-reader/package.json → system_architecture_roadmap.md
- `zustand` --shares_data_with--> `Theme Store`  [EXTRACTED]
  epub-reader/package.json → system_architecture_roadmap.md
- `zustand` --shares_data_with--> `Timeline Store`  [EXTRACTED]
  epub-reader/package.json → system_architecture_roadmap.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Mevcut Mimari Sorunları (God Component Kaynaklı)** — system_architecture_roadmap_readerscreen_tsx, system_architecture_roadmap_webview_bridge, system_architecture_roadmap_state_management_fragmentation, system_architecture_roadmap_gesture_management_conflict [INFERRED 0.85]
- **V2 Mimarisi Fazları** — system_architecture_roadmap_faz1_divide_and_conquer, system_architecture_roadmap_faz2_webview_modernization, system_architecture_roadmap_faz3_state_optimization, system_architecture_roadmap_faz4_gesture_animation_infra, system_architecture_roadmap_faz5_service_oriented_approach [EXTRACTED 1.00]
- **Acil Aksiyon Planı Adımları** — system_architecture_roadmap_step1_component_split, system_architecture_roadmap_step2_state_optimization, system_architecture_roadmap_step3_custom_hooks_abstraction, system_architecture_roadmap_step4_gesture_handler_migration [EXTRACTED 1.00]
- **GitNexus MCP tool set** — claude_skills_gitnexus_gitnexus_guide_skill_query, claude_skills_gitnexus_gitnexus_guide_skill_context, claude_skills_gitnexus_gitnexus_guide_skill_impact, claude_skills_gitnexus_gitnexus_guide_skill_detect_changes, claude_skills_gitnexus_gitnexus_guide_skill_rename, claude_skills_gitnexus_gitnexus_guide_skill_cypher, claude_skills_gitnexus_gitnexus_guide_skill_trace [EXTRACTED 1.00]
- **GitNexus workflow skill suite** — claude_skills_gitnexus_gitnexus_cli_skill_gitnexus_cli, claude_skills_gitnexus_gitnexus_debugging_skill_gitnexus_debugging, claude_skills_gitnexus_gitnexus_exploring_skill_gitnexus_exploring, claude_skills_gitnexus_gitnexus_guide_skill_gitnexus_guide, claude_skills_gitnexus_gitnexus_impact_analysis_skill_gitnexus_impact_analysis, claude_skills_gitnexus_gitnexus_refactoring_skill_gitnexus_refactoring [EXTRACTED 1.00]

## Communities (54 total, 42 thin omitted)

### Community 0 - "Roadmap V2 Mimarisi ve Servis Kavramlari"
Cohesion: 0.06
Nodes (48): react-native-gesture-handler, zustand, react-native-gesture-handler, Acil Aksiyon Planı, <BatteryClockOverlay />, Dependency Injection (DI) mantığı, EpubManager, Faz 1: Divide and Conquer (+40 more)

### Community 1 - "App Navigation, Drawer ve Theme"
Cohesion: 0.09
Nodes (35): App(), CustomDrawerContent(), Drawer, DrawerNavigator(), Root, RootStackParamList, AlertButton, DockAlert() (+27 more)

### Community 2 - "Reader Components ve WebView Hooks"
Cohesion: 0.09
Nodes (25): DrawerTab, ReaderDrawer, ReaderDrawerProps, styles, ReaderHeader, ReaderHeaderProps, styles, ReaderStatusOverlay (+17 more)

### Community 3 - "Expo Android App Config"
Cohesion: 0.06
Nodes (32): backgroundColor, foregroundImage, adaptiveIcon, package, permissions, predictiveBackGestureEnabled, backgroundColor, barStyle (+24 more)

### Community 4 - "GitNexus CLI Tooling"
Cohesion: 0.14
Nodes (30): GitNexus epub-reader index (AGENTS.md), GitNexus epub-reader index (CLAUDE.md), analyze command, clean command, gitnexus-cli skill, list command, status command, wiki command (+22 more)

### Community 5 - "EPUB Storage, Merge ve Library Store"
Cohesion: 0.15
Nodes (23): FALLBACK_COLORS, getFallbackColor(), MergeOrderScreen(), styles, { width }, EPUB_STORAGE_DIR, EpubChapter, EpubParseResult (+15 more)

### Community 6 - "Package Build ve Lint Config"
Cohesion: 0.09
Nodes (22): devDependencies, eslint, eslint-config-expo, @types/diff-match-patch, @types/react, typescript, main, name (+14 more)

### Community 7 - "Core RN/Expo Navigation Dependencies"
Cohesion: 0.15
Nodes (13): dependencies, expo, expo-linking, @react-native-async-storage/async-storage, react-native-volume-manager, react-native-web, @react-navigation/native, expo (+5 more)

### Community 8 - "Expo Media/Status Plugin Dependencies"
Cohesion: 0.18
Nodes (11): plugins, expo-font, expo-image, expo-sharing, expo-status-bar, expo-web-browser, expo-font, expo-image (+3 more)

### Community 9 - "TypeScript Config"
Cohesion: 0.22
Nodes (8): compilerOptions, paths, strict, extends, include, expo/tsconfig.base, **/*.ts, **/*.tsx

### Community 10 - "Android Adaptive Icon Spec (Monochrome)"
Cohesion: 0.67
Nodes (3): Android Adaptive Icon (Monochrome Layer) Spec, epub-reader App, Android Monochrome Icon (chevron mark)

### Community 12 - "Native Android Volume Key Integration"
Cohesion: 0.67
Nodes (3): DeviceEventEmitter, Native Katman (Android) ile Entegrasyon Sorunu, Volume Keys Listener (Activity-level)

## Ambiguous Edges - Review These
- `Faz 3: State Optimizasyonu (Zustand Selectors)` → `useLibraryStore`  [AMBIGUOUS]
  system_architecture_roadmap.md · relation: references

## Knowledge Gaps
- **163 isolated node(s):** `RootStackParamList`, `AlertButton`, `DockAlertProps`, `ReaderDockProps`, `Props` (+158 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **42 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Faz 3: State Optimizasyonu (Zustand Selectors)` and `useLibraryStore`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **Why does `dependencies` connect `Core RN/Expo Navigation Dependencies` to `Roadmap V2 Mimarisi ve Servis Kavramlari`, `Package Build ve Lint Config`, `Expo Media/Status Plugin Dependencies`, `Diff-Match-Patch Dependency`, `Expo Battery Dependency`, `Expo Constants Dependency`, `Document Picker Dependency`, `Expo File System Dependency`, `Expo Haptics Dependency`, `Intent Launcher Dependency`, `Keep Awake Dependency`, `Media Library Dependency`, `Navigation Bar Dependency`, `Splash Screen Dependency`, `Expo Symbols Dependency`, `System UI Dependency`, `Vector Icons Dependency`, `Fflate Compression Dependency`, `React Dependency`, `React DOM Dependency`, `React Native Dependency`, `Draggable FlatList Dependency`, `Reanimated Dependency`, `Safe Area Context Dependency`, `React Native Screens Dependency`, `WebView Dependency`, `React Native Worklets Dependency`, `Bottom Tabs Navigation Dependency`, `Drawer Navigation Dependency`, `Navigation Elements Dependency`, `Native Stack Navigation Dependency`, `Sanitize HTML Dependency`, `Sanitize HTML Types Dependency`?**
  _High betweenness centrality (0.485) - this node is a cross-community bridge._
- **Why does `expo-status-bar` connect `Expo Media/Status Plugin Dependencies` to `App Navigation, Drawer ve Theme`, `Reader Components ve WebView Hooks`?**
  _High betweenness centrality (0.250) - this node is a cross-community bridge._
- **Why does `expo-status-bar` connect `Expo Media/Status Plugin Dependencies` to `Core RN/Expo Navigation Dependencies`?**
  _High betweenness centrality (0.201) - this node is a cross-community bridge._
- **What connects `RootStackParamList`, `AlertButton`, `DockAlertProps` to the rest of the system?**
  _163 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Roadmap V2 Mimarisi ve Servis Kavramlari` be split into smaller, more focused modules?**
  _Cohesion score 0.057624113475177305 - nodes in this community are weakly interconnected._
- **Should `App Navigation, Drawer ve Theme` be split into smaller, more focused modules?**
  _Cohesion score 0.09494949494949495 - nodes in this community are weakly interconnected._