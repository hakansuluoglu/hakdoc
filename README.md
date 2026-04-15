# HakDoc

Yerel markdown dokümanlarını görüntülemek ve düzenlemek için macOS masaüstü uygulaması. Tauri + Express.js ile çalışır.

---

## Masaüstü Uygulaması (Tauri)

### Kurulum (ilk kez)

```bash
# 1. Bağımlılıkları yükle
npm install

# 2. Rust yüklü değilse:
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# 3. DMG üret
npx tauri build
```

DMG çıktısı:
```
src-tauri/target/release/bundle/dmg/HakDoc_0.1.0_aarch64.dmg
```

### ~/Applications'a kur (şirket Mac'i için — admin izni gerekmez)

```bash
mkdir -p ~/Applications
cp -r src-tauri/target/release/bundle/macos/HakDoc.app ~/Applications/
xattr -cr ~/Applications/HakDoc.app
```

Kurulduktan sonra Spotlight'tan "HakDoc" yazarak açılır. Dock'a eklemek için `~/Applications/HakDoc.app`'i Finder'dan sürükle.

### Yeni sürüm üretme (güncelleme)

Kod değişikliği yaptıktan sonra:

```bash
npx tauri build
cp -r src-tauri/target/release/bundle/macos/HakDoc.app ~/Applications/
xattr -cr ~/Applications/HakDoc.app
```

> İkinci derlemeden itibaren Rust cache'li olduğu için ~20-25 sn sürer.

### Nasıl çalışır

App açılınca arka planda `node server.js` başlatır (Express sunucu). Sunucu hazır olana kadar bekler, sonra pencereyi açar. App kapatılınca sunucu da durur.

Node.js path'i Homebrew'dan geldiği için `lib.rs`'de tam yol kullanılır:
```
/opt/homebrew/bin/node
```

Node.js farklı bir yere kurulduysa [src-tauri/src/lib.rs](src-tauri/src/lib.rs) içinde güncelle.

---

## Geliştirme

Prod DMG (14296) ile çakışmamak için dev ortamı **14297** portunda çalışır.

| Komut | Port | Açıklama |
|---|---|---|
| `npm run dev` | 14297 | Sadece backend — tarayıcıda aç (en hızlı) |
| `npm run tauri:dev` | 14297 | Tauri dev penceresi — Tauri davranışı test için |
| `npm start` | 14296 | Prod backend (DMG ile aynı) |

### Browser geliştirme (önerilen)

```bash
npm run dev
```

Sunucu 14297'de başlar. Tarayıcıda [http://localhost:14297](http://localhost:14297) aç. Dosyayı kaydet → Cmd+R ile yenile. Kurulu DMG ile aynı anda çalışır, çakışma yok.

### Tauri geliştirme penceresi

```bash
npm run tauri:dev
```

14297 portunda ayrı bir Tauri penceresi açar. `src-tauri/tauri.dev.conf.json` kullanır, prod config'i (`tauri.conf.json`) etkilemez. İlk çalıştırmada Rust derleme gerekir (~birkaç dakika), sonrakiler hızlı.

> Hot reload yok — kod değişikliği sonrası tarayıcıda Cmd+R ya da `tauri:dev`'i yeniden başlat.

---

## Environment Variables

`.env.example` dosyasını kopyala:

```bash
cp .env.example .env
```

| Değişken | Varsayılan | Açıklama |
|---|---|---|
| `DOCS_ROOT` | `~/Documents/xx_hakdoc` | Doküman kök dizini |
| `PORT` | `14296` | Sunucu portu |
| `AI_PROVIDER` | — | AI provider (zhipu, openai, anthropic, vb.) |
| `AI_API_KEY` | — | Provider API key'i |

AI provider tanımlanmazsa tüm AI butonları otomatik gizlenir.

Desteklenen providerlar: `zhipu` (Z.AI), `openai`, `google`, `anthropic`, `ollama`, `lmstudio`, `deepseek`, `openrouter`

---

## Özellikler

- [x] Gece modu (GitHub dark tema)
- [x] Sol panelde expandable folder tree
- [x] Markdown render (marked.js)
- [x] Syntax highlighting (highlight.js)
- [x] Mermaid diagram desteği
- [x] Dosya düzenleme + format toolbar (bold, italic, heading, code, table, checklist vb.)
- [x] Yeni dosya/klasör oluşturma
- [x] Sağ tıklama context menüsü (yeniden adlandır, sil, taşı)
- [x] Dosya üzerinde hızlı silme butonu (hover'da çöp kutusu ikonu)
- [x] Multi-select: Shift ile aralık seçimi, Cmd/Ctrl ile tekli seçim
- [x] Toplu işlemler: Seçili dosyaları sağ tıkla toplu sil / toplu taşı
- [x] Drag & drop ile dosya taşıma (tekli ve çoklu seçim destekli)
- [x] Klasör silme (recursive)
- [x] Sublime Text ile düzenleme senkronu (sekme focus'unda otomatik yenile)
- [x] Cmd+S ile kaydetme
- [x] Auto-save (localStorage) — kaydedilmemiş değişiklikler refresh sonrası korunur
- [x] Son açık dosya ve klasör durumu hatırlama (session restore)
- [x] Toast bildirimler (draft recovery, kaydetme onayı)
- [x] Highlight (`==text==`), footnote, superscript, subscript desteği
- [x] GitHub-style callout/alert rendering (`> [!NOTE]`, `> [!WARNING]` vb.)
- [x] Heading level cycling (H1 → H2 → H3 → H4 → plain text)
- [x] Modüler mimari (ES Modules)
- [x] Arama
- [x] Multi-tab / birden fazla dosya açık tutma
- [x] Dosya yükleme (drag & drop)
- [x] **AI Özet** — aktif dosyayı AI ile özetler, sağ panelde streaming olarak gösterir
  - Özet localStorage'a kaydedilir (cache)
  - Tekrar açıldığında cache'den anında yüklenir
  - Panel dokümanın yanında açılır, içeriği overlay etmez
- [ ] Export (PDF, HTML)

---

## Teknik Stack

| Katman | Teknoloji |
|---|---|
| Masaüstü | Tauri v2 (Rust + WebView) |
| Backend | Express.js (Node.js) |
| Frontend | Vanilla JS (ES Modules), CSS custom properties |
| Markdown | marked.js, highlight.js, mermaid.js |
| AI | Vercel AI SDK — multi-provider |
| İkon | macOS tarzı kabartmalı, turuncu-altın gradyan |

Frontend build step'i yok — dosyalar doğrudan Express tarafından servis edilir.

---

## Proje Yapısı

```
HakDoc/
├── server.js              # Express sunucu (API endpoints)
├── package.json
├── icon2.png              # App ikonu (kaynak, 1024x1024)
├── .env.example           # AI provider konfigürasyon şablonu
├── ai/
│   ├── provider.js        # AI provider factory (Vercel AI SDK)
│   ├── prompts.js         # Sistem promptları
│   └── routes.js          # AI API route'ları (/api/ai/*)
├── public/
│   ├── index.html         # Ana HTML
│   ├── favicon.png        # Browser favicon
│   ├── style.css          # Tüm stiller
│   └── js/
│       ├── app.js         # Entry point, init, keyboard shortcuts
│       ├── state.js       # Global state, localStorage, draft yönetimi
│       ├── ai.js          # AI frontend (cache, SSE, panel yönetimi)
│       ├── tree.js        # Dosya ağacı, drag & drop
│       ├── editor.js      # Dosya yükleme, düzenleme, format toolbar
│       ├── modals.js      # Modal, context menü, taşıma
│       └── utils.js       # Utility, toast sistemi
└── src-tauri/
    ├── tauri.conf.json    # Tauri konfigürasyonu (app adı, port, ikon)
    ├── Cargo.toml         # Rust bağımlılıkları
    ├── icons/             # Tüm platform ikonları (tauri icon komutuyla üretilir)
    └── src/
        ├── main.rs        # Rust entry point
        └── lib.rs         # Server spawn + Tauri builder
```
