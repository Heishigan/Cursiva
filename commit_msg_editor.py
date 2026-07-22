import sys

msg_file = sys.argv[1]

with open(msg_file, 'r') as f:
    lines = f.readlines()

# The first line of the file is the current commit message subject
if not lines:
    sys.exit(0)

subject = lines[0].strip()
new_subject = subject

if subject.startswith("Configure frontend for prod API"):
    new_subject = "chore: configure frontend for prod API and fix backend CORS"
elif subject.startswith("UI Redesign: Modern dashboard with glassmorphism"):
    new_subject = "feat(ui): redesign modern dashboard with glassmorphism, dynamic animations, and lucide icons"
elif subject.startswith("fix: Resolve text overflow and modal bounds"):
    new_subject = "fix(ui): resolve text overflow and modal bounds on mobile for profile layout"
elif subject.startswith("fix: enforce onboarding flow"):
    new_subject = "fix(ui): enforce onboarding flow, correct sidebar status glitch, and scale metric text size"
elif subject.startswith("fix: TypeScript strict mode error in WorkbenchStep"):
    new_subject = "fix(frontend): resolve TypeScript strict mode errors in Workbench and Done steps"
elif subject.startswith("fix: LLM crashing on override"):
    new_subject = "fix(backend): resolve LLM crash on override and frontend silent failure"
elif subject.startswith("Fix UI bugs, LaTeX spacing, PDF naming"):
    new_subject = "fix(ui): resolve UI bugs, LaTeX spacing, PDF naming, and pipeline fetch caching"
elif subject.startswith("Fix onboarding redirect loop"):
    new_subject = "fix(frontend): resolve onboarding redirect loop and clear legacy localstorage"
elif subject.startswith("fix(ci): inline image references in steps"):
    new_subject = "fix(ci): inline image references in steps (cannot use substitution values)"

lines[0] = new_subject + "\n"

with open(msg_file, 'w') as f:
    f.writelines(lines)
