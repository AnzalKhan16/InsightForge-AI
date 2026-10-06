def test_register_user(client):
    response = client.post("/api/v1/auth/register", json={
        "email": "test@example.com",
        "password": "securepassword",
        "full_name": "Test User"
    })
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "test@example.com"
    assert data["full_name"] == "Test User"
    assert "id" in data


def test_register_user_duplicate_email(client):
    client.post("/api/v1/auth/register", json={
        "email": "duplicate@example.com",
        "password": "securepassword"
    })
    response = client.post("/api/v1/auth/register", json={
        "email": "duplicate@example.com",
        "password": "securepassword2"
    })
    assert response.status_code == 400
    assert "already exists" in response.json()["error"]["message"]


def test_login_user(client):
    client.post("/api/v1/auth/register", json={
        "email": "login@example.com",
        "password": "securepassword"
    })
    response = client.post("/api/v1/auth/login", data={
        "username": "login@example.com",
        "password": "securepassword"
    })
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


def test_login_user_invalid_credentials(client):
    client.post("/api/v1/auth/register", json={
        "email": "invalid@example.com",
        "password": "securepassword"
    })
    response = client.post("/api/v1/auth/login", data={
        "username": "invalid@example.com",
        "password": "wrongpassword"
    })
    assert response.status_code == 400
    assert "Incorrect email or password" in response.json()["error"]["message"]


def test_get_current_user(client):
    client.post("/api/v1/auth/register", json={
        "email": "me@example.com",
        "password": "securepassword",
        "full_name": "Me"
    })
    login_resp = client.post("/api/v1/auth/login", data={
        "username": "me@example.com",
        "password": "securepassword"
    })
    token = login_resp.json()["access_token"]
    
    response = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "me@example.com"


def test_unauthorized_access(client):
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 401
    assert response.json()["error"]["message"] == "Not authenticated"
