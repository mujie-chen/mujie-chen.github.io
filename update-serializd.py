import json
from urllib.parse import urlencode
from urllib.request import Request, urlopen

USERNAME = "mujiechen"
LIMIT = 8
TARGETS = ["ALL", "all", "SHOW", "show", "EPISODE", "episode", "SEASON", "season"]
PAGES = [1, 0, 2]


def request_diary(page: int, include_target: str):
    query = urlencode({"page": page, "include_target": include_target})
    url = f"https://www.serializd.com/api/user/{USERNAME}/diary?{query}"
    headers = {
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
        "DNT": "1",
        "Referer": f"https://www.serializd.com/user/{USERNAME}/diary",
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-origin",
        "User-Agent": "Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Mobile Safari/537.36",
        "X-Requested-With": "serializd_vercel",
    }
    req = Request(url, headers=headers)
    with urlopen(req, timeout=30) as rsp:
        return json.loads(rsp.read().decode("utf-8", "ignore"))


def poster_url(review: dict) -> str:
    image_path = review.get("showBannerImage") or ""
    if not image_path:
        for season in review.get("showSeasons") or []:
            if season and season.get("id") == review.get("seasonId"):
                image_path = season.get("posterPath") or ""
                break

    if not image_path:
        return ""
    if image_path.startswith("http://") or image_path.startswith("https://"):
        return image_path
    return f"https://image.tmdb.org/t/p/w342{image_path}"


def season_name(review: dict) -> str:
    for season in review.get("showSeasons") or []:
        if season and season.get("id") == review.get("seasonId"):
            return season.get("name") or ""
    return review.get("seasonName") or ""


def rating_label(rating):
    if not isinstance(rating, (int, float)) or rating <= 0:
        return ""
    return f"{rating / 2:.1f}★"


def normalize(reviews):
    items = []
    seen = set()
    for review in reviews or []:
        show_id = review.get("showId") or 0
        season_id = review.get("seasonId") or 0
        key = f"{show_id}-{season_id}"
        if key in seen:
            continue
        seen.add(key)

        title_base = review.get("showName") or "Untitled"
        season = season_name(review)
        title = f"{title_base}, {season}" if season else title_base
        image = poster_url(review)
        review_id = review.get("id")

        if not image or not review_id:
            continue

        items.append(
            {
                "id": review_id,
                "title": title,
                "rating": rating_label(review.get("rating")),
                "image": image,
                "link": f"https://www.serializd.com/review/{review_id}",
            }
        )

        if len(items) >= LIMIT:
            break

    return items


def main():
    items = []
    chosen = None
    for page in PAGES:
        for target in TARGETS:
            try:
                payload = request_diary(page, target)
                reviews = payload.get("reviews") if isinstance(payload, dict) else []
                items = normalize(reviews)
                if items:
                    chosen = (page, target)
                    break
            except Exception:
                continue
        if items:
            break

    with open("serializd.json", "w", encoding="utf-8") as f:
        json.dump(items, f, indent=2)
        f.write("\n")

    if chosen:
        print(f"Wrote {len(items)} entries to serializd.json using page={chosen[0]} include_target={chosen[1]}")
    else:
        print("Wrote 0 entries to serializd.json (no diary items found)")


if __name__ == "__main__":
    main()
