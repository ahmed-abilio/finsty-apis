with open(r"c:\Users\USER\Desktop\finsty\finsty-apis\src\modules\order\orderReturn.service.ts", "r", encoding="utf-8") as f:
    content = f.read()

lines = content.splitlines()
print(f"Total lines: {len(lines)}")
keywords = ["hour", "minute", "slot", "pickup", "reason", "time"]
for kw in keywords:
    matches = [i+1 for i, l in enumerate(lines) if kw in l.lower()]
    print(f"Keyword '{kw}' matches: {matches[:10]}")
    for ln in matches[:3]:
        print(f"  {ln}: {lines[ln-1].strip()}")
