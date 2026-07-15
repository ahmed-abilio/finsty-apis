with open(r"c:\Users\USER\Desktop\finsty\finsty-apis\src\modules\order\order.service.ts", "r", encoding="utf-8") as f:
    content = f.read()

lines = content.splitlines()
print(f"Total lines: {len(lines)}")
cancel_lines = [i+1 for i, l in enumerate(lines) if "cancel" in l.lower()]
print(f"Cancel lines: {cancel_lines}")
for ln in cancel_lines[:15]:
    print(f"{ln}: {lines[ln-1]}")
