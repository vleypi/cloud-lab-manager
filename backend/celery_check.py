from celery import Celery
from celery.schedules import crontab

# Механизм проверки сессий каждые 60 минут

app = Celery(
    'lab_orchestrator',
    broker='redis://localhost:6373/0',  # Проверьте, что Redis запущен именно на 6373 порту
    backend='redis://localhost:6373/0'
)

app.conf.imports = ('killer',)

# Настройка периодических задач (Celery Beat)
app.conf.beat_schedule = {
    'check-expired-labs-every-minute': {
        'task': 'killer.auto_destroy_expired_labs',
        'schedule': crontab(minute='*'), 
    },
}

app.conf.timezone = 'UTC'