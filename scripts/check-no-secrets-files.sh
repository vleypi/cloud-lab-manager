set -euo pipefail

added=$(git diff --cached --name-only --diff-filter=A)
if [ -z "$added" ]; then
  exit 0
fi

violations=$(echo "$added" | awk '/^secrets\/[^/]+$/ && !/^secrets\/\.gitkeep$/')
if [ -n "$violations" ]; then
  echo "Refusing to commit files under secrets/. Only secrets/.gitkeep is allowed."
  echo "Violations:"
  echo "$violations" | sed 's/^/  /'
  exit 1
fi

exit 0
