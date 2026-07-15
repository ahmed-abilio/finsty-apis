import os
import re

fe_dir = r"c:\Users\USER\Desktop\finsty\finsty-admin-fe"
be_dir = r"c:\Users\USER\Desktop\finsty\finsty-apis"

def find_files_with_keyword(directory, keyword):
    matches = []
    pattern = re.compile(keyword, re.IGNORECASE)
    for root, dirs, files in os.walk(directory):
        if "node_modules" in dirs:
            dirs.remove("node_modules")
        if ".git" in dirs:
            dirs.remove(".git")
        if "dist" in dirs:
            dirs.remove("dist")
        for f in files:
            if f.endswith(('.ts', '.tsx', '.js', '.json', '.prisma', '.md')):
                path = os.path.join(root, f)
                try:
                    with open(path, 'r', encoding='utf-8', errors='ignore') as file:
                        content = file.read()
                        if pattern.search(content):
                            matches.append(os.path.relpath(path, directory))
                except Exception:
                    pass
    return matches

keywords = [
    "wallet", "commission", "payout", "shadowfax", "cac", "roas", "campaign",
    "ticket", "leaderboard", "gps", "incentive", "dau", "retention", "cohort",
    "slack", "whatsapp", "anomaly", "rbac", "role", "refund"
]

print("--- SEARCH RESULTS ---")
for kw in keywords:
    fe_matches = find_files_with_keyword(fe_dir, kw)
    be_matches = find_files_with_keyword(be_dir, kw)
    print(f"Keyword: {kw}")
    print(f"  FE matches ({len(fe_matches)}): {fe_matches[:5]}")
    print(f"  BE matches ({len(be_matches)}): {be_matches[:5]}")
    print()
