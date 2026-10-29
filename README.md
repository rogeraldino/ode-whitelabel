# Educational platform reference implementation

Reference source for a web platform that supports educators in preparing teaching materials. This repository is intended for code review and portfolio demonstration; it does not include an installation guide or production credentials.

## Architecture at a glance

- `frontend/`: React single-page application, educator tools, session handling, and document previews.
- `backend/`: Django REST API, domain apps, authentication, content processing, and document generation.
- PostgreSQL: relational application data.
- Redis and Celery: background task queue and workers for longer operations.
- Language-model integrations: assisted material generation, configured through environment variables.

The interactive portfolio demo uses fictional data and simulated responses. It does not connect to this source application's services.

## Repository map

Backend and frontend code are kept in separate directories. Docker Compose describes the service topology. Environment-specific values are read from environment variables; secrets must be supplied by the host environment and must never be committed.

## Credits

Copyright (c) 2025 Rodrigo Geraldino Feitosa Silva, Joyce Beatriz Ferreira da Costa, Mateus Fernandes Bezerra, and Danylo Bezerra Mendes.

All rights reserved. This reference copy is shared for inspection. No license to deploy, modify, redistribute, or commercialize the software is granted by this notice.
