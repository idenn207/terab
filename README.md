# terab

> NAS에서 돌아가는 셀프호스팅 파일 관리 서비스

![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.x-6DB33F?logo=springboot&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)
![MinIO](https://img.shields.io/badge/MinIO-S3%20Compatible-C72E49?logo=minio&logoColor=white)
![Docker](https://img.shields.io/badge/Docker%20Swarm-운영-2496ED?logo=docker&logoColor=white)

```mermaid
graph LR
    subgraph Client
        B[Browser]
        A[Android App]
    end

    subgraph Terab Services
        N[Nginx\n리버스 프록시]
        W[Web\nReact + Vite]
        API[API\nSpring Boot]
    end

    subgraph Storage
        DB[(PostgreSQL)]
        S3[(MinIO\nS3 호환)]
    end

    B --> N
    A --> N
    N --> W
    N --> API
    API --> DB
    API --> S3
```
