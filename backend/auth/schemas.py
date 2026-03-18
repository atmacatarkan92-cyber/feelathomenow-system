from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, model_validator


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=200)

    @model_validator(mode="after")
    def _password_not_whitespace_only(self):
        # Password may include spaces, but whitespace-only is always invalid.
        if not self.password or not self.password.strip():
            raise ValueError("password must not be empty")
        return self


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserMe(BaseModel):
    id: str
    email: EmailStr
    full_name: str
    role: str
    is_active: bool
    last_login_at: datetime | None = None

