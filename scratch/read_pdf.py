import fitz # PyMuPDF

pdf_path = r"c:\Users\USER\Desktop\finsty\FINSTY DASHBOARD_8786.pdf"
output_path = r"c:\Users\USER\Desktop\finsty\finsty-apis\scratch\pdf_text.txt"

doc = fitz.open(pdf_path)
print(f"Total pages: {len(doc)}")

with open(output_path, "w", encoding="utf-8") as f:
    for i, page in enumerate(doc):
        text = page.get_text()
        f.write(f"--- PAGE {i+1} ---\n")
        f.write(text)
        f.write("\n\n")

print("Text extraction complete!")
