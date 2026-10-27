#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Construiește cpt.json din fișierele Geo-Explorer (*.txt) ale penetrărilor statice CPT
executate pentru Parcul eolian Dăeni, jud. Tulcea (25.10 – 10.12.2025), câte un test în centrul fiecărei turbine.

Surse:
  - <folder txt>/*.txt  – export Geo-Explorer 2.0 (antet + tabel Depth/qc/fs/u2/Incl), un fișier per test; se dau
    mai multe foldere (campaniile „1 8 nov 2025”, „15 nov 2025”, „30 nov 2025”, „9 dec 2025”, WT1, WT14 … wt7).
    ID-ul testului = turbina din numele fișierului (1-WT015.txt -> WT15, WT27b.txt -> WT27, wt35nou.txt -> WT35nou).
  - Turbine_Daeni_nov_2025_wt 11.11.2025.kmz – planul turbinelor (WT1–WT56, revizuit 11.11.2025)
  - Situatie lucrari.xlsx – jurnalul campaniei CPT (dată, lungime, GPS realizat în DMS, operator, observații)
  - WT5/WT5 Penetrare Daeni.xlsx – WT5, citiri manuale (vârf / manșon în kN, pas 5 cm; fără fișier Geo-Explorer)

Rulare (din folderul aplicației):
  python3 scripts/build_cpt.py --txt "../1 8 nov 2025" "../15 nov 2025" "../30 nov 2025" "../9 dec 2025" \
      ../WT1 ../WT14 ../WT15 ../WT16 ../WT17 ../WT18 ../WT2 ../WT3 ../WT6 ../WT8 ../WT9 ../wt7 \
      --kmz "../Turbine_Daeni_nov_2025_wt 11.11.2025.kmz" --situatie "../Situatie lucrari.xlsx" \
      --wt5 "../WT5/WT5 Penetrare Daeni.xlsx" --out .

Derivate (Robertson 2009/2010, proceduri uzuale):
  Rf = fs / qc · 100 [%];  con electric fără u2 -> qt = qc
  Ic = sqrt[(3.47 - log Qt)^2 + (log Fr + 1.22)^2], Qt = (qt-σv)/σ'v · (pa/σ'v)^n, n = f(Ic) iterativ
  γ estimat din Ic (Robertson & Cabal 2010); NA din foraje: WT49 24,0 m, WT53 3,5 m, în rest „fără apă”
  (nivel presupus sub adâncimea testului) – indicativ, nu înlocuiește prelucrarea din studiul geotehnic (CPeT-IT).
Seriile complete (pas 1 cm) sunt reduse la pas 5 cm (media pe intervale) în cpt.json; benzile de 1 m și
straturile SBT sunt calculate la rezoluție completă.
"""
import argparse, glob, html, json, math, os, re, datetime, zipfile

A_NET = 0.80      # raport arii (nefolosit la con fără u2)
GW = 9.81
PA = 100.0        # kPa
DZ_OUT = 0.05     # pasul seriilor scrise în cpt.json
GWL_DEFAULT = 60.0  # m – „fără apă” în foraje: nivel presupus sub adâncimea testului
GWL = {'WT49': 24.0, 'WT53': 3.5}  # NA consemnat în fișele forajelor

ZONA = {'N': 'Zona N – WT1–WT23', 'S': 'Zona S – WT24–WT56'}
def zona_of(tid):
    m = re.match(r'WT(\d+)', tid); return 'N' if m and int(m.group(1)) <= 23 else 'S'

# încercările abandonate / reluate (din folderul „raw data daeni si fagarasu\CPT Daeni”), ca notă pe test
RELUARI = {
    'WT1': 'Fișier Geo-Explorer „Wt1c” (a treia încercare în aceeași zi).',
    'WT3': 'Test reluat (fișier WT3c); încercarea WT3b (25.10.2025) a fost abandonată la 0,40 m.',
    'WT7': 'Test reluat (fișier WT7b); prima încercare (WT7, 29.10.2025) abandonată la 0,45 m.',
    'WT9': 'Test reluat (fișier WT9b); prima încercare (WT9) abandonată la 0,08 m. Refuz la 10,25 m (șist).',
    'WT15': 'Fișier Geo-Explorer „WT015”; prima încercare (WT15, 28.10.2025) abandonată la 0,43 m.',
    'WT17': 'Test reluat (fișier WT17b); prima încercare (WT17) abandonată la 0,54 m.',
    'WT23': 'Test reluat (fișier WT23b); prima încercare (WT23, 01.11.2025) abandonată la 4,90 m.',
    'WT27': 'Test reluat (fișier WT27b, 17,26 m); prima încercare (WT27, 05.11.2025) oprită la 10,11 m.',
    'WT39': 'Fișier Geo-Explorer „WT39b”; executat pe poziția revizuită a turbinei (plan 11.11.2025).',
    'WT35nou': 'Al doilea test al turbinei WT35, pe „locația nouă” (fișier „nouwt35”, 09.12.2025); poziția = GPS teren.',
    'WT35': 'Primul test al turbinei WT35, pe poziția din plan (15.11.2025); vezi și WT35nou.',
}
OPERATOR_DEFAULT = None

SBT = {1: 'sensibil, fin', 2: 'organic / turbă', 3: 'argilă – argilă prăfoasă', 4: 'praf argilos – argilă prăfoasă',
       5: 'nisip prăfos – praf nisipos', 6: 'nisip – nisip prăfos', 7: 'nisip îndesat – nisip cu pietriș',
       8: 'nisip foarte îndesat / cimentat', 9: 'fin, foarte rigid (supraconsolidat)'}
SBT_COL = {1: '#B5B5B5', 2: '#8B6B4E', 3: '#A8814D', 4: '#C9A46B', 5: '#E4C27C', 6: '#F3D36B', 7: '#F0B35B', 8: '#D98F3E', 9: '#9C8C78'}


def ic_zone(ic):
    if ic is None: return 0
    if ic > 3.6: return 2
    if ic > 2.95: return 3
    if ic > 2.6: return 4
    if ic > 2.05: return 5
    if ic > 1.31: return 6
    return 7


def parse_txt(path):
    lines = open(path, encoding='latin-1').read().splitlines()
    hdr, di = {}, None
    for i, l in enumerate(lines):
        if l.replace('"', '').strip().startswith('Depth'):
            di = i; break
        m = re.match(r'([A-Za-z .0-9]+?)\s*:\s*(.*)', l)
        if m: hdr[m.group(1).strip()] = m.group(2).strip()
    end = next((re.search(r'End of Test\s*:\s*(\S+)', l).group(1) for l in lines if 'End of Test' in l), None)
    z, qc, fs, u2, inc = [], [], [], [], []
    for l in lines[di + 3:]:
        c = [x.strip() for x in l.replace('"', '').split('\t')]
        if len(c) < 5 or not c[0]: continue
        try:
            zi, q, f = float(c[0]), float(c[1]), float(c[2])
        except ValueError:
            continue
        if z and zi <= z[-1]: continue   # citiri repetate / retrageri
        z.append(zi); qc.append(q); fs.append(f)
        u2.append(None if c[3] in ('Disabled', '') else float(c[3]))
        try:
            inc.append(math.hypot(float(c[4]), float(c[5])))
        except ValueError:
            inc.append(None)
    has_u = any(v is not None for v in u2)
    return hdr, z, qc, fs, (u2 if has_u else None), inc, end


def parse_wt5(path):
    """WT5: citiri manuale (adâncime, manșon [kN], vârf [kN]); con 10 cm², manșon 150 cm²."""
    import openpyxl
    ws = openpyxl.load_workbook(path, read_only=True, data_only=True).worksheets[0]
    rows = [(float(r[2]), float(r[3]), float(r[4])) for r in ws.iter_rows(values_only=True)
            if all(isinstance(r[k], (int, float)) for k in (2, 3, 4))]
    # prima citire e notată „0,6” în loc de 0,05 (greșeală de transcriere); se elimină rândurile cu adâncime descrescătoare
    rows = [r for k, r in enumerate(rows) if k + 1 >= len(rows) or r[0] < rows[k + 1][0]]
    z, qc, fs = [], [], []
    for zi, sleeve, tip in rows:
        if z and zi <= z[-1]: continue
        z.append(round(zi, 2)); qc.append(tip / 0.001 / 1000.0)        # kN / 10 cm² -> MPa
        fs.append(max(sleeve - tip, 0.0) / 0.015)                      # kN / 150 cm² -> kPa
    return z, qc, fs


def derive(z, qc, fs, u2, gwl):
    """Rf, Ic, γ, SBT pe fiecare rând (Robertson 2009, γ din Ic – Robertson & Cabal 2010)."""
    n = len(z)
    rf, ic, zone = [None] * n, [None] * n, [0] * n
    sv = 0.0; zprev = 0.0; gam = 18.0
    for i in range(n):
        qci = max(qc[i], 0.01) * 1000.0  # kPa
        fsi = max(fs[i], 0.0)
        qt = qci + (u2[i] * (1 - A_NET) if (u2 and u2[i] is not None) else 0.0)
        if i > 0 and ic[i - 1] is not None:
            rf_prev = max(rf[i - 1], 0.01)
            gam = GW * (0.27 * math.log10(rf_prev) + 0.36 * math.log10(qt / PA) + 1.236)
            gam = min(max(gam, 15.0), 22.0)
        dz = z[i] - zprev; zprev = z[i]
        sv += gam * dz
        u0 = GW * max(z[i] - gwl, 0.0)
        svp = max(sv - u0, 1.0)
        rfi = fsi / qci * 100.0
        rf[i] = rfi
        if z[i] < 0.05:
            ic[i] = None; continue
        fr = max(fsi / max(qt - sv, 1.0) * 100.0, 0.01)
        nn = 1.0; ici = None
        for _ in range(8):
            Q = max((qt - sv) / PA * (PA / svp) ** nn, 0.01)
            ici = math.sqrt((3.47 - math.log10(Q)) ** 2 + (math.log10(fr) + 1.22) ** 2)
            n_new = min(0.381 * ici + 0.05 * (svp / PA) - 0.15, 1.0)
            if abs(n_new - nn) < 0.01: break
            nn = n_new
        ic[i] = ici; zone[i] = ic_zone(ici)
    return rf, ic, zone


def layers_from_zone(z, zone, min_th=0.40):
    """Zone SBT contigue, apoi fuzionarea straturilor subțiri cu vecinul mai gros."""
    segs = []
    for zi, zo in zip(z, zone):
        if zo == 0: continue
        if segs and segs[-1]['zona'] == zo:
            segs[-1]['la'] = zi
        else:
            segs.append({'de': segs[-1]['la'] if segs else 0.0, 'la': zi, 'zona': zo})
    changed = True
    while changed and len(segs) > 1:
        changed = False
        for k, s in enumerate(segs):
            if s['la'] - s['de'] < min_th:
                nb = []
                if k > 0: nb.append(k - 1)
                if k < len(segs) - 1: nb.append(k + 1)
                j = max(nb, key=lambda q: segs[q]['la'] - segs[q]['de'])
                lo, hi = (j, k) if j < k else (k, j)
                segs[lo]['la'] = segs[hi]['la']; segs[lo]['zona'] = segs[j]['zona']
                del segs[hi]; changed = True; break
    out = []
    for s in segs:
        if out and out[-1]['zona'] == s['zona']: out[-1]['la'] = s['la']
        else: out.append(dict(s))
    for s in out:
        s['de'] = round(s['de'], 2); s['la'] = round(s['la'], 2); s['sbt'] = SBT[s['zona']]; s['culoare'] = SBT_COL[s['zona']]
    return out


def stats(z, qc, fs, rf, ic, de, la):
    idx = [i for i in range(len(z)) if de <= z[i] < la]
    if not idx: return None
    q = [qc[i] for i in idx]; f = [fs[i] for i in idx]; r = [rf[i] for i in idx]; c = [ic[i] for i in idx if ic[i] is not None]
    return {'de': de, 'la': round(la, 2), 'qc_med': round(sum(q) / len(q), 2), 'qc_min': round(min(q), 2), 'qc_max': round(max(q), 2),
            'fs_med': round(sum(f) / len(f), 1), 'Rf_med': round(sum(r) / len(r), 2),
            'Ic_med': round(sum(c) / len(c), 2) if c else None}


def decimate(z, series, dz=DZ_OUT):
    """Media pe intervale de dz (serie None-safe); returnează z_out și listele reduse."""
    nb = int(math.ceil(z[-1] / dz + 1e-9))
    zo = [round((k + 1) * dz, 2) for k in range(nb)]
    out = [[None] * nb for _ in series]
    buckets = [[[] for _ in range(nb)] for _ in series]
    for i, zi in enumerate(z):
        k = min(nb - 1, max(0, int(math.ceil(zi / dz - 1e-9)) - 1))
        for s, ser in enumerate(series):
            if ser is not None and ser[i] is not None: buckets[s][k].append(ser[i])
    for s in range(len(series)):
        if series[s] is None: out[s] = None; continue
        for k in range(nb):
            b = buckets[s][k]
            out[s][k] = (sum(b) / len(b)) if b else None
    return zo, out


def norm_date(s):
    m = re.match(r'(\d{2})[-.](\d{2})[-.](\d{4})', s or '')
    return f'{m.group(3)}-{m.group(2)}-{m.group(1)}' if m else None


def read_kmz(path):
    """Placemark-urile din KMZ/KML: nume -> (lat, lon)."""
    if path.lower().endswith('.kmz'):
        with zipfile.ZipFile(path) as zf:
            s = zf.read(next(n for n in zf.namelist() if n.lower().endswith('.kml'))).decode('utf-8')
    else:
        s = open(path, encoding='utf-8').read()
    out = {}
    for p in re.findall(r'<Placemark>(.*?)</Placemark>', s, re.S):
        n = html.unescape(re.search(r'<name>(.*?)</name>', p, re.S).group(1).strip())
        c = re.search(r'<coordinates>(.*?)</coordinates>', p, re.S)
        if not c: continue
        x = c.group(1).split()[0].split(',')
        out[n] = (round(float(x[1]), 7), round(float(x[0]), 7))
    return out


def dms(s):
    m = re.match(r'\s*(\d+)°\s*(\d+)\'\s*([\d.]+)"?\s*([NSEV])?', str(s or ''))
    if not m: return None
    v = int(m.group(1)) + int(m.group(2)) / 60 + float(m.group(3)) / 3600
    return round(v, 7)


def read_situatie(path):
    """Situatie lucrari.xlsx: WT -> {data, lungime, lat, lon (realizat), operator, obs}."""
    import openpyxl
    ws = openpyxl.load_workbook(path, read_only=True, data_only=True).worksheets[0]
    out = {}
    for r in ws.iter_rows(values_only=True):
        if not r or not isinstance(r[0], str) or not re.match(r'(WT|FGR)\d', r[0].strip()): continue
        k = r[0].strip().replace('WT3nou', 'WT35nou')
        out[k] = {'data': norm_date(str(r[4]) if r[4] else ''), 'lungime': r[3] if isinstance(r[3], (int, float)) else None,
                  'lat': dms(r[5]), 'lon': dms(r[6]), 'operator': (str(r[7]).strip().title() if r[7] else None),
                  'obs': ' · '.join(str(x).strip() for x in r[8:13] if x and str(x).strip())}
    return out


def dist(a, b):
    R = 6371000; t = math.pi / 180; dl = (b[0] - a[0]) * t; dn = (b[1] - a[1]) * t
    h = math.sin(dl / 2) ** 2 + math.cos(a[0] * t) * math.cos(b[0] * t) * math.sin(dn / 2) ** 2
    return 2 * R * math.asin(math.sqrt(h))


def id_from_name(name):
    """1-WT015.txt -> WT15; WT27b.txt -> WT27; wt35nou.txt -> WT35nou; WT1.txt (Wt1c) -> WT1."""
    s = re.sub(r'\.(txt|csv)$', '', os.path.basename(name), flags=re.I)
    s = re.sub(r'^1-', '', s).upper()
    m = re.match(r'(WT)0*(\d+)(NOU|[A-Z])?$', s)
    if not m: return None
    return f'WT{int(m.group(2))}' + ('nou' if m.group(3) == 'NOU' else '')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--txt', nargs='+', required=True); ap.add_argument('--kmz', required=True); ap.add_argument('--situatie', required=True)
    ap.add_argument('--wt5', default=None); ap.add_argument('--out', required=True)
    a = ap.parse_args()
    plan = read_kmz(a.kmz)
    sit = read_situatie(a.situatie)
    try:
        from pyproj import Transformer
        to_st = Transformer.from_crs('EPSG:4326', 'EPSG:3844', always_xy=True)
    except Exception:
        to_st = None

    files = {}
    for d in a.txt:
        for f in sorted(glob.glob(os.path.join(d, '*'))):
            if not re.search(r'\.txt$', f, re.I): continue
            tid = id_from_name(f)
            if not tid: print('! fișier ignorat', f); continue
            if tid in files:   # două fișiere pentru aceeași turbină (ex. WT3b abandonat + WT3c): se păstrează cel mai mare
                keep = max(files[tid], f, key=os.path.getsize); print('! dublură', tid, '-> păstrat', os.path.basename(keep)); files[tid] = keep; continue
            files[tid] = f

    tests = []
    def add_test(tid, fisier, hdr, z, qc, fs, u2, inc, end, manual=False):
        turb = tid.replace('nou', '')
        gwl = GWL.get(turb, GWL_DEFAULT)
        rf, ic, zone = derive(z, qc, fs, u2, gwl)
        note = []
        if RELUARI.get(tid): note.append(RELUARI[tid])
        if manual: note.append('Citiri manuale (vârf și manșon, kN) la pas de 5 cm, transcrise din „WT5 Penetrare Daeni.xlsx”; fără fișier Geo-Explorer.')
        depth = z[-1]
        s = sit.get(tid, {})
        if depth < 20: note.append(f'Test oprit la {depth:.2f} m (refuz la penetrare).'.replace('.', ',', 1))
        if s.get('obs'): note.append('Observație de teren: ' + s['obs'] + '.')
        # poziție: planul turbinei (KMZ 11.11.2025); WT35nou doar din GPS-ul de teren
        lat = lon = None; src = ''
        pl = plan.get(turb)
        if tid.endswith('nou') or pl is None:
            if s.get('lat') is not None: lat, lon = s['lat'], s['lon']; src = 'GPS teren (jurnalul campaniei CPT)'
        else:
            lat, lon = pl; src = 'poziția turbinei din plan (KMZ 11.11.2025)'
            if s.get('lat') is not None and dist((s['lat'], s['lon']), pl) < 60:
                lat, lon = s['lat'], s['lon']; src = 'GPS teren (jurnalul campaniei CPT)'
        st = None
        if to_st and lat is not None:
            E, N = to_st.transform(lon, lat); st = {'E': round(E, 2), 'N': round(N, 2)}
        band = [stats(z, qc, fs, rf, ic, d, min(d + 1.0, depth + 1e-9)) for d in range(0, int(math.ceil(depth)))]
        band = [b for b in band if b]
        allq = qc[5:] if len(qc) > 10 else qc
        zo, (qc_o, fs_o, u2_o, rf_o, ic_o) = decimate(z, [qc, fs, u2, rf, ic])
        data = norm_date(hdr.get('Date')) or s.get('data')
        tests.append({
            'id': tid, 'tip': 'CPTu' if u2 else 'CPT', 'grup': turb, 'nr': 2 if tid.endswith('nou') else 1, 'turbina': turb, 'zona': zona_of(turb),
            'fisier': os.path.basename(fisier), 'test_nr': hdr.get('TestNumber') or ('citiri manuale' if manual else ''),
            'con': hdr.get('ConeNumber') or ('con mecanic (citiri manuale)' if manual else None),
            'con_tip': 'piezocon (con electric cu filtru u2)' if u2 else ('con cu citiri manuale' if manual else 'con electric (10 cm²)'),
            'data': data, 'ora_start': hdr.get('Time Start'), 'ora_final': end, 'operator': hdr.get('Operator') or s.get('operator'),
            'adancime': round(depth, 2), 'pre_drill': float(hdr.get('Pre Drill') or 0),
            'lat': lat, 'lon': lon, 'stereo70': st, 'coord_sursa': src, 'nota': ' '.join(note) or None,
            'gwl': gwl if gwl < 50 else None, 'manual': manual,
            'sumar': {'qc_med': round(sum(allq) / len(allq), 2), 'qc_max': round(max(allq), 2), 'qc_min': round(min(allq), 2),
                      'fs_med': round(sum(fs[5:]) / len(fs[5:]), 1) if len(fs) > 10 else round(sum(fs) / len(fs), 1),
                      'Rf_med': round(sum(rf[5:]) / len(rf[5:]), 2) if len(rf) > 10 else round(sum(rf) / len(rf), 2),
                      'u2_max': round(max(v for v in u2 if v is not None), 1) if u2 else None,
                      'incl_max': round(max(v for v in inc if v is not None), 1) if any(v is not None for v in inc) else None,
                      'n_puncte': len(z)},
            'straturi_sbt': layers_from_zone(z, zone),
            'benzi_1m': band,
            'dz': DZ_OUT, 'z0': zo[0],
            'z': zo,
            'qc': [None if v is None else round(v, 2) for v in qc_o], 'fs': [None if v is None else round(v, 1) for v in fs_o],
            'u2': ([None if v is None else round(v, 1) for v in u2_o] if u2_o else None),
            'Rf': [None if v is None else round(v, 2) for v in rf_o], 'Ic': [None if v is None else round(v, 2) for v in ic_o],
        })
        print(tid, tests[-1]['data'], depth, 'qc_med', tests[-1]['sumar']['qc_med'], 'straturi', len(tests[-1]['straturi_sbt']), '|', src)

    for tid, f in files.items():
        hdr, z, qc, fs, u2, inc, end = parse_txt(f)
        add_test(tid, f, hdr, z, qc, fs, u2, inc, end)
    if a.wt5 and os.path.exists(a.wt5):
        z, qc, fs = parse_wt5(a.wt5)
        add_test('WT5', a.wt5, {}, z, qc, fs, None, [None] * len(z), None, manual=True)

    tests.sort(key=lambda t: (int(re.sub(r'\D', '', t['turbina'])), t['nr']))
    out = {
        'meta': {'generat': datetime.date.today().isoformat(), 'nr': len(tests),
                 'nr_cptu': sum(1 for t in tests if t['tip'] == 'CPTu'),
                 'nr_turbine': len({t['turbina'] for t in tests}),
                 'ml': round(sum(t['adancime'] for t in tests), 2),
                 'perioada': {'de_la': min(t['data'] for t in tests if t['data']), 'pana_la': max(t['data'] for t in tests if t['data'])},
                 'echipament': 'Geo-Explorer v2.0 (Geomil); con electric S10-CFI.2030 (10 cm²), fără măsurarea presiunii apei (u2)',
                 'ipoteze': f'Ic după Robertson (2009), γ estimat din Ic (Robertson & Cabal 2010), qt = qc (con fără u2); '
                            f'apă subterană din foraje: WT49 NA 24,0 m, WT53 NA 3,5 m, în rest „fără apă” (nivel presupus sub adâncimea testului). '
                            f'Interpretare indicativă – nu înlocuiește prelucrarea din studiul geotehnic (CPeT-IT, „Turbine Daeni rev 7.cpt”).',
                 'dz': DZ_OUT, 'sbt': SBT, 'sbt_culori': SBT_COL, 'zone': ZONA},
        'teste': tests,
    }
    os.makedirs(a.out, exist_ok=True)
    with open(os.path.join(a.out, 'cpt.json'), 'w', encoding='utf-8') as fh:
        json.dump(out, fh, ensure_ascii=False, separators=(',', ':'))
    print('scris cpt.json', len(tests), 'teste', os.path.getsize(os.path.join(a.out, 'cpt.json')) // 1024, 'kB',
          'perioada', out['meta']['perioada'], 'ml', out['meta']['ml'])


if __name__ == '__main__':
    main()
