set -euo pipefail

cmd="${1:-api}"

ensure_secrets() {
    local secrets_dir="${APP_HOME:-/app}/secrets"
    mkdir -p "${secrets_dir}"

    if [ ! -f "${secrets_dir}/inspector_ed25519" ] || [ ! -f "${secrets_dir}/inspector_ed25519.pub" ]; then
        echo "[entrypoint] generating inspector SSH keypair (ed25519)"
        rm -f "${secrets_dir}/inspector_ed25519" "${secrets_dir}/inspector_ed25519.pub"
        ssh-keygen -t ed25519 -f "${secrets_dir}/inspector_ed25519" -N "" -q -C "inspector@cloud-lab-manager"
    fi

    if [ ! -f "${secrets_dir}/lti_tool_rsa.pem" ] || [ ! -f "${secrets_dir}/lti_tool_rsa.pub" ]; then
        echo "[entrypoint] generating LTI tool RSA keypair (4096-bit)"
        rm -f "${secrets_dir}/lti_tool_rsa.pem" "${secrets_dir}/lti_tool_rsa.pub"
        openssl genrsa -out "${secrets_dir}/lti_tool_rsa.pem" 4096 2>/dev/null
        openssl rsa -in "${secrets_dir}/lti_tool_rsa.pem" -pubout -out "${secrets_dir}/lti_tool_rsa.pub" 2>/dev/null
        chmod 600 "${secrets_dir}/lti_tool_rsa.pem"
    fi
}

ensure_secrets

wait_for_tcp() {
    local host="$1"
    local port="$2"
    local label="$3"
    local attempts=0
    until (echo > "/dev/tcp/${host}/${port}") >/dev/null 2>&1; do
        attempts=$((attempts + 1))
        if [ "${attempts}" -gt 60 ]; then
            echo "[entrypoint] ${label} ${host}:${port} unreachable after 60s, aborting" >&2
            exit 1
        fi
        sleep 1
    done
    echo "[entrypoint] ${label} ${host}:${port} reachable"
}

extract_host_port() {
    local url="$1"
    local stripped="${url#*://}"
    stripped="${stripped#*@}"
    HOST="${stripped%%[:/]*}"
    local rest="${stripped#${HOST}}"
    rest="${rest#:}"
    PORT="${rest%%/*}"
}

if [ -n "${DATABASE_URL:-}" ]; then
    extract_host_port "${DATABASE_URL}"
    wait_for_tcp "${HOST}" "${PORT:-5432}" "postgres"
fi
if [ -n "${REDIS_URL:-}" ]; then
    extract_host_port "${REDIS_URL}"
    wait_for_tcp "${HOST}" "${PORT:-6379}" "redis"
fi

case "${cmd}" in
    api)
        # инициализация схемы и засев пула делаются только в api
        # worker и beat стартуют после api по depends_on и видят готовую БД
        echo "[entrypoint] python -m scripts.init_db"
        python -m scripts.init_db
        echo "[entrypoint] starting uvicorn"
        exec uvicorn app.main:app --host "${APP_HOST:-0.0.0.0}" --port "${APP_PORT:-8000}" --proxy-headers
        ;;
    worker)
        echo "[entrypoint] starting celery worker"
        exec celery -A app.celery_app:celery_app worker \
            --loglevel="${CELERY_LOG_LEVEL:-INFO}" \
            --queues="${CELERY_QUEUES:-orchestrator}" \
            --pool="${CELERY_POOL:-threads}" \
            --concurrency="${CELERY_CONCURRENCY:-4}"
        ;;
    beat)
        echo "[entrypoint] starting celery beat"
        exec celery -A app.celery_app:celery_app beat --loglevel="${CELERY_LOG_LEVEL:-INFO}"
        ;;
    shell)
        exec python
        ;;
    *)
        exec "$@"
        ;;
esac
