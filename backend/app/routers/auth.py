from fastapi import APIRouter, HTTPException, status, Depends, Response, Query, Request
from app.httpclient.httpclient import OpenMRSClient
from config import settings
import httpx
from utils.utils import set_logger
from fastapi.security.oauth2 import OAuth2PasswordRequestForm
from utils.security_utils import (
    create_access_token,
    create_refresh_token,
    get_current_user,
    verify_token,
    get_openmrs_user,
    get_openmrs_users,
)
from db_conn import async_get_db_connection
from app.models.models import Token, UserRegisterSchema
from aiomysql import Error as aiomysqlError

# from datetime import datetime, timezone, timedelta

logger = set_logger(__name__)

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/login")
async def login(
    returned_response: Response,
    user_credentials: OAuth2PasswordRequestForm = Depends(),
    connection=Depends(async_get_db_connection),
):
    payload = {
        "username": user_credentials.username,
        "password": user_credentials.password,
    }

    try:
        client = OpenMRSClient.get_client()
        response = await client.get(
            f"{settings.OPENMRS_BASE_URL}/session",
            auth=(payload["username"], payload["password"]),
            headers={"Accept": "application/json"},
        )

        if response.status_code == 401:
            logger.warning("Authentication failed, invalid credentials provided")
            raise HTTPException(status_code=401, detail="invalid credentials")

        response.raise_for_status()
        response_payload = response.json()

        authenticated = response_payload.get("authenticated")
        if authenticated is None or authenticated is False:
            logger.warning("Authentication failed, please login again")
            raise HTTPException(status_code=401, detail="invalid credentials")

        user_uuid = response_payload.get("user").get("uuid")

        try:
            async with connection.cursor() as cursor:
                # check if the user exists on our own db with their uuid
                query = """SELECT * FROM hayokbps.users WHERE openmrs_uuid = %s"""
                await cursor.execute(query, (user_uuid,))
                user = await cursor.fetchone()

                if user is None:
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail=f"Invalid credentials provided",
                    )

                data_to_encode = {
                    "id": user.get("id"),
                    "username": response_payload.get("user")
                    .get("person")
                    .get("display"),
                    "openmrs_uuid": user.get("openmrs_uuid"),
                }
                access_token = create_access_token(data=data_to_encode)
                refresh_token = create_refresh_token(data=data_to_encode)

                returned_response.set_cookie(
                    key="access_token",
                    value=access_token,
                    httponly=True,
                    secure=False,  # set this to true in production
                    samesite="lax",
                )

                returned_response.set_cookie(
                    key="refresh_token",
                    value=refresh_token,
                    httponly=True,
                    secure=False,  # set this to true in production
                    samesite="lax",
                )

                query = """ INSERT INTO hayokbps.user_refresh_tokens (user_id, refresh_token) VALUES (%s, %s) ON DUPLICATE KEY UPDATE refresh_token = VALUES(refresh_token) """

                await cursor.execute(
                    query,
                    (user.get("id"), refresh_token),
                )
                await connection.commit()
                return {"message": "login successful"}

        except aiomysqlError as e:
            logger.error(f"Database error: {e}")
            await connection.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"failed to retrieve user from database",
            )
        except Exception as e:
            logger.error(f"unexpected error: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"{e}",
            )

    except httpx.TimeoutException:
        logger.error(
            f"Timeout connecting to OpenMRS at {settings.OPENMRS_BASE_URL}/session"
        )
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Authentication service is not responding",
        )

    except httpx.ConnectError:
        logger.error(
            f"Cannot connect to OpenMRS at {settings.OPENMRS_BASE_URL}/session"
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Cannot connect to authentication service",
        )

    except httpx.HTTPError as e:
        logger.error(f"HTTP error during authentication: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Error communicating with authentication service",
        )

    except HTTPException:
        raise


@router.post("/register")
async def register(
    user: UserRegisterSchema,
    logged_in_user=Depends(get_current_user),
    connection=Depends(async_get_db_connection),
):
    try:
        openmrs_user = await get_openmrs_user(str(user.openmrs_uuid))

        user_uuid = openmrs_user.get("uuid", "")
        person = openmrs_user.get("person", {})
        full_name = person.get("display", "")

        parts = full_name.split()
        first_name = parts[0] if len(parts) > 0 else ""
        last_name = parts[1] if len(parts) > 1 else ""
        middle_name = parts[2] if len(parts) > 2 else ""

        query = """
            INSERT IGNORE INTO hayokbps.users (openmrs_uuid, first_name, last_name, middle_name)
            VALUES (%s, %s, %s, %s)
            """
        async with connection.cursor() as cursor:
            # check if the user exists on our own db with their uuid
            await cursor.execute(query, (user_uuid, first_name, last_name, middle_name))

            await connection.commit()
            return {"message": f"successfully created user with id {user_uuid}"}
    except aiomysqlError as e:
        logger.error(f"Database error: {e}")
        await connection.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error",
        )

    except httpx.TimeoutException:
        logger.error(f"Timeout connecting to OpenMRS at {settings.OPENMRS_BASE_URL}")
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Authentication service is not responding",
        )
    except httpx.ConnectError:
        logger.error(f"Cannot connect to OpenMRS at {settings.OPENMRS_BASE_URL}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Cannot connect to authentication service",
        )

    except Exception as e:
        logger.error(f"unexpected error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"unexpected error",
        )


@router.post("/refresh")
async def refresh(
    request: Request,
    returned_response: Response,
    connection=Depends(async_get_db_connection),
):
    provided_refresh_token = request.cookies.get("refresh_token")
    if not provided_refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing refresh token",
        )

    try:
        async with connection.cursor() as cursor:
            query = """
            SELECT * FROM hayokbps.user_refresh_tokens WHERE refresh_token = %s"""
            await cursor.execute(query, (provided_refresh_token,))

            row = await cursor.fetchone()
            if row is None:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid refresh token",
                )

            # Verify token (this should handle expiration check)
            try:
                token_payload = verify_token(
                    row["refresh_token"],
                    HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Token expired or invalid",
                    ),
                )
            except HTTPException:
                # Delete expired token from database
                delete_query = (
                    "DELETE FROM hayokbps.user_refresh_tokens WHERE refresh_token = %s"
                )
                await cursor.execute(delete_query, (provided_refresh_token,))
                await connection.commit()
                raise

            # Create new tokens
            data_to_encode = {
                "id": row["user_id"],
                "username": token_payload.username,
                "openmrs_uuid": str(token_payload.openmrs_uuid),
            }

            access_token = create_access_token(data=data_to_encode)
            new_refresh_token = create_refresh_token(
                data=data_to_encode
            )  # Create new refresh token

            # Update refresh token in database
            update_query = """
            UPDATE hayokbps.user_refresh_tokens 
            SET refresh_token = %s
            WHERE refresh_token = %s
            """
            await cursor.execute(
                update_query, (new_refresh_token, provided_refresh_token)
            )
            await connection.commit()

            # Set both cookies
            returned_response.set_cookie(
                key="access_token",
                value=access_token,
                httponly=True,
                secure=False,  # set to True in production
                samesite="lax",
            )

            returned_response.set_cookie(
                key="refresh_token",
                value=new_refresh_token,
                httponly=True,
                secure=False,  # set to True in production
                samesite="lax",
                max_age=86400,  # 1 day in seconds
            )

            return {"ok": True}

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Unexpected error in refresh")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication service error",
        )


@router.get("/me")
async def get_me(request: Request):
    token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authorized"
        )

    payload = verify_token(
        token,
        HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Invalid token provided"
        ),
    )
    return payload


@router.post("/logout")
async def logout(
    request: Request,
    response: Response,
    connection=Depends(async_get_db_connection),
):
    refresh_token = request.cookies.get("refresh_token")
    access_token = request.cookies.get("access_token")
    user_id = None

    # Try to extract user_id (best effort)
    if access_token:
        try:
            token_data = verify_token(
                access_token,
                HTTPException(status_code=401),
            )
            user_id = token_data.id
        except HTTPException:
            pass  # expired/invalid access token → ignore

    try:
        async with connection.cursor() as cursor:
            if refresh_token:
                # revoke specific refresh token
                await cursor.execute(
                    "DELETE FROM user_refresh_tokens WHERE refresh_token=%s",
                    (refresh_token,),
                )
            elif user_id:
                # fallback: revoke all tokens for user
                await cursor.execute(
                    "DELETE FROM user_refresh_tokens WHERE user_id=%s",
                    (user_id,),
                )
            await connection.commit()
    except Exception as e:
        logger.error(f"logout cleanup failed: {e}")
        await connection.rollback()

    # CRITICAL: Match the cookie settings from when they were created
    cookie_settings = {
        "path": "/",
        "samesite": "lax",
        "secure": False,  # Set to True in production with HTTPS
        "domain": "localhost",  # Uncomment if frontend/backend on different ports
    }

    response.delete_cookie("access_token", **cookie_settings)
    response.delete_cookie("refresh_token", **cookie_settings)

    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/users")
async def get_users(
    limit: int = Query(default=20, ge=1, le=50),
    offset: int = Query(default=1, ge=1),
    current_user=Depends(get_current_user),
    connection=Depends(async_get_db_connection),
):
    try:
        async with connection.cursor() as cursor:
            query = """SELECT openmrs_uuid, first_name, last_name, middle_name FROM hayokbps.users"""

            await cursor.execute(query)
            hayokbps_users = await cursor.fetchall()

            if hayokbps_users is None:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"an error occurred while fetching users from localdb",
                )

            # default it fetches the first page
            openmrs_users = await get_openmrs_users(limit=limit, startIndex=offset)
            openmrs_users = openmrs_users.get("results")

            if len(openmrs_users) == 0 or openmrs_users is None:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"no users in the openmrs db",
                )

            local_uuids = {u["openmrs_uuid"] for u in hayokbps_users}

            users_to_display = [
                user for user in openmrs_users if user.get("uuid") not in local_uuids
            ]

            return {"users": users_to_display, "length": len(users_to_display)}

    except aiomysqlError as e:
        logger.error(f"Database error when fetching users {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error when fetching users",
        )
    except Exception as e:
        logger.error(f"Unexpected error while fetching users: {e}")
        await connection.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected while fetching users",
        )
