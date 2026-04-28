prompt=$(cat scripts/ralph/prompt.md)

claude --permission-mode acceptEdits \
"$prompt"