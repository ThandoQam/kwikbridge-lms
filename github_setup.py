#!/usr/bin/env python3
"""
KwikBridge LMS — GitHub Setup
Creates a private repo and pushes the initial codebase.

Usage:
  python3 github_setup.py YOUR_GITHUB_TOKEN [your_github_username]

To generate a token:
  1. Go to https://github.com/settings/tokens/new
  2. Select scopes: repo (full control)
  3. Generate and copy the token
"""
import sys, os, subprocess

if len(sys.argv) < 2:
    print("Usage: python3 github_setup.py YOUR_GITHUB_TOKEN [github_username]")
    print("\nGenerate a token at: https://github.com/settings/tokens/new")
    print("Required scope: repo")
    sys.exit(1)

token = sys.argv[1]
username = sys.argv[2] if len(sys.argv) > 2 else None

try:
    from github import Github
except ImportError:
    print("Installing PyGithub...")
    os.system("pip install PyGithub --quiet")
    from github import Github

g = Github(token)
user = g.get_user()
if not username:
    username = user.login

print(f"Authenticated as: {username}")

# Create repo
repo_name = "kwikbridge-lms"
try:
    repo = user.create_repo(
        name=repo_name,
        description="KwikBridge Loan Management System — Cloud-based LMS for ThandoQ and Associates",
        private=True,
        auto_init=False,
    )
    print(f"Created repo: {repo.html_url}")
except Exception as e:
    if "already exists" in str(e):
        repo = user.get_repo(repo_name)
        print(f"Repo already exists: {repo.html_url}")
    else:
        print(f"Error creating repo: {e}")
        sys.exit(1)

# Set remote and push
remote_url = f"https://{username}:{token}@github.com/{username}/{repo_name}.git"
os.chdir(os.path.dirname(os.path.abspath(__file__)))

subprocess.run(["git", "remote", "remove", "origin"], capture_output=True)
subprocess.run(["git", "remote", "add", "origin", remote_url], check=True)
result = subprocess.run(["git", "push", "-u", "origin", "main"], capture_output=True, text=True)

if result.returncode == 0:
    print(f"\nPushed successfully to: https://github.com/{username}/{repo_name}")
    print(f"\nTo push future changes:")
    print(f"  cd kwikbridge-lms")
    print(f"  python3 check.py src/kwikbridge-lms-v2.jsx  # integrity check")
    print(f"  git add -A && git commit -m 'description' && git push")
else:
    print(f"Push failed: {result.stderr}")
    print("\nTry manually:")
    print(f"  git remote add origin https://github.com/{username}/{repo_name}.git")
    print(f"  git push -u origin main")
