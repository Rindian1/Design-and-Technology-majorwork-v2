from sqlalchemy import (
    Column, Integer, Float, DateTime, Date, Text, String, Boolean,
    create_engine, UniqueConstraint, Index, ForeignKey
)
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
from sqlalchemy import func

from config import HEATING_DB_PATH

Base = declarative_base()


class User(Base):
    __tablename__ = 'users'

    id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(String(255), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime, nullable=False)

    profile = relationship('UserProfile', uselist=False, back_populates='user')

    def to_dict(self):
        return {
            'id': self.id,
            'email': self.email,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class UserProfile(Base):
    __tablename__ = 'user_profiles'

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey('users.id'), unique=True, nullable=False)
    survey_data = Column(Text, nullable=True)  # JSON blob
    points_total = Column(Integer, nullable=False, default=0)

    user = relationship('User', back_populates='profile')


class UserGoal(Base):
    __tablename__ = 'user_goals'

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    goal_id = Column(String(64), nullable=False)
    status = Column(String(16), nullable=False, default='inactive')
    current_value = Column(Float, nullable=False, default=0)
    target_value = Column(Float, nullable=False)
    current_streak = Column(Integer, nullable=False, default=0)
    streak_start_date = Column(Date, nullable=True)
    timeframe_start = Column(Date, nullable=True)
    completed = Column(Boolean, nullable=False, default=False)
    last_checked_date = Column(Date, nullable=True)
    created_at = Column(DateTime, nullable=False)

    user = relationship('User')

    __table_args__ = (
        UniqueConstraint('user_id', 'goal_id', name='uq_user_goal'),
    )

    def to_dict(self):
        return {
            'goal_id': self.goal_id,
            'status': self.status,
            'current_value': self.current_value,
            'target_value': self.target_value,
            'current_streak': self.current_streak,
            'completed': self.completed,
            'streak_start_date': self.streak_start_date.isoformat() if self.streak_start_date else None,
            'timeframe_start': self.timeframe_start.isoformat() if self.timeframe_start else None,
        }


class HeatingUsage(Base):
    __tablename__ = 'heating_usage'

    id = Column(Integer, primary_key=True, autoincrement=True)
    timestamp = Column(DateTime, nullable=False)
    watt_usage = Column(Integer, nullable=False)
    daily_usage_hours = Column(Float, nullable=False)
    date = Column(Date, nullable=False)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False, default=1)

    def to_dict(self):
        return {
            'id': self.id,
            'timestamp': self.timestamp.isoformat() if self.timestamp else None,
            'watt_usage': self.watt_usage,
            'daily_usage_hours': self.daily_usage_hours,
            'date': self.date.isoformat() if self.date else None,
            'user_id': self.user_id,
        }

    @classmethod
    def get_by_date(cls, session, target_date, user_id=1):
        return session.query(cls).filter(cls.date == target_date, cls.user_id == user_id).order_by(cls.timestamp).all()

    @classmethod
    def get_statistics(cls, session, target_date, user_id=1):
        result = session.query(
            func.count(cls.id).label('count'),
            func.avg(cls.watt_usage).label('average'),
            func.max(cls.watt_usage).label('peak'),
            func.min(cls.watt_usage).label('minimum'),
            func.sum(cls.watt_usage).label('total'),
        ).filter(cls.date == target_date, cls.user_id == user_id).first()
        return result

    @classmethod
    def get_date_range(cls, session, user_id=1):
        result = session.query(
            func.min(cls.date).label('earliest'),
            func.max(cls.date).label('latest'),
        ).filter(cls.user_id == user_id).first()
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
