#!/usr/bin/env python3
"""
Project Status Evaluator
Analyzes your trading platform project and shows what's completed vs pending
"""

import os
import sys
import json
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Tuple

# ANSI color codes
GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
BLUE = '\033[94m'
BOLD = '\033[1m'
RESET = '\033[0m'

class ProjectEvaluator:
    def __init__(self, project_root: str = "."):
        self.project_root = Path(project_root)
        self.results = {
            "infrastructure": {},
            "services": {},
            "data_pipeline": {},
            "frontend": {},
            "database": {},
            "analytics": {},
            "overall": {}
        }
        
    def check_file_exists(self, path: str) -> bool:
        """Check if file exists"""
        return (self.project_root / path).exists()
    
    def check_dir_exists(self, path: str) -> bool:
        """Check if directory exists"""
        return (self.project_root / path).is_dir()
    
    def check_docker_service(self, service_name: str) -> bool:
        """Check if docker service exists in docker-compose.yml"""
        compose_file = self.project_root / "docker-compose.yml"
        if not compose_file.exists():
            return False
        
        content = compose_file.read_text()
        return service_name in content
    
    def count_lines_in_file(self, path: str) -> int:
        """Count lines in a file"""
        try:
            file_path = self.project_root / path
            if not file_path.exists():
                return 0
            return len(file_path.read_text().splitlines())
        except:
            return 0
    
    def check_python_imports(self, path: str, imports: List[str]) -> Dict[str, bool]:
        """Check if Python file has required imports"""
        try:
            file_path = self.project_root / path
            if not file_path.exists():
                return {imp: False for imp in imports}
            
            content = file_path.read_text()
            return {imp: imp in content for imp in imports}
        except:
            return {imp: False for imp in imports}
    
    def evaluate_infrastructure(self) -> Dict:
        """Evaluate infrastructure setup"""
        checks = {
            "Docker Compose exists": self.check_file_exists("docker-compose.yml"),
            "Kafka service": self.check_docker_service("kafka"),
            "Zookeeper service": self.check_docker_service("zookeeper"),
            "MinIO service": self.check_docker_service("minio"),
            "PostgreSQL service": self.check_docker_service("postgres"),
            "TimescaleDB service": self.check_docker_service("timescaledb"),
            "Redis service": self.check_docker_service("redis"),
            "Spark Master service": self.check_docker_service("spark-master"),
        }
        
        completed = sum(checks.values())
        total = len(checks)
        
        return {
            "checks": checks,
            "completed": completed,
            "total": total,
            "percentage": (completed / total * 100) if total > 0 else 0
        }
    
    def evaluate_services(self) -> Dict:
        """Evaluate microservices implementation"""
        services = {
            "Market Data Collector": {
                "dir": "services/market-data-collector",
                "main_file": "services/market-data-collector/main.py",
                "required_imports": ["kafka", "websocket", "ccxt"]
            },
            "Stream Processor": {
                "dir": "services/stream-processor",
                "main_file": "services/stream-processor/main.py",
                "required_imports": ["kafka", "pyspark"]
            },
            "Analytics Aggregator": {
                "dir": "services/analytics-aggregator",
                "main_file": "services/analytics-aggregator/main.py",
                "required_imports": ["pyspark", "redis"]
            },
            "API Gateway": {
                "dir": "services/api",
                "main_file": "services/api/main.py",
                "required_imports": ["fastapi", "pyspark"]
            },
            "Frontend Dashboard": {
                "dir": "frontend",
                "main_file": "frontend/package.json",
                "required_imports": []
            },
            "Portfolio Service": {
                "dir": "services/portfolio",
                "main_file": "services/portfolio/main.py",
                "required_imports": ["fastapi", "sqlalchemy"]
            }
        }
        
        results = {}
        total_completed = 0
        
        for service_name, config in services.items():
            dir_exists = self.check_dir_exists(config["dir"])
            main_exists = self.check_file_exists(config["main_file"])
            
            if main_exists and config["required_imports"]:
                imports = self.check_python_imports(config["main_file"], config["required_imports"])
                imports_ok = sum(imports.values()) >= len(config["required_imports"]) * 0.5
            else:
                imports = {}
                imports_ok = main_exists
            
            lines = self.count_lines_in_file(config["main_file"]) if main_exists else 0
            
            status = "✅ Complete" if (dir_exists and main_exists and lines > 50) else \
                     "🟡 In Progress" if (dir_exists or main_exists) else \
                     "❌ Not Started"
            
            if status == "✅ Complete":
                total_completed += 1
            
            results[service_name] = {
                "status": status,
                "dir_exists": dir_exists,
                "main_exists": main_exists,
                "lines_of_code": lines,
                "imports": imports
            }
        
        return {
            "services": results,
            "completed": total_completed,
            "total": len(services),
            "percentage": (total_completed / len(services) * 100)
        }
    
    def evaluate_data_pipeline(self) -> Dict:
        """Evaluate data pipeline status"""
        checks = {
            "Kafka topics created": self.check_file_exists("scripts/create_topics.sh"),
            "Bronze layer schema": self.check_file_exists("services/kafka-consumer/schemas/bronze.sql"),
            "Silver layer schema": self.check_file_exists("services/spark-aggregator/schemas/silver.sql"),
            "MinIO buckets setup": self.check_file_exists("scripts/init_minio.sh"),
            "Data quality checks": self.check_file_exists("scripts/validate_data.py"),
            "Monitoring setup": self.check_file_exists("monitoring/prometheus.yml"),
        }
        
        completed = sum(checks.values())
        total = len(checks)
        
        return {
            "checks": checks,
            "completed": completed,
            "total": total,
            "percentage": (completed / total * 100) if total > 0 else 0
        }
    
    def evaluate_frontend(self) -> Dict:
        """Evaluate frontend implementation"""
        checks = {
            "Next.js setup": self.check_file_exists("frontend/package.json"),
            "Main dashboard page": self.check_file_exists("frontend/app/page.tsx"),
            "Candlestick chart component": self.check_file_exists("frontend/components/charts/CandlestickChart.tsx"),
            "Metrics card component": self.check_file_exists("frontend/components/charts/MetricsCard.tsx"),
            "API client": self.check_file_exists("frontend/lib/api.ts"),
            "Tailwind config": self.check_file_exists("frontend/tailwind.config.js"),
        }
        
        completed = sum(checks.values())
        total = len(checks)
        
        return {
            "checks": checks,
            "completed": completed,
            "total": total,
            "percentage": (completed / total * 100) if total > 0 else 0
        }
    
    def evaluate_database(self) -> Dict:
        """Evaluate database implementation"""
        checks = {
            "Schema migrations": self.check_file_exists("database/migrations/001_initial.sql"),
            "Portfolio schema": self.check_file_exists("database/schemas/portfolio.sql"),
            "Indexes created": self.check_file_exists("database/schemas/indexes.sql"),
            "Query optimization": self.check_file_exists("database/queries/optimized.sql"),
        }
        
        completed = sum(checks.values())
        total = len(checks)
        
        return {
            "checks": checks,
            "completed": completed,
            "total": total,
            "percentage": (completed / total * 100) if total > 0 else 0
        }
    
    def evaluate_analytics(self) -> Dict:
        """Evaluate analytics and ML implementation"""
        checks = {
            "EDA notebook": self.check_file_exists("notebooks/analysis/eda.ipynb"),
            "Feature engineering": self.check_file_exists("notebooks/analysis/features.ipynb"),
            "ML models notebook": self.check_file_exists("notebooks/models/price_prediction.ipynb"),
            "Trained models": self.check_file_exists("models/lstm_model.h5") or 
                            self.check_file_exists("models/best_model.pkl"),
            "Predictions pipeline": self.check_file_exists("services/predictions/predict.py"),
        }
        
        completed = sum(checks.values())
        total = len(checks)
        
        return {
            "checks": checks,
            "completed": completed,
            "total": total,
            "percentage": (completed / total * 100) if total > 0 else 0
        }
    
    def run_evaluation(self):
        """Run full project evaluation"""
        print(f"\n{BOLD}{'='*60}{RESET}")
        print(f"{BOLD}{BLUE}🔍 Trading Platform - Project Status Evaluation{RESET}")
        print(f"{BOLD}{'='*60}{RESET}\n")
        print(f"📅 Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"📁 Project Root: {self.project_root.absolute()}\n")
        
        # Evaluate each category
        self.results["infrastructure"] = self.evaluate_infrastructure()
        self.results["services"] = self.evaluate_services()
        self.results["data_pipeline"] = self.evaluate_data_pipeline()
        self.results["frontend"] = self.evaluate_frontend()
        self.results["database"] = self.evaluate_database()
        self.results["analytics"] = self.evaluate_analytics()
        
        # Print results
        self.print_category_results("1️⃣  Infrastructure", self.results["infrastructure"])
        self.print_category_results("2️⃣  Microservices", self.results["services"])
        self.print_category_results("3️⃣  Data Pipeline", self.results["data_pipeline"])
        self.print_category_results("4️⃣  Frontend", self.results["frontend"])
        self.print_category_results("5️⃣  Database", self.results["database"])
        self.print_category_results("6️⃣  Analytics & ML", self.results["analytics"])
        
        # Calculate overall progress
        self.calculate_overall_progress()
        
        # Print recommendations
        self.print_recommendations()
    
    def print_category_results(self, title: str, results: Dict):
        """Print results for a category"""
        percentage = results.get("percentage", 0)
        
        # Color based on completion
        if percentage >= 80:
            color = GREEN
            status = "✅ Excellent"
        elif percentage >= 50:
            color = YELLOW
            status = "🟡 In Progress"
        else:
            color = RED
            status = "❌ Needs Work"
        
        print(f"\n{BOLD}{title}{RESET}")
        print(f"{'-'*60}")
        print(f"Progress: {color}{percentage:.1f}%{RESET} {status}")
        
        if "checks" in results:
            print("\nDetailed Checks:")
            for check, passed in results["checks"].items():
                icon = f"{GREEN}✓{RESET}" if passed else f"{RED}✗{RESET}"
                print(f"  {icon} {check}")
        
        if "services" in results:
            print("\nServices Status:")
            for service, details in results["services"].items():
                print(f"  {details['status']} {service}")
                if details["lines_of_code"] > 0:
                    print(f"      📝 {details['lines_of_code']} lines of code")
    
    def calculate_overall_progress(self):
        """Calculate and display overall project progress"""
        categories = ["infrastructure", "services", "data_pipeline", "frontend", "database", "analytics"]
        total_percentage = sum(self.results[cat]["percentage"] for cat in categories)
        overall = total_percentage / len(categories)
        
        self.results["overall"] = {
            "percentage": overall,
            "completed_categories": sum(1 for cat in categories if self.results[cat]["percentage"] >= 80),
            "total_categories": len(categories)
        }
        
        print(f"\n{BOLD}{'='*60}{RESET}")
        print(f"{BOLD}📊 OVERALL PROJECT STATUS{RESET}")
        print(f"{BOLD}{'='*60}{RESET}\n")
        
        # Progress bar
        bar_length = 40
        filled = int(bar_length * overall / 100)
        bar = '█' * filled + '░' * (bar_length - filled)
        
        if overall >= 80:
            color = GREEN
            emoji = "🎉"
            status_text = "Excellent! Almost ready for demo"
        elif overall >= 50:
            color = YELLOW
            emoji = "💪"
            status_text = "Good progress! Keep going"
        else:
            color = RED
            emoji = "🚀"
            status_text = "Getting started! Focus on priorities"
        
        print(f"{emoji} Overall Progress: {color}{overall:.1f}%{RESET}")
        print(f"[{color}{bar}{RESET}]\n")
        print(f"Status: {status_text}\n")
        
        # Category breakdown
        print("Category Breakdown:")
        for cat in categories:
            pct = self.results[cat]["percentage"]
            status = "✅" if pct >= 80 else "🟡" if pct >= 50 else "❌"
            print(f"  {status} {cat.replace('_', ' ').title()}: {pct:.0f}%")
    
    def print_recommendations(self):
        """Print recommendations based on status"""
        print(f"\n{BOLD}💡 RECOMMENDATIONS{RESET}")
        print(f"{'-'*60}\n")
        
        overall = self.results["overall"]["percentage"]
        
        priorities = []
        
        # Check each category
        if self.results["infrastructure"]["percentage"] < 80:
            priorities.append("🔴 HIGH: Complete infrastructure setup (Docker Compose)")
        
        if self.results["services"]["percentage"] < 50:
            priorities.append("🔴 HIGH: Start building core microservices")
        
        if self.results["data_pipeline"]["percentage"] < 50:
            priorities.append("🟡 MEDIUM: Setup data pipeline (Kafka → Bronze → Silver)")
        
        if self.results["frontend"]["percentage"] < 50:
            priorities.append("🟡 MEDIUM: Build frontend dashboard")
        
        if self.results["analytics"]["percentage"] < 50:
            priorities.append("🟢 LOW: Start ML models (can be done in parallel)")
        
        if not priorities:
            print("✅ Great job! All major components are in place.")
            print("   Focus on:")
            print("   • Testing and bug fixes")
            print("   • Performance optimization")
            print("   • Documentation")
            print("   • Demo preparation")
        else:
            print("Priority Tasks:")
            for i, priority in enumerate(priorities, 1):
                print(f"{i}. {priority}")
        
        print(f"\n{BOLD}📅 NEXT STEPS{RESET}")
        print(f"{'-'*60}")
        
        if overall < 30:
            print("\n🚀 You're just getting started! Focus on:")
            print("   1. Setup all infrastructure (Docker Compose)")
            print("   2. Build Market Data Collector")
            print("   3. Setup Kafka and test data flow")
        elif overall < 60:
            print("\n💪 You're making progress! Next priorities:")
            print("   1. Complete all 6 microservices")
            print("   2. Ensure data flows end-to-end")
            print("   3. Start building frontend")
        else:
            print("\n🎯 You're almost there! Final push:")
            print("   1. Integration testing")
            print("   2. Polish frontend UI")
            print("   3. Prepare demo scenario")
            print("   4. Create presentation slides")
    
    def export_json(self, output_file: str = "project_status.json"):
        """Export results to JSON"""
        with open(output_file, 'w') as f:
            json.dump(self.results, f, indent=2)
        print(f"\n✅ Results exported to {output_file}")


def main():
    """Main entry point"""
    project_root = sys.argv[1] if len(sys.argv) > 1 else "."
    
    evaluator = ProjectEvaluator(project_root)
    evaluator.run_evaluation()
    evaluator.export_json()
    
    print(f"\n{BOLD}{'='*60}{RESET}")
    print(f"{GREEN}✅ Evaluation complete!{RESET}")
    print(f"{BOLD}{'='*60}{RESET}\n")


if __name__ == "__main__":
    main()