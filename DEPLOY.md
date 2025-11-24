# Spyfall Deployment Guide

This guide will help you deploy your Spyfall game so you can play with friends online.

## Strategy
- **Frontend (Client)**: Deployed on **Vercel** (Free, fast, easy).
- **Backend (Server)**: Deployed on **Render** (Free tier, supports WebSockets).

---

## Part 1: Deploy Backend (Server) to Render

1.  Push your code to **GitHub** (if you haven't already).
2.  Go to [dashboard.render.com](https://dashboard.render.com/) and sign up/login.
3.  Click **"New +"** -> **"Web Service"**.
4.  Connect your GitHub repository.
5.  **Configure the service**:
    - **Name**: `spyfall-server` (or anything you like)
    - **Root Directory**: `server` (Important!)
    - **Runtime**: `Node`
    - **Build Command**: `npm install`
    - **Start Command**: `node index.js`
    - **Instance Type**: Free
6.  Click **"Create Web Service"**.
7.  Wait for it to deploy. Once finished, copy the **URL** (e.g., `https://spyfall-server.onrender.com`). You will need this for the frontend.

---

## Part 2: Deploy Frontend (Client) to Vercel

1.  Go to [vercel.com](https://vercel.com/) and sign up/login.
2.  Click **"Add New..."** -> **"Project"**.
3.  Import your GitHub repository.
4.  **Configure the project**:
    - **Framework Preset**: Vite (should be auto-detected)
    - **Root Directory**: Click "Edit" and select `client`.
    - **Environment Variables**:
        - Key: `VITE_API_URL`
        - Value: The **Render URL** you copied in Part 1 (e.g., `https://spyfall-server.onrender.com`).
5.  Click **"Deploy"**.
6.  Wait for it to finish. You will get a domain (e.g., `spyfall-game.vercel.app`).

---

## Part 3: Final Connection

1.  Go back to your **Render Dashboard**.
2.  Go to the **"Environment"** tab of your `spyfall-server`.
3.  Add a new Environment Variable:
    - **Key**: `CLIENT_URL`
    - **Value**: Your **Vercel URL** (e.g., `https://spyfall-game.vercel.app`).
    - *Note: Remove any trailing slash `/` from the URL.*
4.  Render will automatically restart the server.

**Done!** You can now open your Vercel URL and play with friends.
