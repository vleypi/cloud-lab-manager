from fastapi import FastAPI, HTTPException, Depends
from sqlalchemy.orm import Session
from datetime import datetime, timezone  # Добавили timezone
from models import LabSession
from killer import SessionLocal
from killer import destroy_infrastructure_task # Импортируем сессию БД из прошлых шагов

app = FastAPI(title="Режим техподдержки (Этап 2.4)")

@app.get("/")
def root():
    return {"message": "Поехали чтоле"}

# Функция для получения сессии БД (Dependency Injection)
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ИСПРАВЛЕНО: Заменен @post на @app.post
@app.post("/api/labs/{session_id}/freeze")
def activate_tech_support(session_id: int, db: Session = Depends(get_db)):
    """Включение режима техподдержки (Заморозка на 24 часа)"""
    session = db.query(LabSession).filter(LabSession.id == session_id).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Лабораторная сессия не найдена")
    
    if session.status != 'Готов':
        raise HTTPException(status_code=400, detail=f"Нельзя заморозить лабу в статусе {session.status}")
    
    # Меняем состояние сессии
    session.status = 'Заморожен'
    # ИСПРАВЛЕНО: Вместо utcnow() используем современный и безопасный вариант
    session.frozen_at = datetime.now(timezone.utc)
    
    # Увеличиваем лимит времени (базовые 2 часа + 24 часа техподдержки = 26 часов с момента старта)
    session.lifetime_hours = 26 
    
    db.commit()
    print(f"[TECH SUPPORT] Стенд {session_id} успешно заморожен на 24 часа.")
    return {"message": "Режим техподдержки активирован на 24 часа", "status": session.status}


# ИСПРАВЛЕНО: Заменен @post на @app.post
@app.post("/api/labs/{session_id}/unfreeze")
def deactivate_tech_support(session_id: int, db: Session = Depends(get_db)):
    """Досрочное отключение режима техподдержки (Преподаватель закончил проверку)"""
    session = db.query(LabSession).filter(LabSession.id == session_id).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Лабораторная сессия не найдена")
    
    # ИСПРАВЛЕНО: Исправлена опечатка 'Замороzen' на 'Заморожен'
    if session.status != 'Заморожен':
        raise HTTPException(status_code=400, detail="Стенд не находится в режиме техподдержки")
    
    # Возвращаем стенд в обычный режим, но так как 2 часа скорее всего прошли, 
    # мы принудительно отправляем его на очистку
    session.status = 'Очистка'
    db.commit()
    
    # Сразу пинаем воркер на удаление ресурсы в OpenStack, чтобы освободить пул ресурсов
    destroy_infrastructure_task.delay(session.id)
    
    print(f"[TECH SUPPORT] Режим техподдержки снят вручную для стенда {session_id}. Запущена очистка.")
    return {"message": "Режим техподдержки отключен, стенд отправлен на утилизацию"}