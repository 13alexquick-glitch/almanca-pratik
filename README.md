# 🇩🇪 Almanca Pratik

**Dinle · Tekrar et · Konuş** — A1 seviyesinde Almanca öğrenmek için kendi ders notlarımdan yaptığım bir uygulama.

👉 **Uygulamayı aç:** https://13alexquick-glitch.github.io/almanca-pratik/

Telefonda açıp **"Ana ekrana ekle"** dersen uygulama gibi kurulur ve internetsiz de çalışır.

## Neler var?
- 🔁 **Tek tuşla tekrar:** Seçtiğin ünitelerin tüm cümleleri sırayla çalar: dinle → Türkçesini duy → tekrar dinle → sen söyle → bir kez daha dinle → sonraki cümle.
- 📘 **Cümle kurma (Ünite 1–4):** Kuralı Türkçe anlatır, sonra cümleyi adım adım kurdurur.
- 🎙️ **Telaffuz kontrolü:** Mikrofona söyle, doğru kelimeler yeşil yanar.
- 🗣️ **Doğal sesler:** 6 Almanca ve 2 Türkçe ses; yavaş, normal ve hızlı seçenekleri.
- 📈 **Seviyeler:** Her konu kullandıkça 1'den 10'a dolar.
- 🏅 **Ödüller:** Rozetler, puanlar, gün serisi, süre sayacı ve ödül bildirimleri.
- 📚 21 konu, 350'den fazla cümle.

---

## Kendi bilgisayarında çalıştırmak
Masaüstündeki **Almanca Pratik** kısayoluna çift tıkla. Ya da bu klasörde:
```bash
python -m http.server 5173
```
Sonra tarayıcıda http://localhost:5173 adresini aç.

## Yeni konu eklemek
`data/topics.json` içine şu formatta yeni bir konu ekle:
```json
{ "id": "benim-konum", "unit": 2, "group": "Ders notlarım", "title": "Benim konum", "emoji": "⭐",
  "items": [
    { "de": "Ich trinke Tee.", "tr": "Çay içiyorum." }
  ] }
```
- `id` benzersiz olmalı; Türkçe karakter ya da boşluk kullanma.
- Var olan bir konunun cümle sırasını değiştirme, yeni cümleleri sona ekle (ilerleme kaydı sıraya göre tutulur).

Sonra yeni cümlelerin seslerini üret:
```bash
pip install edge-tts
python tools/generate_audio.py
```
Var olan dosyalar atlanır, sadece yenileri üretilir. Sesi olmayan bir cümlede uygulama cihazın kendi sesini kullanır.

## Güncellemeyi yayınlamak
1. `service-worker.js` içindeki `CACHE = 'almanca-v…'` sayısını bir artır.
2. Değişiklikleri GitHub'a gönder:
```bash
git add -A && git commit -m "Güncelleme" && git push
```
Bir iki dakika içinde link güncellenir.

---
Sesler Microsoft'un doğal (neural) sesleriyle üretildi. ✳ Claude ile yapıldı.
