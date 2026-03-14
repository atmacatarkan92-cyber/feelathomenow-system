"""
Small helper script to create an initial platform_admin user.

Usage (from backend directory):
    python create_admin_user.py

The script will prompt for email and password via stdin and does not log them.
"""

from getpass import getpass

from sqlmodel import select

from db.database import get_session
from db.models import User, UserCredentials, UserRole
from auth.security import hash_password


def main() -> None:
    session = get_session()

    try:
        email = input("Admin email: ").strip()
        if not email:
            print("Email is required.")
            return

        # Check if user already exists
        existing = session.exec(select(User).where(User.email == email)).first()
        if existing:
            print(f"User with email '{email}' already exists (id={existing.id}). Aborting.")
            return

        password = getpass("Admin password: ")
        password_confirm = getpass("Confirm password: ")

        if not password:
            print("Password is required.")
            return

        if password != password_confirm:
            print("Passwords do not match. Aborting.")
            return

        user = User(
            email=email,
            full_name="Platform Admin",
            role=UserRole.platform_admin,
            is_active=True,
        )
        session.add(user)
        session.commit()
        session.refresh(user)

        creds = UserCredentials(
            user_id=user.id,
            password_hash=hash_password(password),
        )
        session.add(creds)
        session.commit()

        print(f"Created platform_admin user with id={user.id}")
    finally:
        session.close()


if __name__ == "__main__":
    main()

