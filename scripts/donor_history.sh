#!/usr/bin/env bash

set -o errexit
set -o nounset
set -o pipefail
#set -o xtrace

SCRATCH_FILE="scratch/donorhistory_`date -u +%FT%TZ`.csv"
SFTP_BATCH_FILE=`cat <<EOF
cd FoundationDonors/
ls
put $SCRATCH_FILE
bye
EOF`

mkdir -p scratch
psql $DATABASE_URL -c "\copy (SELECT * FROM donor_history) TO '$SCRATCH_FILE' WITH DELIMITER AS ';' CSV HEADER FORCE QUOTE email, most_recent_donation_date"
echo "$BRICKFTP_PRIVATE_KEY" > scratch/brickftp_id_rsa
chmod 700 scratch/brickftp_id_rsa
echo "$SFTP_BATCH_FILE" > scratch/brickftp_batch
sftp -i scratch/brickftp_id_rsa -b scratch/brickftp_batch $BRICKFTP_USERNAME@mozilla.brickftp.com
rm -rf scratch

echo "The file has been uploaded successfully. You'll need to hit Ctrl-C to kill this process because of Heroku Spaces one-off dyno limitations"

# Heroku dynos run for 24 hrs + 0-216 minutes. By sleeping for 28h we guarantee that the script won't exit
sleep 28h
