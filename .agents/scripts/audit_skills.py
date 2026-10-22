"""Comprueba el inventario y las rutas locales de descubrimiento de skills."""
import json
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT / '.agents/skills'
errors = []
lock = json.loads((ROOT / 'skills-lock.json').read_text())['skills']
installed = {p.parent.name: p for p in BASE.glob('*/SKILL.md')}
if set(lock) != set(installed):
    errors.append(f'Diferencias entre instalación y lock: {sorted(set(lock) ^ set(installed))}')
index = (BASE / 'README.md').read_text()
catalog = re.findall(r'^\| \[[^\]]+\]\(([^/()]+)/SKILL\.md\)', index, re.M)
if set(catalog) != set(installed):
    errors.append(f'Diferencias entre catálogo e instalación: {sorted(set(catalog) ^ set(installed))}')
for name in set(catalog):
    if catalog.count(name) != 1:
        errors.append(f'{name}: entrada duplicada en el catálogo')
if f'**{len(installed)} skills principales**' not in index:
    errors.append('El total declarado en el catálogo no coincide con la instalación')
for name, path in sorted(installed.items()):
    body = path.read_text()
    if not re.match(r'\A---\r?\n', body):
        errors.append(f'{name}: falta cabecera YAML')
        continue
    header = body.split('---', 2)[1]
    if not re.search(rf'^name:\s*[\"\']?{re.escape(name)}[\"\']?\s*$', header, re.M):
        errors.append(f'{name}: nombre inconsistente')
    if not re.search(r'^description:\s*\S', header, re.M):
        errors.append(f'{name}: falta descripción')
    if f']({name}/SKILL.md)' not in index:
        errors.append(f'{name}: falta enlace en el índice')
    for item in path.parent.rglob('*'):
        if item.is_symlink() and not item.exists():
            errors.append(f'Enlace simbólico roto: {item.relative_to(ROOT)}')
        elif item.is_file():
            try:
                with item.open('rb') as stream:
                    stream.read(1)
            except OSError as exc:
                errors.append(f'Archivo inaccesible: {item.relative_to(ROOT)}: {exc}')
# Comprueba los enlaces de los documentos propios, sin interpretar ejemplos de terceros.
docs = ['README.md', 'AGENTS.md', 'CLAUDE.md', 'GEMINI.md',
        '.github/copilot-instructions.md', '.agents/README.md',
        '.agents/context/README.md', '.agents/skills/README.md',
        '.agents/context/skills-audit.md', '.agents/specs/README.md',
        '.agents/decisions/README.md', '.agents/references/README.md']
for relative in docs:
    path = ROOT / relative
    if not path.is_file():
        errors.append(f'Documento de contexto ausente: {relative}')
        continue
    for target in re.findall(r'\]\(([^)]+)\)', path.read_text()):
        if '://' in target or target.startswith('#'):
            continue
        if not (path.parent / target.split('#')[0]).exists():
            errors.append(f'{relative}: enlace roto a {target}')
for relative, target in [('README.md', 'AGENTS.md'),
                         ('AGENTS.md', '.agents/README.md'),
                         ('.agents/README.md', 'skills/README.md'),
                         ('CLAUDE.md', 'AGENTS.md'), ('GEMINI.md', 'AGENTS.md'),
                         ('.github/copilot-instructions.md', '../AGENTS.md'),
                         ('AGENTS.md', '.agents/skills/README.md')]:
    if not (ROOT / relative).is_file() or f']({target})' not in (ROOT / relative).read_text():
        errors.append(f'{relative}: falta ruta común a {target}')
nested = [str(p.relative_to(ROOT)) for p in BASE.rglob('SKILL.md') if p not in installed.values()]
for error in errors:
    print(f'ERROR: {error}')
print(f'Skills principales: {len(installed)}; entradas del lock: {len(lock)}; errores: {len(errors)}')
print(f'SKILL.md auxiliares anidados: {len(nested)}')
for path in nested:
    print(f'  {path}')
sys.exit(bool(errors))
