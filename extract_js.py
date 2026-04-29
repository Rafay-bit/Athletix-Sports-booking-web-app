import re

with open('public/index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Extract script
script_match = re.search(r'<script>(.*?)</script>', html, flags=re.DOTALL)
if script_match:
    script_content = script_match.group(1)
    with open('public/js/app.js', 'w', encoding='utf-8') as f:
        f.write(script_content)
    html = re.sub(r'<script>.*?</script>', '<script src="/js/app.js"></script>', html, flags=re.DOTALL)

# Add CSS link
if '</title>' in html:
    html = html.replace('</title>', '</title>\n  <link rel="stylesheet" href="/css/style.css">')

with open('public/index.html', 'w', encoding='utf-8') as f:
    f.write(html)
