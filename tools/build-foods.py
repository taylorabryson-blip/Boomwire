"""
Builds src/data/foods/usda-sr-legacy.json from USDA FoodData Central SR Legacy
(April 2018 release, public domain / CC0).
Source: https://fdc.nal.usda.gov/download-datasets.html
Values are per 100 g, exactly as published. Nothing is estimated or invented.

Row format: [fdcId, description, categoryIndex, kcal, protein, carbs, fat, fiber, sugars, sodium_mg, satfat, portions]
  portions: [[label, grams], ...] from USDA household measures.
Usage: python3 tools/build-foods.py <FoodData_Central_sr_legacy_food_json_2018-04.json> <out.json>
"""
import json, sys
src, out = sys.argv[1], sys.argv[2]
foods = json.load(open(src))['SRLegacyFoods']
IDS = {'kcal': 1008, 'protein': 1003, 'carbs': 1005, 'fat': 1004, 'fiber': 1079, 'sugars': 2000, 'sodium': 1093, 'satfat': 1258}
EXCLUDE_CATS = {'American Indian/Alaska Native Foods', 'Baby Foods'}
cats, rows = [], []
def r(x, d=1): return None if x is None else round(float(x), d)
for f in foods:
    cat = (f.get('foodCategory') or {}).get('description', 'Other')
    if cat in EXCLUDE_CATS: continue
    n = {x['nutrient']['id']: x.get('amount') for x in f.get('foodNutrients', []) if 'nutrient' in x}
    kcal = n.get(IDS['kcal'])
    if kcal is None:  # some rows only report kJ (1062)
        kj = n.get(1062); kcal = kj / 4.184 if kj is not None else None
    if kcal is None or n.get(IDS['protein']) is None or n.get(IDS['fat']) is None or n.get(IDS['carbs']) is None: continue
    portions = []
    for p in f.get('foodPortions', []):
        g = p.get('gramWeight'); amt = p.get('amount') or 1
        desc = (p.get('modifier') or p.get('portionDescription') or '').strip()
        unit = ((p.get('measureUnit') or {}).get('name') or '').strip()
        if unit and unit != 'undetermined': desc = f'{unit} {desc}'.strip()
        if not g or not desc: continue
        label = f'{amt:g} {desc}'.strip()
        portions.append([label[:48], r(g, 1)])
    if cat not in cats: cats.append(cat)
    rows.append([f['fdcId'], f['description'], cats.index(cat), r(kcal, 0), r(n.get(IDS['protein'])), r(n.get(IDS['carbs'])), r(n.get(IDS['fat'])),
                 r(n.get(IDS['fiber'])), r(n.get(IDS['sugars'])), r(n.get(IDS['sodium']), 0), r(n.get(IDS['satfat'])), portions[:6]])
json.dump({'source': 'USDA FoodData Central, SR Legacy (April 2018). Public domain (CC0).', 'per': '100 g', 'categories': cats, 'foods': rows}, open(out, 'w'), separators=(',', ':'))
print(len(rows), 'foods,', len(cats), 'categories')
