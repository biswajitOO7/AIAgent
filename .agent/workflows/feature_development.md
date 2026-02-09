---
description: Process for developing new features with specific branching and deployment strategy
---

# Feature Development Workflow

1.  **Create Branch**:
    -   Format: `feature/YYYYMMDD/HHMM`
    -   Example: `git checkout -b feature/20260209/1605`

2.  **Develop Feature**:
    -   Implement changes.
    -   Commit changes.

3.  **Deploy Branch**:
    -   Push to GitHub: `git push origin <branch_name>`
    -   Deploy to Hugging Face Space (Temporary): `git push space <branch_name>:main --force`

4.  **Request Merge**:
    -   Notify user to merge PR to `main` on GitHub.
