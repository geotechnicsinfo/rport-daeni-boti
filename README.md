# Investigații de teren – Parc eolian Dăeni (jud. Tulcea)

Aplicație web statică (fără backend) pentru raportarea investigațiilor geotehnice de teren executate pentru
fundațiile turbinelor eoliene WT1–WT56 ale Parcului eolian Dăeni (UAT Dăeni, jud. Tulcea; beneficiar SC OXIGEN DELTA SRL,
antreprenor ARVADA SRL; studiu geotehnic GEO-TECH SRL Gheorgheni, 25.02.2026):

- **foraje geotehnice cu SPT** – 56 foraje × 30 m (6 oprite în șist verde la 11–28 m), în centrul fiecărei turbine,
  executate de GEO-TECH SRL; 328 probe încercate în laborator (317 netulburate), 865 încercări SPT;
- **penetrări statice CPT** – 56 teste (55 turbine; WT35 are două – poziția din plan și locația nouă; WT54 neexecutat),
  25.10 – 09.12.2025, 1 345 m, con electric Geo-Explorer (fără u<sub>2</sub>), executate de BBCGEOTEHNIC SRL; WT5 din citiri manuale;
- **încercări de laborator** (GEO-TECH) – granulometrie, limite Atterberg, caracteristici de stare, edometru (ε<sub>p2</sub>, i<sub>m3</sub>), forfecare.

Pentru fiecare foraj: stratificația transcrisă cu coloană litologică, profilul de plasticitate (w, w<sub>P</sub>–w<sub>L</sub>, I<sub>C</sub>),
profilul N<sub>SPT</sub>, q<sub>c</sub> + SBT ale CPT-ului turbinei la aceeași scară de adâncime, tabelul rezultatelor de laborator,
poziția în diagrama Casagrande, apa consemnată în fișă, cota RNMN, Stereo 70 → WGS84, mini-hartă, fotografiile de teren.
Pentru fiecare CPT: q<sub>c</sub>, f<sub>s</sub>, R<sub>f</sub>, I<sub>c</sub> cu straturile SBT (Robertson), benzi de 1 m,
coloana litologică a forajului turbinei, meteo în ziua execuției, mini-hartă, fotografii.

Plus: intro 3D (bloc de teren EU-DEM 25 m, ~14 × 12 km, forajele și tijele CPT „extrase” în ordinea execuției), hartă interactivă,
stadiu de execuție pe zone (N = WT1–WT23, S = WT24–WT56), laborator (Casagrande + centralizator + CSV), galerie de zonă (WT41–WT42),
calendar + meteo, centralizatoare foraje / CPT / SPT + CSV.

## Structura

```
index.html            aplicația (HTML + CSS + JS, un singur fișier)
intro3d.js            intro 3D (Three.js r128)
data.json             foraje + laborator + SPT + sumar CPT + stadiu + meteo + galerii (generat)
cpt.json              datele complete CPT, pas 5 cm (medii pe interval; generat, ~0,9 MB, încărcat la cerere)
terrain.json          grilă de cote EU-DEM 25 m (28×28, OpenTopoData) pentru intro-ul 3D
photos/<ID>/          poze de teren pe turbină (01.jpg… + t_*.jpg), photos/zona/ = galeria de zonă (generate)
scripts/build_cpt.py  parser Geo-Explorer (+ WT5 manual) -> cpt.json (Rf, Ic, SBT, benzi de 1 m, poziții)
scripts/build_data.py generatorul data.json (fișe + plan + cpt.json + meteo + poze)
scripts/foraje_wgs84.json      cache Stereo 70 -> WGS84 (pentru rulare fără pyproj)
scripts/meteo.json    răspunsul Open-Meteo (archive) pentru 24.10–11.12.2025
```

## Surse de date (Google Drive office.geotehnica, `Work\2025\Daeni CPT`)

- Fișe foraje (formatate, o foaie per foraj, cu laborator și SPT, GEO-TECH SRL): `De la ei fise\Fise Daeni +rezultate lab (WT1-WT56).xlsx`
  (versiunea curată; „de lucru” și „text revizuit+e3” sunt variante).
- CPT: `1 8 nov 2025\`, `15 nov 2025\`, `30 nov 2025\`, `9 dec 2025\` și `WT1`, `WT14`, `WT15`, `WT16`, `WT17`, `WT18`, `WT2`, `WT3`,
  `WT6`, `WT8`, `WT9`, `wt7` (export Geo-Explorer 2.0, pas 1 cm; ID = turbina din numele fișierului); `WT5\WT5 Penetrare Daeni.xlsx` (citiri manuale).
  Încercările abandonate sunt în `raw data daeni si fagarasu\CPT Daeni\` (csv) – doar ca note. `Braila\`, `*Fagarasu Nou*` și FGR* nu țin de Dăeni.
- Plan turbine: `Turbine_Daeni_nov_2025_wt 11.11.2025.kmz` (revizuit; WT39 mutat 884 m, WT35 147 m, WT40 74 m față de planul din octombrie).
- Jurnalul campaniei CPT: `Situatie lucrari.xlsx` (dată, lungime, GPS realizat, operator, observații).
- Poze: `Poze\<ID>\` (WhatsApp, campania CPT; `WT015`, `WT7b`, `WT9b`, `WT17b`, `WT35nou` -> turbina respectivă), `Poze\ZONA WT41 WT42 CEA MAI INALTA` -> galeria de zonă.

## Regenerarea datelor

```bash
cd raport-investigatii-daeni
python3 scripts/build_cpt.py --txt "../1 8 nov 2025" "../15 nov 2025" "../30 nov 2025" "../9 dec 2025" \
  ../WT1 ../WT14 ../WT15 ../WT16 ../WT17 ../WT18 ../WT2 ../WT3 ../WT6 ../WT8 ../WT9 ../wt7 \
  --kmz "../Turbine_Daeni_nov_2025_wt 11.11.2025.kmz" --situatie "../Situatie lucrari.xlsx" \
  --wt5 "../WT5/WT5 Penetrare Daeni.xlsx" --out .
python3 scripts/build_data.py --fise "../De la ei fise/Fise Daeni +rezultate lab (WT1-WT56).xlsx" \
  --kmz "../Turbine_Daeni_nov_2025_wt 11.11.2025.kmz" --cpt cpt.json --meteo scripts/meteo.json --poze "../Poze" --out .
```

Necesită `openpyxl` (+ `Pillow` pentru poze, `pyproj` pentru conversia Stereo 70 → WGS84; fără pyproj se folosește
cache-ul `scripts/foraje_wgs84.json`). Zile noi de meteo: Open-Meteo archive, `latitude=44.83&longitude=28.17`, aceleași variabile `daily`, în `scripts/meteo.json`.

## Observații asupra datelor

- Fișele forajelor nu conțin data execuției – toate forajele apar cu „dată necompletată” (fără meteo); în intro-ul 3D
  forajul este extras imediat după CPT-ul turbinei sale. Coordonatele forajelor = antetul fișelor (Stereo 70, „x” = est, „y” = nord),
  identice cu planul turbinelor (WT56: fișa la ~48 m de planul revizuit).
- Foraje oprite în șist verde: WT1 (25 m), WT3 (20), WT6 (22,5), WT9 (11), WT15 (28), WT55 (21). Apă: WT49 (≈24–25 m), WT53 (NA 3,5–4,5 m),
  WT54 (infiltrații 12–16 m), WT10–WT13, WT20 (infiltrații fără adâncime); în rest „fără apă”.
- CPT: poziția = GPS teren din jurnal (când e la < 60 m de plan), altfel planul (WT45 – GPS copiat greșit de la WT44). Teste reluate (prima
  încercare abandonată): WT3 (3c), WT7 (7b), WT9 (9b, refuz 10,25 m), WT15 (015), WT17 (17b, 20,6 m), WT23 (23b), WT27 (27b, 17,3 m); WT39b pe
  poziția revizuită. **WT35**: testul din 15.11.2025 pe poziția din plan și „WT35nou” (09.12.2025) pe locația nouă (44,8395 / 28,1646, 2,5 km NNE);
  fișa „35-nou” păstrează în antet coordonatele inițiale. Oprite sub 20 m: WT3, WT9, WT27, WT30 (10,4 m, rocă), WT53 (16,8 m), WT55 (19,0 m).
- I<sub>c</sub>/SBT: Robertson (2009), γ din I<sub>c</sub> (Robertson & Cabal 2010), q<sub>t</sub> = q<sub>c</sub> (fără u<sub>2</sub>); NA din foraje
  numai la WT49 (24,0 m) și WT53 (3,5 m) – indicativ; prelucrarea oficială este în CPeT-IT (`Turbine Daeni rev 7.cpt`).
- Intro 3D: relief ×5, investigații ×22, CPT-ul fiecărei turbine desenat schematic la 170 m est de foraj (în realitate același punct).

## Rulare locală / publicare

```bash
python -m http.server 8000     # apoi http://localhost:8000
```

Publicare: repo GitHub `geotechnicsinfo/rport-daeni-boti` → https://geotechnicsinfo.github.io/rport-daeni-boti/, Settings → Pages → Source: *GitHub Actions*;
workflow-ul `.github/workflows/pages.yml` publică la fiecare push pe `main`.
