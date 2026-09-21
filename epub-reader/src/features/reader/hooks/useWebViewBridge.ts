import { RefObject, useCallback, useRef, useEffect } from 'react';
import { ToastAndroid, Platform, Dimensions } from 'react-native';
import WebView from 'react-native-webview';

interface UseWebViewBridgeProps {
  webViewRef: RefObject<WebView | null>;
  readerMode: 'scroll' | 'paged';
  isEditMode: boolean;
  isNavMode: boolean;
  targetBookId?: string;
  targetChapterId?: string;
  chapterIdx: number;
  bookChapters?: any[];
  addVersion: (text: string) => void;
  updateChapterTitle: (bookId: string, chapterId: string, title: string) => void;
  updateScrollPosition: (bookId: string, pct: number) => void;
  updateCurrentChapter: (bookId: string, chapterId: string) => void;
  setScrollPct: (pct: number) => void;
  setIsWebViewReady: (ready: boolean) => void;
  isNavigatingBack: React.MutableRefObject<boolean>;
  toggleNav: () => void;
  setDockMode: (mode: any) => void;
}

export const useWebViewBridge = ({
  webViewRef,
  readerMode,
  isEditMode,
  isNavMode,
  targetBookId,
  targetChapterId,
  chapterIdx,
  bookChapters,
  addVersion,
  updateChapterTitle,
  updateScrollPosition,
  updateCurrentChapter,
  setScrollPct,
  setIsWebViewReady,
  isNavigatingBack,
  toggleNav,
  setDockMode,
}: UseWebViewBridgeProps) => {
  const scrollSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (scrollSaveTimer.current) clearTimeout(scrollSaveTimer.current);
  }, []);

  const hasNext = bookChapters ? chapterIdx < bookChapters.length - 1 : false;
  const hasPrev = chapterIdx > 0;

  const saveEdits = useCallback((scrollPct: number) => {
    console.log('[Reader][Edit] Düzenleme kaydediliyor');
    webViewRef.current?.injectJavaScript(
      `window.ReactNativeWebView.postMessage(JSON.stringify({ type:'SAVE_EDIT', html:document.body.innerHTML })); true;`
    );
  }, [webViewRef]);

  const handleMsg = useCallback((event: any) => {
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
        if (scrollSaveTimer.current) clearTimeout(scrollSaveTimer.current);
        scrollSaveTimer.current = setTimeout(() => {
          if (targetBookId) updateScrollPosition(targetBookId, d.pct);
        }, 1000);
      }
      if (d.type === 'END_OF_CHAPTER' && hasNext && bookChapters) {
        if (!isEditMode) updateCurrentChapter(targetBookId!, bookChapters[chapterIdx + 1].id);
      }
      if (d.type === 'START_OF_CHAPTER' && hasPrev && bookChapters) {
        if (!isEditMode) {
          isNavigatingBack.current = true;
          setIsWebViewReady(false);
          updateCurrentChapter(targetBookId!, bookChapters[chapterIdx - 1].id);
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
        setDockMode('editPrompt');
      }
    } catch {}
  }, [
    isEditMode, hasNext, hasPrev, bookChapters, chapterIdx, targetBookId, targetChapterId,
    isNavMode, toggleNav, setDockMode, addVersion, updateChapterTitle, setScrollPct,
    updateScrollPosition, updateCurrentChapter, setIsWebViewReady, isNavigatingBack, webViewRef
  ]);

  const handleVolumeKey = useCallback((dir: 'next' | 'prev') => {
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
  }, [readerMode, webViewRef]);

  return {
    handleMsg,
    saveEdits,
    handleVolumeKey,
  };
};
