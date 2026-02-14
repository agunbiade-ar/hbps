import secrets
import string
from pwdlib import PasswordHash
from datetime import timedelta, datetime, timezone
from config import settings
import jwt
from fastapi import HTTPException, Depends, status, Request
from db_conn import async_get_db_connection
from app.models.models import TokenData
from fastapi.security import OAuth2PasswordBearer
import uuid
from app.httpclient.httpclient import OpenMRSClient
import time

password_hash = PasswordHash.recommended()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")


def generate_secret_key():
    characters = string.ascii_letters + string.digits + string.punctuation

    secret_key = "".join(secrets.choice(characters) for i in range(64))
    return secret_key


def get_password_hash(password):
    return password_hash.hash(password)


def verify_password_hash(user_password, db_password):
    return password_hash.verify(user_password, db_password)


def create_access_token(data: dict, expires_delta: timedelta | None = None):
    payload_to_encode = data.copy()

    if expires_delta:
        expiry = datetime.now(timezone.utc) + expires_delta
    else:
        expiry = datetime.now(timezone.utc) + timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRY_LENGTH
        )
    payload_to_encode.update({"exp": expiry})
    encoded_jwt = jwt.encode(
        payload=payload_to_encode,
        key=f"{settings.SECRET_KEY}",
        algorithm=settings.ALGORITHM,
    )
    return encoded_jwt


def create_refresh_token(data: dict):
    payload_to_encode = data.copy()

    expiry = datetime.now(timezone.utc) + timedelta(
        days=settings.REFRESH_TOKEN_EXPIRY_LENGTH
    )

    payload_to_encode.update(
        {"exp": expiry, "type": "refresh", "jti": str(uuid.uuid4())}
    )
    return jwt.encode(
        payload=payload_to_encode,
        key=settings.SECRET_KEY,
        algorithm=settings.ALGORITHM,
    )


def verify_token(token: str, credentials_exception: HTTPException):
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
            options={"verify_exp": True},
        )
        token_payload = TokenData(**payload)
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expired",
        )

    except jwt.InvalidTokenError:
        raise credentials_exception

    return token_payload


async def get_current_user(
    request: Request, connection=Depends(async_get_db_connection)
):
    token = request.cookies.get("access_token")
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="could not validate currently logged in user",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if token is None:
        raise credentials_exception

    token_data = verify_token(token=token, credentials_exception=credentials_exception)

    query = """SELECT * FROM hayokbps.users WHERE id = %s"""
    async with connection.cursor() as cursor:
        await cursor.execute(query, (token_data.id,))
        user = await cursor.fetchone()

    if not user:
        raise credentials_exception

    return user


async def get_openmrs_user(openmrs_user_uuid: str):
    client = OpenMRSClient.get_client()
    response = await client.get(
        f"{settings.OPENMRS_BASE_URL}/user/{openmrs_user_uuid}",
        auth=(settings.OPENMRS_USER, settings.OPENMRS_USER_PASSWORD),
        headers={"Accept": "application/json"},
    )
    openmrs_user = response.json()
    return openmrs_user


async def get_openmrs_users(limit: int = 20, startIndex: int = 0):
    client = OpenMRSClient.get_client()
    response = await client.get(
        f"{settings.OPENMRS_BASE_URL}/user",
        params={"limit": limit, "startIndex": startIndex},
        auth=(settings.OPENMRS_USER, settings.OPENMRS_USER_PASSWORD),
        headers={"Accept": "application/json"},
    )
    openmrs_users = response.json()
    return openmrs_users
