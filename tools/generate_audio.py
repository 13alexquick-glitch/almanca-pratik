"""data/topics.json içindeki cümleler için doğal sesli MP3 dosyaları üretir.

Kullanım (almanca-pwa klasöründen):
    pip install edge-tts
    python tools/generate_audio.py

Var olan dosyalar atlanır; yeni ya da değişen cümleler için sadece eksikler üretilir.
"""
import asyncio
import hashlib
import json
import sys
import time
from pathlib import Path

import edge_tts

ROOT = Path(__file__).resolve().parent.parent
TOPICS = ROOT / "data" / "topics.json"
COURSE = ROOT / "data" / "course.json"
INDEX = ROOT / "data" / "audio.json"
AUDIO = ROOT / "audio"

VOICES = {
    "de": [
        {"id": "de-DE-KatjaNeural", "name": "Katja", "gender": "kadın"},
        {"id": "de-DE-AmalaNeural", "name": "Amala", "gender": "kadın"},
        {"id": "de-DE-SeraphinaMultilingualNeural", "name": "Seraphina", "gender": "kadın"},
        {"id": "de-DE-ConradNeural", "name": "Conrad", "gender": "erkek"},
        {"id": "de-DE-KillianNeural", "name": "Killian", "gender": "erkek"},
        {"id": "de-DE-FlorianMultilingualNeural", "name": "Florian", "gender": "erkek"},
    ],
    "tr": [
        {"id": "tr-TR-EmelNeural", "name": "Emel", "gender": "kadın"},
        {"id": "tr-TR-AhmetNeural", "name": "Ahmet", "gender": "erkek"},
    ],
}
# Her dil için klasör eki → konuşma hızı. Yavaş sürüm, tarayıcıda yavaşlatmak yerine
# konuşmacının kendisinin yavaş konuştuğu ayrı dosyalardır (ses bozulmaz).
VARIANTS = {"de": {"": "+0%", "-slow": "-25%"}, "tr": {"": "+0%"}}
CONCURRENCY = 8


def key(text: str) -> str:
    return hashlib.sha1(text.encode("utf-8")).hexdigest()[:16]


async def make(sem, text, voice, rate, path, stats):
    if path.exists() and path.stat().st_size > 0:
        stats["skip"] += 1
        return
    async with sem:
        for attempt in range(4):
            try:
                tmp = path.with_suffix(".tmp")
                await edge_tts.Communicate(text, voice, rate=rate).save(str(tmp))
                tmp.replace(path)
                stats["new"] += 1
                return
            except Exception as e:  # ağ hatalarında tekrar dene
                if attempt == 3:
                    stats["fail"].append(f"{voice}: {text} ({e})")
                await asyncio.sleep(1 + attempt * 2)


async def main():
    topics = json.loads(TOPICS.read_text(encoding="utf-8"))["topics"]
    texts = {"de": set(), "tr": set()}
    for t in topics:
        for it in t["items"]:
            texts["de"].add(it["de"])
            texts["tr"].add(it["tr"])
    if COURSE.exists():
        for u in json.loads(COURSE.read_text(encoding="utf-8"))["units"]:
            for st in u["steps"]:
                if "explain" in st:
                    texts["tr"].add(st["explain"])
                else:
                    texts["de"].add(st["de"])
                    texts["tr"].add(st["tr"])

    sem = asyncio.Semaphore(CONCURRENCY)
    stats = {"new": 0, "skip": 0, "fail": []}
    jobs = []
    for lang, voices in VOICES.items():
        for v in voices:
            for suffix, rate in VARIANTS[lang].items():
                folder = AUDIO / f"{v['id']}{suffix}"
                folder.mkdir(parents=True, exist_ok=True)
                for text in texts[lang]:
                    jobs.append(make(sem, text, v["id"], rate, folder / f"{key(text)}.mp3", stats))

    total = len(jobs)
    done = 0
    for coro in asyncio.as_completed(jobs):
        await coro
        done += 1
        if done % 100 == 0 or done == total:
            print(f"{done}/{total}", flush=True)

    files = {lang: {text: key(text) for text in sorted(texts[lang])} for lang in texts}
    # Yeni dosya üretildiyse sürüm değişir; uygulama böylece eski önbelleği kullanmaz.
    old = json.loads(INDEX.read_text(encoding="utf-8")).get("version", 0) if INDEX.exists() else 0
    version = int(time.time()) if stats["new"] or not old else old
    INDEX.write_text(json.dumps({"version": version, "voices": VOICES, "slow": ["de"], "files": files}, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"yeni: {stats['new']}, atlanan: {stats['skip']}, hata: {len(stats['fail'])}")
    for f in stats["fail"]:
        print("  HATA", f)
    sys.exit(1 if stats["fail"] else 0)


if __name__ == "__main__":
    asyncio.run(main())
