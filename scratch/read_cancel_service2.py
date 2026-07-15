with open(r"c:\Users\USER\Desktop\finsty\finsty-apis\src\modules\order\order.service.ts", "r", encoding="utf-8") as f:
    content = f.read()

lines = content.splitlines()
for idx in range(800, 860):
    if idx < len(lines):
        line = lines[idx]
        print(f"{idx+1}: {line.encode('ascii', errors='replace').decode('ascii')}")
