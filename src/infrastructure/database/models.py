from sqlalchemy.orm import declarative_base, Mapped, mapped_column
from sqlalchemy import BigInteger, String, Float, DateTime, Text, Index
from datetime import datetime
import typing

Base = declarative_base()

class TradeModel(Base):
    __tablename__ = 'trades'

    ticket: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    symbol: Mapped[str | None] = mapped_column(String(50), nullable=True)
    side: Mapped[str | None] = mapped_column(String(20), nullable=True)
    volume: Mapped[float | None] = mapped_column(Float, nullable=True)
    open_price: Mapped[float | None] = mapped_column(Float, nullable=True)
    open_time: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    sl: Mapped[float | None] = mapped_column(Float, nullable=True)
    tp: Mapped[float | None] = mapped_column(Float, nullable=True)
    close_price: Mapped[float | None] = mapped_column(Float, nullable=True)
    close_time: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    profit: Mapped[float | None] = mapped_column(Float, nullable=True)
    status: Mapped[str | None] = mapped_column(String(20), nullable=True)
    magic: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    strategy_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    market_context: Mapped[str | None] = mapped_column(Text, nullable=True)

    # I11: Índices para queries freqüentes (trades ativos, histórico por ativo, ord. por data)
    __table_args__ = (
        Index('ix_trades_status', 'status'),
        Index('ix_trades_symbol', 'symbol'),
        Index('ix_trades_close_time', 'close_time'),
        Index('ix_trades_open_time', 'open_time'),
    )


class AuditEventModel(Base):
    __tablename__ = 'audit_events'

    id: Mapped[str] = mapped_column(String(255), primary_key=True)
    timestamp: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    component: Mapped[str | None] = mapped_column(String(50), nullable=True)
    severity: Mapped[str | None] = mapped_column(String(20), nullable=True)
    correlation_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    payload_json: Mapped[str | None] = mapped_column(Text, nullable=True)

    # I11: Índices para queries de auditoria e filtragem por tipo/data
    __table_args__ = (
        Index('ix_audit_timestamp', 'timestamp'),
        Index('ix_audit_type', 'type'),
        Index('ix_audit_severity', 'severity'),
    )
