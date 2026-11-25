#!/bin/sh
# Creates in the cluster the Secret of each PostgreSQL server, <service>-db, with the user and database named after the service
# and a random password, so no credential is ever in the repository. A Secret that already exists is kept: PostgreSQL takes the
# password only when it creates its data directory, so a new one would lock the services out of their data.
set -eu

kubectl apply -f "$(dirname "$0")/namespace.yaml"
for service in account membership editing discussion notification; do
  if kubectl get secret "$service-db" --namespace gotion > /dev/null 2>&1; then
    echo "secret/$service-db kept"
    continue
  fi
  # Hexadecimal, so the password goes into a connection URL as it is
  kubectl create secret generic "$service-db" --namespace gotion \
    --from-literal=POSTGRES_USER="$service" \
    --from-literal=POSTGRES_DB="$service" \
    --from-literal=POSTGRES_PASSWORD="$(od -An -N24 -tx1 /dev/urandom | tr -d ' \n')"
done
