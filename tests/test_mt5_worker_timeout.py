import unittest
import time
import sys
import os

# Mock paths
sys.path.append(os.getcwd())

from src.infra.mt5.mt5_worker_client import MT5WorkerClient

class TestMT5WorkerRobustness(unittest.TestCase):
    def setUp(self):
        self.client = MT5WorkerClient()
        self.client.start()
        time.sleep(2) # Warmup

    def tearDown(self):
        self.client.stop()

    def test_timeout_and_recovery(self):
        print("\n--- TEST: Worker Timeout & Recovery ---")
        pid_before = self.client.process.pid
        
        # Send Sleep Command (Simulate Hang) > Timeout (2s override)
        res = self.client.send_command("_simulate_hang", args=[5], timeout=1.0)
        self.assertIsNone(res)
        
        # Expect Restart
        time.sleep(2)
        pid_after = self.client.process.pid
        self.assertNotEqual(pid_before, pid_after)
        print(f"Recovered. PID: {pid_before} -> {pid_after}")

    def test_circuit_breaker_logic(self):
        # We can't trigger the real guard logic easily from here without dependencies,
        # but we can verify that rapid restarts increment the restart counter correctly
        # which feeds the breaker.
        print("\n--- TEST: Restart Counter ---")
        count_start = self.client.restart_count
        
        # Force a restart
        self.client.restart()
        time.sleep(1)
        self.assertEqual(self.client.restart_count, count_start + 1)

    def test_default_timeout_config(self):
        print("\n--- TEST: Default Timeouts ---")
        # Ensure dict exists
        self.assertIn("order_send", self.client.TIMEOUTS)
        self.assertEqual(self.client.TIMEOUTS["order_send"], 10.0)

if __name__ == "__main__":
    unittest.main()
