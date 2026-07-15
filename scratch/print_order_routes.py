with open(r"c:\Users\USER\Desktop\finsty\finsty-apis\src\modules\order\order.routes.ts", "r", encoding="utf-8") as f:
    content = f.read()

lines = content.splitlines()
for idx, line in enumerate(lines):
    print(f"{idx+1}: {line.encode('ascii', errors='replace').decode('ascii')}")
