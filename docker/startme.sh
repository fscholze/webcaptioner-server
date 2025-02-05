#!/bin/bash

pushd webcaptioner-ng-back
echo "PORT=$WEBCAPTIONER_BACKEND_PORT"  > .env
echo "SOTRA_SERVER_CTRANSLATE_URL=$SOTRA_SERVER_CTRANSLATE_URL" >> .env
echo "SOTRA_SERVER_FAIRSEQ_URL=$SOTRA_SERVER_FAIRSEQ_URL" >> .env
echo "VOSK_SERVER_URL=$VOSK_SERVER_URL" >> .env
echo "MONGODB_URI=$MONGODB_URI" >> .env
echo "JWT_SECRET_KEY=$JWT_SECRET_KEY" >> .env
popd

cd webcaptioner-ng-back && npm run dev
