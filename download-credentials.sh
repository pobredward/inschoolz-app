#!/bin/bash

# cdNoagwJiZ 키를 다운로드하고 credentials.json에 저장
echo "Downloading cdNoagwJiZ credentials..."

# EAS CLI에 명령어 전달
expect << 'EOF'
spawn eas credentials
expect "Select platform"
send "Android\r"
expect "Which build profile"
send "production\r"
expect "What do you want to do"
send "credentials.json: Upload/Download credentials between EAS servers and your local json\r"
expect "What do you want to do"
send "Download credentials from EAS to credentials.json\r"
expect "Select build credentials"
send "Build Credentials cdNoagwJiZ\r"
expect eof
EOF
