<deploy_instructions>
# How to set up Git Deployment for RL Trader on AWS VPS

Using Git for deployment is the professional way to manage code. It will NOT consume much space on your VPS because Git only stores the text changes of your code, and we will configure it to ignore heavy files (like database files, node_modules, log files, etc.).

Here is the step-by-step guide to set this up:

## Part 1: Setting up the Local Repository (On your Computer)

1. **Initialize Git:**
   Open your terminal (PowerShell or VS Code Terminal) in the `V4_VPS` folder and run:
   ```bash
   git init
   ```

2. **Add Files and Commit:**
   We have already created a `.gitignore` file so Git won't track heavy/useless files. Now run:
   ```bash
   git add .
   git commit -m "Initial commit for VPS deployment"
   ```

3. **Create a Private GitHub Repository:**
   - Go to [GitHub.com](https://github.com/) and create an account if you don't have one.
   - Click the `+` icon in the top right -> `New repository`.
   - Name it something like `rl-trader-vps`.
   - **Crucial:** Make sure to select **Private** so no one else can see your code.
   - Click `Create repository`.

4. **Link Local Code to GitHub:**
   GitHub will show you some instructions. Look for the section "…or push an existing repository from the command line" and copy/paste those commands into your terminal. They look like this:
   ```bash
   git branch -M main
   git remote add origin https://github.com/SEU_USUARIO/rl-trader-vps.git
   git push -u origin main
   ```
   *(It will ask you to login to GitHub).*

---

## Part 2: Setting up the VPS (On your AWS Windows Server)

1. **Install Git on the VPS:**
   - Access your AWS VPS.
   - Open PowerShell as Administrator and install Git (if you don't have it):
     ```powershell
     winget install --id Git.Git -e --source winget
     ```
   - *Alternative:* Download it from [git-scm.com](https://git-scm.com/download/win).

2. **Clone the Repository:**
   - Create a folder where the bot will run (e.g., `C:\RL_Trader`).
   - Open PowerShell in that folder and run:
     ```bash
     git clone https://github.com/SEU_USUARIO/rl-trader-vps.git .
     ```
   *(It will ask for your GitHub login once).*

3. **Create the Update Script:**
   - Inside the bot folder on the VPS, create a file named `update.bat`.
   - Right-click, Edit, and paste this code:
     ```bat
     @echo off
     echo Updating RL Trader from GitHub...
     git pull origin main
     echo Update complete!
     echo (If you have new python packages, run: pip install -r requirements.txt)
     pause
     ```

## Your New Daily Workflow
1. You make changes on your **Local Computer**.
2. When finished, you run:
   ```bash
   git add .
   git commit -m "Describe what you changed"
   git push
   ```
3. You go to your **AWS VPS** and double-click `update.bat`.
4. Done! O bot está atualizado.
</deploy_instructions>
