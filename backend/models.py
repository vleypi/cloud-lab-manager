from sqlalchemy import Column, Integer, String
from database import Base

class Project(Base):
    """проект в пуле"""
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True)
    openstack_project_id = Column(String, nullable=False)
    status = Column(String, default="free")
    student_id = Column(String, nullable=True)