from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, BackgroundTasks
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt
import httpx
import calendar
import asyncio
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

# Twilio
from twilio.rest import Client as TwilioClient

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Config
JWT_SECRET = os.environ.get('JWT_SECRET', 'starlink-manager-secret-key-change-in-production')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_DAYS = 7

# Twilio Config
TWILIO_ACCOUNT_SID = os.environ.get('TWILIO_ACCOUNT_SID')
TWILIO_AUTH_TOKEN = os.environ.get('TWILIO_AUTH_TOKEN')
TWILIO_PHONE_NUMBER = os.environ.get('TWILIO_PHONE_NUMBER')

# SMTP Config
SMTP_EMAIL = os.environ.get('SMTP_EMAIL')
SMTP_PASSWORD = os.environ.get('SMTP_PASSWORD')
SMTP_HOST = os.environ.get('SMTP_HOST', 'smtp.gmail.com')
SMTP_PORT = int(os.environ.get('SMTP_PORT', '587'))

app = FastAPI(title="Starlink Manager API")
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ==================== MODELS ====================

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    phone_number: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserUpdate(BaseModel):
    name: Optional[str] = None
    phone_number: Optional[str] = None

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    phone_number: Optional[str] = None
    role: str = "viewer"
    created_at: datetime

class StarlinkAccountCreate(BaseModel):
    account_name: str
    location: str
    account_email: EmailStr
    kit_number: str
    notes: Optional[str] = ""
    billing_day: int = 1
    monthly_amount: float = 0.0

class StarlinkAccountUpdate(BaseModel):
    account_name: Optional[str] = None
    location: Optional[str] = None
    account_email: Optional[EmailStr] = None
    kit_number: Optional[str] = None
    notes: Optional[str] = None
    billing_day: Optional[int] = None
    monthly_amount: Optional[float] = None
    is_online: Optional[bool] = None
    devices_connected: Optional[int] = None
    status: Optional[str] = None  # active, inactive, cancelled

class StarlinkAccount(BaseModel):
    model_config = ConfigDict(extra="ignore")
    account_id: str
    account_name: str
    location: str
    account_email: str
    kit_number: str
    notes: str = ""
    billing_day: int = 1
    monthly_amount: float = 0.0
    is_online: bool = True
    devices_connected: int = 0
    status: str = "active"  # active, inactive, cancelled
    last_checked: datetime
    user_id: str
    created_at: datetime

class BillingRecordCreate(BaseModel):
    amount: float
    payment_date: datetime
    payment_method: Optional[str] = "manual"
    notes: Optional[str] = ""
    is_paid: bool = True

class BillingRecord(BaseModel):
    model_config = ConfigDict(extra="ignore")
    billing_id: str
    account_id: str
    amount: float
    payment_date: datetime
    payment_method: str = "manual"
    notes: str = ""
    is_paid: bool = True
    created_at: datetime

class SupportTicketCreate(BaseModel):
    title: str
    description: str
    priority: str = "medium"

class SupportTicketUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None

class SupportTicket(BaseModel):
    model_config = ConfigDict(extra="ignore")
    ticket_id: str
    account_id: str
    title: str
    description: str
    priority: str = "medium"
    status: str = "open"
    created_at: datetime
    updated_at: datetime

class ExtenderCreate(BaseModel):
    name: str
    ip_address: Optional[str] = ""
    location: Optional[str] = ""

class ExtenderUpdate(BaseModel):
    name: Optional[str] = None
    ip_address: Optional[str] = None
    location: Optional[str] = None
    is_online: Optional[bool] = None

class Extender(BaseModel):
    model_config = ConfigDict(extra="ignore")
    extender_id: str
    account_id: str
    name: str
    ip_address: str = ""
    location: str = ""
    is_online: bool = True
    devices_connected: int = 0
    created_at: datetime

class DeviceCreate(BaseModel):
    name: str
    mac_address: str
    device_type: Optional[str] = "unknown"
    extender_id: Optional[str] = None

class DeviceUpdate(BaseModel):
    name: Optional[str] = None
    mac_address: Optional[str] = None
    device_type: Optional[str] = None
    is_whitelisted: Optional[bool] = None
    extender_id: Optional[str] = None

class Device(BaseModel):
    model_config = ConfigDict(extra="ignore")
    device_id: str
    account_id: str
    extender_id: Optional[str] = None
    name: str
    mac_address: str
    device_type: str = "unknown"
    is_whitelisted: bool = True
    created_at: datetime

class Notification(BaseModel):
    model_config = ConfigDict(extra="ignore")
    notification_id: str
    user_id: str
    account_id: Optional[str] = None
    title: str
    message: str
    notification_type: str  # payment_reminder, system, alert
    is_read: bool = False
    created_at: datetime

class NotificationCreate(BaseModel):
    title: str
    message: str
    notification_type: str = "system"
    account_id: Optional[str] = None

# ==================== NOTIFICATION HELPERS ====================

def send_email_sync(to_email: str, subject: str, body: str):
    """Send email using Gmail SMTP"""
    try:
        msg = MIMEMultipart()
        msg['From'] = SMTP_EMAIL
        msg['To'] = to_email
        msg['Subject'] = subject
        msg.attach(MIMEText(body, 'html'))
        
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_EMAIL, SMTP_PASSWORD)
            server.send_message(msg)
        logger.info(f"Email sent to {to_email}")
        return True
    except Exception as e:
        logger.error(f"Failed to send email: {e}")
        return False

def send_sms_sync(to_phone: str, message: str):
    """Send SMS using Twilio"""
    try:
        if not all([TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER]):
            logger.warning("Twilio credentials not configured")
            return False
        
        twilio_client = TwilioClient(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
        twilio_client.messages.create(
            body=message,
            from_=TWILIO_PHONE_NUMBER,
            to=to_phone
        )
        logger.info(f"SMS sent to {to_phone}")
        return True
    except Exception as e:
        logger.error(f"Failed to send SMS: {e}")
        return False

async def create_notification(user_id: str, title: str, message: str, notification_type: str, account_id: str = None):
    """Create in-app notification"""
    now = datetime.now(timezone.utc)
    notification_id = f"notif_{uuid.uuid4().hex[:12]}"
    
    doc = {
        "notification_id": notification_id,
        "user_id": user_id,
        "account_id": account_id,
        "title": title,
        "message": message,
        "notification_type": notification_type,
        "is_read": False,
        "created_at": now.isoformat()
    }
    await db.notifications.insert_one(doc)
    return notification_id

def get_next_billing_date(billing_day: int, from_date: datetime = None) -> datetime:
    """Calculate next billing date, handling months with different days"""
    if from_date is None:
        from_date = datetime.now(timezone.utc)
    
    year = from_date.year
    month = from_date.month
    
    # Get last day of current month
    _, last_day = calendar.monthrange(year, month)
    
    # Adjust billing day if it exceeds month's days
    actual_billing_day = min(billing_day, last_day)
    
    # Check if billing date has passed this month
    if from_date.day >= actual_billing_day:
        # Move to next month
        if month == 12:
            year += 1
            month = 1
        else:
            month += 1
        _, last_day = calendar.monthrange(year, month)
        actual_billing_day = min(billing_day, last_day)
    
    return datetime(year, month, actual_billing_day, tzinfo=timezone.utc)

async def send_payment_reminders(background_tasks: BackgroundTasks = None):
    """Check and send payment reminders for upcoming billing dates"""
    now = datetime.now(timezone.utc)
    
    # Get all active accounts
    accounts = await db.starlink_accounts.find({"status": "active"}, {"_id": 0}).to_list(1000)
    
    for account in accounts:
        billing_day = account.get("billing_day", 1)
        next_billing = get_next_billing_date(billing_day, now)
        days_until = (next_billing - now).days
        
        # Send reminders for 5, 3, and 1 days before
        if days_until in [5, 3, 1]:
            user = await db.users.find_one({"user_id": account["user_id"]}, {"_id": 0})
            if not user:
                continue
            
            title = f"Payment Reminder: {account['account_name']}"
            message = f"Payment of ${account['monthly_amount']:.2f} for {account['account_name']} is due in {days_until} day(s) on day {billing_day}."
            
            # Check if reminder already sent today for this account
            existing = await db.notifications.find_one({
                "account_id": account["account_id"],
                "notification_type": "payment_reminder",
                "created_at": {"$gte": now.replace(hour=0, minute=0, second=0).isoformat()}
            }, {"_id": 0})
            
            if existing:
                continue
            
            # Create in-app notification
            await create_notification(
                user_id=user["user_id"],
                title=title,
                message=message,
                notification_type="payment_reminder",
                account_id=account["account_id"]
            )
            
            # Send email
            email_body = f"""
            <h2>Payment Reminder</h2>
            <p>Hello {user['name']},</p>
            <p>This is a reminder that your Starlink payment is coming up:</p>
            <ul>
                <li><strong>Account:</strong> {account['account_name']}</li>
                <li><strong>Location:</strong> {account['location']}</li>
                <li><strong>Amount:</strong> ${account['monthly_amount']:.2f}</li>
                <li><strong>Due Date:</strong> Day {billing_day} ({days_until} days away)</li>
            </ul>
            <p>Please ensure payment is made on time to avoid service interruption.</p>
            <p>Best regards,<br>Starlink Manager</p>
            """
            send_email_sync(user["email"], title, email_body)
            
            # Send SMS if phone number available
            if user.get("phone_number"):
                sms_message = f"Starlink Payment Reminder: ${account['monthly_amount']:.2f} for {account['account_name']} due in {days_until} day(s)."
                send_sms_sync(user["phone_number"], sms_message)

# ==================== AUTH HELPERS ====================

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_jwt_token(user_id: str) -> str:
    payload = {
        "user_id": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRATION_DAYS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(request: Request) -> User:
    # Check session_token cookie first (for Google OAuth)
    session_token = request.cookies.get("session_token")
    if session_token:
        session = await db.user_sessions.find_one({"session_token": session_token}, {"_id": 0})
        if session:
            expires_at = session.get("expires_at")
            if isinstance(expires_at, str):
                expires_at = datetime.fromisoformat(expires_at)
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            if expires_at > datetime.now(timezone.utc):
                user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
                if user:
                    if isinstance(user.get('created_at'), str):
                        user['created_at'] = datetime.fromisoformat(user['created_at'])
                    return User(**user)
    
    # Check Authorization header (for JWT)
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
            user = await db.users.find_one({"user_id": payload["user_id"]}, {"_id": 0})
            if user:
                if isinstance(user.get('created_at'), str):
                    user['created_at'] = datetime.fromisoformat(user['created_at'])
                return User(**user)
        except jwt.ExpiredSignatureError:
            raise HTTPException(status_code=401, detail="Token expired")
        except jwt.InvalidTokenError:
            pass
    
    raise HTTPException(status_code=401, detail="Not authenticated")

# ==================== AUTH ENDPOINTS ====================

@api_router.post("/auth/register")
async def register(user_data: UserCreate):
    existing = await db.users.find_one({"email": user_data.email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc)
    
    user_doc = {
        "user_id": user_id,
        "email": user_data.email,
        "name": user_data.name,
        "password_hash": hash_password(user_data.password),
        "picture": None,
        "phone_number": user_data.phone_number,
        "role": "admin",
        "created_at": now.isoformat()
    }
    await db.users.insert_one(user_doc)
    
    token = create_jwt_token(user_id)
    return {
        "token": token,
        "user": {
            "user_id": user_id,
            "email": user_data.email,
            "name": user_data.name,
            "phone_number": user_data.phone_number,
            "role": "admin"
        }
    }

@api_router.post("/auth/login")
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user or not user.get("password_hash"):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not verify_password(credentials.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_jwt_token(user["user_id"])
    return {
        "token": token,
        "user": {
            "user_id": user["user_id"],
            "email": user["email"],
            "name": user["name"],
            "phone_number": user.get("phone_number"),
            "role": user.get("role", "viewer")
        }
    }

@api_router.get("/auth/session")
async def get_session(request: Request, response: Response):
    """Exchange session_id for session_token (Google OAuth callback)"""
    session_id = request.headers.get("X-Session-ID")
    if not session_id:
        raise HTTPException(status_code=400, detail="Session ID required")
    
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": session_id}
        )
        if resp.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid session")
        
        data = resp.json()
    
    # Check if user exists, create if not
    user = await db.users.find_one({"email": data["email"]}, {"_id": 0})
    now = datetime.now(timezone.utc)
    
    if not user:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        user_doc = {
            "user_id": user_id,
            "email": data["email"],
            "name": data["name"],
            "picture": data.get("picture"),
            "phone_number": None,
            "role": "admin",
            "created_at": now.isoformat()
        }
        await db.users.insert_one(user_doc)
    else:
        user_id = user["user_id"]
        # Update user info if needed
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"name": data["name"], "picture": data.get("picture")}}
        )
    
    # Create session
    session_token = data["session_token"]
    expires_at = now + timedelta(days=7)
    
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": expires_at.isoformat(),
        "created_at": now.isoformat()
    })
    
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=7 * 24 * 60 * 60
    )
    
    user_data = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    return user_data

@api_router.get("/auth/me")
async def get_me(user: User = Depends(get_current_user)):
    return user

@api_router.put("/auth/me")
async def update_me(update: UserUpdate, user: User = Depends(get_current_user)):
    update_data = {k: v for k, v in update.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No update data provided")
    
    await db.users.update_one({"user_id": user.user_id}, {"$set": update_data})
    updated_user = await db.users.find_one({"user_id": user.user_id}, {"_id": 0, "password_hash": 0})
    if isinstance(updated_user.get('created_at'), str):
        updated_user['created_at'] = datetime.fromisoformat(updated_user['created_at'])
    return User(**updated_user)

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    session_token = request.cookies.get("session_token")
    if session_token:
        await db.user_sessions.delete_one({"session_token": session_token})
    response.delete_cookie("session_token", path="/", secure=True, samesite="none")
    return {"message": "Logged out"}

# ==================== STARLINK ACCOUNTS ====================

@api_router.post("/accounts", response_model=StarlinkAccount)
async def create_account(account: StarlinkAccountCreate, user: User = Depends(get_current_user)):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Validate billing day (1-31)
    if account.billing_day < 1 or account.billing_day > 31:
        raise HTTPException(status_code=400, detail="Billing day must be between 1 and 31")
    
    now = datetime.now(timezone.utc)
    account_id = f"acc_{uuid.uuid4().hex[:12]}"
    
    doc = {
        "account_id": account_id,
        "account_name": account.account_name,
        "location": account.location,
        "account_email": account.account_email,
        "kit_number": account.kit_number,
        "notes": account.notes or "",
        "billing_day": account.billing_day,
        "monthly_amount": account.monthly_amount,
        "is_online": True,
        "devices_connected": 0,
        "status": "active",
        "last_checked": now.isoformat(),
        "user_id": user.user_id,
        "created_at": now.isoformat()
    }
    await db.starlink_accounts.insert_one(doc)
    doc['last_checked'] = now
    doc['created_at'] = now
    return StarlinkAccount(**doc)

@api_router.get("/accounts", response_model=List[StarlinkAccount])
async def get_accounts(
    search: Optional[str] = None,
    status: Optional[str] = None,
    account_status: Optional[str] = None,
    user: User = Depends(get_current_user)
):
    query = {}
    if search:
        query["$or"] = [
            {"account_name": {"$regex": search, "$options": "i"}},
            {"location": {"$regex": search, "$options": "i"}},
            {"account_email": {"$regex": search, "$options": "i"}},
            {"kit_number": {"$regex": search, "$options": "i"}}
        ]
    if status == "online":
        query["is_online"] = True
    elif status == "offline":
        query["is_online"] = False
    if account_status:
        query["status"] = account_status
    
    accounts = await db.starlink_accounts.find(query, {"_id": 0}).to_list(1000)
    for acc in accounts:
        if isinstance(acc.get('last_checked'), str):
            acc['last_checked'] = datetime.fromisoformat(acc['last_checked'])
        if isinstance(acc.get('created_at'), str):
            acc['created_at'] = datetime.fromisoformat(acc['created_at'])
        if 'status' not in acc:
            acc['status'] = 'active'
    return accounts

@api_router.get("/accounts/{account_id}", response_model=StarlinkAccount)
async def get_account(account_id: str, user: User = Depends(get_current_user)):
    account = await db.starlink_accounts.find_one({"account_id": account_id}, {"_id": 0})
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    if isinstance(account.get('last_checked'), str):
        account['last_checked'] = datetime.fromisoformat(account['last_checked'])
    if isinstance(account.get('created_at'), str):
        account['created_at'] = datetime.fromisoformat(account['created_at'])
    if 'status' not in account:
        account['status'] = 'active'
    return StarlinkAccount(**account)

@api_router.put("/accounts/{account_id}", response_model=StarlinkAccount)
async def update_account(account_id: str, update: StarlinkAccountUpdate, user: User = Depends(get_current_user)):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    update_data = {k: v for k, v in update.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No update data provided")
    
    # Validate billing day if provided
    if 'billing_day' in update_data and (update_data['billing_day'] < 1 or update_data['billing_day'] > 31):
        raise HTTPException(status_code=400, detail="Billing day must be between 1 and 31")
    
    update_data["last_checked"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.starlink_accounts.update_one(
        {"account_id": account_id},
        {"$set": update_data}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Account not found")
    
    return await get_account(account_id, user)

@api_router.delete("/accounts/{account_id}")
async def delete_account(account_id: str, user: User = Depends(get_current_user)):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await db.starlink_accounts.delete_one({"account_id": account_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Account not found")
    
    # Cascade delete related data
    await db.billing_records.delete_many({"account_id": account_id})
    await db.support_tickets.delete_many({"account_id": account_id})
    await db.extenders.delete_many({"account_id": account_id})
    await db.devices.delete_many({"account_id": account_id})
    await db.notifications.delete_many({"account_id": account_id})
    
    return {"message": "Account deleted"}

# ==================== BILLING ====================

@api_router.post("/accounts/{account_id}/billing", response_model=BillingRecord)
async def create_billing_record(account_id: str, billing: BillingRecordCreate, user: User = Depends(get_current_user)):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    account = await db.starlink_accounts.find_one({"account_id": account_id}, {"_id": 0})
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    now = datetime.now(timezone.utc)
    billing_id = f"bill_{uuid.uuid4().hex[:12]}"
    
    doc = {
        "billing_id": billing_id,
        "account_id": account_id,
        "amount": billing.amount,
        "payment_date": billing.payment_date.isoformat(),
        "payment_method": billing.payment_method or "manual",
        "notes": billing.notes or "",
        "is_paid": billing.is_paid,
        "created_at": now.isoformat()
    }
    await db.billing_records.insert_one(doc)
    doc['payment_date'] = billing.payment_date
    doc['created_at'] = now
    return BillingRecord(**doc)

@api_router.get("/accounts/{account_id}/billing", response_model=List[BillingRecord])
async def get_billing_records(account_id: str, user: User = Depends(get_current_user)):
    records = await db.billing_records.find({"account_id": account_id}, {"_id": 0}).sort("payment_date", -1).to_list(1000)
    for rec in records:
        if isinstance(rec.get('payment_date'), str):
            rec['payment_date'] = datetime.fromisoformat(rec['payment_date'])
        if isinstance(rec.get('created_at'), str):
            rec['created_at'] = datetime.fromisoformat(rec['created_at'])
        if 'is_paid' not in rec:
            rec['is_paid'] = True
    return records

@api_router.put("/accounts/{account_id}/billing/{billing_id}")
async def update_billing_record(account_id: str, billing_id: str, is_paid: bool, user: User = Depends(get_current_user)):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await db.billing_records.update_one(
        {"billing_id": billing_id, "account_id": account_id},
        {"$set": {"is_paid": is_paid}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Billing record not found")
    return {"message": "Billing record updated"}

@api_router.delete("/accounts/{account_id}/billing/{billing_id}")
async def delete_billing_record(account_id: str, billing_id: str, user: User = Depends(get_current_user)):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await db.billing_records.delete_one({"billing_id": billing_id, "account_id": account_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Billing record not found")
    return {"message": "Billing record deleted"}

# ==================== SUPPORT TICKETS ====================

@api_router.post("/accounts/{account_id}/tickets", response_model=SupportTicket)
async def create_ticket(account_id: str, ticket: SupportTicketCreate, user: User = Depends(get_current_user)):
    account = await db.starlink_accounts.find_one({"account_id": account_id}, {"_id": 0})
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    now = datetime.now(timezone.utc)
    ticket_id = f"tkt_{uuid.uuid4().hex[:12]}"
    
    doc = {
        "ticket_id": ticket_id,
        "account_id": account_id,
        "title": ticket.title,
        "description": ticket.description,
        "priority": ticket.priority,
        "status": "open",
        "created_at": now.isoformat(),
        "updated_at": now.isoformat()
    }
    await db.support_tickets.insert_one(doc)
    doc['created_at'] = now
    doc['updated_at'] = now
    return SupportTicket(**doc)

@api_router.get("/accounts/{account_id}/tickets", response_model=List[SupportTicket])
async def get_tickets(account_id: str, user: User = Depends(get_current_user)):
    tickets = await db.support_tickets.find({"account_id": account_id}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    for t in tickets:
        if isinstance(t.get('created_at'), str):
            t['created_at'] = datetime.fromisoformat(t['created_at'])
        if isinstance(t.get('updated_at'), str):
            t['updated_at'] = datetime.fromisoformat(t['updated_at'])
    return tickets

@api_router.put("/accounts/{account_id}/tickets/{ticket_id}", response_model=SupportTicket)
async def update_ticket(account_id: str, ticket_id: str, update: SupportTicketUpdate, user: User = Depends(get_current_user)):
    update_data = {k: v for k, v in update.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No update data provided")
    
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.support_tickets.update_one(
        {"ticket_id": ticket_id, "account_id": account_id},
        {"$set": update_data}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    ticket = await db.support_tickets.find_one({"ticket_id": ticket_id}, {"_id": 0})
    if isinstance(ticket.get('created_at'), str):
        ticket['created_at'] = datetime.fromisoformat(ticket['created_at'])
    if isinstance(ticket.get('updated_at'), str):
        ticket['updated_at'] = datetime.fromisoformat(ticket['updated_at'])
    return SupportTicket(**ticket)

@api_router.delete("/accounts/{account_id}/tickets/{ticket_id}")
async def delete_ticket(account_id: str, ticket_id: str, user: User = Depends(get_current_user)):
    result = await db.support_tickets.delete_one({"ticket_id": ticket_id, "account_id": account_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return {"message": "Ticket deleted"}

# ==================== EXTENDERS ====================

@api_router.post("/accounts/{account_id}/extenders", response_model=Extender)
async def create_extender(account_id: str, extender: ExtenderCreate, user: User = Depends(get_current_user)):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    account = await db.starlink_accounts.find_one({"account_id": account_id}, {"_id": 0})
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    now = datetime.now(timezone.utc)
    extender_id = f"ext_{uuid.uuid4().hex[:12]}"
    
    doc = {
        "extender_id": extender_id,
        "account_id": account_id,
        "name": extender.name,
        "ip_address": extender.ip_address or "",
        "location": extender.location or "",
        "is_online": True,
        "devices_connected": 0,
        "created_at": now.isoformat()
    }
    await db.extenders.insert_one(doc)
    doc['created_at'] = now
    return Extender(**doc)

@api_router.get("/accounts/{account_id}/extenders", response_model=List[Extender])
async def get_extenders(account_id: str, user: User = Depends(get_current_user)):
    extenders = await db.extenders.find({"account_id": account_id}, {"_id": 0}).to_list(100)
    for ext in extenders:
        if isinstance(ext.get('created_at'), str):
            ext['created_at'] = datetime.fromisoformat(ext['created_at'])
        # Count devices connected to this extender
        device_count = await db.devices.count_documents({"extender_id": ext["extender_id"]})
        ext['devices_connected'] = device_count
    return extenders

@api_router.put("/accounts/{account_id}/extenders/{extender_id}", response_model=Extender)
async def update_extender(account_id: str, extender_id: str, update: ExtenderUpdate, user: User = Depends(get_current_user)):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    update_data = {k: v for k, v in update.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No update data provided")
    
    result = await db.extenders.update_one(
        {"extender_id": extender_id, "account_id": account_id},
        {"$set": update_data}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Extender not found")
    
    extender = await db.extenders.find_one({"extender_id": extender_id}, {"_id": 0})
    if isinstance(extender.get('created_at'), str):
        extender['created_at'] = datetime.fromisoformat(extender['created_at'])
    device_count = await db.devices.count_documents({"extender_id": extender_id})
    extender['devices_connected'] = device_count
    return Extender(**extender)

@api_router.delete("/accounts/{account_id}/extenders/{extender_id}")
async def delete_extender(account_id: str, extender_id: str, user: User = Depends(get_current_user)):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await db.extenders.delete_one({"extender_id": extender_id, "account_id": account_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Extender not found")
    
    # Update devices to remove extender association
    await db.devices.update_many({"extender_id": extender_id}, {"$set": {"extender_id": None}})
    
    return {"message": "Extender deleted"}

# ==================== DEVICES ====================

@api_router.post("/accounts/{account_id}/devices", response_model=Device)
async def create_device(account_id: str, device: DeviceCreate, user: User = Depends(get_current_user)):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    account = await db.starlink_accounts.find_one({"account_id": account_id}, {"_id": 0})
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    now = datetime.now(timezone.utc)
    device_id = f"dev_{uuid.uuid4().hex[:12]}"
    
    doc = {
        "device_id": device_id,
        "account_id": account_id,
        "extender_id": device.extender_id,
        "name": device.name,
        "mac_address": device.mac_address,
        "device_type": device.device_type or "unknown",
        "is_whitelisted": True,
        "created_at": now.isoformat()
    }
    await db.devices.insert_one(doc)
    
    # Update account device count
    device_count = await db.devices.count_documents({"account_id": account_id})
    await db.starlink_accounts.update_one(
        {"account_id": account_id},
        {"$set": {"devices_connected": device_count, "last_checked": now.isoformat()}}
    )
    
    doc['created_at'] = now
    return Device(**doc)

@api_router.get("/accounts/{account_id}/devices", response_model=List[Device])
async def get_devices(account_id: str, extender_id: Optional[str] = None, user: User = Depends(get_current_user)):
    query = {"account_id": account_id}
    if extender_id:
        query["extender_id"] = extender_id
    
    devices = await db.devices.find(query, {"_id": 0}).to_list(1000)
    for dev in devices:
        if isinstance(dev.get('created_at'), str):
            dev['created_at'] = datetime.fromisoformat(dev['created_at'])
    return devices

@api_router.put("/accounts/{account_id}/devices/{device_id}", response_model=Device)
async def update_device(account_id: str, device_id: str, update: DeviceUpdate, user: User = Depends(get_current_user)):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    update_data = {k: v for k, v in update.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No update data provided")
    
    result = await db.devices.update_one(
        {"device_id": device_id, "account_id": account_id},
        {"$set": update_data}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Device not found")
    
    device = await db.devices.find_one({"device_id": device_id}, {"_id": 0})
    if isinstance(device.get('created_at'), str):
        device['created_at'] = datetime.fromisoformat(device['created_at'])
    return Device(**device)

@api_router.delete("/accounts/{account_id}/devices/{device_id}")
async def delete_device(account_id: str, device_id: str, user: User = Depends(get_current_user)):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await db.devices.delete_one({"device_id": device_id, "account_id": account_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Device not found")
    
    # Update account device count
    now = datetime.now(timezone.utc)
    device_count = await db.devices.count_documents({"account_id": account_id})
    await db.starlink_accounts.update_one(
        {"account_id": account_id},
        {"$set": {"devices_connected": device_count, "last_checked": now.isoformat()}}
    )
    
    return {"message": "Device deleted"}

# ==================== NOTIFICATIONS ====================

@api_router.get("/notifications", response_model=List[Notification])
async def get_notifications(unread_only: bool = False, user: User = Depends(get_current_user)):
    query = {"user_id": user.user_id}
    if unread_only:
        query["is_read"] = False
    
    notifications = await db.notifications.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    for n in notifications:
        if isinstance(n.get('created_at'), str):
            n['created_at'] = datetime.fromisoformat(n['created_at'])
    return notifications

@api_router.get("/notifications/count")
async def get_notification_count(user: User = Depends(get_current_user)):
    count = await db.notifications.count_documents({"user_id": user.user_id, "is_read": False})
    return {"unread_count": count}

@api_router.put("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str, user: User = Depends(get_current_user)):
    result = await db.notifications.update_one(
        {"notification_id": notification_id, "user_id": user.user_id},
        {"$set": {"is_read": True}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"message": "Notification marked as read"}

@api_router.put("/notifications/read-all")
async def mark_all_notifications_read(user: User = Depends(get_current_user)):
    await db.notifications.update_many(
        {"user_id": user.user_id},
        {"$set": {"is_read": True}}
    )
    return {"message": "All notifications marked as read"}

@api_router.delete("/notifications/{notification_id}")
async def delete_notification(notification_id: str, user: User = Depends(get_current_user)):
    result = await db.notifications.delete_one({"notification_id": notification_id, "user_id": user.user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"message": "Notification deleted"}

# ==================== REMINDERS ENDPOINT ====================

@api_router.post("/reminders/check")
async def check_reminders(background_tasks: BackgroundTasks, user: User = Depends(get_current_user)):
    """Manually trigger reminder check (can also be called by cron job)"""
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    background_tasks.add_task(send_payment_reminders)
    return {"message": "Reminder check initiated"}

@api_router.post("/reminders/test-email")
async def test_email(user: User = Depends(get_current_user)):
    """Test email sending"""
    success = send_email_sync(
        user.email,
        "Starlink Manager - Test Email",
        f"<h2>Test Email</h2><p>Hello {user.name}, this is a test email from Starlink Manager.</p>"
    )
    return {"success": success, "message": "Test email sent" if success else "Failed to send email"}

@api_router.post("/reminders/test-sms")
async def test_sms(user: User = Depends(get_current_user)):
    """Test SMS sending"""
    if not user.phone_number:
        raise HTTPException(status_code=400, detail="Phone number not set in profile")
    
    success = send_sms_sync(user.phone_number, f"Starlink Manager Test: Hello {user.name}!")
    return {"success": success, "message": "Test SMS sent" if success else "Failed to send SMS"}

# ==================== DASHBOARD STATS ====================

@api_router.get("/dashboard/stats")
async def get_dashboard_stats(user: User = Depends(get_current_user)):
    total_accounts = await db.starlink_accounts.count_documents({})
    online_accounts = await db.starlink_accounts.count_documents({"is_online": True})
    offline_accounts = total_accounts - online_accounts
    active_accounts = await db.starlink_accounts.count_documents({"status": "active"})
    inactive_accounts = await db.starlink_accounts.count_documents({"status": {"$in": ["inactive", "cancelled"]}})
    
    # Get upcoming payments (accounts with billing_day in next 7 days)
    today = datetime.now(timezone.utc)
    
    accounts = await db.starlink_accounts.find({"status": "active"}, {"_id": 0}).to_list(1000)
    upcoming_payments = []
    
    for acc in accounts:
        billing_day = acc.get("billing_day", 1)
        next_billing = get_next_billing_date(billing_day, today)
        days_until = (next_billing - today).days
        
        if days_until <= 7:
            upcoming_payments.append({
                "account_id": acc["account_id"],
                "account_name": acc["account_name"],
                "amount": acc.get("monthly_amount", 0),
                "billing_day": billing_day,
                "days_until": days_until,
                "next_billing_date": next_billing.strftime("%Y-%m-%d")
            })
    
    # Sort by days until payment
    upcoming_payments.sort(key=lambda x: x["days_until"])
    
    # Get open tickets count
    open_tickets = await db.support_tickets.count_documents({"status": "open"})
    
    # Get total devices
    total_devices = await db.devices.count_documents({})
    
    # Get unread notifications
    unread_notifications = await db.notifications.count_documents({"user_id": user.user_id, "is_read": False})
    
    # Get recent activity (last 5 billing records)
    recent_payments = await db.billing_records.find({}, {"_id": 0}).sort("created_at", -1).to_list(5)
    for p in recent_payments:
        if isinstance(p.get('payment_date'), str):
            p['payment_date'] = datetime.fromisoformat(p['payment_date'])
        if isinstance(p.get('created_at'), str):
            p['created_at'] = datetime.fromisoformat(p['created_at'])
        # Get account name
        acc = await db.starlink_accounts.find_one({"account_id": p["account_id"]}, {"_id": 0, "account_name": 1})
        p['account_name'] = acc["account_name"] if acc else "Unknown"
    
    return {
        "total_accounts": total_accounts,
        "online_accounts": online_accounts,
        "offline_accounts": offline_accounts,
        "active_accounts": active_accounts,
        "inactive_accounts": inactive_accounts,
        "open_tickets": open_tickets,
        "total_devices": total_devices,
        "unread_notifications": unread_notifications,
        "upcoming_payments": upcoming_payments,
        "recent_payments": recent_payments
    }

@api_router.get("/dashboard/all-tickets", response_model=List[SupportTicket])
async def get_all_tickets(status: Optional[str] = None, user: User = Depends(get_current_user)):
    query = {}
    if status:
        query["status"] = status
    
    tickets = await db.support_tickets.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    for t in tickets:
        if isinstance(t.get('created_at'), str):
            t['created_at'] = datetime.fromisoformat(t['created_at'])
        if isinstance(t.get('updated_at'), str):
            t['updated_at'] = datetime.fromisoformat(t['updated_at'])
    return tickets

# Include router and setup CORS
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
