#!/usr/bin/env python3
"""
ממיר את גיליון השיבוצים של 2026 לנתונים מנורמלים.

הגיליון הוא ייצוא של Google Sheets. לכל חודש גיליון אחד, ובכל גיליון שתי טבלאות
שאינן קשורות זו לזו בקוד, רק בעין:

  1. רשת השיבוצים. עמודה A נושאת את שעות המשמרת, ועמודות B עד F הן ראשון עד
     חמישי. השורות באות בשלשות: שורת תאריכים, שורת משמרת בוקר, שורת משמרת ערב.
     ליד מספר היום מופיעה כוכבית כשיש פעילות בסלון באותו יום, והתא גם נצבע.

  2. רשימת ימי הפעילות, בשתי עמודות שמשתנות ממקומן מחודש לחודש. העמודה שבה
     נמצאת הכותרת "ימים בהם יש פעילות בסלון" נושאת חלל ושעה, או הודעת סגירה,
     והעמודה שלידה נושאת את שם האירוע ואת התאריך בתוך הטקסט.

הכוכבית, הצבע והרשימה הם שלושה עותקים יד ניים של אותה עובדה, ולכן הם נבדקים כאן
אחד מול השני והפערים מדווחים. הסקריפט אינו מכריע ביניהם.

הרצה:
    python3 tools/extract-2026-sheet.py <קובץ.xlsx> <תיקיית יעד>
"""

from __future__ import annotations

import json
import re
import sys
import unicodedata
from calendar import monthrange
from collections import defaultdict
from datetime import date
from pathlib import Path

import openpyxl

YEAR = 2026

MONTHS = {
    "ינואר": 1, "פברואר": 2, "מרץ": 3, "אפריל": 4, "מאי": 5, "יוני": 6,
    "יולי": 7, "אוגוסט": 8, "ספטמבר": 9, "אוקטובר": 10, "נובמבר": 11, "דצמבר": 12,
}

# עמודה B היא ראשון. הגיליון אינו מחזיק שישי ושבת כלל.
WEEKDAY_COLUMNS = {2: "sunday", 3: "monday", 4: "tuesday", 5: "wednesday", 6: "thursday"}

# date.weekday() מחזיר שני כאפס. ראשון הוא שש.
PYTHON_WEEKDAY = {"sunday": 6, "monday": 0, "tuesday": 1, "wednesday": 2, "thursday": 3}

ACTIVITY_HEADER = "ימים בהם יש פעילות"

# טקסט שנכתב בתא שיבוץ ואינו שם של אדם.
CLOSURE_MARKERS = ("סלון סגור", "הסלון סגור", "סגור")

SPACES = {
    "חלל גדול": "large",
    "חלל שקט": "quiet",
    "חלל קטן": "small",
    "משרדים": "offices",
}

TIME_RANGE = re.compile(r"(\d{1,2}:\d{2})\s*[-–]?\s*(\d{1,2}:\d{2})")


def clean(value) -> str:
    """מנרמל תא לטקסט. רווחים כפולים ורווחים בלתי שבירים נפוצים כאן."""
    if value is None:
        return ""
    if isinstance(value, float) and value.is_integer():
        value = int(value)
    text = unicodedata.normalize("NFKC", str(value))
    text = text.replace("‏", "").replace("‎", "")
    return re.sub(r"\s+", " ", text).strip()


def day_number(text: str) -> tuple[int | None, bool]:
    """
    קורא מספר יום מתא תאריך, ואומר אם הוא נושא כוכבית.

    הכוכבית מופיעה גם לפני המספר וגם אחריו, תלוי בחודש.
    """
    if not text:
        return None, False
    starred = "*" in text
    digits = re.sub(r"\D", "", text)
    if not digits:
        return None, starred
    number = int(digits)
    return (number if 1 <= number <= 31 else None), starred


def is_closure(text: str) -> bool:
    return any(marker in text for marker in CLOSURE_MARKERS)


def parse_activity_cell(text: str) -> dict:
    """קורא חלל ושעות מתוך תא כמו 'חלל גדול 19:30-22:00' או 'הסלון סגור מ18:00'."""
    out: dict = {"raw": text, "space": None, "startTime": None, "endTime": None, "closed": False}

    for name, key in SPACES.items():
        if name in text:
            out["space"] = key
            break

    match = TIME_RANGE.search(text)
    if match:
        out["startTime"], out["endTime"] = match.group(1), match.group(2)
    else:
        # 'הסלון סגור מ18:00' נושא שעה אחת, והיא שעת הסגירה.
        single = re.search(r"מ\s?(\d{1,2}:\d{2})", text)
        if single:
            out["closesAt"] = single.group(1)
        else:
            # 'סלון סגור 17:00 00:00' נושא שתי שעות בלי מקף.
            pair = re.findall(r"\d{1,2}:\d{2}", text)
            if len(pair) == 2:
                out["startTime"], out["endTime"] = pair[0], pair[1]

    if is_closure(text):
        out["closed"] = True

    return out


def parse_event_title(text: str, month: int) -> dict:
    """
    מפריד שם אירוע מתאריך. התאריך נכתב בכל הצורות: לפני השם ואחריו, עם רווח
    בתוכו, ולפעמים כטווח ימים.
    """
    out: dict = {"raw": text, "title": text, "days": []}

    # טווח, '27-30.9' או '20-21.09'.
    span = re.search(r"\b(\d{1,2})\s?[-–]\s?(\d{1,2})\s?[.,]\s?0?(\d{1,2})\b", text)
    if span and int(span.group(3)) == month:
        first, last = int(span.group(1)), int(span.group(2))
        if 1 <= first <= last <= 31:
            out["days"] = list(range(first, last + 1))
            out["title"] = clean(text.replace(span.group(0), " "))
            return out

    # יום בודד, '1.1' או '14. 4'. הכוכבית על 0 מכסה '08.10'.
    single = re.search(r"\b(\d{1,2})\s?[.,]\s?0?(\d{1,2})\b", text)
    if single and int(single.group(2)) == month:
        day = int(single.group(1))
        if 1 <= day <= 31:
            out["days"] = [day]
            out["title"] = clean(text.replace(single.group(0), " "))

    return out


def extract(path: Path) -> dict:
    workbook = openpyxl.load_workbook(path, data_only=True)

    assignments: list[dict] = []
    activities: list[dict] = []
    grid_closures: list[dict] = []
    findings: list[dict] = []
    raw_names: dict[str, int] = defaultdict(int)

    for sheet in workbook.worksheets:
        month = MONTHS.get(sheet.title.strip())
        if month is None:
            findings.append({"kind": "unknown_sheet", "sheet": sheet.title})
            continue

        days_in_month = monthrange(YEAR, month)[1]
        starred: set[int] = set()
        listed: set[int] = set()

        # ---- רשת השיבוצים ----
        row = 2
        while row <= sheet.max_row:
            dates_in_row: dict[int, tuple[int, bool]] = {}
            for column in WEEKDAY_COLUMNS:
                number, star = day_number(clean(sheet.cell(row=row, column=column).value))
                if number is not None and number <= days_in_month:
                    dates_in_row[column] = (number, star)

            if not dates_in_row:
                row += 1
                continue

            # שתי השורות שאחרי שורת התאריכים הן שתי המשמרות.
            for offset, shift in ((1, "morning"), (2, "evening")):
                label = clean(sheet.cell(row=row + offset, column=1).value)
                if not TIME_RANGE.search(label):
                    continue
                start, end = TIME_RANGE.search(label).group(1, 2)

                for column, (number, star) in dates_in_row.items():
                    if star:
                        starred.add(number)

                    weekday = WEEKDAY_COLUMNS[column]
                    day = date(YEAR, month, number)
                    if day.weekday() != PYTHON_WEEKDAY[weekday]:
                        findings.append({
                            "kind": "weekday_mismatch", "sheet": sheet.title,
                            "date": day.isoformat(), "columnMeans": weekday,
                            "actual": day.strftime("%A"),
                        })

                    value = clean(sheet.cell(row=row + offset, column=column).value)
                    if not value:
                        continue

                    if is_closure(value):
                        grid_closures.append({
                            "date": day.isoformat(), "shift": shift, "raw": value,
                            "sheet": sheet.title,
                        })
                        continue

                    raw_names[value] += 1
                    assignments.append({
                        "date": day.isoformat(), "shift": shift,
                        "startTime": start, "endTime": end,
                        "rawName": value, "sheet": sheet.title,
                        "activityDayMark": star,
                    })

            row += 3

        # ---- רשימת ימי הפעילות ----
        header_cell = None
        for sheet_row in sheet.iter_rows(min_col=7, max_col=20):
            for cell in sheet_row:
                if ACTIVITY_HEADER in clean(cell.value):
                    header_cell = cell
                    break
            if header_cell:
                break

        if header_cell is None:
            findings.append({"kind": "no_activity_list", "sheet": sheet.title})
        else:
            left, top = header_cell.column, header_cell.row
            for sheet_row in range(top + 1, sheet.max_row + 1):
                when = clean(sheet.cell(row=sheet_row, column=left).value)
                what = clean(sheet.cell(row=sheet_row, column=left + 1).value)
                if not when and not what:
                    continue

                slot = parse_activity_cell(when)
                event = parse_event_title(what, month)

                if not event["days"]:
                    findings.append({
                        "kind": "event_without_date", "sheet": sheet.title,
                        "when": when, "what": what,
                    })

                for day in event["days"]:
                    if day > days_in_month:
                        findings.append({
                            "kind": "day_out_of_month", "sheet": sheet.title,
                            "day": day, "what": what,
                        })
                        continue
                    listed.add(day)
                    activities.append({
                        "date": date(YEAR, month, day).isoformat(),
                        "title": event["title"], "space": slot["space"],
                        "startTime": slot["startTime"], "endTime": slot["endTime"],
                        "closesAt": slot.get("closesAt"), "closed": slot["closed"],
                        "sheet": sheet.title, "rawWhen": when, "rawWhat": what,
                    })

        # ---- הפער בין הכוכבית לרשימה ----
        for day in sorted(starred - listed):
            findings.append({
                "kind": "starred_but_not_listed", "sheet": sheet.title,
                "date": date(YEAR, month, day).isoformat(),
            })
        for day in sorted(listed - starred):
            findings.append({
                "kind": "listed_but_not_starred", "sheet": sheet.title,
                "date": date(YEAR, month, day).isoformat(),
            })

    return {
        "source": path.name,
        "year": YEAR,
        "assignments": sorted(assignments, key=lambda a: (a["date"], a["shift"])),
        "activities": sorted(activities, key=lambda a: (a["date"], a["title"])),
        "gridClosures": sorted(grid_closures, key=lambda c: (c["date"], c["shift"])),
        "rawNames": dict(sorted(raw_names.items(), key=lambda kv: (-kv[1], kv[0]))),
        "findings": findings,
    }


def tokens(name: str) -> list[str]:
    return [token.strip(".") for token in name.split() if token.strip(".")]


def position_of(name: str, token: str) -> str:
    parts = tokens(name)
    if len(parts) == 1:
        return "only"
    if parts[0] == token:
        return "first"
    if parts[-1] == token:
        return "last"
    return "middle"


def name_clusters(raw_names: dict[str, int]) -> list[dict]:
    """
    מדווח אילו שמות גולמיים חולקים חלק שם, כדי שבעל המוצר יכריע מי מי.

    זהו דיווח ולא איחוד, ובכוונה. ניסיון לאחד בפועל נכשל כאן במדידה: אות בודדת
    כמו ה-'ח' ב'משה ח' נקשרת ל'חיים' ול'חגי', ושרשרת אחת כזו גרפה שלושים שמות
    לקבוצה אחת. חלק שם משותף גם אינו מוכיח שמדובר באדם אחד: 'אפרת דוד' ו'אפרת
    פלדמן' חולקות שם פרטי והן שתי נשים, ו'דוד' לבד הוא גם שם פרטי של מי שמופיע
    עשרים פעם וגם שם המשפחה של אפרת.

    לכן כל קבוצה כאן היא חלק שם אחד, והיא נושאת את עוצמת הרמז:
      surname   חלק השם הוא אחרון אצל כולם, וזה הרמז החזק.
      initial   חלק השם מופיע גם כאות בודדת, 'קובי מ.' מול 'קובי מגיד'.
      mixed     אצל אחד ראשון ואצל אחר אחרון, וזה דורש מי שמכיר את האנשים.
      forename  שם פרטי משותף בלבד, וזה הרמז החלש.
    """
    by_token: dict[str, list[str]] = defaultdict(list)
    initials: dict[str, set[str]] = defaultdict(set)

    for name in raw_names:
        for token in tokens(name):
            if len(token) == 1:
                initials[token].add(name)
            else:
                by_token[token].append(name)

    clusters = []
    for token, names in by_token.items():
        # אות בודדת נספרת רק כשהיא יושבת ליד חלק שם שכבר משותף, ולא בפני עצמה.
        carriers = sorted({
            name for name in initials.get(token[0], set())
            if any(part in {other for other in tokens(match)} for match in names for part in tokens(name))
        })
        members = sorted(set(names) | set(carriers), key=lambda n: (-raw_names[n], n))
        if len(members) < 2:
            continue

        positions = {name: position_of(name, token) if token in tokens(name) else "initial" for name in members}
        places = {place for place in positions.values() if place != "initial"}

        if "initial" in positions.values():
            strength = "initial"
        elif places <= {"last"}:
            strength = "surname"
        elif places <= {"first", "only"}:
            strength = "forename"
        else:
            strength = "mixed"

        clusters.append({
            "sharedPart": token,
            "strength": strength,
            "members": [
                {"rawName": name, "count": raw_names[name], "position": positions[name]}
                for name in members
            ],
            "total": sum(raw_names[name] for name in members),
            "decision": None,
        })

    order = {"surname": 0, "initial": 1, "mixed": 2, "forename": 3}
    return sorted(clusters, key=lambda c: (order[c["strength"]], -c["total"]))


def main() -> int:
    if len(sys.argv) != 3:
        print(__doc__)
        return 2

    source, out_dir = Path(sys.argv[1]), Path(sys.argv[2])
    out_dir.mkdir(parents=True, exist_ok=True)

    data = extract(source)
    clusters = name_clusters(data["rawNames"])

    (out_dir / "sheet-2026.json").write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf8"
    )
    (out_dir / "names-to-reconcile.json").write_text(
        json.dumps(clusters, ensure_ascii=False, indent=2) + "\n", encoding="utf8"
    )

    by_kind: dict[str, int] = defaultdict(int)
    for finding in data["findings"]:
        by_kind[finding["kind"]] += 1

    print(f"שיבוצים         {len(data['assignments'])}")
    print(f"ימי פעילות      {len(data['activities'])}")
    print(f"סגירות ברשת     {len(data['gridClosures'])}")
    print(f"שמות גולמיים    {len(data['rawNames'])}")
    print(f"קבוצות להכרעה   {len(clusters)}")
    print("ממצאים:")
    for kind, count in sorted(by_kind.items(), key=lambda kv: -kv[1]):
        print(f"  {count:4d}  {kind}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
