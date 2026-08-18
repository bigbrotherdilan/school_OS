import markdown
from weasyprint import HTML
import os

with open('Timetable_Algorithm_Explanation.md', 'r', encoding='utf-8') as f:
    md_content = f.read()

html_content = markdown.markdown(md_content, extensions=['tables', 'fenced_code', 'codehilite', 'toc'])

# Add CSS for better PDF rendering
css = '''
<style>
    body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; margin: 2cm; }
    h1 { color: #1a1a2e; border-bottom: 3px solid #4f46e5; padding-bottom: 0.5rem; }
    h2 { color: #3730a3; border-bottom: 1px solid #c7d2fe; padding-bottom: 0.3rem; margin-top: 2rem; }
    h3 { color: #4f46e5; margin-top: 1.5rem; }
    table { border-collapse: collapse; width: 100%; margin: 1rem 0; page-break-inside: avoid; }
    th, td { border: 1px solid #e5e7eb; padding: 0.5rem; text-align: left; }
    th { background-color: #f3f4f6; font-weight: 600; }
    code { background: #f3f4f6; padding: 0.2rem 0.4rem; border-radius: 4px; font-family: 'Consolas', monospace; }
    pre { background: #1f2937; color: #e5e7eb; padding: 1rem; border-radius: 8px; overflow-x: auto; page-break-inside: avoid; }
    pre code { background: none; padding: 0; color: inherit; }
    .page-break { page-break-before: always; }
    ul, ol { margin: 0.5rem 0; padding-left: 2rem; }
    li { margin: 0.25rem 0; }
    blockquote { border-left: 4px solid #4f46e5; padding-left: 1rem; color: #6b7280; margin: 1rem 0; }
</style>
'''

full_html = f'<!DOCTYPE html><html><head><meta charset="utf-8">{css}</head><body>{html_content}</body></html>'

HTML(string=full_html).write_pdf('Timetable_Algorithm_Explanation.pdf')
print('PDF generated successfully!')