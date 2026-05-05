import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  StyleSheet, View, Text, FlatList, TouchableOpacity,
  ActivityIndicator, Animated, Dimensions, TouchableWithoutFeedback,
  PanResponder, Alert, ToastAndroid, Platform, useWindowDimensions,
  KeyboardAvoidingView, DeviceEventEmitter
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { WebView } from 'react-native-webview';
import * as NavigationBar from 'expo-navigation-bar';
import * as FileSystem from 'expo-file-system/legacy';
import { strFromU8 } from 'fflate';
import { decodeBase64 } from '../utils/base64';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTimelineStore } from '../store/useTimelineStore';
import { useLibraryStore } from '../store/useLibraryStore';
import { useThemeStore } from '../store/useThemeStore';
import { Typography, Spacing, Radius, Shadow, AppTheme } from '../theme';
import * as Linking from 'expo-linking';
import { sanitizeEpubHtml } from '../services/SanitizerService';
import { useKeepAwake } from 'expo-keep-awake';
import * as Battery from 'expo-battery';

let VolumeManager: any = null;
try {
  VolumeManager = require('react-native-volume-manager').VolumeManager;
} catch (e) {
  console.warn('VolumeManager yüklenemedi. Expo Go kullanıyorsanız bu normaldir.');
}

// ─── CONSTANTS ────────────────────────────────────────────────
const SWIPE_ZONE   = 36;
const MIN_FONT     = 12;
const MAX_FONT     = 28;

// Arka plan renk paletleri
const BG_PRESETS = [
  { label: 'Beyaz',  bg: '#FFFFFF', fg: '#111827' },
  { label: 'Sepia',  bg: '#F8F0DC', fg: '#3B2F1A' },
  { label: 'Krem',   bg: '#FAF3E3', fg: '#2C2C2C' },
  { label: 'Gece',   bg: '#1C1C1E', fg: '#E5E5E7' },
  { label: 'Yeşil',  bg: '#EAF4EA', fg: '#1A3A1A' },
];

type DrawerTab  = 'chapters' | 'timeline';
type DockMode   = 'nav' | 'font' | 'bg' | 'layout';

// ─── MAIN SCREEN ─────────────────────────────────────────────
export default function ReaderScreen() {
  const route      = useRoute<any>();
  const navigation = useNavigation<any>();
  const webViewRef = useRef<WebView>(null);
  const insets     = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const DRAWER_WIDTH = width * 0.78;
  
  const { 
    theme, readerMode, fontSize, lineHeight, bgPresetId, isDarkMode, 
    enableReadingTracking, showClockAndBattery, enableVolumeNavigation, scrollBuffer,
    setReaderMode, setFontSize, setLineHeight, setBgPresetId 
  } = useThemeStore();
  const styles = getStyles(theme, width, height, insets.top);
  const flatListRef = useRef<FlatList>(null);

  // Okuma modunda ekranın kapanmasını engelle
  useKeepAwake();

  // Her zaman güncel değeri yakalamak için ref — closure stale-ness sorununu önler
  const readerModeRef = useRef(readerMode);
  useEffect(() => { readerModeRef.current = readerMode; }, [readerMode]);
  const insetsRef = useRef(insets);
  useEffect(() => { insetsRef.current = insets; }, [insets]);
  const isNavigatingBack = useRef(false);
  // Bölüm değişimi / düzenleme sonrası geri yüklenecek scroll yüzdesi (0–1)
  const pendingScrollRestore = useRef<number | null>(null);
  // Debounced scroll kaydetme zamanlayıcısı
  const scrollSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (scrollSaveTimer.current) clearTimeout(scrollSaveTimer.current); }, []);

  // ── UI State ───────────────────────────────────────────────
  const [isLoading,     setIsLoading]     = useState(false);
  const [isEditMode,    setIsEditMode]    = useState(false);
  const [isNavMode,     setIsNavMode]     = useState(false); // okuma ↔ navigasyon
  const [dockMode,      setDockMode]      = useState<DockMode>('nav');
  const [isDrawerOpen,  setIsDrawerOpen]  = useState(false);
  const isDrawerOpenRef = useRef(false);
  const setDrawerOpen = (v: boolean) => { isDrawerOpenRef.current = v; setIsDrawerOpen(v); };
  const [drawerTab,     setDrawerTab]     = useState<DrawerTab>('chapters');
  const [scrollPct,     setScrollPct]     = useState(0); // 0–1
  const [isWebViewReady,setIsWebViewReady] = useState(true);

  const bgPreset = BG_PRESETS.find(p => p.label === bgPresetId) || BG_PRESETS[0];

  // ── Animasyonlar ───────────────────────────────────────────
  const headerAnim  = useRef(new Animated.Value(0)).current; // 0=gizli 1=görünür
  const dockAnim    = useRef(new Animated.Value(0)).current;
  const slideAnim   = useRef(new Animated.Value(DRAWER_WIDTH)).current;

  useEffect(() => {
    if (!isDrawerOpen) {
      slideAnim.setValue(width * 0.78);
    }
  }, [width]);

  // Gezinti çubuğu yüksekliğini mount'ta yakala ve sabitle
  const navBarHeight = useRef(insets.bottom);

  // Dock animasyonu anlık log
  useEffect(() => {
    const id = dockAnim.addListener(({ value }) => {
      // translateY: dockTranslate = dockAnim.interpolate({ inputRange:[0,1], outputRange:[250, 0] })
      const pos = 250 - (value * 250);
      console.log(`[Reader][Nav][Anim] Dock Y-Pos: ${pos.toFixed(1)} (progress: ${value.toFixed(2)})`);
    });
    return () => dockAnim.removeListener(id);
  }, [dockAnim]);

  // ── Store ──────────────────────────────────────────────────
  const {
    activeBookId, activeChapterId, currentText,
    versionsByNode, addVersion, reconstructVersion, setActiveChapter,
  } = useTimelineStore();
  const { getBook, updateCurrentChapter, updateScrollPosition, updateChapterTitle, addReadingTime } = useLibraryStore();

  // ── Hesaplanmış değerler ───────────────────────────────────
  const targetBookId    = route.params?.bookId || activeBookId;
  const book            = targetBookId ? getBook(targetBookId) : undefined;
  const targetChapterId = book?.currentChapterId || activeChapterId || book?.chapters?.[0]?.id;
  const nodeKey         = `${targetBookId}_${targetChapterId}`;
  const versions        = (targetBookId && targetChapterId) ? (versionsByNode[nodeKey] || []) : [];
  const currentChapter  = book?.chapters?.find(c => c.id === targetChapterId);
  const chapterIdx      = book?.chapters?.findIndex(c => c.id === targetChapterId) ?? -1;
  const hasPrev         = chapterIdx > 0;
  const hasNext         = book ? chapterIdx < (book.chapters?.length ?? 0) - 1 : false;
  const htmlContent     = currentText;

  // ── Navigasyon modunu aç/kapat (animasyonlu) ───────────────
  const showNav = useCallback(() => {
    console.log('[Reader][Nav] Header/Dock gösteriliyor');
    setIsNavMode(true);
    if (Platform.OS === 'android') {
      NavigationBar.setVisibilityAsync('visible');
    }
    Animated.parallel([
      Animated.timing(headerAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.timing(dockAnim,   { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
  }, [headerAnim, dockAnim]);

  const hideNav = useCallback(() => {
    console.log('[Reader][Nav] Header/Dock gizleniyor');
    if (Platform.OS === 'android') {
      NavigationBar.setVisibilityAsync('hidden');
    }
    Animated.parallel([
      Animated.timing(headerAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(dockAnim,   { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => {
      setIsNavMode(false);
      setDockMode('nav');
    });
  }, [headerAnim, dockAnim]);

  const toggleNav = () => {
    console.log(`[Reader][Nav] Toggle: ${isNavMode ? 'gizle' : 'göster'}`);
    if (isNavMode) hideNav();
    else showNav();
  };

  // ── Saat ve Pil Durumu ─────────────────────────────────────
  const [time, setTime] = useState(new Date());
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);

  useEffect(() => {
    if (!showClockAndBattery) return;

    const updateStats = async () => {
      setTime(new Date());
      try {
        const level = await Battery.getBatteryLevelAsync();
        if (level >= 0) setBatteryLevel(Math.round(level * 100));
      } catch (e) {}
    };

    updateStats();
    const interval = setInterval(updateStats, 30000);

    const batterySub = Battery.addBatteryLevelListener(({ batteryLevel }) => {
      setBatteryLevel(Math.round(batteryLevel * 100));
    });

    return () => {
      clearInterval(interval);
      batterySub.remove();
    };
  }, [showClockAndBattery]);

  // ── Okuma Süresi Takibi ────────────────────────────────────
  useEffect(() => {
    if (!enableReadingTracking || !targetBookId) return;

    const interval = setInterval(() => {
      addReadingTime(targetBookId, 60);
    }, 60000);

    return () => clearInterval(interval);
  }, [enableReadingTracking, targetBookId, addReadingTime]);

  // ── Navigasyon Zaman Aşımı (7 saniye) ──────────────────────
  const navTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (isNavMode) {
      if (navTimeoutRef.current) clearTimeout(navTimeoutRef.current);
      navTimeoutRef.current = setTimeout(() => {
        hideNav();
      }, 7000);
    } else {
      if (navTimeoutRef.current) clearTimeout(navTimeoutRef.current);
    }
    return () => {
      if (navTimeoutRef.current) clearTimeout(navTimeoutRef.current);
    };
  }, [isNavMode, hideNav]);

  // Okuma modunda sistem gezinti çubuğunu gizle (overlay-swipe: üzerine biner, layout etkilemez)
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

  // ── Drawer ────────────────────────────────────────────────────
  const openDrawerRef = useRef(() => {});
  const openDrawer = () => {
    if (isNavMode) hideNav();
    slideAnim.stopAnimation();
    slideAnim.setValue(DRAWER_WIDTH);
    setDrawerOpen(true);
    requestAnimationFrame(() => {
      Animated.timing(slideAnim, { toValue: 0, duration: 250, useNativeDriver: true }).start();
    });
  };
  const closeDrawer = () => {
    Animated.timing(slideAnim, { toValue: DRAWER_WIDTH, duration: 200, useNativeDriver: true })
      .start(() => setDrawerOpen(false));
  };
  openDrawerRef.current = openDrawer;

  // ── Swipe: İçerik alanından sağ kenarda → sola çekerek açma ──
  const openGestureOffset = useRef(DRAWER_WIDTH);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (evt, g) => {
        if (isDrawerOpenRef.current) return false;
        return evt.nativeEvent.pageX > width * 0.85
          && g.dx < -6
          && Math.abs(g.dx) > Math.abs(g.dy) * 1.2;
      },
      onPanResponderGrant: () => {
        slideAnim.stopAnimation((v) => { openGestureOffset.current = v; });
        isDrawerOpenRef.current = true;
        setIsDrawerOpen(true);
      },
      onPanResponderMove: (_e, g) => {
        // g.dx negatif = sola → açılma
        const next = Math.max(0, Math.min(DRAWER_WIDTH, openGestureOffset.current + g.dx));
        slideAnim.setValue(next);
      },
      onPanResponderRelease: (_e, g) => {
        const cur = openGestureOffset.current + g.dx;
        if (cur < DRAWER_WIDTH * 0.65 || g.vx < -0.4) {
          Animated.timing(slideAnim, { toValue: 0, duration: 180, useNativeDriver: true }).start();
        } else {
          Animated.timing(slideAnim, { toValue: DRAWER_WIDTH, duration: 180, useNativeDriver: true })
            .start(() => { isDrawerOpenRef.current = false; setIsDrawerOpen(false); });
        }
      },
    })
  ).current;

  // ── Swipe: Drawer içinde → sağa sürükleyerek kapatma ──
  const closeGestureOffset = useRef(0);

  const drawerPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_e, g) => {
        if (!isDrawerOpenRef.current) return false;
        return g.dx > 6 && Math.abs(g.dx) > Math.abs(g.dy) * 1.2;
      },
      onPanResponderGrant: () => {
        slideAnim.stopAnimation((v) => { closeGestureOffset.current = v; });
      },
      onPanResponderMove: (_e, g) => {
        // g.dx pozitif = sağa → kapanma
        const next = Math.max(0, Math.min(DRAWER_WIDTH, closeGestureOffset.current + g.dx));
        slideAnim.setValue(next);
      },
      onPanResponderRelease: (_e, g) => {
        const cur = closeGestureOffset.current + g.dx;
        if (cur > DRAWER_WIDTH * 0.35 || g.vx > 0.4) {
          Animated.timing(slideAnim, { toValue: DRAWER_WIDTH, duration: 180, useNativeDriver: true })
            .start(() => { isDrawerOpenRef.current = false; setIsDrawerOpen(false); });
        } else {
          Animated.timing(slideAnim, { toValue: 0, duration: 180, useNativeDriver: true }).start();
        }
      },
    })
  ).current;

  // ── Güvenli Link ve Yönlendirme Kontrolü ───────────────────
  const handleShouldStartLoadWithRequest = (request: any) => {
    const { url, navigationType } = request;
    if (!url || url === 'about:blank' || url.startsWith('data:')) return true;

    // Dış Linkler
    if (url.startsWith('http://') || url.startsWith('https://')) {
      Linking.openURL(url).catch(e => console.warn('Dış link açılamadı:', e));
      return false;
    }

    // Dahili linkler (Bölüm geçişi veya sayfa içi anchor)
    if (navigationType === 'click' || url.includes('.xhtml') || url.includes('.html') || url.includes('#')) {
      const fileNameRaw = url.split('/').pop() || '';
      const fileName = fileNameRaw.split('#')[0];
      const anchor = fileNameRaw.split('#')[1];

      // Eğer mevcut bölümse yüklenmesine izin ver
      if (url === currentChapter?.chapterBaseDir || url === book?.baseDir || url === currentChapter?.fullPath) {
          return true;
      }

      if (book?.chapters) {
        const targetChap = book.chapters.find(c => 
          c.fullPath.endsWith(fileName) || 
          c.id === fileName || 
          (c as any).href?.endsWith(fileName)
        );

        if (targetChap) {
          if (targetChap.id !== targetChapterId) {
            if (isEditMode) {
              Alert.alert('Düzenleme Modu', 'Bölüm geçişi yapmadan önce düzenlemeyi kaydedin veya iptal edin.');
            } else {
              updateCurrentChapter(targetBookId!, targetChap.id);
            }
          } else if (anchor) {
            webViewRef.current?.injectJavaScript(`
              var el = document.getElementById('${anchor}') || document.getElementsByName('${anchor}')[0];
              if(el) el.scrollIntoView({behavior: 'smooth'});
              true;
            `);
          }
          return false;
        }
      }
    }
    return true;
  };

  // ── Bölüm yükleme ──────────────────────────────────────────
  useEffect(() => {
    if (!targetBookId || !targetChapterId) return;
    if (activeBookId === targetBookId && activeChapterId === targetChapterId && currentText) return;
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

        setActiveChapter(targetBookId, chapter.id, htmlStr);
        updateCurrentChapter(targetBookId, chapter.id);
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
  }, [targetBookId, targetChapterId, activeBookId, activeChapterId]);

  // ── Scroll to active chapter in Drawer list ────────────────
  useEffect(() => {
    if (flatListRef.current && book?.chapters && targetChapterId) {
      const idx = book.chapters.findIndex(c => c.id === targetChapterId);
      if (idx > -1) {
        setTimeout(() => {
          flatListRef.current?.scrollToIndex({ index: idx, viewPosition: 0, animated: true });
        }, 150);
      }
    }
  }, [targetChapterId, book?.chapters]);

  // ── CSS & Theme → WebView ──────────────────────────────────
  useEffect(() => {
    webViewRef.current?.injectJavaScript(`
      (function(){
        document.documentElement.style.fontSize='${fontSize}px';
        document.body.style.lineHeight='${lineHeight}';
        document.body.style.background='${bgPreset.bg}';
        document.body.style.color='${bgPreset.fg}';
      })(); true;
    `);
  }, [fontSize, lineHeight, bgPreset]);

  // ── Edit mode & Layout → WebView ───────────────────────────
  useEffect(() => {
    webViewRef.current?.injectJavaScript(`
      document.body.contentEditable="${isEditMode}";
      document.body.style.outline="${isEditMode?'2px dashed #F59E0B':'none'}";
      if (${isEditMode}) {
        if (!window.__kbScrollSetup) {
          window.__kbScrollSetup = true;
          document.addEventListener('selectionchange', function() {
            var sel = window.getSelection();
            if (!sel || sel.rangeCount === 0) return;
            var range = sel.getRangeAt(0);
            var rect = range.getBoundingClientRect();
            var viewH = window.innerHeight;
            if (rect.bottom > viewH * 0.6) {
              window.scrollBy({ top: rect.bottom - viewH * 0.55, behavior: 'smooth' });
            }
          });
          document.addEventListener('focusin', function(e) {
            setTimeout(function() {
              var el = document.activeElement;
              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);
          });
        }
      } else {
        window.__kbScrollSetup = false;
      }
      true;
    `);
  }, [isEditMode]);

  useEffect(() => {
    const pct = scrollPct;
    webViewRef.current?.injectJavaScript(`
      try {
        var savedPct = ${pct};
        window.isPaged = ${readerMode === 'paged'};
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
          // Pozisyonu hesapla (sadece bir kere maxPage belirlenir)
          setTimeout(function() {
            var oldTransform = document.body.style.transform;
            document.body.style.transform = 'none';
            var sw = document.documentElement.scrollWidth || document.body.scrollWidth;
            document.body.style.transform = oldTransform;
            var iw = window.innerWidth;
            window.maxPage = Math.max(0, Math.ceil(sw / iw) - 1);
            window.currentPage = Math.round(savedPct * window.maxPage);
            // bounds check
            window.currentPage = Math.min(Math.max(0, window.currentPage), window.maxPage);
            document.body.style.transform = 'translateX(-' + (window.currentPage * iw) + 'px)';
            document.body.style.transition = 'transform 0.25s ease-out';
            window.__isInitialized = true;
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'DEBUG_PAGE', action: 'INIT', sw: sw, iw: iw, maxPage: window.maxPage, currentPage: window.currentPage }));
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
          document.body.style.padding = '16px 16px ${scrollBuffer}vh 16px';
          // Pozisyonu hesapla
          setTimeout(function() {
            window.scrollTo(0, savedPct * Math.max(1, document.body.scrollHeight - window.innerHeight));
          }, 50);
        }
      } catch(e) {}
      true;
    `);
  }, [readerMode, width, insets.top, scrollBuffer]);

  // Mod değiştiğinde WebView içindeki durumu güncelle
  useEffect(() => {
    if (isWebViewReady) {
      webViewRef.current?.injectJavaScript(`
        (function(){
          window.isPaged = ${readerMode === 'paged'};
          console.log('[WebView][Mode] Updated to: ' + (window.isPaged ? 'paged' : 'scroll'));
        })(); true;
      `);
    }
  }, [readerMode, isWebViewReady]);

  const initScript = `
    (function(){
      var meta = document.createElement('meta');
      meta.name = 'viewport';
      meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
      document.getElementsByTagName('head')[0].appendChild(meta);

      document.documentElement.style.fontSize='${fontSize}px';
      document.body.style.lineHeight='${lineHeight}';
      document.body.style.background='${bgPreset.bg}';
      document.body.style.color='${bgPreset.fg}';
      
      window.isPaged = ${readerMode === 'paged'};
      if (window.isPaged) {
        document.documentElement.style.overflow = 'hidden';
        document.body.style.transition = 'transform 0.25s ease-out';
        document.body.style.columnWidth = '${width - 32}px';
        document.body.style.columnGap = '32px';
        document.body.style.height = '100vh';
        document.body.style.overflow = 'visible';
        document.body.style.padding = '${insets.top + 8}px 16px 16px 16px';
        document.body.style.margin = '0';
        document.body.style.boxSizing = 'border-box';
        document.body.style.transform = 'translateX(0px)';
      } else {
        document.body.style.padding='${insets.top + 8}px 16px ${scrollBuffer}vh 16px';
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

      function updatePagedProgress(actionName) {
        var iw = window.innerWidth;
        var pct = window.maxPage > 0 ? (window.currentPage / window.maxPage) : 0;
        window.ReactNativeWebView.postMessage(JSON.stringify({ type:'SCROLL', pct: Math.min(1, Math.max(0, pct)) }));
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'DEBUG_PAGE', action: actionName || 'UPDATE', sw: 0, iw: iw, maxPage: window.maxPage, currentPage: window.currentPage }));
      }

      var lastScrollMsgTime = 0;
      window.addEventListener('scroll', function() {
        if (window.isPaged) return;
        var pct = window.scrollY / Math.max(1, document.body.scrollHeight - window.innerHeight);
        var atBottom = (window.innerHeight + Math.ceil(window.scrollY)) >= document.body.offsetHeight - 80;
        var atTop = window.scrollY <= 10;
        
        // Sadece ortalara gelince sayaçları sıfırla
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
        if(!window.isPaged || document.body.contentEditable === "true" || window.getSelection().toString() !== "" || !window.__webViewReady || !window.__isInitialized || window.__isNavigating) return;
        var dx = e.changedTouches[0].clientX - startX;
        var dy = e.changedTouches[0].clientY - startY;

        if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40) {
          if (dx < 0) window.goNext();
          else window.goPrev();
        }
      }, { passive: false });

      // Layout sonrası webViewReady başlatılıyor (initScript'te timeout ile)
      if (window.isPaged) {
        setTimeout(function() { 
          var oldTransform = document.body.style.transform;
          document.body.style.transform = 'none';
          var sw = document.documentElement.scrollWidth || document.body.scrollWidth;
          document.body.style.transform = oldTransform;
          var iw = window.innerWidth;
          window.maxPage = Math.max(0, Math.ceil(sw / iw) - 1);
          // Geri sayfa yönlendirmesi veya kayıttan dönme durumu için:
          window.currentPage = Math.round(${scrollPct} * window.maxPage);
          window.currentPage = Math.min(Math.max(0, window.currentPage), window.maxPage);
          document.body.style.transform = 'translateX(-' + (window.currentPage * iw) + 'px)';
          document.body.style.transition = 'transform 0.25s ease-out';
          window.__isInitialized = true;
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'DEBUG_PAGE', action: 'INIT_SCRIPT', sw: sw, iw: iw, maxPage: window.maxPage, currentPage: window.currentPage }));
        }, 200);
      } else {
        window.__isInitialized = true;
      }

      // WebView hazır bayrağı — yükleme sırasında swipe'ı engelle
      window.__webViewReady = false;

      // User select & Edit Algılama
      document.body.style.webkitUserSelect = "none";
      document.body.style.userSelect = "none";

      document.addEventListener('contextmenu', function(e) {
        if(document.body.contentEditable !== "true") {
          e.preventDefault();
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ASK_EDIT_MODE' }));
        }
      });

      // Dokunma yönetimi: paged modda 1-2-1 bölgesi, scroll modda toggle
      document.addEventListener('click', function(e) {
        if(document.body.contentEditable==="true") return;
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

  // ── Handlers ───────────────────────────────────────────────
  const saveEdits = () => {
    console.log('[Reader][Edit] Düzenleme kaydediliyor');
    setIsEditMode(false);
    // Düzenleme kaydedilince WebView yeniden yüklenecek; scroll pozisyonunu koru
    pendingScrollRestore.current = scrollPct;
    webViewRef.current?.injectJavaScript(
      `window.ReactNativeWebView.postMessage(JSON.stringify({ type:'SAVE_EDIT', html:document.body.innerHTML })); true;`
    );
  };

  const handleMsg = (event: any) => {
    try {
      const d = JSON.parse(event.nativeEvent.data);
      if (d.type === 'DEBUG_PAGE') {
        console.log(`[WebView][Pagination][${d.action}] sw: ${Math.round(d.sw)}, iw: ${Math.round(d.iw)}, currentPage: ${d.currentPage}/${d.maxPage}`);
      }
      if (d.type === 'SAVE_EDIT' && d.html) {
        console.log(`[Reader][Edit] Kaydedildi — ${d.html.length} karakter`);
        addVersion(d.html);
        const titleMatch = d.html.match(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/i) || d.html.match(/<title[^>]*>(.*?)<\/title>/i);
        if (titleMatch && titleMatch[1]) {
          const rawTitle = titleMatch[1].replace(/<[^>]+>/g, '').trim();
          if (rawTitle && targetBookId && targetChapterId) {
            updateChapterTitle(targetBookId, targetChapterId, rawTitle);
          }
        }
      }
      if (d.type === 'SCROLL') {
        setScrollPct(d.pct);
        // Debounced persist — 1 sn hareketsizlikte kaydet
        if (scrollSaveTimer.current) clearTimeout(scrollSaveTimer.current);
        scrollSaveTimer.current = setTimeout(() => {
          if (targetBookId) updateScrollPosition(targetBookId, d.pct);
        }, 1000);
      }
      if (d.type === 'END_OF_CHAPTER' && hasNext) {
        console.log(`[Reader][Nav] Bölüm sonu → sonraki (WebView info - sw: ${d.sw}, iw: ${d.iw}, current: ${d.currentPage}, max: ${d.maxPage})`);
        if (!isEditMode) updateCurrentChapter(targetBookId!, book!.chapters![chapterIdx + 1].id);
      }
      if (d.type === 'START_OF_CHAPTER' && hasPrev) {
        console.log(`[Reader][Nav] Bölüm başı → önceki (WebView info - sw: ${d.sw}, iw: ${d.iw}, current: ${d.currentPage})`);
        if (!isEditMode) {
          isNavigatingBack.current = true;
          setIsWebViewReady(false);
          updateCurrentChapter(targetBookId!, book!.chapters![chapterIdx - 1].id);
        }
      }
      if (d.type === 'READY') {
        setIsWebViewReady(true);
      }
      if (d.type === 'TAP_ZONE' && !isEditMode) {
        if (d.zone === 'mid') {
          toggleNav();
        } else if (d.zone === 'left') {
          webViewRef.current?.injectJavaScript('if(window.goPrev) window.goPrev(); true;');
        } else if (d.zone === 'right') {
          webViewRef.current?.injectJavaScript('if(window.goNext) window.goNext(); true;');
        }
      }
      if (d.type === 'TOGGLE_NAV' && !isEditMode) {
        toggleNav();
      }
      if (d.type === 'TOAST') {
        if (Platform.OS === 'android') ToastAndroid.show(d.msg, ToastAndroid.SHORT);
      }
      if (d.type === 'ASK_EDIT_MODE') {
        if (!isNavMode) toggleNav();
        setDockMode('editPrompt' as DockMode);
      }
    } catch {}
  };

  const handleVolumeKey = useCallback((dir: 'next' | 'prev') => {
    console.log('[Reader][Volume] handleVolumeKey called: ' + dir + ' (Mode: ' + readerMode + ')');
    if (readerMode === 'paged') {
      const js = dir === 'next'
        ? `window.ReactNativeWebView.postMessage(JSON.stringify({type:'DEBUG_PAGE',action:'VOL_INJECT',sw:0,iw:0,maxPage:window.maxPage,currentPage:window.currentPage})); if(window.goNext) window.goNext(); else window.ReactNativeWebView.postMessage(JSON.stringify({type:'DEBUG_PAGE',action:'goNext_UNDEFINED',sw:0,iw:0,maxPage:0,currentPage:0})); true;`
        : `window.ReactNativeWebView.postMessage(JSON.stringify({type:'DEBUG_PAGE',action:'VOL_INJECT',sw:0,iw:0,maxPage:window.maxPage,currentPage:window.currentPage})); if(window.goPrev) window.goPrev(); else window.ReactNativeWebView.postMessage(JSON.stringify({type:'DEBUG_PAGE',action:'goPrev_UNDEFINED',sw:0,iw:0,maxPage:0,currentPage:0})); true;`;
      webViewRef.current?.injectJavaScript(js);
    } else {
      const scrollAmt = Dimensions.get('window').height * 0.8;
      const js = dir === 'next'
        ? `window.scrollBy({ top: ${scrollAmt}, left: 0, behavior: 'smooth' }); true;`
        : `window.scrollBy({ top: -${scrollAmt}, left: 0, behavior: 'smooth' }); true;`;
      webViewRef.current?.injectJavaScript(js);
    }
  }, [readerMode]);

  // ── Ses tuşları ile kontrol (Native VolumeKeyModule)
  const isNavModeRef = useRef(isNavMode);
  useEffect(() => { isNavModeRef.current = isNavMode; }, [isNavMode]);
  
  useEffect(() => {
    if (!enableVolumeNavigation) return;

    console.log('[Reader][Volume] Native modül listener kuruluyor');

    const sub = DeviceEventEmitter.addListener('onVolumeKey', (event: any) => {
      const dir = event?.direction;
      const navOpen = isNavModeRef.current;
      console.log(`[Reader][Volume] Native: dir=${dir} navOpen=${navOpen}`);

      if (navOpen) {
        // Dock açıkken → ses kontrolünü sisteme bırak
        if (VolumeManager) {
          VolumeManager.getVolume().then((v: any) => {
            const cur = v.volume;
            const next = dir === 'up' ? Math.min(1, cur + 0.0625) : Math.max(0, cur - 0.0625);
            VolumeManager.setVolume(next, { showUI: true });
          });
        }
        return;
      }

      // Okuma modunda → sayfa çevir (ses seviyesi hiç değişmez)
      handleVolumeKey(dir === 'up' ? 'next' : 'prev');
    });

    return () => { sub.remove(); };
  }, [handleVolumeKey, enableVolumeNavigation]);

  const loadVersion = (id: string) => {
    const html = reconstructVersion(id);
    webViewRef.current?.injectJavaScript(`document.body.innerHTML=\`${html.replace(/`/g,'\\`')}\`; true;`);
  };

  const goChapter = (dir: 1 | -1) => {
    if (!book?.chapters) return;
    if (isEditMode) {
      Alert.alert('Düzenleme Modu', 'Bölüm geçişi yapmadan önce düzenlemeyi kaydedin veya iptal edin.');
      return;
    }
    const next = book.chapters[chapterIdx + dir];
    if (next) {
      console.log(`[Reader][Nav] Bölüm değiştir: ${dir > 0 ? 'sonraki' : 'önceki'} → ${next.title || next.id}`);
      updateCurrentChapter(targetBookId!, next.id);
    }
  };

  // ── Animasyon headerı yukarıdan gelmesi ───────────────────
  const headerTranslate = headerAnim.interpolate({ inputRange:[0,1], outputRange:[-150, 0] });
  const dockTranslate   = dockAnim.interpolate({ inputRange:[0,1], outputRange:[250, 0] });

  // ─── RENDER ────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: bgPreset.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : isEditMode ? 'height' : undefined}
      keyboardVerticalOffset={0}
    >
      <StatusBar
        hidden={true}
        backgroundColor="transparent"
        translucent={true}
        style={isDarkMode ? 'light' : 'dark'}
      />

      {/* ── ANİMASYONLU HEADER (edit modda gizli) ── */}
      {!isEditMode && (
      <Animated.View
        pointerEvents={isNavMode ? 'auto' : 'none'}
        style={[styles.topBar, {
          transform: [{ translateY: headerTranslate }],
          opacity: headerAnim,
          position: 'absolute', top: 0, left: 0, right: 0, zIndex: 30,
          paddingTop: insets.top,
        }]}
      >
        <View style={styles.topInner}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backText}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.topTitle} numberOfLines={1}>{book?.title || 'Kitap Oku'}</Text>
          <View style={styles.topRight}>
            <TouchableOpacity style={styles.smBtn} onPress={() => { hideNav(); setIsEditMode(true); }}>
              <Text style={styles.smBtnText}>✏</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.smBtn, { backgroundColor: theme.primary }]} onPress={openDrawer}>
              <Text style={[styles.smBtnText, { color: theme.textOnDark }]}>☰</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>
      )}

      {/* ── WEB VIEW ── */}
      <View style={styles.content} {...panResponder.panHandlers}>
        {isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color={theme.primary} size="large" />
          </View>
        ) : htmlContent ? (
          <WebView
            ref={webViewRef}
            originWhitelist={['*', 'file://*']}
            source={{ html: htmlContent, baseUrl: currentChapter?.chapterBaseDir || book?.baseDir }}
            style={[styles.webview, { backgroundColor: bgPreset.bg, opacity: isWebViewReady ? 1 : 0 }]}
            injectedJavaScript={initScript}
            onMessage={handleMsg}
            onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
            onNavigationStateChange={(navState) => {
              if (Platform.OS === 'android') {
                const shouldLoad = handleShouldStartLoadWithRequest({
                  url: navState.url,
                  navigationType: navState.navigationType || 'click'
                });
                if (!shouldLoad && navState.loading) {
                  webViewRef.current?.stopLoading();
                }
              }
            }}
            bounces={false}
            scrollEnabled={true}
            keyboardDisplayRequiresUserAction={false}
            scalesPageToFit={false}
            allowFileAccessFromFileURLs={true}
            allowUniversalAccessFromFileURLs={true}
            mixedContentMode="always"
            onLoadEnd={() => {
              const restorePct = pendingScrollRestore.current;
              if (restorePct !== null) {
                // Hem düzenleme sonrası hem de kayıtlı pozisyon geri yükleme
                pendingScrollRestore.current = null;
                isNavigatingBack.current = false;
                webViewRef.current?.injectJavaScript(`
                  setTimeout(function() {
                    if (window.isPaged) {
                      var iw = window.innerWidth;
                      var maxPage = Math.max(0, Math.round(document.body.scrollWidth / iw) - 1);
                      window.currentPage = Math.round(${restorePct} * maxPage);
                      document.body.style.transform = 'translateX(-' + (window.currentPage * iw) + 'px)';
                      if (typeof updatePagedProgress === 'function') updatePagedProgress();
                    } else {
                      window.scrollTo(0, ${restorePct} * Math.max(1, document.body.scrollHeight - window.innerHeight));
                    }
                    window.__webViewReady = true;
                    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'READY' }));
                  }, 150);
                  true;
                `);
              } else if (isNavigatingBack.current) {
                isNavigatingBack.current = false;
                webViewRef.current?.injectJavaScript(`
                  setTimeout(function() {
                    if (window.isPaged) {
                      var iw = window.innerWidth;
                      var lastPage = Math.max(0, Math.round(document.body.scrollWidth / iw) - 1);
                      window.currentPage = lastPage;
                      document.body.style.transform = 'translateX(-' + (lastPage * iw) + 'px)';
                      if (typeof updatePagedProgress === 'function') updatePagedProgress();
                    } else {
                      window.scrollTo(0, document.body.scrollHeight);
                    }
                    window.__webViewReady = true;
                    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'READY' }));
                  }, 150);
                  true;
                `);
              } else {
                webViewRef.current?.injectJavaScript(`
                  setTimeout(function() {
                    window.__webViewReady = true;
                    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'READY' }));
                  }, 100);
                  true;
                `);
              }
            }}
          />
        ) : (
          <View style={styles.center}>
            <Text style={{ color: theme.textMuted }}>📂 İçerik yok.</Text>
          </View>
        )}
      </View>

      {/* ── ANİMASYONLU ALT DOCK (edit modda gizli) ── */}
      {!isEditMode && (
      <Animated.View
        pointerEvents={isNavMode ? 'auto' : 'none'}
        style={[styles.dock, {
          transform: [{ translateY: dockTranslate }],
          opacity: dockAnim,
          bottom: navBarHeight.current + 66,
        }]}>
        {/* ── NAV modu ── */}
        {dockMode === 'nav' && (
          <>
            {/* İlerleme çubuğu */}
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${Math.round(scrollPct * 100)}%`, backgroundColor: theme.primary }]} />
              <View style={[styles.progressThumb, { left: `${Math.round(scrollPct * 100)}%`, backgroundColor: theme.primary }]} />
            </View>

            {/* Butonlar */}
            <View style={styles.dockRow}>
              {/* ← Önceki bölüm */}
              <TouchableOpacity
                style={[styles.dockBtn, !hasPrev && styles.dockBtnDisabled]}
                onPress={() => goChapter(-1)}
                disabled={!hasPrev}
              >
                <Text style={styles.dockBtnText}>←</Text>
              </TouchableOpacity>

              {/* Font ayarı */}
              <TouchableOpacity
                style={[styles.dockIconBtn, { backgroundColor: theme.primary }]}
                onPress={() => setDockMode('font')}
              >
                <Text style={styles.dockIconBtnText}>Aa</Text>
              </TouchableOpacity>

              {/* Arka plan */}
              <TouchableOpacity
                style={[styles.dockIconBtn, styles.dockIconBtnBg, { backgroundColor: theme.primary }]}
                onPress={() => setDockMode('bg')}
              >
                <View style={styles.bgDot} />
              </TouchableOpacity>

              {/* Düzen / Sayfalama */}
              <TouchableOpacity
                style={[styles.dockIconBtn, { backgroundColor: theme.primary }]}
                onPress={() => setDockMode('layout')}
              >
                <Text style={styles.dockIconBtnText}>▤</Text>
              </TouchableOpacity>

              {/* → Sonraki bölüm */}
              <TouchableOpacity
                style={[styles.dockBtn, !hasNext && styles.dockBtnDisabled]}
                onPress={() => goChapter(1)}
                disabled={!hasNext}
              >
                <Text style={styles.dockBtnText}>→</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* ── FONT modu ── */}
        {dockMode === 'font' && (
          <View style={styles.fontPanel}>
            <TouchableOpacity style={styles.fontPanelClose} onPress={() => setDockMode('nav')}>
              <Text style={[styles.fontPanelCloseText, { color: theme.primary }]}>‹ Geri</Text>
            </TouchableOpacity>

            <View style={styles.fontRow}>
              <TouchableOpacity style={styles.fontAdjBtn} onPress={() => setFontSize(Math.max(MIN_FONT, fontSize - 1))}>
                <Text style={styles.fontAdjText}>−</Text>
              </TouchableOpacity>
              <View style={styles.fontCenter}>
                <Text style={styles.fontLabel}>Punto</Text>
                <Text style={styles.fontValue}>{fontSize}px</Text>
              </View>
              <TouchableOpacity style={styles.fontAdjBtn} onPress={() => setFontSize(Math.min(MAX_FONT, fontSize + 1))}>
                <Text style={styles.fontAdjText}>+</Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.fontRow, { marginTop: 16 }]}>
              <TouchableOpacity style={styles.fontAdjBtn} onPress={() => setLineHeight(Math.max(1.0, parseFloat((lineHeight - 0.1).toFixed(1))))}>
                <Text style={styles.fontAdjText}>−</Text>
              </TouchableOpacity>
              <View style={styles.fontCenter}>
                <Text style={styles.fontLabel}>Satır</Text>
                <Text style={styles.fontValue}>{lineHeight.toFixed(1)}x</Text>
              </View>
              <TouchableOpacity style={styles.fontAdjBtn} onPress={() => setLineHeight(Math.min(3.0, parseFloat((lineHeight + 0.1).toFixed(1))))}>
                <Text style={styles.fontAdjText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── BG modu ── */}
        {dockMode === 'bg' && (
          <View style={styles.bgPanel}>
            <TouchableOpacity style={styles.fontPanelClose} onPress={() => setDockMode('nav')}>
              <Text style={[styles.fontPanelCloseText, { color: theme.primary }]}>‹ Geri</Text>
            </TouchableOpacity>
            <View style={styles.bgSwatches}>
              {BG_PRESETS.map((p, i) => (
                <TouchableOpacity
                  key={i}
                  style={[styles.swatch, { backgroundColor: p.bg }, bgPreset.label === p.label && { borderColor: theme.primary, borderWidth: 2 }]}
                  onPress={() => setBgPresetId(p.label)}
                />
              ))}
            </View>
          </View>
        )}

        {/* ── LAYOUT modu ── */}
        {dockMode === 'layout' && (
          <View style={styles.bgPanel}>
            <TouchableOpacity style={styles.fontPanelClose} onPress={() => setDockMode('nav')}>
              <Text style={[styles.fontPanelCloseText, { color: theme.primary }]}>‹ Geri</Text>
            </TouchableOpacity>
            <View style={styles.bgSwatches}>
              <TouchableOpacity
                style={[styles.swatch, readerMode === 'scroll' && { borderColor: theme.primary, borderWidth: 2 }]}
                onPress={() => setReaderMode('scroll')}
              >
                <Text style={{color: theme.textPrimary}}>Kaydırma</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.swatch, readerMode === 'paged' && { borderColor: theme.primary, borderWidth: 2 }]}
                onPress={() => setReaderMode('paged')}
              >
                <Text style={{color: theme.textPrimary}}>Sayfalama</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── EDIT PROMPT modu ── */}
        {dockMode === ('editPrompt' as any) && (
          <View style={{ alignItems: 'center', paddingVertical: Spacing.sm }}>
            <Text style={{ fontSize: Typography.md, fontWeight: 'bold', color: theme.textPrimary, marginBottom: 8 }}>Düzenleme Modu</Text>
            <Text style={{ fontSize: Typography.sm, color: theme.textSecondary, marginBottom: 16, textAlign: 'center' }}>
              Metinde değişiklik yapmak için düzenleme moduna geçilsin mi?
            </Text>
            <View style={{ flexDirection: 'row', gap: 16 }}>
              <TouchableOpacity style={[styles.smBtn, { width: 100, height: 42 }]} onPress={() => setDockMode('nav')}>
                <Text style={styles.smBtnText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.smBtn, { width: 100, height: 42, backgroundColor: theme.primary }]} onPress={() => { setIsEditMode(true); setDockMode('nav'); }}>
                <Text style={[styles.smBtnText, { color: theme.textOnDark, fontWeight: 'bold' }]}>Düzenle</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </Animated.View>
      )}

      {/* ── EDIT MOD FLOATING BAR ── */}
      {isEditMode && (
        <View style={[styles.editBar, { bottom: Math.max(insets.bottom, 16) + 8 }]}>
          <View style={styles.editBarInner}>
            <Text style={styles.editBarLabel}>✏ Düzenleme Modu</Text>
            <View style={styles.editBarBtns}>
              <TouchableOpacity
                style={[styles.editBarBtn, { backgroundColor: theme.dangerLight }]}
                onPress={() => {
                  if (webViewRef.current && htmlContent) {
                    webViewRef.current.injectJavaScript(`document.body.innerHTML = ${JSON.stringify(htmlContent)}; true;`);
                  }
                  setIsEditMode(false);
                }}
              >
                <Text style={[styles.editBarBtnText, { color: theme.danger }]}>✕ İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.editBarBtn, { backgroundColor: theme.success }]}
                onPress={saveEdits}
              >
                <Text style={[styles.editBarBtnText, { color: '#fff' }]}>✓ Kaydet</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* ── OVERLAY (drawer) ── */}
      {isDrawerOpen && (
        <Animated.View 
          style={[
            styles.overlay, 
            { opacity: slideAnim.interpolate({ inputRange: [0, DRAWER_WIDTH], outputRange: [1, 0] }) }
          ]}
        >
          <TouchableOpacity activeOpacity={1} style={{ flex: 1 }} onPress={closeDrawer} />
        </Animated.View>
      )}

      {/* ── SAĞ ÇEKMECE ── */}
      <Animated.View style={[styles.drawer, { transform: [{ translateX: slideAnim }] }]} {...drawerPanResponder.panHandlers}>

        {/* Çekmece üstü */}
        <View style={styles.drawerHeader}>
          <Text style={[styles.drawerBookTitle, { color: theme.primary }]} numberOfLines={1}>{book?.title}</Text>
        </View>

        {/* Sekmeler */}
        <View style={styles.tabBar}>
          {(['chapters', 'timeline'] as DrawerTab[]).map(tab => (
            <TouchableOpacity
              key={tab}
              style={[styles.tabItem, drawerTab === tab && { borderBottomColor: theme.primary }]}
              onPress={() => setDrawerTab(tab)}
            >
              <Text style={[styles.tabText, drawerTab === tab && { color: theme.primary, fontWeight: 'bold' }]}>
                {tab === 'chapters' ? 'Bölümler' : `Zaman Akışı${versions.length > 0 ? ` (${versions.length})` : ''}`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Bölümler */}
        <View style={{ flex: 1, display: drawerTab === 'chapters' ? 'flex' : 'none' }}>
          <FlatList
            ref={flatListRef}
            data={book?.chapters || []}
            keyExtractor={item => item.id}
            onScrollToIndexFailed={info => {
              const wait = new Promise(resolve => setTimeout(resolve, 300));
              wait.then(() => {
                flatListRef.current?.scrollToIndex({ index: info.index, viewPosition: 0, animated: false });
              });
            }}
            renderItem={({ item, index }) => {
              const isActive = targetChapterId === item.id;
              return (
                <TouchableOpacity
                  style={[styles.chapterRow, isActive && { backgroundColor: theme.primaryLight }]}
                  onPress={() => {
                    if (isEditMode) {
                      Alert.alert('Düzenleme Modu', 'Bölüm geçişi yapmadan önce düzenlemeyi kaydedin veya iptal edin.');
                      return;
                    }
                    updateCurrentChapter(targetBookId!, item.id);
                    closeDrawer();
                  }}
                >
                  <View style={[styles.badge, isActive && { backgroundColor: theme.primary }]}>
                    <Text style={[styles.badgeText, isActive && styles.badgeTextActive]}>{index + 1}</Text>
                  </View>
                  <Text style={[styles.chapterLabel, isActive && { color: theme.primary, fontWeight: '600' }]} numberOfLines={2}>
                    {item.title}
                  </Text>
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={<Text style={styles.emptyTab}>Bölüm bulunamadı.</Text>}
          />
        </View>

        {/* Zaman Akışı */}
        <View style={{ flex: 1, display: drawerTab === 'timeline' ? 'flex' : 'none' }}>
          <FlatList
            data={[{ id: 'original', name: 'Orijinal Metin', timestamp: 0 }, ...versions]}
            keyExtractor={item => item.id}
            contentContainerStyle={{ paddingVertical: Spacing.sm }}
            renderItem={({ item }) => {
              const isOrig = item.id === 'original';
              return (
                <TouchableOpacity
                  style={[styles.versionRow, isOrig && styles.versionRowOrig]}
                  onPress={() => { loadVersion(item.id); closeDrawer(); }}
                >
                  <View style={[styles.vDot, isOrig ? styles.vDotOrig : { backgroundColor: theme.primary }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.vName}>{item.name}</Text>
                    {item.timestamp > 0 && (
                      <Text style={styles.vDate}>{new Date(item.timestamp).toLocaleString('tr-TR')}</Text>
                    )}
                  </View>
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={<Text style={styles.emptyTab}>Henüz versiyon yok.</Text>}
          />
        </View>
      </Animated.View>
      {showClockAndBattery && !isNavMode && (
        <View style={styles.statsOverlay}>
          <Text style={[styles.statsText, { color: isDarkMode ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)' }]}>
            {batteryLevel !== null ? `%${batteryLevel} · ` : ''}
            {time.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

// ─── STYLES ──────────────────────────────────────────────────
// Renk/boyut değişikliği için → src/theme.ts
const getStyles = (theme: AppTheme, width: number, height: number, insetsTop: number) => {
  const DRAWER_WIDTH = width * 0.78;
  
  return StyleSheet.create({
    screen:  { flex: 1 },
    statsOverlay: {
      position: 'absolute',
      top: insetsTop + 8,
      right: 16,
      zIndex: 10,
      pointerEvents: 'none',
    },
    statsText: {
      fontSize: 11,
      fontWeight: Typography.medium,
    },
    content: { flex: 1 },
    webview: { flex: 1 },
    center:  { flex: 1, justifyContent: 'center', alignItems: 'center' },
    overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 15 },

    // ─ Edit Mod Floating Bar ─
    editBar: {
      position: 'absolute', left: 16, right: 16, zIndex: 40,
    },
    editBarInner: {
      backgroundColor: theme.surface,
      borderRadius: Radius.xl,
      paddingHorizontal: Spacing.base,
      paddingVertical: Spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      ...Shadow.lg,
    },
    editBarLabel: {
      fontSize: Typography.sm,
      fontWeight: Typography.semiBold,
      color: theme.textSecondary,
    },
    editBarBtns: { flexDirection: 'row', gap: Spacing.sm },
    editBarBtn: {
      paddingHorizontal: Spacing.base,
      paddingVertical: Spacing.sm,
      borderRadius: Radius.lg,
    },
    editBarBtnText: { fontSize: Typography.sm, fontWeight: Typography.semiBold },

    // ─ Üst Bar ─
    topBar: {
      backgroundColor: theme.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      paddingTop: 36, // cihazların çentiklerine ve kameralarına (Nothing Phone) ek güvenlik payı
      ...Shadow.md,
    },
    topInner: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.sm,
      paddingVertical: Spacing.xs,
      minHeight: 48,
    },
    backBtn:  { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
    backText: { fontSize: 30, color: theme.textPrimary, lineHeight: 34, marginTop: -2 },
    topTitle: { flex: 1, fontSize: Typography.sm, fontWeight: Typography.semiBold, color: theme.textPrimary, marginHorizontal: Spacing.xs },
    topRight: { flexDirection: 'row', gap: Spacing.xs },
    smBtn:    { width: 34, height: 34, borderRadius: Radius.md, backgroundColor: theme.divider, justifyContent: 'center', alignItems: 'center' },
    smBtnPrimary: { backgroundColor: theme.primary },
    smBtnText: { fontSize: 15, color: theme.textPrimary },

    // ─ Alt Dock ─
    dock: {
      position: 'absolute', bottom: 24, left: 16, right: 16,
      backgroundColor: theme.surface,
      borderRadius: Radius.xl,
      paddingHorizontal: Spacing.base,
      paddingTop: Spacing.md,
      paddingBottom: Spacing.md,
      zIndex: 20,
      ...Shadow.lg,
    },

    // İlerleme çubuğu
    progressTrack: {
      height: 5,
      backgroundColor: theme.divider,
      borderRadius: Radius.full,
      marginBottom: Spacing.md,
      position: 'relative',
      overflow: 'visible',
    },
    progressFill: {
      height: '100%',
      backgroundColor: theme.primary,
      borderRadius: Radius.full,
    },
    progressThumb: {
      position: 'absolute',
      top: -4,
      width: 13,
      height: 13,
      borderRadius: 7,
      backgroundColor: theme.primary,
      marginLeft: -6,
    },

    // Nav butonları
    dockRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    dockBtn: {
      width: 44, height: 44,
      borderRadius: Radius.full,
      backgroundColor: theme.divider,
      justifyContent: 'center', alignItems: 'center',
    },
    dockBtnDisabled: { opacity: 0.3 },
    dockBtnText: { fontSize: 20, color: theme.textPrimary },
    dockIconBtn: {
      width: 52, height: 52,
      borderRadius: Radius.full,
      justifyContent: 'center', alignItems: 'center',
      ...Shadow.sm,
    },
    dockIconBtnFont: { backgroundColor: theme.primary },
    dockIconBtnBg:   { backgroundColor: theme.warning },
    dockIconBtnText: { color: '#fff', fontWeight: Typography.bold, fontSize: Typography.sm },
    bgDot: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff', borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)' },

    // Font Paneli
    fontPanel: { paddingBottom: Spacing.sm },
    fontPanelClose: { marginBottom: Spacing.sm },
    fontPanelCloseText: { color: theme.primary, fontSize: Typography.sm, fontWeight: Typography.semiBold },
    fontRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    fontAdjBtn: {
      width: 64, height: 64,
      borderRadius: Radius.lg,
      backgroundColor: theme.divider,
      justifyContent: 'center', alignItems: 'center',
    },
    fontAdjText: { fontSize: 28, fontWeight: Typography.bold, color: theme.textPrimary },
    fontCenter: { alignItems: 'center' },
    fontLabel:  { fontSize: Typography.lg, fontWeight: Typography.bold, color: theme.textSecondary },
    fontValue:  { fontSize: Typography.sm, color: theme.textMuted },

    // BG Paneli
    bgPanel: { paddingBottom: Spacing.sm },
    bgSwatches: { flexDirection: 'row', justifyContent: 'space-between' },
    swatch: {
      flex: 1, marginHorizontal: 3,
      height: 48, borderRadius: Radius.md,
      borderWidth: 1,
      justifyContent: 'center', alignItems: 'center',
    },
    swatchActive: { borderWidth: 3 },
    swatchLabel: { fontSize: Typography.xs, fontWeight: Typography.semiBold },

    // ─ Sağ Çekmece ─
    drawer: {
      position: 'absolute', top: 0, bottom: 0, right: 0,
      width: DRAWER_WIDTH, backgroundColor: theme.surface,
      zIndex: 20, ...Shadow.lg,
    },
    drawerHeader: {
      paddingHorizontal: Spacing.base,
      paddingVertical: Spacing.md,
      backgroundColor: theme.primaryLight,
      borderBottomWidth: 1, borderBottomColor: theme.border,
    },
    drawerBookTitle: { fontSize: Typography.sm, fontWeight: Typography.semiBold, color: theme.primary },

    tabBar:       { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: theme.border },
    tabItem:      { flex: 1, paddingVertical: Spacing.md, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
    tabItemActive: { borderBottomColor: theme.primary },
    tabText:       { fontSize: Typography.sm, color: theme.textSecondary, fontWeight: Typography.medium },
    tabTextActive: { color: theme.primary, fontWeight: Typography.bold },

    chapterRow:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: theme.divider },
    chapterRowActive: { backgroundColor: theme.primaryLight },
    badge:            { width: 28, height: 28, borderRadius: Radius.full, backgroundColor: theme.divider, justifyContent: 'center', alignItems: 'center', marginRight: Spacing.md },
    badgeActive:      { backgroundColor: theme.primary },
    badgeText:        { fontSize: Typography.xs, fontWeight: Typography.bold, color: theme.textSecondary },
    badgeTextActive:  { color: '#fff' },
    chapterLabel:       { flex: 1, fontSize: Typography.sm, color: theme.textSecondary, lineHeight: 18 },
    chapterLabelActive: { color: theme.primary, fontWeight: Typography.semiBold },

    versionRow:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.base, paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: theme.divider },
    versionRowOrig: { backgroundColor: theme.divider },
    vDot:           { width: 10, height: 10, borderRadius: 5, backgroundColor: theme.primary, marginRight: Spacing.md },
    vDotOrig:       { backgroundColor: theme.textMuted },
    vName:          { fontSize: Typography.sm, fontWeight: Typography.semiBold, color: theme.textPrimary },
    vDate:          { fontSize: Typography.xs, color: theme.textMuted, marginTop: 2 },
    emptyTab:       { textAlign: 'center', color: theme.textMuted, marginTop: Spacing.xl, fontSize: Typography.sm, fontStyle: 'italic' },
  });
};

