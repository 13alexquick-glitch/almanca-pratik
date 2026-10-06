# 🏛️ Karar Kurulu

1 başkan + 5 üyeden oluşan bir yapay zekâ kurulu. Üyeler konuyu farklı açılardan inceler, başkan görüşleri tartıp son kararı verir.

## Kullanım (Claude Code içinde)
Bu klasörde Claude Code açıkken şunlardan birini yaz:

| Ne istiyorsun? | Yaz |
|---|---|
| Genel bir karar | `/kurul Yeni bir telefon alayım mı?` |
| Uygulama için karar | `/kurul uygulama: Karanlık mod ekleyelim mi?` |
| Almanca cümleni düzelttir | `/kurul almanca: Ich habe gestern ins Kino gegangen.` |

`/kurul` yazmak yerine "kurula sor: …" da diyebilirsin.

## Üyeler
- **Genel:** 🌞 Fırsatçı · ⚠️ Risk analisti · 🔧 Pratik uygulayıcı · ❤️ İnsan ve değerler · 🔭 Uzun vade stratejisti
- **Uygulama:** 📦 Ürün yöneticisi · 🎨 Tasarımcı · 💻 Yazılımcı · 🎓 Öğrenme uzmanı · 📣 Pazarlama ve iş
- **Almanca:** 📐 Dilbilgisi · 📖 Kelime ve anlam · 🗣️ Telaffuz · 🇩🇪 Anadili Almanca olan · 🪜 A1 seviye koçu

Rolleri değiştirmek ya da yeni bir mod eklemek için `roller.md` dosyasını düzenle.

## Kayıtlar
Her karar `kararlar/` klasörüne tarihli bir dosya olarak kaydedilir. Bu klasör GitHub'a **gönderilmez** (kişisel kararlar gizli kalır).

## Dosyalar
- `roller.md`: Roller ve çıktı şablonları (tek kaynak)
- `../.claude/skills/kurul/SKILL.md`: `/kurul` komutu
- `../.claude/agents/kurul-uyesi.md`, `kurul-baskani.md`: Üye ve başkan ajanları

## İleride: web sürümü
Arkadaşlarının da linkten kullanabilmesi için uygulamaya bir "Kurul" sayfası eklenebilir:
- Aynı `roller.md` istemleriyle 5 paralel + 1 başkan çağrısı Claude API'ye yapılır.
- Kullanıcı kendi API anahtarını girer; anahtar sadece kendi tarayıcısında kalır.
- Satış aşamasında anahtar küçük bir sunucuya taşınır (herkese açık bir sitede API anahtarı saklanamaz).
