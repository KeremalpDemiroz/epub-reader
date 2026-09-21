# Graph Report - epub-reader  (2026-09-20)

## Corpus Check
- 3 files · ~120,870 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 340 nodes · 510 edges · 67 communities (14 shown, 53 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 8 edges (avg confidence: 0.78)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Reader Dock & Drawer UI
- Reader Gesture & Header UI
- Expo App Config
- GitNexus MCP Tooling
- Package Build Config
- EPUB Storage & Export
- Native Module Dependencies
- TypeScript Config
- Chapter Navigation Fixes
- Android Adaptive Icon Spec
- ESLint Config
- Theming Architecture
- Dock & Gesture Zone Tuning
- File Import & Permissions
- Android Icon Background
- Expo SDK Dependency
- Expo Battery Dependency
- Expo Constants Dependency
- Document Picker Dependency
- Expo File System Dependency
- Expo Haptics Dependency
- Expo Image Dependency
- Intent Launcher Dependency
- Keep Awake Dependency
- Expo Linking Dependency
- Media Library Dependency
- Navigation Bar Dependency
- Status Bar Dependency
- Expo Symbols Dependency
- System UI Dependency
- Vector Icons Dependency
- Web Browser Dependency
- Fflate Compression Dependency
- React Dependency
- React DOM Dependency
- React Native Dependency
- Async Storage Dependency
- Draggable FlatList Dependency
- Gesture Handler Dependency
- Reanimated Dependency
- Safe Area Context Dependency
- React Native Screens Dependency
- Volume Manager Dependency
- React Native Web Dependency
- WebView Dependency
- Bottom Tabs Navigation Dependency
- Drawer Navigation Dependency
- Navigation Elements Dependency
- React Navigation Core Dependency
- Native Stack Navigation Dependency
- Sanitize HTML Dependency
- Sanitize HTML Types Dependency
- Zustand State Dependency
- Expo Project Scaffold
- Edit Mode & Gesture UX
- Android Icon Foreground
- App Favicon
- App Icon Artwork
- Icon Demo Artwork
- Partial React Logo Asset
- React Logo Asset 2x
- React Logo Asset 3x
- React Logo Asset
- Splash Icon Artwork
- Line Height Ratio Lock
- Viewport Zoom Lock
- Viewport Zoom Lock

## God Nodes (most connected - your core abstractions)
1. `gitnexus-guide skill` - 24 edges
2. `useThemeStore` - 16 edges
3. `expo` - 16 edges
4. `gitnexus-cli skill` - 13 edges
5. `useLibraryStore` - 12 edges
6. `decodeBase64()` - 11 edges
7. `useTimelineStore` - 10 edges
8. `gitnexus-refactoring skill` - 10 edges
9. `gitnexus-debugging skill` - 9 edges
10. `MergeOrderScreen()` - 8 edges

## Surprising Connections (you probably didn't know these)
- `GitNexus epub-reader index (CLAUDE.md)` --semantically_similar_to--> `GitNexus epub-reader index (AGENTS.md)`  [INFERRED] [semantically similar]
  CLAUDE.md → AGENTS.md
- `epub-reader Expo project scaffold` --conceptually_related_to--> `.expo folder (Expo dev artifacts)`  [INFERRED]
  epub-reader/README.md → .expo/README.md
- `GitNexus epub-reader index (AGENTS.md)` --references--> `gitnexus-cli skill`  [EXTRACTED]
  AGENTS.md → .claude/skills/gitnexus/gitnexus-cli/SKILL.md
- `GitNexus epub-reader index (AGENTS.md)` --references--> `gitnexus-debugging skill`  [EXTRACTED]
  AGENTS.md → .claude/skills/gitnexus/gitnexus-debugging/SKILL.md
- `GitNexus epub-reader index (AGENTS.md)` --references--> `gitnexus-exploring skill`  [EXTRACTED]
  AGENTS.md → .claude/skills/gitnexus/gitnexus-exploring/SKILL.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **epub-reader dynamic theming overhaul** — optimizing_epub_reader_engine_usethemestore, optimizing_epub_reader_engine_dark_mode_architecture, optimizing_epub_reader_engine_universal_reading_preferences [EXTRACTED 1.00]
- **GitNexus MCP tool set** — claude_skills_gitnexus_gitnexus_guide_skill_query, claude_skills_gitnexus_gitnexus_guide_skill_context, claude_skills_gitnexus_gitnexus_guide_skill_impact, claude_skills_gitnexus_gitnexus_guide_skill_detect_changes, claude_skills_gitnexus_gitnexus_guide_skill_rename, claude_skills_gitnexus_gitnexus_guide_skill_cypher, claude_skills_gitnexus_gitnexus_guide_skill_trace [EXTRACTED 1.00]
- **GitNexus workflow skill suite** — claude_skills_gitnexus_gitnexus_cli_skill_gitnexus_cli, claude_skills_gitnexus_gitnexus_debugging_skill_gitnexus_debugging, claude_skills_gitnexus_gitnexus_exploring_skill_gitnexus_exploring, claude_skills_gitnexus_gitnexus_guide_skill_gitnexus_guide, claude_skills_gitnexus_gitnexus_impact_analysis_skill_gitnexus_impact_analysis, claude_skills_gitnexus_gitnexus_refactoring_skill_gitnexus_refactoring [EXTRACTED 1.00]

## Communities (67 total, 53 thin omitted)

### Community 0 - "Reader Dock & Drawer UI"
Cohesion: 0.10
Nodes (36): AlertButton, DockAlert(), DockAlertProps, styles, ReaderDock, ReaderDockProps, styles, useReaderState() (+28 more)

### Community 1 - "Reader Gesture & Header UI"
Cohesion: 0.07
Nodes (26): Drawer, plugins, Root, RootStackParamList, DrawerTab, ReaderDrawer, ReaderDrawerProps, styles (+18 more)

### Community 2 - "Expo App Config"
Cohesion: 0.06
Nodes (32): backgroundColor, foregroundImage, adaptiveIcon, package, permissions, predictiveBackGestureEnabled, backgroundColor, barStyle (+24 more)

### Community 3 - "GitNexus MCP Tooling"
Cohesion: 0.14
Nodes (24): useDockAlert(), FALLBACK_COLORS, getFallbackColor(), MergeOrderScreen(), styles, { width }, EPUB_STORAGE_DIR, EpubChapter (+16 more)

### Community 4 - "Package Build Config"
Cohesion: 0.14
Nodes (30): GitNexus epub-reader index (AGENTS.md), GitNexus epub-reader index (CLAUDE.md), analyze command, clean command, gitnexus-cli skill, list command, status command, wiki command (+22 more)

### Community 5 - "EPUB Storage & Export"
Cohesion: 0.09
Nodes (22): devDependencies, eslint, eslint-config-expo, @types/diff-match-patch, @types/react, typescript, main, name (+14 more)

### Community 6 - "Native Module Dependencies"
Cohesion: 0.18
Nodes (11): diff-match-patch, dependencies, diff-match-patch, expo-font, expo-sharing, expo-splash-screen, react-native-worklets, expo-font (+3 more)

### Community 7 - "TypeScript Config"
Cohesion: 0.22
Nodes (8): compilerOptions, paths, strict, extends, include, expo/tsconfig.base, **/*.ts, **/*.tsx

### Community 8 - "Chapter Navigation Fixes"
Cohesion: 0.33
Nodes (5): createPatch(), dmp, fileStorage, TimelineState, Version

### Community 9 - "Android Adaptive Icon Spec"
Cohesion: 0.50
Nodes (4): Double-scroll confirmation for chapter transition (endReachCount), Horizontal overflow / word-wrap fix, CSS-column paged reading mode, Volume-button page navigation (disabled, Expo Go incompatible)

### Community 10 - "ESLint Config"
Cohesion: 0.67
Nodes (3): Android Adaptive Icon (Monochrome Layer) Spec, epub-reader App, Android Monochrome Icon (chevron mark)

### Community 12 - "Dock & Gesture Zone Tuning"
Cohesion: 0.67
Nodes (3): Two-dimensional theme architecture (palette x dark/light), Universal (book-agnostic) reading preferences, useThemeStore dynamic persisted theme store

### Community 13 - "File Import & Permissions"
Cohesion: 0.67
Nodes (3): Floating rounded dock UI, Right-drawer swipe detection zone tuning, SafeArea / notch-camera insets handling

### Community 14 - "Android Icon Background"
Cohesion: 0.67
Nodes (3): MediaLibrary + StorageAccessFramework folder scan permission flow, Multi-file EPUB import + duplicate prevention by filename, Reading-progress percentage badge on book cards

## Ambiguous Edges - Review These
- `Multi-file EPUB import + duplicate prevention by filename` → `Reading-progress percentage badge on book cards`  [AMBIGUOUS]
  Optimizing EPUB Reader Engine.md · relation: conceptually_related_to

## Knowledge Gaps
- **160 isolated node(s):** `AlertButton`, `DockAlertProps`, `ReaderDockProps`, `Props`, `RootStackParamList` (+155 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 178 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **53 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Multi-file EPUB import + duplicate prevention by filename` and `Reading-progress percentage badge on book cards`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `dependencies` connect `Native Module Dependencies` to `EPUB Storage & Export`, `Expo Battery Dependency`, `Expo Constants Dependency`, `Document Picker Dependency`, `Expo File System Dependency`, `Expo Haptics Dependency`, `Expo Image Dependency`, `Intent Launcher Dependency`, `Keep Awake Dependency`, `Expo Linking Dependency`, `Media Library Dependency`, `Navigation Bar Dependency`, `Status Bar Dependency`, `Expo Symbols Dependency`, `System UI Dependency`, `Vector Icons Dependency`, `Web Browser Dependency`, `Fflate Compression Dependency`, `React Dependency`, `React DOM Dependency`, `React Native Dependency`, `Async Storage Dependency`, `Draggable FlatList Dependency`, `Gesture Handler Dependency`, `Reanimated Dependency`, `Safe Area Context Dependency`, `React Native Screens Dependency`, `Volume Manager Dependency`, `React Native Web Dependency`, `WebView Dependency`, `Bottom Tabs Navigation Dependency`, `Drawer Navigation Dependency`, `Navigation Elements Dependency`, `React Navigation Core Dependency`, `Native Stack Navigation Dependency`, `Sanitize HTML Dependency`, `Sanitize HTML Types Dependency`, `Zustand State Dependency`, `Expo Project Scaffold`?**
  _High betweenness centrality (0.098) - this node is a cross-community bridge._
- **Why does `plugins` connect `Reader Gesture & Header UI` to `Expo App Config`?**
  _High betweenness centrality (0.076) - this node is a cross-community bridge._
- **Why does `expo` connect `Expo App Config` to `Reader Gesture & Header UI`?**
  _High betweenness centrality (0.076) - this node is a cross-community bridge._
- **What connects `AlertButton`, `DockAlertProps`, `ReaderDockProps` to the rest of the system?**
  _160 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Reader Dock & Drawer UI` be split into smaller, more focused modules?**
  _Cohesion score 0.09898242368177614 - nodes in this community are weakly interconnected._
- **Should `Reader Gesture & Header UI` be split into smaller, more focused modules?**
  _Cohesion score 0.06756756756756757 - nodes in this community are weakly interconnected._