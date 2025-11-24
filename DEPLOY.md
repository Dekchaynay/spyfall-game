# Spyfall Deployment Guide

This guide will help you deploy your Spyfall game so you can play with friends online.

## Strategy
- **Frontend (Client)**: Deployed on **Vercel** (Free, fast, easy).
- **Backend (Server)**: Deployed on **Render** (Free tier, supports WebSockets).

---

## Part 1: Deploy Backend (Server) to Render

1.  **Code is already on GitHub!**
    - Repo: [https://github.com/Dekchaynay/spyfall-game](https://github.com/Dekchaynay/spyfall-game)
2.  Go to [dashboard.render.com](https://dashboard.render.com/) and sign up/login.
3.  Click **"New +"** -> **"Web Service"**.
4.  Connect your GitHub repository (`spyfall-game`).
5.  **Configure the service**:
    - **Name**: `spyfall-server`
    - **Root Directory**: `server` (Important!)
    - **Runtime**: `Node`
    - **Build Command**: `npm install`
    - **Start Command**: `node index.js`
    - **Instance Type**: Free
6.  Click **"Create Web Service"**.
7.  Wait for it to deploy. Once finished, copy the **URL** (e.g., `https://spyfall-server.onrender.com`).

---

## Part 2: Frontend (Client) is Deployed!

I have already deployed the client for you.
- **URL**: [https://client-g7gtc3yd7-nanays-projects.vercel.app](https://client-g7gtc3yd7-nanays-projects.vercel.app)
- *(Note: You can also find this in your Vercel dashboard)*

**IMPORTANT**: You need to update the Vercel deployment with the Render URL.
1.  Go to your Vercel Project Settings.
2.  **Environment Variables**:
    - Key: `VITE_API_URL`
    - Value: The **Render URL** from Part 1.
3.  **Redeploy** (Go to Deployments -> Redeploy) for the change to take effect.

---

## Part 3: Final Connection

1.  Go back to your **Render Dashboard**.
2.  Go to the **"Environment"** tab of your `spyfall-server`.
3.  Add a new Environment Variable:
    - **Key**: `CLIENT_URL`
    - **Value**: `https://client-g7gtc3yd7-nanays-projects.vercel.app` (or your custom domain).
4.  Render will automatically restart the server.

**Done!** Open the Vercel URL to play.
