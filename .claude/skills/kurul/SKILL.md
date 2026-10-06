---
name: kurul
description: Karar Kurulu – 5 üye konuyu farklı açılardan değerlendirir, başkan son kararı verir. Üç mod var - genel karar (hayat/iş/proje), "uygulama:" (Almanca Pratik uygulamasının geliştirilmesi) ve "almanca:" (Almanca cümle değerlendiren öğretmen kurulu). Kullanıcı /kurul yazdığında, "kurulu topla", "kurula sor" ya da benzeri bir şey dediğinde kullan.
argument-hint: "[uygulama: | almanca:] <soru veya cümle>"
---

# Karar Kurulu

Kullanıcının konusu: **$ARGUMENTS**

Konu boşsa kullanıcıya hangi konuda karar istediğini sor ve dur.

## 1. Modu belirle
- `uygulama:` ile başlıyorsa → **uygulama** modu (öneki konudan çıkar).
- `almanca:` ile başlıyorsa → **almanca** modu.
- Önek yoksa: metin büyük ölçüde Almanca bir cümleyse **almanca**, Almanca Pratik uygulamasından söz ediyorsa **uygulama**, değilse **genel**.

## 2. Rolleri oku
`C:\Users\XYZ\Documents\Almanca Pratik\kurul\roller.md` dosyasını oku. Seçilen moda ait 5 üyeyi, üye çıktı şablonunu ve başkan şablonunu al. Uygulama modundaki "Bağlam" paragrafını da al.

## 3. Kullanıcıya kısaca haber ver
Tek satır yaz, örneğin: "🏛️ Kurul toplanıyor (genel mod): 5 üye konuyu inceliyor…"

## 4. Beş üyeyi paralel çalıştır
**Tek bir mesajda** 5 ayrı `Agent` çağrısı yap; `subagent_type: "kurul-uyesi"` kullan ve `run_in_background: false` ver. Her üyenin istemi kendi başına anlaşılır olmalı ve şunları içermeli:
- Rolün adı, emojisi ve roller.md'deki tam açıklaması
- Mod ve (varsa) bağlam paragrafı
- Kullanıcının konusu, kelimesi kelimesine
- O moda ait üye çıktı şablonu ve "şablona birebir uy, 150 kelimeyi geçme" talimatı

> **Yedek:** `kurul-uyesi` ajan türü bulunamazsa (örneğin dosyalar yeni eklendiyse ve oturum yeniden başlatılmadıysa) aynı çağrıları `subagent_type: "general-purpose"` ve `model: "sonnet"` ile yap. `.claude/agents/kurul-uyesi.md` dosyasındaki kuralları her istemin başına ekle. Başkan için de aynı şekilde `kurul-baskani.md` kurallarını kullan.

## 5. Başkanı çalıştır
Beş görüş gelince `subagent_type: "kurul-baskani"` ile tek bir `Agent` çağrısı yap. İstemde konu, mod, 5 üyenin görüşleri (aynen) ve o moda ait başkan şablonu olsun.

## 6. Sonucu göster
Kullanıcıya şu sırayla yaz:
1. Başkanın kararını **aynen** yaz (en önemli kısım, en üstte).
2. Altına "Üyelerin görüşleri" başlığıyla 5 üyenin görüşlerini kısaca ver. Her üyeden en fazla 2 satır: oy/hata durumu + öneri/düzeltme.
3. Son satırda karar dosyasının yolunu ver.

## 7. Kaydet
Tam metni (konu, mod, tarih, 5 üyenin tam görüşü, başkanın kararı) şu dosyaya yaz:
`C:\Users\XYZ\Documents\Almanca Pratik\kurul\kararlar\<YYYY-AA-GG>-<kısa-konu>.md`
- `<kısa-konu>`: konudan 2–4 kelimelik, küçük harfli, Türkçe karaktersiz, tireli ad (örnek: `karanlik-mod-ekleme`).
- Aynı adla dosya varsa sonuna `-2`, `-3` ekle.

## Notlar
- Uygulama modunda kurul sadece karar verir; kodu değiştirmez. Karar "YAP" çıkarsa kullanıcıya "İstersen bunu şimdi uygulayayım" diye sor.
- Almanca modunda kullanıcı birden fazla cümle verdiyse hepsini tek kurulda değerlendir; başkan her cümle için ayrı bir "Doğrusu" satırı yazsın.
