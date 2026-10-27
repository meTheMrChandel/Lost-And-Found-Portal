"""
run_benchmarks.py — Helper to run a quick headless performance benchmark.
"""

import subprocess
import sys


def run_benchmark(host="http://127.0.0.1:8000", users=20, spawn_rate=5, run_time="10s"):
    print(f"Starting Locust headless load test against {host}...")
    print(f"Users: {users}, Spawn rate: {spawn_rate}/s, Duration: {run_time}")
    
    cmd = [
        sys.executable,
        "-m",
        "locust",
        "-f",
        "tests/load_testing/locustfile.py",
        "--headless",
        "--host",
        host,
        "-u",
        str(users),
        "-r",
        str(spawn_rate),
        "--run-time",
        run_time,
    ]
    
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, check=False)
        print("Locust output summary:")
        print(proc.stdout)
        if proc.stderr:
            print("Locust logs/warnings:")
            print(proc.stderr)
        return proc.returncode
    except Exception as e:
        print(f"Failed to execute benchmark: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(run_benchmark())
