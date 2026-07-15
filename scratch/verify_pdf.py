import fitz

pdf_path = r"c:\Users\USER\Desktop\finsty\FINSTY DASHBOARD_8786.pdf"
doc = fitz.open(pdf_path)
print(f"Total pages: {len(doc)}")

for page_num in range(len(doc)):
    page = doc[page_num]
    annots = list(page.annots())
    print(f"Page {page_num+1} has {len(annots)} annotations:")
    for annot in annots:
        info = annot.info
        print(f"  - Type: {annot.type[1]}, Title: {info.get('title')}, Rect: {annot.rect}")

doc.close()
