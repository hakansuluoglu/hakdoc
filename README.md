# DocWebApp

Local document viewer web uygulaması.

## Başlatma

```bash
cd DocWebApp
npm start
```

veya `DocWebApp.command` dosyasına çift tıkla.

Tarayıcıda http://localhost:14296 açılır.

### Environment Variables

| Değişken | Varsayılan | Açıklama |
| --- | --- | --- |
| `DOCS_ROOT` | `~/Documents/xx_hakdoc` | Doküman kök dizini |
| `PORT` | `14296` | Sunucu portu |

```bash
DOCS_ROOT=/path/to/docs npm start
```

### AI Özellikleri (Opsiyonel)

AI özelliklerini etkinleştirmek için `.env` dosyası oluştur (`.env.example` şablonu mevcuttur):

```bash
cp .env.example .env
# .env dosyasını düzenleyip API key'i ekle
```

AI provider tanımlanmazsa tüm AI butonları otomatik olarak gizlenir.

Desteklenen providerlar: `zhipu` (Z.AI), `openai`, `google`, `anthropic`, `ollama`, `lmstudio`, `deepseek`, `openrouter`

## Özellikler

- [x] Gece modu (GitHub dark tema)
- [x] Sol panelde expandable folder tree
- [x] Markdown dosyalarını render etme (marked.js)
- [x] Kod bloklarında syntax highlighting (highlight.js)
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
- [x] Yeni folder butonu kök dizine ekler, sağ tık ile alt klasöre eklenir
- [x] Auto-save (localStorage) — kaydedilmemiş değişiklikler refresh sonrası korunur
- [x] Son açık dosya ve klasör durumu hatırlama (session restore)
- [x] Toast bildirimler (draft recovery, kaydetme onayı)
- [x] Highlight (`==text==`) desteği
- [x] GitHub-style callout/alert rendering (`> [!NOTE]`, `> [!WARNING]` vb.)
- [x] Footnote, superscript, subscript format desteği
- [x] Heading level cycling (H1 → H2 → H3 → H4 → plain text)
- [x] Modüler mimari (ES Modules)
- [x] Arama
- [x] Multi-tab / birden fazla dosya açık tutma
- [x] Dosya yükleme (drag & drop file upload)
- [x] **AI Özet** — aktif dosyayı AI ile özetler, sağ panelde streaming olarak gösterir
  - Özet localStorage'a kaydedilir (dosya yolu + tarih/saat bazlı)
  - Tekrar açıldığında cache'den anında yüklenir, API isteği yapılmaz
  - "Yenile" butonu ile yeni özet tetiklenebilir
  - Panel dokümanın yanında açılır, içeriği overlay etmez (sidebar gibi davranır)
- [ ] Export (PDF, HTML)

## Proje Yapısı

```
DocWebApp/
├── server.js              # Express sunucu (API endpoints)
├── package.json
├── .env.example           # AI provider konfigürasyon şablonu
├── ai/
│   ├── provider.js        # AI provider factory (Vercel AI SDK)
│   ├── prompts.js         # Sistem promptları ve şablonlar
│   └── routes.js          # AI API route'ları (/api/ai/*)
├── public/
│   ├── index.html         # Ana HTML
│   ├── style.css          # Tüm stiller
│   └── js/
│       ├── app.js         # Entry point, init, keyboard shortcuts
│       ├── state.js       # Global state, localStorage, draft management
│       ├── ai.js          # AI frontend modülü (cache, SSE, panel yönetimi)
│       ├── tree.js        # Dosya ağacı render, drag & drop
│       ├── editor.js      # Dosya yükleme, düzenleme, format toolbar
│       ├── modals.js      # Modal, context menü, taşıma
│       └── utils.js       # Utility fonksiyonlar, toast sistemi
└── DocWebApp.command      # macOS çift tıkla başlatma
```
