from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.models import User, Workspace
from app.db.repositories.core import UserRepository, WorkspaceRepository
from app.db.session import get_db
from app.schemas.token import TokenPayload

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{get_settings().api_v1_prefix}/auth/login")

SessionDep = Annotated[Session, Depends(get_db)]
TokenDep = Annotated[str, Depends(oauth2_scheme)]


def get_current_user(session: SessionDep, token: TokenDep) -> User:
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        token_data = TokenPayload(**payload)
    except (jwt.PyJWTError, ValidationError):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Could not validate credentials",
        )
    import uuid
    if token_data.sub is None:
        raise HTTPException(status_code=403, detail="Could not validate credentials")
    
    try:
        user_id = uuid.UUID(token_data.sub)
    except ValueError:
        raise HTTPException(status_code=403, detail="Could not validate credentials")
        
    user = UserRepository(session).get(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def get_current_active_user(current_user: CurrentUser) -> User:
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user


ActiveUser = Annotated[User, Depends(get_current_active_user)]
