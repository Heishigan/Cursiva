import sys
import re

todo_file = sys.argv[1]

with open(todo_file, 'r') as f:
    lines = f.readlines()

new_lines = []
for line in lines:
    if line.startswith('pick') or line.startswith('fixup'):
        parts = line.split()
        hash_id = parts[1]
        
        if hash_id.startswith('8f1830d'): line = f"fixup {hash_id}\n"
        elif hash_id.startswith('8c2ff45'): 
            line = f"fixup {hash_id}\nexec git commit --amend -m \"fix: resolve UI/UX constraints in Onboarding and Workbench steps\"\n"
            
        elif hash_id.startswith('caec818'): 
            line = f"fixup {hash_id}\nexec git commit --amend -m \"fix: enforce strict Name_Company_Role_Type PDF naming conventions\"\n"
            
        elif hash_id.startswith('f081482'): line = f"fixup {hash_id}\n"
        elif hash_id.startswith('ecf3440'): line = f"fixup {hash_id}\n"
        elif hash_id.startswith('a62a785'): 
            line = f"fixup {hash_id}\nexec git commit --amend -m \"chore: configure deployment, docker permissions, and line endings\"\n"
            
        elif hash_id.startswith('9ed43b3'): line = f"fixup {hash_id}\n"
        elif hash_id.startswith('7afa059'): 
            line = f"fixup {hash_id}\nexec git commit --amend -m \"fix: post-launch UI, abuse prevention, and credit gate improvements\"\n"
            
        elif hash_id.startswith('4ad0414'): line = f"fixup {hash_id}\n"
        
    new_lines.append(line)

with open(todo_file, 'w') as f:
    f.writelines(new_lines)
