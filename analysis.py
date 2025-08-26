#!/usr/bin/env python3
"""
Глубокая инспекция данных для выяснения реального содержимого
и причин большого объема
"""

import os
import json
from pathlib import Path
from datetime import datetime
import pandas as pd
import numpy as np
from collections import defaultdict
import subprocess

class DeepDataInspector:
    def __init__(self, minio_path="data/minio"):
        self.minio_path = Path(minio_path)
        self.warehouse_path = self.minio_path / "warehouse"
        
    def full_inspection(self):
        """Полная инспекция - ЧТО именно занимает место"""
        print("🔍 ГЛУБОКАЯ ИНСПЕКЦИЯ ДАННЫХ")
        print("="*80)
        
        # 1. Детальный анализ размеров по директориям
        print("\n1️⃣ АНАЛИЗ РАЗМЕРОВ ПО ДИРЕКТОРИЯМ")
        dir_sizes = self.analyze_directory_sizes()
        
        # 2. Анализ содержимого файлов
        print("\n2️⃣ АНАЛИЗ СОДЕРЖИМОГО ФАЙЛОВ")
        content_analysis = self.analyze_file_contents()
        
        # 3. Поиск дубликатов и избыточности
        print("\n3️⃣ ПОИСК ДУБЛИКАТОВ И ИЗБЫТОЧНОСТИ")
        duplicates = self.find_data_redundancy()
        
        # 4. Анализ временного распределения
        print("\n4️⃣ ВРЕМЕННОЕ РАСПРЕДЕЛЕНИЕ ДАННЫХ")
        time_analysis = self.analyze_time_distribution()
        
        # 5. Проверка на аномалии
        print("\n5️⃣ ПОИСК АНОМАЛИЙ В ДАННЫХ")
        anomalies = self.find_data_anomalies()
        
        # 6. Финальный отчет
        self.print_inspection_report({
            'dir_sizes': dir_sizes,
            'content': content_analysis,
            'duplicates': duplicates,
            'time_analysis': time_analysis,
            'anomalies': anomalies
        })
    
    def analyze_directory_sizes(self):
        """Детальный анализ размеров директорий"""
        print("   Анализируем размеры директорий...")
        
        sizes = {}
        
        # Используем системную команду du для точного подсчета
        try:
            result = subprocess.run(['du', '-h', '--max-depth=3', str(self.warehouse_path)], 
                                  capture_output=True, text=True)
            
            for line in result.stdout.strip().split('\n'):
                if line:
                    parts = line.split('\t')
                    if len(parts) == 2:
                        size_str, path = parts
                        relative_path = Path(path).relative_to(self.warehouse_path)
                        sizes[str(relative_path)] = size_str
                        
        except Exception as e:
            print(f"   Ошибка du команды: {e}")
            
            # Fallback - ручной подсчет
            for root, dirs, files in os.walk(self.warehouse_path):
                total_size = 0
                for file in files:
                    try:
                        file_path = Path(root) / file
                        total_size += file_path.stat().st_size
                    except:
                        pass
                
                if total_size > 0:
                    relative_path = Path(root).relative_to(self.warehouse_path)
                    sizes[str(relative_path)] = self._format_size(total_size)
        
        return sizes
    
    def analyze_file_contents(self):
        """Анализ реального содержимого файлов"""
        print("   Анализируем содержимое файлов...")
        
        analysis = {
            'file_types': {},
            'largest_files': [],
            'sample_contents': [],
            'compression_efficiency': {}
        }
        
        # Находим все файлы и группируем по типам
        all_files = []
        for root, dirs, files in os.walk(self.warehouse_path):
            for file in files:
                file_path = Path(root) / file
                try:
                    size = file_path.stat().st_size
                    ext = file_path.suffix.lower()
                    
                    all_files.append({
                        'path': file_path,
                        'size': size,
                        'extension': ext,
                        'name': file
                    })
                except:
                    pass
        
        # Группируем по расширениям
        by_extension = defaultdict(list)
        for file_info in all_files:
            by_extension[file_info['extension']].append(file_info)
        
        # Анализируем каждый тип
        for ext, files in by_extension.items():
            total_size = sum(f['size'] for f in files)
            avg_size = total_size / len(files)
            
            analysis['file_types'][ext] = {
                'count': len(files),
                'total_size': total_size,
                'avg_size': avg_size,
                'largest': max(files, key=lambda x: x['size']) if files else None
            }
        
        # Топ-20 самых больших файлов
        all_files.sort(key=lambda x: x['size'], reverse=True)
        analysis['largest_files'] = all_files[:20]
        
        # Анализируем содержимое некоторых файлов
        sample_files = all_files[:10]  # Топ-10 самых больших
        
        for file_info in sample_files:
            file_path = file_info['path']
            content_info = self._analyze_single_file(file_path)
            if content_info:
                analysis['sample_contents'].append({
                    'file': str(file_path),
                    'size': file_info['size'],
                    'content': content_info
                })
        
        return analysis
    
    def _analyze_single_file(self, file_path):
        """Анализ содержимого одного файла"""
        try:
            size = file_path.stat().st_size
            ext = file_path.suffix.lower()
            
            content_info = {
                'size': size,
                'extension': ext,
                'readable': False,
                'type': 'unknown'
            }
            
            # Попытки определить тип файла
            if ext in ['.1', '.parquet']:
                # Проверяем, является ли файл Parquet
                try:
                    with open(file_path, 'rb') as f:
                        header = f.read(4)
                        if header == b'PAR1':
                            content_info['type'] = 'parquet'
                            content_info['readable'] = True
                            
                            # Пытаемся прочитать метаданные Parquet
                            import pyarrow.parquet as pq
                            parquet_file = pq.ParquetFile(file_path)
                            metadata = parquet_file.metadata
                            
                            content_info['parquet_info'] = {
                                'num_rows': metadata.num_rows,
                                'num_columns': metadata.num_columns,
                                'num_row_groups': metadata.num_row_groups,
                                'compressed_size': metadata.serialized_size,
                                'schema': str(parquet_file.schema)[:200] + "..."
                            }
                            
                        else:
                            content_info['type'] = 'binary_unknown'
                            content_info['header_hex'] = header.hex()
                except Exception as e:
                    content_info['read_error'] = str(e)
            
            elif ext == '.meta':
                # Анализ мета-файлов
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        content = f.read()
                        content_info['type'] = 'text'
                        content_info['readable'] = True
                        content_info['char_count'] = len(content)
                        content_info['line_count'] = content.count('\n')
                        
                        # Пытаемся парсить как JSON
                        try:
                            json_data = json.loads(content)
                            content_info['json_valid'] = True
                            content_info['json_keys'] = list(json_data.keys()) if isinstance(json_data, dict) else None
                        except:
                            content_info['json_valid'] = False
                            
                        content_info['preview'] = content[:200] + "..." if len(content) > 200 else content
                        
                except Exception as e:
                    content_info['read_error'] = str(e)
            
            elif ext == '.json':
                # JSON файлы
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        content = f.read()
                        json_data = json.loads(content)
                        
                        content_info.update({
                            'type': 'json',
                            'readable': True,
                            'char_count': len(content),
                            'json_structure': type(json_data).__name__,
                            'preview': str(json_data)[:200] + "..."
                        })
                        
                        if isinstance(json_data, dict):
                            content_info['json_keys'] = list(json_data.keys())
                            
                except Exception as e:
                    content_info['read_error'] = str(e)
            
            return content_info
            
        except Exception as e:
            return {'error': str(e)}
    
    def find_data_redundancy(self):
        """Поиск дубликатов и избыточности данных"""
        print("   Ищем дубликаты и избыточность...")
        
        redundancy = {
            'identical_files': [],
            'similar_files': [],
            'empty_files': [],
            'suspicious_patterns': []
        }
        
        # Группируем файлы по размеру для поиска потенциальных дубликатов
        size_groups = defaultdict(list)
        
        for root, dirs, files in os.walk(self.warehouse_path):
            for file in files:
                file_path = Path(root) / file
                try:
                    size = file_path.stat().st_size
                    
                    if size == 0:
                        redundancy['empty_files'].append(str(file_path))
                    else:
                        size_groups[size].append(file_path)
                        
                except:
                    pass
        
        # Проверяем группы одинакового размера
        for size, files in size_groups.items():
            if len(files) > 1:
                # Для небольших файлов проверяем содержимое
                if size < 1024 * 1024:  # < 1MB
                    content_groups = defaultdict(list)
                    
                    for file_path in files:
                        try:
                            with open(file_path, 'rb') as f:
                                content = f.read()
                                content_hash = hash(content)
                                content_groups[content_hash].append(file_path)
                        except:
                            pass
                    
                    for content_hash, identical_files in content_groups.items():
                        if len(identical_files) > 1:
                            redundancy['identical_files'].append({
                                'files': [str(f) for f in identical_files],
                                'size': size,
                                'count': len(identical_files),
                                'waste_space': size * (len(identical_files) - 1)
                            })
                else:
                    # Для больших файлов записываем как подозрительные
                    redundancy['similar_files'].append({
                        'files': [str(f) for f in files],
                        'size': size,
                        'count': len(files)
                    })
        
        return redundancy
    
    def analyze_time_distribution(self):
        """Анализ временного распределения данных"""
        print("   Анализируем временное распределение...")
        
        time_dist = {
            'files_by_hour': defaultdict(int),
            'files_by_day': defaultdict(int),
            'oldest_file': None,
            'newest_file': None,
            'time_gaps': []
        }
        
        file_times = []
        
        for root, dirs, files in os.walk(self.warehouse_path):
            for file in files:
                file_path = Path(root) / file
                try:
                    stat = file_path.stat()
                    mod_time = datetime.fromtimestamp(stat.st_mtime)
                    
                    file_times.append({
                        'path': file_path,
                        'time': mod_time,
                        'size': stat.st_size
                    })
                    
                    time_dist['files_by_hour'][mod_time.hour] += 1
                    time_dist['files_by_day'][mod_time.date()] += 1
                    
                except:
                    pass
        
        if file_times:
            file_times.sort(key=lambda x: x['time'])
            time_dist['oldest_file'] = file_times[0]
            time_dist['newest_file'] = file_times[-1]
            
            # Ищем большие временные разрывы
            for i in range(1, len(file_times)):
                gap = (file_times[i]['time'] - file_times[i-1]['time']).total_seconds()
                if gap > 3600:  # Больше часа
                    time_dist['time_gaps'].append({
                        'start': file_times[i-1]['time'],
                        'end': file_times[i]['time'],
                        'gap_hours': gap / 3600
                    })
        
        return time_dist
    
    def find_data_anomalies(self):
        """Поиск аномалий в данных"""
        print("   Ищем аномалии...")
        
        anomalies = {
            'oversized_files': [],
            'undersized_files': [],
            'suspicious_names': [],
            'encoding_issues': []
        }
        
        file_sizes = []
        
        for root, dirs, files in os.walk(self.warehouse_path):
            for file in files:
                file_path = Path(root) / file
                try:
                    size = file_path.stat().st_size
                    file_sizes.append(size)
                    
                    ext = file_path.suffix.lower()
                    
                    # Аномально большие файлы для данного типа
                    if ext == '.meta' and size > 100 * 1024:  # > 100KB для meta
                        anomalies['oversized_files'].append({
                            'file': str(file_path),
                            'size': size,
                            'type': 'meta',
                            'expected_max': '10KB'
                        })
                    
                    elif ext in ['.1', '.parquet'] and size > 500 * 1024 * 1024:  # > 500MB
                        anomalies['oversized_files'].append({
                            'file': str(file_path),
                            'size': size,
                            'type': 'data',
                            'expected_max': '100MB'
                        })
                    
                    # Аномально маленькие файлы
                    elif ext in ['.1', '.parquet'] and size < 1024:  # < 1KB
                        anomalies['undersized_files'].append({
                            'file': str(file_path),
                            'size': size,
                            'type': 'data'
                        })
                    
                    # Подозрительные имена
                    if 'temp' in file.lower() or 'tmp' in file.lower():
                        anomalies['suspicious_names'].append(str(file_path))
                    
                except:
                    pass
        
        return anomalies
    
    def _format_size(self, size_bytes):
        """Форматирование размера"""
        for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
            if size_bytes < 1024.0:
                return f"{size_bytes:.1f} {unit}"
            size_bytes /= 1024.0
        return f"{size_bytes:.1f} PB"
    
    def print_inspection_report(self, results):
        """Подробный отчет инспекции"""
        print("\n" + "="*80)
        print("📋 ОТЧЕТ ГЛУБОКОЙ ИНСПЕКЦИИ")
        print("="*80)
        
        # 1. Размеры директорий
        print(f"\n📁 РАЗМЕРЫ ДИРЕКТОРИЙ (ТОП-20):")
        dir_sizes = results['dir_sizes']
        
        # Сортируем директории по размеру (примерно)
        sorted_dirs = []
        for path, size_str in dir_sizes.items():
            # Простое преобразование размера в байты для сортировки
            size_multipliers = {'K': 1024, 'M': 1024**2, 'G': 1024**3, 'T': 1024**4}
            try:
                if size_str[-1] in size_multipliers:
                    size_bytes = float(size_str[:-1]) * size_multipliers[size_str[-1]]
                else:
                    size_bytes = float(size_str)
                sorted_dirs.append((path, size_str, size_bytes))
            except:
                sorted_dirs.append((path, size_str, 0))
        
        sorted_dirs.sort(key=lambda x: x[2], reverse=True)
        
        for path, size_str, _ in sorted_dirs[:20]:
            print(f"   {size_str:>8} | {path}")
        
        # 2. Анализ файлов
        print(f"\n📄 АНАЛИЗ ТИПОВ ФАЙЛОВ:")
        content = results['content']
        
        for ext, info in sorted(content['file_types'].items(), key=lambda x: x[1]['total_size'], reverse=True):
            print(f"\n   Расширение: {ext if ext else '(без расширения)'}")
            print(f"   • Количество: {info['count']:,}")
            print(f"   • Общий размер: {self._format_size(info['total_size'])}")
            print(f"   • Средний размер: {self._format_size(info['avg_size'])}")
            if info['largest']:
                print(f"   • Самый большой: {self._format_size(info['largest']['size'])} ({info['largest']['name']})")
        
        # 3. Самые большие файлы
        print(f"\n🔍 ТОП-10 САМЫХ БОЛЬШИХ ФАЙЛОВ:")
        for i, file_info in enumerate(content['largest_files'][:10], 1):
            size_str = self._format_size(file_info['size'])
            print(f"   {i:2d}. {size_str:>10} | {file_info['name']}")
            print(f"       📁 {file_info['path'].parent}")
        
        # 4. Примеры содержимого
        print(f"\n📖 АНАЛИЗ СОДЕРЖИМОГО (образцы):")
        for sample in content['sample_contents'][:5]:
            print(f"\n   📄 Файл: {Path(sample['file']).name}")
            print(f"   📏 Размер: {self._format_size(sample['size'])}")
            
            content_info = sample['content']
            print(f"   🔍 Тип: {content_info.get('type', 'unknown')}")
            
            if 'parquet_info' in content_info:
                pinfo = content_info['parquet_info']
                print(f"   📊 Parquet:")
                print(f"      • Строк: {pinfo['num_rows']:,}")
                print(f"      • Колонок: {pinfo['num_columns']}")
                print(f"      • Row groups: {pinfo['num_row_groups']}")
                print(f"      • Сжатый размер: {self._format_size(pinfo['compressed_size'])}")
            
            elif 'preview' in content_info:
                print(f"   📝 Превью: {content_info['preview']}")
        
        # 5. Дубликаты
        print(f"\n🗑️ АНАЛИЗ ДУБЛИКАТОВ:")
        duplicates = results['duplicates']
        
        if duplicates['identical_files']:
            total_waste = sum(dup['waste_space'] for dup in duplicates['identical_files'])
            print(f"   ❌ Найдены идентичные файлы!")
            print(f"   💾 Потенциальная экономия: {self._format_size(total_waste)}")
            
            for dup in duplicates['identical_files'][:3]:
                print(f"      • {dup['count']} файлов по {self._format_size(dup['size'])}")
        else:
            print(f"   ✅ Идентичных файлов не найдено")
        
        if duplicates['empty_files']:
            print(f"   📭 Пустых файлов: {len(duplicates['empty_files'])}")
        
        # 6. Временное распределение
        print(f"\n⏰ ВРЕМЕННОЕ РАСПРЕДЕЛЕНИЕ:")
        time_analysis = results['time_analysis']
        
        if time_analysis['oldest_file'] and time_analysis['newest_file']:
            oldest = time_analysis['oldest_file']
            newest = time_analysis['newest_file']
            
            print(f"   📅 Период данных:")
            print(f"      • Самый старый: {oldest['time']} ({self._format_size(oldest['size'])})")
            print(f"      • Самый новый: {newest['time']} ({self._format_size(newest['size'])})")
            
            span = newest['time'] - oldest['time']
            print(f"      • Диапазон: {span.days} дней, {span.seconds // 3600} часов")
        
        # Активность по часам
        hourly = time_analysis['files_by_hour']
        if hourly:
            busiest_hours = sorted(hourly.items(), key=lambda x: x[1], reverse=True)[:3]
            print(f"   🕐 Самые активные часы:")
            for hour, count in busiest_hours:
                print(f"      • {hour:02d}:00 - {count:,} файлов")
        
        # 7. Аномалии
        print(f"\n🚨 НАЙДЕННЫЕ АНОМАЛИИ:")
        anomalies = results['anomalies']
        
        if anomalies['oversized_files']:
            print(f"   📈 Аномально большие файлы:")
            for anom in anomalies['oversized_files'][:5]:
                print(f"      • {Path(anom['file']).name}: {self._format_size(anom['size'])} (ожидалось < {anom['expected_max']})")
        
        if anomalies['undersized_files']:
            print(f"   📉 Аномально маленькие файлы: {len(anomalies['undersized_files'])}")
        
        if anomalies['suspicious_names']:
            print(f"   🤔 Подозрительные имена: {len(anomalies['suspicious_names'])}")
        
        # 8. ВЫВОДЫ
        print(f"\n" + "="*80)
        print("🎯 ВЫВОДЫ И РЕКОМЕНДАЦИИ")
        print("="*80)
        
        self._generate_conclusions(results)
    
    def _generate_conclusions(self, results):
        """Генерация выводов на основе анализа"""
        content = results['content']
        
        # Подсчитываем реальное использование места
        total_data_files = 0
        total_meta_files = 0
        
        for ext, info in content['file_types'].items():
            if ext in ['.1', '.parquet']:
                total_data_files += info['total_size']
            elif ext == '.meta':
                total_meta_files += info['total_size']
        
        print(f"📊 РЕАЛЬНОЕ РАСПРЕДЕЛЕНИЕ МЕСТА:")
        print(f"   • Файлы данных (.1): {self._format_size(total_data_files)} ({total_data_files/1024**3:.1f} GB)")
        print(f"   • Метаданные (.meta): {self._format_size(total_meta_files)} ({total_meta_files/1024**2:.1f} MB)")
        
        # Анализ эффективности
        if total_data_files > 0:
            data_count = content['file_types'].get('.1', {}).get('count', 0)
            avg_data_file = total_data_files / max(data_count, 1)
            
            print(f"\n🔍 АНАЛИЗ ЭФФЕКТИВНОСТИ:")
            print(f"   • Средний размер файла данных: {self._format_size(avg_data_file)}")
            
            if avg_data_file < 10 * 1024 * 1024:  # < 10MB
                print(f"   ❌ ПРОБЛЕМА: Файлы слишком маленькие!")
                print(f"   💡 Рекомендация: Увеличить batch_size в 10-100 раз")
            
            # Оценка сжатия
            estimated_uncompressed = total_data_files * 3  # Примерно 3x сжатие для Parquet
            print(f"   📦 Оценка сжатия: {self._format_size(estimated_uncompressed)} → {self._format_size(total_data_files)}")
            print(f"   📈 Коэффициент сжатия: ~{estimated_uncompressed/max(total_data_files, 1):.1f}x")
        
        # Проверяем разумность объема данных
        print(f"\n🤔 ПРОВЕРКА РАЗУМНОСТИ ОБЪЕМА:")
        
        # Для криптовалютных данных
        time_analysis = results['time_analysis']
        if time_analysis['oldest_file'] and time_analysis['newest_file']:
            oldest = time_analysis['oldest_file']['time']
            newest = time_analysis['newest_file']['time']
            days = (newest - oldest).days + 1
            
            gb_per_day = total_data_files / 1024**3 / days
            print(f"   📈 Данных в день: {gb_per_day:.2f} GB")
            print(f"   📊 За {days} дней: {total_data_files/1024**3:.1f} GB")
            
            # Примерная оценка для BTC trades
            if gb_per_day > 50:
                print(f"   ⚠️ МНОГО: {gb_per_day:.1f} GB/день кажется избыточным для одной пары BTC")
                print(f"   🔍 Возможные причины:")
                print(f"      • Дублирование данных")
                print(f"      • Сохранение избыточной информации")
                print(f"      • Неэффективное сжатие")
            elif gb_per_day < 0.1:
                print(f"   🤔 МАЛО: {gb_per_day:.3f} GB/день кажется мало для активной торговли BTC")
            else:
                print(f"   ✅ НОРМАЛЬНО: {gb_per_day:.1f} GB/день выглядит разумно")

def main():
    """Запуск глубокой инспекции"""
    print("🔬 ГЛУБОКАЯ ИНСПЕКЦИЯ ДАННЫХ")
    print("Выясняем ЧТО именно занимает 101GB места")
    print("="*60)
    
    minio_path = Path("data/minio")
    if not minio_path.exists():
        print(f"❌ Путь {minio_path} не найден!")
        return
    
    inspector = DeepDataInspector(str(minio_path))
    
    try:
        inspector.full_inspection()
        
    except Exception as e:
        print(f"❌ Ошибка инспекции: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()