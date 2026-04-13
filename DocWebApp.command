#!/bin/bash
cd "$(dirname "$0")/DocWebApp"
lsof -ti :14296 | xargs kill -9 2>/dev/null
sleep 0.5
echo "DocWebApp başlatılıyor..."
node server.js &
sleep 1 && open http://localhost:14296
wait
