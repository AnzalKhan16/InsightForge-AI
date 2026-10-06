import pytest
from fastapi.testclient import TestClient
from app.db.models.datasets import Dataset
from sqlalchemy import select
import io


def test_upload_dataset(client: TestClient, session):
    # 1. Register a user & workspace
    client.post("/api/v1/auth/register", json={
        "email": "datauser@example.com",
        "password": "securepassword",
        "full_name": "Data User"
    })
    login_resp = client.post("/api/v1/auth/login", data={
        "username": "datauser@example.com",
        "password": "securepassword"
    })
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Get their workspace
    ws_resp = client.get("/api/v1/workspaces", headers=headers)
    workspace_id = ws_resp.json()[0]["id"]

    # 3. Upload a file
    file_content = b"col1,col2\n1,2\n3,4"
    files = {'file': ('test.csv', io.BytesIO(file_content), 'text/csv')}
    data = {'name': 'Test Dataset'}
    
    res = client.post(f"/api/v1/workspaces/{workspace_id}/datasets", headers=headers, files=files, data=data)
    assert res.status_code == 200
    dataset = res.json()
    assert dataset["name"] == "Test Dataset"
    assert len(dataset["versions"]) == 1
    assert dataset["versions"][0]["original_filename"] == "test.csv"
    assert dataset["versions"][0]["size_bytes"] == len(file_content)
    assert dataset["versions"][0]["format"] == "csv"

    dataset_id = dataset["id"]

    # 4. List datasets
    list_res = client.get(f"/api/v1/workspaces/{workspace_id}/datasets", headers=headers)
    assert list_res.status_code == 200
    assert len(list_res.json()) == 1
    assert list_res.json()[0]["id"] == dataset_id

    # 5. Delete dataset
    del_res = client.delete(f"/api/v1/workspaces/{workspace_id}/datasets/{dataset_id}", headers=headers)
    assert del_res.status_code == 204
    
    # 6. Verify it's deleted (soft delete means it won't appear in list)
    list_res2 = client.get(f"/api/v1/workspaces/{workspace_id}/datasets", headers=headers)
    assert len(list_res2.json()) == 0
