# Proofline - Backend

```shell
# Env template

DATABASE_URL="postgresql://proofline:proofline@localhost:5434/proofline"
PORT="3000"
NODE_ENV="dev"

```

<br>

### Tools

- NodeJS
- Express
- Prisma
- PostgreSQL
- Typescript

### Production env sync

```shell
# Keep only these two files:
# .env (local)
# .env.production (production values)

# Push .env.production to Lightsail and restart services
export LIGHTSAIL_HOST=your_host
export LIGHTSAIL_USER=ubuntu
export LIGHTSAIL_SSH_PRIVATE_KEY=/absolute/path/to/key.pem
pnpm env:sync:production
```
