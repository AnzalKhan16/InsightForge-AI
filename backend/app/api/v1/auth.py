from datetime import timedelta
import re

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm

from app.api.deps import ActiveUser, SessionDep
from app.core.config import get_settings
from app.core.security import create_access_token, get_password_hash, verify_password
from app.db.repositories.core import UserRepository, WorkspaceRepository
from app.schemas.token import Token
from app.schemas.user import UserCreate, UserResponse

router = APIRouter()


@router.post("/register", response_model=UserResponse)
def register(user_in: UserCreate, session: SessionDep):
    """
    Register a new user and create a default workspace.
    """
    user_repo = UserRepository(session)
    if user_repo.get_by_email(user_in.email):
        raise HTTPException(
            status_code=400,
            detail="A user with this email already exists.",
        )

    user = user_repo.create(
        email=user_in.email,
        password_hash=get_password_hash(user_in.password),
        full_name=user_in.full_name,
    )
    
    # Create default workspace
    ws_repo = WorkspaceRepository(session)
    base_slug = re.sub(r'[^a-z0-9-]', '-', user_in.email.split('@')[0].lower())
    # Ensure slug uniqueness (simple implementation)
    slug = base_slug
    counter = 1
    while ws_repo.get_by_slug(slug):
        slug = f"{base_slug}-{counter}"
        counter += 1
        
    ws_repo.create_with_owner(
        name=f"{user_in.full_name or 'My'} Workspace",
        slug=slug,
        owner=user,
    )
    
    # Commit happens in the dependency if no exception is raised
    return user


@router.post("/login", response_model=Token)
def login(session: SessionDep, form_data: OAuth2PasswordRequestForm = Depends()):
    """
    OAuth2 compatible token login, get an access token for future requests.
    """
    user = UserRepository(session).get_by_email(form_data.username)
    if not user or not user.password_hash or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    elif not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")

    settings = get_settings()
    access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
    
    return {
        "access_token": create_access_token(subject=user.id, expires_delta=access_token_expires),
        "token_type": "bearer",
    }


@router.get("/me", response_model=UserResponse)
def get_current_user_info(current_user: ActiveUser):
    """
    Get current user.
    """
    return current_user
