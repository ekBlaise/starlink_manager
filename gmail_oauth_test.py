#!/usr/bin/env python3

import requests
import json
from datetime import datetime

class GmailOAuthTester:
    def __init__(self, base_url="https://starops-manager.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.token = None
        self.test_results = []

    def log_test(self, name: str, success: bool, details: str = ""):
        """Log test result"""
        if success:
            print(f"✅ {name}")
        else:
            print(f"❌ {name} - {details}")
        
        self.test_results.append({
            "test": name,
            "success": success,
            "details": details
        })

    def make_request(self, method: str, endpoint: str, data=None, expected_status: int = 200):
        """Make API request with proper headers"""
        url = f"{self.api_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'

        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=10)
            else:
                return False, {"error": f"Unsupported method: {method}"}

            success = response.status_code == expected_status
            try:
                response_data = response.json()
            except:
                response_data = {"status_code": response.status_code, "text": response.text}

            return success, response_data

        except Exception as e:
            return False, {"error": str(e)}

    def login_with_test_credentials(self):
        """Login with test credentials"""
        login_data = {
            "email": "test@example.com",
            "password": "Test123!"
        }
        
        success, response = self.make_request('POST', 'auth/login', login_data, 200)
        if success and 'token' in response:
            self.token = response['token']
            self.log_test("Login with test credentials", True)
            return True
        else:
            self.log_test("Login with test credentials", False, f"Response: {response}")
            return False

    def test_google_oauth_callback_missing_code(self):
        """Test Google OAuth Callback - POST /api/auth/google/callback without code"""
        success, response = self.make_request('POST', 'auth/google/callback', {}, 400)
        expected_error = "Authorization code required"
        if success and expected_error in response.get('detail', ''):
            self.log_test("Google OAuth Callback - Missing Code", True)
            return True
        else:
            self.log_test("Google OAuth Callback - Missing Code", False, f"Expected '{expected_error}', got: {response}")
            return False

    def test_google_oauth_callback_invalid_code(self):
        """Test Google OAuth Callback with invalid code"""
        test_data = {
            "code": "invalid_auth_code_12345",
            "redirect_uri": "http://localhost:3000/login"
        }
        success, response = self.make_request('POST', 'auth/google/callback', test_data, 400)
        # Should return error for invalid code
        if success and 'detail' in response:
            self.log_test("Google OAuth Callback - Invalid Code Error Handling", True)
            return True
        else:
            self.log_test("Google OAuth Callback - Invalid Code Error Handling", False, f"Response: {response}")
            return False

    def test_gmail_status_unauthenticated(self):
        """Test Gmail Status - GET /api/gmail/status without auth"""
        # Temporarily remove token
        original_token = self.token
        self.token = None
        success, response = self.make_request('GET', 'gmail/status', None, 401)
        self.token = original_token
        
        if success and 'Not authenticated' in response.get('detail', ''):
            self.log_test("Gmail Status - Requires Authentication", True)
            return True
        else:
            self.log_test("Gmail Status - Requires Authentication", False, f"Response: {response}")
            return False

    def test_gmail_status_authenticated(self):
        """Test Gmail Status - GET /api/gmail/status with auth"""
        success, response = self.make_request('GET', 'gmail/status', None, 200)
        if success and 'connected' in response and response['connected'] == False:
            self.log_test("Gmail Status - Returns Not Connected", True)
            return True
        else:
            self.log_test("Gmail Status - Returns Not Connected", False, f"Response: {response}")
            return False

    def test_gmail_disconnect_unauthenticated(self):
        """Test Gmail Disconnect - POST /api/gmail/disconnect without auth"""
        original_token = self.token
        self.token = None
        success, response = self.make_request('POST', 'gmail/disconnect', {}, 401)
        self.token = original_token
        
        if success and 'Not authenticated' in response.get('detail', ''):
            self.log_test("Gmail Disconnect - Requires Authentication", True)
            return True
        else:
            self.log_test("Gmail Disconnect - Requires Authentication", False, f"Response: {response}")
            return False

    def test_gmail_disconnect_authenticated(self):
        """Test Gmail Disconnect - POST /api/gmail/disconnect with auth"""
        success, response = self.make_request('POST', 'gmail/disconnect', {}, 200)
        if success and 'message' in response:
            self.log_test("Gmail Disconnect - Returns Success", True)
            return True
        else:
            self.log_test("Gmail Disconnect - Returns Success", False, f"Response: {response}")
            return False

    def test_gmail_sync_unauthenticated(self):
        """Test Gmail Sync - POST /api/gmail/sync without auth"""
        original_token = self.token
        self.token = None
        success, response = self.make_request('POST', 'gmail/sync', {}, 401)
        self.token = original_token
        
        if success and 'Not authenticated' in response.get('detail', ''):
            self.log_test("Gmail Sync - Requires Authentication", True)
            return True
        else:
            self.log_test("Gmail Sync - Requires Authentication", False, f"Response: {response}")
            return False

    def test_gmail_sync_not_connected(self):
        """Test Gmail Sync - POST /api/gmail/sync when not connected"""
        success, response = self.make_request('POST', 'gmail/sync', {}, 400)
        expected_error = "Gmail not connected. Please sign in with Google first."
        if success and expected_error in response.get('detail', ''):
            self.log_test("Gmail Sync - Error When Not Connected", True)
            return True
        else:
            self.log_test("Gmail Sync - Error When Not Connected", False, f"Expected '{expected_error}', got: {response}")
            return False

    def test_gmail_emails_unauthenticated(self):
        """Test Gmail Emails - GET /api/gmail/emails without auth"""
        original_token = self.token
        self.token = None
        success, response = self.make_request('GET', 'gmail/emails', None, 401)
        self.token = original_token
        
        if success and 'Not authenticated' in response.get('detail', ''):
            self.log_test("Gmail Emails - Requires Authentication", True)
            return True
        else:
            self.log_test("Gmail Emails - Requires Authentication", False, f"Response: {response}")
            return False

    def test_gmail_emails_authenticated(self):
        """Test Gmail Emails - GET /api/gmail/emails with auth"""
        success, response = self.make_request('GET', 'gmail/emails', None, 200)
        if success and isinstance(response, list):
            self.log_test("Gmail Emails - Returns List", True)
            return True
        else:
            self.log_test("Gmail Emails - Returns List", False, f"Response: {response}")
            return False

    def run_tests(self):
        """Run all Gmail OAuth tests"""
        print("🔍 Testing Google OAuth and Gmail Sync Implementation")
        print("=" * 60)
        
        # Login first
        if not self.login_with_test_credentials():
            print("❌ Cannot proceed without authentication")
            return
        
        print("\n📧 Google OAuth Callback Tests")
        self.test_google_oauth_callback_missing_code()
        self.test_google_oauth_callback_invalid_code()
        
        print("\n📊 Gmail Status Tests")
        self.test_gmail_status_unauthenticated()
        self.test_gmail_status_authenticated()
        
        print("\n🔌 Gmail Disconnect Tests")
        self.test_gmail_disconnect_unauthenticated()
        self.test_gmail_disconnect_authenticated()
        
        print("\n🔄 Gmail Sync Tests")
        self.test_gmail_sync_unauthenticated()
        self.test_gmail_sync_not_connected()
        
        print("\n📬 Gmail Emails Tests")
        self.test_gmail_emails_unauthenticated()
        self.test_gmail_emails_authenticated()
        
        # Summary
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result['success'])
        failed_tests = total_tests - passed_tests
        success_rate = (passed_tests / total_tests * 100) if total_tests > 0 else 0
        
        print("\n" + "=" * 60)
        print("📋 GMAIL OAUTH TEST SUMMARY")
        print("=" * 60)
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {failed_tests}")
        print(f"Success Rate: {success_rate:.1f}%")
        
        if failed_tests > 0:
            print("\n❌ Failed Tests:")
            for result in self.test_results:
                if not result['success']:
                    print(f"  - {result['test']}: {result['details']}")
        
        return failed_tests == 0

if __name__ == "__main__":
    tester = GmailOAuthTester()
    success = tester.run_tests()
    exit(0 if success else 1)