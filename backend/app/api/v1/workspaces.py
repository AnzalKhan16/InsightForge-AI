import uuid

from fastapi import APIRouter, HTTPException

from app.api.deps import ActiveUser, SessionDep
from app.db.repositories.core import WorkspaceRepository
from app.schemas.workspace import WorkspaceResponse

router = APIRouter()


@router.get("", response_model=list[WorkspaceResponse])
def list_workspaces(current_user: ActiveUser, session: SessionDep):
    """
    List workspaces the current user is a member of.
    """
    ws_repo = WorkspaceRepository(session)
    return ws_repo.list_for_user(current_user.id)


@router.get("/{workspace_id}", response_model=WorkspaceResponse)
def get_workspace(workspace_id: uuid.UUID, current_user: ActiveUser, session: SessionDep):
    """
    Get a specific workspace if the user is a member.
    """
    ws_repo = WorkspaceRepository(session)
    membership = ws_repo.get_membership(workspace_id, current_user.id)
    if not membership:
        raise HTTPException(status_code=404, detail="Workspace not found or access denied")
    
    workspace = ws_repo.get(workspace_id)
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
        
    return workspace
