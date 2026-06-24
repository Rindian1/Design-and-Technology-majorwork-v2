from sqlalchemy import (
    Column, Integer, Float, DateTime, Date, Text,
    create_engine, UniqueConstraint, Index
)
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy import func

from config import HEATING_DB_PATH

Base = declarative_base()


class HeatingUsage(Base):
    __tablename__ = 'heating_usage'

    id = Column(Integer, primary_key=True, autoincrement=True)
    timestamp = Column(DateTime, nullable=False)
    watt_usage = Column(Integer, nullable=False)
    daily_usage_hours = Column(Float, nullable=False)
    date = Column(Date, nullable=False)

    def to_dict(self):
        return {
            'id': self.id,
            'timestamp': self.timestamp.isoformat() if self.timestamp else None,
            'watt_usage': self.watt_usage,
            'daily_usage_hours': self.daily_usage_hours,
            'date': self.date.isoformat() if self.date else None,
        }

    @classmethod
    def get_by_date(cls, session, target_date):
        return session.query(cls).filter(cls.date == target_date).order_by(cls.timestamp).all()

    @classmethod
    def get_statistics(cls, session, target_date):
        result = session.query(
            func.count(cls.id).label('count'),
            func.avg(cls.watt_usage).label('average'),
            func.max(cls.watt_usage).label('peak'),
            func.min(cls.watt_usage).label('minimum'),
            func.sum(cls.watt_usage).label('total'),
        ).filter(cls.date == target_date).first()
        return result

    @classmethod
    def get_date_range(cls, session):
        result = session.query(
            func.min(cls.date).label('earliest'),
            func.max(cls.date).label('latest'),
        ).first()
        return result


class Reading(Base):
    __tablename__ = 'readings'

    id = Column(Integer, primary_key=True, autoincrement=True)
    plug_name = Column(Text, nullable=False)
    watts = Column(Float, nullable=False)
    cost_increment = Column(Float, nullable=False)
    timestamp = Column(DateTime, nullable=False)
    date = Column(Text, nullable=False)

    __table_args__ = (
        Index('idx_readings_plug_timestamp', 'plug_name', 'timestamp'),
        Index('idx_readings_date', 'date'),
    )

    def to_dict(self):
        return {
            'id': self.id,
            'plug_name': self.plug_name,
            'watts': self.watts,
            'cost_increment': self.cost_increment,
            'timestamp': self.timestamp.isoformat() if self.timestamp else None,
            'date': self.date,
        }


class DailyTotal(Base):
    __tablename__ = 'daily_totals'

    id = Column(Integer, primary_key=True, autoincrement=True)
    plug_name = Column(Text, nullable=False)
    date = Column(Text, nullable=False)
    total_cost_dollars = Column(Float, nullable=False)
    total_energy_kwh = Column(Float, default=0)
    last_updated = Column(DateTime, nullable=False)

    __table_args__ = (
        UniqueConstraint('plug_name', 'date', name='uq_plug_date'),
        Index('idx_daily_totals_plug_date', 'plug_name', 'date'),
    )

    def to_dict(self):
        return {
            'id': self.id,
            'plug_name': self.plug_name,
            'date': self.date,
            'total_cost_dollars': self.total_cost_dollars,
            'total_energy_kwh': self.total_energy_kwh,
            'last_updated': self.last_updated.isoformat() if self.last_updated else None,
        }


class DatabaseSession:
    def __init__(self, db_path: str):
        self.engine = create_engine(f'sqlite:///{db_path}')
        self.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)

    def create_tables(self):
        Base.metadata.create_all(bind=self.engine)

    def get_session(self):
        return self.SessionLocal()

    def close(self):
        self.engine.dispose()
