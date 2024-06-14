#!/bin/bash

pushd webcaptioner-ng-back
echo "PORT=$WEBCAPTIONER_BACKEND_PORT"  > .env
echo "SOTRA_SERVER_URL=$SOTRA_SERVER_URL" >> .env
popd

cd webcaptioner-ng-back && npm run dev
