import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
from app.core.config import get_settings
from app.models.user import User
from app.core.security import hash_password

# Apply monkey patch for bcrypt version compatibility
import bcrypt
if not hasattr(bcrypt, "__about__"):
    setattr(bcrypt, "__about__", type("About", (), {"__version__": bcrypt.__version__})())

_orig_hashpw = bcrypt.hashpw
def _patched_hashpw(password, salt):
    if isinstance(password, str):
        password = password.encode("utf-8")
    if len(password) > 72:
        password = password[:72]
    return _orig_hashpw(password, salt)
bcrypt.hashpw = _patched_hashpw

# Patch Beanie compatibility with newer Motor versions
AsyncIOMotorClient.append_metadata = lambda *args, **kwargs: None

async def seed():
    settings = get_settings()
    print("Connecting to MongoDB for seeding...")
    client = AsyncIOMotorClient(settings.mongo_uri)
    await init_beanie(database=client.get_default_database(), document_models=[User])

    demo_users = [
        {
            "college_id": "CW-STUDENT",
            "name": "Aarav Sharma",
            "username": "cw-student",
            "email": "student@chatwave.edu",
            "password": hash_password("Password@123"),
            "role": "student",
            "college_name": "ChatWave College",
            "department": "Computer Science",
            "is_active": True,
        },
        {
            "college_id": "CW-FACULTY",
            "name": "Dr. Priya Patel",
            "username": "cw-faculty",
            "email": "faculty@chatwave.edu",
            "password": hash_password("Password@123"),
            "role": "faculty",
            "college_name": "ChatWave College",
            "department": "Computer Science",
            "is_active": True,
        },
        {
            "college_id": "CW-ADMIN",
            "name": "System Admin",
            "username": "cw-admin",
            "email": "admin@chatwave.edu",
            "password": hash_password("Password@123"),
            "role": "admin",
            "college_name": "ChatWave College",
            "department": "Administration",
            "is_active": True,
        }
    ]

    for user_data in demo_users:
        existing = await User.find_one({"college_id": user_data["college_id"]})
        if existing is None:
            user = User(**user_data)
            await user.insert()
            print(f"Created demo account: {user.college_id} ({user.role})")
        else:
            existing.password = user_data["password"]
            existing.name = user_data["name"]
            existing.role = user_data["role"]
            existing.college_name = user_data["college_name"]
            existing.department = user_data["department"]
            await existing.save()
            print(f"Updated demo account: {existing.college_id} ({existing.role})")

    client.close()
    print("Database seeding completed successfully.")

if __name__ == "__main__":
    asyncio.run(seed())
