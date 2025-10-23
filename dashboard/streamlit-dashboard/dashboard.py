import streamlit as st
import docker
import psutil
import pandas as pd
import plotly.graph_objects as go
import plotly.express as px
from plotly.subplots import make_subplots
import time
from datetime import datetime, timedelta
import numpy as np
import subprocess
import json
import threading
import queue
from typing import Dict, Any
import os
import requests
from functools import lru_cache
import concurrent.futures

# Page configuration
st.set_page_config(
    page_title="⚡ Ultra Lakehouse Monitor",
    page_icon="⚡",
    layout="wide",
    initial_sidebar_state="collapsed"
)

# Ultra-fast CSS
st.markdown("""
<style>
    .main-header { 
        background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
        color: white; padding: 1rem; border-radius: 10px; margin-bottom: 1rem;
        text-align: center; font-size: 1.5rem; font-weight: bold;
    }
    .metric-row { 
        display: flex; justify-content: space-between; margin: 0.5rem 0;
        background: #f8f9fa; padding: 0.5rem; border-radius: 5px;
    }
    .metric-big { font-size: 1.2rem; font-weight: bold; color: #2c3e50; }
    .metric-small { font-size: 0.9rem; color: #7f8c8d; }
    .status-ok { color: #27ae60; font-weight: bold; }
    .status-warn { color: #f39c12; font-weight: bold; }
    .status-error { color: #e74c3c; font-weight: bold; }
    .compact-table { font-size: 0.8rem; }
    .alert-box { 
        background: #ffe6e6; border-left: 4px solid #e74c3c; 
        padding: 0.5rem; margin: 0.5rem 0; border-radius: 3px;
    }
    .perf-box {
        background: #e8f5e8; border-left: 4px solid #27ae60;
        padding: 0.5rem; margin: 0.5rem 0; border-radius: 3px;
    }
    .warning-box {
        background: #fff3cd; border-left: 4px solid #f39c12;
        padding: 0.5rem; margin: 0.5rem 0; border-radius: 3px;
    }
    .info-box {
        background: #e6f3ff; border-left: 4px solid #007bff;
        padding: 0.5rem; margin: 0.5rem 0; border-radius: 3px;
    }
</style>
""", unsafe_allow_html=True)

# Initialize session state for caching
if 'metrics_cache' not in st.session_state:
    st.session_state.metrics_cache = {}
    st.session_state.last_fetch = 0
    st.session_state.fetch_errors = []
    st.session_state.performance_history = {
        'cpu': [], 'memory': [], 'disk': [], 'network_in': [], 'network_out': [],
        'containers_running': [], 'kafka_lag': [], 'docker_memory': []
    }
    st.session_state.btc_price = 0.0
    st.session_state.btc_last_update = 0

# Cache for expensive operations
@st.cache_data(ttl=30)  # Cache for 30 seconds
def get_real_btc_price():
    """Get real BTC price from Binance API"""
    try:
        response = requests.get('https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT', timeout=5)
        if response.status_code == 200:
            data = response.json()
            return float(data['price'])
    except Exception as e:
        st.error(f"Failed to fetch BTC price: {e}")
    
    # Fallback to mock data if API fails
    return 45000.0 + (np.random.random() * 1000 - 500)  # Random around 45k

@st.cache_data(ttl=10)  # Cache system metrics for 10 seconds
def get_system_metrics():
    """Get system metrics with caching"""
    try:
        cpu_percent = psutil.cpu_percent(interval=0.1)
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage('/')
        
        return {
            'cpu_percent': round(cpu_percent, 1),
            'memory_percent': round(memory.percent, 1),
            'memory_used_gb': round(memory.used / 1024**3, 2),
            'memory_total_gb': round(memory.total / 1024**3, 2),
            'disk_percent': round(disk.percent, 1),
            'disk_used_gb': round(disk.used / 1024**3, 2),
            'disk_total_gb': round(disk.total / 1024**3, 2),
            'processes_count': len(psutil.pids())
        }
    except Exception as e:
        return {'error': str(e)}

def get_docker_metrics_light():
    """Lightweight docker metrics without detailed stats"""
    try:
        client = docker.from_env()
        containers = client.containers.list(all=True)
        
        container_data = []
        running_count = sum(1 for c in containers if c.status == 'running')
        
        for container in containers:
            info = {
                'name': container.name,
                'status': container.status,
                'image': container.image.tags[0] if container.image.tags else 'unknown',
            }
            container_data.append(info)
        
        return {
            'containers': container_data,
            'running_count': running_count,
            'total_count': len(containers)
        }
    except Exception as e:
        return {'error': str(e)}

def collect_fast_metrics():
    """Collect only fast metrics for real-time display"""
    start_time = time.time()
    metrics = {}
    
    # Get BTC price (cached)
    current_time = time.time()
    if current_time - st.session_state.btc_last_update > 30:  # Update every 30 seconds
        st.session_state.btc_price = get_real_btc_price()
        st.session_state.btc_last_update = current_time
    
    # System metrics (cached)
    metrics['system'] = get_system_metrics()
    
    # Lightweight docker metrics
    metrics['docker'] = get_docker_metrics_light()
    
    # Mock data pipeline metrics (fast)
    metrics['data'] = {
        'current_btc_price': st.session_state.btc_price,
        'total_records': 1574832 + int((time.time() % 100)),  # Simulate growth
        'processing_rate_per_sec': 4.2,
        'data_freshness_seconds': 5,
        'success_rate_percent': 99.97
    }
    
    metrics['meta'] = {
        'fetch_time_ms': round((time.time() - start_time) * 1000, 1),
        'timestamp': datetime.now()
    }
    
    return metrics

def collect_slow_metrics():
    """Collect slower metrics that don't need real-time updates"""
    metrics = {}
    
    # Detailed docker stats (slower)
    try:
        client = docker.from_env()
        containers = client.containers.list(all=True)
        
        container_details = []
        for container in containers[:5]:  # Limit to 5 containers for performance
            if container.status == 'running':
                try:
                    stats = container.stats(stream=False)
                    # Simplified stats calculation
                    memory_usage = stats['memory_stats'].get('usage', 0)
                    memory_mb = memory_usage / 1024**2
                    
                    info = {
                        'name': container.name,
                        'memory_mb': round(memory_mb, 1),
                        'status': container.status
                    }
                    container_details.append(info)
                except:
                    continue
        
        metrics['docker_details'] = container_details
    except Exception as e:
        metrics['docker_details'] = {'error': str(e)}
    
    return metrics

def update_performance_history(metrics):
    """Update performance history for trends"""
    history = st.session_state.performance_history
    
    if 'system' in metrics and 'error' not in metrics['system']:
        # Keep history manageable
        for key in ['cpu', 'memory', 'disk']:
            if len(history[key]) > 20:
                history[key] = history[key][-20:]
        
        history['cpu'].append(metrics['system']['cpu_percent'])
        history['memory'].append(metrics['system']['memory_percent'])
        history['disk'].append(metrics['system']['disk_percent'])

def create_mini_chart(data, title, color='blue', height=150):
    """Create mini trend chart"""
    if not data or len(data) < 2:
        fig = go.Figure()
        fig.add_annotation(text="No data", xref="paper", yref="paper", x=0.5, y=0.5, showarrow=False)
        return fig
    
    fig = go.Figure(go.Scatter(
        y=data,
        mode='lines',
        line=dict(color=color, width=2),
        fill='tozeroy',
        fillcolor=f'rgba{tuple(int(color.lstrip("#")[i:i+2], 16) for i in (0, 2, 4)) + (0.2,)}' if color.startswith('#') else f'rgba(100, 100, 200, 0.2)'
    ))
    fig.update_layout(
        title=dict(text=title, font=dict(size=10)),
        height=height,
        margin=dict(t=30, b=10, l=10, r=10),
        showlegend=False,
        xaxis=dict(showticklabels=False, showgrid=False),
        yaxis=dict(showticklabels=True, tickfont=dict(size=8), showgrid=False)
    )
    return fig

def format_uptime(seconds):
    days = int(seconds // 86400)
    hours = int((seconds % 86400) // 3600)
    minutes = int((seconds % 3600) // 60)
    return f"{days}d {hours}h {minutes}m"

def main():
    # Ultra-fast header
    st.markdown('<div class="main-header">⚡ Ultra-Fast Lakehouse Monitor | Real-time Data Pipeline Analytics</div>', unsafe_allow_html=True)
    
    # Collect metrics with progress
    with st.spinner('🔄 Collecting metrics...'):
        fast_metrics = collect_fast_metrics()
        update_performance_history(fast_metrics)
    
    # Collect slow metrics in background
    if 'slow_metrics' not in st.session_state:
        st.session_state.slow_metrics = {}
    
    # Update slow metrics less frequently
    current_time = time.time()
    if 'last_slow_update' not in st.session_state or current_time - st.session_state.last_slow_update > 30:
        with st.spinner('📊 Updating detailed metrics...'):
            st.session_state.slow_metrics = collect_slow_metrics()
            st.session_state.last_slow_update = current_time
    
    # Merge metrics
    all_metrics = {**fast_metrics, **st.session_state.slow_metrics}
    
    # === ULTRA-FAST OVERVIEW BAR ===
    col1, col2, col3, col4, col5, col6, col7, col8 = st.columns(8)
    
    system_data = all_metrics.get('system', {})
    docker_data = all_metrics.get('docker', {})
    data_pipeline = all_metrics.get('data', {})
    meta_data = all_metrics.get('meta', {})
    
    with col1:
        if 'error' not in data_pipeline:
            records = data_pipeline.get('total_records', 0)
            rate = data_pipeline.get('processing_rate_per_sec', 0)
            st.metric("📊 Records", f"{records:,}", f"{rate:.1f}/s")
    
    with col2:
        if 'error' not in system_data:
            cpu = system_data.get('cpu_percent', 0)
            st.metric("🖥️ CPU", f"{cpu:.1f}%")
    
    with col3:
        if 'error' not in system_data:
            mem = system_data.get('memory_percent', 0)
            mem_gb = system_data.get('memory_used_gb', 0)
            st.metric("💾 Memory", f"{mem:.1f}%", f"{mem_gb:.1f}GB")
    
    with col4:
        if 'error' not in system_data:
            disk = system_data.get('disk_percent', 0)
            disk_gb = system_data.get('disk_used_gb', 0)
            st.metric("💿 Disk", f"{disk:.1f}%", f"{disk_gb:.0f}GB")
    
    with col5:
        if 'error' not in docker_data:
            running = docker_data.get('running_count', 0)
            total = docker_data.get('total_count', 0)
            st.metric("🐳 Docker", f"{running}/{total}")
    
    with col6:
        if 'error' not in data_pipeline:
            btc_price = data_pipeline.get('current_btc_price', 0)
            st.metric("💰 BTC", f"${btc_price:,.0f}")
    
    with col7:
        if 'error' not in data_pipeline:
            freshness = data_pipeline.get('data_freshness_seconds', 0)
            success_rate = data_pipeline.get('success_rate_percent', 0)
            st.metric("📈 Health", f"{success_rate:.1f}%", f"{freshness}s fresh")
    
    with col8:
        fetch_time = meta_data.get('fetch_time_ms', 0)
        st.metric("⚡ Performance", f"{fetch_time:.0f}ms")

    # === SYSTEM STATUS ===
    st.subheader("📊 System Status")
    
    col1, col2, col3 = st.columns(3)
    
    with col1:
        st.markdown("**🖥️ System Resources**")
        if 'error' not in system_data:
            st.progress(system_data['cpu_percent'] / 100, text=f"CPU: {system_data['cpu_percent']}%")
            st.progress(system_data['memory_percent'] / 100, text=f"Memory: {system_data['memory_percent']}%")
            st.progress(system_data['disk_percent'] / 100, text=f"Disk: {system_data['disk_percent']}%")
    
    with col2:
        st.markdown("**🐳 Docker Status**")
        if 'error' not in docker_data:
            running = docker_data.get('running_count', 0)
            total = docker_data.get('total_count', 0)
            if total > 0:
                st.progress(running / total, text=f"Containers: {running}/{total} running")
            
            # Show container status
            containers = docker_data.get('containers', [])
            for container in containers[:3]:  # Show only first 3
                status_icon = "🟢" if container['status'] == 'running' else "🔴"
                st.text(f"{status_icon} {container['name']}")
    
    with col3:
        st.markdown("**💰 Market Data**")
        if 'error' not in data_pipeline:
            btc_price = data_pipeline.get('current_btc_price', 0)
            st.metric("Bitcoin Price", f"${btc_price:,.2f}")
            st.text(f"Data freshness: {data_pipeline.get('data_freshness_seconds', 0)}s")
            st.text(f"Success rate: {data_pipeline.get('success_rate_percent', 0)}%")

    # === PERFORMANCE TRENDS ===
    st.subheader("📈 Performance Trends")
    
    history = st.session_state.performance_history
    
    col1, col2, col3, col4 = st.columns(4)
    
    with col1:
        if history['cpu']:
            fig_cpu = create_mini_chart(history['cpu'], "CPU Usage %", "#e74c3c")
            st.plotly_chart(fig_cpu, use_container_width=True)
    
    with col2:
        if history['memory']:
            fig_mem = create_mini_chart(history['memory'], "Memory Usage %", "#f39c12")
            st.plotly_chart(fig_mem, use_container_width=True)
    
    with col3:
        if history['disk']:
            fig_disk = create_mini_chart(history['disk'], "Disk Usage %", "#27ae60")
            st.plotly_chart(fig_disk, use_container_width=True)
    
    with col4:
        if history['containers_running']:
            fig_containers = create_mini_chart(history['containers_running'], "Running Containers", "#9b59b6")
            st.plotly_chart(fig_containers, use_container_width=True)

    # === DETAILED CONTAINER INFO ===
    if 'docker_details' in all_metrics and 'error' not in all_metrics['docker_details']:
        st.subheader("🐳 Container Details")
        containers = all_metrics['docker_details']
        if containers and len(containers) > 0:
            for container in containers:
                col1, col2 = st.columns([3, 1])
                with col1:
                    st.text(f"📦 {container['name']}")
                with col2:
                    st.text(f"💾 {container.get('memory_mb', 0):.0f}MB")

    # === ALERTS ===
    st.subheader("🚨 System Alerts")
    
    alerts = []
    
    # System alerts
    if 'error' not in system_data:
        if system_data.get('cpu_percent', 0) > 80:
            alerts.append(("🔴 High CPU", f"CPU usage at {system_data['cpu_percent']}%"))
        if system_data.get('memory_percent', 0) > 85:
            alerts.append(("🔴 High Memory", f"Memory usage at {system_data['memory_percent']}%"))
        if system_data.get('disk_percent', 0) > 90:
            alerts.append(("🔴 High Disk", f"Disk usage at {system_data['disk_percent']}%"))
    
    # Docker alerts
    if 'error' not in docker_data:
        if docker_data.get('running_count', 0) == 0:
            alerts.append(("🔴 Critical", "No containers running"))
    
    # Data pipeline alerts
    if 'error' not in data_pipeline:
        if data_pipeline.get('data_freshness_seconds', 0) > 60:
            alerts.append(("🟡 Warning", f"Stale data: {data_pipeline['data_freshness_seconds']}s"))
        if data_pipeline.get('success_rate_percent', 100) < 99:
            alerts.append(("🟡 Warning", f"Low success rate: {data_pipeline['success_rate_percent']}%"))
    
    if alerts:
        for severity, message in alerts:
            if "🔴" in severity:
                st.error(f"{severity} {message}")
            else:
                st.warning(f"{severity} {message}")
    else:
        st.success("🟢 All systems operational")

    # === AUTO-REFRESH ===
    st.subheader("🔄 Auto-Refresh")
    
    col1, col2, col3 = st.columns(3)
    
    with col1:
        auto_refresh = st.checkbox("Enable auto-refresh", value=True)
    with col2:
        refresh_rate = st.selectbox("Refresh rate", [5, 10, 30, 60], index=1)
    with col3:
        if st.button("🔄 Refresh Now"):
            st.rerun()
    
    st.write(f"Last update: {meta_data.get('timestamp', datetime.now()).strftime('%H:%M:%S')}")
    
    # Auto-refresh
    if auto_refresh:
        time.sleep(refresh_rate)
        st.rerun()

if __name__ == "__main__":
    main()