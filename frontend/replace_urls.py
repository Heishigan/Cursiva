import os, re

frontend_dir = r'C:\Users\Heishigan\Desktop\Cursiva\frontend\src'

for root, dirs, files in os.walk(frontend_dir):
    for f in files:
        if not f.endswith(('.ts', '.tsx')): continue
        path = os.path.join(root, f)
        with open(path, 'r', encoding='utf-8') as file:
            content = file.read()
        
        # Replace 'http://localhost:8000' and "http://localhost:8000"
        content = re.sub(r'[\'\"]http://localhost:8000(/.*?)[\'\"]', r'`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}\1`', content)
        # Replace `http://localhost:8000/...`
        content = re.sub(r'\`http://localhost:8000(/.*?)\`', r'`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}\1`', content)
        
        with open(path, 'w', encoding='utf-8') as file:
            file.write(content)
print('Done replacement')
