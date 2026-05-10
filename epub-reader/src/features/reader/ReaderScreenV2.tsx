import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react'; // force-recompile-1
import {
  StyleSheet, View, Text, TouchableOpacity, ActivityIndicator, Animated, Platform,
  KeyboardAvoidingView, DeviceEventEmitter, Keyboard, BackHandler
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { WebView } from 'react-native-webview';
import * as NavigationBar from 'expo-navigation-bar';
import * as FileSystem from 'expo-file-system/legacy';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useKeepAwake } from 'expo-keep-awake';

import { useReaderState } from './hooks/useReaderState';
import { useWebViewBridge } from './hooks/useWebViewBridge';
import { useReaderGestures } from './hooks/useReaderGestures';

import { ReaderHeader } from './components/ReaderHeader';
import { ReaderDock } from './components/ReaderDock';
import { ReaderDrawer } from './components/ReaderDrawer';
import { ReaderStatusOverlay } from './components/ReaderStatusOverlay';
import { sanitizeEpubHtml } from '../../services/SanitizerService';
import { strFromU8 } from 'fflate';
import { decodeBase64 } from '../../utils/base64';

const MIN_FONT = 12;
const MAX_FONT = 28;
const BG_PRESETS = [
  { label: 'Beyaz',  bg: '#FFFFFF', fg: '#111827' },
  { label: 'Sepia',  bg: '#F8F0DC', fg: '#3B2F1A' },
  { label: 'Krem',   bg: '#FAF3E3', fg: '#2C2C2C' },
  { label: 'Gece',   bg: '#1C1C1E', fg: '#E5E5E7' },
  { label: 'Yeşil',  bg: '#EAF4EA', fg: '#1A3A1A' },
];

let VolumeManager: any = null;
try { VolumeManager = require('react-native-volume-manager').VolumeManager; } catch (e) {}

export default function ReaderScreenV2() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const webViewRef = useRef<WebView>(null);

  useKeepAwake();

  const { insets, width, height, themeState, libraryState, timelineState } = useReaderState();
  const DRAWER_WIDTH = width * 0.78;

  const bgPreset = useMemo(() => BG_PRESETS.find(p => p.label === themeState.bgPresetId) || BG_PRESETS[0], [themeState.bgPresetId]);

  // ── State ──
  const [isLoading, setIsLoading] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);
  const [isNavMode, setIsNavMode] = useState(false);
  const [dockMode, setDockMode] = useState<'nav' | 'font' | 'bg' | 'layout' | 'editPrompt'>('nav');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const isDrawerOpenRef = useRef(false);
  const [scrollPct, setScrollPct] = useState(0);
  const [isWebViewReady, setIsWebViewReady] = useState(true);

  // ── Refs ──
  const isNavigatingBack = useRef(false);
  const pendingScrollRestore = useRef<number | null>(null);
  const isNavModeRef = useRef(isNavMode);
  useEffect(() => { isNavModeRef.current = isNavMode; }, [isNavMode]);

  // ── Animasyonlar ──
  const headerAnim = useRef(new Animated.Value(0)).current;
  const dockAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(DRAWER_WIDTH)).current;
  const navBarHeight = useRef(insets.bottom).current;

  // ── Data ──
  const targetBookId = route.params?.bookId || timelineState.activeBookId;
  const book = targetBookId ? libraryState.getBook(targetBookId) : undefined;
  const targetChapterId = book?.currentChapterId || timelineState.activeChapterId || book?.chapters?.[0]?.id;
  const nodeKey = `${targetBookId}_${targetChapterId}`;
  const versions = (targetBookId && targetChapterId) ? (timelineState.versionsByNode[nodeKey] || []) : [];
  const currentChapter = book?.chapters?.find(c => c.id === targetChapterId);
  const chapterIdx = book?.chapters?.findIndex(c => c.id === targetChapterId) ?? -1;
  const hasPrev = chapterIdx > 0;
  const hasNext = book ? chapterIdx < (book.chapters?.length ?? 0) - 1 : false;

  // ── Navigation Toggle ──
  const showNav = useCallback(() => {
    setIsNavMode(true);
    if (Platform.OS === 'android') NavigationBar.setVisibilityAsync('visible');
    Animated.parallel([
      Animated.timing(headerAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.timing(dockAnim,   { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
  }, [headerAnim, dockAnim]);

  const hideNav = useCallback(() => {
    if (Platform.OS === 'android') NavigationBar.setVisibilityAsync('hidden');
    Animated.parallel([
      Animated.timing(headerAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(dockAnim,   { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => {
      setIsNavMode(false);
      setDockMode('nav');
    });
  }, [headerAnim, dockAnim]);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const toggleNav = useCallback(() => {
    if (isNavMode) hideNav(); else showNav();
  }, [isNavMode, hideNav, showNav]);

  const openDrawer = useCallback(() => {
    if (isNavMode) hideNav();
    slideAnim.stopAnimation();
    slideAnim.setValue(DRAWER_WIDTH);
    isDrawerOpenRef.current = true;
    setIsDrawerOpen(true);
    requestAnimationFrame(() => {
      Animated.timing(slideAnim, { toValue: 0, duration: 250, useNativeDriver: true }).start();
    });
  }, [isNavMode, hideNav, slideAnim, DRAWER_WIDTH]);

  const closeDrawer = useCallback(() => {
    Animated.timing(slideAnim, { toValue: DRAWER_WIDTH, duration: 200, useNativeDriver: true })
      .start(() => {
        isDrawerOpenRef.current = false;
        setIsDrawerOpen(false);
      });
  }, [slideAnim, DRAWER_WIDTH]);

  const goChapter = useCallback((dir: 1 | -1) => {
    if (!book?.chapters) return;
    const next = book.chapters[chapterIdx + dir];
    if (next) libraryState.updateCurrentChapter(targetBookId!, next.id);
  }, [book, chapterIdx, libraryState, targetBookId]);

  // ── Hooks ──
  const { panResponder, drawerPanResponder } = useReaderGestures({
    width, DRAWER_WIDTH, isDrawerOpenRef, setIsDrawerOpen, slideAnim, isEditMode
  });

  const { handleMsg, saveEdits, handleVolumeKey } = useWebViewBridge({
    webViewRef,
    readerMode: themeState.readerMode,
    isEditMode, isNavMode, targetBookId, targetChapterId, chapterIdx,
    bookChapters: book?.chapters,
    addVersion: timelineState.addVersion,
    updateChapterTitle: libraryState.updateChapterTitle,
    updateScrollPosition: libraryState.updateScrollPosition,
    updateCurrentChapter: libraryState.updateCurrentChapter,
    setScrollPct, setIsWebViewReady, isNavigatingBack, toggleNav, setDockMode
  });

  // ── Effects ──
  useEffect(() => {
    if (Platform.OS === 'android') {
      NavigationBar.setBehaviorAsync('overlay-swipe');
      NavigationBar.setVisibilityAsync('hidden');
    }
    return () => {
      if (Platform.OS === 'android') {
        NavigationBar.setBehaviorAsync('inset-touch');
        NavigationBar.setVisibilityAsync('visible');
      }
    };
  }, []);

  useEffect(() => {
    if (!targetBookId || !targetChapterId) return;
    if (timelineState.activeBookId === targetBookId && timelineState.activeChapterId === targetChapterId && timelineState.currentText) return;
    if (!book?.chapters) return;
    
    const chapter = book.chapters.find(c => c.id === targetChapterId) || book.chapters[0];
    if (!chapter) return;
    
    console.log(`[Reader][Chapter] Yükleniyor: ${chapter.title || chapter.id}`);
    setIsLoading(true);

    FileSystem.readAsStringAsync(chapter.fullPath, { encoding: 'base64' })
      .then(async b64 => {
        let htmlStr = strFromU8(decodeBase64(b64));
        
        // Android WebView yerel dosya (file://) erişimlerini engellediği için,
        // görselleri tespit edip Base64 formatında HTML içine gömüyoruz.
        const baseDir = chapter.chapterBaseDir;
        const imgRegex = /(src|href)=["'](.*?\.(jpg|jpeg|png|gif|svg|webp))["']/gi;
        let match;
        const replacements = [];
        
        while ((match = imgRegex.exec(htmlStr)) !== null) {
          const attr = match[1];
          const relPath = match[2];
          
          if (!relPath.startsWith('http') && !relPath.startsWith('data:') && !relPath.startsWith('file://')) {
            let resolvedPath = baseDir + relPath;
            while (resolvedPath.includes('/../')) {
              resolvedPath = resolvedPath.replace(/\/[^\/]+\/\.\.\//, '/');
            }
            replacements.push({ fullMatch: match[0], attr, resolvedPath });
          }
        }

        for (const rep of replacements) {
          try {
            const extMatch = rep.resolvedPath.match(/\.(jpg|jpeg|png|gif|svg|webp)$/i);
            const ext = extMatch ? extMatch[1].toLowerCase() : 'jpeg';
            const mimeType = ext === 'svg' ? 'image/svg+xml' : `image/${ext === 'jpg' ? 'jpeg' : ext}`;
            
            const base64Data = await FileSystem.readAsStringAsync(rep.resolvedPath, { encoding: 'base64' });
            const dataUri = `${rep.attr}="data:${mimeType};base64,${base64Data}"`;
            htmlStr = htmlStr.replace(rep.fullMatch, dataUri);
          } catch (e) {
             console.warn("Görsel okunamadı:", rep.resolvedPath);
          }
        }

        // HTML içeriğini temizle (Güvenlik)
        htmlStr = await sanitizeEpubHtml(htmlStr);

        timelineState.setActiveChapter(targetBookId, chapter.id, htmlStr);
        libraryState.updateCurrentChapter(targetBookId, chapter.id);
        setIsLoading(false);
        const savedPct = book?.currentScrollPct || 0;
        setScrollPct(savedPct);
        // Her zaman WebView'ı gizli başlat — beyaz flash'ı önle
        setIsWebViewReady(false);
        if (isNavigatingBack.current) {
          // geri navigasyonda onLoadEnd halledecek
        } else if (savedPct > 0.01) {
          pendingScrollRestore.current = savedPct;
        } else {
          // onLoadEnd'de READY mesajı ile gösterilecek
          pendingScrollRestore.current = 0;
        }
      })
      .catch(e => { console.error(e); setIsLoading(false); });
  }, [targetBookId, targetChapterId, timelineState.activeBookId, timelineState.activeChapterId]);

  useEffect(() => {
    if (!themeState.enableVolumeNavigation) return;
    const sub = DeviceEventEmitter.addListener('onVolumeKey', (event: any) => {
      const dir = event?.direction;
      if (isNavModeRef.current) {
        if (VolumeManager) {
          VolumeManager.getVolume().then((v: any) => {
            const next = dir === 'up' ? Math.min(1, v.volume + 0.0625) : Math.max(0, v.volume - 0.0625);
            VolumeManager.setVolume(next, { showUI: true });
          });
        }
        return;
      }
      handleVolumeKey(dir === 'up' ? 'next' : 'prev');
    });
    return () => sub.remove();
  }, [themeState.enableVolumeNavigation, handleVolumeKey]);

  useEffect(() => {
    if (!themeState.enableReadingTracking || !targetBookId) return;
    const interval = setInterval(() => {
      libraryState.addReadingTime(targetBookId, 60);
    }, 60000);
    return () => clearInterval(interval);
  }, [themeState.enableReadingTracking, targetBookId, libraryState]);

  // ── Scripts ──
  const initScript = `
    (function(){
      var meta = document.createElement('meta');
      meta.name = 'viewport';
      meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
      document.getElementsByTagName('head')[0].appendChild(meta);

      document.documentElement.style.fontSize='${themeState.fontSize}px';
      document.body.style.lineHeight='${themeState.lineHeight}';
      document.body.style.background='${bgPreset.bg}';
      document.body.style.color='${bgPreset.fg}';
      
      window.isPaged = ${themeState.readerMode === 'paged'};
      if (window.isPaged) {
        document.documentElement.style.overflow = 'hidden';
        document.body.style.columnWidth = '${width - 32}px';
        document.body.style.columnGap = '32px';
        document.body.style.height = '100vh';
        document.body.style.overflow = 'visible';
        document.body.style.padding = '${insets.top + 8}px 16px 16px 16px';
        document.body.style.margin = '0';
        document.body.style.boxSizing = 'border-box';
      } else {
        document.body.style.padding='${insets.top + 8}px 16px ${themeState.scrollBuffer}vh 16px';
        document.body.style.boxSizing='border-box';
        document.body.style.margin='0';
      }

      var style = document.createElement('style');
      style.innerHTML = '* { max-width: 100% !important; word-wrap: break-word; overflow-wrap: break-word; box-sizing: border-box; } ' +
                        'img { max-width: 100% !important; max-height: 85vh !important; width: auto !important; height: auto !important; display: block; margin: 0 auto; object-fit: contain; } ' +
                        'video, iframe { max-width: 100% !important; max-height: 85vh !important; display: block; } ' +
                        'svg { max-width: 100% !important; max-height: 85vh !important; } ' +
                        'pre, code { max-width: 100%; white-space: pre-wrap; }';
      document.head.appendChild(style);

      var endReachCount = 0;
      var topReachCount = 0;
      var lastReachTime = 0;
      var lastTopReachTime = 0;
      window.currentPage = 0;
      window.maxPage = 0;
      window.__isInitialized = false;
      window.__isNavigating = false;

      function updatePagedProgress(actionName, cursorAbsoluteX) {
        var iw = window.innerWidth;
        var oldTransition = document.body.style.transition;
        document.body.style.transition = 'none';
        var oldTransform = document.body.style.transform;
        document.body.style.transform = 'none';
        
        var sw = document.documentElement.scrollWidth || document.body.scrollWidth;
        
        document.body.style.transform = oldTransform;
        void document.body.offsetHeight; // Zorunlu reflow
        document.body.style.transition = oldTransition;
        
        window.maxPage = Math.max(0, Math.round(sw / iw) - 1);
        
        if (cursorAbsoluteX !== null && cursorAbsoluteX !== undefined && !isNaN(cursorAbsoluteX)) {
          window.currentPage = Math.floor(cursorAbsoluteX / iw);
        }
        
        window.scrollTo(window.scrollX, 0); // Ekran düzeltmesi için Y eksenini sıfırla
        window.currentPage = Math.min(Math.max(0, window.currentPage), window.maxPage);
        document.body.style.transform = 'translateX(-' + (window.currentPage * iw) + 'px)';
        
        var pct = window.maxPage > 0 ? (window.currentPage / window.maxPage) : 0;
        window.ReactNativeWebView.postMessage(JSON.stringify({ type:'SCROLL', pct: Math.min(1, Math.max(0, pct)) }));
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'DEBUG_PAGE', action: actionName || 'UPDATE', sw: 0, iw: iw, maxPage: window.maxPage, currentPage: window.currentPage }));
      }

      var lastScrollMsgTime = 0;
      window.addEventListener('scroll', function() {
        if (window.isPaged) return;
        if (document.body.contentEditable === 'true') return; // Edit modunda scrollPct'yi sabitle
        var pct = window.scrollY / Math.max(1, document.body.scrollHeight - window.innerHeight);
        var atBottom = (window.innerHeight + Math.ceil(window.scrollY)) >= document.body.offsetHeight - 80;
        var atTop = window.scrollY <= 10;
        
        if (!atBottom && !atTop && pct > 0.1 && pct < 0.9) { 
          endReachCount = 0; 
          topReachCount = 0; 
        }
        
        var now = Date.now();
        if (now - lastScrollMsgTime > 150 || atBottom || atTop) {
           window.ReactNativeWebView.postMessage(JSON.stringify({ type:'SCROLL', pct: Math.min(1, Math.max(0, pct)) }));
           lastScrollMsgTime = now;
        }
      });

      var resizeTimeout;
      var lastWidth = window.innerWidth;
      var lastHeight = window.innerHeight;
      window.addEventListener('resize', function() {
        if (window.innerWidth === lastWidth && window.innerHeight === lastHeight) return;
        lastWidth = window.innerWidth;
        lastHeight = window.innerHeight;

        if (window.isPaged && window.__webViewReady) {
          clearTimeout(resizeTimeout);
          resizeTimeout = setTimeout(function() {
            var cursorAbsoluteX = null;
            if (document.body.contentEditable === "true") {
              var sel = window.getSelection();
              if (sel && sel.rangeCount > 0) {
                var rect = sel.getRangeAt(0).getBoundingClientRect();
                var bodyRect = document.body.getBoundingClientRect();
                cursorAbsoluteX = rect.left - bodyRect.left;
              }
            }
            window.updatePagedProgress('RESIZE', cursorAbsoluteX);
          }, 200);
        }
      });

      var touchStartYScroll = 0;
      document.addEventListener('touchstart', function(e) { touchStartYScroll = e.touches[0].clientY; }, { passive: true });
      document.addEventListener('touchend', function(e) {
        if (window.isPaged) return;
        if (document.body.contentEditable === 'true') return;
        var dy = e.changedTouches[0].clientY - touchStartYScroll;
        var atBottom2 = (window.innerHeight + Math.ceil(window.scrollY)) >= document.body.offsetHeight - 80;
        var atTop2 = window.scrollY <= 10;
        
        if (dy < -40 && atBottom2) { 
          endReachCount++;
          if (endReachCount === 1) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type:'TOAST', msg: 'Sonraki bölüme geçmek için tekrar yukarı kaydırın' }));
          } else if (endReachCount >= 2) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type:'END_OF_CHAPTER' }));
            endReachCount = 0;
          }
        } 
        else if (dy > 40 && atTop2) { 
          topReachCount++;
          if (topReachCount === 1) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type:'TOAST', msg: 'Önceki bölüme dönmek için tekrar aşağı kaydırın' }));
          } else if (topReachCount >= 2) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type:'START_OF_CHAPTER' }));
            topReachCount = 0;
          }
        }
      }, { passive: true });

      var startX = 0, startY = 0;
      document.addEventListener('touchstart', function(e) {
        if(document.body.contentEditable === "true") return;
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
      }, { passive: true });

      window.goNext = function() {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'DEBUG_PAGE', action: 'goNext_CALLED', sw: 0, iw: window.innerWidth, maxPage: window.maxPage, currentPage: window.currentPage, isPaged: window.isPaged, init: window.__isInitialized, nav: window.__isNavigating }));
        if (!window.__isInitialized || window.__isNavigating || !window.isPaged) return;
        var pageW = window.innerWidth;
        if (window.currentPage >= window.maxPage) {
          window.__isNavigating = true;
          window.ReactNativeWebView.postMessage(JSON.stringify({ type:'END_OF_CHAPTER', sw: window.maxPage, iw: pageW, currentPage: window.currentPage, maxPage: window.maxPage }));
        } else {
          window.currentPage++;
          document.body.style.transform = 'translateX(-' + (window.currentPage * pageW) + 'px)';
          updatePagedProgress('GO_NEXT');
        }
      };

      window.goPrev = function() {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'DEBUG_PAGE', action: 'goPrev_CALLED', sw: 0, iw: window.innerWidth, maxPage: window.maxPage, currentPage: window.currentPage, isPaged: window.isPaged, init: window.__isInitialized, nav: window.__isNavigating }));
        if (!window.__isInitialized || window.__isNavigating || !window.isPaged) return;
        var pageW = window.innerWidth;
        if (window.currentPage <= 0) {
          window.__isNavigating = true;
          window.ReactNativeWebView.postMessage(JSON.stringify({ type:'START_OF_CHAPTER', sw: window.maxPage, iw: pageW, currentPage: window.currentPage }));
        } else {
          window.currentPage--;
          document.body.style.transform = 'translateX(-' + (window.currentPage * pageW) + 'px)';
          updatePagedProgress('GO_PREV');
        }
      };

      document.addEventListener('touchend', function(e) {
        if(window.isDrawerOpen || !window.isPaged || document.body.contentEditable === "true" || window.getSelection().toString() !== "" || !window.__webViewReady || !window.__isInitialized || window.__isNavigating) return;
        var dx = e.changedTouches[0].clientX - startX;
        var dy = e.changedTouches[0].clientY - startY;

        if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40) {
          if (dx < 0) window.goNext();
          else window.goPrev();
        }
      }, { passive: false });

      if (window.isPaged) {
        setTimeout(function() { 
          var oldTransform = document.body.style.transform;
          document.body.style.transform = 'none';
          var sw = document.documentElement.scrollWidth || document.body.scrollWidth;
          document.body.style.transform = oldTransform;
          var iw = window.innerWidth;
          window.maxPage = Math.max(0, Math.round(sw / iw) - 1);
          
          if (${isNavigatingBack.current ? 'true' : 'false'}) {
            window.currentPage = window.maxPage;
          } else {
            window.currentPage = Math.round(${scrollPct} * window.maxPage);
          }
          
          window.currentPage = Math.min(Math.max(0, window.currentPage), window.maxPage);
          document.body.style.transform = 'translateX(-' + (window.currentPage * iw) + 'px)';
          
          // Animasyonu transform uygulandıktan SONRA ekle ki flash olmasın
          setTimeout(function() {
            document.body.style.transition = 'transform 0.25s ease-out';
          }, 50);

          window.__isInitialized = true;
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'DEBUG_PAGE', action: 'INIT_SCRIPT', sw: sw, iw: iw, maxPage: window.maxPage, currentPage: window.currentPage }));
        }, 100);
      } else {
        setTimeout(function() {
          if (${isNavigatingBack.current ? 'true' : 'false'}) {
            window.scrollTo(0, document.body.scrollHeight);
          } else if (${scrollPct} > 0.01) {
            window.scrollTo(0, ${scrollPct} * Math.max(1, document.body.scrollHeight - window.innerHeight));
          }
        }, 100);
        window.__isInitialized = true;
      }

      window.__webViewReady = false;

      document.body.style.webkitUserSelect = "none";
      document.body.style.userSelect = "none";

      document.addEventListener('contextmenu', function(e) {
        if(document.body.contentEditable !== "true") {
          e.preventDefault();
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ASK_EDIT_MODE' }));
        }
      });

      document.addEventListener('click', function(e) {
        if(window.isDrawerOpen || document.body.contentEditable==="true") return;
        if (window.isPaged) {
          var ratio = e.clientX / window.innerWidth;
          var zone = ratio < 0.25 ? 'left' : ratio > 0.75 ? 'right' : 'mid';
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'TAP_ZONE', zone: zone }));
        } else {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'TOGGLE_NAV' }));
        }
      });
    })(); true;
  `;

  useEffect(() => {
    webViewRef.current?.injectJavaScript(`
      document.documentElement.style.fontSize='${themeState.fontSize}px';
      document.body.style.lineHeight='${themeState.lineHeight}';
      document.body.style.background='${bgPreset.bg}';
      document.body.style.color='${bgPreset.fg}';
      true;
    `);
  }, [themeState.fontSize, themeState.lineHeight, bgPreset]);

  const effectiveMode = isEditMode ? 'scroll' : themeState.readerMode;

  useEffect(() => {
    const pct = scrollPct;
    webViewRef.current?.injectJavaScript(`
      try {
        var savedPct = ${pct};
        window.isPaged = ${effectiveMode === 'paged'};
        if (window.isPaged) {
          document.documentElement.style.overflow = 'hidden';
          document.body.style.transition = 'none';
          document.body.style.columnWidth = '${width - 32}px';
          document.body.style.columnGap = '32px';
          document.body.style.height = '100vh';
          document.body.style.overflow = 'visible';
          document.body.style.padding = '${insets.top + 8}px 16px 16px 16px';
          document.body.style.margin = '0';
          document.body.style.boxSizing = 'border-box';
          setTimeout(function() {
            var oldTransform = document.body.style.transform;
            document.body.style.transform = 'none';
            var sw = document.documentElement.scrollWidth || document.body.scrollWidth;
            document.body.style.transform = oldTransform;
            var iw = window.innerWidth;
            window.maxPage = Math.max(0, Math.round(sw / iw) - 1);
            window.currentPage = Math.round(savedPct * window.maxPage);
            window.currentPage = Math.min(Math.max(0, window.currentPage), window.maxPage);
            document.body.style.transform = 'translateX(-' + (window.currentPage * iw) + 'px)';
            document.body.style.transition = 'transform 0.25s ease-out';
            window.__isInitialized = true;
          }, 150);
        } else {
          document.documentElement.style.overflow = '';
          document.body.style.transition = 'none';
          document.body.style.transform = 'none';
          document.body.style.columnWidth = 'auto';
          document.body.style.columnGap = 'normal';
          document.body.style.height = 'auto';
          document.body.style.overflowY = 'auto';
          document.body.style.overflowX = 'hidden';
          document.body.style.padding = '${insets.top + 8}px 16px ${themeState.scrollBuffer}vh 16px';
          setTimeout(function() {
            window.scrollTo(0, savedPct * Math.max(1, document.body.scrollHeight - window.innerHeight));
          }, 50);
        }
      } catch(e) {}
      true;
    `);
  }, [effectiveMode, width, insets.top, themeState.scrollBuffer]);

  useEffect(() => {
    if (isWebViewReady) {
      webViewRef.current?.injectJavaScript(`
        (function(){
          window.isPaged = ${effectiveMode === 'paged'};
          console.log('[WebView][Mode] Updated to: ' + (window.isPaged ? 'paged' : 'scroll'));
        })(); true;
      `);
    }
  }, [effectiveMode, isWebViewReady]);

  useEffect(() => {
    if (isWebViewReady) {
      const padding = isEditMode && !isKeyboardVisible && Platform.OS === 'android' ? Math.max(insets.bottom, 16) : 16;
      webViewRef.current?.injectJavaScript(`
        if (window.isPaged) {
          document.body.style.paddingBottom = '${padding}px';
          if (window.updatePagedProgress) window.updatePagedProgress('RESIZE', null);
        }
        true;
      `);
    }
  }, [isEditMode, isKeyboardVisible, insets.bottom, isWebViewReady]);

  useEffect(() => {
    if (isWebViewReady) {
      webViewRef.current?.injectJavaScript(`
        document.body.contentEditable = "${isEditMode ? 'true' : 'false'}";
        document.body.style.outline="${isEditMode ? '2px dashed #F59E0B' : 'none'}";
        document.body.style.userSelect = "${isEditMode ? 'auto' : 'none'}";
        document.body.style.webkitUserSelect = "${isEditMode ? 'auto' : 'none'}";

        if(${isEditMode}) {
          if (!window.__kbScrollSetup) {
            window.__kbScrollSetup = true;
            document.addEventListener('selectionchange', function() {
              var sel = window.getSelection();
              if (!sel || sel.rangeCount === 0) return;
              var range = sel.getRangeAt(0);
              var rect = range.getBoundingClientRect();
              var viewH = window.innerHeight;
              if (rect.bottom > viewH * 0.7 || rect.top < viewH * 0.3) {
                window.scrollBy({ top: rect.top - viewH * 0.5, behavior: 'smooth' });
              }
            });
            document.addEventListener('focusin', function(e) {
              setTimeout(function() {
                var sel = window.getSelection();
                if (sel && sel.rangeCount > 0) {
                  var rect = sel.getRangeAt(0).getBoundingClientRect();
                  var viewH = window.innerHeight;
                  window.scrollBy({ top: rect.top - viewH * 0.5, behavior: 'smooth' });
                }
              }, 100);
            });
          }
        } else {
          window.__kbScrollSetup = false;
          window.getSelection().removeAllRanges();
          if (!window.isPaged) {
            var restoreY = ${scrollPct} * Math.max(1, document.body.scrollHeight - window.innerHeight);
            window.scrollTo({ top: restoreY, behavior: 'instant' });
          }
        }
        true;
      `);
    }
  }, [isEditMode, isWebViewReady]);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    if (Platform.OS === 'android') {
      NavigationBar.setBackgroundColorAsync(bgPreset.bg);
      NavigationBar.setButtonStyleAsync(themeState.isDarkMode ? 'light' : 'dark');
    }
  }, [bgPreset.bg, themeState.isDarkMode]);

  const isKeyboardVisibleRef = useRef(isKeyboardVisible);
  useEffect(() => {
    isKeyboardVisibleRef.current = isKeyboardVisible;
  }, [isKeyboardVisible]);

  useEffect(() => {
    if (!isEditMode) return;
    const backAction = () => {
      if (isKeyboardVisibleRef.current) {
        return false; // let system close keyboard
      }
      setIsEditMode(false);
      return true; // prevent default back
    };
    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [isEditMode]);

  useEffect(() => {
    if (!isEditMode && !isNavMode && Platform.OS === 'android') {
      NavigationBar.setBehaviorAsync('overlay-swipe');
      NavigationBar.setVisibilityAsync('hidden');
    }
  }, [isEditMode, isNavMode]);

  useEffect(() => {
    if (isWebViewReady) {
      webViewRef.current?.injectJavaScript(`window.isDrawerOpen = ${isDrawerOpen}; true;`);
    }
  }, [isDrawerOpen, isWebViewReady]);

  // ── Render ──
  return (
    <View style={{ flex: 1, backgroundColor: bgPreset.bg }}>
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : isEditMode ? 'height' : undefined}
        keyboardVerticalOffset={0}
      >
      <StatusBar hidden={true} translucent={true} style={themeState.isDarkMode ? 'light' : 'dark'} />

      <ReaderHeader
        isEditMode={isEditMode}
        isNavMode={isNavMode}
        headerAnim={headerAnim}
        insets={insets}
        bookTitle={book?.title}
        theme={themeState.theme}
        hideNav={hideNav}
        setIsEditMode={setIsEditMode}
        openDrawer={openDrawer}
        navigation={navigation}
      />

      <View style={{ flex: 1 }} {...panResponder.panHandlers}>
        {timelineState.currentText ? (
          <WebView
            ref={webViewRef}
            originWhitelist={['*', 'file://*']}
            source={{ html: timelineState.currentText, baseUrl: currentChapter?.chapterBaseDir || book?.baseDir }}
            style={{ flex: 1, backgroundColor: bgPreset.bg, opacity: isWebViewReady ? 1 : 0 }}
            injectedJavaScript={initScript}
            onMessage={handleMsg}
            bounces={false}
            scrollEnabled={true}
            keyboardDisplayRequiresUserAction={false}
            scalesPageToFit={false}
            allowFileAccessFromFileURLs={true}
            allowUniversalAccessFromFileURLs={true}
            mixedContentMode="always"
            onShouldStartLoadWithRequest={() => true}
            onLoadEnd={() => {
              isNavigatingBack.current = false;
              pendingScrollRestore.current = null;
              webViewRef.current?.injectJavaScript(`
                setTimeout(function() {
                  window.__webViewReady = true;
                  window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'READY' }));
                }, 100);
                true;
              `);
            }}
          />
        ) : (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ color: themeState.theme.textMuted }}>📂 İçerik yok.</Text>
          </View>
        )}

        {isLoading && (
          <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center', backgroundColor: bgPreset.bg, zIndex: 10 }]}>
            <ActivityIndicator color={themeState.theme.primary} size="large" />
          </View>
        )}
      </View>

      <ReaderDock
        isEditMode={isEditMode}
        isNavMode={isNavMode}
        dockAnim={dockAnim}
        navBarHeight={navBarHeight}
        dockMode={dockMode}
        setDockMode={setDockMode}
        scrollPct={scrollPct}
        theme={themeState.theme}
        hasPrev={hasPrev}
        hasNext={hasNext}
        goChapter={goChapter}
        fontSize={themeState.fontSize}
        setFontSize={themeState.setFontSize}
        lineHeight={themeState.lineHeight}
        setLineHeight={themeState.setLineHeight}
        bgPreset={bgPreset}
        setBgPresetId={themeState.setBgPresetId}
        readerMode={themeState.readerMode}
        setReaderMode={themeState.setReaderMode}
        setIsEditMode={setIsEditMode}
        BG_PRESETS={BG_PRESETS}
        MIN_FONT={MIN_FONT}
        MAX_FONT={MAX_FONT}
      />

      <ReaderDrawer
        isDrawerOpen={isDrawerOpen}
        slideAnim={slideAnim}
        drawerPanResponder={drawerPanResponder}
        DRAWER_WIDTH={DRAWER_WIDTH}
        theme={themeState.theme}
        book={book}
        targetChapterId={targetChapterId}
        targetBookId={targetBookId}
        isEditMode={isEditMode}
        versions={versions}
        viewedVersionId={timelineState.viewedVersionId}
        closeDrawer={closeDrawer}
        updateCurrentChapter={libraryState.updateCurrentChapter}
        loadVersion={(id) => {
          const html = timelineState.viewVersion ? timelineState.viewVersion(id) : timelineState.reconstructVersion(id);
          webViewRef.current?.injectJavaScript(`document.body.innerHTML=\`${html.replace(/`/g,'\\\\`')}\`; true;`);
        }}
      />
      </KeyboardAvoidingView>

      <ReaderStatusOverlay show={themeState.showClockAndBattery} theme={themeState.theme} insets={insets} bgPreset={bgPreset} bottomOffset={isEditMode ? Math.max(insets.bottom, 16) : undefined} opacity={isKeyboardVisible ? 0 : 1} pointerEvents={isKeyboardVisible ? 'none' : 'auto'} />

      {isEditMode && (
        <View pointerEvents={isKeyboardVisible ? 'none' : 'auto'} style={{ position: 'absolute', bottom: Math.max(insets.bottom, 16) + 32, left: 16, right: 16, backgroundColor: themeState.theme.surface, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: themeState.theme.border, elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.1, shadowRadius: 4, opacity: isKeyboardVisible ? 0 : 1 }}>
          <Text style={{ marginBottom: 12, fontWeight: 'bold', color: themeState.theme.textPrimary }}>Düzenleme Modu</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12 }}>
            <TouchableOpacity onPress={() => {
              const html = timelineState.currentText;
              if (html) {
                webViewRef.current?.injectJavaScript(`document.body.innerHTML=\`${html.replace(/`/g,'\\\\`')}\`; true;`);
              }
              setIsEditMode(false);
            }} style={{ borderWidth: 1, borderColor: themeState.theme.border, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 16 }}>
              <Text style={{ color: themeState.theme.danger }}>İptal</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { saveEdits(scrollPct); setIsEditMode(false); }} style={{ borderWidth: 1, borderColor: themeState.theme.primary, backgroundColor: themeState.theme.primary + '15', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 16 }}>
              <Text style={{ color: themeState.theme.primary, fontWeight: 'bold' }}>Kaydet</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}
