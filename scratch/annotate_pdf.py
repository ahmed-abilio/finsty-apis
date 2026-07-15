import shutil
import fitz
import os

pdf_path = r"c:\Users\USER\Desktop\finsty\FINSTY DASHBOARD_8786.pdf"
backup_path = r"c:\Users\USER\Desktop\finsty\FINSTY DASHBOARD_8786_backup.pdf"
temp_pdf_path = r"c:\Users\USER\Desktop\finsty\finsty-apis\scratch\annotated_temp.pdf"

# 1. Back up original PDF if backup doesn't exist
if not os.path.exists(backup_path):
    print("Backing up original PDF...")
    shutil.copy2(pdf_path, backup_path)
    print(f"Backup created at: {backup_path}")
else:
    print("Backup already exists.")

# 2. Open backup PDF or original PDF as base
# We open the backup as source, and save to temp_pdf_path, then copy to original
doc = fitz.open(backup_path)

# Color palettes (RGB, normalized to 0.0 - 1.0)
GREEN = (0.2, 0.8, 0.2)  # Fully implemented
YELLOW = (1.0, 0.8, 0.0) # Partially implemented
RED = (0.9, 0.2, 0.2)    # Unimplemented / Gap

# Mapping of text search term to its implementation category and color
highlights = [
    # Page 1
    ("Total orders", GREEN),
    ("Revenue", GREEN),
    ("status-wise breakdown", GREEN),
    ("Date, Status", GREEN),
    ("KYC, GST, PAN, Bank", GREEN),
    ("Active", GREEN),
    
    # Page 2
    ("Integrations: ShadowFax", GREEN),
    ("Cancel Order: Pre-dispatch only. Auto refund if prepaid", GREEN),
    ("Initiate Return: 60 mins window. Reason dropdown", GREEN),
    ("Prepaid -> wallet credit", GREEN),
    
    # Page 3
    ("Coupons: Create/edit, set rules, usage limits", GREEN),
    ("Content: Banners", GREEN),
    ("app notifications", GREEN),

    # Section Headers (Partially Implemented -> Yellow)
    ("2. Orders Dashboard:", YELLOW),
    ("4. Vendor Analysis:", YELLOW),
    ("5. Logistics Analysis:", YELLOW),
    ("8. Customer Care Dashboard:", YELLOW),
    ("11. Coupons, Content, etc Editing Panel:", YELLOW),
]

# Mapping of section headers to review comments
comments = {
    "1. Super Dashboard:": (RED, 
        "GAP: Unimplemented.\n"
        "Finsty Admin currently has a basic dashboard showing only total stats (orders, revenue, users, stores) and status charts.\n"
        "Missing: Live Orders feed, Today's Money (GMV, Commission, COD, Payout), Health (RTO/Cancellation/OOS%), and GPS Map view."),
        
    "2. Orders Dashboard:": (YELLOW,
        "PARTIALLY IMPLEMENTED.\n"
        "Implemented: Total orders, Revenue, status breakdown, and Date/Status filters.\n"
        "Missing: AOV, Fulfillment rate, Cancel/Return rate metrics, channel splits, SLA delay alerts, and filters for Channel/Location/Payment."),
        
    "3. Finance Dashboard Purpose:": (RED,
        "GAP: Unimplemented.\n"
        "No Finance page or finance-related metrics (Gross/Net Revenue, COGS, Margins, Reserves, Burn rate, P&L) exist in the codebase."),
        
    "4. Vendor Analysis:": (YELLOW,
        "PARTIALLY IMPLEMENTED.\n"
        "Implemented: Onboarding fields (GST, PAN, shop license, Aadhar, bankDetails) in Store model, Active/Inactive state.\n"
        "Missing: Vendor scorecard, lead time/fulfillment stats, warehouse pincode, pickup slots, paused/blocked states, payouts run automation, and per-category commission rate settings."),
        
    "5. Logistics Analysis:": (YELLOW,
        "PARTIALLY IMPLEMENTED.\n"
        "Implemented: ShadowFax shipping placement, cancellation, tracking, and returns webhook sync at backend level.\n"
        "Missing: Frontend Logistics Analysis dashboard, pincode heatmap, COD vs Prepaid rate charts, or Courier SLA breach reports."),
        
    "6. Marketing Analysis:": (RED,
        "GAP: Unimplemented.\n"
        "No marketing dashboard or metrics (Ad spend, CAC, ROAS, campaign breakdowns, attribution models) are present."),
        
    "7. Sales Analysis:": (RED,
        "GAP: Unimplemented.\n"
        "No sales dashboard or reports (SKU/Category/City sales, dead stock, sales by time of day, waterfall chart) exist."),
        
    "8. Customer Care Dashboard:": (YELLOW,
        "PARTIALLY IMPLEMENTED.\n"
        "Implemented: Cancel Order (pre-dispatch auto-refund to wallet) and Return Initiation (enforced 60 mins window, reason dropdown).\n"
        "Missing: Support tickets system, partial refunds, edit address for existing orders, compensation tool, action audit logs, and Support/Finance/Ops roles."),
        
    "9. Vendor Registration Team & Incentive Dashboard:": (RED,
        "GAP: Unimplemented.\n"
        "No agent leaderboard, GPS field check-in, registration funnel, incentives, or QC clawback logic exist."),
        
    "10. App Installs & Usage Analysis:": (RED,
        "GAP: Unimplemented.\n"
        "No tracking or dashboard for app installs, DAU/WAU/MAU, stickiness, retention, or signup-to-order funnels."),
        
    "11. Coupons, Content, etc Editing Panel:": (YELLOW,
        "PARTIALLY IMPLEMENTED.\n"
        "Implemented: Coupons management, Banners page (price/discount banners), and App notifications.\n"
        "Missing: Coupon ROI tracking, homepage blocks, popups, feature flags, and marketing role permissions."),
        
    "12. Inventory & Procurement Dashboard:": (RED,
        "GAP: Unimplemented.\n"
        "No inventory dashboard, stock alert configurations, PO generation, or demand forecasting."),
        
    "13. User Cohorts & LTV Dashboard:": (RED,
        "GAP: Unimplemented.\n"
        "No cohort tables or lifetime value (LTV) analytics."),
        
    "14. Alerts & Anomaly Dashboard:": (RED,
        "GAP: Unimplemented.\n"
        "No anomaly rules or Slack/WhatsApp alert notifications for revenue drop, PG failure, or RTO spikes."),
        
    "NOTE: Give Role Based Access for all Modules": (RED,
        "GAP: Unimplemented Roles.\n"
        "Basic role check routes exist (Admin, Vendor, User), but Support, Finance, Ops, and Marketing roles are missing from the system entirely.")
}

print("Searching for text and adding highlights...")
# Iterate through pages and search/highlight
for page_num in range(len(doc)):
    page = doc[page_num]
    
    # 1. Apply Highlights
    for text, color in highlights:
        rects = page.search_for(text)
        for r in rects:
            annot = page.add_highlight_annot(r)
            annot.set_colors(stroke=color)
            annot.update()
            
    # 2. Add Comments / Sticky Notes
    for header, (color, comment_text) in comments.items():
        rects = page.search_for(header)
        if rects:
            r = rects[0]
            point = fitz.Point(r.x1 + 15, r.y0 - 2)
            
            # Ensure the note doesn't go off-page
            if point.x > page.rect.x1 - 30:
                point.x = page.rect.x1 - 30
                
            annot = page.add_text_annot(point, comment_text)
            annot.set_colors(stroke=color)
            annot.set_info(title="Codebase Review", content=comment_text)
            annot.update()
            print(f"Added comment note for: '{header}' on Page {page_num + 1}")

# Save the annotated PDF to a temp path
print("Saving annotated PDF to temp path...")
doc.save(temp_pdf_path)
doc.close()
print("Temp PDF successfully saved!")

# Copy temp PDF to original PDF path
print("Copying temp PDF to original path...")
shutil.copy2(temp_pdf_path, pdf_path)
print("PDF successfully updated in-place!")
