import sys

from app.core.security import hash_password


if len(sys.argv) != 2:
    print("Usage: python -m scripts.generate_admin_password <password>")
    sys.exit(1)

print(hash_password(sys.argv[1]))
