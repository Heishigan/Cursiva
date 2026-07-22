import sys

todo_file = sys.argv[1]

with open(todo_file, 'r') as f:
    lines = f.readlines()

new_lines = []
for line in lines:
    if line.startswith('pick') or line.startswith('fixup'):
        parts = line.split()
        if len(parts) >= 2:
            hash_id = parts[1]
            
            if hash_id.startswith('1795eff'): line = f"reword {hash_id}\n"
            elif hash_id.startswith('08a7706'): line = f"fixup {hash_id}\n"
            elif hash_id.startswith('7e3af5e'): line = f"reword {hash_id}\n"
            elif hash_id.startswith('c42b899'): line = f"fixup {hash_id}\n"
            elif hash_id.startswith('7c39cf5'): line = f"fixup {hash_id}\n"
            elif hash_id.startswith('abbda79'): line = f"fixup {hash_id}\n"
            elif hash_id.startswith('a43660a'): line = f"fixup {hash_id}\n"
            elif hash_id.startswith('c5d3a88'): line = f"fixup {hash_id}\n"
            elif hash_id.startswith('db79c2e'): line = f"reword {hash_id}\n"
            elif hash_id.startswith('dda01dc'): line = f"reword {hash_id}\n"
            elif hash_id.startswith('5c7910b'): line = f"fixup {hash_id}\n"
            elif hash_id.startswith('7d85584'): line = f"reword {hash_id}\n"
            elif hash_id.startswith('c9f24c3'): line = f"reword {hash_id}\n"
            elif hash_id.startswith('f6553b1'): line = f"reword {hash_id}\n"
            elif hash_id.startswith('cf51015'): line = f"reword {hash_id}\n"
            elif hash_id.startswith('6ba0f4f'): line = f"reword {hash_id}\n"
            
    new_lines.append(line)

with open(todo_file, 'w') as f:
    f.writelines(new_lines)
