with open(r"c:\Users\USER\Desktop\finsty\finsty-apis\src\modules\order\order.service.ts", "r", encoding="utf-8") as f:
    content = f.read()

lines = content.splitlines()
target = "_refundCapturedPaymentOnCancel"
found_lines = [i+1 for i, l in enumerate(lines) if target in l]
print(f"Found lines: {found_lines}")
for ln in found_lines:
    for idx in range(ln-1, ln+40):
        if idx < len(lines):
            line = lines[idx]
            print(f"{idx+1}: {line.encode('ascii', errors='replace').decode('ascii')}")
