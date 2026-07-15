import fitz

pdf_path = r"c:\Users\USER\Desktop\finsty\FINSTY DASHBOARD_8786.pdf"
doc = fitz.open(pdf_path)
page = doc[0]

# Try to find a simple word and highlight it
rects = page.search_for("Super Dashboard")
if rects:
    print(f"Found 'Super Dashboard' at {rects}")
    annot = page.add_highlight_annot(rects[0])
    annot.set_colors(stroke=(0, 0.8, 0)) # green
    annot.update()
    
    # Add a comment near the text
    pt = fitz.Point(rects[0].x1 + 10, rects[0].y0)
    text_annot = page.add_text_annot(pt, "Test comment")
    text_annot.set_colors(stroke=(1, 0, 0)) # red
    text_annot.update()
    print("Annotation test complete")

doc.save(r"c:\Users\USER\Desktop\finsty\finsty-apis\scratch\test_out.pdf")
doc.close()
