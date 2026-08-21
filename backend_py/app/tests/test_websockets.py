import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.tests.conftest import requires_db

@pytest.mark.asyncio
@requires_db
async def test_ws_unauthorized(db_session):
    with TestClient(app) as client:
        # Connecting without cookies should trigger a 4401 close
        with pytest.raises(Exception) as excinfo:
            with client.websocket_connect("/api/chat/ws") as websocket:
                pass
        assert getattr(excinfo.value, "code", None) == 4401


@pytest.mark.asyncio
@requires_db
async def test_ws_authorized_flow(db_session, client):
    # 1. Register a user using HTTP client to set up the DB record and session
    register_resp = await client.post(
        "/api/auth/register",
        json={
            "name": "WS Student",
            "college_id": "CW-WS-STU",
            "password": "Password@123",
            "college_name": "ChatWave College",
            "department": "CS",
            "role": "student",
        },
    )
    assert register_resp.status_code == 201
    
    # Extract access token cookie
    access_token = register_resp.cookies.get("access_token")
    assert access_token is not None

    # 2. Use TestClient to establish websocket connection with the auth cookie
    with TestClient(app) as ws_client:
        # Pass the cookies to TestClient
        ws_client.cookies.set("access_token", access_token)
        
        with ws_client.websocket_connect("/api/chat/ws") as websocket:
            # Check for initial "ready" frame
            ready_frame = websocket.receive_json()
            assert ready_frame["type"] == "ready"
            assert "userId" in ready_frame
            assert "sessionId" in ready_frame

            # Send a ping
            websocket.send_json({"type": "ping"})
            pong_frame = websocket.receive_json()
            assert pong_frame["type"] == "pong"

            # Send empty question validation error check
            websocket.send_json({"type": "question", "content": ""})
            err_frame = websocket.receive_json()
            assert err_frame["type"] == "error"
            assert "Question cannot be empty" in err_frame["message"]

            # Send invalid JSON
            websocket.send_text("this is not json")
            err_frame_2 = websocket.receive_json()
            assert err_frame_2["type"] == "error"
            assert "Invalid JSON" in err_frame_2["message"]


@pytest.mark.asyncio
@requires_db
async def test_general_chat_ws(db_session, client):
    register_resp = await client.post(
        "/api/auth/register",
        json={
            "name": "WS Student 2",
            "college_id": "CW-WS-STU-GEN",
            "password": "Password@123",
            "college_name": "ChatWave College",
            "department": "CS",
            "role": "student",
        },
    )
    assert register_resp.status_code == 201
    access_token = register_resp.cookies.get("access_token")
    assert access_token is not None

    with TestClient(app) as ws_client:
        ws_client.cookies.set("access_token", access_token)
        with ws_client.websocket_connect("/api/chat/ws") as websocket:
            ready_frame = websocket.receive_json()
            assert ready_frame["type"] == "ready"

            # Send a question in general mode
            websocket.send_json({
                "type": "question",
                "content": "What is 2+2?",
                "mode": "general"
            })
            
            try:
                while True:
                    frame = websocket.receive_json()
                    print("\n[TEST WS FRAME]:", frame)
                    if frame.get("type") == "final":
                        break
            except Exception as e:
                print("\n[TEST WS ERROR]:", type(e), str(e))
                raise e

