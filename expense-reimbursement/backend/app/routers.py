from datetime import datetime, date, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import select, func, and_, or_, case
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from pydantic import BaseModel, EmailStr
import io
import random
import openpyxl

from .database import get_db
from .models import (
    User, Department, Project, ExpenseCategory, ExpenseReport, ExpenseItem,
    ExpenseInvoice, ApprovalRecord, Notification,
    UserRole, ReportStatus, ApprovalAction, PaymentType, Base
)
from .auth import (
    hash_password, verify_password, create_access_token, create_refresh_token,
    decode_token, get_current_user, admin_required, manager_or_finance_required,
    finance_required, admin_or_executive_required,
)
from .notifications import notify_user, notify_by_role
from .config import get_settings

router = APIRouter()
settings = get_settings()

# ── 启动时自动建表 ──
from .database import engine

async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

# ───────────── 认证 ─────────────

class LoginReq(BaseModel):
    email: str
    password: str

class RefreshReq(BaseModel):
    refresh_token: str

class ChangePasswordReq(BaseModel):
    old_password: str
    new_password: str

@router.post("/auth/login")
async def login(req: LoginReq, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == req.email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(401, "邮箱或密码错误")
    if not user.is_active:
        raise HTTPException(403, "账号已被禁用")
    access = create_access_token({"sub": str(user.id), "role": user.role})
    refresh = create_refresh_token({"sub": str(user.id)})
    return {"access_token": access, "refresh_token": refresh, "must_change_password": user.must_change_password}

@router.post("/auth/refresh")
async def refresh(req: RefreshReq):
    payload = decode_token(req.refresh_token, is_refresh=True)
    if not payload:
        raise HTTPException(401, "无效的 refresh token")
    access = create_access_token({"sub": payload["sub"], "role": payload.get("role", "employee")})
    return {"access_token": access}

@router.get("/auth/me")
async def me(user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    dept_name = None
    if user.department_id:
        r = await db.execute(select(Department.name).where(Department.id == user.department_id))
        dept_name = r.scalar()
    return {
        "id": user.id, "name": user.name, "email": user.email,
        "department_id": user.department_id, "department_name": dept_name,
        "role": user.role, "is_active": user.is_active,
        "must_change_password": user.must_change_password,
    }

@router.post("/auth/change-password")
async def change_password(req: ChangePasswordReq, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if not verify_password(req.old_password, user.hashed_password):
        raise HTTPException(400, "原密码错误")
    user.hashed_password = hash_password(req.new_password)
    user.must_change_password = False
    await db.flush()
    return {"message": "密码修改成功"}

# ───────────── 部门 ─────────────

class DeptCreate(BaseModel):
    name: str

@router.get("/departments")
async def list_departments(_=Depends(admin_required), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Department))
    depts = result.scalars().all()
    data = []
    for d in depts:
        cnt = await db.scalar(select(func.count(User.id)).where(User.department_id == d.id))
        data.append({"id": d.id, "name": d.name, "user_count": cnt})
    return data

@router.post("/departments")
async def create_department(req: DeptCreate, _=Depends(admin_required), db: AsyncSession = Depends(get_db)):
    exists = await db.scalar(select(Department).where(Department.name == req.name))
    if exists:
        raise HTTPException(400, "部门已存在")
    dept = Department(name=req.name)
    db.add(dept)
    await db.flush()
    return {"id": dept.id, "name": dept.name}

@router.delete("/departments/{dept_id}")
async def delete_department(dept_id: int, _=Depends(admin_required), db: AsyncSession = Depends(get_db)):
    dept = await db.get(Department, dept_id)
    if not dept:
        raise HTTPException(404, "部门不存在")
    cnt = await db.scalar(select(func.count(User.id)).where(User.department_id == dept_id))
    if cnt > 0:
        raise HTTPException(400, f"该部门下还有 {cnt} 名用户，无法删除")
    await db.delete(dept)
    return {"message": "已删除"}

# ───────────── 用户 ─────────────

class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    department_id: Optional[int] = None
    role: UserRole = UserRole.employee

class UserUpdate(BaseModel):
    is_active: Optional[bool] = None

@router.get("/users")
async def list_users(page: int = 1, page_size: int = 20, _=Depends(admin_required), db: AsyncSession = Depends(get_db)):
    offset = (page - 1) * page_size
    total = await db.scalar(select(func.count(User.id)))
    result = await db.execute(
        select(User).options(selectinload(User.department)).offset(offset).limit(page_size)
    )
    users = result.scalars().all()
    items = []
    for u in users:
        items.append({
            "id": u.id, "name": u.name, "email": u.email,
            "department_id": u.department_id, "department_name": u.department.name if u.department else None,
            "role": u.role, "is_active": u.is_active,
        })
    return {"items": items, "total": total}

@router.post("/users")
async def create_user(req: UserCreate, _=Depends(admin_required), db: AsyncSession = Depends(get_db)):
    exists = await db.scalar(select(User).where(User.email == req.email))
    if exists:
        raise HTTPException(400, "邮箱已被使用")
    user = User(
        name=req.name, email=req.email,
        hashed_password=hash_password(req.password),
        department_id=req.department_id, role=req.role,
    )
    db.add(user)
    await db.flush()
    return {"id": user.id, "message": "创建成功"}

@router.put("/users/{user_id}")
async def update_user(user_id: int, req: UserUpdate, _=Depends(admin_required), db: AsyncSession = Depends(get_db)):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(404, "用户不存在")
    if req.is_active is not None:
        user.is_active = req.is_active
    await db.flush()
    return {"message": "更新成功"}

# ───────────── 项目 ─────────────

class ProjectCreate(BaseModel):
    name: str
    client_name: Optional[str] = None
    project_code: Optional[str] = None

class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    client_name: Optional[str] = None
    project_code: Optional[str] = None
    status: Optional[str] = None

@router.get("/projects")
async def list_projects(include_archived: bool = False, _=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    q = select(Project)
    if not include_archived:
        q = q.where(Project.status == "active")
    result = await db.execute(q)
    projects = result.scalars().all()
    return [{"id": p.id, "name": p.name, "client_name": p.client_name, "project_code": p.project_code, "status": p.status} for p in projects]

@router.post("/projects")
async def create_project(req: ProjectCreate, _=Depends(admin_required), db: AsyncSession = Depends(get_db)):
    p = Project(name=req.name, client_name=req.client_name, project_code=req.project_code)
    db.add(p)
    await db.flush()
    return {"id": p.id, "message": "创建成功"}

@router.put("/projects/{project_id}")
async def update_project(project_id: int, req: ProjectUpdate, _=Depends(admin_required), db: AsyncSession = Depends(get_db)):
    p = await db.get(Project, project_id)
    if not p:
        raise HTTPException(404, "项目不存在")
    if req.name is not None:
        p.name = req.name
    if req.client_name is not None:
        p.client_name = req.client_name
    if req.project_code is not None:
        p.project_code = req.project_code
    if req.status is not None:
        p.status = req.status
    await db.flush()
    return {"message": "更新成功"}

# ───────────── 费用类别 ─────────────

class CategoryCreate(BaseModel):
    name: str

@router.get("/categories")
async def list_categories(_=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ExpenseCategory))
    cats = result.scalars().all()
    return [{"id": c.id, "name": c.name, "is_active": c.is_active} for c in cats]

@router.post("/categories")
async def create_category(req: CategoryCreate, _=Depends(finance_required), db: AsyncSession = Depends(get_db)):
    exists = await db.scalar(select(ExpenseCategory).where(ExpenseCategory.name == req.name))
    if exists:
        raise HTTPException(400, "类别已存在")
    c = ExpenseCategory(name=req.name)
    db.add(c)
    await db.flush()
    return {"id": c.id, "message": "创建成功"}

@router.put("/categories/{cat_id}")
async def toggle_category(cat_id: int, is_active: bool = Query(...), _=Depends(finance_required), db: AsyncSession = Depends(get_db)):
    c = await db.get(ExpenseCategory, cat_id)
    if not c:
        raise HTTPException(404, "类别不存在")
    c.is_active = is_active
    await db.flush()
    return {"message": "已更新"}

# ───────────── 报销单 ─────────────

class ExpenseItemReq(BaseModel):
    expense_date: date
    description: str
    amount: float

class ExpenseCreate(BaseModel):
    project_id: Optional[int] = None
    category_id: Optional[int] = None
    payment_type: PaymentType = PaymentType.personal
    payee_name: Optional[str] = None
    payee_account: Optional[str] = None
    payee_bank: Optional[str] = None
    remark: Optional[str] = None
    items: list[ExpenseItemReq] = []

def _gen_report_no(db_session, user_id: int) -> str:
    now = datetime.now()
    return f"BX-{now.strftime('%Y%m%d')}-{user_id:04d}-{random.randint(100, 999)}"

@router.get("/expenses")
async def list_expenses(
    page: int = 1, page_size: int = 20, status: Optional[str] = None,
    user=Depends(get_current_user), db: AsyncSession = Depends(get_db),
):
    q = select(ExpenseReport)
    if user.role not in ("admin", "executive"):
        q = q.where(ExpenseReport.submitter_id == user.id)
    else:
        q = q.where(ExpenseReport.status != "draft")
    if status:
        q = q.where(ExpenseReport.status == status)
    q = q.order_by(ExpenseReport.created_at.desc())

    total = await db.scalar(select(func.count()).select_from(q.subquery()))
    offset = (page - 1) * page_size
    result = await db.execute(
        q.options(
            selectinload(ExpenseReport.submitter),
            selectinload(ExpenseReport.department),
            selectinload(ExpenseReport.project),
            selectinload(ExpenseReport.category),
        ).offset(offset).limit(page_size)
    )
    reports = result.scalars().all()
    items = []
    for r in reports:
        items.append({
            "id": r.id, "report_no": r.report_no,
            "submitter_name": r.submitter.name if r.submitter else "",
            "department_name": r.department.name if r.department else "",
            "project_name": r.project.name if r.project else "",
            "category_name": r.category.name if r.category else "",
            "payment_type": r.payment_type,
            "total_amount": float(r.total_amount),
            "status": r.status,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        })
    return {"items": items, "total": total}

@router.get("/expenses/export")
async def export_expenses(status: Optional[str] = None, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    q = select(ExpenseReport)
    if user.role not in ("admin", "executive"):
        q = q.where(ExpenseReport.submitter_id == user.id)
    if status:
        q = q.where(ExpenseReport.status == status)
    q = q.order_by(ExpenseReport.created_at.desc())
    result = await db.execute(q.options(
        selectinload(ExpenseReport.submitter),
        selectinload(ExpenseReport.department),
        selectinload(ExpenseReport.project),
        selectinload(ExpenseReport.category),
    ))
    reports = result.scalars().all()

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "报销单"
    ws.append(["报销单号", "报销人", "部门", "项目", "费用类别", "付款对象", "金额", "状态", "提交时间", "备注"])
    for r in reports:
        ws.append([
            r.report_no, r.submitter.name if r.submitter else "",
            r.department.name if r.department else "",
            r.project.name if r.project else "",
            r.category.name if r.category else "",
            "对公" if r.payment_type == "company" else "对私",
            float(r.total_amount), r.status,
            r.created_at.strftime("%Y-%m-%d %H:%M") if r.created_at else "",
            r.remark or "",
        ])
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return StreamingResponse(buf, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                             headers={"Content-Disposition": "attachment; filename=expenses.xlsx"})

@router.get("/expenses/{report_id}")
async def get_expense(report_id: int, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ExpenseReport)
        .options(
            selectinload(ExpenseReport.submitter),
            selectinload(ExpenseReport.department),
            selectinload(ExpenseReport.project),
            selectinload(ExpenseReport.category),
            selectinload(ExpenseReport.items).selectinload(ExpenseItem.invoices),
            selectinload(ExpenseReport.approval_records).selectinload(ApprovalRecord.approver),
        )
        .where(ExpenseReport.id == report_id)
    )
    r = result.scalar_one_or_none()
    if not r:
        raise HTTPException(404, "报销单不存在")
    return {
        "id": r.id, "report_no": r.report_no,
        "submitter_name": r.submitter.name if r.submitter else "",
        "department_name": r.department.name if r.department else "",
        "project_name": r.project.name if r.project else "",
        "project_id": r.project_id,
        "category_name": r.category.name if r.category else "",
        "category_id": r.category_id,
        "payment_type": r.payment_type,
        "payee_name": r.payee_name, "payee_account": r.payee_account, "payee_bank": r.payee_bank,
        "total_amount": float(r.total_amount),
        "status": r.status, "remark": r.remark,
        "created_at": r.created_at.isoformat() if r.created_at else None,
        "items": [
            {
                "id": item.id, "expense_date": item.expense_date.isoformat() if item.expense_date else None,
                "description": item.description, "amount": float(item.amount),
                "invoices": [
                    {
                        "id": inv.id, "file_url": inv.file_url, "original_name": inv.original_name,
                        "ocr_invoice_no": inv.ocr_invoice_no,
                        "ocr_amount": float(inv.ocr_amount) if inv.ocr_amount else None,
                    }
                    for inv in item.invoices
                ],
            }
            for item in r.items
        ],
        "approval_records": [
            {
                "approver_name": rec.approver.name if rec.approver else "",
                "approver_role": rec.approver_role,
                "action": rec.action, "comment": rec.comment,
                "created_at": rec.created_at.isoformat() if rec.created_at else None,
            }
            for rec in r.approval_records
        ],
    }

@router.post("/expenses")
async def create_expense(req: ExpenseCreate, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    total = sum(item.amount for item in req.items)
    report = ExpenseReport(
        report_no=_gen_report_no(db, user.id),
        submitter_id=user.id,
        department_id=user.department_id,
        project_id=req.project_id,
        category_id=req.category_id,
        payment_type=req.payment_type,
        payee_name=req.payee_name,
        payee_account=req.payee_account,
        payee_bank=req.payee_bank,
        total_amount=total,
        remark=req.remark,
        status=ReportStatus.draft,
    )
    db.add(report)
    await db.flush()
    for item_req in req.items:
        item = ExpenseItem(
            report_id=report.id,
            expense_date=item_req.expense_date,
            description=item_req.description,
            amount=item_req.amount,
        )
        db.add(item)
    await db.flush()
    return {"id": report.id, "report_no": report.report_no}

@router.put("/expenses/{report_id}")
async def update_expense(report_id: int, req: ExpenseCreate, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    r = await db.get(ExpenseReport, report_id)
    if not r:
        raise HTTPException(404, "报销单不存在")
    if r.status not in (ReportStatus.draft, ReportStatus.returned):
        raise HTTPException(400, "只能修改草稿或退回的报销单")
    r.project_id = req.project_id
    r.category_id = req.category_id
    r.payment_type = req.payment_type
    r.payee_name = req.payee_name
    r.payee_account = req.payee_account
    r.payee_bank = req.payee_bank
    r.remark = req.remark
    r.total_amount = sum(item.amount for item in req.items)

    # 删除旧明细
    old_items = await db.execute(select(ExpenseItem).where(ExpenseItem.report_id == report_id))
    for oi in old_items.scalars().all():
        await db.delete(oi)
    # 写入新明细
    for item_req in req.items:
        item = ExpenseItem(
            report_id=report_id,
            expense_date=item_req.expense_date,
            description=item_req.description,
            amount=item_req.amount,
        )
        db.add(item)
    await db.flush()
    return {"message": "修改成功"}

@router.delete("/expenses/{report_id}")
async def delete_expense(report_id: int, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    r = await db.get(ExpenseReport, report_id)
    if not r:
        raise HTTPException(404, "报销单不存在")
    if r.status not in (ReportStatus.draft, ReportStatus.returned):
        raise HTTPException(400, "只能删除草稿或退回的报销单")
    await db.delete(r)
    return {"message": "已删除"}

@router.post("/expenses/{report_id}/submit")
async def submit_expense(report_id: int, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    r = await db.get(ExpenseReport, report_id)
    if not r:
        raise HTTPException(404, "报销单不存在")
    if r.status not in (ReportStatus.draft, ReportStatus.returned):
        raise HTTPException(400, "当前状态不可提交")
    r.status = ReportStatus.submitted
    await db.flush()

    # 通知部门经理
    if r.department_id:
        managers = await db.execute(
            select(User).where(User.department_id == r.department_id, User.role == UserRole.manager)
        )
        for m in managers.scalars().all():
            await notify_user(db, m.id, f"员工 {user.name} 提交了报销单 {r.report_no}，待您审批")
    return {"message": "提交成功"}

class ApprovalReq(BaseModel):
    action: str  # approve / reject / return
    comment: Optional[str] = None

@router.post("/expenses/{report_id}/approve")
async def approve_expense(
    report_id: int, req: ApprovalReq,
    user=Depends(manager_or_finance_required), db: AsyncSession = Depends(get_db),
):
    r = await db.get(ExpenseReport, report_id)
    if not r:
        raise HTTPException(404, "报销单不存在")

    if user.role == "manager" and r.status != ReportStatus.submitted:
        raise HTTPException(400, "当前状态不可审批")
    if user.role == "finance" and r.status != ReportStatus.manager_approved:
        raise HTTPException(400, "当前状态不可审核")

    rec = ApprovalRecord(
        report_id=report_id, approver_id=user.id,
        approver_role=user.role,
        action=ApprovalAction(req.action) if req.action != "return" else ApprovalAction.return_,
        comment=req.comment,
    )
    db.add(rec)

    if req.action == "approve":
        if user.role == "manager":
            r.status = ReportStatus.manager_approved
            # 通知财务
            await notify_by_role(db, "finance", f"报销单 {r.report_no} 已通过经理审批，待您审核打款")
        elif user.role == "finance":
            r.status = ReportStatus.paid
            # 通知员工
            await notify_user(db, r.submitter_id, f"您的报销单 {r.report_no} 已打款")
    elif req.action == "reject":
        r.status = ReportStatus.rejected
        await notify_user(db, r.submitter_id, f"您的报销单 {r.report_no} 已被驳回: {req.comment or ''}")
    elif req.action == "return":
        r.status = ReportStatus.returned
        await notify_user(db, r.submitter_id, f"您的报销单 {r.report_no} 被退回修改: {req.comment or ''}")
    else:
        raise HTTPException(400, "无效的操作")

    await db.flush()
    return {"message": "操作成功"}

# ───────────── 审批 ─────────────

@router.get("/approvals/pending")
async def pending_approvals(user=Depends(manager_or_finance_required), db: AsyncSession = Depends(get_db)):
    if user.role == "manager":
        q = select(ExpenseReport).where(
            ExpenseReport.status == ReportStatus.submitted,
            ExpenseReport.department_id == user.department_id,
        )
    else:
        q = select(ExpenseReport).where(ExpenseReport.status == ReportStatus.manager_approved)

    result = await db.execute(q.options(
        selectinload(ExpenseReport.submitter),
        selectinload(ExpenseReport.department),
        selectinload(ExpenseReport.project),
        selectinload(ExpenseReport.category),
    ).order_by(ExpenseReport.created_at.desc()))
    reports = result.scalars().all()
    return [
        {
            "id": r.id, "report_no": r.report_no,
            "submitter_name": r.submitter.name if r.submitter else "",
            "department_name": r.department.name if r.department else "",
            "project_name": r.project.name if r.project else "",
            "category_name": r.category.name if r.category else "",
            "total_amount": float(r.total_amount),
            "status": r.status,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in reports
    ]

# ───────────── 文件上传 ─────────────

@router.post("/expenses/{report_id}/items/{item_id}/upload")
async def upload_invoice(
    report_id: int, item_id: int,
    file: UploadFile = File(...),
    user=Depends(get_current_user), db: AsyncSession = Depends(get_db),
):
    r = await db.get(ExpenseReport, report_id)
    if not r or r.status not in (ReportStatus.draft, ReportStatus.returned):
        raise HTTPException(400, "报销单状态不可上传")

    item = await db.get(ExpenseItem, item_id)
    if not item or item.report_id != report_id:
        raise HTTPException(404, "费用明细不存在")

    # 读取文件内容
    content = await file.read()
    file_url = ""
    original_name = file.filename or "invoice"

    # 尝试上传到 Supabase Storage
    if settings.supabase_url and settings.supabase_service_key:
        try:
            from supabase import create_client, Client
            supabase: Client = create_client(settings.supabase_url, settings.supabase_service_key)
            file_ext = original_name.rsplit(".", 1)[-1] if "." in original_name else "jpg"
            path = f"{report_id}/{item_id}/{datetime.now().strftime('%Y%m%d%H%M%S')}.{file_ext}"
            supabase.storage.from_(settings.supabase_storage_bucket).upload(
                path, content,
                {"content-type": file.content_type or "image/jpeg"},
            )
            file_url = supabase.storage.from_(settings.supabase_storage_bucket).get_public_url(path)
        except Exception:
            pass  # 降级到 base64

    if not file_url:
        import base64
        mime = file.content_type or "image/jpeg"
        b64 = base64.b64encode(content).decode()
        file_url = f"data:{mime};base64,{b64}"

    # OCR（如果开启）
    ocr_invoice_no = None
    ocr_amount = None
    if settings.ocr_enabled:
        try:
            from .ocr import extract_invoice_info
            ocr_invoice_no, ocr_amount = extract_invoice_info(content)
        except Exception:
            pass

    inv = ExpenseInvoice(
        item_id=item_id, file_url=file_url, original_name=original_name,
        ocr_invoice_no=ocr_invoice_no, ocr_amount=ocr_amount,
    )
    db.add(inv)
    await db.flush()
    return {"id": inv.id, "file_url": file_url, "ocr_invoice_no": ocr_invoice_no, "ocr_amount": float(ocr_amount) if ocr_amount else None}

# ───────────── 通知 ─────────────

@router.get("/notifications")
async def list_notifications(
    page: int = 1, page_size: int = 20, unread_only: bool = False,
    user=Depends(get_current_user), db: AsyncSession = Depends(get_db),
):
    q = select(Notification).where(Notification.recipient_id == user.id)
    if unread_only:
        q = q.where(Notification.is_read == False)
    q = q.order_by(Notification.created_at.desc())

    total = await db.scalar(select(func.count()).select_from(q.subquery()))
    offset = (page - 1) * page_size
    result = await db.execute(q.offset(offset).limit(page_size))
    notifs = result.scalars().all()
    return {
        "items": [
            {"id": n.id, "content": n.content, "is_read": n.is_read, "created_at": n.created_at.isoformat()}
            for n in notifs
        ],
        "total": total,
    }

@router.get("/notifications/unread-count")
async def unread_count(user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    cnt = await db.scalar(
        select(func.count(Notification.id)).where(
            Notification.recipient_id == user.id, Notification.is_read == False
        )
    )
    return {"count": cnt}

@router.put("/notifications/{notif_id}/read")
async def mark_read(notif_id: int, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    n = await db.get(Notification, notif_id)
    if n and n.recipient_id == user.id:
        n.is_read = True
        await db.flush()
    return {"message": "ok"}

@router.put("/notifications/read-all")
async def mark_all_read(user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Notification).where(Notification.recipient_id == user.id, Notification.is_read == False)
    )
    for n in result.scalars().all():
        n.is_read = True
    await db.flush()
    return {"message": "ok"}

# ───────────── 统计 ─────────────

@router.get("/statistics")
async def get_statistics(_=Depends(admin_or_executive_required), db: AsyncSession = Depends(get_db)):
    total_paid = await db.scalar(
        select(func.sum(ExpenseReport.total_amount)).where(ExpenseReport.status == ReportStatus.paid)
    )
    # 按类别
    result = await db.execute(
        select(
            ExpenseCategory.name,
            func.count(ExpenseReport.id),
            func.sum(ExpenseReport.total_amount),
        )
        .join(ExpenseReport, ExpenseReport.category_id == ExpenseCategory.id, isouter=True)
        .where(ExpenseReport.status == ReportStatus.paid)
        .group_by(ExpenseCategory.id, ExpenseCategory.name)
    )
    by_category = [
        {"category_name": row[0], "count": row[1], "total_amount": float(row[2] or 0)}
        for row in result.all()
    ]
    return {"total_paid": float(total_paid or 0), "by_category": by_category}
