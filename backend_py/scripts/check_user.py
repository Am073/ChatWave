import asyncio

# Apply monkey patch just in case
import bcrypt
from beanie import init_beanie
from motor.motor_asyncio import AsyncIOMotorClient

from app.core.config import get_settings
from app.models.user import User

if not hasattr(bcrypt, "__about__"):
    bcrypt.__about__ = type("About", (), {"__version__": bcrypt.__version__})()

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

from app.core.security import verify_password  # noqa: E402


async def check():
    settings = get_settings()
    print("Connecting to MongoDB:", settings.mongo_uri)
    client = AsyncIOMotorClient(settings.mongo_uri)
    db = client.get_default_database()
    print("Database name:", db.name)
    await init_beanie(database=db, document_models=[User])
    u = await User.find_one({"college_id": "CW-STUDENT"})
    if u:
        print("User found! Name:", u.name, "Role:", u.role, "Hash:", u.password)
        print("Verify password result:", verify_password("Password@123", u.password))
    else:
        print("User NOT found!")
    client.close()

if __name__ == "__main__":
    asyncio.run(check())
