# AI Agent Implementasyon Plani - DocWebApp

## 1. Mevcut Durum Analizi

DocWebApp, Express.js backend + vanilla JS frontend (ES Modules) ile calisan, build step'i olmayan, dosya sistemi tabanli yerel bir dokuman yonetim uygulamasi. 

- **Backend**: Express.js (CommonJS, `require`)
- **Frontend**: Vanilla JS, ES Modules, CDN'den yuklenen kutuphaneler (marked.js, highlight.js, mermaid.js)
- **Paket yoneticisi**: npm
- **Build sistemi**: Yok (dosyalar dogrudan servis ediliyor)
- **TypeScript**: Yok
- **Veritabani**: Yok (dosya sistemi)

---

## 2. Mimari Karar: Vercel AI SDK

**Secim**: `ai` (Vercel AI SDK) + provider paketleri

### Neden AI SDK?
- 40+ provider desteği (OpenAI, Anthropic, Google, Ollama, Zhipu/Z.AI, LM Studio, vb.)
- Unified interface: Provider degistirmek tek satir kod
- Streaming desteği (SSE)
- Text generation, structured data, tool calling, embeddings
- Community provider'lar (Ollama, Zhipu, OpenRouter, vb.)
- Node.js ile dogrudan calisir (Next.js gerektirmez)

### Z.AI / Zhipu Entegrasyonu
Z.AI, `zhipu-ai-provider` community package'i uzerinden destekleniyor.
- Paket: `zhipu-ai-provider`
- Custom `baseURL` ile Z.AI coding API endpoint'i kullanilabilir
- OpenAI semasi ile uyumlu, ek olarak Zhipu native API'si de destekleniyor

### Gelecek Provider'lar Icin Hazirlik
| Provider | Paket | Notlar |
|---|---|---|
| Zhipu / Z.AI | `zhipu-ai-provider` | Mevcut, ilk entegrasyon |
| Google AI Studio | `@ai-sdk/google` | Gemini modelleri, ucretsiz tier mevcut |
| OpenAI | `@ai-sdk/openai` | GPT modelleri |
| Anthropic | `@ai-sdk/anthropic` | Claude modelleri |
| Ollama (lokal) | `ollama-ai-provider` | Yerel modeller |
| LM Studio (lokal) | `@ai-sdk/openai` compatible | OpenAI uyumlu endpoint |
| DeepSeek | `@ai-sdk/deepseek` | Ucuz ve guçlu modeller |
| OpenRouter | `@openrouter/ai-sdk-provider` | Coklu model router |

---

## 3. Provider Yonetim Sistemi

### 3.1 Konfigürasyon (.env tabanli)

`.env` dosyasinda provider'lar tanimlanir. Hic provider yoksa AI ozellikleri tamamen gizlenir.

```env
# ─── AI Provider Konfigurasyonu ───────────────────────────────────
# Asagidaki degiskenlerden EN AZ biri tanimli degilse AI ozellikleri gizlenir.

# Aktif provider (zorunlu, varsa): zhipu | openai | google | anthropic | ollama | lmstudio | deepseek | openrouter
AI_PROVIDER=zhipu

# ─── Zhipu / Z.AI ────────────────────
ZHIPU_API_KEY=672d15466d29432fbe48e8e17c297a6b.ujLUaAH2joLTbQsb
ZHIPU_BASE_URL=https://api.z.ai/api/coding/paas/v4
ZHIPU_MODEL=GLM-4.7-FlashX

# ─── OpenAI ──────────────────────────
# OPENAI_API_KEY=sk-...
# OPENAI_MODEL=gpt-4o-mini

# ─── Google AI Studio ────────────────
# GOOGLE_API_KEY=...
# GOOGLE_MODEL=gemini-2.0-flash

# ─── Anthropic ───────────────────────
# ANTHROPIC_API_KEY=sk-ant-...
# ANTHROPIC_MODEL=claude-sonnet-4-20250514

# ─── Ollama (lokal) ──────────────────
# OLLAMA_BASE_URL=http://localhost:11434
# OLLAMA_MODEL=llama3.2

# ─── LM Studio (lokal) ──────────────
# LMSTUDIO_BASE_URL=http://localhost:1234/v1
# LMSTUDIO_MODEL=local-model

# ─── DeepSeek ────────────────────────
# DEEPSEEK_API_KEY=...
# DEEPSEEK_MODEL=deepseek-chat

# ─── OpenRouter ──────────────────────
# OPENROUTER_API_KEY=...
# OPENROUTER_MODEL=meta-llama/llama-3-70b-instruct
```

### 3.2 Backend Provider Factory (server tarafinda)

Server tarafinda bir `ai/provider.js` modulu olusturulur. Bu modul:
1. `.env`'den aktif provider'i okur
2. Uygun AI SDK provider instance'ini olusturur
3. Model nesnesi dondurur
4. Provider yoksa `null` dondurur

```
ai/
  provider.js      ← Provider factory: .env'den okur, model nesnesi dondurur
  prompts.js       ← System prompt'lar ve prompt sablonlari
  routes.js        ← Express route'lari (/api/ai/*)
```

### 3.3 AI Durum Endpoint'i

```
GET /api/ai/status → { enabled: true/false, provider: "zhipu", model: "GLM-4.7-FlashX" }
```

Frontend bu endpoint'i sayfa yuklendiginde cagirir. `enabled: false` ise AI butonlari/ozellikleri DOM'a eklenmez.

---

## 4. Feature Visibility Sistemi (AI Hidden/Shown)

### Calisma Mantigi:

```
1. Sayfa yuklendiginde frontend GET /api/ai/status cagirir
2. Backend .env'de gecerli provider var mi kontrol eder
3. Response: { enabled: true, provider: "zhipu", model: "GLM-4.7-FlashX" }
   veya: { enabled: false }
4. Frontend AI ozelliklerini buna gore gosterir/gizler
```

### Frontend Tarafinda:

- `state.js`'e `aiEnabled` degiskeni eklenir
- `app.js`'te init sirasinda `/api/ai/status` cagirilir
- AI butonlari (Summarize vb.) sadece `aiEnabled === true` ise render edilir
- CSS class ile `.ai-feature` olarak isaretlenir, `body.ai-disabled .ai-feature { display: none }` ile gizlenir

---

## 5. Ilk AI Ozelligi: Dokuman Ozeti (Summarize)

### 5.1 UI Tasarimi

**Buton yeri**: Editor header'daki aksiyonlar bolumune (btn-edit, btn-save, btn-copy, btn-delete yanina) bir **"AI Summarize"** butonu eklenir.

```html
<button id="btn-ai-summarize" class="ai-feature" onclick="aiSummarize()" title="AI Ozet">
  <i class="fas fa-robot"></i>
</button>
```

**Panel**: Sag taraftan kayan (slide-in) bir panel acilir:

```
┌─────────────────────────────────────────────────────────────────┐
│ [Sidebar] │          Editor/Preview           │   AI Panel     │
│           │                                   │  ┌───────────┐ │
│           │                                   │  │ Summarize │ │
│           │  [Mevcut dokuman icerigi]          │  │ sonucu    │ │
│           │                                   │  │ burada    │ │
│           │                                   │  │ (stream   │ │
│           │                                   │  │  edilir)  │ │
│           │                                   │  │           │ │
│           │                                   │  └───────────┘ │
│           │                                   │  [Kapat] [Copy]│
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 Panel Detaylari

- Panel basligi: "AI Ozet" + provider/model bilgisi (kucuk yazi ile)
- Icerik alani: Streaming olarak gelen ozet metni (markdown olarak render edilir)
- Alt butonlar:
  - **Kopyala**: Ozeti panoya kopyalar
  - **Kapat**: Paneli kapatir
- Loading durumu: Spinner animasyonu + "Ozet hazirlaniyor..." yazisi
- Hata durumu: Hata mesaji gosterilir

### 5.3 Backend API

```
POST /api/ai/summarize
Body: { filePath: "path/to/file.md" }
Response: SSE stream (Server-Sent Events)
```

Backend akisi:
1. `filePath`'ten dosya icerigini okur
2. AI SDK ile `streamText()` cagirir
3. System prompt ile ozet cikarma talimati verir
4. SSE uzerinden frontend'e stream eder

### 5.4 Streaming Mimarisi

AI SDK'nin `streamText()` fonksiyonunu kullanarak SSE (Server-Sent Events) ile stream ederiz:

```
Frontend (EventSource) ← SSE ← Express Route ← AI SDK streamText() ← LLM API
```

Bu yaklasim:
- Kullaniciya ani geri bildirim saglar (ilk token hemen gorunur)
- Uzun ozetlerde bekleme suresini azaltir
- Tum AI SDK provider'larinda calisir

### 5.5 System Prompt (Ozet Icin)

```
Sen bir dokuman ozet cikarma asistaninsin. 
Verilen dokumani analiz et ve asagidaki formatta ozetle:

## Ozet
[2-3 cumlelik genel ozet]

## Ana Noktalar
- [Madde 1]
- [Madde 2]
- [Madde 3]
...

## Anahtar Kelimeler
[virgülle ayrilmis anahtar kelimeler]

Ozetini Türkçe yaz. Kisaca ve net ol. Sadece icerikteki bilgileri kullan.
```

---

## 6. Dosya / Dizin Yapisi (Yeni Eklenecekler)

```
DocWebApp/
├── .env.example              ← YENi: Ornek env dosyasi (API key'ler bos)
├── .env                      ← YENi: Gercek konfigürasyon (gitignore'da)
├── server.js                 ← GUNCELLEME: AI route'larini import eder
├── ai/                       ← YENi: AI backend modulleri
│   ├── provider.js           ← Provider factory
│   ├── prompts.js            ← Prompt sablonlari
│   └── routes.js             ← Express route'lari
├── public/
│   ├── index.html            ← GUNCELLEME: AI paneli HTML'i eklenir
│   ├── style.css             ← GUNCELLEME: AI panel stilleri eklenir
│   └── js/
│       ├── ai.js             ← YENi: AI frontend modulu
│       ├── app.js            ← GUNCELLEME: AI init eklenir
│       └── state.js          ← GUNCELLEME: aiEnabled state eklenir
└── package.json              ← GUNCELLEME: AI SDK bagimliliklari eklenir
```

---

## 7. Bagimliliklarin Eklenmesi

```bash
npm install ai zhipu-ai-provider dotenv
```

- `ai` → Vercel AI SDK core (streamText, generateText, vb.)
- `zhipu-ai-provider` → Z.AI / Zhipu entegrasyonu
- `dotenv` → .env dosyasi okumak icin

Gelecekte eklenmesi muhtemel paketler (simdilik kurulmayacak):
- `@ai-sdk/openai` → OpenAI
- `@ai-sdk/google` → Google AI Studio (Gemini)
- `@ai-sdk/anthropic` → Anthropic (Claude)
- `ollama-ai-provider` → Ollama
- `@ai-sdk/deepseek` → DeepSeek
- `@openrouter/ai-sdk-provider` → OpenRouter

---

## 8. Guvenlik Hususlari

1. **API key'ler sadece backend'de**: Frontend hicbir zaman API key'e erismez
2. **`.env` gitignore'da**: Repoya commit edilmez
3. **`.env.example`**: Bos sablonlar ile paylasilir
4. **Path traversal korunma**: Mevcut `DOCS_ROOT` kontrolleri AI route'larinda da uygulanir
5. **Rate limiting**: Ilk asama icin basit bir in-memory rate limiter (opsiyonel)

---

## 9. Gelecek Ozellikler Icin Mimari Hazirligi

Bu plan sadece "Summarize" icin olsa da, mimari asagidaki ozelliklere kolayca genisleyecek sekilde tasarlaniyor:

| Ozellik | API Route | Zorluk |
|---|---|---|
| Dokuman Ozeti (Summarize) | `POST /api/ai/summarize` | **Ilk hedef** |
| Soru-Cevap (QA) | `POST /api/ai/ask` | Orta |
| Otomatik tag/kategorizasyon | `POST /api/ai/categorize` | Kolay |
| Ceviri | `POST /api/ai/translate` | Kolay |
| Icerik onerisi / yazim | `POST /api/ai/generate` | Orta |
| Chat (dokuman bazli) | `POST /api/ai/chat` | Zor |
| Arama (semantic / embedding) | `POST /api/ai/search` | Zor |

`ai/routes.js` icinde her ozellik ayri bir route olarak eklenir. `ai/prompts.js` prompt sablonlarini icerir. Provider/model secimi merkezi `ai/provider.js` uzerinden yapilir.

---

## 10. Implementasyon Adimlari (Siralama)

### Adim 1: Altyapi Kurulumu
- [ ] `npm install ai zhipu-ai-provider dotenv`
- [ ] `.env.example` dosyasi olustur
- [ ] `.env` dosyasi olustur (gercek key ile)
- [ ] `.gitignore`'a `.env` ekle
- [ ] `ai/` dizinini olustur

### Adim 2: Provider Sistemi
- [ ] `ai/provider.js` - Provider factory modulu
- [ ] `ai/prompts.js` - Prompt sablonlari
- [ ] `ai/routes.js` - Express route'lari (`/api/ai/status`, `/api/ai/summarize`)
- [ ] `server.js` guncelle - dotenv ve AI route'larini import et

### Adim 3: Frontend AI Modulu
- [ ] `public/js/ai.js` - AI istemci modulu (status check, SSE baglantisi, panel yonetimi)
- [ ] `public/js/state.js` guncelle - `aiEnabled` state
- [ ] `public/js/app.js` guncelle - AI init fonksiyonunu cagir

### Adim 4: UI Bileşenleri
- [ ] `public/index.html` guncelle - AI paneli HTML + Summarize butonu
- [ ] `public/style.css` guncelle - AI panel stilleri

### Adim 5: Test & Dogrulama
- [ ] AI olmadan calistir → AI ozellikleri gorunmemeli
- [ ] AI ile calistir → Summarize butonu gorunmeli
- [ ] Summarize butonuna tikla → Panel acilmali, ozet stream edilmeli
- [ ] Hata durumlarini test et (gecersiz API key, network hatasi, bos dosya)

---

## 11. Teknik Notlar

### AI SDK Versiyonu
AI SDK v6 (latest) kullanilacak. Bu versiyon `streamText`, `generateText` fonksiyonlarini sunar.

### CommonJS vs ESM
Backend (server.js) CommonJS (`require`) kullandigi icin, AI SDK'nin CommonJS uyumlulugunu kullanacagiz. AI SDK bunu destekliyor.

### Streaming Protokolu
SSE (Server-Sent Events) kullanilacak. Frontend tarafinda native `EventSource` API'si ile dinlenecek. AI SDK'nin `toDataStream()` veya manual stream forwarding yontemi kullanilabilir.

### Thinking Model Desteği
AI SDK'nin `providerOptions` uzerinden thinking/reasoning model desteği mevcut. Ilerde thinking modeller (DeepSeek Reasoner, o1, vb.) kullanilacaksa, prompt ve response handling'de buna uygun ayarlamalar yapilabilir. Mevcut mimari bunu destekleyecek sekilde tasarlaniyor.

---

## 12. Ozet

Bu plan:
1. **Vercel AI SDK** ile provider-agnostik bir AI katmani kurar
2. **Z.AI (Zhipu)** ile ilk entegrasyonu yapar
3. `.env` tabanli konfigürasyon ile **provider yoksa AI gizli** mantigi uygular
4. **Summarize** ozelligini streaming ile saglar
5. Gelecekte yeni ozellikler ve provider'lar eklenebilecek **genisletilebilir mimari** sunar
