# DocWebApp

Local document viewer web uygulaması.

## Başlatma

```bash
cd DocWebApp
npm start
```

veya `DocWebApp.command` dosyasına çift tıkla.

Tarayıcıda http://localhost:14296 açılır.

## Özellikler

- [x] Gece modu (GitHub dark tema)
- [x] Sol panelde expandable folder tree
- [x] Markdown dosyalarını render etme (marked.js)
- [x] Kod bloklarında syntax highlighting (highlight.js)
- [x] Mermaid diagram desteği
- [x] Dosya düzenleme + format toolbar (bold, italic, heading, code, table, checklist vb.)
- [x] Yeni dosya/klasör oluşturma
- [x] Sağ tıklama context menüsü (yeniden adlandır, sil, taşı)
- [x] Drag & drop ile dosya taşıma
- [x] Klasör silme (recursive)
- [x] Sublime Text ile düzenleme senkronu (sekme focus'unda otomatik yenile)
- [x] Cmd+S ile kaydetme
- [x] Yeni folder butonu kök dizine ekler, sağ tık ile alt klasöre eklenir
- [ ] Arama
- [ ] Multi-tab / birden fazla dosya açık tutma
- [ ] Dosya yükleme (drag & drop file upload)
- [ ] Export (PDF, HTML)
