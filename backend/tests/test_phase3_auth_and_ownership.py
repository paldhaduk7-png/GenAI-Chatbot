"""
End-to-End Test Suite for Phase 3:
1. Backend Authentication (Register, Login, Current User, Token Validation)
2. Conversation Ownership and Multi-Tenant Isolation
3. Regression of Chat, LLM Provider, and Conversation Management
"""
import sys
import uuid
from datetime import timedelta
from pathlib import Path

# Ensure backend root is on sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select, func

from main import app
from app.db import SessionLocal, Conversation, Message, User
from app.core.security import create_access_token


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture(scope="module")
def db_session():
    session = SessionLocal()
    yield session
    session.close()


class TestAuthEndpoints:
    """Tests for registration, login, and current-user endpoints."""

    def test_registration_validation(self, client):
        # Short password (< 8 chars)
        res = client.post("/api/auth/register", json={
            "email": "valid_email@example.com",
            "password": "short",
            "full_name": "Test User",
        })
        assert res.status_code == 422

        # Invalid email format
        res = client.post("/api/auth/register", json={
            "email": "not-a-valid-email-format",
            "password": "ValidPassword123!",
            "full_name": "Test User",
        })
        assert res.status_code == 422

        # Empty password
        res = client.post("/api/auth/register", json={
            "email": "valid2@example.com",
            "password": "   ",
            "full_name": "Test User",
        })
        assert res.status_code == 422

    def test_valid_registration_and_password_hashing(self, client, db_session):
        test_email = f"authtest_{uuid.uuid4().hex[:8]}@example.com"
        test_password = "SecurePassword123!"
        test_name = "Auth Test User"

        res = client.post("/api/auth/register", json={
            "email": f"  {test_email.upper()}  ",
            "password": test_password,
            "full_name": test_name,
        })
        assert res.status_code == 201
        data = res.json()

        # Check response structure
        assert data["email"] == test_email.lower()
        assert data["full_name"] == test_name
        assert "id" in data
        assert "password" not in data
        assert "hashed_password" not in data

        user_id = data["id"]

        # Check database row directly
        db_user = db_session.get(User, user_id)
        assert db_user is not None
        assert db_user.hashed_password != test_password
        assert db_user.hashed_password.startswith("$2b$") or db_user.hashed_password.startswith("$2a$")

        # Clean up
        db_session.delete(db_user)
        db_session.commit()

    def test_duplicate_registration_rejected(self, client, db_session):
        test_email = f"dup_{uuid.uuid4().hex[:8]}@example.com"
        password = "Password123!"

        res1 = client.post("/api/auth/register", json={"email": test_email, "password": password})
        assert res1.status_code == 201
        user_id = res1.json()["id"]

        # Attempt duplicate registration with same email
        res2 = client.post("/api/auth/register", json={"email": test_email.upper(), "password": password})
        assert res2.status_code == 409
        assert "already exists" in res2.json()["detail"].lower()

        # Clean up
        db_user = db_session.get(User, user_id)
        if db_user:
            db_session.delete(db_user)
            db_session.commit()

    def test_login_success_and_failures(self, client, db_session):
        test_email = f"login_{uuid.uuid4().hex[:8]}@example.com"
        password = "Password123!"

        res = client.post("/api/auth/register", json={"email": test_email, "password": password})
        assert res.status_code == 201
        user_id = res.json()["id"]

        # 1. Invalid password
        res_bad_pw = client.post("/api/auth/login", json={"email": test_email, "password": "WrongPassword!"})
        assert res_bad_pw.status_code == 401
        assert res_bad_pw.headers.get("www-authenticate") == "Bearer"

        # 2. Non-existent email
        res_no_user = client.post("/api/auth/login", json={"email": "nonexistent_email@example.com", "password": password})
        assert res_no_user.status_code == 401
        assert res_no_user.headers.get("www-authenticate") == "Bearer"

        # 3. Valid login
        res_ok = client.post("/api/auth/login", json={"email": test_email, "password": password})
        assert res_ok.status_code == 200
        token_data = res_ok.json()
        assert "access_token" in token_data
        assert token_data["token_type"] == "bearer"
        assert "password" not in token_data

        # Clean up
        db_user = db_session.get(User, user_id)
        if db_user:
            db_session.delete(db_user)
            db_session.commit()

    def test_current_user_token_validation(self, client, db_session):
        test_email = f"me_{uuid.uuid4().hex[:8]}@example.com"
        password = "Password123!"

        res = client.post("/api/auth/register", json={"email": test_email, "password": password, "full_name": "Me User"})
        user_id = res.json()["id"]

        login_res = client.post("/api/auth/login", json={"email": test_email, "password": password})
        valid_token = login_res.json()["access_token"]

        # 1. Valid token retrieves correct user
        res_me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {valid_token}"})
        assert res_me.status_code == 200
        profile = res_me.json()
        assert profile["id"] == user_id
        assert profile["email"] == test_email
        assert profile["full_name"] == "Me User"
        assert "password" not in profile
        assert "hashed_password" not in profile

        # 2. Missing token
        assert client.get("/api/auth/me").status_code == 401

        # 3. Malformed token
        assert client.get("/api/auth/me", headers={"Authorization": "Bearer malformed.jwt.token"}).status_code == 401

        # 4. Expired token
        expired_token = create_access_token({"sub": user_id, "email": test_email}, expires_delta=timedelta(seconds=-10))
        assert client.get("/api/auth/me", headers={"Authorization": f"Bearer {expired_token}"}).status_code == 401

        # Clean up
        db_user = db_session.get(User, user_id)
        if db_user:
            db_session.delete(db_user)
            db_session.commit()


class TestConversationOwnershipAndIsolation:
    """Verifies complete multi-tenant conversation isolation between User A and User B."""

    @pytest.fixture(autouse=True)
    def setup_users(self, client, db_session):
        suffix = uuid.uuid4().hex[:6]
        self.user_a_email = f"usera_{suffix}@example.com"
        self.user_b_email = f"userb_{suffix}@example.com"
        self.password = "Password123!"

        # Register User A
        res_a = client.post("/api/auth/register", json={"email": self.user_a_email, "password": self.password, "full_name": "User A"})
        self.user_a_id = res_a.json()["id"]
        res_la = client.post("/api/auth/login", json={"email": self.user_a_email, "password": self.password})
        self.headers_a = {"Authorization": f"Bearer {res_la.json()['access_token']}"}

        # Register User B
        res_b = client.post("/api/auth/register", json={"email": self.user_b_email, "password": self.password, "full_name": "User B"})
        self.user_b_id = res_b.json()["id"]
        res_lb = client.post("/api/auth/login", json={"email": self.user_b_email, "password": self.password})
        self.headers_b = {"Authorization": f"Bearer {res_lb.json()['access_token']}"}

        yield

        # Teardown both users
        user_a = db_session.get(User, self.user_a_id)
        if user_a:
            db_session.delete(user_a)
        user_b = db_session.get(User, self.user_b_id)
        if user_b:
            db_session.delete(user_b)
        db_session.commit()

    def test_user_a_creates_and_retrieves_own_conversation(self, client, db_session):
        res = client.post("/api/conversations", json={"title": "User A Chat"}, headers=self.headers_a)
        assert res.status_code == 201
        conv = res.json()
        assert conv["title"] == "User A Chat"
        conv_id = conv["id"]

        # Check DB foreign key
        db_conv = db_session.get(Conversation, conv_id)
        assert db_conv is not None
        assert db_conv.user_id == self.user_a_id

        # Retrieve
        res_get = client.get(f"/api/conversations/{conv_id}", headers=self.headers_a)
        assert res_get.status_code == 200
        assert res_get.json()["id"] == conv_id

    def test_user_b_cannot_access_or_mutate_user_a_conversation(self, client):
        # User A creates conversation
        conv_a = client.post("/api/conversations", json={"title": "User A Confidential"}, headers=self.headers_a).json()
        conv_id = conv_a["id"]

        # User B attempts GET -> 404
        assert client.get(f"/api/conversations/{conv_id}", headers=self.headers_b).status_code == 404

        # User B attempts PATCH rename -> 404
        assert client.patch(f"/api/conversations/{conv_id}", json={"title": "Hacked"}, headers=self.headers_b).status_code == 404

        # User B attempts PATCH pin -> 404
        assert client.patch(f"/api/conversations/{conv_id}/pin", headers=self.headers_b).status_code == 404

        # User B attempts DELETE -> 404
        assert client.delete(f"/api/conversations/{conv_id}", headers=self.headers_b).status_code == 404

        # User B attempts POST /api/chat with User A's conversation_id -> 404
        res_chat = client.post("/api/chat", json={
            "conversation_id": conv_id,
            "messages": [{"role": "user", "content": "Tampering turn"}]
        }, headers=self.headers_b)
        assert res_chat.status_code == 404

    def test_conversation_listing_isolation(self, client):
        # User A creates 2 conversations
        client.post("/api/conversations", json={"title": "A1"}, headers=self.headers_a)
        client.post("/api/conversations", json={"title": "A2"}, headers=self.headers_a)

        # User B creates 1 conversation
        client.post("/api/conversations", json={"title": "B1"}, headers=self.headers_b)

        list_a = client.get("/api/conversations", headers=self.headers_a).json()
        list_b = client.get("/api/conversations", headers=self.headers_b).json()

        assert len(list_a) == 2
        assert len(list_b) == 1
        assert list_b[0]["title"] == "B1"
        assert list_b[0]["id"] not in [c["id"] for c in list_a]

    def test_legacy_conversations_not_exposed(self, client, db_session):
        # Query DB for legacy records where user_id is None
        legacy_count = db_session.scalar(
            select(func.count(Conversation.id)).where(Conversation.user_id.is_(None))
        )
        assert legacy_count >= 2, "Legacy records must exist in database"

        # Neither User A nor User B should see legacy conversations
        list_a = client.get("/api/conversations", headers=self.headers_a).json()
        for c in list_a:
            db_c = db_session.get(Conversation, c["id"])
            assert db_c.user_id == self.user_a_id

    def test_pinned_conversations_limit_per_user(self, client):
        # User A creates and pins 7 conversations
        for i in range(7):
            c = client.post("/api/conversations", json={"title": f"Pin A {i}"}, headers=self.headers_a).json()
            pin_res = client.patch(f"/api/conversations/{c['id']}/pin", headers=self.headers_a)
            assert pin_res.status_code == 200

        # Attempting 8th pin for User A must fail with 400
        c8 = client.post("/api/conversations", json={"title": "Pin A 8"}, headers=self.headers_a).json()
        assert client.patch(f"/api/conversations/{c8['id']}/pin", headers=self.headers_a).status_code == 400

        # User B should still be able to pin their own conversation
        cb = client.post("/api/conversations", json={"title": "Pin B 1"}, headers=self.headers_b).json()
        assert client.patch(f"/api/conversations/{cb['id']}/pin", headers=self.headers_b).status_code == 200


class TestRegressionPhase1And2:
    """Tests regression of LLM chat fallback, history restoration, title generation, and persistence."""

    def test_chat_message_flow_and_ownership(self, client, db_session):
        # Create dedicated test user
        email = f"chatreg_{uuid.uuid4().hex[:6]}@example.com"
        password = "Password123!"
        res_reg = client.post("/api/auth/register", json={"email": email, "password": password})
        user_id = res_reg.json()["id"]
        res_login = client.post("/api/auth/login", json={"email": email, "password": password})
        headers = {"Authorization": f"Bearer {res_login.json()['access_token']}"}

        # 1. Send first message without conversation_id -> Auto-creates conversation owned by user
        res_turn1 = client.post("/api/chat", json={
            "messages": [{"role": "user", "content": "What is the capital of France?"}]
        }, headers=headers)
        assert res_turn1.status_code == 200
        data1 = res_turn1.json()
        conv_id = data1["conversation_id"]
        assert data1["role"] == "assistant"
        assert len(data1["content"]) > 0
        assert data1["provider"] in ["mistral", "gemini"]

        # Check conversation ownership in DB
        db_conv = db_session.get(Conversation, conv_id)
        assert db_conv is not None
        assert db_conv.user_id == user_id
        assert "France" in db_conv.title or "capital" in db_conv.title.lower()

        # 2. Send second message with conversation_id -> Restores history and appends
        res_turn2 = client.post("/api/chat", json={
            "conversation_id": conv_id,
            "messages": [
                {"role": "user", "content": "What is the capital of France?"},
                {"role": "assistant", "content": data1["content"]},
                {"role": "user", "content": "What is its population?"},
            ]
        }, headers=headers)
        assert res_turn2.status_code == 200
        data2 = res_turn2.json()
        assert data2["conversation_id"] == conv_id
        assert data2["provider"] in ["mistral", "gemini"]

        # Verify DB messages count: 2 user + 2 assistant = 4 messages
        msgs = db_session.scalars(
            select(Message).where(Message.conversation_id == conv_id).order_by(Message.created_at.asc())
        ).all()
        assert len(msgs) == 4
        assert msgs[0].role == "user"
        assert msgs[1].role == "assistant"
        assert msgs[2].role == "user"
        assert msgs[3].role == "assistant"

        # 3. Clean up user (cascades delete of conversation and messages)
        user = db_session.get(User, user_id)
        if user:
            db_session.delete(user)
            db_session.commit()

        # Verify cascade deletion
        assert db_session.get(Conversation, conv_id) is None
