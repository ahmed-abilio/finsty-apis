with open(r"c:\Users\USER\Desktop\finsty\finsty-apis\src\modules\order\order-return.model.ts", "r", encoding="utf-8") as f:
    content = f.read()

lines = content.splitlines()
print(f"Total lines: {len(lines)}")
for i, l in enumerate(lines):
    if "interface" in l or "declare" in l or "type" in l:
        print(f"{i+1}: {l}")
