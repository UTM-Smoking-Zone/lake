#!/usr/bin/env python3
"""
Trading Platform - Comprehensive Project Audit & Testing Framework
===================================================================
Version: 2.0
Author: Project Team
Date: 2025-10-26

This script performs deep analysis of:
- Infrastructure health and configuration
- Microservices implementation quality
- Data pipeline integrity
- Code quality and best practices
- Performance benchmarks
- Security checks
"""

import os
import sys
import json
import yaml
import subprocess
import re
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass, asdict
from enum import Enum
import hashlib

# Color codes for terminal output
class Colors:
    HEADER = '\033[95m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'

class Severity(Enum):
    CRITICAL = "🔴 CRITICAL"
    HIGH = "🟠 HIGH"
    MEDIUM = "🟡 MEDIUM"
    LOW = "🟢 LOW"
    INFO = "ℹ️ INFO"

@dataclass
class TestResult:
    name: str
    category: str
    passed: bool
    severity: Severity
    message: str
    details: Optional[Dict] = None
    recommendations: List[str] = None
    
    def __post_init__(self):
        if self.recommendations is None:
            self.recommendations = []

class ProjectAuditor:
    """Main auditor class for comprehensive project analysis"""
    
    def __init__(self, project_root: str):
        self.project_root = Path(project_root)
        self.results: List[TestResult] = []
        self.metrics = {
            'total_tests': 0,
            'passed': 0,
            'failed': 0,
            'warnings': 0,
            'critical_issues': 0,
            'code_quality_score': 0,
            'architecture_score': 0,
            'security_score': 0,
            'performance_score': 0
        }
        
    def print_header(self, text: str, level: int = 1):
        """Print formatted header"""
        symbols = {1: '═', 2: '─', 3: '·'}
        symbol = symbols.get(level, '─')
        width = 80
        
        print(f"\n{Colors.BOLD}{Colors.BLUE}{symbol * width}{Colors.ENDC}")
        print(f"{Colors.BOLD}{Colors.CYAN}{text.center(width)}{Colors.ENDC}")
        print(f"{Colors.BOLD}{Colors.BLUE}{symbol * width}{Colors.ENDC}\n")
    
    def add_result(self, result: TestResult):
        """Add test result and update metrics"""
        self.results.append(result)
        self.metrics['total_tests'] += 1
        
        if result.passed:
            self.metrics['passed'] += 1
        else:
            self.metrics['failed'] += 1
            if result.severity == Severity.CRITICAL:
                self.metrics['critical_issues'] += 1
    
    def run_all_audits(self):
        """Execute all audit categories"""
        self.print_header("🔍 TRADING PLATFORM - COMPREHENSIVE AUDIT", 1)
        print(f"{Colors.BOLD}Project Root:{Colors.ENDC} {self.project_root}")
        print(f"{Colors.BOLD}Audit Time:{Colors.ENDC} {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        
        # Run all audit categories
        audit_categories = [
            ("1️⃣  Infrastructure Health Check", self.audit_infrastructure),
            ("2️⃣  Docker & Container Orchestration", self.audit_docker),
            ("3️⃣  Microservices Architecture", self.audit_microservices),
            ("4️⃣  Data Pipeline Integrity", self.audit_data_pipeline),
            ("5️⃣  Code Quality & Best Practices", self.audit_code_quality),
            ("6️⃣  Security Analysis", self.audit_security),
            ("7️⃣  Performance & Scalability", self.audit_performance),
            ("8️⃣  Testing Coverage", self.audit_testing),
            ("9️⃣  Documentation Quality", self.audit_documentation),
            ("🔟 Configuration Management", self.audit_configuration),
        ]
        
        for title, audit_func in audit_categories:
            self.print_header(title, 2)
            try:
                audit_func()
            except Exception as e:
                print(f"{Colors.RED}❌ Audit failed: {e}{Colors.ENDC}")
        
        # Generate final report
        self.generate_report()
    
    def audit_infrastructure(self):
        """Audit infrastructure setup and health"""
        print(f"{Colors.BOLD}Checking infrastructure components...{Colors.ENDC}\n")
        
        # Check Docker Compose
        compose_file = self.project_root / "docker-compose.yml"
        if compose_file.exists():
            with open(compose_file) as f:
                compose_config = yaml.safe_load(f)
                
            services = compose_config.get('services', {})
            required_services = {
                'kafka': {'ports': ['9092'], 'depends_on': ['zookeeper']},
                'zookeeper': {'ports': ['2181']},
                'timescaledb': {'ports': ['5432'], 'volumes': True},
                'postgres': {'ports': ['5433'], 'volumes': True},
                'redis': {'ports': ['6379']},
                'minio': {'ports': ['9000', '9001'], 'volumes': True},
            }
            
            for service_name, requirements in required_services.items():
                if service_name in services:
                    service_config = services[service_name]
                    issues = []
                    
                    # Check ports
                    if 'ports' in requirements:
                        service_ports = service_config.get('ports', [])
                        for required_port in requirements['ports']:
                            port_found = any(required_port in str(p) for p in service_ports)
                            if not port_found:
                                issues.append(f"Missing port {required_port}")
                    
                    # Check volumes
                    if requirements.get('volumes'):
                        if 'volumes' not in service_config:
                            issues.append("No volume persistence configured")
                    
                    # Check dependencies
                    if 'depends_on' in requirements:
                        service_deps = service_config.get('depends_on', [])
                        for dep in requirements['depends_on']:
                            if dep not in service_deps:
                                issues.append(f"Missing dependency: {dep}")
                    
                    if issues:
                        self.add_result(TestResult(
                            name=f"Service: {service_name}",
                            category="Infrastructure",
                            passed=False,
                            severity=Severity.HIGH,
                            message=f"Configuration issues found",
                            details={'issues': issues},
                            recommendations=[f"Fix {service_name} configuration in docker-compose.yml"]
                        ))
                        print(f"{Colors.YELLOW}⚠️  {service_name}: {', '.join(issues)}{Colors.ENDC}")
                    else:
                        self.add_result(TestResult(
                            name=f"Service: {service_name}",
                            category="Infrastructure",
                            passed=True,
                            severity=Severity.INFO,
                            message="Correctly configured"
                        ))
                        print(f"{Colors.GREEN}✅ {service_name}: Properly configured{Colors.ENDC}")
                else:
                    self.add_result(TestResult(
                        name=f"Service: {service_name}",
                        category="Infrastructure",
                        passed=False,
                        severity=Severity.CRITICAL,
                        message=f"Required service '{service_name}' missing from docker-compose.yml",
                        recommendations=[f"Add {service_name} service to docker-compose.yml"]
                    ))
                    print(f"{Colors.RED}❌ {service_name}: Missing from configuration{Colors.ENDC}")
        else:
            self.add_result(TestResult(
                name="Docker Compose",
                category="Infrastructure",
                passed=False,
                severity=Severity.CRITICAL,
                message="docker-compose.yml not found",
                recommendations=["Create docker-compose.yml with all required services"]
            ))
            print(f"{Colors.RED}❌ docker-compose.yml not found{Colors.ENDC}")
        
        # Check if services are running
        print(f"\n{Colors.BOLD}Checking if services are running...{Colors.ENDC}")
        try:
            result = subprocess.run(
                ['docker-compose', 'ps'],
                cwd=self.project_root,
                capture_output=True,
                text=True
            )
            
            if result.returncode == 0:
                running_services = result.stdout
                for service in ['kafka', 'zookeeper', 'postgres', 'redis', 'minio']:
                    if service in running_services and 'Up' in running_services:
                        print(f"{Colors.GREEN}✅ {service}: Running{Colors.ENDC}")
                    else:
                        print(f"{Colors.YELLOW}⚠️  {service}: Not running{Colors.ENDC}")
        except FileNotFoundError:
            print(f"{Colors.RED}❌ docker-compose command not found{Colors.ENDC}")
    
    def audit_docker(self):
        """Audit Docker and containerization setup"""
        print(f"{Colors.BOLD}Analyzing Docker configuration...{Colors.ENDC}\n")
        
        # Check Dockerfiles
        dockerfiles = list(self.project_root.rglob("Dockerfile"))
        print(f"Found {len(dockerfiles)} Dockerfile(s)")
        
        for dockerfile in dockerfiles:
            with open(dockerfile) as f:
                content = f.read()
                
            issues = []
            recommendations = []
            
            # Check best practices
            if 'FROM scratch' not in content and 'FROM alpine' not in content:
                if 'FROM python:3' in content and '-alpine' not in content:
                    issues.append("Not using minimal base image")
                    recommendations.append("Consider using python:3.11-alpine for smaller image size")
            
            if 'COPY . .' in content or 'ADD . .' in content:
                issues.append("Copying entire context (inefficient)")
                recommendations.append("Copy only necessary files")
            
            if 'apt-get update' in content and 'apt-get clean' not in content:
                issues.append("Not cleaning apt cache")
                recommendations.append("Add 'apt-get clean' to reduce image size")
            
            if 'pip install' in content and '--no-cache-dir' not in content:
                issues.append("Not using --no-cache-dir for pip")
                recommendations.append("Use 'pip install --no-cache-dir' to reduce image size")
            
            # Check for security issues
            if 'USER root' in content or ('USER' not in content and 'gosu' not in content):
                issues.append("Running as root user")
                recommendations.append("Add non-root USER instruction")
            
            service_name = dockerfile.parent.name
            
            if issues:
                self.add_result(TestResult(
                    name=f"Dockerfile: {service_name}",
                    category="Docker",
                    passed=False,
                    severity=Severity.MEDIUM,
                    message=f"{len(issues)} best practice violations",
                    details={'issues': issues},
                    recommendations=recommendations
                ))
                print(f"{Colors.YELLOW}⚠️  {service_name}/Dockerfile: {len(issues)} issues{Colors.ENDC}")
            else:
                self.add_result(TestResult(
                    name=f"Dockerfile: {service_name}",
                    category="Docker",
                    passed=True,
                    severity=Severity.INFO,
                    message="Follows best practices"
                ))
                print(f"{Colors.GREEN}✅ {service_name}/Dockerfile: Good{Colors.ENDC}")
        
        # Check .dockerignore
        dockerignore = self.project_root / ".dockerignore"
        if dockerignore.exists():
            with open(dockerignore) as f:
                ignored = f.read()
            required_ignores = ['.git', '__pycache__', '*.pyc', '.env', 'node_modules']
            missing = [item for item in required_ignores if item not in ignored]
            
            if missing:
                self.add_result(TestResult(
                    name=".dockerignore",
                    category="Docker",
                    passed=False,
                    severity=Severity.LOW,
                    message=f"Missing {len(missing)} recommended patterns",
                    details={'missing': missing},
                    recommendations=["Add missing patterns to .dockerignore"]
                ))
                print(f"{Colors.YELLOW}⚠️  .dockerignore: Missing patterns: {', '.join(missing)}{Colors.ENDC}")
            else:
                print(f"{Colors.GREEN}✅ .dockerignore: Complete{Colors.ENDC}")
        else:
            self.add_result(TestResult(
                name=".dockerignore",
                category="Docker",
                passed=False,
                severity=Severity.MEDIUM,
                message=".dockerignore file missing",
                recommendations=["Create .dockerignore to optimize build context"]
            ))
            print(f"{Colors.RED}❌ .dockerignore not found{Colors.ENDC}")
    
    def audit_microservices(self):
        """Audit microservices implementation"""
        print(f"{Colors.BOLD}Analyzing microservices architecture...{Colors.ENDC}\n")
        
        services_dir = self.project_root / "services"
        if not services_dir.exists():
            print(f"{Colors.RED}❌ Services directory not found{Colors.ENDC}")
            return
        
        required_services = {
            'market-data-collector': {'main.py', 'config.py', 'requirements.txt'},
            'stream-processor': {'main.py', 'config.py', 'requirements.txt'},
            'analytics-aggregator': {'main.py', 'config.py', 'requirements.txt'},
            'technical-indicators': {'main.py', 'config.py', 'requirements.txt'},
            'signal-generator': {'main.py', 'config.py', 'requirements.txt'},
            'api-gateway': {'main.py', 'config.py', 'requirements.txt'},
            'portfolio-service': {'main.py', 'models.py', 'requirements.txt'},
            'order-service': {'main.py', 'models.py', 'requirements.txt'},
        }
        
        for service_name, required_files in required_services.items():
            service_path = services_dir / service_name
            
            if not service_path.exists():
                self.add_result(TestResult(
                    name=f"Service: {service_name}",
                    category="Microservices",
                    passed=False,
                    severity=Severity.HIGH,
                    message="Service directory not found",
                    recommendations=[f"Create {service_name} service directory and files"]
                ))
                print(f"{Colors.RED}❌ {service_name}: Not found{Colors.ENDC}")
                continue
            
            # Check required files
            missing_files = []
            existing_files = []
            for req_file in required_files:
                file_path = service_path / req_file
                if file_path.exists():
                    existing_files.append(req_file)
                else:
                    missing_files.append(req_file)
            
            # Analyze main.py if exists
            main_py = service_path / "main.py"
            code_issues = []
            
            if main_py.exists():
                with open(main_py) as f:
                    code = f.read()
                    lines = code.split('\n')
                
                # Check code quality
                if 'import logging' in code or 'from logging' in code:
                    if 'logging.basicConfig' not in code and 'logging.config' not in code:
                        code_issues.append("Logging imported but not configured")
                else:
                    code_issues.append("No logging implementation")
                
                if 'from fastapi' in code:
                    if '@app.get' not in code and '@app.post' not in code:
                        code_issues.append("FastAPI imported but no endpoints defined")
                
                # Check for error handling
                if 'try:' in code:
                    try_count = code.count('try:')
                    except_count = code.count('except')
                    if try_count != except_count:
                        code_issues.append("Unmatched try/except blocks")
                else:
                    code_issues.append("No error handling (try/except)")
                
                # Check for environment variables
                if 'os.getenv' in code or 'os.environ' in code:
                    if '.env' not in code and 'load_dotenv' not in code:
                        code_issues.append("Using env vars without python-dotenv")
                
                # Calculate code metrics
                loc = len([l for l in lines if l.strip() and not l.strip().startswith('#')])
                complexity_score = 100 - len(code_issues) * 10
                
                details = {
                    'lines_of_code': loc,
                    'code_issues': code_issues,
                    'complexity_score': max(0, complexity_score),
                    'existing_files': existing_files,
                    'missing_files': missing_files
                }
                
                if missing_files or code_issues:
                    severity = Severity.HIGH if missing_files else Severity.MEDIUM
                    self.add_result(TestResult(
                        name=f"Service: {service_name}",
                        category="Microservices",
                        passed=False,
                        severity=severity,
                        message=f"{len(missing_files)} missing files, {len(code_issues)} code issues",
                        details=details,
                        recommendations=[
                            f"Add missing files: {', '.join(missing_files)}" if missing_files else None,
                            "Fix code quality issues" if code_issues else None
                        ]
                    ))
                    print(f"{Colors.YELLOW}⚠️  {service_name}: {loc} LOC, Score: {complexity_score}/100{Colors.ENDC}")
                    if missing_files:
                        print(f"    Missing: {', '.join(missing_files)}")
                    if code_issues:
                        print(f"    Issues: {', '.join(code_issues[:2])}...")
                else:
                    self.add_result(TestResult(
                        name=f"Service: {service_name}",
                        category="Microservices",
                        passed=True,
                        severity=Severity.INFO,
                        message=f"Well implemented ({loc} LOC)",
                        details=details
                    ))
                    print(f"{Colors.GREEN}✅ {service_name}: {loc} LOC, Score: {complexity_score}/100{Colors.ENDC}")
    
    def audit_data_pipeline(self):
        """Audit data pipeline integrity and configuration"""
        print(f"{Colors.BOLD}Analyzing data pipeline...{Colors.ENDC}\n")
        
        # Check Kafka configuration
        print(f"{Colors.BOLD}Kafka Configuration:{Colors.ENDC}")
        kafka_dirs = [
            self.project_root / "config" / "kafka",
            self.project_root / "kafka",
        ]
        
        kafka_config_found = False
        for kafka_dir in kafka_dirs:
            if kafka_dir.exists():
                kafka_config_found = True
                config_files = list(kafka_dir.glob("*.yml")) + list(kafka_dir.glob("*.yaml")) + list(kafka_dir.glob("*.json"))
                
                if config_files:
                    print(f"{Colors.GREEN}✅ Found {len(config_files)} Kafka config file(s){Colors.ENDC}")
                    
                    for config_file in config_files:
                        with open(config_file) as f:
                            if config_file.suffix in ['.yml', '.yaml']:
                                config = yaml.safe_load(f)
                            else:
                                config = json.load(f)
                        
                        # Check for required topics
                        if 'topics' in config:
                            topics = config['topics']
                            required_topics = [
                                'raw_market_data',
                                'processed_market_data',
                                'indicators',
                                'trading_signals',
                                'order_events'
                            ]
                            
                            for topic in required_topics:
                                if topic in topics:
                                    topic_config = topics[topic]
                                    issues = []
                                    
                                    if 'partitions' not in topic_config:
                                        issues.append("No partition count specified")
                                    elif topic_config['partitions'] < 3:
                                        issues.append(f"Low partition count: {topic_config['partitions']}")
                                    
                                    if 'replication_factor' not in topic_config:
                                        issues.append("No replication factor specified")
                                    elif topic_config['replication_factor'] < 2:
                                        issues.append("Low replication factor")
                                    
                                    if issues:
                                        print(f"{Colors.YELLOW}  ⚠️  {topic}: {', '.join(issues)}{Colors.ENDC}")
                                    else:
                                        print(f"{Colors.GREEN}  ✅ {topic}: Well configured{Colors.ENDC}")
                                else:
                                    print(f"{Colors.RED}  ❌ {topic}: Not defined{Colors.ENDC}")
                break
        
        if not kafka_config_found:
            print(f"{Colors.RED}❌ No Kafka configuration directory found{Colors.ENDC}")
            self.add_result(TestResult(
                name="Kafka Configuration",
                category="Data Pipeline",
                passed=False,
                severity=Severity.HIGH,
                message="Kafka topics configuration missing",
                recommendations=["Create Kafka configuration with topic definitions"]
            ))
        
        # Check MinIO buckets configuration
        print(f"\n{Colors.BOLD}MinIO Configuration:{Colors.ENDC}")
        minio_script = self.project_root / "scripts" / "init_minio.sh"
        
        if minio_script.exists():
            with open(minio_script) as f:
                script_content = f.read()
            
            required_buckets = ['raw-market-data', 'processed-data-backup', 'historical-data']
            buckets_found = []
            
            for bucket in required_buckets:
                if bucket in script_content:
                    buckets_found.append(bucket)
                    print(f"{Colors.GREEN}✅ Bucket: {bucket}{Colors.ENDC}")
                else:
                    print(f"{Colors.RED}❌ Bucket: {bucket} - Not configured{Colors.ENDC}")
            
            if len(buckets_found) == len(required_buckets):
                self.add_result(TestResult(
                    name="MinIO Buckets",
                    category="Data Pipeline",
                    passed=True,
                    severity=Severity.INFO,
                    message="All required buckets configured"
                ))
            else:
                missing = set(required_buckets) - set(buckets_found)
                self.add_result(TestResult(
                    name="MinIO Buckets",
                    category="Data Pipeline",
                    passed=False,
                    severity=Severity.MEDIUM,
                    message=f"Missing {len(missing)} bucket(s)",
                    details={'missing_buckets': list(missing)},
                    recommendations=[f"Add bucket creation for: {', '.join(missing)}"]
                ))
        else:
            print(f"{Colors.RED}❌ MinIO initialization script not found{Colors.ENDC}")
            self.add_result(TestResult(
                name="MinIO Setup",
                category="Data Pipeline",
                passed=False,
                severity=Severity.HIGH,
                message="MinIO initialization script missing",
                recommendations=["Create scripts/init_minio.sh for bucket setup"]
            ))
        
        # Check database schemas
        print(f"\n{Colors.BOLD}Database Schemas:{Colors.ENDC}")
        migrations_dir = self.project_root / "migrations"
        
        if migrations_dir.exists():
            migration_files = list(migrations_dir.glob("*.sql"))
            print(f"{Colors.GREEN}✅ Found {len(migration_files)} migration file(s){Colors.ENDC}")
            
            for migration in migration_files:
                with open(migration) as f:
                    sql_content = f.read()
                
                # Check for required tables
                tables_found = re.findall(r'CREATE TABLE\s+(?:IF NOT EXISTS\s+)?(\w+)', sql_content, re.IGNORECASE)
                if tables_found:
                    print(f"  📊 {migration.name}: {len(tables_found)} table(s)")
        else:
            print(f"{Colors.YELLOW}⚠️  No migrations directory found{Colors.ENDC}")
    
    def audit_code_quality(self):
        """Audit code quality and best practices"""
        print(f"{Colors.BOLD}Analyzing code quality...{Colors.ENDC}\n")
        
        # Find all Python files
        py_files = list(self.project_root.rglob("*.py"))
        py_files = [f for f in py_files if 'venv' not in str(f) and '.venv' not in str(f)]
        
        print(f"Analyzing {len(py_files)} Python files...")
        
        total_loc = 0
        total_comments = 0
        total_docstrings = 0
        files_with_issues = 0
        
        for py_file in py_files:
            try:
                with open(py_file) as f:
                    content = f.read()
                    lines = content.split('\n')
                
                # Count lines of code
                code_lines = [l for l in lines if l.strip() and not l.strip().startswith('#')]
                comment_lines = [l for l in lines if l.strip().startswith('#')]
                docstring_count = content.count('"""') + content.count("'''")
                
                total_loc += len(code_lines)
                total_comments += len(comment_lines)
                total_docstrings += docstring_count // 2  # Pairs of quotes
                
                # Check for common issues
                issues = []
                
                if len(code_lines) > 500:
                    issues.append("File too long (>500 LOC)")
                
                if 'import *' in content:
                    issues.append("Using wildcard imports")
                
                if content.count('except:') > content.count('except Exception'):
                    issues.append("Bare except clauses")
                
                # Check function complexity
                functions = re.findall(r'def\s+(\w+)\s*\(', content)
                if len(functions) > 20:
                    issues.append(f"Too many functions ({len(functions)})")
                
                if issues:
                    files_with_issues += 1
            
            except Exception as e:
                pass
        
        # Calculate metrics
        comment_ratio = (total_comments / total_loc * 100) if total_loc > 0 else 0
        docstring_coverage = (total_docstrings / len(py_files) * 100) if py_files else 0
        quality_score = 100 - (files_with_issues / len(py_files) * 50) if py_files else 0
        
        print(f"\n{Colors.BOLD}Code Metrics:{Colors.ENDC}")
        print(f"  Total Lines of Code: {total_loc}")
        print(f"  Comment Lines: {total_comments} ({comment_ratio:.1f}%)")
        print(f"  Docstring Coverage: {docstring_coverage:.1f}%")
        print(f"  Files with Issues: {files_with_issues}/{len(py_files)}")
        print(f"  Overall Quality Score: {quality_score:.0f}/100")
        
        self.metrics['code_quality_score'] = quality_score
        
        # Recommendations
        if comment_ratio < 10:
            print(f"{Colors.YELLOW}⚠️  Low comment ratio (<10%). Add more documentation.{Colors.ENDC}")
        
        if docstring_coverage < 50:
            print(f"{Colors.YELLOW}⚠️  Low docstring coverage. Add docstrings to functions and classes.{Colors.ENDC}")
    
    def audit_security(self):
        """Audit security configuration and vulnerabilities"""
        print(f"{Colors.BOLD}Analyzing security...{Colors.ENDC}\n")
        
        security_score = 100
        issues_found = []
        
        # Check for exposed secrets
        print(f"{Colors.BOLD}Checking for exposed secrets:{Colors.ENDC}")
        py_files = list(self.project_root.rglob("*.py"))
        py_files = [f for f in py_files if 'venv' not in str(f)]
        
        patterns = {
            'API Key': r'api[_-]?key\s*=\s*["\'][^"\']+["\']',
            'Password': r'password\s*=\s*["\'][^"\']+["\']',
            'Secret': r'secret\s*=\s*["\'][^"\']+["\']',
            'Token': r'token\s*=\s*["\'][^"\']+["\']',
        }
        
        for py_file in py_files:
            with open(py_file) as f:
                content = f.read()
            
            for secret_type, pattern in patterns.items():
                matches = re.findall(pattern, content, re.IGNORECASE)
                if matches:
                    issues_found.append(f"{secret_type} in {py_file.name}")
                    security_score -= 10
        
        # Check .env file
        env_file = self.project_root / ".env"
        env_example = self.project_root / ".env.example"
        
        if env_file.exists():
            print(f"{Colors.GREEN}✅ .env file exists{Colors.ENDC}")
            
            # Check if .env is in .gitignore
            gitignore = self.project_root / ".gitignore"
            if gitignore.exists():
                with open(gitignore) as f:
                    if '.env' in f.read():
                        print(f"{Colors.GREEN}✅ .env properly ignored in git{Colors.ENDC}")
                    else:
                        print(f"{Colors.RED}❌ .env NOT in .gitignore - Security Risk!{Colors.ENDC}")
                        security_score -= 30
                        issues_found.append(".env not in .gitignore")
        else:
            print(f"{Colors.YELLOW}⚠️  .env file not found{Colors.ENDC}")
        
        if not env_example.exists():
            print(f"{Colors.YELLOW}⚠️  .env.example not found{Colors.ENDC}")
            security_score -= 5
        
        # Check for SQL injection vulnerabilities
        print(f"\n{Colors.BOLD}Checking for SQL injection risks:{Colors.ENDC}")
        sql_issues = 0
        
        for py_file in py_files:
            with open(py_file) as f:
                content = f.read()
            
            # Check for string concatenation in SQL
            if re.search(r'execute\s*\(\s*f["\']|execute\s*\(\s*["\'].*%s', content):
                sql_issues += 1
                issues_found.append(f"Potential SQL injection in {py_file.name}")
        
        if sql_issues > 0:
            print(f"{Colors.RED}❌ Found {sql_issues} potential SQL injection vulnerability(ies){Colors.ENDC}")
            security_score -= sql_issues * 15
        else:
            print(f"{Colors.GREEN}✅ No SQL injection vulnerabilities detected{Colors.ENDC}")
        
        # Check Docker security
        print(f"\n{Colors.BOLD}Docker Security:{Colors.ENDC}")
        dockerfiles = list(self.project_root.rglob("Dockerfile"))
        
        for dockerfile in dockerfiles:
            with open(dockerfile) as f:
                content = f.read()
            
            if 'USER root' in content or 'USER' not in content:
                print(f"{Colors.YELLOW}⚠️  {dockerfile.name}: Running as root user{Colors.ENDC}")
                security_score -= 10
            else:
                print(f"{Colors.GREEN}✅ {dockerfile.name}: Using non-root user{Colors.ENDC}")
        
        self.metrics['security_score'] = max(0, security_score)
        
        print(f"\n{Colors.BOLD}Security Score: {security_score}/100{Colors.ENDC}")
        
        if issues_found:
            print(f"\n{Colors.RED}Security Issues Found:{Colors.ENDC}")
            for issue in issues_found[:5]:  # Show top 5
                print(f"  • {issue}")
    
    def audit_performance(self):
        """Audit performance and scalability"""
        print(f"{Colors.BOLD}Analyzing performance and scalability...{Colors.ENDC}\n")
        
        # Check database indexes
        print(f"{Colors.BOLD}Database Optimization:{Colors.ENDC}")
        migrations_dir = self.project_root / "migrations"
        
        if migrations_dir.exists():
            index_count = 0
            table_count = 0
            
            for migration in migrations_dir.glob("*.sql"):
                with open(migration) as f:
                    content = f.read()
                
                tables = re.findall(r'CREATE TABLE', content, re.IGNORECASE)
                indexes = re.findall(r'CREATE INDEX', content, re.IGNORECASE)
                
                table_count += len(tables)
                index_count += len(indexes)
            
            if table_count > 0:
                index_ratio = index_count / table_count
                print(f"  Tables: {table_count}")
                print(f"  Indexes: {index_count}")
                print(f"  Index/Table Ratio: {index_ratio:.2f}")
                
                if index_ratio < 2:
                    print(f"{Colors.YELLOW}  ⚠️  Low index coverage. Consider adding more indexes.{Colors.ENDC}")
                else:
                    print(f"{Colors.GREEN}  ✅ Good index coverage{Colors.ENDC}")
        
        # Check for caching
        print(f"\n{Colors.BOLD}Caching Strategy:{Colors.ENDC}")
        redis_usage = 0
        
        py_files = list(self.project_root.rglob("*.py"))
        for py_file in [f for f in py_files if 'venv' not in str(f)]:
            with open(py_file) as f:
                content = f.read()
            
            if 'redis' in content.lower():
                redis_usage += 1
        
        if redis_usage > 0:
            print(f"{Colors.GREEN}✅ Redis caching implemented in {redis_usage} file(s){Colors.ENDC}")
        else:
            print(f"{Colors.YELLOW}⚠️  No caching implementation found{Colors.ENDC}")
        
        # Check async/await usage
        print(f"\n{Colors.BOLD}Async Programming:{Colors.ENDC}")
        async_count = 0
        
        for py_file in [f for f in py_files if 'venv' not in str(f)]:
            with open(py_file) as f:
                content = f.read()
            
            if 'async def' in content or 'await ' in content:
                async_count += 1
        
        if async_count > 0:
            print(f"{Colors.GREEN}✅ Async/await used in {async_count} file(s){Colors.ENDC}")
        else:
            print(f"{Colors.YELLOW}⚠️  No async programming found{Colors.ENDC}")
        
        performance_score = 50 + (min(redis_usage, 5) * 5) + (min(async_count, 5) * 5)
        self.metrics['performance_score'] = performance_score
    
    def audit_testing(self):
        """Audit testing coverage and quality"""
        print(f"{Colors.BOLD}Analyzing testing setup...{Colors.ENDC}\n")
        
        tests_dir = self.project_root / "tests"
        
        if tests_dir.exists():
            test_files = list(tests_dir.rglob("test_*.py"))
            print(f"{Colors.GREEN}✅ Found {len(test_files)} test file(s){Colors.ENDC}")
            
            total_tests = 0
            for test_file in test_files:
                with open(test_file) as f:
                    content = f.read()
                
                # Count test functions
                tests = re.findall(r'def test_\w+', content)
                total_tests += len(tests)
                print(f"  {test_file.name}: {len(tests)} test(s)")
            
            print(f"\n{Colors.BOLD}Total Tests: {total_tests}{Colors.ENDC}")
            
            # Check for pytest configuration
            pytest_ini = self.project_root / "pytest.ini"
            setup_cfg = self.project_root / "setup.cfg"
            
            if pytest_ini.exists() or setup_cfg.exists():
                print(f"{Colors.GREEN}✅ Pytest configuration found{Colors.ENDC}")
            else:
                print(f"{Colors.YELLOW}⚠️  No pytest configuration{Colors.ENDC}")
        else:
            print(f"{Colors.RED}❌ No tests directory found{Colors.ENDC}")
            self.add_result(TestResult(
                name="Testing Setup",
                category="Testing",
                passed=False,
                severity=Severity.HIGH,
                message="No tests directory",
                recommendations=["Create tests/ directory and add unit tests"]
            ))
    
    def audit_documentation(self):
        """Audit documentation quality"""
        print(f"{Colors.BOLD}Analyzing documentation...{Colors.ENDC}\n")
        
        # Check for README
        readme_files = list(self.project_root.glob("README*"))
        
        if readme_files:
            readme = readme_files[0]
            with open(readme) as f:
                content = f.read()
            
            sections = {
                'Installation': ['install', 'setup', 'getting started'],
                'Usage': ['usage', 'how to use', 'quick start'],
                'Architecture': ['architecture', 'design', 'overview'],
                'Contributing': ['contributing', 'contribution'],
                'API': ['api', 'endpoints'],
            }
            
            missing_sections = []
            for section, keywords in sections.items():
                if not any(keyword in content.lower() for keyword in keywords):
                    missing_sections.append(section)
            
            if missing_sections:
                print(f"{Colors.YELLOW}⚠️  README missing sections: {', '.join(missing_sections)}{Colors.ENDC}")
            else:
                print(f"{Colors.GREEN}✅ README is comprehensive{Colors.ENDC}")
        else:
            print(f"{Colors.RED}❌ README not found{Colors.ENDC}")
        
        # Check for additional documentation
        docs_dir = self.project_root / "docs"
        if docs_dir.exists():
            doc_files = list(docs_dir.glob("*.md"))
            print(f"{Colors.GREEN}✅ Found {len(doc_files)} documentation file(s) in docs/{Colors.ENDC}")
        else:
            print(f"{Colors.YELLOW}⚠️  No docs/ directory{Colors.ENDC}")
    
    def audit_configuration(self):
        """Audit configuration management"""
        print(f"{Colors.BOLD}Analyzing configuration management...{Colors.ENDC}\n")
        
        config_files = {
            '.env.example': 'Environment variables template',
            'requirements.txt': 'Python dependencies',
            '.gitignore': 'Git ignore patterns',
            '.dockerignore': 'Docker ignore patterns',
            'docker-compose.yml': 'Docker orchestration',
            'pytest.ini': 'Test configuration',
        }
        
        for file_name, description in config_files.items():
            file_path = self.project_root / file_name
            if file_path.exists():
                print(f"{Colors.GREEN}✅ {file_name}: {description}{Colors.ENDC}")
            else:
                print(f"{Colors.YELLOW}⚠️  {file_name}: Not found{Colors.ENDC}")
        
        # Check for configuration directory
        config_dir = self.project_root / "config"
        if config_dir.exists():
            config_count = len(list(config_dir.rglob("*")))
            print(f"{Colors.GREEN}✅ config/ directory exists with {config_count} file(s){Colors.ENDC}")
        else:
            print(f"{Colors.YELLOW}⚠️  No config/ directory{Colors.ENDC}")
    
    def generate_report(self):
        """Generate comprehensive audit report"""
        self.print_header("📊 AUDIT REPORT SUMMARY", 1)
        
        # Calculate overall score
        scores = [
            self.metrics['code_quality_score'],
            self.metrics['security_score'],
            self.metrics['performance_score'],
        ]
        overall_score = sum(scores) / len(scores) if scores else 0
        
        # Display metrics
        print(f"{Colors.BOLD}Test Results:{Colors.ENDC}")
        print(f"  Total Tests: {self.metrics['total_tests']}")
        print(f"  Passed: {Colors.GREEN}{self.metrics['passed']}{Colors.ENDC}")
        print(f"  Failed: {Colors.RED}{self.metrics['failed']}{Colors.ENDC}")
        print(f"  Critical Issues: {Colors.RED}{self.metrics['critical_issues']}{Colors.ENDC}")
        
        print(f"\n{Colors.BOLD}Quality Scores:{Colors.ENDC}")
        print(f"  Code Quality: {self._score_color(self.metrics['code_quality_score'])}{self.metrics['code_quality_score']:.0f}/100{Colors.ENDC}")
        print(f"  Security: {self._score_color(self.metrics['security_score'])}{self.metrics['security_score']:.0f}/100{Colors.ENDC}")
        print(f"  Performance: {self._score_color(self.metrics['performance_score'])}{self.metrics['performance_score']:.0f}/100{Colors.ENDC}")
        
        print(f"\n{Colors.BOLD}Overall Score: {self._score_color(overall_score)}{overall_score:.0f}/100{Colors.ENDC}")
        
        # Progress bar
        bar_length = 40
        filled = int(bar_length * overall_score / 100)
        bar = '█' * filled + '░' * (bar_length - filled)
        print(f"\n[{self._score_color(overall_score)}{bar}{Colors.ENDC}] {overall_score:.1f}%")
        
        # Status message
        if overall_score >= 80:
            status = f"{Colors.GREEN}✅ Excellent! Project is in great shape.{Colors.ENDC}"
        elif overall_score >= 60:
            status = f"{Colors.YELLOW}⚠️  Good progress, but some areas need attention.{Colors.ENDC}"
        elif overall_score >= 40:
            status = f"{Colors.YELLOW}⚠️  Fair. Significant improvements needed.{Colors.ENDC}"
        else:
            status = f"{Colors.RED}❌ Critical issues detected. Immediate action required.{Colors.ENDC}"
        
        print(f"\n{Colors.BOLD}Status:{Colors.ENDC} {status}")
        
        # Top issues by severity
        print(f"\n{Colors.BOLD}Top Critical Issues:{Colors.ENDC}")
        critical = [r for r in self.results if not r.passed and r.severity == Severity.CRITICAL]
        high = [r for r in self.results if not r.passed and r.severity == Severity.HIGH]
        
        if critical:
            print(f"\n{Colors.RED}🔴 CRITICAL:{Colors.ENDC}")
            for result in critical[:5]:
                print(f"  • {result.name}: {result.message}")
                if result.recommendations:
                    print(f"    → {result.recommendations[0]}")
        
        if high:
            print(f"\n{Colors.YELLOW}🟠 HIGH:{Colors.ENDC}")
            for result in high[:5]:
                print(f"  • {result.name}: {result.message}")
                if result.recommendations:
                    print(f"    → {result.recommendations[0]}")
        
        # Recommendations
        print(f"\n{Colors.BOLD}💡 Top Recommendations:{Colors.ENDC}")
        all_recommendations = []
        for result in self.results:
            if not result.passed and result.recommendations:
                all_recommendations.extend(result.recommendations)
        
        unique_recs = list(dict.fromkeys(all_recommendations))[:10]
        for i, rec in enumerate(unique_recs, 1):
            print(f"  {i}. {rec}")
        
        # Save report to file
        report_file = self.project_root / "audit_report.json"
        report_data = {
            'timestamp': datetime.now().isoformat(),
            'metrics': self.metrics,
            'overall_score': overall_score,
            'results': [asdict(r) for r in self.results],
            'summary': {
                'total_tests': self.metrics['total_tests'],
                'passed': self.metrics['passed'],
                'failed': self.metrics['failed'],
                'critical_issues': self.metrics['critical_issues'],
            }
        }
        
        with open(report_file, 'w') as f:
            json.dump(report_data, f, indent=2, default=str)
        
        print(f"\n{Colors.BOLD}📁 Full report saved to:{Colors.ENDC} {report_file}")
        
        # Generate badge
        badge_color = self._get_badge_color(overall_score)
        print(f"\n{Colors.BOLD}📛 Project Badge:{Colors.ENDC}")
        print(f"![Project Status](https://img.shields.io/badge/audit-{overall_score:.0f}%25-{badge_color})")
    
    def _score_color(self, score):
        """Get color for score"""
        if score >= 80:
            return Colors.GREEN
        elif score >= 60:
            return Colors.YELLOW
        else:
            return Colors.RED
    
    def _get_badge_color(self, score):
        """Get badge color for score"""
        if score >= 80:
            return "brightgreen"
        elif score >= 60:
            return "yellow"
        else:
            return "red"

def main():
    """Main execution function"""
    project_root = sys.argv[1] if len(sys.argv) > 1 else os.getcwd()
    
    auditor = ProjectAuditor(project_root)
    auditor.run_all_audits()
    
    # Exit with appropriate code
    if auditor.metrics['critical_issues'] > 0:
        sys.exit(1)
    elif auditor.metrics['failed'] > auditor.metrics['passed']:
        sys.exit(1)
    else:
        sys.exit(0)

if __name__ == "__main__":
    main()