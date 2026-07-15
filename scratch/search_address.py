with open(r"c:\Users\USER\Desktop\finsty\finsty-apis\src\modules\order\order.service.ts", "r", encoding="utf-8") as f:
    content = f.read()

lines = content.splitlines()
keywords = ["address", "serviceability", "receiverName"]
for kw in keywords:
    matches = [i+1 for i, l in enumerate(lines) if kw in l.lower()]
    print(f"Keyword '{kw}' matches: {matches[:10]}")
    for ln in matches[:2]:
        print(f"  {ln}: {lines[ln-1].strip()}")
