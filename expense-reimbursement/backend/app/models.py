from sqlalchemy import Column, Integer, String, Text, Date, DateTime, Boolean, Numeric, Enum, ForeignKey
from sqlalchemy.orm import declarative_base, relationship
from sqlalchemy.sql import func
import enum

Base = declarative_base()


class UserRole(str, enum.Enum):
    employee = "employee"
    manager = "manager"
    finance = "finance"
    admin = "admin"
    executive = "executive"


class ProjectStatus(str, enum.Enum):
    active = "active"
    archived = "archived"


class PaymentType(str, enum.Enum):
    personal = "personal"
    company = "company"


class ReportStatus(str, enum.Enum):
    draft = "draft"
    submitted = "submitted"
    manager_approved = "manager_approved"
    finance_approved = "finance_approved"
    paid = "paid"
    rejected = "rejected"
    returned = "returned"


class ApprovalAction(str, enum.Enum):
    approve = "approve"
    reject = "reject"
    return_ = "return"


class Department(Base):
    __tablename__ = "departments"
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), unique=True, nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    users = relationship("User", back_populates="department")


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(50), nullable=False)
    email = Column(String(120), unique=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    department_id = Column(Integer, ForeignKey("departments.id", ondelete="SET NULL"), nullable=True)
    role = Column(Enum(UserRole), default=UserRole.employee, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    must_change_password = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    department = relationship("Department", back_populates="users")


class Project(Base):
    __tablename__ = "projects"
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(200), nullable=False)
    client_name = Column(String(200))
    project_code = Column(String(100))
    status = Column(Enum(ProjectStatus), default=ProjectStatus.active, nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class ExpenseCategory(Base):
    __tablename__ = "expense_categories"
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), unique=True, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class ExpenseReport(Base):
    __tablename__ = "expense_reports"
    id = Column(Integer, primary_key=True, autoincrement=True)
    report_no = Column(String(30), unique=True, nullable=False)
    submitter_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    department_id = Column(Integer, ForeignKey("departments.id", ondelete="SET NULL"), nullable=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="SET NULL"), nullable=True)
    category_id = Column(Integer, ForeignKey("expense_categories.id", ondelete="SET NULL"), nullable=True)
    payment_type = Column(Enum(PaymentType), default=PaymentType.personal, nullable=False)
    payee_name = Column(String(100))
    payee_account = Column(String(50))
    payee_bank = Column(String(200))
    total_amount = Column(Numeric(12, 2), default=0.00, nullable=False)
    status = Column(Enum(ReportStatus), default=ReportStatus.draft, nullable=False)
    remark = Column(Text)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    submitter = relationship("User")
    department = relationship("Department")
    project = relationship("Project")
    category = relationship("ExpenseCategory")
    items = relationship("ExpenseItem", back_populates="report", cascade="all, delete-orphan")
    approval_records = relationship("ApprovalRecord", back_populates="report", cascade="all, delete-orphan")


class ExpenseItem(Base):
    __tablename__ = "expense_items"
    id = Column(Integer, primary_key=True, autoincrement=True)
    report_id = Column(Integer, ForeignKey("expense_reports.id", ondelete="CASCADE"), nullable=False)
    expense_date = Column(Date, nullable=False)
    description = Column(String(500), nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    report = relationship("ExpenseReport", back_populates="items")
    invoices = relationship("ExpenseInvoice", back_populates="item", cascade="all, delete-orphan")


class ExpenseInvoice(Base):
    __tablename__ = "expense_invoices"
    id = Column(Integer, primary_key=True, autoincrement=True)
    item_id = Column(Integer, ForeignKey("expense_items.id", ondelete="CASCADE"), nullable=False)
    file_url = Column(Text, nullable=False)
    original_name = Column(String(255))
    ocr_invoice_no = Column(String(50))
    ocr_amount = Column(Numeric(12, 2))
    created_at = Column(DateTime, server_default=func.now())
    item = relationship("ExpenseItem", back_populates="invoices")


class ApprovalRecord(Base):
    __tablename__ = "approval_records"
    id = Column(Integer, primary_key=True, autoincrement=True)
    report_id = Column(Integer, ForeignKey("expense_reports.id", ondelete="CASCADE"), nullable=False)
    approver_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    approver_role = Column(String(20), nullable=False)
    action = Column(Enum(ApprovalAction), nullable=False)
    comment = Column(Text)
    created_at = Column(DateTime, server_default=func.now())
    report = relationship("ExpenseReport", back_populates="approval_records")
    approver = relationship("User")


class Notification(Base):
    __tablename__ = "notifications"
    id = Column(Integer, primary_key=True, autoincrement=True)
    recipient_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    content = Column(String(500), nullable=False)
    is_read = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, server_default=func.now())
