import os

file_path = r'c:\Users\hp\Downloads\db proj\public\index.html'
with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Remove lines 1001 to 1016 (0-indexed: 1000 to 1015)
# We use line numbers from the tool view_file which are 1-indexed.
# Line 1001 is index 1000.
# Line 1016 is index 1015.
del lines[1000:1016]

with open(file_path, 'w', encoding='utf-8') as f:
    f.writelines(lines)

print("Cleanup successful.")
