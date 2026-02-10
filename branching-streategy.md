# Git Branching & Deployment Strategy

This project uses a *Timestamp-Based Feature Branch Workflow* with direct deployment to Hugging Face Spaces for testing.

## 🌳 Branching Naming Convention

### 1. Feature Branches
- *Format*: feature/YYYYMMDD/HHMM
- *Example*: feature/20260209/1605
- *Source*: main

### 2. Hotfix Branches
- *Format*: hotfix/YYYYMMDD/HHMM
- *Example*: hotfix/20260210/0930
- *Source*: main

### 3. Main Branch (main)
- *Purpose*: Stable production code.
- *Protection*: Direct commits are discouraged; use Pull Requests (PRs).

---

## 🔄 Workflow Cycle

### 1. Start Development
Create a new branch using the current date and time (24h format):
bash
# Example: It's Feb 9th, 2026 at 4:30 PM
git checkout main
git pull origin main
git checkout -b feature/20260209/1630


### 2. Implementation
Make your changes and commit them:
bash
git add .
git commit -m "feat: description of changes"


### 3. Deployment & Testing (Live)
To test your changes live on Hugging Face Spaces *before* merging:
1.  *Backup*: Push to GitHub first (safe storage).
    bash
    git push origin feature/20260209/1630
    
2.  *Deploy*: Force-push your feature branch to the Hugging Face main branch.
    bash
    # This overwrites the live Space with your feature branch code
    git push --force space feature/20260209/1630:main
    
3.  *Verify*: Check your running app on Hugging Face.

### 4. Merge Request
Once the feature is verified live:
1.  Go to GitHub.
2.  Open a *Pull Request (PR)* from feature/20260209/1630 to main.
3.  Request review / Merge.
4.  After merging, the main branch is updated.
    - Note: You may need to sync space with main again if others have deployed.
    bash
    git checkout main
    git pull origin main
    git push space main