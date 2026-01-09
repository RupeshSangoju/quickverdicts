#!/bin/bash
echo "=== Checking for running Node processes ==="
ps aux | grep node | grep -v grep

echo ""
echo "=== Checking backend port 4000 ==="
lsof -i :4000 2>/dev/null || netstat -tulpn 2>/dev/null | grep 4000

echo ""
echo "=== Quick test of IsDeleted filter ==="
echo "If you see IsDeleted = 0 in the routes file, the code is correct:"
grep -n "IsDeleted = 0" backend/routes/admin.js | head -5
