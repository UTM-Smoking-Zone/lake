# Contributing to Trading Analytics Platform

Thank you for your interest in contributing! 🎉

## Getting Started

1. **Fork the repository**
2. **Clone your fork**
   ```bash
   git clone https://github.com/YOUR_USERNAME/lake.git
   cd lake
   ```
3. **Create a branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

## Development Setup

### Prerequisites
- Docker & Docker Compose
- Python 3.11+
- Git

### Local Environment

1. **Copy environment variables**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` with your local configuration.

2. **Start all services**
   ```bash
   ./start.sh
   ```

3. **Run tests**
   ```bash
   ./test-api.sh
   ```

## Project Structure

```
lake/
├── platform/back/          # Microservices
│   ├── api-gateway/        # Port 8000
│   ├── user-service/       # Port 8006
│   ├── portfolio-service/  # Port 8001
│   ├── order-service/      # Port 8002
│   ├── transaction-service/# Port 8003
│   ├── analytics-service/  # Port 8004
│   ├── ml-service/         # Port 8005
│   └── ingestion-service/  # Kafka consumer
├── kafka/                  # Data pipeline
├── k8s/                    # Kubernetes manifests
├── scripts/                # Database initialization
└── docker-compose.yml      # Local orchestration
```

## Coding Standards

### Python
- Follow PEP 8
- Use type hints
- Maximum line length: 100 characters
- Use meaningful variable names
- Add docstrings to functions/classes

### Commits
Follow [Conventional Commits](https://www.conventionalcommits.org/):
```
feat: add new ML prediction model
fix: resolve database connection timeout
docs: update README with deployment steps
refactor: simplify order matching logic
test: add unit tests for portfolio service
```

## Pull Request Process

1. **Update documentation** if needed
2. **Add tests** for new features
3. **Ensure all tests pass**
4. **Update CHANGELOG.md** if applicable
5. **Submit PR** with clear description

### PR Checklist
- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex code
- [ ] Documentation updated
- [ ] Tests added/updated
- [ ] All CI checks passing

## Code Review

All submissions require review. We use GitHub pull requests for this purpose.

## Questions?

- Open an issue for bugs
- Use Discussions for questions
- Check existing issues before creating new ones

## Team Members

- **Nick** - Architecture & Infrastructure
- **Dan** - Backend Development
- **Damian** - Frontend Development
- **Valentina** - ML & Analytics

---

Happy coding! 🚀
