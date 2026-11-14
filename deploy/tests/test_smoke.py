"""Offline unit tests for deploy/smoke_test.py (the network is mocked).

Run (repo root):  python3 -m unittest discover -s deploy/tests -p 'test_smoke.py'
CI runs it too (.github/workflows/ci-docker.yml).

Covers: public checks pass + login skipped without credentials; a DB that is not
ready fails even if HTTP answers; a login that is not rejected with 401 (e.g. a 500
from a missing users table) fails; the session is logged out even if a check fails;
with EXPECTED_COMMIT set, /api/health must report that commit.
CHANGE ME: if you change the endpoints in smoke_test.py, update `response()` below.
"""
import importlib.util
import io
from pathlib import Path
import unittest
import urllib.error
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('smoke', Path(__file__).parents[1] / 'smoke_test.py')
smoke = importlib.util.module_from_spec(spec)
spec.loader.exec_module(smoke)


COMMIT = '0123456789abcdef0123456789abcdef01234567'


def http_error(code, body):
    return urllib.error.HTTPError('https://demo.test', code, 'error', {}, io.BytesIO(body))


class SmokeTests(unittest.TestCase):
    def response(self, base, path, data=None, token=None):
        if path == '/api/auth/login' and data == smoke.UNKNOWN_LOGIN:
            raise http_error(401, b'{"error":{"code":"INVALID_CREDENTIALS","message":"x"}}')
        return {
            '/api/health': b'{"status":"ok","commit":"' + COMMIT.encode() + b'"}',
            '/api/ready': b'{"db":"connected"}',
            '/': b'<html></html>',
            '/api/auth/login': b'{"token":"test-session"}',
            '/api/auth/me': b'{"id":1}',
            '/api/auth/logout': b'{}',
        }[path]

    @patch.dict('os.environ', {}, clear=True)
    def test_public_checks_pass_and_skip_optional_login(self):
        with patch.object(smoke, 'request', side_effect=self.response) as req:
            smoke.check('https://demo.test')
            self.assertEqual(req.call_count, 4)

    @patch.dict('os.environ', {}, clear=True)
    def test_db_not_ready_fails_even_when_http_responds(self):
        def disconnected(base, path, data=None, token=None):
            return b'{"db":"disconnected"}' if path == '/api/ready' else self.response(base, path, data, token)
        with patch.object(smoke, 'request', side_effect=disconnected), patch.object(smoke.time, 'sleep'):
            with self.assertRaisesRegex(RuntimeError, '/api/ready'):
                smoke.check('https://demo.test')

    @patch.dict('os.environ', {}, clear=True)
    def test_login_server_error_fails_instead_of_401(self):
        def no_users_table(base, path, data=None, token=None):
            if path == '/api/auth/login':
                raise http_error(500, b'{"error":{"code":"INTERNAL","message":"x"}}')
            return self.response(base, path, data, token)
        with patch.object(smoke, 'request', side_effect=no_users_table), patch.object(smoke.time, 'sleep'):
            with self.assertRaisesRegex(RuntimeError, 'unknown account'):
                smoke.check('https://demo.test')

    @patch.dict('os.environ', {'SMOKE_EMAIL': 'smoke@example.test', 'SMOKE_PASSWORD': 'test-only'}, clear=True)
    def test_session_is_logged_out_even_if_me_fails(self):
        def broken_me(base, path, data=None, token=None):
            if path == '/api/auth/me':
                raise ValueError('Broken response')
            return self.response(base, path, data, token)
        with patch.object(smoke, 'request', side_effect=broken_me) as req:
            with self.assertRaisesRegex(RuntimeError, 'Login smoke'):
                smoke.check('https://demo.test')
            self.assertEqual(req.call_args.args[1], '/api/auth/logout')

    @patch.dict('os.environ', {'EXPECTED_COMMIT': COMMIT}, clear=True)
    def test_expected_commit_passes_when_health_reports_it(self):
        with patch.object(smoke, 'request', side_effect=self.response), patch('builtins.print') as out:
            smoke.check('https://demo.test')
        out.assert_any_call('PASS running commit ' + COMMIT)

    @patch.dict('os.environ', {'EXPECTED_COMMIT': 'f' * 40}, clear=True)
    def test_old_release_still_answering_fails(self):
        with patch.object(smoke, 'request', side_effect=self.response), patch.object(smoke.time, 'sleep'):
            with self.assertRaisesRegex(RuntimeError, '/api/health'):
                smoke.check('https://demo.test')


if __name__ == '__main__':
    unittest.main()
