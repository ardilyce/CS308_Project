from flask import Flask, request, jsonify
from flask_cors import CORS
from sqlalchemy import create_engine, Column, Integer, String
from sqlalchemy.orm import sessionmaker, declarative_base
from passlib.hash import bcrypt
from dotenv import load_dotenv
import os
import jwt
from datetime import datetime, timedelta, timezone

# ---- ENVIRONMENT ----
load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")
SECRET_KEY = os.getenv("SECRET_KEY", "dev-key")

# ---- APP SETUP ----
app = Flask(__name__)
CORS(app, origins="*")

# ---- DATABASE ----
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key = True)
    email = Column(String(255), unique = True, nullable= False)
    password_hash = Column(String(255), nullable=False)

Base.metadata.create_all(engine)

# ---- ROUTES ----
@app.post("/api/login")
def login():
    data = request.json
    if data is None:
        raise ValueError("No JSON data")
    email = data.get("email")
    password = data.get("password")

    if not email or not password:
        return jsonify({"ok": False, "error": "Email and password required"}), 400
    
    with SessionLocal() as db:
        user = db.query(User).filter(User.email == email).first()
        if not user:
            return jsonify({"ok": False, "error": "User not found"}), 404
        
        if not bcrypt.verify(password, user.password_hash):
            return jsonify({"ok": False, "error": "Wrong password"}), 401
        
        now = datetime.now(timezone.utc)
        payload = {
            "user_id": user.id,
            "email": user.email,
            "iat": now, # initial time 
            "exp": now + timedelta(hours=12)
        }

        token = jwt.token(payload, SECRET_KEY, algorithm="HS256")

        return jsonify({
            "ok": True,
            "token": token,
            "user": {"id": user.id, "email": user.email}
        }), 200
    