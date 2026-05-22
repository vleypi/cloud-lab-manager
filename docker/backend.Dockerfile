FROM python:3.12-slim-bookworm AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        libpq-dev \
        libffi-dev \
        libssl-dev \
        curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build

RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:${PATH}"

COPY backend/pyproject.toml ./
COPY backend/app ./app
RUN pip install --upgrade pip setuptools wheel \
    && pip install .

FROM python:3.12-slim-bookworm AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/opt/venv/bin:${PATH}" \
    APP_HOME=/app

RUN apt-get update && apt-get install -y --no-install-recommends \
        libpq5 \
        libffi8 \
        libssl3 \
        openssl \
        openssh-client \
        tini \
    && rm -rf /var/lib/apt/lists/*

ARG APP_UID=10001
ARG APP_GID=10001
RUN groupadd --system --gid ${APP_GID} app \
    && useradd --system --uid ${APP_UID} --gid ${APP_GID} --home ${APP_HOME} --shell /sbin/nologin app

COPY --from=builder /opt/venv /opt/venv

WORKDIR ${APP_HOME}
COPY --chown=app:app backend/app ./app
COPY --chown=app:app backend/scripts ./scripts
COPY --chown=app:app config/check_templates ./check_templates
COPY --chown=app:app docker/entrypoint.sh ./entrypoint.sh
COPY --chown=app:app config/pool*.yaml ./
RUN chmod +x ./entrypoint.sh \
    && mkdir -p ${APP_HOME}/secrets \
    && chown -R app:app ${APP_HOME}

USER app

EXPOSE 8000

ENTRYPOINT ["/usr/bin/tini", "--", "./entrypoint.sh"]
CMD ["api"]
