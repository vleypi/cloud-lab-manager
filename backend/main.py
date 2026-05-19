from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_database_session, engine
import models

#создаём таблицы
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Cloud Lab Manager")


@app.get("/")
def root():
    return {"message": "Cloud Lab Manager работает"}


@app.get("/pool/project")
def get_free_project(session: Session = Depends(get_database_session)):
    """первый свободный проект в пуле"""
    project = session.query(models.Project)\
                     .filter(models.Project.status == "free")\
                     .first()

    if not project:
        raise HTTPException(
            status_code=503,
            detail="Нет свободных проектов в пуле"
        )

    return {
        "project_id": project.id,
        "openstack_project_id": project.openstack_project_id,
        "status": project.status
    }


@app.post("/pool/project/reserve")
def reserve_project(
    student_id: str,
    session: Session = Depends(get_database_session)
):
    """резервирует свободный проект"""
    project = session.query(models.Project)\
                     .filter(models.Project.status == "free")\
                     .first()

    if not project:
        raise HTTPException(
            status_code=503,
            detail="Нет свободных проектов в пуле"
        )

    #отмечаем проект занятым
    project.status = "reserved"
    project.student_id = student_id
    session.commit()

    return {
        "message": "проект успешно зарезервирован",
        "project_id": project.id,
        "openstack_project_id": project.openstack_project_id,
        "student_id": student_id
    }


@app.post("/pool/project/release")
def release_project(
    project_id: int,
    session: Session = Depends(get_database_session)
):
    """возвращает проект обратно в пул после очистки"""
    project = session.query(models.Project)\
                     .filter(models.Project.id == project_id)\
                     .first()

    if not project:
        raise HTTPException(status_code=404, detail="Проект не найден")

    if project.status == "free":
        raise HTTPException(status_code=400, detail="Проект уже свободен")

    #очищаем и возвращает в пул
    project.status = "free"
    project.student_id = None
    session.commit()

    return {
        "message": "проект возвращён в пул",
        "project_id": project_id
    }


@app.post("/pool/project/add")
def add_project(
    openstack_project_id: str,
    session: Session = Depends(get_database_session)
):
    """Добавляет новый проект в пул (только для администратора)"""
    project = models.Project(openstack_project_id=openstack_project_id)
    session.add(project)
    session.commit()

    return {
        "message": "проект добавлен в пул",
        "project_id": project.id
    }