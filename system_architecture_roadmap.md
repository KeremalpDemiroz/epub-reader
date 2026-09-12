# EPUB Reader Sistem Analizi ve Mimari Yeniden Yapılandırma Yol Haritası

## 1. Mevcut Durum Analizi (Sorunlar ve Darboğazlar)

Uygulamanın organik olarak adım adım gelişmesi, özelliklerin zamanla "üzerine eklenerek" inşa edilmesine sebep olmuştur. Bu durum aşağıdaki sistemsel ve yapısal kopuklukları doğurmuştur:

### 1.1. "God Component" Anti-Pattern'i (`ReaderScreen.tsx`)
*   **Sorun:** `ReaderScreen.tsx` 1500+ satırlık devasa bir bileşen haline gelmiştir. WebView köprüsü (bridge), animasyonlar (header, dock, drawer), jest/dokunma yönetimi (PanResponder), donanım tuşları dinleyicileri (Volume Keys), saat/pil durumu takibi ve iş mantığının tümü tek bir dosyada toplanmıştır.
*   **Etki:** Bakımı zor, okunabilirliği düşük ve en ufak bir state değişiminde tüm ekranın gereksiz yere yeniden render (re-render) edilmesine sebep olan bir yapı ortaya çıkmıştır. Stale closure sorunlarını aşmak için fazlaca `useRef` kullanılmasına neden olmuştur (örn. `isDrawerOpenRef`, `readerModeRef`).

### 1.2. İletişim Köprüsü (WebView Bridge) Karmaşası
*   **Sorun:** React Native ve WebView içindeki HTML içeriği arasındaki iletişim, devasa bir `handleMsg` fonsiyonu ve doğrudan string olarak enjekte edilen (`injectJavaScript`) betiklerle yapılmaktadır.
*   **Etki:** Kırılgan bir iletişim katmanı. Hata ayıklaması zor. Yeni bir özellik (örn. metin çevirisi, sayfa içi not alma) eklendiğinde bridge kodu giderek daha karmaşık (spagetti) hale gelmektedir.

### 1.3. State Yönetiminin Dağınıklığı
*   **Sorun:** `zustand` kullanılarak `Library`, `Theme`, `Timeline`, `Progress` gibi farklı store'lar oluşturulmuş. Ancak `ReaderScreen` bu store'ların tamamına abone olduğu için (subscribe), alakasız bir state (örneğin pil yüzdesi) değiştiğinde tüm okuma ekranı etkilenmektedir.
*   **Etki:** Optimizasyon kaybı, yüksek CPU kullanımı ve pil tüketimi. Ayrıca UI üzerinde anlık takılmalara (jitter) sebep olabilmektedir.

### 1.4. Jest ve Dokunmatik Yönetimi (Gesture Management)
*   **Sorun:** Drawer açma/kapama, sayfa değiştirme (1-2-1 kuralı) ve overlay kontrolleri için `PanResponder` ve `click` eventleri birbiriyle çakışabilecek şekilde iç içe geçmiştir.
*   **Etki:** Native animasyon hissi kaybolmuş, kaydırma hızında gecikmeler ve state eşitsizlikleri (senkronizasyon problemleri) yaşanmıştır. `react-native-gesture-handler` kütüphanesi projede olmasına rağmen kullanılmamıştır.

### 1.5. Native Katman (Android) ile Entegrasyon
*   **Sorun:** Ses tuşları ile sayfa çevirme gibi özellikler doğrudan Activity üzerinde dinlenmekte ve `DeviceEventEmitter` ile JS tarafına itilmektedir. Bu durum yaşam döngüsü (lifecycle) yönetimi tam yapılmazsa memory leak'lere sebep olabilir.

---

## 2. Geleceğe Dönük Mimari Yol Haritası (V2 Mimarisi)

Uygulamanın gelecekteki yeni özelliklere (metin çevirisi, sesli okuma, bulut senkronizasyonu vb.) açık olabilmesi için uygulamanın "Modüler ve Katmanlı (Layered)" bir yapıya geçmesi gerekmektedir.

### Faz 1: "Divide and Conquer" - ReaderScreen'i Parçalama
`ReaderScreen` içindeki sorumluluklar özel bileşenlere (Components) ve Hook'lara ayrılmalıdır:
1.  **`useWebViewBridge.ts`**: WebView ile haberleşme (`handleMsg`, `injectScript` mekanizmaları) sadece bu hook üzerinden yönetilmeli.
2.  **`useReaderGestures.ts`**: `PanResponder` (veya GestureHandler) ve dokunma mekanizmaları bu hook içerisine alınmalı.
3.  **UI Bileşenlerinin Ayrılması**: 
    *   `<ReaderHeader />`
    *   `<ReaderDock />`
    *   `<ReaderDrawer />`
    *   `<BatteryClockOverlay />`
    Bu bileşenler `React.memo` ile sarılarak gereksiz render almalardan korunmalıdır. `ReaderScreen` sadece bir "Kapsayıcı" (Container) olmalıdır.

### Faz 2: WebView İletişim Katmanının Modernizasyonu
String tabanlı `injectJavaScript` yerine, WebView içerisine yüklenecek olan statik bir JS dosyası oluşturulmalıdır (`reader.js`).
*   **Message Broker Deseni:** React Native ile WebView arasında standart bir mesajlaşma protokolü kurulmalıdır (örn: `{ type: 'ACTION_NAME', payload: {...} }`).
*   **TypeScript Desteği:** WebView içinde çalışacak olan kodlar da Typescript ile yazılıp Webpack/Vite ile bundle edilerek projeye dahil edilmelidir.

### Faz 3: State Optimizasyonu (Zustand Selectors)
`zustand` store'larından veri çekilirken "Selector" kullanımı zorunlu hale getirilmelidir.
*   *Hatalı kullanım:* `const { fontSize, theme } = useThemeStore();` (Store'daki herhangi bir değişimde render tetikler)
*   *Doğru kullanım:* `const fontSize = useThemeStore(state => state.fontSize);` (Sadece fontSize değiştiğinde render tetikler)
Bu, performansı doğrudan etkileyecektir.

### Faz 4: Gesture ve Animasyon Altyapısını Yenileme
*   Mevcut `Animated` ve `PanResponder` API'leri yerine, modern, performanslı ve Native Thread üzerinde çalışan **`react-native-reanimated` (v3/v4)** ve **`react-native-gesture-handler`** kütüphaneleri tam anlamıyla entegre edilmelidir.
*   Bu sayede Drawer ve sayfa geçiş animasyonları JS Thread'ini meşgul etmeden 60/120 FPS'de pürüzsüz (smooth) çalışacaktır.

### Faz 5: Servis Odaklı (Service-Oriented) Yaklaşım
*   EPUB ayrıştırma (EpubManager), Çeviri (TranslationService), Sanitizer gibi işlevler saf JS fonksiyonlarından ziyade, ileride Web Worker veya Native modüllere kaydırılabilecek şekilde Dependency Injection (DI) mantığına benzer modüler sınıflar haline getirilmelidir.

---

## 3. Acil Aksiyon Planı (Uygulama Adımları)

Yapay zeka asistanı tarafından sırasıyla uygulanacak adımlar:

1.  **Adım 1: UI Parçalama (Component Split)** 
    *   `src/screens/ReaderScreen.tsx` içerisindeki saat/pil fonksiyonları `<ReaderStatusOverlay />` isimli yeni bir bileşene çıkarılacak.
    *   Animasyonlu Header ve Dock kodları, `<ReaderNavigationOverlay />` bileşenine ayrılacak.
    *   Drawer mantığı tamamen ayrı bir `<ReaderDrawer />` bileşenine taşınacak.
2.  **Adım 2: State Optimizasyonu**
    *   Tüm `useLibraryStore` ve `useThemeStore` çağrıları Zustand Selector'larına (veya `useShallow`) dönüştürülerek re-render problemleri ortadan kaldırılacak.
3.  **Adım 3: İş Mantığını Soyutlama (Custom Hooks)**
    *   `useWebViewBridge.ts` oluşturulacak.
    *   `useReaderGestures.ts` oluşturulacak.
4.  **Adım 4: Gesture Handler Göçü**
    *   Mevcut `PanResponder` yapıları, projede zaten yüklü olan `react-native-gesture-handler` ve `react-native-reanimated` alt yapısına geçirilecek.

*Onayınızın ardından asistan, Adım 1'den başlayarak kod tabanını bu yeni, optimize mimariye taşıyacaktır.*
