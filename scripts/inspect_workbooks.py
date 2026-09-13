"""Read source workbooks without modifying them; output stays local."""
import json
from pathlib import Path
import openpyxl

root = Path(__file__).resolve().parents[1]
result = []
for path in sorted((root / 'Archivos de excel LCP').glob('*.xlsx')):
    wb = openpyxl.load_workbook(path, data_only=False)
    cached = openpyxl.load_workbook(path, data_only=True)
    sheets = []
    for ws in wb:
        rows = []
        for row in ws:
            cells = [{ 'cell': c.coordinate, 'value': c.value, 'format': c.number_format,
                       'cached': cached[ws.title][c.coordinate].value if c.data_type == 'f' else None }
                     for c in row if c.value is not None]
            if cells:
                rows.append(cells)
        sheets.append({'name': ws.title, 'rows': rows, 'dimensions': ws.calculate_dimension(),
                       'merged': [str(r) for r in ws.merged_cells.ranges]})
    result.append({'file': path.name, 'sheets': sheets})
output = root / 'output' / 'database-discovery'
output.mkdir(parents=True, exist_ok=True)
(output / 'workbooks.json').write_text(json.dumps(result, ensure_ascii=False, indent=2, default=str), encoding='utf-8')
for book in result:
    print(book['file'])
    for sheet in book['sheets']:
        print(sheet['name'], sheet['dimensions'], 'nonempty_rows=', len(sheet['rows']))
        for row in sheet['rows'][:12]:
            print(json.dumps(row, ensure_ascii=False, default=str))
