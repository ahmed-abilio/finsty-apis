with open(r"c:\Users\USER\Desktop\finsty\finsty-apis\src\modules\order\order.routes.ts", "r", encoding="utf-8") as f:
    content = f.read()

lines = content.splitlines()
print(f"Total lines: {len(lines)}")
for idx, line in enumerate(lines):
    if "router." in line or "address" in line.lower():
        print(f"{idx+1}: {line.strip()}")
