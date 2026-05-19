import time
from datetime import datetime, timedelta, timezone
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from celery_check import app  # Убедитесь, что файл инициализации Celery называется именно celery_check.py
from models import LabSession

# Механизм удаления заплесневелых сессий (больше 2 часов активной сессии)

# Настройка подключения к БД (замените на ваши реквизиты PostgreSQL)
ENGINE = create_engine('postgresql://user:password@localhost:5432/infra_db', pool_pre_ping=True)
SessionLocal = sessionmaker(bind=ENGINE)


# --- ЗАГЛУШКА ДЛЯ ИНТЕГРАЦИИ С OPENSTACK (ЭТАП 1) ---
def mock_delete_openstack_vm(project_id):
    """
    Эту функцию позже заменит Бэкендер А.
    Она будет вызывать OpenStack Nova/Glance API для удаления ВМ.
    """
    print(f"[OPENSTACK API] Запрос на удаление ресурсов в проекте: {project_id}")
    time.sleep(2)  # Имитация сетевой задержки при общении с КИ
    return True


# --- ПЕРИОДИЧЕСКАЯ ЗАДАЧА-ЦЕНЗОР (Вызывается Celery Beat) ---
@app.task
def auto_destroy_expired_labs():
    db = SessionLocal()
    try:
        # Нам нужен "наивный" UTC, если в моделях СУБД используется стандартный DateTime без таймзон
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        print(f"[{datetime.now()}] Сканирование БД на наличие просроченных или замороженных стендов...")

        # УМНЫЙ SQL-ЗАПРОС, ОБЪЕДИНЯЮЩИЙ ЭТАПЫ 2.3 и 2.4:
        expired_sessions = db.query(LabSession).filter(
            (
                (LabSession.status == 'Готов') & 
                (LabSession.started_at + timedelta(hours=LabSession.lifetime_hours) <= now)
            ) |
            (
                (LabSession.status == 'Заморожен') &
                (LabSession.frozen_at + timedelta(hours=24) <= now)
            )
        ).all()

        if not expired_sessions:
            print("Просроченных лабораторных работ не обнаружено.")
            return

        # ИСПРАВЛЕНИЕ RACE CONDITION: 
        # Сначала собираем ID всех сессий, которые нужно удалить, в отдельный список в памяти
        session_ids_to_destroy = [session.id for session in expired_sessions]

        # Атомарно переводим ВСЕ найденные сессии в статус 'Очистка' одним запросом.
        # Это мгновенно блокирует их в базе данных от других воркеров.
        db.query(LabSession).filter(LabSession.id.in_(session_ids_to_destroy)).update(
            {"status": "Очистка"}, synchronize_session=False
        )
        db.commit()

        # Теперь спокойно отправляем задачи в Celery на фактическое удаление в фоне
        for session_id in session_ids_to_destroy:
            print(f"Отправка сессии #{session_id} в очередь на уничтожение ресурсов.")
            destroy_infrastructure_task.delay(session_id)

    except Exception as e:
        print(f"Ошибка в планировщике при поиске просроченных лаб: {e}")
        db.rollback()
    finally:
        db.close()


# --- АСИНХРОННАЯ ЗАДАЧА ОЧИСТКИ (Выполняется воркером) ---
@app.task
def destroy_infrastructure_task(session_id):
    db = SessionLocal()
    try:
        # Используем with_for_update() для блокировки строки на уровне БД при чтении воркером
        session = db.query(LabSession).filter(LabSession.id == session_id).with_for_update().first()
        if not session:
            print(f"Воркер: Сессия #{session_id} не найдена в базе данных.")
            return

        # Проверяем, что сессия действительно находится в процессе очистки
        if session.status != 'Очистка':
            print(f"Воркер: Сессия #{session_id} имеет неверный статус '{session.status}'. Отмена.")
            return

        # Вызываем очистку ВМ в Облаке Кибер Инфраструктуры
        deletion_success = mock_delete_openstack_vm(session.project_id)

        if deletion_success:
            # Меняем статус сессии на финальный
            session.status = 'Завершен'
            print(f"Стенд для сессии {session_id} успешно уничтожен. Проект {session.project_id} возвращен в пул.")
            db.commit()
        else:
            # Если облако вернуло ошибку — оставляем статус 'Очистка' для обработки машиной состояний (Этап 2.2)
            print(f"Ошибка при удалении ресурсов для сессии {session_id}. Оставляем в статусе Очистка для retry.")
            db.rollback()
            
    except Exception as e:
        print(f"Критическая ошибка воркера при удалении сессии {session_id}: {e}")
        db.rollback()
    finally:
        db.close()