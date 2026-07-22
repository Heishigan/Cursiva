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
            
            # 1795eff Configure frontend for prod API and fix backend CORS -> REWORD
            if hash_id.startswith('1795eff'):
                line = f"pick {hash_id}\nexec git commit --amend -m \"chore: configure frontend for prod API and fix backend CORS\" --date=\"$(git log -1 --format=%aD)\" && git commit --amend --no-edit --date=\"$(git log -1 --format=%aD)\"\n"
            
            # 08a7706 Fix UserButton props and remove ClerkProvider appearance prop -> FIXUP
            elif hash_id.startswith('08a7706'):
                line = f"fixup {hash_id}\n"
                
            # 7e3af5e UI Redesign: Modern dashboard with glassmorphism... -> REWORD
            elif hash_id.startswith('7e3af5e'):
                line = f"pick {hash_id}\nexec git commit --amend -m \"feat(ui): redesign modern dashboard with glassmorphism, dynamic animations, and lucide icons\" --date=\"$(git log -1 --format=%aD)\" && git commit --amend --no-edit --date=\"$(git log -1 --format=%aD)\"\n"
                
            # c42b899 fix: Build error by using react-icons... -> FIXUP
            elif hash_id.startswith('c42b899'):
                line = f"fixup {hash_id}\n"
                
            # 7c39cf5 fix: Update footer copy and contact links -> FIXUP
            elif hash_id.startswith('7c39cf5'):
                line = f"fixup {hash_id}\n"
                
            # abbda79 fix: Restore accidentally deleted Jake's Resume... -> FIXUP
            elif hash_id.startswith('abbda79'):
                line = f"fixup {hash_id}\n"
                
            # a43660a fix: Minimalistic new application button... -> FIXUP
            elif hash_id.startswith('a43660a'):
                line = f"fixup {hash_id}\n"
                
            # c5d3a88 fix: Profile layout responsive CSS to stack properly... -> FIXUP
            elif hash_id.startswith('c5d3a88'):
                line = f"fixup {hash_id}\n"
                
            # db79c2e fix: Resolve text overflow and modal bounds... -> REWORD
            elif hash_id.startswith('db79c2e'):
                line = f"pick {hash_id}\nexec git commit --amend -m \"fix(ui): resolve text overflow and modal bounds on mobile for profile layout\" --date=\"$(git log -1 --format=%aD)\" && git commit --amend --no-edit --date=\"$(git log -1 --format=%aD)\"\n"
                
            # dda01dc fix: enforce onboarding flow... -> REWORD
            elif hash_id.startswith('dda01dc'):
                line = f"pick {hash_id}\nexec git commit --amend -m \"fix(ui): enforce onboarding flow, correct sidebar status glitch, and scale metric text size\" --date=\"$(git log -1 --format=%aD)\" && git commit --amend --no-edit --date=\"$(git log -1 --format=%aD)\"\n"
                
            # 5c7910b fix: TypeScript strict mode error in DoneStep file naming -> FIXUP
            elif hash_id.startswith('5c7910b'):
                line = f"fixup {hash_id}\n"
                
            # 7d85584 fix: TypeScript strict mode error in WorkbenchStep -> REWORD
            elif hash_id.startswith('7d85584'):
                line = f"pick {hash_id}\nexec git commit --amend -m \"fix(frontend): resolve TypeScript strict mode errors in Workbench and Done steps\" --date=\"$(git log -1 --format=%aD)\" && git commit --amend --no-edit --date=\"$(git log -1 --format=%aD)\"\n"
                
            # c9f24c3 fix: LLM crashing on override... -> REWORD
            elif hash_id.startswith('c9f24c3'):
                line = f"pick {hash_id}\nexec git commit --amend -m \"fix(backend): resolve LLM crash on override and frontend silent failure\" --date=\"$(git log -1 --format=%aD)\" && git commit --amend --no-edit --date=\"$(git log -1 --format=%aD)\"\n"
                
            # f6553b1 Fix UI bugs, LaTeX spacing, PDF naming... -> REWORD
            elif hash_id.startswith('f6553b1'):
                line = f"pick {hash_id}\nexec git commit --amend -m \"fix(ui): resolve UI bugs, LaTeX spacing, PDF naming, and pipeline fetch caching\" --date=\"$(git log -1 --format=%aD)\" && git commit --amend --no-edit --date=\"$(git log -1 --format=%aD)\"\n"
                
            # cf51015 Fix onboarding redirect loop and clear legacy localstorage -> REWORD
            elif hash_id.startswith('cf51015'):
                line = f"pick {hash_id}\nexec git commit --amend -m \"fix(frontend): resolve onboarding redirect loop and clear legacy localstorage\" --date=\"$(git log -1 --format=%aD)\" && git commit --amend --no-edit --date=\"$(git log -1 --format=%aD)\"\n"
                
            # 6ba0f4f fix(ci): inline image references in steps -> REWORD
            elif hash_id.startswith('6ba0f4f'):
                line = f"pick {hash_id}\nexec git commit --amend -m \"fix(ci): inline image references in steps (cannot use substitution values)\" --date=\"$(git log -1 --format=%aD)\" && git commit --amend --no-edit --date=\"$(git log -1 --format=%aD)\"\n"
                
    new_lines.append(line)

with open(todo_file, 'w') as f:
    f.writelines(new_lines)
