#!/bin/bash
set -e

echo "======================================"
echo " KIET Face Recognition App - Startup "
echo "======================================"

# -------- Python Backend (FastAPI) --------
echo "Starting Python Face Recognition Service..."

cd python-service

# Install dependencies
pip install --upgrade pip
pip install -r requirements.txt

# Start FastAPI
uvicorn main:app --host 0.0.0.0 --port 8000 &

echo "Python backend running on port 8000"

# -------- Node Backend (Express) --------
echo "Starting Node.js Backend..."

cd ../node-backend

# Install dependencies
npm install

# Start Node server
node app.js

echo "Node backend running"
